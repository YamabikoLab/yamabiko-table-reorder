/**
 * 行専用Table Integrationとして、対応Table Block固有の表現差とWordPress Block Editor Storeとの接続を吸収し、Row Reorderへ現在のtbody行構造、構造診断、反映前評価、確定済み行移動の反映を提供する。
 *
 * このファイルはCore TableとFlexible Table Blockの結合セル属性差、および対応Tableへの行順反映を所有する。
 * Row ReorderとRFへは現在行数、rowspanを分断できない挿入位置、blocking merged cellの位置、更新対象セル数、反映後の最終行位置、および確定更新だけを公開し、Tableデータや対応Block固有の表現は外へ公開しない。
 * Tableデータや構造結果は保持せず、各要求時点のWordPress Blockを直接参照する。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch, select } from '@wordpress/data';

/** Row Reorderが現在のTableで移動可否を再照合するために利用する制約情報。 */
export type RowReorderConstraints = {
	/** tbodyの現在行数。 */
	rowCount: number;
	/** rowspanを分断するため移動先にできない0-based挿入位置。重複なく昇順で提供する。 */
	blockedBoundaries: readonly number[];
};

/** 行移動を成立させない結合セルの論理位置。 */
export type RowBlockingMergedRange = {
	/** 0-based・inclusiveの開始行。 */
	rowStart: number;
	/** 0-based・inclusiveの終了行。 */
	rowEnd: number;
	/** 0-based・inclusiveの開始論理列。 */
	columnStart: number;
	/** 0-based・inclusiveの終了論理列。 */
	columnEnd: number;
};

/** RF Apply前に現在Tableへ再照合した行移動の評価結果。 */
type RowApplyAssessment = {
	/** 行移動によって表示位置が変わる範囲に含まれる物理セル数。 */
	affectedCellCount: number;
	/** 移動元行を除去した後に移動対象が配置される0-based最終行位置。 */
	destinationRowIndex: number;
};

/** Table Integrationが解釈または反映する、再照合済みの確定候補となる行移動。 */
type RowMove = {
	/** 更新対象のTable個体を識別するclientId。 */
	clientId: string;
	/** 更新直前のtbodyを基準とする0-based移動元行位置。 */
	sourceRowIndex: number;
	/** 更新直前のtbodyを基準とする0-based移動先境界。 */
	destinationBoundaryIndex: number;
};

/** 行専用Table Integrationが表現差を吸収する対応Table Block種別。 */
type SupportedTable = 'core/table' | 'flexible-table-block/table';

/** 要求時点のtbodyを行移動判定へ利用できる形で解釈した結果。 */
type ParsedRowTable = {
	/** 検証済みの現在tbody行集合。 */
	body: readonly Record< string, unknown >[];
	/** 縦結合を分断するため移動先にできない行間境界。 */
	blockedBoundaries: readonly number[];
	/** 構造拒否理由として公開できる結合セル単位の論理位置。 */
	mergedRanges: readonly RowBlockingMergedRange[];
};

/** 行専用Table Integrationが受理する対応Table Block名。 */
const SUPPORTED_TABLES = new Set< string >( [ 'core/table', 'flexible-table-block/table' ] );

/**
 * 外部から取得したTableデータを、属性・行・セルとして解釈可能か判定する。
 *
 * @param value 対応Table Blockから取得した未検証の値。
 * @return Table要素としてキー参照可能なオブジェクトである場合はtrue。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * Block名が行専用Table Integrationの対応対象か判定する。
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
 * 既存の縦結合を避けて、現在セルが連続して占有できる最初の論理列位置を取得する。
 *
 * @param occupied        現在行で既に占有されている論理列。
 * @param searchFrom      探索を開始する論理列位置。
 * @param requiredColumns 現在セルが必要とする連続論理列数。
 * @return 現在セルを配置できる最初の論理列位置。
 */
