#!/usr/bin/env zsh

SCRIPT_DIR="${0:A:h}"
AUDIT_SCRIPT="$SCRIPT_DIR/add-overrides.mjs"

ARGS="$@"
echo "Removing Any Previous Workspace.yaml File"
rm -rf pnpm-workspace.yaml

echo "Running pnpm install --lockfile-only"
pnpm install --lockfile-only $ARGS

echo "Auditing project"
pnpm audit
audit_status=$?

if [ $audit_status -ne 0 ]; then
	echo "Running Audit Fix"
	pnpm audit --fix
	echo "Adding Overrides to package.json from pnpm-workspace.yaml"
	node "$AUDIT_SCRIPT"
fi
