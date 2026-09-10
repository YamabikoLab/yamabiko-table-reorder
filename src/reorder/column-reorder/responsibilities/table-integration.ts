/**
 * 列専用Table Integrationとして、対応Table Block固有の表現差とWordPress Block Editor Storeとの接続を吸収し、Column Reorderへ現在の列制約取得と確定済み列移動の反映を提供する。
 *
 * このファイルはCore TableとFlexible Table Blockの結合セル属性差、Table全体の論理列解釈、および対応Tableへの列順反映を所有する。
 * Column Reorderへは論理列数と結合セルを分断する挿入位置、および確定候補の更新対象セル数だけを公開し、Tableデータや対応Block固有の表現は外へ公開しない。
 * Tableデータや構造結果は保持せず、各要求時点のWordPress Blockを直接参照する。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch, select } from '@wordpress/data';

/** Column Reorderが現在のTableで移動可否を再照合するために利用する制約情報。 */
export type ColumnReorderConstraints = {
	/** Table全体で共通する現在の論理列数。 */
	columnCount: number;
	/** 結合セルを分断するため移動先にできない0-based列間境界。重複なく昇順で提供する。 */
	blockedBoundaries: readonly number[];
};

/** Table Integrationが解釈または反映する、再照合済みの確定候補となる列移動。 */
type ColumnMove = {
	/** 更新対象のTable個体を識別するclientId。 */
	clientId: string;
	/** 更新直前のTableを基準とする0-based移動元論理列位置。 */
	sourceColumnIndex: number;
	/** 更新直前のTableを基準とする0-based移動先列間境界。 */
	destinationBoundaryIndex: number;
};

/** 列専用Table Integrationが表現差を吸収する対応Table Block種別。 */
type SupportedTable = 'core/table' | 'flexible-table-block/table';

/** Table全体で列順更新の対象となるsection。 */
type TableSectionName = 'head' | 'body' | 'foot';

/** 論理Table上で一つのセルが占有する列位置。 */
type ParsedCell = {
	cell: Record< string, unknown >;
	columnStart: number;
	columnSpan: number;
};

/** 論理列位置を解釈済みの一行。 */
type ParsedRow = {
	row: Record< string, unknown >;
	cells: readonly ParsedCell[];
};

/** 一つのTable sectionを論理列へ解釈した結果。 */
type ParsedSection = {
	rows: readonly ParsedRow[];
	columnCount: number | null;
};

/** Table全体を同一の論理列数で解釈した結果。 */
type ParsedTable = {
	sections: Record< TableSectionName, ParsedSection >;
	columnCount: number;
	blockedBoundaries: readonly number[];
};

/** 列専用Table Integrationが受理する対応Table Block名。 */
const SUPPORTED_TABLES = new Set< string >( [ 'core/table', 'flexible-table-block/table' ] );

/** Table全体で列順更新を行うsection順。 */
const TABLE_SECTIONS: readonly TableSectionName[] = [ 'head', 'body', 'foot' ];

/**
 * 外部から取得したTableデータを、属性・行・セルとして解釈可能か判定する。
 *
 * @param value 対応Table Blockから取得した未検証の値。
 * @return Table要素としてキー参照可能なオブジェクトである場合はtrue。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * Block名が列専用Table Integrationの対応対象か判定する。
 *
 * @param blockName 要求時点のWordPress Block名。
 * @return Core TableまたはFlexible Table Blockとして扱える場合はtrue。
 */
const isSupportedTable = ( blockName: string ): blockName is SupportedTable =>
	SUPPORTED_TABLES.has( blockName );

/**
 * 対応Table Block固有の結合属性を、共通の占有数として解釈する。
 *
 * @param tableName 対応Table Block種別。
 * @param cell 対応Table Blockから取得した未検証のセル属性。
 * @param direction 解釈する結合方向。
 * @return セルが占有する行数または列数。結合指定がない場合は1、占有数として解釈できない場合はnull。
 */
