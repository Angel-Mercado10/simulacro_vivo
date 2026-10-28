import { describe, expect, it } from 'vitest';
import { findStrictViolations, sparkJsonSchemas } from '../src/index.js';

describe('Spark strict-mode contracts', () => {
  it('every schema passes the strict subset check', () => {
    for (const [name, schema] of Object.entries(sparkJsonSchemas)) {
      expect(findStrictViolations(schema), name).toEqual([]);
    }
  });

  it('flags objects without additionalProperties:false', () => {
    expect(findStrictViolations({ type: 'object', properties: {} }).length).toBeGreaterThan(0);
  });
});
