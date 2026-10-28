import type {
  DrillLevel, DrillScenario, DrillSituation, Hazard, HouseholdProfile, Room, SafeZone,
} from '@simulacro/contracts';
import { hazardCatalog } from '@simulacro/contracts';
import type { PixelBox } from '@simulacro/contracts';

const BLOCKING_ZONE_TYPES = new Set([
  'TALL_FURNITURE_UNANCHORED', 'HEAVY_OBJECT_HIGH', 'GLASS_OVER_REST_AREA',
  'HANGING_FIXTURE_OVER_REST_AREA', 'BREAKABLES_OPEN_SHELF',
]);

const FORBIDDEN_TERMS = ['SASMEX', 'alerta sísmica', 'herido', 'muerto', 'sangre'];

function expandBox(box: PixelBox, imageWidth: number): PixelBox {
  const pad = Math.round(imageWidth * 0.15);
  return { x1: box.x1 - pad, y1: box.y1 - pad, x2: box.x2 + pad, y2: box.y2 + pad };
}

function pointInBox(point: { x: number; y: number }, box: PixelBox): boolean {
  return point.x >= box.x1 && point.x <= box.x2 && point.y >= box.y1 && point.y <= box.y2;
}

/** Spec 8.5: validate a safe-zone point. Kitchen is always rejected. */
export function validateSafeZone(args: {
  zone: SafeZone; room: Room; hazardsInPhoto: Hazard[]; photoSize: { width: number; height: number };
}): { accepted: boolean; reasonEs: string } {
  if (args.room.kind === 'kitchen') {
    return { accepted: false, reasonEs: 'No se puede marcar una zona de menor riesgo en la cocina.' };
  }
  for (const hazard of args.hazardsInPhoto) {
    if (hazard.status !== 'open') continue;
    if (!BLOCKING_ZONE_TYPES.has(hazard.type)) continue;
    if (pointInBox(args.zone.point, expandBox(hazard.box, args.photoSize.width))) {
      return { accepted: false, reasonEs: `Esa zona está junto a: ${hazard.labelEs}. Elige un punto más alejado.` };
    }
  }
  return { accepted: true, reasonEs: 'Zona de menor riesgo según lo visible en la foto; no evalúa la estructura.' };
}

function situationFor(room: Room | undefined): DrillSituation {
  if (!room) return 'resting';
  if (room.kind === 'bedroom') return 'sleeping';
  if (room.kind === 'kitchen') return 'cooking';
  return 'resting';
}

/** Spec 8.6: template scenarios for levels 1-3 (deterministic, no network). */
export function buildTemplateScenario(args: {
  profile: HouseholdProfile; zones: SafeZone[]; openHazards: Hazard[]; level: DrillLevel;
  photoSizes?: Map<string, { width: number; height: number }>;
}): DrillScenario {
  const { profile, zones, openHazards } = args;
  const primaryZone = zones[0];
  if (!primaryZone) throw new Error('At least one safe zone is required');
  if (args.level === 1) {
    return {
      level: 1, startRoomId: primaryZone.roomId, situation: situationFor(profile.rooms.find((r) => r.id === primaryZone.roomId)),
      blockedHazardId: null, targetZoneId: primaryZone.id,
      narrativeEs: 'Empieza a temblar. Camina a tu zona de menor riesgo.', source: 'template',
    };
  }
  if (args.level === 2 || zones.length < 2) {
    const vulnerable = profile.members.find(
      (m) => m.sleepsInRoomId && m.sleepsInRoomId !== primaryZone.roomId
        && (m.ageBand === 'child' || m.ageBand === 'older_adult' || m.mobility !== 'independent'),
    );
    const otherRoom = profile.rooms.find((r) => r.id !== primaryZone.roomId
      && (vulnerable ? r.id === vulnerable.sleepsInRoomId : true))
      ?? profile.rooms.find((r) => r.id !== primaryZone.roomId);
    const startRoomId = otherRoom?.id ?? primaryZone.roomId;
    const zoneHere = zones.find((z) => z.roomId === startRoomId);
    return {
      level: 2, startRoomId, situation: situationFor(otherRoom),
      blockedHazardId: null, targetZoneId: zoneHere?.id ?? primaryZone.id,
      narrativeEs: 'Empieza a temblar. Camina a tu zona de menor riesgo.', source: 'template',
    };
  }
  // Level 3: highest-priority open hazard that can block a path blocks the nearest zone.
  const blockers = openHazards.filter((h) => hazardCatalog[h.type].canBlockPath);
  const blocker = blockers[0] ?? openHazards[0];
  if (!blocker) {
    return buildTemplateScenario({ ...args, level: 2 });
  }
  const blockedZone = zones.find((z) => z.roomId === blocker.roomId) ?? primaryZone;
  const alternate = zones.find((z) => z.id !== blockedZone.id) ?? primaryZone;
  const startRoom = profile.rooms.find((r) => r.id === blocker.roomId);
  return {
    level: 3, startRoomId: blocker.roomId, situation: situationFor(startRoom),
    blockedHazardId: blocker.id, targetZoneId: alternate.id,
    narrativeEs: `Estás en ${startRoom?.name ?? 'un cuarto'}. Empieza a temblar y ${blocker.labelEs} cayó y bloquea el paso. Camina a tu zona alterna.`,
    source: 'template',
  };
}

