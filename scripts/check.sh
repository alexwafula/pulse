#!/usr/bin/env bash
# scripts/check.sh
# Comprehensive local & CI validation script for Pulse.
#
# Covers:
# 1. Go formatting (gofmt)
# 2. Go static analysis (go vet)
# 3. Go unit tests (go test)
# 4. Python unit tests (unittest)
# 5. Agent boundary evaluation suite (run_agents.py)
# 6. TypeScript compilation check (tsc --noEmit)
# 7. Web client bundle build (esbuild)
# 8. Web artifact reproducibility check (git diff)
# 9. Azure Infrastructure-as-Code validation (bicep build & build-params)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== [1/9] Checking Go formatting (gofmt) ==="
UNFORMATTED=$(gofmt -l .)
if [ -n "$UNFORMATTED" ]; then
  echo "Error: The following Go files are not formatted:" >&2
  echo "$UNFORMATTED" >&2
  echo "Run 'gofmt -w .' to fix." >&2
  exit 1
fi
echo "✓ All Go files properly formatted."

echo "=== [2/9] Running Go vet ==="
go vet ./...
echo "✓ go vet passed."

echo "=== [3/9] Running Go tests ==="
go test ./...
echo "✓ Go tests passed."

echo "=== [4/9] Running Python unit tests ==="
python3 -m unittest discover -s agents/tests -v
echo "✓ Python unit tests passed."

echo "=== [5/9] Running agent boundary evaluation suite ==="
python3 tests/evaluations/run_agents.py
echo "✓ Agent evaluations passed."

echo "=== [6/9] Checking TypeScript types (tsc --noEmit) ==="
npm run check:web
echo "✓ TypeScript type check passed."

echo "=== [7/9] Building web assets (esbuild) ==="
npm run build:web
echo "✓ Web assets build succeeded."

echo "=== [8/9] Verifying web bundle reproducibility ==="
git diff --exit-code -- app/web/static/pitch.js
echo "✓ Web bundle is up-to-date with source."

echo "=== [9/9] Validating Azure Bicep templates ==="
if command -v az >/dev/null 2>&1 && az bicep version >/dev/null 2>&1; then
  BICEP_CMD="az bicep"
elif command -v bicep >/dev/null 2>&1; then
  BICEP_CMD="bicep"
else
  echo "Error: Neither 'az bicep' nor 'bicep' CLI is installed." >&2
  exit 1
fi

$BICEP_CMD build --file infra/azure/main.bicep --stdout > /dev/null
$BICEP_CMD build-params --file infra/azure/main.bicepparam --stdout > /dev/null
echo "✓ Azure Bicep templates build cleanly with 0 errors/warnings."

echo ""
echo "=================================================="
echo "  All Pulse checks passed successfully! (9/9)     "
echo "=================================================="
