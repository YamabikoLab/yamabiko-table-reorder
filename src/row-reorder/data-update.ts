/**
 * 確定した行の並び替えを、テーブル本体の行順へ反映する。
 *
 * 対応するブロックごとの保存形式は共通の変換境界へ委ね、行の位置だけを変更する。
 * 行やセルの内容、テーブル本体以外の属性は保持する。
 */

import { moveArrayItem } from '@/reorder/data-update-rules';
import { getTableBlockAdapter } from '@/reorder/table-block-adapter';
import type { TableBlockAttributes } from '@/reorder/table-structure';

/**
 * テーブル本体の1行を、確定した移動先へ移した新しい属性を生成する。
 *
 * 対応ブロックの行データを安全に読み書きできない場合は、途中まで更新した結果を返さない。
 *
 * @param blockName 行並び替え対象のGutenbergブロック名。
 * @param attributes 並び替え前のテーブル属性。入力値は変更しない。
 * @param targetIndex 元の行順で移動対象を表す位置。
 * @param destinationIndex 元の行順に対する移動先の境界位置。
 * @return 行順だけを変更した新しい属性。更新を成立させられない場合は`null`。
 */
export const applyRowReorder = (
	blockName: string,
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const adapter = getTableBlockAdapter( blockName );
	if ( adapter === null ) {
		return null;
	}

	const bodyRows = adapter.readSectionRows( attributes, 'body' );

	// テーブル本体の行を安全に解釈でき、並び替える行が存在する場合だけ更新する。
	if ( bodyRows === null || bodyRows.length === 0 ) {
		return null;
	}

	const reorderedBodyRows = moveArrayItem( bodyRows, targetIndex, destinationIndex );
	if ( reorderedBodyRows === null ) {
		return null;
	}

	const nextAttributes = adapter.writeSectionRows( attributes, 'body', reorderedBodyRows );
	return nextAttributes;
};
