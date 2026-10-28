import { describe, expect, it } from 'vitest';
import type { Hazard, HazardDetection, HouseholdProfile } from '@simulacro/contracts';
import { findStrictViolations, sparkJsonSchemas } from '@simulacro/contracts';
import { validateDetectedHazards, normalizeSamPhrase } from '../../src/features/scan-room/validator.js';
import { resolveMasks } from '../../src/features/scan-room/mask-resolver.js';
import { planMissions } from '../../src/features/plan-missions/mission-planner.js';
import { decideFixStatus } from '../../src/features/verify-fix/decide-fix-status.js';
import { buildTemplateScenario, evaluateDrill, validateSafeZone, validateScenario } from '../../src/features/drills/drill-engine.js';
import { toPixelBox, boxIoU } from '../../src/shared/imaging/geometry.js';
import { CostGuard, BudgetExceededError, sparkCostUsd } from '../../src/shared/budget/cost-guard.js';
import { withRetry } from '../../src/shared/meta/retry-policy.js';
import { MetaApiError } from '../../src/shared/meta/meta-errors.js';
import { loadConfig } from '../../src/config.js';

const profile: HouseholdProfile = {
  rooms: [
    { id: 'r1', name: 'Recámara', kind: 'bedroom' },
    { id: 'r2', name: 'Cocina', kind: 'kitchen' },
  ],
  members: [{ id: 'm1', alias: 'Abuela', ageBand: 'older_adult', mobility: 'assisted', sleepsInRoomId: 'r1' }],
};

function makeHazard(partial: Partial<Hazard>): Hazard {
  return {
    id: 'h1', roomId: 'r1', photoId: 'p1', type: 'TALL_FURNITURE_UNANCHORED',
    labelEs: 'Librero alto junto a la cama', samPhrase: 'bookshelf',
    box: { x1: 100, y1: 100, x2: 300, y2: 400 }, maskPath: null, maskSource: 'none',
    flags: { heightLevel: 'high', nearRestArea: true, blocksExitPath: false },
    modelConfidence: 'high', samConfidence: null, evidenceEs: 'Se ve un librero alto.', status: 'open',
    ...partial,
  };
}

describe('validateDetectedHazards', () => {
  it('returns no hazards when imageQuality is not ok', () => {
    const detection: HazardDetection = { imageQuality: 'too_dark', hazards: [] };
    expect(validateDetectedHazards(detection, { roomId: 'r1', photoId: 'p1', width: 1280, height: 960 }).hazards).toEqual([]);
  });

  it('discards inverted and tiny boxes and clamps to 0-1000', () => {
    const detection: HazardDetection = {
      imageQuality: 'ok',
      hazards: [
        { type: 'HEAVY_OBJECT_HIGH', labelEs: 'Tele', samPhrase: 'television', box: { xMin: 900, yMin: 900, xMax: 100, yMax: 100 }, heightLevel: 'high', nearRestArea: false, blocksExitPath: false, confidence: 'high', evidenceEs: 'ok' },
        { type: 'HEAVY_OBJECT_HIGH', labelEs: 'Tele', samPhrase: 'television', box: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 }, heightLevel: 'high', nearRestArea: false, blocksExitPath: false, confidence: 'high', evidenceEs: 'tiny' },
        { type: 'TALL_FURNITURE_UNANCHORED', labelEs: 'Librero alto junto a la cama', samPhrase: 'Bookshelf, tall', box: { xMin: -50, yMin: 100, xMax: 400, yMax: 800 }, heightLevel: 'high', nearRestArea: true, blocksExitPath: false, confidence: 'medium', evidenceEs: 'Sin fijación visible.' },
      ],
    };
    const { hazards } = validateDetectedHazards(detection, { roomId: 'r1', photoId: 'p1', width: 1280, height: 960 });
    expect(hazards).toHaveLength(1);
    expect(hazards[0]?.samPhrase).toBe('bookshelf tall');
    expect(hazards[0]?.box.x1).toBe(0);
  });

  it('normalizes samPhrase and falls back to the catalog phrase', () => {
    expect(normalizeSamPhrase('', 'TALL_FURNITURE_UNANCHORED')).toBe('bookshelf');
    expect(normalizeSamPhrase('Wall mirror, large and red', 'GLASS_OVER_REST_AREA')).toBe('wall mirror large');
  });

  it('dedupes same-type overlapping boxes keeping highest confidence', () => {
    const detection: HazardDetection = {
      imageQuality: 'ok',
      hazards: [
        { type: 'TALL_FURNITURE_UNANCHORED', labelEs: 'A', samPhrase: 'bookshelf', box: { xMin: 100, yMin: 100, xMax: 400, yMax: 800 }, heightLevel: 'high', nearRestArea: false, blocksExitPath: false, confidence: 'low', evidenceEs: 'low' },
        { type: 'TALL_FURNITURE_UNANCHORED', labelEs: 'B', samPhrase: 'bookshelf', box: { xMin: 110, yMin: 110, xMax: 410, yMax: 810 }, heightLevel: 'high', nearRestArea: false, blocksExitPath: false, confidence: 'high', evidenceEs: 'high' },
      ],
    };
    const { hazards } = validateDetectedHazards(detection, { roomId: 'r1', photoId: 'p1', width: 1000, height: 1000 });
    expect(hazards).toHaveLength(1);
    expect(hazards[0]?.modelConfidence).toBe('high');
  });
});

