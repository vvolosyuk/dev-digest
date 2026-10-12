#!/usr/bin/env sh
# detect.sh — list common flakiness sources in test files.
#
# Harmless, read-only helper shipped with the `flaky-tests` sample skill. It only
# greps; it never modifies anything. DevDigest does NOT run this script: when the
# skill is imported from flaky-tests.zip, only SKILL.md is read and this file is
# shown as "ignored" in the import preview. It exists to demonstrate exactly that.
#
# Usage: ./detect.sh [dir]   (default: current directory)

set -eu

DIR="${1:-.}"

grep -rnE 'setTimeout|sleep\(|Date\.now\(|new Date\(\)|Math\.random\(' "$DIR" \
  --include='*.test.ts' --include='*.test.tsx' \
  --include='*.spec.ts' --include='*.spec.tsx' \
  --include='*.test.js' --include='*.spec.js' \
  --exclude-dir=node_modules \
  || echo "No obvious flakiness sources found in $DIR"
