export type RoomKind = 'bedroom' | 'living' | 'kitchen' | 'bathroom' | 'hallway' | 'other';
export type AgeBand = 'child' | 'adult' | 'older_adult';
export type MobilityNeed = 'independent' | 'assisted' | 'wheelchair';
export type HeightLevel = 'floor' | 'mid' | 'high';
export type HazardStatus = 'open' | 'fixed_visual_evidence' | 'fixed_self_reported' | 'dismissed_by_user';

export interface Room { id: string; name: string; kind: RoomKind }
export interface Member {
  id: string; alias: string; ageBand: AgeBand; mobility: MobilityNeed;
  sleepsInRoomId: string | null;
}
export interface HouseholdProfile { rooms: Room[]; members: Member[] }

/** Normalized-image pixels; x2/y2 inclusive, as in SAM output. */
export interface PixelBox { x1: number; y1: number; x2: number; y2: number }
export interface HazardFlags { heightLevel: HeightLevel; nearRestArea: boolean; blocksExitPath: boolean }

export type HazardType =
  | 'TALL_FURNITURE_UNANCHORED'
  | 'HEAVY_OBJECT_HIGH'
  | 'GLASS_OVER_REST_AREA'
  | 'EXIT_PATH_BLOCKED'
  | 'GAS_CYLINDER_UNSECURED'
  | 'HANGING_FIXTURE_OVER_REST_AREA'
  | 'REST_AREA_UNDER_WINDOW'
  | 'BREAKABLES_OPEN_SHELF';

export interface Hazard {
  id: string; roomId: string; photoId: string;
  type: HazardType;
  labelEs: string;
  samPhrase: string;
  box: PixelBox;
  maskPath: string | null;
  maskSource: 'sam_box' | 'sam_concept' | 'none';
  flags: HazardFlags;
  modelConfidence: 'low' | 'medium' | 'high';
  samConfidence: number | null;
  evidenceEs: string;
  status: HazardStatus;
}

export interface PriorityReason { ruleId: string; points: number; textEs: string }
export interface Mission { hazardId: string; priorityScore: number; reasons: PriorityReason[] }

export interface SafeZone { id: string; roomId: string; photoId: string; point: { x: number; y: number } }

export type DrillLevel = 1 | 2 | 3 | 4;
export type DrillSituation = 'sleeping' | 'resting' | 'cooking' | 'working';
export interface DrillScenario {
  level: DrillLevel; startRoomId: string; situation: DrillSituation;
  blockedHazardId: string | null; targetZoneId: string;
  narrativeEs: string; source: 'template' | 'spark';
}
export interface DrillRecord {
  id: string; scenario: DrillScenario; elapsedMs: number;
  arrival: 'verified' | 'not_matched' | 'skipped';
  routeAvoidedHazard: boolean | null;
}
