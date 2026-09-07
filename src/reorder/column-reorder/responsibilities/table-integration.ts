/**
 * 列専用Table Integrationとして、対応Table Block固有の表現差とWordPress Block Editor Storeとの接続を吸収し、Column Reorderへ現在の列制約取得と確定済み列移動の反映を提供する。
 *
 * このファイルはCore TableとFlexible Table Blockの結合セル属性差、Table全体の論理列解釈、および対応Tableへの列順反映を所有する。
 * Column Reorderへは論理列数、単独移動できない列、結合セルを分断する挿入位置だけを公開し、Tableデータや対応Block固有の表現は外へ公開しない。
 * Tableデータや構造結果は保持せず、各要求時点のWordPress Blockを直接参照する。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch, select } from '@wordpress/data';

/** Column Reorderが現在のTableで移動可否を再照合するために利用する制約情報。 */
export type ColumnReorderConstraints = {
	/** Table全体で共通する現在の論理列数。 */
	columnCount: number;
	/** colspanに含まれるため単独移動できない0-based論理列位置。重複なく昇順で提供する。 */
	blockedColumnIndexes: readonly number[];
	/** 結合セルを分断するため移動先にできない0-based列間境界。重複なく昇順で提供する。 */
	blockedBoundaries: readonly number[];
};

/** Table Integrationが現在のTableへ反映する、再照合済みの確定済み列移動。 */
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
	blockedColumnIndexes: readonly number[];
	blockedBoundaries: readonly number[];
};

/** 列専用Table Integrationが受理する対応Table Block名。 */
const SUPPORTED_TABLES = new Set< string >( [ 'core/table', 'flexible-table-block/table' ] );

/** Table全体で列順更新を行うsection順。 */
const TABLE_SECTIONS: readonly TableSectionName[] = [ 'head', 'body', 'foot' ];

/**
 * 外部から取得したTableデータを、属性・行・セルとして解釈可能か判定する。
 *
 * 配列やnullなど、キーを持つTable要素として扱えない値は解釈対象にしない。
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
 * @param cell      対応Table Blockから取得した未検証のセル属性。
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

	/* 結合指定のない通常セルは対象方向を1つだけ占有する。 */
	if ( rawSpan === undefined ) {
		return 1;
	}
	/* 結合数として解釈できない値を含むTableは、安全な列制約を提供できない。 */
	if ( typeof rawSpan !== 'number' && typeof rawSpan !== 'string' ) {
		return null;
	}

	const span = Number( rawSpan );
	const normalizedSpan = Number.isInteger( span ) && span >= 1 ? span : null;
	return normalizedSpan;
};

/**
 * 一行内で、既存の縦結合を分断せず新しいセルを配置できる次の論理列位置を解決する。
 *
 * @param occupied        現在行で既に他セルが占有している論理列。
 * @param searchFrom      現在行で次のセル探索を開始する論理列位置。
 * @param requiredColumns 配置するセルが連続して必要とする論理列数。
 * @return 必要な連続列を確保できる最初の論理列位置。
 */
const findAvailableColumnStart = (
	occupied: readonly boolean[],
	searchFrom: number,
	requiredColumns: number
): number => {
	let columnStart = searchFrom;

	/* 先行するrowspanを避けながら、セル全体を連続して置ける最初の論理列位置を確定する。 */
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
 * rowspanによって後続行から物理セルが省略される場合も同じ論理列位置へ復元し、各行が同一列数の欠けのないTable gridとして成立することを要求する。
 *
 * @param tableName            対応Table Block種別。
 * @param sectionRows          対象sectionの未検証行集合。
 * @param blockedColumnIndexes colspanにより単独移動できない列を集約する集合。
 * @param blockedBoundaries    colspanを分断する列間境界を集約する集合。
 * @return 論理列位置を解釈済みのsection。安全に解釈できない場合はnull。
 */
const parseSection = (
	tableName: SupportedTable,
	sectionRows: readonly unknown[],
	blockedColumnIndexes: Set< number >,
	blockedBoundaries: Set< number >
): ParsedSection | null => {
	if ( sectionRows.length === 0 ) {
		return { rows: [], columnCount: null };
	}

	const occupied: boolean[][] = Array.from( { length: sectionRows.length }, () => [] );
	const parsedRows: ParsedRow[] = [];

	/* section内の全行を同一の論理Table gridへ配置し、rowspanによる後続行の占有も含めて列位置を確定する。 */
	for ( let rowIndex = 0; rowIndex < sectionRows.length; rowIndex++ ) {
		const row = sectionRows[ rowIndex ];
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const parsedCells: ParsedCell[] = [];
		let searchFrom = 0;

		/* 物理セル順を保ったまま、既存の縦結合を避けて各セルの論理列範囲を確定する。 */
		for ( const cell of row.cells ) {
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = getCellSpan( tableName, cell, 'row' );
			const columnSpan = getCellSpan( tableName, cell, 'column' );
			/* 結合範囲を安全に確定できないセルはTable全体の列構造を利用不能にする。 */
			if ( rowSpan === null || columnSpan === null || rowIndex + rowSpan > sectionRows.length ) {
				return null;
			}

			const columnStart = findAvailableColumnStart( occupied[ rowIndex ], searchFrom, columnSpan );

			/* セルが占有する全行・全列を予約し、後続セルおよび後続行が同じ論理位置へ重ならないようにする。 */
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
				/* colspanに含まれる各論理列は、結合セルを保ったまま単独で移動できない。 */
				for (
					let columnIndex = columnStart;
					columnIndex < columnStart + columnSpan;
					columnIndex++
				) {
					blockedColumnIndexes.add( columnIndex );
				}
				/* colspan内部の列間境界へ挿入すると結合セルを分断するため、移動先として禁止する。 */
				for ( let boundary = columnStart + 1; boundary < columnStart + columnSpan; boundary++ ) {
					blockedBoundaries.add( boundary );
				}
			}

			parsedCells.push( { cell, columnStart, columnSpan } );
			searchFrom = columnStart + columnSpan;
		}

		parsedRows.push( { row, cells: parsedCells } );
	}

	const firstRowColumnCount = occupied[ 0 ].length;
	/* 行が存在するsectionは1列以上の欠けのない論理Tableとして成立することを要求する。 */
	if ( firstRowColumnCount === 0 ) {
		return null;
	}

	/* 各行で論理列数と占有状態が一致しないTableは、Table全体の一つの列順として安全に扱えない。 */
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
 * bodyは対応Tableの必須sectionとして配列であることを要求する。headとfootは省略または空配列を許容する。
 * 一つでも安全に解釈できないsection、またはsection間で論理列数が一致しないTableは利用不能とする。
 *
 * @param tableName  対応Table Block種別。
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

	const blockedColumnIndexes = new Set< number >();
	const blockedBoundaries = new Set< number >();
	const sections = {} as Record< TableSectionName, ParsedSection >;
	let columnCount: number | null = null;

	/* head・body・footを同じ論理列基準へ解釈し、Table全体で列数と結合セル制約が一致して利用できる状態を確定する。 */
	for ( const sectionName of TABLE_SECTIONS ) {
		const parsedSection = parseSection(
			tableName,
			rawSections[ sectionName ],
			blockedColumnIndexes,
			blockedBoundaries
		);
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
		blockedColumnIndexes: [ ...blockedColumnIndexes ].sort( ( left, right ) => left - right ),
		blockedBoundaries: [ ...blockedBoundaries ].sort( ( left, right ) => left - right ),
	};
};