const getCellSpan = (
	tableName: SupportedTable,
	cell: Record< string, unknown >,
	direction: 'row' | 'column'
): number | null => {
	const coreProperty = direction === 'row' ? 'rowspan' : 'colspan';
	const flexibleProperty = direction === 'row' ? 'rowSpan' : 'colSpan';
	const property = tableName === 'core/table' ? coreProperty : flexibleProperty;
	const rawSpan = cell[ property ];

	if ( rawSpan === undefined ) {
		return 1;
	}
	if ( typeof rawSpan !== 'number' && typeof rawSpan !== 'string' ) {
		return null;
	}

	const span = Number( rawSpan );
	const normalizedSpan = Number.isInteger( span ) && span >= 1 ? span : null;
	return normalizedSpan;
};

/**
 * 一行内で既存の縦結合を分断せず新しいセルを配置できる次の論理列位置を解決する。
 *
 * @param occupied 現在行で既に他セルが占有している論理列。
 * @param searchFrom 現在行で次のセル探索を開始する論理列位置。
 * @param requiredColumns 配置するセルが連続して必要とする論理列数。
 * @return 必要な連続列を確保できる最初の論理列位置。
 */
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

/**
 * 一つのTable sectionを論理列へ解釈する。
 *
 * @param tableName 対応Table Block種別。
 * @param sectionRows 対象sectionの未検証行集合。
 * @param blockedBoundaries colspanを分断する列間境界を集約する集合。
 * @return 論理列位置を解釈済みのsection。安全に解釈できない場合はnull。
 */
