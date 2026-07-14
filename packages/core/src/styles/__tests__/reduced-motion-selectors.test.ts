import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSS_TOKEN_ROOT_SELECTORS } from '../token-definitions';

describe('reduced-motion.css', () => {
  it('uses the same root selectors as CSS_TOKEN_ROOT_SELECTORS', () => {
    const css = readFileSync(resolve(__dirname, '../reduced-motion.css'), 'utf8');
    const selectors = CSS_TOKEN_ROOT_SELECTORS.every((sel) => css.includes(sel));
    expect(selectors).toBe(true);

    const isBlocks = [...css.matchAll(/:is\(\s*([\s\S]*?)\s*\)/g)];
    const selectorsInCss = new Set(
      isBlocks.flatMap((m) =>
        m[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    for (const sel of CSS_TOKEN_ROOT_SELECTORS) {
      expect(selectorsInCss.has(sel)).toBe(true);
    }
    for (const sel of selectorsInCss) {
      expect(CSS_TOKEN_ROOT_SELECTORS).toContain(sel);
    }
  });
});
