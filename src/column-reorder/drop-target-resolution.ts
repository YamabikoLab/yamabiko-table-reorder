/**
 * colspanを含むテーブルで、列を安全に並び替えられる移動先を判定する。
 *
 * colspanで結合された列の一部だけを移動したり、結合範囲の途中へ別の列を挿入したりしないことを
 * テーブル全体で保証する。
 */

import type { ReorderDestination, ReorderTarget } from '@/reorder/dnd-interaction';
import { isBoundaryInsideRange } from '@/reorder/drop-target-rules';
import type { TableStructure } from '@/reorder/table-structure';

/**
 * 移動対象の列が、colspanによって他の列と一体になっているかを判定する。
 *
 * colspanで結合された範囲は1つの構造として保持するため、その範囲に含まれる列は単独では移動できない。
 *
 * @param structure   判定対象となるテーブル構造。
 * @param targetIndex 移動対象として検討している列の位置。
 * @return 移動対象がいずれかのcolspanの結合範囲に含まれる場合は`true`。
 */
const isColumnInsideColSpan = ( structure: TableStructure, targetIndex: number ): boolean => {
	const belongsToMergedColumnRange = Object.values( structure.sections ).some( ( section ) => {
		const sectionContainsTargetInMergedRange =
			section?.rows.some( ( row ) => {
				const rowContainsTargetInMergedRange = row.placements.some( ( placement ) => {
					const targetBelongsToPlacement =
						placement.columnSpan > 1 &&
						targetIndex >= placement.columnStart &&
						targetIndex < placement.columnStart + placement.columnSpan;
					return targetBelongsToPlacement;
				} );
				return rowContainsTargetInMergedRange;
			} ) ?? false;
		return sectionContainsTargetInMergedRange;
	} );
	return belongsToMergedColumnRange;
};

/**
 * 移動先の境界が、colspanで結合された範囲を左右に分断するかを判定する。
 *
 * @param structure 判定対象となるテーブル構造。
 * @param boundary  移動先として検討している列間の境界位置。
 * @return いずれかのcolspanの結合範囲を分断する場合は`true`。
 */
const doesBoundarySplitColSpan = ( structure: TableStructure, boundary: number ): boolean => {
	const splitsMergedColumnRange = Object.values( structure.sections ).some( ( section ) => {
		const sectionContainsSplitBoundary =
			section?.rows.some( ( row ) => {
				const rowContainsSplitBoundary = row.placements.some( ( placement ) => {
					const boundarySplitsPlacement =
						placement.columnSpan > 1 &&
						isBoundaryInsideRange(
							boundary,
							placement.columnStart,
							placement.columnStart + placement.columnSpan - 1
						);
					return boundarySplitsPlacement;
				} );
				return rowContainsSplitBoundary;
			} ) ?? false;
		return sectionContainsSplitBoundary;
	} );
	return splitsMergedColumnRange;
};

/**
 * 列固有の結合セル規則を満たす移動先だけを返す。
 *
 * 移動対象の列または移動先がcolspanの一体性を壊す場合は、列の並び替えを確定しない。
 * 範囲外や順序が変わらない候補など、行・列に共通する妥当性は呼び出し元で確認済みとする。
 *
 * @param structure        列並び替えの基準となるテーブル構造。
 * @param target           今回移動する列。
 * @param destinationIndex 元の列順に対する移動先の境界位置。
 * @return 列固有の規則を満たす移動先。colspanを保持できない場合は`null`。
 */
export const resolveColumnDropTarget = (
	structure: TableStructure,
	target: ReorderTarget,
	destinationIndex: number
): ReorderDestination | null => {
	// colspanで一体化された範囲を壊す移動は確定しない。
	if (
		isColumnInsideColSpan( structure, target.index ) ||
		doesBoundarySplitColSpan( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
