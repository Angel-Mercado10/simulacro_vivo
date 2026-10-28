import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { loadConfig } from './config.js';
import { TraceRecorder } from './shared/evidence/trace-recorder.js';
import { CostGuard, BudgetExceededError, sparkCostUsd } from './shared/budget/cost-guard.js';
import { normalizeImage, drawRedBox } from './shared/imaging/image-normalizer.js';
import { createMetaClient } from './shared/meta/meta-client.js';
import { SparkClient } from './shared/meta/spark-client.js';
import { SamClient } from './shared/meta/sam-client.js';
import { MetaAccessError, MetaApiError } from './shared/meta/meta-errors.js';
import {
  ArrivalCheckJsonSchema, ArrivalCheckSchema, FixVerificationJsonSchema, FixVerificationSchema,
  HazardDetectionJsonSchema, HazardDetectionSchema, hazardCatalog,
  type Hazard, type HouseholdProfile, type Room, type SafeZone,
} from '@simulacro/contracts';
import { hazardDetectionPrompt, fixVerificationPrompt, arrivalCheckPrompt } from './features/scan-room/hazard-detection.prompt.js';
import { validateDetectedHazards } from './features/scan-room/validator.js';
import { resolveMasks } from './features/scan-room/mask-resolver.js';
import { planMissions } from './features/plan-missions/mission-planner.js';
import { decideFixStatus } from './features/verify-fix/decide-fix-status.js';
import { buildTemplateScenario, evaluateDrill, validateSafeZone } from './features/drills/drill-engine.js';

const config = loadConfig();
const costGuard = new CostGuard({
  sessionBudgetUsd: config.sessionBudgetUsd, dailyBudgetUsd: config.dailyBudgetUsd,
  sparkInputPricePer1M: config.sparkInputPricePer1M, sparkOutputPricePer1M: config.sparkOutputPricePer1M,
  samPricePerImage: config.samPricePerImage, voicePricePerHour: config.voicePricePerHour,
});

function sessionIdOf(request: { headers: Record<string, unknown> }): string {
  const value = request.headers['x-session-id'];
  return typeof value === 'string' && value.length > 0 ? value : 'anonymous';
}

function requireDemoCode(request: { headers: Record<string, unknown> }): boolean {
  if (!config.demoAccessCode) return true;
  return request.headers['x-demo-code'] === config.demoAccessCode;
}

function errorBody(code: string, messageEs: string, retryable: boolean) {
  return { error: { code, messageEs, retryable } };
}

function metaErrorReply(error: unknown) {
  if (error instanceof BudgetExceededError) return { status: 429, body: errorBody('BUDGET_EXCEEDED', 'Se alcanzó el límite de uso de la demo.', false) };
  if (error instanceof MetaAccessError) return { status: 502, body: errorBody('META_ACCESS_DENIED', 'Sin acceso al modelo de Meta para este equipo.', false) };
  if (error instanceof MetaApiError) {
    if (error.status === 400) return { status: 502, body: errorBody('META_BAD_REQUEST', 'Meta rechazó la solicitud.', false) };
    if (error.status === 429) return { status: 503, body: errorBody('META_RATE_LIMITED', 'Meta limitó la tasa; inténtalo de nuevo.', true) };
    return { status: 504, body: errorBody('META_TIMEOUT', 'Se excedió el tiempo de espera con Meta.', true) };
  }
  return { status: 500, body: errorBody('META_TIMEOUT', 'Error inesperado del servidor.', true) };
}

