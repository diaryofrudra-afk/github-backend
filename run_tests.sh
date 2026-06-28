#!/bin/bash

# Unified test runner for Suprwise
# Usage: ./run_tests.sh
# Runs all test files and reports summary

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASSED=0
FAILED=0
TOTAL=0

echo ""
echo "============================================================"
echo "Running Suprwise Test Suite"
echo "============================================================"
echo ""

# Define all test files (in priority order: auth first, then integrations)
# The live backend is ./suprwise/ (from root .env).
TEST_FILES=(
    "suprwise/auth/test_endpoints.py"
)

# Run each test file
for test_file in "${TEST_FILES[@]}"; do
    full_path="$REPO_ROOT/$test_file"

    # Check if file exists
    if [ ! -f "$full_path" ]; then
        echo "⏭️  Skipping $test_file (not found)"
        continue
    fi

    TOTAL=$((TOTAL + 1))
    echo "Running: $test_file"

    if python3 "$full_path" 2>&1; then
        PASSED=$((PASSED + 1))
    else
        echo ""
        echo "❌ FAILED: $test_file"
        echo ""
        FAILED=$((FAILED + 1))
    fi

    echo ""
done

# Print summary
echo "============================================================"
echo "Test Summary"
echo "============================================================"
echo "Total Tests: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "============================================================"
echo ""

# Exit with error code if any tests failed
if [ $FAILED -gt 0 ]; then
    echo "❌ Some tests failed. Please fix issues and try again."
    exit 1
else
    echo "✅ All tests passed!"
    exit 0
fi
