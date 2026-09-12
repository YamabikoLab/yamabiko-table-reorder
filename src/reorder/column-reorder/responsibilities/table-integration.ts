/**
 * 列専用Table Integrationとして、対応Table Block固有の表現差とWordPress Block Editor Storeとの接続を吸収し、Column Reorderへ現在の列制約、RF入力記述、構造診断、反映前評価、確定済み列移動の反映を提供する。
 *
 * このファイルはCore TableとFlexible Table Blockの結合セル属性差、Table全体の論理列解釈、および対応Tableへの列順反映を所有する。
 * Column ReorderとRFへは論理列数、結合セルを分断する挿入位置、最小列記述、blocking merged range、更新対象セル数、反映後の最終列位置、および確定更新だけを公開し、Tableデータや対応Block固有の表現は外へ公開しない。
 * Tableデータや構造結果は保持せず、各要求時点のWordPress Blockを直接参照する。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch, select } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';

/** Column Reorderが現在のTableで移動可否を再照合するために利用する制約情報。 */
export type ColumnReorderConstraints = {
	/** Table全体で共通する現在の論理列数。 */
	columnCount: number;
	/** 結合セルを分断するため移動先にできない0-based列間境界。重複なく昇順で提供する。 */
	blockedBoundaries: readonly number[];
};

/** Column RFが現在Tableの列を識別するために利用する最小列記述。 */
export type ColumnInputDescriptor = {
	/** 現在Table上の0-based論理列位置。 */
	columnIndex: number;
	/** 利用者向けの1-based列番号。 */
	columnNumber: number;
	/** 単一論理列の見出しとして安全に利用できる表示値。 */
	heading: string | null;
};

/** 列移動を成立させない横結合範囲。 */
export type ColumnBlockingMergedRange = {
	/** 0-based・inclusiveの開始論理列。 */
	columnStart: number;
	/** 0-based・inclusiveの終了論理列。 */
	columnEnd: number;
};

/** RF Apply前に現在Tableへ再照合した列移動の評価結果。 */
export type ColumnApplyAssessment = {
	/** 列移動によって表示位置が変わる範囲に含まれる物理セル数。 */
	affectedCellCount: number;
	/** 移動元列を除去した後に移動対象が配置される0-based最終論理列位置。 */
	destinationColumnIndex: number;
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
	/** 対応Table Block上の元セル属性。 */
	cell: Record< string, unknown >;
	/** セルが占有を開始する0-based論理列位置。 */
	columnStart: number;
	/** セルが連続して占有する論理列数。 */
	columnSpan: number;
};

/** 論理列位置を解釈済みの一行。 */
type ParsedRow = {
	/** 対応Table Block上の元行属性。 */
	row: Record< string, unknown >;
	/** 論理列位置を確定済みの物理セル集合。 */
	cells: readonly ParsedCell[];
};

/** 一つのTable sectionを論理列へ解釈した結果。 */
type ParsedSection = {
	/** section内の論理列位置を解釈済みの行集合。 */
	rows: readonly ParsedRow[];
	/** sectionが持つ論理列数。空sectionではnull。 */
	columnCount: number | null;
};

/** Table全体を同一の論理列数で解釈した結果。 */
type ParsedTable = {
	/** head・body・footそれぞれの論理列解析結果。 */
	sections: Record< TableSectionName, ParsedSection >;
	/** Table全sectionで共通する論理列数。 */
	columnCount: number;
	/** 横結合を分断するため移動先にできない列間境界。 */
	blockedBoundaries: readonly number[];
	/** 構造拒否理由として公開できる一意な横結合範囲。 */
	mergedRanges: readonly ColumnBlockingMergedRange[];
};

