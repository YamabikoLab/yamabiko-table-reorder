/**
 * 行専用Table Integrationとして、対応Table Block固有の表現差とWordPress Block Editor Storeとの接続を吸収し、Row Reorderへ現在のtbody行構造、構造診断、反映前評価、確定済み行移動の反映を提供する。
 *
 * このファイルはCore TableとFlexible Table Blockの縦結合属性差、および対応Tableへの行順反映を所有する。
 * Row ReorderとRFへは現在行数、rowspanを分断できない挿入位置、blocking merged range、更新対象セル数、および確定更新だけを公開し、Tableデータや対応Block固有の表現は外へ公開しない。
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

/** 行移動を成立させない縦結合範囲。 */
export type RowBlockingMergedRange = {
	/** 0-based・inclusiveの開始行。 */
	rowStart: number;
	/** 0-based・inclusiveの終了行。 */
	rowEnd: number;
};

/** RF Apply前に現在Tableへ再照合した行移動の評価結果。 */
export type RowApplyAssessment = {
	/** 行移動によって表示位置が変わる範囲に含まれる物理セル数。 */
	affectedCellCount: number;
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
	/** 構造拒否理由として公開できる一意な縦結合範囲。 */
	mergedRanges: readonly RowBlockingMergedRange[];
};

/** 行専用Table Integrationが受理する対応Table Block名。 */
const SUPPORTED_TABLES = new Set< string >( [ 'core/table', 'flexible-table-block/table' ] );

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
 * Block名が行専用Table Integrationの対応対象か判定する。
 *
 * @param blockName 要求時点のWordPress Block名。
 * @return Core TableまたはFlexible Table Blockとして扱える場合はtrue。
 */
const isSupportedTable = ( blockName: string ): blockName is SupportedTable =>
	SUPPORTED_TABLES.has( blockName );

/**
 * 対応Table Block固有の縦結合属性を、共通の縦結合行数として解釈する。
 *
 * @param tableName 縦結合属性名の解釈対象となる対応Table Block種別。
 * @param cell      対応Table Blockから取得した未検証のセル属性。
 * @return セルが占有する行数。縦結合指定がない場合は1、行数として解釈できない場合はnull。
 */