/** Spec 8.6: accept a Spark scenario proposal only if every rule passes. */
export function validateScenario(
  proposal: { startRoomId: string; situation: DrillSituation; blockedHazardId: string | null; targetZoneId: string; narrativeEs: string },
  args: { profile: HouseholdProfile; zones: SafeZone[]; openHazards: Hazard[]; level: DrillLevel; photoSizes?: Map<string, { width: number; height: number }> },
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const roomIds = new Set(args.profile.rooms.map((r) => r.id));
  const zoneIds = new Set(args.zones.map((z) => z.id));
  const hazardIds = new Set(args.openHazards.map((h) => h.id));
  if (!roomIds.has(proposal.startRoomId)) errors.push('startRoomId not in allowed rooms');
  if (!zoneIds.has(proposal.targetZoneId)) errors.push('targetZoneId not in allowed zones');
  if ((args.level === 1 || args.level === 2) && proposal.blockedHazardId !== null) {
    errors.push('blockedHazardId must be null in levels 1 and 2');
  }
  if (args.level === 3) {
    if (!proposal.blockedHazardId || !hazardIds.has(proposal.blockedHazardId)) {
      errors.push('blockedHazardId must reference an open hazard in level 3');
    } else {
      const hazard = args.openHazards.find((h) => h.id === proposal.blockedHazardId)!;
      if (!hazardCatalog[hazard.type].canBlockPath) errors.push('blocked hazard cannot block a path');
      const zone = args.zones.find((z) => z.id === proposal.targetZoneId);
      const size = zone ? args.photoSizes?.get(zone.photoId) : undefined;
      if (zone && size && pointInBox(zone.point, expandBox(hazard.box, size.width))) {
        errors.push('target zone is inside the expanded blocked-hazard box');
      }
    }
  }
  if (proposal.blockedHazardId !== null && args.level === 3 && !hazardIds.has(proposal.blockedHazardId)) {
    errors.push('blockedHazardId not in allowed hazards');
  }
  if (proposal.narrativeEs.length > 240) errors.push('narrativeEs exceeds 240 characters');
  const lowered = proposal.narrativeEs.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lowered.includes(term.toLowerCase())) errors.push(`narrativeEs contains forbidden term: ${term}`);
  }
  return { valid: errors.length === 0, errors };
}

/** Spec 8.7: drill evaluation. Time is informational and never awards points. */
export function evaluateDrill(args: {
  scenario: DrillScenario;
  elapsedMs: number;
  arrival: 'verified' | 'not_matched' | 'skipped';
  routeAvoidedHazard: boolean | null;
  bestElapsedMs: number | null;
}): { levelCompleted: boolean; correctZone: boolean; timeNoteEs: string } {
  const correctZone = args.arrival === 'verified';
  const levelCompleted = correctZone && (args.scenario.level !== 3 || args.routeAvoidedHazard === true);
  let timeNoteEs = `Tiempo: ${Math.round(args.elapsedMs / 1000)} s (solo informativo; camina, no corras).`;
  if (args.bestElapsedMs !== null) {
    timeNoteEs += args.elapsedMs < args.bestElapsedMs ? ' Mejor que tu marca anterior.' : ' Tu mejor marca se mantiene.';
  }
  return { levelCompleted, correctZone, timeNoteEs };
}
