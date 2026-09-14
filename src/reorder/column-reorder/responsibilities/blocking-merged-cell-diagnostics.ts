/**
 * Column ReorderとColumn RFが利用者向け拒否理由として表示する、Table全section内の結合セル矩形を要求時点のTableから解決する。
 *
 * 高頻度の開始可否表示には利用せず、既存のColumn Table Integrationが構造拒否を確定した後の診断時だけ呼び出す。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { select } from '@wordpress/data';

export type ColumnBlockingMergedCellSection = 'head' | 'body' | 'foot';

export type ColumnBlockingMergedCell = {
	section: ColumnBlockingMergedCellSection;
	rowStart: number;
	rowEnd: number;
	columnStart: number;
	columnEnd: number;
};

type SupportedTable = 'core/table' | 'flexible-table-block/table';

type ColumnMove = {
	clientId: string;
	sourceColumnIndex: number;
	destinationBoundaryIndex: number;
};

const SUPPORTED_TABLES = new Set< string >( [ 'core/table', 'flexible-table-block/table' ] );
const TABLE_SECTIONS: readonly ColumnBlockingMergedCellSection[] = [ 'head', 'body', 'foot' ];

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

const getMergedCells = ( clientId: string ): readonly ColumnBlockingMergedCell[] | null => {
	const block = select( blockEditorStore ).getBlock( clientId );
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const mergedCells: ColumnBlockingMergedCell[] = [];
	for ( const section of TABLE_SECTIONS ) {
		const rawSection = block.attributes[ section ];
		if ( rawSection === undefined && section !== 'body' ) {
			continue;
		}
		if ( ! Array.isArray( rawSection ) ) {
			return null;
		}
		const occupied = Array.from( { length: rawSection.length }, () => [] as boolean[] );

		for ( let rowIndex = 0; rowIndex < rawSection.length; rowIndex++ ) {
			const row = rawSection[ rowIndex ];
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
				if (
					rowSpan === null ||
					columnSpan === null ||
					rowIndex + rowSpan > rawSection.length
				) {
					return null;
				}

				const columnStart = findAvailableColumnStart(
					occupied[ rowIndex ],
					searchFrom,
					columnSpan
				);
				for ( let occupiedRow = rowIndex; occupiedRow < rowIndex + rowSpan; occupiedRow++ ) {
					for (
						let occupiedColumn = columnStart;
						occupiedColumn < columnStart + columnSpan;
						occupiedColumn++
					) {
						occupied[ occupiedRow ][ occupiedColumn ] = true;
					}
				}

				if ( columnSpan > 1 ) {
					mergedCells.push( {
						section,
						rowStart: rowIndex,
						rowEnd: rowIndex + rowSpan - 1,
						columnStart,
						columnEnd: columnStart + columnSpan - 1,
					} );
				}
				searchFrom = columnStart + columnSpan;
			}
		}
	}
	return mergedCells;
};

const getSourceBlockingMergedCell = (
	clientId: string,
	sourceColumnIndex: number
): ColumnBlockingMergedCell | null => {
	const mergedCells = getMergedCells( clientId );
	if ( mergedCells === null ) {
		return null;
	}
	return (
		mergedCells.find(
			( cell ) =>
				sourceColumnIndex >= cell.columnStart && sourceColumnIndex <= cell.columnEnd
		) ?? null
	);
};

const getBlockingMergedCell = ( move: ColumnMove ): ColumnBlockingMergedCell | null => {
	const mergedCells = getMergedCells( move.clientId );
	if ( mergedCells === null ) {
		return null;
	}
	const sourceCell = mergedCells.find(
		( cell ) =>
			move.sourceColumnIndex >= cell.columnStart && move.sourceColumnIndex <= cell.columnEnd
	);
	if ( sourceCell !== undefined ) {
		return sourceCell;
	}
	return (
		mergedCells.find(
			( cell ) =>
				move.destinationBoundaryIndex > cell.columnStart &&
				move.destinationBoundaryIndex <= cell.columnEnd
		) ?? null
	);
};

export const columnBlockingMergedCellDiagnostics = {
	getBlockingMergedCell,
	getSourceBlockingMergedCell,
};
