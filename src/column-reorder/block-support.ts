/**
 * Column Reorder が対応する block を判定する feature-owned boundary。
 */

/** 現在 Column Reorder prototype の対象とする block。 */
const SUPPORTED_BLOCKS = new Set( [ 'core/table', 'flexible-table-block/table' ] );

/**
 * block name が Column Reorder の対象か確認する。
 *
 * @param blockName Gutenberg block name。
 * @return 対応 block の場合 true。
 */
export const supportsColumnReorder = ( blockName: string ): boolean =>
	SUPPORTED_BLOCKS.has( blockName );
