#!/usr/bin/env bash
set -euo pipefail

# Release script for @opendata-ai monorepo
# Usage: ./scripts/release.sh [patch|minor|major|x.y.z]
# Defaults to patch if no argument provided.

BUMP="${1:-patch}"
PACKAGES=(
  packages/core
  packages/engine
  packages/vanilla
  packages/react
  packages/vue
  packages/svelte
)

# Get current version from root package.json
CURRENT=$(node -e "console.log(require('./package.json').version)")

# Calculate next version
if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEXT="$BUMP"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
  case "$BUMP" in
    major) NEXT="$((MAJOR + 1)).0.0" ;;
    minor) NEXT="$MAJOR.$((MINOR + 1)).0" ;;
    patch) NEXT="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    *) echo "Usage: $0 [patch|minor|major|x.y.z]"; exit 1 ;;
  esac
fi

echo "Releasing v$NEXT (was v$CURRENT)"
echo ""

# Must be on main
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
  echo "Error: releases must be run from main (currently on $BRANCH)."
  exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working directory has uncommitted changes. Commit or stash first."
  exit 1
fi

# Update root package.json
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  p.version = '$NEXT';
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"

# Update each package
for pkg in "${PACKAGES[@]}"; do
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('$pkg/package.json', 'utf8'));
    p.version = '$NEXT';
    fs.writeFileSync('$pkg/package.json', JSON.stringify(p, null, 2) + '\n');
  "
  echo "  Updated $pkg -> $NEXT"
done

# Update CHANGELOG: replace [Unreleased] marker with new version section
DATE=$(date +%Y-%m-%d)
perl -i -pe "s/^## \[Unreleased\]/## [Unreleased]\n\n## [$NEXT] - $DATE/" CHANGELOG.md
echo "  Updated CHANGELOG.md"

# Commit and tag
git add package.json CHANGELOG.md "${PACKAGES[@]/%//package.json}"
git commit -m "release: v$NEXT"
git tag "v$NEXT"

echo ""
echo "Created commit and tag v$NEXT"
echo "To publish, push the tag:"
echo ""
echo "  git push origin main --tags"
echo ""
