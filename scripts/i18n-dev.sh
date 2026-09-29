#!/usr/bin/env bash
set -euo pipefail

readonly PO_FILE="dev/i18n/yamabiko-table-reorder-ja.po"
readonly GENERATED_DIR="dev/i18n/generated"
readonly MO_FILE="${GENERATED_DIR}/yamabiko-table-reorder-ja.mo"

generate_artifacts() {
	mkdir -p "${GENERATED_DIR}"
	rm -f "${GENERATED_DIR}"/*.json

	wp i18n make-json "${PO_FILE}" "${GENERATED_DIR}" \
		--domain=yamabiko-table-reorder \
		--extensions=ts,tsx \
		--use-map='{"src/messages.ts":"build/index.js"}' \
		--no-purge

	prettier --write "${GENERATED_DIR}/*.json"
	wp i18n make-mo "${PO_FILE}" "${MO_FILE}"
}

case "${1:-}" in
	artifacts)
		generate_artifacts
		;;
	"")
		bash scripts/i18n.sh
		wp i18n update-po languages/yamabiko-table-reorder.pot "${PO_FILE}"
		generate_artifacts
		;;
	*)
		echo "Usage: $0 [artifacts]" >&2
		exit 2
		;;
esac