/** 要求時点の対応Tableと論理列解析結果。 */
type CurrentColumnTable = {
	/** 更新対象となる要求時点のTable属性。 */
	attributes: Record< string, unknown >;
	/** 同じ属性から確定した方向固有の論理列構造。 */
	parsedTable: ParsedTable;
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
	/* 対応Blockごとに異なる属性名はこの境界で吸収し、方向固有ロジックへ公開しない。 */
	const coreProperty = direction === 'row' ? 'rowspan' : 'colspan';
	const flexibleProperty = direction === 'row' ? 'rowSpan' : 'colSpan';
	const property = tableName === 'core/table' ? coreProperty : flexibleProperty;
	const rawSpan = cell[ property ];

	/* 結合指定のない通常セルは一つの行または列だけを占有する。 */
	if ( rawSpan === undefined ) {
		return 1;
	}
	/* 占有数として解釈できない値を含むTableは論理列構造を提供しない。 */
	if ( typeof rawSpan !== 'number' && typeof rawSpan !== 'string' ) {
		return null;
	}

	const span = Number( rawSpan );
	/* 結合セルの占有数は1以上の整数だけを有効とする。 */
	const normalizedSpan = Number.isInteger( span ) && span >= 1 ? span : null;
	return normalizedSpan;
};

/**
 * 一行内で既存の縦結合を分断せず新しいセルを配置できる次の論理列位置を解決する。
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

	/* rowspanで既に占有されている列を避け、現在セルが必要とする連続論理列を確保できる位置まで探索する。 */
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
 * @param tableName         対応Table Block種別。
 * @param sectionRows       対象sectionの未検証行集合。
 * @param blockedBoundaries colspanを分断する列間境界を集約する集合。
 * @return 論理列位置を解釈済みのsection。安全に解釈できない場合はnull。
 */