describe('geometry', () => {
  it('converts normalized boxes to pixels and computes IoU', () => {
    expect(toPixelBox({ xMin: 500, yMin: 500, xMax: 1000, yMax: 1000 }, 1280, 960)).toEqual({ x1: 640, y1: 480, x2: 1279, y2: 959 });
    expect(boxIoU({ x1: 0, y1: 0, x2: 99, y2: 99 }, { x1: 0, y1: 0, x2: 99, y2: 99 })).toBe(1);
    expect(boxIoU({ x1: 0, y1: 0, x2: 9, y2: 9 }, { x1: 100, y1: 100, x2: 109, y2: 109 })).toBe(0);
  });
});

describe('resolveMasks', () => {
  it('uses sam_box when IoU passes, concept fallback next, else none', async () => {
    const hazards = [makeHazard({ id: 'a' }), makeHazard({ id: 'b', box: { x1: 500, y1: 100, x2: 700, y2: 300 } })];
    const fakeSam = {
      segmentByBoxes: async () => [{ id: 0, box: { x1: 105, y1: 105, x2: 295, y2: 395 }, maskPath: 'M0 0', confidence: 0.9 }],
      segmentByConcept: async () => [{ id: 0, box: { x1: 505, y1: 105, x2: 695, y2: 295 }, maskPath: 'M1 1', confidence: 0.8 }],
    };
    const resolved = await resolveMasks(hazards, fakeSam, 'data:image/jpeg;base64,x', 1280, 960);
    expect(resolved[0]?.maskSource).toBe('sam_box');
    expect(resolved[1]?.maskSource).toBe('sam_concept');
  });
});

describe('planMissions', () => {
  it('applies R1-R7 and only counts open hazards', () => {
    const missions = planMissions([makeHazard({}), makeHazard({ id: 'h2', status: 'dismissed_by_user' })], profile);
    expect(missions).toHaveLength(1);
    expect(missions[0]?.priorityScore).toBe(30 + 15 + 10 + 5 + 4);
    expect(missions[0]?.reasons.map((r) => r.ruleId)).toContain('R4');
  });

  it('penalizes low confidence with R7', () => {
    const missions = planMissions([makeHazard({ modelConfidence: 'low', flags: { heightLevel: 'floor', nearRestArea: false, blocksExitPath: false } })], profile);
    expect(missions[0]?.reasons.find((r) => r.ruleId === 'R7')?.points).toBe(-8);
  });
});

describe('decideFixStatus', () => {
  const verified = { sameSceneLikely: true, stillPresent: false, anchorHardwareVisible: true, confidence: 'high' as const, evidenceEs: 'ok' };
  it('requires retake when scenes differ', () => {
    expect(decideFixStatus({ ...verified, sameSceneLikely: false }, 'relocation').kind).toBe('retake');
  });
  it('verifies anchor only with visible hardware and non-low confidence', () => {
    expect(decideFixStatus(verified, 'anchor_hardware').kind).toBe('verified');
    expect(decideFixStatus({ ...verified, anchorHardwareVisible: false }, 'anchor_hardware').kind).toBe('self_report_offer');
    expect(decideFixStatus({ ...verified, confidence: 'low' }, 'anchor_hardware').kind).toBe('self_report_offer');
  });
  it('self_report always offers self-report', () => {
    expect(decideFixStatus(verified, 'self_report').kind).toBe('self_report_offer');
  });
});

