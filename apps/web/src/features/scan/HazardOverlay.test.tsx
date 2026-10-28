// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { Hazard } from '@simulacro/contracts';
import { HazardOverlay } from './HazardOverlay.js';

function makeHazard(partial: Partial<Hazard>): Hazard {
  return {
    id: 'h1', roomId: 'r1', photoId: 'p1', type: 'TALL_FURNITURE_UNANCHORED',
    labelEs: 'Librero', samPhrase: 'bookshelf',
    box: { x1: 100, y1: 200, x2: 300, y2: 600 }, maskPath: null, maskSource: 'none',
    flags: { heightLevel: 'high', nearRestArea: false, blocksExitPath: false },
    modelConfidence: 'high', samConfidence: null, evidenceEs: 'ok', status: 'open',
    ...partial,
  };
}

describe('HazardOverlay', () => {
  it('maps the normalized image 1:1 and translates box-local masks by the box origin', () => {
    const { container } = render(
      <HazardOverlay image="data:image/jpeg;base64,x" width={960} height={1280} hazards={[
        makeHazard({ maskPath: 'M0 0h10v10z' }),
        makeHazard({ id: 'h2', box: { x1: 0, y1: 0, x2: 50, y2: 50 } }),
      ]} />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 960 1280');
    const groups = container.querySelectorAll('svg > g');
    expect(groups[0]?.getAttribute('transform')).toBe('translate(100 200)');
    expect(groups[0]?.querySelector('path')?.getAttribute('d')).toBe('M0 0h10v10z');
    // Without a mask, the box contour is drawn as an approximate outline.
    expect(groups[1]?.querySelector('rect')).not.toBeNull();
    // Numbered badges distinguish hazards without relying on color alone.
    expect(container.querySelectorAll('svg text').length).toBe(2);
  });
});
