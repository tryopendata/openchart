#!/usr/bin/env node
/**
 * Generate keyframes.css, animation.css and table-animation.css from the
 * choreography table in packages/core/src/motion/choreography.ts.
 *
 * Run with bun (imports TS source directly, no build needed):
 *   bun scripts/generate-motion-css.mjs
 *
 * Pass --check to fail (exit 1) if the committed files differ from a
 * fresh generation (used by CI to guarantee the motion CSS never drifts).
 *
 * Output is passed through `biome format` so `bun run lint` accepts it as-is.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const stylesDir = join(repoRoot, 'packages', 'core', 'src', 'styles');

const { ENTRANCE_ROLES, KEYFRAMES, keyframeValueToCSS, resolveProgressPoint } = await import(
  join(repoRoot, 'packages', 'core', 'src', 'motion', 'choreography.ts')
);

const GENERATED_HEADER = `/* GENERATED FILE — do not edit. Source: packages/core/src/motion/choreography.ts. Regenerate: bun run generate:motion */`;

const D = 'var(--oc-animation-duration)';
const PLAY_STATE = 'animation-play-state: var(--oc-play-state, running);';

/** A block comment; continuation lines align under the first word. */
function comment(text, indent) {
  const lines = text.split('\n');
  return `${indent}/* ${lines.join(`\n${indent}   `)} */`;
}

/** Trim float noise so fractions print as authored (0.35, not 0.35000000000000003). */
function fraction(value) {
  return Number(value.toFixed(6));
}

function timingCSS(timing) {
  switch (timing.kind) {
    case 'author':
      return 'var(--oc-animation-ease, var(--oc-ease-smooth))';
    case 'curve':
      return `var(--oc-ease-${timing.curve})`;
    case 'css':
      return timing.css;
    default:
      throw new Error(`Unknown timing kind ${timing.kind}`);
  }
}

function durationFallback(rule) {
  switch (rule.kind) {
    case 'base':
      return rule.factor === 1 ? D : `calc(${D} * ${rule.factor})`;
    case 'fixed':
      return `${rule.ms}ms`;
    case 'stack-segment':
      return 'var(--oc-stack-segment-duration, 150ms)';
    default:
      throw new Error(`Unknown duration kind ${rule.kind}`);
  }
}

const STAGGER_CSS = {
  none: null,
  mark: 'var(--oc-animation-stagger) * var(--oc-mark-index, 0)',
  row: 'var(--oc-animation-stagger) * var(--oc-row-index, 0)',
  'stack-segment':
    'var(--oc-animation-stagger) * var(--oc-mark-index, 0) + var(--oc-stack-pos, 0) * var(--oc-stack-segment-duration, 150ms)',
  'map-point': 'var(--oc-mark-index, 0) * var(--oc-point-stagger, 60ms)',
  'map-sweep': 'var(--oc-map-delay, 0ms)',
  'barlist-row': 'var(--oc-row-delay, 0ms)',
  'tilemap-tile': 'var(--oc-tile-delay, 0ms)',
};

function delayFallback(rule) {
  const parts = [];
  if (rule.after) {
    // The CSS fallback holds the resolved fraction for non-spring phases. In
    // phase 0 every progress point resolves to the same fraction as its spring
    // fraction; fail loudly if the table ever splits them, since the CSS
    // cannot tell a spring phase from an eased one.
    const eased = fraction(resolveProgressPoint(rule.after, { duration: 1 }));
    const spring = fraction(rule.after.springFraction);
    if (eased !== spring) {
      throw new Error(
        `Progress point resolves to ${eased} eased but ${spring} under a spring; the CSS fallback can't express both`,
      );
    }
    parts.push(eased === 1 ? D : `${D} * ${eased}`);
  }
  if (rule.plusAnnotationDelay) parts.push('var(--oc-annotation-delay, 150ms)');
  if (!(rule.stagger in STAGGER_CSS)) throw new Error(`Unknown stagger rule ${rule.stagger}`);
  const stagger = STAGGER_CSS[rule.stagger];
  if (stagger) parts.push(stagger);
  if (parts.length === 0) return '0ms';
  if (parts.length === 1 && /^var\([^*+]*\)$/.test(parts[0])) return parts[0];
  return `calc(${parts.join(' + ')})`;
}

