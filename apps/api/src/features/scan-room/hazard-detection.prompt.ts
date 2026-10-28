import type { RoomKind } from '@simulacro/contracts';

export function hazardDetectionPrompt(roomKind: RoomKind): string {
  return [
    'You are an object grounding expert helping a family in Mexico City prepare their home for earthquakes.',
    `Room type declared by the user: ${roomKind}.`,
    'Find NON-STRUCTURAL earthquake hazards visible in this photo, using ONLY these types:',
    '- TALL_FURNITURE_UNANCHORED: tall furniture (bookshelf, wardrobe, cabinet) with no visible wall anchoring.',
    '- HEAVY_OBJECT_HIGH: heavy object placed high (TV, pot, box, plant) that could fall.',
    '- GLASS_OVER_REST_AREA: mirror, glass or framed picture above or beside a bed or sofa.',
    '- EXIT_PATH_BLOCKED: objects obstructing a door or corridor.',
    '- GAS_CYLINDER_UNSECURED: gas cylinder not chained or strapped.',
    '- HANGING_FIXTURE_OVER_REST_AREA: hanging lamp or ceiling fan above a bed or sofa.',
    '- REST_AREA_UNDER_WINDOW: bed or sofa directly next to a large window.',
    '- BREAKABLES_OPEN_SHELF: jars, glassware or breakables on open shelves without a lip.',
    'Rules:',
    '- Report only what is clearly visible. Never assess the building structure.',
    '- Do not miss any hazard of the listed types. Do not report anything else.',
    '- Check every bed and sofa: if it sits directly beside a large window, report REST_AREA_UNDER_WINDOW.',
    '- Check every open shelf without a lip: jars, bottles or glassware on it are BREAKABLES_OPEN_SHELF.',
    '- Check above and beside every bed and sofa for mirrors, glass or framed pictures: GLASS_OVER_REST_AREA.',
    '- If anchoring is not visible, say so in evidenceEs and use confidence "medium" or "low".',
    '- box: bounding box of the hazardous object on a 0-1000 grid, (0,0) top-left, xMin < xMax, yMin < yMax.',
    '- samPhrase: 1 to 3 word English noun phrase naming the object itself ("bookshelf", "wall mirror"). No commas, no positions.',
    '- labelEs: short Spanish label, max 60 characters. evidenceEs: one Spanish sentence, max 200 characters.',
    '- If the photo is too dark, blurry or not an indoor room, set imageQuality accordingly and return no hazards.',
  ].join('\n');
}

export function fixVerificationPrompt(labelEs: string): string {
  return [
    `Image 1 is BEFORE; the hazard is inside the red rectangle: ${labelEs}.`,
    'Image 2 is AFTER from a similar viewpoint.',
    'Report whether the hazard is still present as before.',
    'anchorHardwareVisible is true only if L-brackets, straps or chains clearly attach the object to the wall.',
  ].join('\n');
}

export const arrivalCheckPrompt =
  'Image 1 is the reference photo of a safe zone. Image 2 was taken on arrival during a drill. Report whether both photos show the same location.';