/**
 * 要求時点の対応Tableから、Column Reorderが移動可否の再照合に利用する制約情報を取得する。
 *
 * 対象Blockの不在、非対応、またはTable全体を安全に一つの論理列構造として解釈できない状態は外部状態による正常な利用不能として扱い、nullを返す。
 *
 * @param clientId 対象Table個体を識別するclientId。
 * @return 現在の論理列数、単独移動不可列、分断不可境界。現在のTableを安全に解釈できない場合はnull。
 */
const getConstraints = ( clientId: string ): ColumnReorderConstraints | null => {
	const block = select( blockEditorStore ).getBlock( clientId );
	/* 対象Blockが存在しない、非対応、または属性を解釈できない状態では、Table Integrationの提供対象外として正常な不在にする。 */
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const parsedTable = parseTable( block.name, block.attributes );
	if ( parsedTable === null ) {
		return null;
	}

	return {
		columnCount: parsedTable.columnCount,
		blockedColumnIndexes: parsedTable.blockedColumnIndexes,
		blockedBoundaries: parsedTable.blockedBoundaries,
	};
};

/**
 * 移動前の論理列位置から、確定済み列移動後の論理列位置への対応を作成する。
 *
 * @param columnCount              更新直前のTable全体の論理列数。
 * @param sourceColumnIndex        更新直前の移動元論理列位置。
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
 * 一つの行について、各セルが占有する論理列の移動後位置に従って物理セル順を並べ替える。
 *
 * @param parsedRow   移動前の論理列位置を解釈済みの行。
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
 * 確定済み列移動を、要求時点の対応Tableへ一つの属性更新として反映する。
 *
 * 対象Blockの不在、非対応、Table全体の利用不能、列範囲変化、または現在の結合セル制約と矛盾する移動は外部状態変化として更新しない。
 * 更新可能な場合だけhead・body・footの新しい列順をすべて生成してから一括反映し、部分更新を発生させない。
 *
 * @param move 更新直前のTable構造を基準とする確定済み列移動。
 * @return 現在も安全に更新できた場合はtrue、外部状態変化等で更新できない場合はfalse。
 */
const applyColumnMove = ( move: ColumnMove ): boolean => {
	const block = select( blockEditorStore ).getBlock( move.clientId );
	/* 更新要求時に対象Blockが存在しない、非対応、または属性を解釈できない場合は、外部状態変化として列順を更新しない。 */
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
	/* 確定後に列範囲または結合セル制約が変化した場合は、現在Tableへ確定済み移動を反映しない。 */
	if (
		! sourceInRange ||
		! destinationInRange ||
		parsedTable.blockedColumnIndexes.includes( move.sourceColumnIndex ) ||
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

	/* Table全体の各sectionを同じ列移動へ変換し、すべて成立した結果だけを単一更新へまとめる。 */
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
 * Column Reorderと対応Table Blockの間を接続する、列専用Table Integrationのインタフェース。
 *
 * Core TableとFlexible Table Blockの表現差、Table全体の論理列解釈、およびWordPress Block Editor Storeとの接続はこの責務の内部で吸収する。
 * Tableデータや算出結果は保持せず、Block固有構造も外部へ公開しない。
 */
export const columnTableIntegration = {
	getConstraints,
	applyColumnMove,
};
