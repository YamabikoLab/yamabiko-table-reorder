/**
 * 列並び替えでcolspanの一体性を守るためのDrop Target Resolutionを提供する。
 *
 * 共通Contractで妥当性確認済みの対象列と候補境界について、結合セルの一部だけを移動したり
 * colspan内部へ境界を挿入したりしないことを全sectionで保証する。
 */

import type { ReorderDestination, ReorderTarget } from '../reorder/dnd-interaction';
import { isBoundaryInsideRange } from '../reorder/drop-target-rules';
import type { TableStructure } from '../reorder/table-structure';

/**
 * 対象logical columnが、colspanによって一体として扱うべき範囲に含まれるか判定する。
 *
 * colspanを構成する列は単独のReorder Targetとして切り離せないため、どのsectionに結合セルがあっても
 * 列移動の対象外とする。
 *
 * @param structure   判定基準となる正規化済みTable Structure。
 * @param targetIndex 移動対象として検討しているlogical column index。
 * @return 対象列がいずれかのcolspan範囲に含まれる場合は`true`。
 */
const isColumnInsideColSpan = ( structure: TableStructure, targetIndex: number ): boolean => {
	// 列DnDでは、どのsectionであってもcolspanで一体化された範囲の一部だけをReorder Targetにできない。
	const belongsToMergedColumnRange = Object.values( structure.sections ).some(
		( section ) =>
			section?.rows.some( ( row ) =>
				row.placements.some(
					( placement ) =>
						placement.columnSpan > 1 &&
						targetIndex >= placement.columnStart &&
						targetIndex < placement.columnStart + placement.columnSpan
				)
			) ?? false
	);
	return belongsToMergedColumnRange;
};

/**
 * 候補境界が、colspanによって一体として扱うべき範囲を左右へ分断するか判定する。
 *
 * head / body / footのどこか1つでもcolspanを分断する境界は、Table全体の列移動先として利用しない。
 *
 * @param structure 判定基準となる正規化済みTable Structure。
 * @param boundary  移動先として検討しているlogical column間の境界index。
 * @return いずれかのcolspanを分断する境界であれば`true`。
 */
const doesBoundarySplitColSpan = ( structure: TableStructure, boundary: number ): boolean => {
	// Reorder Destinationは、どのsectionであってもcolspanで一体化された範囲の内部には設定できない。
	const splitsMergedColumnRange = Object.values( structure.sections ).some(
		( section ) =>
			section?.rows.some( ( row ) =>
				row.placements.some(
					( placement ) =>
						placement.columnSpan > 1 &&
						isBoundaryInsideRange(
							boundary,
							placement.columnStart,
							placement.columnStart + placement.columnSpan - 1
						)
				)
			) ?? false
	);
	return splitsMergedColumnRange;
};

/**
 * 列固有の結合セル規則を満たす候補だけをReorder Destinationとして返す。
 *
 * Table全sectionのcolspanを1つの構造単位として保持し、対象列または移動先のどちらかがその一体性を壊す場合は
 * 列DnDを確定候補にしない。範囲外・no-opなどの共通規則は上位Contractで確定済みとする。
 *
 * @param structure        列並び替えの基準となる正規化済みTable Structure。
 * @param target           今回移動するlogical columnを表すReorder Target。
 * @param destinationIndex 元のlogical column順序に対する候補境界index。
 * @return 列固有規則を満たすReorder Destination。colspanを保持できない場合は`null`。
 */
export const resolveColumnDropTarget = (
	structure: TableStructure,
	target: ReorderTarget,
	destinationIndex: number
): ReorderDestination | null => {
	// 列DnDを確定できるのは、対象列と移動先のどちらもcolspanの一体性を壊さない場合だけである。
	if (
		isColumnInsideColSpan( structure, target.index ) ||
		doesBoundarySplitColSpan( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