describe('safe zones and scenarios', () => {
  const zone = { id: 'z1', roomId: 'r1', photoId: 'p1', point: { x: 200, y: 250 } };
  it('rejects kitchen zones and zones near open hazards', () => {
    expect(validateSafeZone({ zone, room: { id: 'r2', name: 'Cocina', kind: 'kitchen' }, hazardsInPhoto: [], photoSize: { width: 1280, height: 960 } }).accepted).toBe(false);
    expect(validateSafeZone({ zone, room: { id: 'r1', name: 'Recámara', kind: 'bedroom' }, hazardsInPhoto: [makeHazard({})], photoSize: { width: 1280, height: 960 } }).accepted).toBe(false);
  });

  it('builds a level 3 template around an open blocking hazard', () => {
    const zones = [
      { id: 'z1', roomId: 'r1', photoId: 'p1', point: { x: 100, y: 100 } },
      { id: 'z2', roomId: 'r2', photoId: 'p2', point: { x: 100, y: 100 } },
    ];
    const scenario = buildTemplateScenario({ profile, zones, openHazards: [makeHazard({})], level: 3 });
    expect(scenario.blockedHazardId).toBe('h1');
    expect(scenario.targetZoneId).toBe('z2');
    expect(scenario.source).toBe('template');
  });

  it('rejects proposals with foreign ids or forbidden terms', () => {
    const zones = [{ id: 'z1', roomId: 'r1', photoId: 'p1', point: { x: 100, y: 100 } }];
    const result = validateScenario(
      { startRoomId: 'nope', situation: 'resting', blockedHazardId: null, targetZoneId: 'z1', narrativeEs: 'Suena la alerta sísmica' },
      { profile, zones, openHazards: [], level: 1 },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('never awards points for speed', () => {
    const scenario = buildTemplateScenario({ profile, zones: [{ id: 'z1', roomId: 'r1', photoId: 'p1', point: { x: 1, y: 1 } }], openHazards: [], level: 1 });
    const result = evaluateDrill({ scenario, elapsedMs: 5000, arrival: 'verified', routeAvoidedHazard: null, bestElapsedMs: null });
    expect(result.levelCompleted).toBe(true);
    expect(result.timeNoteEs).toContain('solo informativo');
  });
});

describe('CostGuard, retry and config', () => {
  it('enforces session budget and prices Spark usage', () => {
    const guard = new CostGuard({ sessionBudgetUsd: 0.5, dailyBudgetUsd: 5, sparkInputPricePer1M: 1.25, sparkOutputPricePer1M: 4.25, samPricePerImage: 0.0025, voicePricePerHour: 0.18 });
    expect(sparkCostUsd({ prompt_tokens: 1_000_000, completion_tokens: 1_000_000 }, 1.25, 4.25)).toBeCloseTo(5.5);
    guard.recordSpend('s1', 0.49);
    expect(() => guard.assertCanSpend('s1', 0.02)).toThrow(BudgetExceededError);
  });

  it('never retries a 400 and retries a 429 once', async () => {
    let calls400 = 0;
    await expect(withRetry(async () => { calls400 += 1; throw new MetaApiError('bad', 400, 'bad_request', false); }, { sleep: async () => {} })).rejects.toThrow();
    expect(calls400).toBe(1);
    let calls429 = 0;
    const value = await withRetry(async () => { calls429 += 1; if (calls429 === 1) throw new MetaApiError('rl', 429, 'rate_limited', true); return 'ok'; }, { sleep: async () => {} });
    expect(value).toBe('ok');
    expect(calls429).toBe(2);
  });

  it('rejects -contributor model ids', () => {
    expect(() => loadConfig({ SPARK_MODEL: 'muse-spark-1.3-contributor' } as NodeJS.ProcessEnv)).toThrow(/contributor/);
    expect(loadConfig({} as NodeJS.ProcessEnv).sparkModel).toBe('muse-spark-1.3');
  });
});

describe('strict schema contracts', () => {
  it('every Spark schema passes the strict subset check', () => {
    for (const [name, schema] of Object.entries(sparkJsonSchemas)) {
      expect(findStrictViolations(schema), name).toEqual([]);
    }
  });
});
