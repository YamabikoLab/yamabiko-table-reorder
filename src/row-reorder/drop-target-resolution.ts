/**
 * rowspanを含むテーブルで、行を安全に並び替えられる移動先を判定する。
 *
 * rowspanで結合された行の一部だけを移動したり、結合範囲の途中へ別の行を挿入したりしないことを保証する。
 */

import type { ReorderDestination, ReorderTarget } from '@/reorder/dnd-interaction';
import { isBoundaryInsideRange } from '@/reorder/drop-target-rules';
import type { TableStructure } from '@/reorder/table-structure';

/**
 * 移動対象の行が、rowspanによって他の行と一体になっているかを判定する。
 *
 * rowspanで結合された範囲は1つの構造として保持するため、その範囲に含まれる行は単独では移動できない。
 *
 * @param structure 判定対象となるテーブル構造。
 * @param targetIndex 移動対象として検討している行の位置。
 * @return 移動対象がrowspanの結合範囲に含まれる場合は`true`。
 */
const isRowInsideRowSpan = ( structure: TableStructure, targetIndex: number ): boolean => {
	const body = structure.sections.body;
	if ( body === undefined ) {
		return false;
	}

	const belongsToMergedRowRange = body.rows.some( ( row ) => {
		const rowContainsTargetInMergedRange = row.placements.some( ( placement ) => {
			const targetBelongsToPlacement =
				placement.rowSpan > 1 &&
				targetIndex >= row.rowIndex &&
				targetIndex < row.rowIndex + placement.rowSpan;
			return targetBelongsToPlacement;
		} );
		return rowContainsTargetInMergedRange;
	} );
	return belongsToMergedRowRange;
};

/**
 * 移動先の境界が、rowspanで結合された範囲を上下に分断するかを判定する。
 *
 * @param structure 判定対象となるテーブル構造。
 * @param boundary 移動先として検討している行間の境界位置。
 * @return rowspanの結合範囲を分断する場合は`true`。
 */
const doesBoundarySplitRowSpan = ( structure: TableStructure, boundary: number ): boolean => {
	const body = structure.sections.body;
	if ( body === undefined ) {
		return false;
	}

	const splitsMergedRowRange = body.rows.some( ( row ) => {
		const rowContainsSplitBoundary = row.placements.some( ( placement ) => {
			const boundarySplitsPlacement =
				placement.rowSpan > 1 &&
				isBoundaryInsideRange( boundary, row.rowIndex, row.rowIndex + placement.rowSpan - 1 );
			return boundarySplitsPlacement;
		} );
		return rowContainsSplitBoundary;
	} );
	return splitsMergedRowRange;
};

/**
 * 行固有の結合セル規則を満たす移動先だけを返す。
 *
 * 移動対象の行または移動先がrowspanの一体性を壊す場合は、行の並び替えを確定しない。
 * 範囲外や順序が変わらない候補など、行・列に共通する妥当性は呼び出し元で確認済みとする。
 *
 * @param structure 行並び替えの基準となるテーブル構造。
 * @param target 今回移動する行。
 * @param destinationIndex 元の行順に対する移動先の境界位置。
 * @return 行固有の規則を満たす移動先。rowspanを保持できない場合は`null`。
 */
export const resolveRowDropTarget = (
	structure: TableStructure,
	target: ReorderTarget,
	destinationIndex: number
): ReorderDestination | null => {
	// rowspanで一体化された範囲を壊す移動は確定しない。
	if (
		isRowInsideRowSpan( structure, target.index ) ||
		doesBoundarySplitRowSpan( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