const findAvailableColumnStart = (
	occupied: readonly boolean[],
	searchFrom: number,
	requiredColumns: number
): number => {
	let columnStart = searchFrom;

	/* 前行から継続するrowspanを避け、現在セルが必要とする連続列を確保できる位置を探す。 */
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
 * 要求時点のtbodyを、方向固有の移動判定と診断に利用できる一つの解析結果へ変換する。
 *
 * @param tableName 対応Table Block種別。
 * @param body      対応Table Blockから取得した未検証tbody。
 * @return 現在の行構造。安全に解釈できない場合はnull。
 */
const parseRowTable = (
	tableName: SupportedTable,
	body: readonly unknown[]
): ParsedRowTable | null => {
	const rows: Record< string, unknown >[] = [];
	const blockedBoundaries = new Set< number >();
	const mergedRanges: RowBlockingMergedRange[] = [];
	const occupied = Array.from( { length: body.length }, () => [] as boolean[] );

	/* tbodyを論理グリッドとして解釈し、行制約と原因セル位置を同じ解析から確定する。 */
	for ( let rowIndex = 0; rowIndex < body.length; rowIndex++ ) {
		const row = body[ rowIndex ];
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}
		rows.push( row );
		let searchFrom = 0;

		/* 各物理セルを論理列へ配置し、縦結合が塞ぐ境界と原因セル矩形を記録する。 */
		for ( const cell of row.cells ) {
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = getCellSpan( tableName, cell, 'row' );
			const columnSpan = getCellSpan( tableName, cell, 'column' );
			if ( rowSpan === null || columnSpan === null || rowIndex + rowSpan > body.length ) {
				return null;
			}

			const columnStart = findAvailableColumnStart( occupied[ rowIndex ], searchFrom, columnSpan );
			const columnEnd = columnStart + columnSpan - 1;

			/* セルが占有する論理位置を後続セル・後続行の列解決へ反映する。 */
			for ( let occupiedRow = rowIndex; occupiedRow < rowIndex + rowSpan; occupiedRow++ ) {
				for ( let column = columnStart; column <= columnEnd; column++ ) {
					occupied[ occupiedRow ][ column ] = true;
				}
			}
			searchFrom = columnEnd + 1;

			if ( rowSpan === 1 ) {
				continue;
			}

			const rowEnd = rowIndex + rowSpan - 1;
			mergedRanges.push( { rowStart: rowIndex, rowEnd, columnStart, columnEnd } );

			/* 縦結合内部の行間境界は、セルを分断するため移動先として禁止する。 */
			for ( let boundary = rowIndex + 1; boundary <= rowEnd; boundary++ ) {
				blockedBoundaries.add( boundary );
			}
		}
	}

	return {
		body: rows,
		blockedBoundaries: [ ...blockedBoundaries ].sort( ( left, right ) => left - right ),
		mergedRanges: mergedRanges.sort(
			( left, right ) =>
				left.rowStart - right.rowStart ||
				left.rowEnd - right.rowEnd ||
				left.columnStart - right.columnStart ||
				left.columnEnd - right.columnEnd
		),
	};
};

/**
 * 要求時点の対応Tableを、行移動判定に利用できる構造として取得する。
 *
 * @param clientId 対象Table個体を識別するclientId。
 * @return 現在の行構造。対象Blockの不在、非対応、または解析不能時はnull。
 */
const getParsedRowTable = ( clientId: string ): ParsedRowTable | null => {
	const block = select( blockEditorStore ).getBlock( clientId );
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const body = block.attributes.body;
	if ( ! Array.isArray( body ) ) {
		return null;
	}

	return parseRowTable( block.name, body );
};

/**
 * 要求時点の対応Tableから、Row Reorderが移動可否の再照合に利用する制約情報を取得する。
 *
 * @param clientId 対象Table個体を識別するclientId。
 * @return 現在行数と分断不可境界。現在のTableを安全に解釈できない場合はnull。
 */
const getConstraints = ( clientId: string ): RowReorderConstraints | null => {
	const parsedTable = getParsedRowTable( clientId );
	if ( parsedTable === null ) {
		return null;
	}

	return {
		rowCount: parsedTable.body.length,
		blockedBoundaries: parsedTable.blockedBoundaries,
	};
};

/**
 * 現在の行構造に対して移動候補が成立するか方向固有ルールで判定する。
 *
 * @param parsedTable 要求時点の解析済みtbody。
 * @param move        現在のtbodyを基準とする行移動。
 * @return source・destination・結合セル制約をすべて満たす場合はtrue。
 */
const isRowMoveAllowed = ( parsedTable: ParsedRowTable, move: RowMove ): boolean => {
	const rowCount = parsedTable.body.length;
	const sourceInRange =
		Number.isInteger( move.sourceRowIndex ) &&
		move.sourceRowIndex >= 0 &&
		move.sourceRowIndex < rowCount;
	const destinationInRange =
		Number.isInteger( move.destinationBoundaryIndex ) &&
		move.destinationBoundaryIndex >= 0 &&
		move.destinationBoundaryIndex <= rowCount;
	if ( ! sourceInRange || ! destinationInRange ) {
		return false;
	}

	const sourceBlockedByMergedRange =
		parsedTable.blockedBoundaries.includes( move.sourceRowIndex ) ||
		parsedTable.blockedBoundaries.includes( move.sourceRowIndex + 1 );
	const destinationBlockedByMergedRange = parsedTable.blockedBoundaries.includes(
		move.destinationBoundaryIndex
	);
	const moveAllowed = ! sourceBlockedByMergedRange && ! destinationBlockedByMergedRange;
	return moveAllowed;
};

/**
 * 行移動を成立させない最初の結合セル位置を取得する。
 *
 * source側をdestination側より優先し、同じ側ではrowStart、rowEnd、columnStart、columnEndの昇順を利用する。
 *
 * @param move 現在のtbodyを基準とする行移動。
 * @return 候補を妨げる0-based・両端inclusiveの結合セル位置。構造拒否がない場合はnull。
 */
