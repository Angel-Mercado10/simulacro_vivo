import type { FixVerification, HazardStatus } from '@simulacro/contracts';
import type { VerificationMethod } from '@simulacro/contracts';

export type FixDecision =
  | { kind: 'retake'; reasonEs: string }
  | { kind: 'verified'; status: Extract<HazardStatus, 'fixed_visual_evidence'>; reasonEs: string }
  | { kind: 'self_report_offer'; status: Extract<HazardStatus, 'fixed_self_reported'>; reasonEs: string };

/** Spec 8.4: decide hazard status after a fix-verification verdict. Low confidence never auto-verifies. */
export function decideFixStatus(verdict: FixVerification, method: VerificationMethod): FixDecision {
  if (!verdict.sameSceneLikely) {
    return { kind: 'retake', reasonEs: 'La foto no parece el mismo lugar; vuelve a encuadrar con la guía fantasma.' };
  }
  if (verdict.confidence === 'low' || method === 'self_report') {
    return {
      kind: 'self_report_offer',
      status: 'fixed_self_reported',
      reasonEs: 'No pude confirmarlo en la foto. ¿Ya lo corregiste?',
    };
  }
  if (method === 'anchor_hardware') {
    if (verdict.anchorHardwareVisible) {
      return { kind: 'verified', status: 'fixed_visual_evidence', reasonEs: 'Herraje visible (no certifica la instalación).' };
    }
    return { kind: 'self_report_offer', status: 'fixed_self_reported', reasonEs: 'No se ve el herraje de fijación en la foto.' };
  }
  // relocation | removal | path_clear
  if (!verdict.stillPresent) {
    return { kind: 'verified', status: 'fixed_visual_evidence', reasonEs: 'Ya no se observa el riesgo en la foto.' };
  }
  return { kind: 'self_report_offer', status: 'fixed_self_reported', reasonEs: 'El riesgo todavía se observa en la foto.' };
}
