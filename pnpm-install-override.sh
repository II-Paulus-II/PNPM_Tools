#!/usr/bin/env sh

self=$0
while [ -L "$self" ]; do
	d=$(dirname -- "$self")
	self=$(readlink -- "$self")
	case $self in
		/*) ;;
		*) self=$d/$self ;;
	esac
done
SCRIPT_DIR=$(dirname -- "$self")

PACKAGE_DATE_SCRIPT="$SCRIPT_DIR/tools/check-package-dates.mjs"
AUDIT_SCRIPT="$SCRIPT_DIR/tools/add-audit-overrides.mjs"

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
	echo "Removing new workspace.yaml file"
	rm -rf pnpm-workspace.yaml
fi