export async function buildServer() {
  const app = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024 });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(rateLimit, { max: 30, timeWindow: '1 minute' });

  // Single-service deploy: serve the built web app when apps/web/dist exists.
  const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const webDist = `${here}../../web/dist`;
  const { existsSync } = await import('node:fs');
  if (existsSync(`${webDist}/index.html`)) {
    const fastifyStatic = (await import('@fastify/static')).default;
    await app.register(fastifyStatic, { root: webDist });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send(errorBody('VALIDATION_FAILED', 'Ruta no encontrada.', false));
      }
      return reply.sendFile('index.html');
    });
  }

  app.get('/api/health', async () => ({ ok: true, version: '0.1.0' }));

  const metaRateLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } } as never;

  app.post('/api/rooms/scan', metaRateLimit, async (request, reply) => {
    const trace = new TraceRecorder();
    if (!requireDemoCode(request)) return reply.code(401).send(errorBody('DEMO_CODE_REQUIRED', 'Falta el código de la demo.', false));
    if (!config.modelApiKey) return reply.code(502).send(errorBody('META_ACCESS_DENIED', 'MODEL_API_KEY no está configurada.', false));
    try {
      const fields = (request as unknown as { body: Record<string, unknown> }).body ?? {};
      const file = await (request as unknown as { file: () => Promise<{ toBuffer: () => Promise<Buffer> } | undefined> }).file();
      if (!file) return reply.code(422).send(errorBody('VALIDATION_FAILED', 'Falta la foto.', false));
      const roomId = String((fields as { roomId?: string }).roomId ?? '');
      const roomKind = String((fields as { roomKind?: string }).roomKind ?? 'other');
      const photoId = String((fields as { photoId?: string }).photoId ?? 'photo-1');
      const raw = await file.toBuffer();
      const normalized = await trace.measure('normalize', null, () => normalizeImage(raw));
      costGuard.assertCanSpend(sessionIdOf(request), 0.02);
      const spark = new SparkClient(createMetaClient(config), config.sparkModel);
      const result = await trace.measure('spark.detect', config.sparkModel, () =>
        spark.completeStructured({
          schemaName: 'HazardDetection', jsonSchema: HazardDetectionJsonSchema,
          userText: hazardDetectionPrompt(roomKind as never),
          imageDataUrls: [normalized.dataUrl],
          parse: (value) => HazardDetectionSchema.parse(value),
        }));
      trace.modelProposal = result.data;
      const cost = sparkCostUsd(result.usage, config.sparkInputPricePer1M, config.sparkOutputPricePer1M);
      costGuard.recordSpend(sessionIdOf(request), cost);
      const validated = validateDetectedHazards(result.data, { roomId, photoId, width: normalized.width, height: normalized.height });
      for (const hazard of validated.hazards) trace.decide('validate', 'accepted', hazard.labelEs);
      if (validated.imageQuality !== 'ok') {
        return {
          photoId, normalizedImage: normalized.dataUrl, width: normalized.width, height: normalized.height,
          imageQuality: validated.imageQuality, hazards: [], evidence: trace.toEvidence(),
        };
      }
      const sam = new SamClient(config.modelApiKey, config.metaBaseUrl, config.samModel);
      const hazards = await trace.measure('sam.boxes', config.samModel, () =>
        resolveMasks(validated.hazards, sam, normalized.dataUrl, normalized.width, normalized.height));
      costGuard.recordSpend(sessionIdOf(request), config.samPricePerImage);
      return {
        photoId, normalizedImage: normalized.dataUrl, width: normalized.width, height: normalized.height,
        imageQuality: 'ok', hazards, evidence: trace.toEvidence(),
      };
    } catch (error) {
      const mapped = metaErrorReply(error);
      return reply.code(mapped.status).send(mapped.body);
    }
  });

  app.post('/api/missions/plan', async (request, reply) => {
    if (!requireDemoCode(request)) return reply.code(401).send(errorBody('DEMO_CODE_REQUIRED', 'Falta el código de la demo.', false));
    const body = (request.body ?? {}) as { hazards?: Hazard[]; profile?: HouseholdProfile };
    if (!body.hazards || !body.profile) return reply.code(422).send(errorBody('VALIDATION_FAILED', 'Se requieren hazards y profile.', false));
    return { missions: planMissions(body.hazards, body.profile) };
  });

  app.post('/api/hazards/verify', metaRateLimit, async (request, reply) => {
    const trace = new TraceRecorder();
    if (!requireDemoCode(request)) return reply.code(401).send(errorBody('DEMO_CODE_REQUIRED', 'Falta el código de la demo.', false));
    if (!config.modelApiKey) return reply.code(502).send(errorBody('META_ACCESS_DENIED', 'MODEL_API_KEY no está configurada.', false));
    try {
      const fields = (request as unknown as { body: Record<string, unknown> }).body ?? {};
      const hazard = JSON.parse(String((fields as { hazard?: string }).hazard ?? '{}')) as Hazard;
      const files: Buffer[] = [];
      const parts = (request as unknown as { parts: () => AsyncIterable<{ toBuffer: () => Promise<Buffer> }> }).parts();
      for await (const part of parts) files.push(await part.toBuffer());
      const [beforeRaw, afterRaw] = files;
      if (!beforeRaw || !afterRaw || !hazard.type) return reply.code(422).send(errorBody('VALIDATION_FAILED', 'Se requieren beforeImage, afterImage y hazard.', false));
      const before = await normalizeImage(beforeRaw);
      const after = await normalizeImage(afterRaw);
      const anchored = await drawRedBox(before.buffer, hazard.box);
      const beforeDataUrl = `data:image/jpeg;base64,${anchored.toString('base64')}`;
      costGuard.assertCanSpend(sessionIdOf(request), 0.02);
      const spark = new SparkClient(createMetaClient(config), config.sparkModel);
      const result = await trace.measure('spark.verify', config.sparkModel, () =>
        spark.completeStructured({
          schemaName: 'FixVerification', jsonSchema: FixVerificationJsonSchema,
          userText: fixVerificationPrompt(hazard.labelEs),
          imageDataUrls: [beforeDataUrl, after.dataUrl],
          parse: (value) => FixVerificationSchema.parse(value),
        }));
      trace.modelProposal = result.data;
      costGuard.recordSpend(sessionIdOf(request), sparkCostUsd(result.usage, config.sparkInputPricePer1M, config.sparkOutputPricePer1M));
      const decision = decideFixStatus(result.data, hazardCatalog[hazard.type].verification);
      trace.decide('decideFixStatus', decision.kind === 'verified' ? 'accepted' : 'adjusted', decision.reasonEs);
      return { status: decision.kind === 'retake' ? hazard.status : decision.status, verdict: result.data, decision, evidence: trace.toEvidence() };
    } catch (error) {
      const mapped = metaErrorReply(error);
      return reply.code(mapped.status).send(mapped.body);
    }
  });

  app.post('/api/zones/validate', async (request, reply) => {
    if (!requireDemoCode(request)) return reply.code(401).send(errorBody('DEMO_CODE_REQUIRED', 'Falta el código de la demo.', false));
    const body = (request.body ?? {}) as { zone?: SafeZone; room?: Room; hazardsInPhoto?: Hazard[]; photoSize?: { width: number; height: number } };
    if (!body.zone || !body.room || !body.hazardsInPhoto || !body.photoSize) {
      return reply.code(422).send(errorBody('VALIDATION_FAILED', 'Se requieren zone, room, hazardsInPhoto y photoSize.', false));
    }
    return validateSafeZone({ zone: body.zone, room: body.room, hazardsInPhoto: body.hazardsInPhoto, photoSize: body.photoSize });
  });

  app.post('/api/drills/scenario', async (request, reply) => {
    if (!requireDemoCode(request)) return reply.code(401).send(errorBody('DEMO_CODE_REQUIRED', 'Falta el código de la demo.', false));
    const body = (request.body ?? {}) as { profile?: HouseholdProfile; zones?: SafeZone[]; openHazards?: Hazard[]; level?: 1 | 2 | 3 | 4 };
    if (!body.profile || !body.zones || !body.openHazards || !body.level) {
      return reply.code(422).send(errorBody('VALIDATION_FAILED', 'Se requieren profile, zones, openHazards y level.', false));
    }
    const trace = new TraceRecorder();
    const scenario = buildTemplateScenario({ profile: body.profile, zones: body.zones, openHazards: body.openHazards, level: body.level });
    trace.decide('buildTemplateScenario', 'accepted', `Nivel ${body.level} con plantilla`);
    return { scenario, evidence: trace.toEvidence() };
  });

  app.post('/api/drills/arrival', metaRateLimit, async (request, reply) => {
    const trace = new TraceRecorder();
    if (!requireDemoCode(request)) return reply.code(401).send(errorBody('DEMO_CODE_REQUIRED', 'Falta el código de la demo.', false));
    if (!config.modelApiKey) return reply.code(502).send(errorBody('META_ACCESS_DENIED', 'MODEL_API_KEY no está configurada.', false));
    try {
      const files: Buffer[] = [];
      const parts = (request as unknown as { parts: () => AsyncIterable<{ toBuffer: () => Promise<Buffer> }> }).parts();
      for await (const part of parts) files.push(await part.toBuffer());
      const [referenceRaw, arrivalRaw] = files;
      if (!referenceRaw || !arrivalRaw) return reply.code(422).send(errorBody('VALIDATION_FAILED', 'Se requieren referenceImage y arrivalImage.', false));
      const reference = await normalizeImage(referenceRaw);
      const arrival = await normalizeImage(arrivalRaw);
      costGuard.assertCanSpend(sessionIdOf(request), 0.02);
      const spark = new SparkClient(createMetaClient(config), config.sparkModel);
      const result = await trace.measure('spark.arrival', config.sparkModel, () =>
        spark.completeStructured({
          schemaName: 'ArrivalCheck', jsonSchema: ArrivalCheckJsonSchema,
          userText: arrivalCheckPrompt,
          imageDataUrls: [reference.dataUrl, arrival.dataUrl],
          parse: (value) => ArrivalCheckSchema.parse(value),
        }));
      trace.modelProposal = result.data;
      costGuard.recordSpend(sessionIdOf(request), sparkCostUsd(result.usage, config.sparkInputPricePer1M, config.sparkOutputPricePer1M));
      const arrivalStatus = result.data.sameLocationLikely && result.data.confidence !== 'low' ? 'verified' : 'not_matched';
      return { arrival: arrivalStatus, verdict: result.data, evidence: trace.toEvidence() };
    } catch (error) {
      const mapped = metaErrorReply(error);
      return reply.code(mapped.status).send(mapped.body);
    }
  });

  app.post('/api/drills/evaluate', async (request, reply) => {
    if (!requireDemoCode(request)) return reply.code(401).send(errorBody('DEMO_CODE_REQUIRED', 'Falta el código de la demo.', false));
    const body = (request.body ?? {}) as {
      scenario?: Parameters<typeof evaluateDrill>[0]['scenario']; elapsedMs?: number;
      arrival?: 'verified' | 'not_matched' | 'skipped'; routeAvoidedHazard?: boolean | null; history?: Array<{ elapsedMs: number }>;
    };
    if (!body.scenario || typeof body.elapsedMs !== 'number' || !body.arrival) {
      return reply.code(422).send(errorBody('VALIDATION_FAILED', 'Se requieren scenario, elapsedMs y arrival.', false));
    }
    const best = body.history && body.history.length > 0 ? Math.min(...body.history.map((h) => h.elapsedMs)) : null;
    return { result: evaluateDrill({ scenario: body.scenario, elapsedMs: body.elapsedMs, arrival: body.arrival, routeAvoidedHazard: body.routeAvoidedHazard ?? null, bestElapsedMs: best }) };
  });

  return app;
}

if (process.argv[1]?.endsWith('main.ts')) {
  const app = await buildServer();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(JSON.stringify({ type: 'startup', port: config.port, version: '0.1.0' }));
}
