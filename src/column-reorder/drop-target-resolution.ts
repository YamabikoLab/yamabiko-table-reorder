import type { ReorderDestination, ReorderTarget } from '../reorder/dnd-interaction';
import { isBoundaryInsideRange } from '../reorder/drop-target-rules';
import type { TableStructure } from '../reorder/table-structure';

const isColumnInsideColSpan = ( structure: TableStructure, targetIndex: number ): boolean =>
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

const doesBoundarySplitColSpan = ( structure: TableStructure, boundary: number ): boolean =>
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
 * 列並び替え固有のDrop Target Resolutionを行う。
 *
 * colspanを構成する列やcolspanを分断する境界では`null`を返す。
 * 共通の範囲外・no-op判定は`reorder/drop-target-resolution.ts`で行う。
 *
 * @param structure        テーブル構造。
 * @param target           並び替え対象の列。
 * @param destinationIndex 列の移動先を示す境界インデックス。
 */
export const resolveColumnDropTarget = (
	structure: TableStructure,
	target: ReorderTarget,
	destinationIndex: number
): ReorderDestination | null => {
	if (
		isColumnInsideColSpan( structure, target.index ) ||
		doesBoundarySplitColSpan( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
