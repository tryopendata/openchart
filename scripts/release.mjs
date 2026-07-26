#!/usr/bin/env node

/**
 * Release script for openchart monorepo.
 *
 * Bumps all 6 packages to the same version, commits, tags, and pushes.
 * Designed to run locally or in CI via workflow_dispatch.
 *
 * Pass `--dry-run` to preview the bump and generated changelog without writing
 * files, creating a commit, tagging, or pushing.
 *
 * Prerelease versions (anything with a `-`, e.g. 8.1.0-rc.1) publish under the
 * npm `next` dist-tag; stable versions take `latest`. See .github/workflows/release.yml.
 *
 * Usage:
 *   node scripts/release.mjs patch    # 6.13.1 -> 6.13.2
 *   node scripts/release.mjs minor    # 6.13.1 -> 6.14.0
 *   node scripts/release.mjs major    # 6.13.1 -> 7.0.0
 *   node scripts/release.mjs 6.15.0   # explicit version
 *   node scripts/release.mjs minor --dry-run
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PACKAGES = ['core', 'engine', 'vanilla', 'react', 'vue', 'svelte'];
const ROOT = resolve(import.meta.dirname, '..');

function run(cmd, opts) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function getCurrentVersion() {
  const pkg = readJSON(resolve(ROOT, 'packages/core/package.json'));
  return pkg.version;
}

function bumpVersion(current, bump) {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (bump) {
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'major': return `${major + 1}.0.0`;
    default: {
      if (/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(bump)) return bump;
      console.error(`Invalid bump type: ${bump}`);
      console.error('Usage: node scripts/release.mjs [patch|minor|major|x.y.z] [--dry-run]');
      process.exit(1);
    }
  }
}

function updatePackageVersions(version, dryRun) {
  for (const pkg of PACKAGES) {
    const pkgPath = resolve(ROOT, `packages/${pkg}/package.json`);
    const data = readJSON(pkgPath);
    data.version = version;
    if (dryRun) {
      console.log(`  would set packages/${pkg}/package.json version -> ${version}`);
      continue;
    }
    writeJSON(pkgPath, data);
  }
}

function verifyCleanWorktree() {
  const status = run('git status --porcelain');
  if (status) {
    console.error('Working tree is not clean. Commit or stash changes first.');
    console.error(status);
    process.exit(1);
  }
}

function verifyOnMain() {
  const branch = run('git branch --show-current');
  if (branch !== 'main') {
    console.error(`Must be on main branch (currently on ${branch})`);
    process.exit(1);
  }
}

function generateChangelog(currentVersion, newVersion) {
  // Collect commits since the last release tag
  const lastTag = `core-v${currentVersion}`;
  let tagExists;
  try {
    run(`git rev-parse ${lastTag}`);
    tagExists = true;
  } catch {
    tagExists = false;
  }

  const range = tagExists ? `${lastTag}..HEAD` : 'HEAD~20..HEAD';
  let commits;
  try {
    commits = run(`git log ${range} --pretty=format:"%H %s" --no-merges`);
  } catch {
    commits = '';
  }

  if (!commits) return null;

  const sections = {
    Features: [],
    'Bug Fixes': [],
    Performance: [],
    Refactoring: [],
  };

  const typeMap = {
    feat: 'Features',
    fix: 'Bug Fixes',
    perf: 'Performance',
    refactor: 'Refactoring',
  };

  for (const line of commits.split('\n')) {
    if (!line.trim()) continue;
    const sha = line.slice(0, 40);
    const message = line.slice(41);
    const match = message.match(/^(\w+)(?:\(.*?\))?!?:\s*(.+)/);
    if (!match) continue;
    const [, type, desc] = match;
    const section = typeMap[type];
    if (section) {
      sections[section].push({ desc, sha: sha.slice(0, 7) });
    }
  }

  const date = new Date().toISOString().split('T')[0];
  const compareBase = `core-v${currentVersion}`;
  let md = `## [${newVersion}](https://github.com/tryopendata/openchart/compare/${compareBase}...core-v${newVersion}) (${date})\n`;

  let hasContent = false;
  for (const [section, items] of Object.entries(sections)) {
    if (items.length === 0) continue;
    hasContent = true;
    md += `\n\n### ${section}\n\n`;
    for (const { desc, sha } of items) {
      md += `* ${desc} ([${sha}](https://github.com/tryopendata/openchart/commit/${sha}))\n`;
    }
  }

  return hasContent ? md : null;
}

function updateChangelogs(currentVersion, newVersion, dryRun) {
  const entry = generateChangelog(currentVersion, newVersion);
  if (!entry) {
    if (dryRun) console.log('  no conventional commits found - changelogs unchanged');
    return;
  }

  if (dryRun) {
    console.log(`  would prepend to ${PACKAGES.length} CHANGELOG.md files:\n`);
    console.log(entry);
    return;
  }

  for (const pkg of PACKAGES) {
    const changelogPath = resolve(ROOT, `packages/${pkg}/CHANGELOG.md`);
    let content;
    try {
      content = readFileSync(changelogPath, 'utf8');
    } catch {
      content = '# Changelog\n';
    }
    const insertPoint = content.indexOf('\n## ');
    if (insertPoint === -1) {
      content += '\n' + entry;
    } else {
      content = content.slice(0, insertPoint) + '\n' + entry + '\n' + content.slice(insertPoint + 1);
    }
    writeFileSync(changelogPath, content);
  }
}

// --- Main ---

const bump = process.argv[2];
if (!bump) {
  console.error('Usage: node scripts/release.mjs [patch|minor|major|x.y.z] [--dry-run]');
  process.exit(1);
}

// Skip git checks when running in CI (the workflow handles this)
const isCI = process.env.CI === 'true';
if (!isCI) {
  verifyCleanWorktree();
  verifyOnMain();
}

const currentVersion = getCurrentVersion();
const newVersion = bumpVersion(currentVersion, bump);

if (newVersion === currentVersion) {
  console.error(`Version ${newVersion} is already the current version`);
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');

console.log(`Releasing: ${currentVersion} -> ${newVersion}${dryRun ? ' (dry run)' : ''}`);

// 1. Update package.json versions
updatePackageVersions(newVersion, dryRun);
console.log(`${dryRun ? 'Previewed' : 'Updated'} ${PACKAGES.length} package.json files`);

// 2. Update changelogs
updateChangelogs(currentVersion, newVersion, dryRun);
console.log(`${dryRun ? 'Previewed' : 'Updated'} changelogs`);

// A dry run stops here: nothing has been written, staged, or committed.
if (dryRun) {
  console.log(`\nDry run - no files written, no commit created.`);
  console.log(`Would commit: release: openchart v${newVersion}`);
  console.log(
    `Would create tags: ${PACKAGES.map(p => `${p}-v${newVersion}`).join(', ')}, then push main`,
  );
  console.log(`\nDone! Dry run for openchart v${newVersion} (working tree untouched)`);
  process.exit(0);
}

// 3. Stage and commit
const files = PACKAGES.flatMap(pkg => [
  `packages/${pkg}/package.json`,
  `packages/${pkg}/CHANGELOG.md`,
]);
run(`git add ${files.join(' ')}`);
run(`git commit -m "release: openchart v${newVersion}"`);
console.log('Created release commit');

// 4. Create tags, then push.
//
// Order matters: the push is what triggers the Release workflow, whose final
// step runs `gh release create --verify-tag`. Tagging after the push lets the
// workflow reach that step before the tags exist and fail *after* npm publish
// already succeeded (this happened on v8.0.0).
//
// Tags are created via the GitHub API so they get verified signatures.
const sha = run('git rev-parse HEAD');
let created = 0;
for (const pkg of PACKAGES) {
  const tag = `${pkg}-v${newVersion}`;
  try {
    run(`gh api repos/{owner}/{repo}/git/refs -f ref=refs/tags/${tag} -f sha=${sha}`);
    created++;
  } catch (err) {
    // Re-running a partially-completed release must not fail on existing tags.
    // execSync throws with stdout/stderr as Buffers, so String() them; err.message
    // alone does not carry the API response body.
    const out = String(err.stdout ?? '') + String(err.stderr ?? '');
    if (!/already exists/i.test(out)) throw err;
    console.log(`Tag ${tag} already exists, skipping`);
  }
}
console.log(`Created ${created} verified tags via GitHub API (${PACKAGES.length} total)`);

// Push last: this triggers the Release workflow, and every tag already exists.
run('git push origin main');
console.log('Pushed commit to origin - Release workflow will start');

console.log(`\nDone! Released openchart v${newVersion}`);
