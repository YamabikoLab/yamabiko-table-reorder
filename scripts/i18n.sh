#!/usr/bin/env bash
set -euo pipefail

readonly LANGUAGES_DIR="languages"
readonly JS_POT="${LANGUAGES_DIR}/.yamabiko-table-reorder-js.pot"
readonly JS_MESSAGES="${LANGUAGES_DIR}/.i18n-messages.js"
readonly POT_FILE="${LANGUAGES_DIR}/yamabiko-table-reorder.pot"

cleanup() {
	rm -f "${JS_POT}" "${JS_MESSAGES}"
}

trap cleanup EXIT

mkdir -p "${LANGUAGES_DIR}"
cleanup

babel src/messages.ts \
	--out-file "${JS_MESSAGES}" \
	--config-file ./babel.i18n.config.js

wp i18n make-pot . "${POT_FILE}" \
	--domain=yamabiko-table-reorder \
	--include=yamabiko-table-reorder.php \
	--skip-js \
	--merge="${JS_POT}"
