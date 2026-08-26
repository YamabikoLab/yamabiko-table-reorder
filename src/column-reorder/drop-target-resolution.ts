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
 * 対象logical columnがcolspanで一体化された範囲の一部か判定する。
 *
 * colspanを構成する列は単独のReorder Targetとして切り離せないため、どのsectionに結合セルがあっても
 * 列移動の対象外とする。
 *
 * @param structure   判定基準となる正規化済みTable Structure。
 * @param targetIndex 移動対象として検討しているlogical column index。
 * @return 対象列がいずれかのcolspan範囲に含まれる場合は`true`。
 */
const isColumnInsideColSpan = ( structure: TableStructure, targetIndex: number ): boolean =>
	// 結合範囲の一部だけを移動しないよう、全sectionのcolspan占有範囲を確認する。
	Object.values( structure.sections ).some(
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

/**
 * 候補境界がcolspanの内部にあり、結合範囲を左右へ分断するか判定する。
 *
 * head / body / footのどこか1つでもcolspanを分断する境界は、Table全体の列移動先として利用しない。
 *
 * @param structure 判定基準となる正規化済みTable Structure。
 * @param boundary  移動先として検討しているlogical column間の境界index。
 * @return いずれかのcolspanを分断する境界であれば`true`。
 */
const doesBoundarySplitColSpan = ( structure: TableStructure, boundary: number ): boolean =>
	// Reorder Destinationによって結合範囲を分断しないよう、全sectionのcolspan占有範囲を確認する。
	Object.values( structure.sections ).some(
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
	// 対象列または移動先のどちらかがcolspanの一体性を壊す場合、列DnDは確定候補にできない。
	if (
		isColumnInsideColSpan( structure, target.index ) ||
		doesBoundarySplitColSpan( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
