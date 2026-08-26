import type { ReorderDestination, ReorderTarget } from '../reorder/dnd-interaction';
import type { TableStructure } from '../reorder/table-structure';

const isIntegerInRange = ( value: number, min: number, max: number ): boolean =>
	Number.isInteger( value ) && value >= min && value <= max;

const isNoopDestination = ( targetIndex: number, destinationIndex: number ): boolean =>
	destinationIndex === targetIndex || destinationIndex === targetIndex + 1;

const isBoundaryInsideRange = ( boundary: number, start: number, end: number ): boolean =>
	boundary > start && boundary <= end;

const isRowInsideRowSpan = ( structure: TableStructure, targetIndex: number ): boolean => {
	const body = structure.sections.body;
	if ( body === undefined ) {
		return false;
	}

	return body.rows.some( ( row ) =>
		row.placements.some(
			( placement ) =>
				placement.rowSpan > 1 &&
				targetIndex >= row.rowIndex &&
				targetIndex < row.rowIndex + placement.rowSpan
		)
	);
};

const doesBoundarySplitRowSpan = ( structure: TableStructure, boundary: number ): boolean => {
	const body = structure.sections.body;
	if ( body === undefined ) {
		return false;
	}

	return body.rows.some( ( row ) =>
		row.placements.some(
			( placement ) =>
				placement.rowSpan > 1 &&
				isBoundaryInsideRange( boundary, row.rowIndex, row.rowIndex + placement.rowSpan - 1 )
		)
	);
};

/**
 * 行並び替え固有のDrop Target Resolutionを行う。
 *
 * body内の対象行と候補境界を検証し、rowspanを構成する行やrowspanを分断する境界、
 * 範囲外、同位置へのno-opでは`null`を返す。
 *
 * @param structure        正規化済みTable構造。
 * @param target           並び替え対象行。
 * @param destinationIndex 元のTable順序に対する候補境界index。
 */
export const resolveRowDropTarget = (
	structure: TableStructure,
	target: ReorderTarget,
	destinationIndex: number
): ReorderDestination | null => {
	const body = structure.sections.body;
	if (
		body === undefined ||
		! isIntegerInRange( target.index, 0, body.rows.length - 1 ) ||
		! isIntegerInRange( destinationIndex, 0, body.rows.length ) ||
		isNoopDestination( target.index, destinationIndex ) ||
		isRowInsideRowSpan( structure, target.index ) ||
		doesBoundarySplitRowSpan( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
