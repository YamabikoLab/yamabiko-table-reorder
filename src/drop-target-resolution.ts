import type { ReorderDestination, ReorderTarget } from './dnd-interaction';
import { createTableStructure, type TableStructure } from './table-structure';
import type { ReorderKind } from './reorder-mode';

/**
 * Drop Target Resolutionへ渡す判定要求。
 */
export type DropTargetResolutionRequest = {
	attributes: Readonly< Record< string, unknown > >;
	blockName: string;
	destinationIndex: number;
	kind: ReorderKind;
	target: ReorderTarget;
};

const isIntegerInRange = ( value: number, min: number, max: number ): boolean =>
	Number.isInteger( value ) && value >= min && value <= max;

const isBoundaryInsideRange = ( boundary: number, start: number, end: number ): boolean =>
	boundary > start && boundary <= end;

const isRowTargetMovable = ( structure: TableStructure, targetIndex: number ): boolean => {
	const body = structure.sections.body;
	if ( body === undefined ) {
		return false;
	}

	return ! body.rows.some( ( row ) =>
		row.placements.some(
			( placement ) =>
				placement.rowSpan > 1 &&
				targetIndex >= row.rowIndex &&
				targetIndex < row.rowIndex + placement.rowSpan
		)
	);
};

const isRowBoundaryValid = ( structure: TableStructure, boundary: number ): boolean => {
	const body = structure.sections.body;
	if ( body === undefined ) {
		return false;
	}

	return ! body.rows.some( ( row ) =>
		row.placements.some(
			( placement ) =>
				placement.rowSpan > 1 &&
				isBoundaryInsideRange(
					boundary,
					row.rowIndex,
					row.rowIndex + placement.rowSpan - 1
				)
		)
	);
};

const isColumnTargetMovable = ( structure: TableStructure, targetIndex: number ): boolean =>
	Object.values( structure.sections ).every( ( section ) =>
		section?.rows.every( ( row ) =>
			row.placements.every(
				( placement ) =>
					placement.columnSpan === 1 ||
					targetIndex < placement.columnStart ||
					targetIndex >= placement.columnStart + placement.columnSpan
			)
		) ?? true
	);

const isColumnBoundaryValid = ( structure: TableStructure, boundary: number ): boolean =>
	Object.values( structure.sections ).every( ( section ) =>
		section?.rows.every( ( row ) =>
			row.placements.every(
				( placement ) =>
					placement.columnSpan === 1 ||
					! isBoundaryInsideRange(
						boundary,
						placement.columnStart,
						placement.columnStart + placement.columnSpan - 1
					)
			)
		) ?? true
	);

const isNoopDestination = ( targetIndex: number, destinationIndex: number ): boolean =>
	destinationIndex === targetIndex || destinationIndex === targetIndex + 1;

/**
 * 現在のTable構造と候補となる行間または列間から、有効なReorder Destinationを返す。
 *
 * destinationの`index`は元のTable順序に対する境界indexであり、0は先頭、要素数と同じ値は
 * 末尾を表す。結合セルを分断する境界、移動できない並び替え対象、同位置へのno-op、
 * 範囲外の候補では`null`を返す。判定中にTableデータは変更しない。
 *
 * @param request 並び替え種別、並び替え対象、候補境界、Table属性。
 */
export const resolveDropTarget = (
	request: DropTargetResolutionRequest
): ReorderDestination | null => {
	const { attributes, blockName, destinationIndex, kind, target } = request;
	const structure = createTableStructure( blockName, attributes );
	if ( structure === null ) {
		return null;
	}

	if ( kind === 'row' ) {
		const body = structure.sections.body;
		if (
			body === undefined ||
			! isIntegerInRange( target.index, 0, body.rows.length - 1 ) ||
			! isIntegerInRange( destinationIndex, 0, body.rows.length ) ||
			isNoopDestination( target.index, destinationIndex ) ||
			! isRowTargetMovable( structure, target.index ) ||
			! isRowBoundaryValid( structure, destinationIndex )
		) {
			return null;
		}
	} else if (
		! isIntegerInRange( target.index, 0, structure.columnCount - 1 ) ||
		! isIntegerInRange( destinationIndex, 0, structure.columnCount ) ||
		isNoopDestination( target.index, destinationIndex ) ||
		! isColumnTargetMovable( structure, target.index ) ||
		! isColumnBoundaryValid( structure, destinationIndex )
	) {
		return null;
	}

	return { index: destinationIndex };
};
