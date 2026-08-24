/**
 * Column Reorderが対応するblockを判定するfeature-owned boundary。
 */

/** 現在Column Reorder prototypeの対象とするblock。 */
const SUPPORTED_BLOCKS = new Set( [ 'core/table', 'flexible-table-block/table' ] );

/**
 * block nameがColumn Reorderの対象か確認する。
 *
 * @param blockName Gutenberg block name。
 * @return 対応blockの場合true。
 */
export const supportsColumnReorder = ( blockName: string ): boolean =>
	SUPPORTED_BLOCKS.has( blockName );
