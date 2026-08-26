import type { ReorderDestination, ReorderTarget } from '../reorder/dnd-interaction';
import type { TableStructure } from '../reorder/table-structure';

const isIntegerInRange = ( value: number, min: number, max: number ): boolean =>
	Number.isInteger( value ) && value >= min && value <= max;

const isNoopDestination = ( targetIndex: number, destinationIndex: number ): boolean =>
	destinationIndex === targetIndex || destinationIndex === targetIndex + 1;

const isBoundaryInsideRange = ( boundary: number, start: number, end: number ): boolean =>
	boundary > start && boundary <= end;

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
 * colspanを構成する列やcolspanを分断する境界、範囲外、同位置へのno-opでは`null`を返す。
 *
 * @param structure        - テーブル構造。
 * @param target           - 並び替え対象の列。
 * @param destinationIndex - 列の移動先を示す境界インデックス。
 */
export const resolveColumnDropTarget = (
	structure: TableStructure,
	target: ReorderTarget,
	destinationIndex: number
): ReorderDestination | null => {
	if (
		! isIntegerInRange( target.index, 0, structure.columnCount - 1 ) ||
		! isIntegerInRange( destinationIndex, 0, structure.columnCount ) ||
		isNoopDestination( target.index, destinationIndex ) ||
		isColumnInsideColSpan( structure, target.index ) ||
		doesBoundarySplitColSpan( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