const parseSection = (
	tableName: SupportedTable,
	sectionRows: readonly unknown[],
	blockedBoundaries: Set< number >
): ParsedSection | null => {
	/* 空sectionはTable全体の論理列数を決めないが、存在自体は有効として扱う。 */
	if ( sectionRows.length === 0 ) {
		return { rows: [], columnCount: null };
	}

	let occupied: boolean[][] | undefined;
	const parsedRows: ParsedRow[] = [];

	/* section内の各行を、rowspanで前行から占有される列を含めた論理グリッドへ順に配置する。 */
	for ( let rowIndex = 0; rowIndex < sectionRows.length; rowIndex++ ) {
		const row = sectionRows[ rowIndex ];
		/* 行をセル集合として解釈できない場合はsection全体を安全に解析できない。 */
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const parsedCells: ParsedCell[] = [];
		let searchFrom = 0;

		/* 各物理セルを既存の縦結合と重ならない論理列位置へ配置する。 */
		for ( const cell of row.cells ) {
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = getCellSpan( tableName, cell, 'row' );
			const columnSpan = getCellSpan( tableName, cell, 'column' );
			/* 無効な結合、またはsection末尾を越える縦結合を含む場合は論理グリッドを提供しない。 */
			if ( rowSpan === null || columnSpan === null || rowIndex + rowSpan > sectionRows.length ) {
				return null;
			}

			if ( occupied === undefined ) {
				occupied = Array.from( { length: sectionRows.length }, () => [] );
			}
			const columnStart = findAvailableColumnStart( occupied[ rowIndex ], searchFrom, columnSpan );

			/* セルが占有する全行・全列を論理グリッドへ登録し、後続セルや後続行が同じ位置を利用しないようにする。 */
			for ( let occupiedRow = rowIndex; occupiedRow < rowIndex + rowSpan; occupiedRow++ ) {
				for (
					let occupiedColumn = columnStart;
					occupiedColumn < columnStart + columnSpan;
					occupiedColumn++
				) {
					occupied[ occupiedRow ][ occupiedColumn ] = true;
				}
			}

			/* 横結合セル内部の列間境界は、そのセルを分断するため移動先として禁止する。 */
			for ( let boundary = columnStart + 1; boundary < columnStart + columnSpan; boundary++ ) {
				blockedBoundaries.add( boundary );
			}

			parsedCells.push( { cell, columnStart, columnSpan } );
			searchFrom = columnStart + columnSpan;
		}

		parsedRows.push( { row, cells: parsedCells } );
	}

	/* 物理セルが一つもないsectionは論理列構造として利用できない。 */
	if ( occupied === undefined ) {
		return null;
	}

	const firstRowColumnCount = occupied[ 0 ].length;
	if ( firstRowColumnCount === 0 ) {
		return null;
	}

	/* section内の全行が同じ論理列数を持ち、論理グリッドに欠損がないことを確認する。 */
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
 * @param tableName  対応Table Block種別。
 * @param attributes 対応Table Blockの未検証属性。
 * @return Table全体の論理列構造。安全に解釈できない場合はnull。
 */
const parseTable = (
	tableName: SupportedTable,
	attributes: Record< string, unknown >
): ParsedTable | null => {
	const body = attributes.body;
	/* bodyを行集合として解釈できないTableは列方向の提供対象にしない。 */
	if ( ! Array.isArray( body ) ) {
		return null;
	}

	const rawSections: Record< TableSectionName, readonly unknown[] > = {
		head: [],
		body,
		foot: [],
	};

	/* 任意sectionが存在する場合は、bodyと同じく行集合として安全に解釈できることを要求する。 */
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

	/* 全sectionを同じ論理列数で解釈できる場合だけ、Table全体の列構造として確定する。 */
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

	/* どのsectionにも論理列が存在しないTableは列選択・列移動の対象にできない。 */
	if ( columnCount === null ) {
		return null;
	}

	const mergedRanges = new Map< string, ColumnBlockingMergedRange >();
	/* 全sectionの横結合セルから、診断に利用する一意な論理列範囲を確定する。 */
	for ( const sectionName of TABLE_SECTIONS ) {
		for ( const parsedRow of sections[ sectionName ].rows ) {
			for ( const parsedCell of parsedRow.cells ) {
				/* 通常セルは列間境界を塞がないため、構造拒否範囲として公開しない。 */
				if ( parsedCell.columnSpan === 1 ) {
					continue;
				}
				const columnEnd = parsedCell.columnStart + parsedCell.columnSpan - 1;
				mergedRanges.set( `${ parsedCell.columnStart }:${ columnEnd }`, {
					columnStart: parsedCell.columnStart,
					columnEnd,
				} );
			}
		}
	}

	return {
		sections,
		columnCount,
		blockedBoundaries: [ ...blockedBoundaries ].sort( ( left, right ) => left - right ),
		mergedRanges: [ ...mergedRanges.values() ].sort(
			( left, right ) => left.columnStart - right.columnStart || left.columnEnd - right.columnEnd
		),
	};
};

/**
 * 要求時点の対応Tableと論理列構造を取得する。
 *
 * @param clientId 対象Table個体を識別するclientId。
 * @return 現在Tableと解析結果。対象Blockの不在、非対応、または解析不能時はnull。
 */
const getCurrentColumnTable = ( clientId: string ): CurrentColumnTable | null => {
	const block = select( blockEditorStore ).getBlock( clientId );
	/* 対象Blockが存在しない、非対応、または属性を解釈できない場合は現在Tableとして利用しない。 */
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const parsedTable = parseTable( block.name, block.attributes );
	/* Table全体を同じ論理列構造として解析できない場合は、部分的な情報を外へ公開しない。 */
	if ( parsedTable === null ) {
		return null;
	}

	return {
		attributes: block.attributes,
		parsedTable,
	};
};

/**
 * 要求時点の対応TableからColumn Reorderが移動可否の再照合に利用する制約情報を取得する。
 *
 * @param clientId 対象Table個体を識別するclientId。
 * @return 現在の論理列数と分断不可境界。現在のTableを安全に解釈できない場合はnull。
 */
const getConstraints = ( clientId: string ): ColumnReorderConstraints | null => {
	const currentTable = getCurrentColumnTable( clientId );
	if ( currentTable === null ) {
		return null;
	}

	return {
		columnCount: currentTable.parsedTable.columnCount,
		blockedBoundaries: currentTable.parsedTable.blockedBoundaries,
	};
};

/**
 * 見出しセルの内容を、RFで単一列を識別する表示値として利用できる場合だけ取得する。
 *
 * 実HTML markupを含むRichText保存表現は解釈せず列番号fallbackへ委ね、HTML entityだけWordPressの変換APIで利用者向け文字へ復元する。
 *
 * @param cell 明示的なhead sectionの単一論理列セル。
 * @return 空でない表示用見出し。安全に表示値へ変換できない場合はnull。
 */
const getHeadingValue = ( cell: Record< string, unknown > ): string | null => {
	/* 文字列として安定して扱えないcontentは列見出しとして公開しない。 */
	if ( typeof cell.content !== 'string' ) {
		return null;
	}

	const content = cell.content.trim();
	/* 空白だけの見出しは利用者が列を識別できないため、見出しなしとして扱う。 */
	if ( content.length === 0 ) {
		return null;
	}
	/* 実HTML markupを含む保存表現はTable Integrationで独自解釈せず、列番号fallbackへ委ねる。 */
	if ( content.includes( '<' ) ) {
		return null;
	}

	const heading = decodeEntities( content ).trim();
	const usableHeading = heading.length === 0 ? null : heading;
	return usableHeading;
};

/**
 * Column RFが現在Tableの論理列を選択するための最小列記述を取得する。
 *
 * 見出しは明示的なhead sectionが一行で、対象セルが一つの論理列だけを占有するときだけ利用する。
 * body先頭行を見出しとして推測せず、複数行headや横結合見出しでは列番号fallbackをPresentationへ委ねる。
 *
 * @param clientId 対象Table個体を識別するclientId。
 * @return 現在の論理列ごとの最小記述。現在Tableを安全に解析できない場合はnull。
 */
const getColumnInputDescriptors = ( clientId: string ): readonly ColumnInputDescriptor[] | null => {
	const currentTable = getCurrentColumnTable( clientId );
	/* 現在Tableを安全に解析できない場合は、列Identityだけを推測して返さない。 */
	if ( currentTable === null ) {
		return null;
	}

	const descriptors: ColumnInputDescriptor[] = Array.from(
		{ length: currentTable.parsedTable.columnCount },
		( _, columnIndex ) => ( {
			columnIndex,
			columnNumber: columnIndex + 1,
			heading: null,
		} )
	);
	const headRows = currentTable.parsedTable.sections.head.rows;
	/* 複数行headでは単一列の安定した表示値を決めず、列番号fallbackをPresentationへ委ねる。 */
	if ( headRows.length !== 1 ) {
		return descriptors;
	}

	/* 単一行headのうち、一つの論理列だけを占有するセルをその列の見出し候補として利用する。 */
	for ( const parsedCell of headRows[ 0 ].cells ) {
		/* 横結合見出しは複数論理列へ同じ表示値を割り当てることになるため、単一列見出しとして公開しない。 */
		if ( parsedCell.columnSpan !== 1 ) {
			continue;
		}
		descriptors[ parsedCell.columnStart ] = {
			columnIndex: parsedCell.columnStart,
			columnNumber: parsedCell.columnStart + 1,
			heading: getHeadingValue( parsedCell.cell ),
		};
	}

	return descriptors;
};

/**
 * 現在の論理列構造に対して移動候補が成立するか方向固有ルールで判定する。
 *
 * @param parsedTable 要求時点の論理Table解析結果。
 * @param move        現在のTableを基準とする列移動。
 * @return source・destination・結合セル制約をすべて満たす場合はtrue。
 */
const isColumnMoveAllowed = ( parsedTable: ParsedTable, move: ColumnMove ): boolean => {
	const sourceInRange =
		Number.isInteger( move.sourceColumnIndex ) &&
		move.sourceColumnIndex >= 0 &&
		move.sourceColumnIndex < parsedTable.columnCount;
	const destinationInRange =
		Number.isInteger( move.destinationBoundaryIndex ) &&
		move.destinationBoundaryIndex >= 0 &&
		move.destinationBoundaryIndex <= parsedTable.columnCount;
	/* 現在Table上に存在しない移動元または移動先は、解決済み候補として成立しない。 */
	if ( ! sourceInRange || ! destinationInRange ) {
		return false;
	}

	const sourceBlockedByMergedRange =
		parsedTable.blockedBoundaries.includes( move.sourceColumnIndex ) ||
		parsedTable.blockedBoundaries.includes( move.sourceColumnIndex + 1 );
	const destinationBlockedByMergedRange = parsedTable.blockedBoundaries.includes(
		move.destinationBoundaryIndex
	);
	const moveAllowed = ! sourceBlockedByMergedRange && ! destinationBlockedByMergedRange;
	return moveAllowed;
};

/**
 * 列移動を成立させない最初の横結合範囲を取得する。
 *
 * source側をdestination側より優先し、同じ側では開始論理列が小さい範囲を優先する。
 *
 * @param move 現在のTableを基準とする列移動。
 * @return 候補を妨げる0-based・両端inclusiveの論理列範囲。構造拒否がない場合はnull。
 */
const getBlockingMergedRange = ( move: ColumnMove ): ColumnBlockingMergedRange | null => {
	const currentTable = getCurrentColumnTable( move.clientId );
	/* 診断元となる現在Tableを解析できない場合は、横結合範囲を推測しない。 */
	if ( currentTable === null ) {
		return null;
	}

	const sourceRange = currentTable.parsedTable.mergedRanges.find(
		( range ) =>
			move.sourceColumnIndex >= range.columnStart && move.sourceColumnIndex <= range.columnEnd
	);
	/* 移動元の構造拒否を利用者へ先に示せるよう、移動先よりsource側を優先する。 */
	if ( sourceRange !== undefined ) {
		return sourceRange;
	}

	const destinationRange = currentTable.parsedTable.mergedRanges.find(
		( range ) =>
			move.destinationBoundaryIndex > range.columnStart &&
			move.destinationBoundaryIndex <= range.columnEnd
	);
	const blockingRange = destinationRange ?? null;
	return blockingRange;
};

/**
 * 移動前の列間境界を、移動元除去後の最終論理列位置へ解釈する。
 *
 * Assessmentと確定更新が同じ方向固有Move意味を利用するため、この境界を列移動の正本とする。
 *
 * @param sourceColumnIndex        現在Table上の0-based移動元論理列位置。
 * @param destinationBoundaryIndex 現在Table上の0-based移動先列間境界。
 * @return 移動対象が反映後に配置される0-based論理列位置。
 */
const resolveDestinationColumnIndex = (
	sourceColumnIndex: number,
	destinationBoundaryIndex: number
): number => {
	const destinationColumnIndex =
		destinationBoundaryIndex > sourceColumnIndex
			? destinationBoundaryIndex - 1
			: destinationBoundaryIndex;
	return destinationColumnIndex;
};

/**
 * 列移動によって表示位置が変わる論理範囲に含まれる物理セル数を、解析済みTableから取得する。
 *
 * @param parsedTable 要求時点の論理Table解析結果。
 * @param move        現在のTableを基準とする列移動。
 * @return 今回の移動に含まれる物理セル数。
 */
const countAffectedCells = ( parsedTable: ParsedTable, move: ColumnMove ): number => {
	const destinationColumnIndex = resolveDestinationColumnIndex(
		move.sourceColumnIndex,
		move.destinationBoundaryIndex
	);
	const start = Math.min( move.sourceColumnIndex, destinationColumnIndex );
	const end = Math.max( move.sourceColumnIndex, destinationColumnIndex );
	let affectedCellCount = 0;

	/* 表示位置が変わる論理列範囲と交差する物理セルを、結合セルの論理占有数へ展開せず数える。 */
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
 * 列移動によって表示位置が変わる論理範囲に含まれる物理セル数を取得する。
 *
 * colspan / rowspanによる論理占有数へ展開せず、影響範囲と交差するTable属性上のcell objectを各1セルとして数える。
 * 対象Tableまたは移動候補を現在構造へ安全に照合できない場合はnullを返す。
 *
 * @param move 現在のTableを基準とする列移動。
 * @return 今回の移動に含まれる物理セル数。安全に評価できない場合はnull。
 */
const getAffectedCellCount = ( move: ColumnMove ): number | null => {
	const currentTable = getCurrentColumnTable( move.clientId );
	/* DnD候補を現在構造へ再照合できない場合は、更新対象セル数を提供しない。 */
	if ( currentTable === null || ! isColumnMoveAllowed( currentTable.parsedTable, move ) ) {
		return null;
	}

	return countAffectedCells( currentTable.parsedTable, move );
};

/**
 * RF Apply前に、解決済み列移動を要求時点の現在Tableへ再照合する。
 *
 * @param move RFで解決済みの列移動候補。
 * @return 現在も候補が成立する場合は更新対象セル数と反映後の最終列位置。成立しない場合はnull。
 */
const assessColumnMoveForApply = ( move: ColumnMove ): ColumnApplyAssessment | null => {
	const currentTable = getCurrentColumnTable( move.clientId );
	/* RF候補が現在Tableで成立しない場合は、反映経路へ進める評価結果を返さない。 */
	if ( currentTable === null || ! isColumnMoveAllowed( currentTable.parsedTable, move ) ) {
		return null;
	}

	return {
		affectedCellCount: countAffectedCells( currentTable.parsedTable, move ),
		destinationColumnIndex: resolveDestinationColumnIndex(
			move.sourceColumnIndex,
			move.destinationBoundaryIndex
		),
	};
};

/**
 * 移動前の論理列位置から確定済み列移動後の論理列位置への対応を作成する。
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
	const destinationColumnIndex = resolveDestinationColumnIndex(
		sourceColumnIndex,
		destinationBoundaryIndex
	);
	reorderedColumns.splice( destinationColumnIndex, 0, sourceColumn );

	const positionMap = Array< number >( columnCount );
	/* 各移動前論理列が確定後に占める位置を逆引きできる対応へ変換する。 */
	reorderedColumns.forEach( ( originalColumnIndex, newColumnIndex ) => {
		positionMap[ originalColumnIndex ] = newColumnIndex;
	} );
	return positionMap;
};

/**
 * 一つの行について各セルが占有する論理列の移動後位置に従って物理セル順を並べ替える。
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
 * 確定済み列移動を要求時点の対応Tableへ一つの属性更新として反映する。
 *
 * assessment後の外部変更を成立保証として扱わず、更新直前にsource・destination・結合セル制約を現在Tableへ再照合する。
 *
 * @param move 更新直前のTable構造を基準とする確定済み列移動。
 * @return 現在も安全に更新できた場合はtrue、外部状態変化等で更新できない場合はfalse。
 */
const applyColumnMove = ( move: ColumnMove ): boolean => {
	const currentTable = getCurrentColumnTable( move.clientId );
	/* assessment結果を成立保証にせず、更新直前の現在Tableで成立しない候補は反映しない。 */
	if ( currentTable === null || ! isColumnMoveAllowed( currentTable.parsedTable, move ) ) {
		return false;
	}

	const positionMap = createColumnPositionMap(
		currentTable.parsedTable.columnCount,
		move.sourceColumnIndex,
		move.destinationBoundaryIndex
	);
	const updates: Record< string, unknown > = {};

	/* 存在する各sectionへ同じ論理列移動を適用し、一回の属性更新へまとめる。 */
	for ( const sectionName of TABLE_SECTIONS ) {
		const rawSection = currentTable.attributes[ sectionName ];
		if ( rawSection === undefined ) {
			continue;
		}
		updates[ sectionName ] = currentTable.parsedTable.sections[ sectionName ].rows.map(
			( parsedRow ) => reorderRow( parsedRow, positionMap )
		);
	}

	dispatch( blockEditorStore ).updateBlockAttributes( move.clientId, updates );
	return true;
};

/**
 * Column ReorderとRFと対応Table Blockの間を接続する列専用Table Integrationのインタフェース。
 *
 * Core TableとFlexible Table Blockの表現差、論理列解析、およびWordPress Block Editor Storeとの接続はこの責務の内部で吸収する。
 * Tableデータや解析結果は保持せず、RFへは列選択と構造診断・反映判断に必要な最小情報だけを公開する。
 */
export const columnTableIntegration = {
	getConstraints,
	getColumnInputDescriptors,
	getBlockingMergedRange,
	getAffectedCellCount,
	resolveDestinationColumnIndex,
	assessColumnMoveForApply,
	applyColumnMove,
};
