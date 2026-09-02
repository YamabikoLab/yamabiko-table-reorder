/**
 * 行専用Reorder Target Resolutionとして、対象Tableの指定行が現在のTable構造で行DnDの移動対象として利用可能かを判定する。
 *
 * Table Integrationが提供する現在の行構造だけを利用し、Tableデータや判定結果を保持しない。
 */

import { rowTableIntegration } from './table-integration';

/**
 * 対象Tableの指定行が、要求時点のTable構造で行単位の移動対象として利用可能かを確認する。
 *
 * `tbody`内の0-based行位置だけを受理し、`rowspan`による結合範囲に含まれる行は利用不可とする。
 *
 * @param tableIdentity 対象Table個体を識別する値。
 * @param rowIndex      `tbody`内の0-based行位置。
 * @return 指定行を現在のTable構造で行単位に移動できる場合はtrue、それ以外はfalse。
 */
const isAvailable = ( tableIdentity: string, rowIndex: number ): boolean => {
	/* `tbody`の行位置として成立しない値は、移動対象として扱わない。 */
	if ( ! Number.isInteger( rowIndex ) || rowIndex < 0 ) {
		return false;
	}

	const structure = rowTableIntegration.getStructure( tableIdentity );
	/* 現在構造を取得できない場合、または指定行が現在の`tbody`外にある場合は移動対象として扱わない。 */
	if ( structure === null || rowIndex >= structure.rowCount ) {
		return false;
	}

	/* 指定行の前後いずれかの行間が縦結合で分断不可なら、その行は行単位の移動対象として成立しない。 */
	const isInsideMergedRange =
		structure.blockedBoundaries.includes( rowIndex ) ||
		structure.blockedBoundaries.includes( rowIndex + 1 );

	return ! isInsideMergedRange;
};

/**
 * DnD Interactionへ提供する行専用Reorder Target Resolutionのインタフェース。
 */
export const rowReorderTargetResolution = {
	isAvailable,
};