const getBlockingMergedRange = ( move: RowMove ): RowBlockingMergedRange | null => {
	const parsedTable = getParsedRowTable( move.clientId );
	if ( parsedTable === null ) {
		return null;
	}

	const sourceRange = parsedTable.mergedRanges.find(
		( range ) => move.sourceRowIndex >= range.rowStart && move.sourceRowIndex <= range.rowEnd
	);
	if ( sourceRange !== undefined ) {
		return sourceRange;
	}

	const destinationRange = parsedTable.mergedRanges.find(
		( range ) =>
			move.destinationBoundaryIndex > range.rowStart &&
			move.destinationBoundaryIndex <= range.rowEnd
	);
	const blockingRange = destinationRange ?? null;
	return blockingRange;
};

/**
 * 移動前の行間境界を、移動元除去後の最終行位置へ解釈する。
 *
 * @param move 現在のtbodyを基準とする行移動。
 * @return 移動対象が反映後に配置される0-based行位置。
 */
const resolveDestinationRowIndex = ( move: RowMove ): number => {
	const destinationRowIndex =
		move.destinationBoundaryIndex > move.sourceRowIndex
			? move.destinationBoundaryIndex - 1
			: move.destinationBoundaryIndex;
	return destinationRowIndex;
};

/**
 * 行移動によって表示位置が変わる範囲に含まれる物理セル数を、解析済みtbodyから取得する。
 *
 * @param parsedTable 要求時点の解析済みtbody。
 * @param move        現在のtbodyを基準とする行移動。
 * @return 今回の移動に含まれる物理セル数。
 */
const countAffectedCells = ( parsedTable: ParsedRowTable, move: RowMove ): number => {
	const destinationRowIndex = resolveDestinationRowIndex( move );
	const start = Math.min( move.sourceRowIndex, destinationRowIndex );
	const end = Math.max( move.sourceRowIndex, destinationRowIndex );
	let affectedCellCount = 0;

	/* 表示位置が変わる行範囲に存在する物理セルを、結合セルの論理占有数へ展開せず数える。 */
	for ( let rowIndex = start; rowIndex <= end; rowIndex++ ) {
		const cells = parsedTable.body[ rowIndex ].cells;
		if ( ! Array.isArray( cells ) ) {
			throw new Error( 'Parsed row cells must remain available.' );
		}
		affectedCellCount += cells.length;
	}

	return affectedCellCount;
};

/**
 * 行移動によって表示位置が変わる範囲に含まれる物理セル数を取得する。
 *
 * @param move 現在のtbodyを基準とする行移動。
 * @return 今回の移動に含まれる物理セル数。安全に評価できない場合はnull。
 */
const getAffectedCellCount = ( move: RowMove ): number | null => {
	const parsedTable = getParsedRowTable( move.clientId );
	if ( parsedTable === null || ! isRowMoveAllowed( parsedTable, move ) ) {
		return null;
	}

	return countAffectedCells( parsedTable, move );
};

/**
 * RF Apply前に、解決済み行移動を要求時点の現在Tableへ再照合する。
 *
 * @param move RFで解決済みの行移動候補。
 * @return 現在も候補が成立する場合は更新対象セル数と反映後の最終行位置。成立しない場合はnull。
 */
const assessRowMoveForApply = ( move: RowMove ): RowApplyAssessment | null => {
	const parsedTable = getParsedRowTable( move.clientId );
	if ( parsedTable === null || ! isRowMoveAllowed( parsedTable, move ) ) {
		return null;
	}

	return {
		affectedCellCount: countAffectedCells( parsedTable, move ),
		destinationRowIndex: resolveDestinationRowIndex( move ),
	};
};

/**
 * 確定済み行移動を、要求時点の対応Tableへ反映する。
 *
 * @param move 更新直前のTable構造を基準とする確定済み行移動。
 * @return 現在も安全に更新できた場合はtrue、外部状態変化等で更新できない場合はfalse。
 */
const applyRowMove = ( move: RowMove ): boolean => {
	const parsedTable = getParsedRowTable( move.clientId );
	if ( parsedTable === null || ! isRowMoveAllowed( parsedTable, move ) ) {
		return false;
	}

	const destinationRowIndex = resolveDestinationRowIndex( move );
	const reorderedBody = [ ...parsedTable.body ];
	const [ movedRow ] = reorderedBody.splice( move.sourceRowIndex, 1 );
	reorderedBody.splice( destinationRowIndex, 0, movedRow );

	dispatch( blockEditorStore ).updateBlockAttributes( move.clientId, {
		body: reorderedBody,
	} );
	return true;
};

/**
 * Row ReorderとRFと対応Table Blockの間を接続する、行専用Table Integrationのインタフェース。
 *
 * Core TableとFlexible Table Blockの表現差、およびWordPress Block Editor Storeとの接続はこの責務の内部で吸収する。
 * Tableデータや算出結果は保持せず、Block固有構造も外部へ公開しない。
 */
export const rowTableIntegration = {
	getConstraints,
	getBlockingMergedRange,
	getAffectedCellCount,
	resolveDestinationRowIndex,
	assessRowMoveForApply,
	applyRowMove,
};
