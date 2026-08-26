/**
 * 行並び替えでrowspanの一体性を守るためのDrop Target Resolutionを提供する。
 *
 * 共通Contractで妥当性確認済みの対象行と候補境界について、結合範囲の一部だけを移動したり
 * rowspan内部へ境界を挿入したりしないことを保証する。
 */

import type { ReorderDestination, ReorderTarget } from '../reorder/dnd-interaction';
import { isBoundaryInsideRange } from '../reorder/drop-target-rules';
import type { TableStructure } from '../reorder/table-structure';

/**
 * 対象行が、rowspanによって一体として扱うべき範囲に含まれるか判定する。
 *
 * rowspanを構成する行は単独のReorder Targetとして切り離せないため、行移動の対象外とする。
 *
 * @param structure   判定基準となる正規化済みTable Structure。
 * @param targetIndex 移動対象として検討しているbody rowのLogical Index。
 * @return 対象行がrowspan範囲に含まれる場合は`true`。
 */
const isRowInsideRowSpan = ( structure: TableStructure, targetIndex: number ): boolean => {
	const body = structure.sections.body;
	if ( body === undefined ) {
		return false;
	}

	// 行DnDでは、rowspanで一体化された範囲の一部だけをReorder Targetにできない。
	const belongsToMergedRowRange = body.rows.some( ( row ) =>
		row.placements.some(
			( placement ) =>
				placement.rowSpan > 1 &&
				targetIndex >= row.rowIndex &&
				targetIndex < row.rowIndex + placement.rowSpan
		)
	);
	return belongsToMergedRowRange;
};

/**
 * 候補境界が、rowspanによって一体として扱うべき範囲を上下へ分断するか判定する。
 *
 * @param structure 判定基準となる正規化済みTable Structure。
 * @param boundary  移動先として検討しているbody row間の境界index。
 * @return rowspanを分断する境界であれば`true`。
 */
const doesBoundarySplitRowSpan = ( structure: TableStructure, boundary: number ): boolean => {
	const body = structure.sections.body;
	if ( body === undefined ) {
		return false;
	}

	// Reorder Destinationは、rowspanで一体化された範囲の内部には設定できない。
	const splitsMergedRowRange = body.rows.some( ( row ) =>
		row.placements.some(
			( placement ) =>
				placement.rowSpan > 1 &&
				isBoundaryInsideRange( boundary, row.rowIndex, row.rowIndex + placement.rowSpan - 1 )
		)
	);
	return splitsMergedRowRange;
};

/**
 * 行固有の結合セル規則を満たす候補だけをReorder Destinationとして返す。
 *
 * bodyのrowspanを1つの構造単位として保持し、対象行または移動先のどちらかがその一体性を壊す場合は
 * 行DnDを確定候補にしない。範囲外・no-opなどの共通規則は上位Contractで確定済みとする。
 *
 * @param structure        行並び替えの基準となる正規化済みTable Structure。
 * @param target           今回移動するbody rowを表すReorder Target。
 * @param destinationIndex 元のbody row順序に対する候補境界index。
 * @return 行固有規則を満たすReorder Destination。rowspanを保持できない場合は`null`。
 */
export const resolveRowDropTarget = (
	structure: TableStructure,
	target: ReorderTarget,
	destinationIndex: number
): ReorderDestination | null => {
	// 行DnDを確定できるのは、対象行と移動先のどちらもrowspanの一体性を壊さない場合だけである。
	if (
		isRowInsideRowSpan( structure, target.index ) ||
		doesBoundarySplitRowSpan( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
