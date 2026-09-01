/**
 * 行専用Table Integrationとして、対応Table Block固有の表現差とWordPress Block Editor Storeとの接続を吸収し、Row Reorderへ現在のtbody行構造の取得と確定済み行移動の反映を提供する。
 *
 * このファイルはCore TableとFlexible Table Blockの縦結合属性差、および対応Tableへの行順反映を所有する。
 * Row Reorderへは現在行数とrowspanを分断できない挿入位置だけを公開し、Tableデータや対応Block固有の表現は外へ公開しない。
 * Tableデータや構造結果は保持せず、各要求時点のWordPress Blockを直接参照する。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch, select } from '@wordpress/data';

/** Row Reorderが現在のTableで移動可否を再照合するために利用する行構造。 */
export type RowTableStructure = {
	/** tbodyの現在行数。 */
	rowCount: number;
	/** rowspanを分断するため移動先にできない0-based挿入位置。重複なく昇順で提供する。 */
	blockedBoundaries: readonly number[];
};

/** Data UpdateからTable Integrationへ渡す、現在のTable構造へ再照合済みの確定済み行移動。 */
export type RowMove = {
	/** 更新対象のTable個体を識別するclientId。 */
	clientId: string;
	/** 更新直前のtbodyを基準とする0-based移動元行位置。 */
	sourceRowIndex: number;
	/** 更新直前のtbodyを基準とする0-based移動先境界。 */
	destinationBoundaryIndex: number;
};

/** 行専用Table Integrationが表現差を吸収する対応Table Block種別。 */
type SupportedTable = 'core/table' | 'flexible-table-block/table';

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
 * 要求時点の対応Tableから、Row Reorderが移動先の再照合に利用する行構造を取得する。
 *
 * 対象Blockの不在、非対応、またはtbodyを安全に解釈できない状態は外部状態による正常な利用不能として扱い、
 * 独自の中間Tableモデルへ変換せずnullを返す。
 *
 * @param clientId 対象Table個体を識別するclientId。
 * @return 現在行数と分断不可境界。現在のTableを安全に解釈できない場合はnull。
 */
const getStructure = ( clientId: string ): RowTableStructure | null => {
	const block = select( blockEditorStore ).getBlock( clientId );
	/* 対象Blockが存在しない、非対応、または属性を解釈できない状態では、Table Integrationの提供対象外として正常な不在にする。 */
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const body = block.attributes.body;
	/* 対応Tableであってもtbody行集合を解釈できない場合は、不完全なTable構造として利用不能にする。 */
	if ( ! Array.isArray( body ) ) {
		return null;
	}

	const blockedBoundaries = new Set< number >();

	/* tbodyの各行を縦結合の開始行として確認し、Table全体の分断不可境界を確定する。 */
	for ( let rowIndex = 0; rowIndex < body.length; rowIndex++ ) {
		const row = body[ rowIndex ];
		/* 行をセル集合として解釈できない場合は、Table全体の行制約を安全に提供できない。 */
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		/* 各セルが占有する行範囲を確認し、縦結合が跨ぐ行間を行移動の禁止境界へ反映する。 */
		for ( const cell of row.cells ) {
			/* セル属性を解釈できない場合は、Table全体の行制約を安全に提供できない。 */
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = getRowSpan( block.name, cell );
			/* 縦結合行数が無効、またはtbody末尾を越える場合は、不完全なTable構造として提供しない。 */
			if ( rowSpan === null || rowIndex + rowSpan > body.length ) {
				return null;
			}

			/* 縦結合の開始行から終了行までの内部境界は、行を挿入すると結合を分断するためすべて移動先として禁止する。 */
			for ( let boundary = rowIndex + 1; boundary < rowIndex + rowSpan; boundary++ ) {
				blockedBoundaries.add( boundary );
			}
		}
	}

	return {
		rowCount: body.length,
		blockedBoundaries: [ ...blockedBoundaries ].sort( ( left, right ) => left - right ),
	};
};

/**
 * 確定済み行移動を、要求時点の対応Tableへ反映する。
 *
 * 対象Blockの不在、非対応、tbodyの利用不能、または確定後の行範囲変化は外部状態変化として更新しない。
 * 行制約自体はcomplete時に再照合済みであることを前提とし、Table Integrationは移動前境界を削除後の挿入位置へ変換して行順だけを更新する。
 *
 * @param move 更新直前のTable構造を基準とする確定済み行移動。
 * @return 現在も安全に更新できた場合はtrue、外部状態変化等で更新できない場合はfalse。
 */
const applyRowMove = ( move: RowMove ): boolean => {
	const block = select( blockEditorStore ).getBlock( move.clientId );
	/* 更新要求時に対象Blockが存在しない、非対応、または属性を解釈できない場合は、外部状態変化として行順を更新しない。 */
	if ( ! block || ! isSupportedTable( block.name ) || ! isRecord( block.attributes ) ) {
		return false;
	}

	const body = block.attributes.body;
	/* 行順更新に必要なtbody行集合を利用できない場合は、現在Tableへ確定済み移動を反映しない。 */
	if ( ! Array.isArray( body ) ) {
		return false;
	}

	const rowCount = body.length;
	/*
	 * 確定後にTableの行数が変化している可能性があるため、移動元行と移動先境界が更新要求時点のtbodyでも有効な範囲にあることを要求する。
	 */
	const sourceInRange =
		Number.isInteger( move.sourceRowIndex ) &&
		move.sourceRowIndex >= 0 &&
		move.sourceRowIndex < rowCount;
	const destinationInRange =
		Number.isInteger( move.destinationBoundaryIndex ) &&
		move.destinationBoundaryIndex >= 0 &&
		move.destinationBoundaryIndex <= rowCount;
	/* いずれかが現在の行範囲と一致しない場合は、確定済み移動を現在Tableへ反映しない。 */
	if ( ! sourceInRange || ! destinationInRange ) {
		return false;
	}

	/*
	 * 移動先境界は移動前のtbodyを基準とするため、移動元行が移動先境界より前にある場合は、移動元行の除去による1行分を補正して同じ境界へ挿入する。
	 */
	const insertionIndex =
		move.destinationBoundaryIndex > move.sourceRowIndex
			? move.destinationBoundaryIndex - 1
			: move.destinationBoundaryIndex;
	const reorderedBody = [ ...body ];
	const [ movedRow ] = reorderedBody.splice( move.sourceRowIndex, 1 );
	reorderedBody.splice( insertionIndex, 0, movedRow );

	dispatch( blockEditorStore ).updateBlockAttributes( move.clientId, {
		body: reorderedBody,
	} );
	return true;
};

/**
 * Row Reorderと対応Table Blockの間を接続する、行専用Table Integrationのインタフェース。
 *
 * Core TableとFlexible Table Blockの表現差、およびWordPress Block Editor Storeとの接続はこの責務の内部で吸収する。
 * Tableデータや算出結果は保持せず、Block固有構造も外部へ公開しない。
 */
export const rowTableIntegration = {
	getStructure,
	applyRowMove,
};
