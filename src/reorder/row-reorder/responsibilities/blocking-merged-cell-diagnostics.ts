/**
 * Row ReorderとRow RFが利用者向け拒否理由として表示する、tbody内の結合セル矩形を要求時点のTableから解決する。
 *
 * 高頻度の開始可否表示には利用せず、既存のRow Table Integrationが構造拒否を確定した後の診断時だけ呼び出す。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { select } from '@wordpress/data';

export type RowBlockingMergedCell = {
	rowStart: number;
	rowEnd: number;
	columnStart: number;
	columnEnd: number;
};

type SupportedTable = 'core/table' | 'flexible-table-block/table';

type RowMove = {
	clientId: string;
	sourceRowIndex: number;
	destinationBoundaryIndex: number;
};

const SUPPORTED_TABLES = new Set< string >( [ 'core/table', 'flexible-table-block/table' ] );

const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

const isSupportedTable = ( blockName: string ): blockName is SupportedTable =>
	SUPPORTED_TABLES.has( blockName );

const getSpan = (
	tableName: SupportedTable,
	cell: Record< string, unknown >,
	direction: 'row' | 'column'
): number | null => {
	const property =
		tableName === 'core/table'
			? direction === 'row'
				? 'rowspan'
				: 'colspan'
			: direction === 'row'
				? 'rowSpan'
				: 'colSpan';
	const rawSpan = cell[ property ];
	if ( rawSpan === undefined ) {
		return 1;
	}
	if ( typeof rawSpan !== 'number' && typeof rawSpan !== 'string' ) {
		return null;
	}
	const span = Number( rawSpan );
	return Number.isInteger( span ) && span >= 1 ? span : null;
};

const findAvailableColumnStart = (
	occupied: readonly boolean[],
	searchFrom: number,
	requiredColumns: number
): number => {
	let columnStart = searchFrom;
	while ( true ) {
		let available = true;
		for ( let offset = 0; offset < requiredColumns; offset++ ) {
			if ( occupied[ columnStart + offset ] ) {
				available = false;
				break;
			}
		}
		if ( available ) {
			return columnStart;
		}
		columnStart++;
	}
};

const getMergedCells = ( clientId: string ): readonly RowBlockingMergedCell[] | null => {
	const block = select( blockEditorStore ).getBlock( clientId );
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}
	const body = block.attributes.body;
	if ( ! Array.isArray( body ) ) {
		return null;
	}

	const occupied = Array.from( { length: body.length }, () => [] as boolean[] );
	const mergedCells: RowBlockingMergedCell[] = [];

	for ( let rowIndex = 0; rowIndex < body.length; rowIndex++ ) {
		const row = body[ rowIndex ];
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}
		let searchFrom = 0;
		for ( const cell of row.cells ) {
			if ( ! isRecord( cell ) ) {
				return null;
			}
			const rowSpan = getSpan( block.name, cell, 'row' );
			const columnSpan = getSpan( block.name, cell, 'column' );
			if ( rowSpan === null || columnSpan === null || rowIndex + rowSpan > body.length ) {
				return null;
			}

			const columnStart = findAvailableColumnStart( occupied[ rowIndex ], searchFrom, columnSpan );
			for ( let occupiedRow = rowIndex; occupiedRow < rowIndex + rowSpan; occupiedRow++ ) {
				for (
					let occupiedColumn = columnStart;
					occupiedColumn < columnStart + columnSpan;
					occupiedColumn++
				) {
					occupied[ occupiedRow ][ occupiedColumn ] = true;
				}
			}

			if ( rowSpan > 1 ) {
				mergedCells.push( {
					rowStart: rowIndex,
					rowEnd: rowIndex + rowSpan - 1,
					columnStart,
					columnEnd: columnStart + columnSpan - 1,
				} );
			}
			searchFrom = columnStart + columnSpan;
		}
	}

	return mergedCells;
};

const getSourceBlockingMergedCell = (
	clientId: string,
	sourceRowIndex: number
): RowBlockingMergedCell | null => {
	const mergedCells = getMergedCells( clientId );
	if ( mergedCells === null ) {
		return null;
	}
	return (
		mergedCells.find(
			( cell ) => sourceRowIndex >= cell.rowStart && sourceRowIndex <= cell.rowEnd
		) ?? null
	);
};

const getBlockingMergedCell = ( move: RowMove ): RowBlockingMergedCell | null => {
	const mergedCells = getMergedCells( move.clientId );
	if ( mergedCells === null ) {
		return null;
	}
	const sourceCell = mergedCells.find(
		( cell ) => move.sourceRowIndex >= cell.rowStart && move.sourceRowIndex <= cell.rowEnd
	);
	if ( sourceCell !== undefined ) {
		return sourceCell;
	}
	return (
		mergedCells.find(
			( cell ) =>
				move.destinationBoundaryIndex > cell.rowStart &&
				move.destinationBoundaryIndex <= cell.rowEnd
		) ?? null
	);
};

export const rowBlockingMergedCellDiagnostics = {
	getBlockingMergedCell,
	getSourceBlockingMergedCell,
};
