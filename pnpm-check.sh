#!/usr/bin/env zsh

SCRIPT_DIR="${0:A:h}"
AUDIT_SCRIPT="$SCRIPT_DIR/add-audit-overrides.mjs"
CHECK_SCRIPT="$SCRIPT_DIR/check-package-dates.mjs"

ARGS="$@"

while true; do
	echo "Running pnpm install --lockfile-only"
	pnpm install --lockfile-only $ARGS

	pnpm audit

	pnpm audit fix

	echo "Running package date check"
	if node "$CHECK_SCRIPT"; then
		echo "Package check passed!"
		break
	else
		echo "Suspicious packages found, applying overrides and retrying..."
		rm -rf pnpm-lock.yaml
	fi
done

echo "Running final pnpm install --frozen-lockfile"
pnpm install --ignore-scripts "$@"


echo "Running PNPM Build to Check for failures"
pnpm run build
