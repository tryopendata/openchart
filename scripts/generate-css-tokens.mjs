#!/usr/bin/env node
/**
 * Generate tokens.css and dark.css from the single source of truth in
 * packages/core/src/styles/token-definitions.ts.
 *
 * Run with bun (imports TS source directly, no build needed):
 *   bun scripts/generate-css-tokens.mjs
 *
 * Pass --check to fail (exit 1) if the committed files differ from a
 * fresh generation (used by CI to guarantee CSS tokens never drift).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const stylesDir = join(repoRoot, 'packages', 'core', 'src', 'styles');

const { CSS_TOKENS, CSS_TOKEN_ROOT_SELECTORS } = await import(
  join(stylesDir, 'token-definitions.ts')
);

const GENERATED_HEADER = `/* GENERATED FILE — do not edit. Source: packages/core/src/styles/token-definitions.ts. Regenerate: bun run generate:tokens */`;

function generateTokensCss() {
  const selectorList = CSS_TOKEN_ROOT_SELECTORS.join(',\n');

  const tokenBlock = [];
  for (const token of CSS_TOKENS) {
    if (token.section) {
      tokenBlock.push('');
      // Multiline sections embed their own `\n   *` continuation — the generator
      // wraps them verbatim; changing the source string's whitespace will change output.
      if (token.section.includes('\n')) {
        tokenBlock.push(`  /*\n   * ${token.section}\n   */`);
      } else {
        tokenBlock.push(`  /* ${token.section} */`);
      }
    }
    const decl = token.light.startsWith('\n')
      ? `  ${token.name}:${token.light};`
      : `  ${token.name}: ${token.light};`;
    if (token.comment) {
      const inlined = `${decl} /* ${token.comment} */`;
      if (inlined.length > 100) {
        tokenBlock.push(`  /* ${token.comment} */`);
        tokenBlock.push(decl);
      } else {
        tokenBlock.push(inlined);
      }
    } else {
      tokenBlock.push(decl);
    }
  }

  const indentedTokenBlock = tokenBlock.map((line) => (line === '' ? '' : `  ${line}`)).join('\n');

  return `${GENERATED_HEADER}

@layer oc.tokens {
  /* ---------------------------------------------------------------------------
   * Custom properties (light mode defaults)
   *
   * These are FALLBACK defaults. At runtime, the JS theme engine stamps the
   * resolved theme as inline --oc-* custom properties on each .oc-root
   * container (see packages/vanilla/src/theme-tokens.ts). These CSS values
   * serve as fallbacks for contexts where JS hasn't mounted yet (SSR, static
   * HTML examples).
   * --------------------------------------------------------------------------- */

  ${selectorList.replace(/\n/g, '\n  ')} {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    /* Opt out of iOS text auto-inflation so measured widths match rendered text. */
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;

${indentedTokenBlock}
  }
}
`;
}

function generateDarkCss() {
  const darkTokens = CSS_TOKENS.filter((t) => t.dark !== undefined);

  const lines = [];

  const surfaces = darkTokens.filter((t) =>
    ['--oc-bg', '--oc-card', '--oc-secondary'].includes(t.name),
  );
  const textLevels = darkTokens.filter((t) => t.name.startsWith('--oc-text'));
  const lineTokens = darkTokens.filter((t) =>
    ['--oc-gridline', '--oc-axis', '--oc-border'].includes(t.name),
  );
  const brandTokens = darkTokens.filter((t) =>
    ['--oc-accent', '--oc-accent-strong', '--oc-positive', '--oc-negative', '--oc-focus'].includes(
      t.name,
    ),
  );
  const interactiveTokens = darkTokens.filter((t) =>
    [
      '--oc-hover-bg',
      '--oc-tooltip-bg',
      '--oc-tooltip-border',
      '--oc-tooltip-shadow',
      '--oc-tooltip-text',
      '--oc-legend-text',
    ].includes(t.name),
  );

  function emitGroup(label, tokens) {
    lines.push(`    /* ${label} */`);
    for (const t of tokens) {
      lines.push(`    ${t.name}: ${t.dark};`);
    }
  }

  emitGroup('Surfaces (zinc-based achromatic ramp)', surfaces);
  lines.push('');
  lines.push('    /* Text levels — see tokens.css for the cross-mode naming rationale */');
  for (const t of textLevels) {
    lines.push(`    ${t.name}: ${t.dark};`);
  }
  lines.push('');
  emitGroup('Lines', lineTokens);
  lines.push('');
  lines.push('    /* Brand and semantic — accent stays cyan (no darkening on dark bg) */');
  for (const t of brandTokens) {
    lines.push(`    ${t.name}: ${t.dark};`);
  }
  lines.push('');
  lines.push('    /* Interactive states */');
  for (const t of interactiveTokens) {
    lines.push(`    ${t.name}: ${t.dark};`);
  }

  return `${GENERATED_HEADER}

@layer oc.tokens {
  /* ---------------------------------------------------------------------------
   * Dark mode overrides (fallback defaults)
   *
   * At runtime, the JS theme engine stamps dark-adapted --oc-* custom
   * properties on each .oc-root container. These CSS values serve as
   * fallbacks for contexts where JS hasn't mounted yet.
   * --------------------------------------------------------------------------- */

  .oc-dark {
${lines.join('\n')}
  }
}
`;
}

function main() {
  const check = process.argv.includes('--check');
  let drifted = false;

  const files = [
    ['tokens.css', generateTokensCss()],
    ['dark.css', generateDarkCss()],
  ];

  for (const [filename, content] of files) {
    const outPath = join(stylesDir, filename);

    if (check) {
      const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
      if (current !== content) {
        drifted = true;
        console.error(
          `CSS token drift: ${filename} is out of date. Run: bun run generate:tokens`,
        );
      }
    } else {
      writeFileSync(outPath, content);
      console.log(`Wrote ${filename} (${content.length} bytes)`);
    }
  }

  if (check && drifted) process.exit(1);
  if (check) console.log('CSS tokens are up to date.');
}

main();