function roleDeclarations(role) {
  const duration = `var(${role.vars.duration}, ${durationFallback(role.duration)})`;
  const delay = `var(${role.vars.delay}, ${delayFallback(role.delay)})`;
  const timing = timingCSS(role.timing);
  if (role.emit === 'shorthand') {
    return [
      `animation: ${role.keyframe} ${duration} ${timing} both;`,
      `animation-delay: ${delay};`,
      PLAY_STATE,
    ];
  }
  const decls = [];
  for (const part of role.emit) {
    if (part === 'name') decls.push(`animation-name: ${role.keyframe};`);
    else if (part === 'duration') decls.push(`animation-duration: ${duration};`);
    else if (part === 'timing') decls.push(`animation-timing-function: ${timing};`);
    else if (part === 'delay') decls.push(`animation-delay: ${delay};`);
    else throw new Error(`Unknown emit part ${part}`);
  }
  decls.push(PLAY_STATE);
  return decls;
}

function rule(selectors, decls, indent) {
  const inner = `${indent}  `;
  return `${selectors.join(',\n' + indent)} {\n${decls.map((d) => inner + d).join('\n')}\n${indent}}`;
}

/** Nested rules under one scope root (`& selector`). */
function nestedRoleRules(roles, indent) {
  const blocks = [];
  for (const role of roles) {
    const parts = [];
    if (role.comment) parts.push(comment(role.comment, indent));
    parts.push(
      rule(
        role.selectors.map((s) => `& ${s}`),
        roleDeclarations(role),
        indent,
      ),
    );
    for (const sel of role.suppress ?? []) {
      parts.push(rule([`& ${sel}`], ['animation: none;'], indent));
    }
    blocks.push(parts.join('\n'));
  }
  return blocks.join('\n\n');
}

function sectionComment(title, indent) {
  return `${indent}/* ---------------------------------------------------------------------------\n${indent} * ${title}\n${indent} * --------------------------------------------------------------------------- */`;
}

function generateAnimationCss() {
  const chart = ENTRANCE_ROLES.filter((r) => r.scope === 'chart');
  return `${GENERATED_HEADER}

@layer oc.animation {
${sectionComment('Animation scoped rules (.oc-animate enables animation on the chart root)', '  ')}

  .oc-animate {
${nestedRoleRules(chart, '    ')}
  }
}
`;
}

function generateTableAnimationCss() {
  const table = ENTRANCE_ROLES.filter((r) => r.scope === 'table');
  return `${GENERATED_HEADER}

@layer oc.animation {
${sectionComment('Table entrance animations (.oc-table-wrapper.oc-animate)', '  ')}

  .oc-table-wrapper.oc-animate {
${nestedRoleRules(table, '    ')}
  }
}
`;
}

function offsetLabel(offset) {
  if (offset === 0) return 'from';
  if (offset === 1) return 'to';
  return `${fraction(offset * 100)}%`;
}

function generateKeyframesCss() {
  const blocks = Object.entries(KEYFRAMES).map(([name, def]) => {
    const stops = def.stops
      .map((stop) => {
        const decls = Object.entries(stop.values).map(
          ([prop, value]) => `      ${prop}: ${keyframeValueToCSS(value)};`,
        );
        return `    ${offsetLabel(stop.offset)} {\n${decls.join('\n')}\n    }`;
      })
      .join('\n');
    return `${comment(def.comment, '  ')}\n  @keyframes ${name} {\n${stops}\n  }`;
  });
  return `${GENERATED_HEADER}

@layer oc.animation {
${sectionComment('Animation keyframes', '  ')}

${blocks.join('\n\n')}
}
`;
}

function biomeFormat(content, outPath) {
  const bin = join(repoRoot, 'node_modules', '.bin', 'biome');
  return execFileSync(bin, ['format', `--stdin-file-path=${relative(repoRoot, outPath)}`], {
    cwd: repoRoot,
    input: content,
    encoding: 'utf8',
  });
}

function main() {
  const check = process.argv.includes('--check');
  let drifted = false;

  const files = [
    ['keyframes.css', generateKeyframesCss()],
    ['animation.css', generateAnimationCss()],
    ['table-animation.css', generateTableAnimationCss()],
  ];

  for (const [filename, raw] of files) {
    const outPath = join(stylesDir, filename);
    const content = biomeFormat(raw, outPath);

    if (check) {
      const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
      if (current !== content) {
        drifted = true;
        console.error(`Motion CSS drift: ${filename} is out of date. Run: bun run generate:motion`);
      }
    } else {
      writeFileSync(outPath, content);
      console.log(`Wrote ${filename} (${content.length} bytes)`);
    }
  }

  if (check && drifted) process.exit(1);
  if (check) console.log('Motion CSS is up to date.');
}

main();