const parseSection = (
	tableName: SupportedTable,
	sectionRows: readonly unknown[],
	blockedBoundaries: Set< number >
): ParsedSection | null => {
	if ( sectionRows.length === 0 ) {
		return { rows: [], columnCount: null };
	}

	let occupied: boolean[][] | undefined;
	const parsedRows: ParsedRow[] = [];

	for ( let rowIndex = 0; rowIndex < sectionRows.length; rowIndex++ ) {
		const row = sectionRows[ rowIndex ];
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const parsedCells: ParsedCell[] = [];
		let searchFrom = 0;

		for ( const cell of row.cells ) {
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = getCellSpan( tableName, cell, 'row' );
			const columnSpan = getCellSpan( tableName, cell, 'column' );
			if ( rowSpan === null || columnSpan === null || rowIndex + rowSpan > sectionRows.length ) {
				return null;
			}

			if ( occupied === undefined ) {
				occupied = Array.from( { length: sectionRows.length }, () => [] );
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

			for ( let boundary = columnStart + 1; boundary < columnStart + columnSpan; boundary++ ) {
				blockedBoundaries.add( boundary );
			}

			parsedCells.push( { cell, columnStart, columnSpan } );
			searchFrom = columnStart + columnSpan;
		}

		parsedRows.push( { row, cells: parsedCells } );
	}

	if ( occupied === undefined ) {
		return null;
	}

	const firstRowColumnCount = occupied[ 0 ].length;
	if ( firstRowColumnCount === 0 ) {
		return null;
	}

	for ( const occupiedRow of occupied ) {
		if ( occupiedRow.length !== firstRowColumnCount ) {
			return null;
		}
		for ( let columnIndex = 0; columnIndex < firstRowColumnCount; columnIndex++ ) {
			if ( ! occupiedRow[ columnIndex ] ) {
				return null;
			}
		}
	}

	return { rows: parsedRows, columnCount: firstRowColumnCount };
};

/**
 * 対応Table全体を、すべてのsectionで共通する一つの論理列構造として解釈する。
 *
 * @param tableName 対応Table Block種別。
 * @param attributes 対応Table Blockの未検証属性。
 * @return Table全体の論理列構造。安全に解釈できない場合はnull。
 */
const parseTable = (
	tableName: SupportedTable,
	attributes: Record< string, unknown >
): ParsedTable | null => {
	const body = attributes.body;
	if ( ! Array.isArray( body ) ) {
		return null;
	}

	const rawSections: Record< TableSectionName, readonly unknown[] > = {
		head: [],
		body,
		foot: [],
	};

	for ( const optionalSection of [ 'head', 'foot' ] as const ) {
		const rawSection = attributes[ optionalSection ];
		if ( rawSection === undefined ) {
			continue;
		}
		if ( ! Array.isArray( rawSection ) ) {
			return null;
		}
		rawSections[ optionalSection ] = rawSection;
	}

	const blockedBoundaries = new Set< number >();
	const sections = {} as Record< TableSectionName, ParsedSection >;
	let columnCount: number | null = null;

	for ( const sectionName of TABLE_SECTIONS ) {
		const parsedSection = parseSection( tableName, rawSections[ sectionName ], blockedBoundaries );
		if ( parsedSection === null ) {
			return null;
		}
		sections[ sectionName ] = parsedSection;

		if ( parsedSection.columnCount === null ) {
			continue;
		}
		if ( columnCount === null ) {
			columnCount = parsedSection.columnCount;
			continue;
		}
		if ( parsedSection.columnCount !== columnCount ) {
			return null;
		}
	}

	if ( columnCount === null ) {
		return null;
	}

	return {
		sections,
		columnCount,
		blockedBoundaries: [ ...blockedBoundaries ].sort( ( left, right ) => left - right ),
	};
};

/**
 * 要求時点の対応TableからColumn Reorderが移動可否の再照合に利用する制約情報を取得する。
 *
 * @param clientId 対象Table個体を識別するclientId。
 * @return 現在の論理列数と分断不可境界。現在のTableを安全に解釈できない場合はnull。
 */
const getConstraints = ( clientId: string ): ColumnReorderConstraints | null => {
	const block = select( blockEditorStore ).getBlock( clientId );
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const parsedTable = parseTable( block.name, block.attributes );
	if ( parsedTable === null ) {
		return null;
	}

	return {
		columnCount: parsedTable.columnCount,
		blockedBoundaries: parsedTable.blockedBoundaries,
	};
};

/**
 * 列移動によって表示位置が変わる論理範囲に含まれる物理セル数を取得する。
 *
 * colspan / rowspanによる論理占有数へ展開せず、影響範囲と交差するTable属性上のcell objectを各1セルとして数える。
 * 対象Tableまたは移動範囲を安全に解釈できない場合はnullを返す。
 *
 * @param move 現在のTableを基準とする列移動。
 * @return 今回の移動に含まれる物理セル数。安全に解釈できない場合はnull。
 */
const getAffectedCellCount = ( move: ColumnMove ): number | null => {
	const block = select( blockEditorStore ).getBlock( move.clientId );
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const parsedTable = parseTable( block.name, block.attributes );
	if ( parsedTable === null ) {
		return null;
	}

	const sourceInRange =
		Number.isInteger( move.sourceColumnIndex ) &&
		move.sourceColumnIndex >= 0 &&
		move.sourceColumnIndex < parsedTable.columnCount;
	const destinationInRange =
		Number.isInteger( move.destinationBoundaryIndex ) &&
		move.destinationBoundaryIndex >= 0 &&
		move.destinationBoundaryIndex <= parsedTable.columnCount;
	const sourceBlockedByMergedRange =
		parsedTable.blockedBoundaries.includes( move.sourceColumnIndex ) ||
		parsedTable.blockedBoundaries.includes( move.sourceColumnIndex + 1 );
	if (
		! sourceInRange ||
		! destinationInRange ||
		sourceBlockedByMergedRange ||
		parsedTable.blockedBoundaries.includes( move.destinationBoundaryIndex )
	) {
		return null;
	}

	const insertionIndex =
		move.destinationBoundaryIndex > move.sourceColumnIndex
			? move.destinationBoundaryIndex - 1
			: move.destinationBoundaryIndex;
	const start = Math.min( move.sourceColumnIndex, insertionIndex );
	const end = Math.max( move.sourceColumnIndex, insertionIndex );
	let affectedCellCount = 0;

	for ( const sectionName of TABLE_SECTIONS ) {
		for ( const parsedRow of parsedTable.sections[ sectionName ].rows ) {
			for ( const parsedCell of parsedRow.cells ) {
				const cellEnd = parsedCell.columnStart + parsedCell.columnSpan - 1;
				const intersectsAffectedRange = parsedCell.columnStart <= end && cellEnd >= start;
				if ( intersectsAffectedRange ) {
					affectedCellCount++;
				}
			}
		}
	}

	return affectedCellCount;
};

/**
 * 移動前の論理列位置から確定済み列移動後の論理列位置への対応を作成する。
 *
 * @param columnCount 更新直前のTable全体の論理列数。
 * @param sourceColumnIndex 更新直前の移動元論理列位置。
 * @param destinationBoundaryIndex 更新直前の移動先列間境界。
 * @return 移動前の各論理列位置に対応する移動後の0-based論理列位置。
 */
const createColumnPositionMap = (
	columnCount: number,
	sourceColumnIndex: number,
	destinationBoundaryIndex: number
): readonly number[] => {
	const reorderedColumns = Array.from( { length: columnCount }, ( _, index ) => index );
	const [ sourceColumn ] = reorderedColumns.splice( sourceColumnIndex, 1 );
	const insertionIndex =
		destinationBoundaryIndex > sourceColumnIndex
			? destinationBoundaryIndex - 1
			: destinationBoundaryIndex;
	reorderedColumns.splice( insertionIndex, 0, sourceColumn );

	const positionMap = Array< number >( columnCount );
	reorderedColumns.forEach( ( originalColumnIndex, newColumnIndex ) => {
		positionMap[ originalColumnIndex ] = newColumnIndex;
	} );
	return positionMap;
};

/**
 * 一つの行について各セルが占有する論理列の移動後位置に従って物理セル順を並べ替える。
 *
 * @param parsedRow 移動前の論理列位置を解釈済みの行。
 * @param positionMap 移動前から移動後への論理列位置対応。
 * @return セル内容・属性を保持したまま列順だけを変更した行。
 */
const reorderRow = (
	parsedRow: ParsedRow,
	positionMap: readonly number[]
): Record< string, unknown > => {
	const reorderedCells = [ ...parsedRow.cells ].sort( ( left, right ) => {
		const leftPosition = positionMap[ left.columnStart ];
		const rightPosition = positionMap[ right.columnStart ];
		return leftPosition - rightPosition;
	} );

	return {
		...parsedRow.row,
		cells: reorderedCells.map( ( parsedCell ) => parsedCell.cell ),
	};
};

/**
 * 確定済み列移動を要求時点の対応Tableへ一つの属性更新として反映する。
 *
 * @param move 更新直前のTable構造を基準とする確定済み列移動。
 * @return 現在も安全に更新できた場合はtrue、外部状態変化等で更新できない場合はfalse。
 */
const applyColumnMove = ( move: ColumnMove ): boolean => {
	const block = select( blockEditorStore ).getBlock( move.clientId );
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return false;
	}

	const parsedTable = parseTable( block.name, block.attributes );
	if ( parsedTable === null ) {
		return false;
	}

	const sourceInRange =
		Number.isInteger( move.sourceColumnIndex ) &&
		move.sourceColumnIndex >= 0 &&
		move.sourceColumnIndex < parsedTable.columnCount;
	const destinationInRange =
		Number.isInteger( move.destinationBoundaryIndex ) &&
		move.destinationBoundaryIndex >= 0 &&
		move.destinationBoundaryIndex <= parsedTable.columnCount;
	const sourceBlockedByMergedRange =
		parsedTable.blockedBoundaries.includes( move.sourceColumnIndex ) ||
		parsedTable.blockedBoundaries.includes( move.sourceColumnIndex + 1 );
	if (
		! sourceInRange ||
		! destinationInRange ||
		sourceBlockedByMergedRange ||
		parsedTable.blockedBoundaries.includes( move.destinationBoundaryIndex )
	) {
		return false;
	}

	const positionMap = createColumnPositionMap(
		parsedTable.columnCount,
		move.sourceColumnIndex,
		move.destinationBoundaryIndex
	);
	const updates: Record< string, unknown > = {};

	for ( const sectionName of TABLE_SECTIONS ) {
		const rawSection = block.attributes[ sectionName ];
		if ( rawSection === undefined ) {
			continue;
		}
		updates[ sectionName ] = parsedTable.sections[ sectionName ].rows.map( ( parsedRow ) =>
			reorderRow( parsedRow, positionMap )
		);
	}

	dispatch( blockEditorStore ).updateBlockAttributes( move.clientId, updates );
	return true;
};

/**
 * Column Reorderと対応Table Blockの間を接続する列専用Table Integrationのインタフェース。
 */
export const columnTableIntegration = {
	getConstraints,
	getAffectedCellCount,
	applyColumnMove,
};
