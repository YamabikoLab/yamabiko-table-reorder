import type { ReorderDestination, ReorderTarget } from '../reorder/dnd-interaction';
import { isBoundaryInsideRange } from '../reorder/drop-target-rules';
import type { TableStructure } from '../reorder/table-structure';

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
 * body内の対象行と候補境界を検証し、rowspanを構成する行やrowspanを分断する境界では`null`を返す。
 * 共通の範囲外・no-op判定は`reorder/drop-target-resolution.ts`で行う。
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
	if (
		isRowInsideRowSpan( structure, target.index ) ||
		doesBoundarySplitRowSpan( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
