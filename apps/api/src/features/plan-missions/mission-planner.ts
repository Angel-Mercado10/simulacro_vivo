import type { Hazard, HouseholdProfile, Mission, PriorityReason } from '@simulacro/contracts';
import { hazardCatalog } from '@simulacro/contracts';

const SEVERITY_TEXT: Record<number, string> = {
  3: 'Tipo de riesgo de severidad alta',
  2: 'Tipo de riesgo de severidad media',
  1: 'Tipo de riesgo de severidad baja',
};

/** Spec 8.3: deterministic mission priority (R1-R7). Only open hazards generate missions. */
export function planMissions(hazards: Hazard[], profile: HouseholdProfile): Mission[] {
  const roomsById = new Map(profile.rooms.map((r) => [r.id, r]));
  const scored = hazards
    .filter((h) => h.status === 'open')
    .map((hazard) => {
      const entry = hazardCatalog[hazard.type];
      const reasons: PriorityReason[] = [];
      let score = 0;
      const add = (ruleId: string, points: number, textEs: string) => {
        score += points;
        reasons.push({ ruleId, points, textEs });
      };
      add('R1', entry.baseSeverity * 10, SEVERITY_TEXT[entry.baseSeverity]!);
      if (hazard.flags.nearRestArea) add('R2', 15, 'Está sobre o junto a donde alguien duerme o descansa');
      if (hazard.flags.blocksExitPath) add('R3', 12, 'Bloquea el paso hacia una salida');
      const vulnerableSleepsHere = profile.members.some(
        (m) => m.sleepsInRoomId === hazard.roomId
          && (m.ageBand === 'child' || m.ageBand === 'older_adult' || m.mobility !== 'independent'),
      );
      if (vulnerableSleepsHere) add('R4', 10, 'Aquí duerme alguien que necesita más tiempo para moverse');
      if (roomsById.get(hazard.roomId)?.kind === 'bedroom') add('R5', 5, 'Está en una recámara');
      if (hazard.flags.heightLevel === 'high') add('R6', 4, 'Está en lo alto');
      if (hazard.modelConfidence === 'low') add('R7', -8, 'La detección es dudosa; confírmala');
      return { hazard, mission: { hazardId: hazard.id, priorityScore: score, reasons } };
    });

  scored.sort((a, b) => {
    if (b.mission.priorityScore !== a.mission.priorityScore) return b.mission.priorityScore - a.mission.priorityScore;
    const severity = hazardCatalog[b.hazard.type].baseSeverity - hazardCatalog[a.hazard.type].baseSeverity;
    if (severity !== 0) return severity;
    return 0; // stable: keep detection order
  });
  return scored.map((s) => s.mission);
}
