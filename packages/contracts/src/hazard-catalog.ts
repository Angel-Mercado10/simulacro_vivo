import type { HazardType } from './domain.js';

export const catalogVersion = '1.0.0';

export type VerificationMethod = 'anchor_hardware' | 'relocation' | 'removal' | 'path_clear' | 'self_report';

export interface HazardCatalogEntry {
  type: HazardType;
  labelEs: string;
  examplePhrasesEn: string[];
  baseSeverity: 1 | 2 | 3;
  actionEs: string;
  sourceRef: { title: string; url: string } | null;
  verification: VerificationMethod;
  canBlockPath: boolean;
}

const CENAPRED_PLAN = {
  title: 'Plan Familiar de Protección Civil, CENAPRED',
  url: 'https://www.cenapred.unam.mx/es/Publicaciones/archivos/392-PLAN-FAMILIAR-DE-PROTECCION-CIVIL.PDF',
} as const;

export const hazardCatalog: Record<HazardType, HazardCatalogEntry> = {
  TALL_FURNITURE_UNANCHORED: {
    type: 'TALL_FURNITURE_UNANCHORED',
    labelEs: 'Mueble alto sin fijar (librero, ropero, vitrina)',
    examplePhrasesEn: ['bookshelf', 'wardrobe'],
    baseSeverity: 3,
    actionEs: 'Fijarlo al muro con herrajes.',
    sourceRef: CENAPRED_PLAN,
    verification: 'anchor_hardware',
    canBlockPath: true,
  },
  HEAVY_OBJECT_HIGH: {
    type: 'HEAVY_OBJECT_HIGH',
    labelEs: 'Objeto pesado en lo alto (tele, macetas, cajas, ollas)',
    examplePhrasesEn: ['television', 'flower pot', 'box'],
    baseSeverity: 3,
    actionEs: 'Bajarlo a una repisa inferior o sujetarlo.',
    sourceRef: CENAPRED_PLAN,
    verification: 'relocation',
    canBlockPath: false,
  },
  GLASS_OVER_REST_AREA: {
    type: 'GLASS_OVER_REST_AREA',
    labelEs: 'Vidrio, espejo o cuadro sobre cama o sillón',
    examplePhrasesEn: ['wall mirror', 'picture frame'],
    baseSeverity: 3,
    actionEs: 'Reubicarlo lejos de zonas de descanso.',
    sourceRef: CENAPRED_PLAN,
    verification: 'removal',
    canBlockPath: false,
  },
  EXIT_PATH_BLOCKED: {
    type: 'EXIT_PATH_BLOCKED',
    labelEs: 'Objetos que obstruyen una puerta o pasillo',
    examplePhrasesEn: ['boxes', 'chair'],
    baseSeverity: 3,
    actionEs: 'Despejar la ruta.',
    sourceRef: CENAPRED_PLAN,
    verification: 'path_clear',
    canBlockPath: true,
  },
  GAS_CYLINDER_UNSECURED: {
    type: 'GAS_CYLINDER_UNSECURED',
    labelEs: 'Cilindro de gas sin sujetar',
    examplePhrasesEn: ['gas cylinder'],
    baseSeverity: 3,
    actionEs: 'Sujetarlo con cadena y saber cerrar la válvula.',
    sourceRef: CENAPRED_PLAN,
    verification: 'anchor_hardware',
    canBlockPath: false,
  },
  HANGING_FIXTURE_OVER_REST_AREA: {
    type: 'HANGING_FIXTURE_OVER_REST_AREA',
    labelEs: 'Lámpara colgante o ventilador sobre cama o sillón',
    examplePhrasesEn: ['ceiling lamp', 'ceiling fan'],
    baseSeverity: 2,
    actionEs: 'No elegir esa zona; revisar la sujeción con un especialista.',
    sourceRef: CENAPRED_PLAN,
    verification: 'self_report',
    canBlockPath: false,
  },
  REST_AREA_UNDER_WINDOW: {
    type: 'REST_AREA_UNDER_WINDOW',
    labelEs: 'Cama o sillón junto a una ventana grande',
    examplePhrasesEn: ['bed', 'sofa'],
    baseSeverity: 2,
    actionEs: 'Reubicar el mueble o no usarlo como zona.',
    sourceRef: CENAPRED_PLAN,
    verification: 'self_report',
    canBlockPath: false,
  },
  BREAKABLES_OPEN_SHELF: {
    type: 'BREAKABLES_OPEN_SHELF',
    labelEs: 'Frascos o vidrio en repisas abiertas sin tope',
    examplePhrasesEn: ['glass jars', 'shelf'],
    baseSeverity: 1,
    actionEs: 'Poner topes o guardarlos en gabinetes cerrados.',
    sourceRef: CENAPRED_PLAN,
    verification: 'relocation',
    canBlockPath: false,
  },
};

export const hazardTypes = Object.keys(hazardCatalog) as HazardType[];
