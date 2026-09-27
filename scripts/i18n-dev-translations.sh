#!/usr/bin/env bash
set -euo pipefail

readonly SOURCE_DIR="dev/i18n/generated"
readonly TARGET_DIR="${WP_PLUGIN_LANG_DIR:-/var/www/html/wp-content/languages/plugins}"
readonly MO_FILE="${SOURCE_DIR}/yamabiko-table-reorder-ja.mo"

usage() {
	echo "Usage: $0 <install|uninstall>" >&2
	exit 2
}

require_sudo() {
	if ! command -v sudo >/dev/null 2>&1; then
		echo "sudo is required to write to ${TARGET_DIR}." >&2
		exit 1
	fi
}

install_translations() {
	require_sudo

	shopt -s nullglob
	local json_files=( "${SOURCE_DIR}"/yamabiko-table-reorder-ja-*.json )
	shopt -u nullglob

	if [[ ! -f "${MO_FILE}" || ${#json_files[@]} -eq 0 ]]; then
		echo "Development translation artifacts are missing. Run 'npm run i18n:dev' first." >&2
		exit 1
	fi

	sudo mkdir -p "${TARGET_DIR}"
	sudo cp "${MO_FILE}" "${json_files[@]}" "${TARGET_DIR}/"

	echo "Installed development translations to ${TARGET_DIR}."
}

uninstall_translations() {
	require_sudo

	sudo rm -f 		"${TARGET_DIR}/yamabiko-table-reorder-ja.mo" 		"${TARGET_DIR}"/yamabiko-table-reorder-ja-*.json

	echo "Removed development translations from ${TARGET_DIR}."
}

case "${1:-}" in
	install)
		install_translations
		;;
	uninstall)
		uninstall_translations
		;;
	*)
		usage
		;;
esac
