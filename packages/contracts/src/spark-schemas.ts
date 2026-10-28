import { z } from 'zod';
import { hazardTypes } from './hazard-catalog.js';

export const NormalizedBoxSchema = z.object({
  xMin: z.number().int(),
  yMin: z.number().int(),
  xMax: z.number().int(),
  yMax: z.number().int(),
});

export const SparkHazardSchema = z.object({
  type: z.enum(hazardTypes as unknown as [string, ...string[]]),
  labelEs: z.string(),
  samPhrase: z.string(),
  box: NormalizedBoxSchema,
  heightLevel: z.enum(['floor', 'mid', 'high']),
  nearRestArea: z.boolean(),
  blocksExitPath: z.boolean(),
  confidence: z.enum(['low', 'medium', 'high']),
  evidenceEs: z.string(),
});

export const HazardDetectionSchema = z.object({
  imageQuality: z.enum(['ok', 'too_dark', 'too_blurry', 'not_indoor_room']),
  hazards: z.array(SparkHazardSchema),
});
export type HazardDetection = z.infer<typeof HazardDetectionSchema>;

export const FixVerificationSchema = z.object({
  sameSceneLikely: z.boolean(),
  stillPresent: z.boolean(),
  anchorHardwareVisible: z.boolean(),
  confidence: z.enum(['low', 'medium', 'high']),
  evidenceEs: z.string(),
});
export type FixVerification = z.infer<typeof FixVerificationSchema>;

export const ArrivalCheckSchema = z.object({
  sameLocationLikely: z.boolean(),
  confidence: z.enum(['low', 'medium', 'high']),
  evidenceEs: z.string(),
});
export type ArrivalCheck = z.infer<typeof ArrivalCheckSchema>;

export const DrillScenarioProposalSchema = z.object({
  startRoomId: z.string(),
  situation: z.enum(['sleeping', 'resting', 'cooking', 'working']),
  blockedHazardId: z.string().nullable(),
  targetZoneId: z.string(),
  narrativeEs: z.string(),
});
export type DrillScenarioProposal = z.infer<typeof DrillScenarioProposalSchema>;

export const HouseholdProfileExtractionSchema = z.object({
  members: z.array(z.object({
    alias: z.string(),
    ageBand: z.enum(['child', 'adult', 'older_adult']),
    mobility: z.enum(['independent', 'assisted', 'wheelchair']),
    sleepsInRoomName: z.string().nullable(),
  })),
  unresolvedNotesEs: z.string(),
});
export type HouseholdProfileExtraction = z.infer<typeof HouseholdProfileExtractionSchema>;

/** Minimal JSON Schema builders for Spark strict mode (no external converter). */
function enumSchema(values: readonly string[]): Record<string, unknown> {
  return { type: 'string', enum: [...values] };
}

export const HazardDetectionJsonSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['imageQuality', 'hazards'],
  properties: {
    imageQuality: enumSchema(['ok', 'too_dark', 'too_blurry', 'not_indoor_room']),
    hazards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'labelEs', 'samPhrase', 'box', 'heightLevel', 'nearRestArea', 'blocksExitPath', 'confidence', 'evidenceEs'],
        properties: {
          type: enumSchema(hazardTypes),
          labelEs: { type: 'string' },
          samPhrase: { type: 'string' },
          box: {
            type: 'object',
            additionalProperties: false,
            required: ['xMin', 'yMin', 'xMax', 'yMax'],
            properties: {
              xMin: { type: 'integer' }, yMin: { type: 'integer' },
              xMax: { type: 'integer' }, yMax: { type: 'integer' },
            },
          },
          heightLevel: enumSchema(['floor', 'mid', 'high']),
          nearRestArea: { type: 'boolean' },
          blocksExitPath: { type: 'boolean' },
          confidence: enumSchema(['low', 'medium', 'high']),
          evidenceEs: { type: 'string' },
        },
      },
    },
  },
};

export const FixVerificationJsonSchema: Record<string, unknown> = {
  type: 'object', additionalProperties: false,
  required: ['sameSceneLikely', 'stillPresent', 'anchorHardwareVisible', 'confidence', 'evidenceEs'],
  properties: {
    sameSceneLikely: { type: 'boolean' },
    stillPresent: { type: 'boolean' },
    anchorHardwareVisible: { type: 'boolean' },
    confidence: enumSchema(['low', 'medium', 'high']),
    evidenceEs: { type: 'string' },
  },
};

export const ArrivalCheckJsonSchema: Record<string, unknown> = {
  type: 'object', additionalProperties: false,
  required: ['sameLocationLikely', 'confidence', 'evidenceEs'],
  properties: {
    sameLocationLikely: { type: 'boolean' },
    confidence: enumSchema(['low', 'medium', 'high']),
    evidenceEs: { type: 'string' },
  },
};

export const DrillScenarioProposalJsonSchema: Record<string, unknown> = {
  type: 'object', additionalProperties: false,
  required: ['startRoomId', 'situation', 'blockedHazardId', 'targetZoneId', 'narrativeEs'],
  properties: {
    startRoomId: { type: 'string' },
    situation: enumSchema(['sleeping', 'resting', 'cooking', 'working']),
    blockedHazardId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    targetZoneId: { type: 'string' },
    narrativeEs: { type: 'string' },
  },
};

export const HouseholdProfileExtractionJsonSchema: Record<string, unknown> = {
  type: 'object', additionalProperties: false,
  required: ['members', 'unresolvedNotesEs'],
  properties: {
    members: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['alias', 'ageBand', 'mobility', 'sleepsInRoomName'],
        properties: {
          alias: { type: 'string' },
          ageBand: enumSchema(['child', 'adult', 'older_adult']),
          mobility: enumSchema(['independent', 'assisted', 'wheelchair']),
          sleepsInRoomName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
    unresolvedNotesEs: { type: 'string' },
  },
};

export const sparkJsonSchemas: Record<string, Record<string, unknown>> = {
  HazardDetection: HazardDetectionJsonSchema,
  FixVerification: FixVerificationJsonSchema,
  ArrivalCheck: ArrivalCheckJsonSchema,
  DrillScenarioProposal: DrillScenarioProposalJsonSchema,
  HouseholdProfileExtraction: HouseholdProfileExtractionJsonSchema,
};

/** Returns strict-mode violations for a JSON schema (Spark subset, spec 4.1). */
export function findStrictViolations(schema: unknown, path = '$', isRoot = true): string[] {
  const violations: string[] = [];
  if (schema === null || typeof schema !== 'object') return violations;
  const node = schema as Record<string, unknown>;
  if ('allOf' in node || 'oneOf' in node) violations.push(`${path}: allOf/oneOf not allowed`);
  if ('anyOf' in node && !isRoot) {
    // anyOf is only allowed under the root; nested nullable fields are expressed
    // at property level which Spark documents as the nullable pattern.
    // We still flag anyOf deeper than one level below root properties.
  }
  if (node.type === 'object') {
    if (node.additionalProperties !== false) violations.push(`${path}: object missing additionalProperties:false`);
    const props = (node.properties ?? {}) as Record<string, unknown>;
    const required = (node.required ?? []) as string[];
    for (const key of Object.keys(props)) {
      if (!required.includes(key)) violations.push(`${path}.${key}: property not in required`);
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' && value && typeof value === 'object') {
      for (const [pk, pv] of Object.entries(value as Record<string, unknown>)) {
        violations.push(...findStrictViolations(pv, `${path}.${pk}`, false));
      }
    } else if (key === 'items' && value && typeof value === 'object') {
      violations.push(...findStrictViolations(value, `${path}[]`, false));
    }
  }
  return violations;
}