const getRowSpan = (
	tableName: SupportedTable,
	cell: Record< string, unknown >
): number | null => {
	/* 対応Block間で異なる縦結合属性名はこの境界でのみ解釈し、外側へ差を公開しない。 */
	const rawRowSpan = tableName === 'core/table' ? cell.rowspan : cell.rowSpan;
	/* 縦結合指定のない通常セルは1行だけを占有する。 */
	if ( rawRowSpan === undefined ) {
		return 1;
	}
	/* 縦結合数として解釈できない値を含むTableは、安全な行制約を提供できない。 */
	if ( typeof rawRowSpan !== 'number' && typeof rawRowSpan !== 'string' ) {
		return null;
	}

	const rowSpan = Number( rawRowSpan );
	/* 縦結合は1以上の整数だけを有効な行数として扱う。 */
	const normalizedRowSpan = Number.isInteger( rowSpan ) && rowSpan >= 1 ? rowSpan : null;
	return normalizedRowSpan;
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
	const mergedRanges = new Map< string, RowBlockingMergedRange >();

	/* tbodyの各行を縦結合の開始行として確認し、行制約と診断範囲を同じ解析から確定する。 */
	for ( let rowIndex = 0; rowIndex < body.length; rowIndex++ ) {
		const row = body[ rowIndex ];
		/* 行をセル集合として解釈できない場合は、Table全体の行構造を安全に提供できない。 */
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}
		rows.push( row );

		/* 各セルが占有する行範囲を確認し、縦結合が跨ぐ行間を行移動の禁止境界へ反映する。 */
		for ( const cell of row.cells ) {
			/* セル属性を解釈できない場合は、方向固有制約と診断範囲を確定できない。 */
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = getRowSpan( tableName, cell );
			/* 無効な縦結合、またはtbody末尾を越える縦結合を含むTableは解析対象にしない。 */
			if ( rowSpan === null || rowIndex + rowSpan > body.length ) {
				return null;
			}
			/* 通常セルは行間境界を塞がないため、結合範囲の診断対象に含めない。 */
			if ( rowSpan === 1 ) {
				continue;
			}

			const rowEnd = rowIndex + rowSpan - 1;
			mergedRanges.set( `${ rowIndex }:${ rowEnd }`, {
				rowStart: rowIndex,
				rowEnd,
			} );

			/* 縦結合の開始行から終了行までの内部境界は、行を挿入すると結合を分断するためすべて移動先として禁止する。 */
			for ( let boundary = rowIndex + 1; boundary <= rowEnd; boundary++ ) {
				blockedBoundaries.add( boundary );
			}
		}
	}

	return {
		body: rows,
		blockedBoundaries: [ ...blockedBoundaries ].sort( ( left, right ) => left - right ),
		mergedRanges: [ ...mergedRanges.values() ].sort(
			( left, right ) => left.rowStart - right.rowStart || left.rowEnd - right.rowEnd
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
	/* 対象Blockが存在しない、非対応、または属性を解釈できない場合は現在Tableとして利用しない。 */
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const body = block.attributes.body;
	/* 対応Tableでもtbody行集合を取得できない場合は、行方向の判定を提供しない。 */
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
	/* 現在Tableを安全に解析できない場合は、部分的な制約情報を返さない。 */
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
	/* 現在Table上に存在しない移動元または移動先は、解決済み候補として成立しない。 */
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
 * 行移動を成立させない最初の縦結合範囲を取得する。
 *
 * source側をdestination側より優先し、同じ側では開始行が小さい範囲を優先する。
 *
 * @param move 現在のtbodyを基準とする行移動。
 * @return 候補を妨げる0-based・両端inclusiveの行範囲。構造拒否がない場合はnull。
 */
const getBlockingMergedRange = ( move: RowMove ): RowBlockingMergedRange | null => {
	const parsedTable = getParsedRowTable( move.clientId );
	/* 診断元となる現在Tableを解析できない場合は、結合範囲を推測しない。 */
	if ( parsedTable === null ) {
		return null;
	}

	const sourceRange = parsedTable.mergedRanges.find(
		( range ) => move.sourceRowIndex >= range.rowStart && move.sourceRowIndex <= range.rowEnd
	);
	/* 移動元の構造拒否を利用者へ先に示せるよう、移動先よりsource側を優先する。 */
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
 * 行移動によって表示位置が変わる範囲に含まれる物理セル数を、解析済みtbodyから取得する。
 *
 * @param parsedTable 要求時点の解析済みtbody。
 * @param move        現在のtbodyを基準とする行移動。
 * @return 今回の移動に含まれる物理セル数。
 */
const countAffectedCells = ( parsedTable: ParsedRowTable, move: RowMove ): number => {
	const insertionIndex =
		move.destinationBoundaryIndex > move.sourceRowIndex
			? move.destinationBoundaryIndex - 1
			: move.destinationBoundaryIndex;
	const start = Math.min( move.sourceRowIndex, insertionIndex );
	const end = Math.max( move.sourceRowIndex, insertionIndex );
	let affectedCellCount = 0;

	/* 表示位置が変わる行範囲に存在する物理セルを、結合セルの論理占有数へ展開せず数える。 */
	for ( let rowIndex = start; rowIndex <= end; rowIndex++ ) {
		const cells = parsedTable.body[ rowIndex ].cells;
		/* 解析済み行からcellsが失われる状態はTable Integration内部Contract違反として扱う。 */
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
 * colspan / rowspanによる論理占有数へ展開せず、Table属性上に存在するcell objectを1セルとして数える。
 * 対象Tableまたは移動候補を現在構造へ安全に照合できない場合はnullを返す。
 *
 * @param move 現在のtbodyを基準とする行移動。
 * @return 今回の移動に含まれる物理セル数。安全に評価できない場合はnull。
 */
const getAffectedCellCount = ( move: RowMove ): number | null => {
	const parsedTable = getParsedRowTable( move.clientId );
	/* DnD候補を現在構造へ再照合できない場合は、更新対象セル数を提供しない。 */
	if ( parsedTable === null || ! isRowMoveAllowed( parsedTable, move ) ) {
		return null;
	}

	return countAffectedCells( parsedTable, move );
};

/**
 * RF Apply前に、解決済み行移動を要求時点の現在Tableへ再照合する。
 *
 * @param move RFで解決済みの行移動候補。
 * @return 現在も候補が成立する場合は更新対象セル数。成立しない場合はnull。
 */
const assessRowMoveForApply = ( move: RowMove ): RowApplyAssessment | null => {
	const parsedTable = getParsedRowTable( move.clientId );
	/* RF候補が現在Tableで成立しない場合は、反映経路へ進める評価結果を返さない。 */
	if ( parsedTable === null || ! isRowMoveAllowed( parsedTable, move ) ) {
		return null;
	}

	return {
		affectedCellCount: countAffectedCells( parsedTable, move ),
	};
};

/**
 * 確定済み行移動を、要求時点の対応Tableへ反映する。
 *
 * assessment後の外部変更を成立保証として扱わず、更新直前にsource・destination・結合セル制約を現在Tableへ再照合する。
 * 成立した更新は一回のWordPress属性更新として反映する。
 *
 * @param move 更新直前のTable構造を基準とする確定済み行移動。
 * @return 現在も安全に更新できた場合はtrue、外部状態変化等で更新できない場合はfalse。
 */
const applyRowMove = ( move: RowMove ): boolean => {
	const parsedTable = getParsedRowTable( move.clientId );
	/* assessment結果を成立保証にせず、更新直前の現在Tableで成立しない候補は反映しない。 */
	if ( parsedTable === null || ! isRowMoveAllowed( parsedTable, move ) ) {
		return false;
	}

	/* 移動先境界は移動前のtbodyを基準とするため、移動元行の除去後も同じ境界を表す位置へ補正する。 */
	const insertionIndex =
		move.destinationBoundaryIndex > move.sourceRowIndex
			? move.destinationBoundaryIndex - 1
			: move.destinationBoundaryIndex;
	const reorderedBody = [ ...parsedTable.body ];
	const [ movedRow ] = reorderedBody.splice( move.sourceRowIndex, 1 );
	reorderedBody.splice( insertionIndex, 0, movedRow );

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
	assessRowMoveForApply,
	applyRowMove,
};
