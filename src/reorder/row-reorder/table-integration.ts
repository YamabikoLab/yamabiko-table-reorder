/**
 * 行専用Table Integrationとして、対応Table Block固有の表現差を吸収し、Row Reorderへ現在のtbody行構造の取得と確定済み行移動の反映を提供する。
 *
 * このファイルはCore TableとFlexible Table Blockの縦結合属性差、および対応Tableへの行順反映を所有する。
 * Row Reorderへは現在行数とrowspanを分断できない挿入位置だけを公開し、Tableデータや対応Block固有の表現は外へ公開しない。
 * Tableデータや構造結果は保持せず、要求ごとに現在のBlockを参照する。
 */

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

/** Table Integrationが要求時点のBlock取得と行順反映に利用するBlock Editorストア境界。 */
export type RowTableIntegrationStore = {
	/**
	 * 要求時点の対象Blockを取得する。
	 *
	 * @param clientId 対象Table個体を識別するclientId。
	 * @return 要求時点のBlock。存在しない場合はnullまたはundefined。
	 */
	getBlock: ( clientId: string ) => { name: string; attributes: unknown } | null | undefined;
	/**
	 * 対応Tableへ確定済みの行順を属性更新として反映する。
	 *
	 * @param clientId   更新対象Table個体を識別するclientId。
	 * @param attributes Tableへ反映する属性差分。
	 */
	updateBlockAttributes: ( clientId: string, attributes: Record< string, unknown > ) => void;
};

/** 行専用Table Integrationが外側へ提供する内部仕様。 */
export type RowTableIntegration = {
	/**
	 * 要求時点の対応TableからRow Reorderが利用する行構造を取得する。
	 *
	 * @param clientId 対象Table個体を識別するclientId。
	 * @return 要求時点の行構造。対象不在、非対応、または行構造を解釈できない場合はnull。
	 */
	getStructure: ( clientId: string ) => RowTableStructure | null;
	/**
	 * 確定済み行移動を要求時点の同一Tableへ反映する。
	 *
	 * 移動先が行制約上有効であることはcomplete時の再照合済みであることを前提とし、ここでは更新要求時点の
	 * 対応Table存在と行範囲を照合する。更新できる場合は行内容を変えず、tbodyの行順だけを反映する。
	 *
	 * @param move 更新直前のTable構造を基準とする確定済み行移動。
	 * @return 現在も安全に更新できた場合はtrue、外部状態変化等で更新できない場合はfalse。
	 */
	applyRowMove: ( move: RowMove ) => boolean;
};

/** 行専用Table Integrationが表現差を吸収する対応Table Block種別。 */
type SupportedTable = 'core/table' | 'flexible-table-block/table';

/** 行構造の取得と行順反映に必要なtbodyの1行を表す最小内部表現。 */
type TableRow = Record< string, unknown > & { cells: unknown[] };

/** 要求時点で行専用Table Integrationが利用可能と判断した対応Tableの内部表現。 */
type CurrentTable = {
	/** 対応Table Block種別。 */
	name: SupportedTable;
	/** 要求時点のTable属性。 */
	attributes: Record< string, unknown >;
	/** 行構造として解釈可能な現在のtbody行。 */
	body: TableRow[];
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
 * 要求時点のBlockを、行専用Table Integrationが扱える現在Tableとして取得する。
 *
 * 対象Blockの不在、非対応Block、または必要なtbody行構造を解釈できない状態は、外部状態による正常な利用不能としてnullを返す。
 *
 * @param store    現在のBlock取得を提供するBlock Editorストア境界。
 * @param clientId 対象Table個体を識別するclientId。
 * @return 行構造の取得と行順反映に利用可能な現在Table。利用不能な場合はnull。
 */
const getCurrentTable = (
	store: RowTableIntegrationStore,
	clientId: string
): CurrentTable | null => {
	const block = store.getBlock( clientId );
	/*
	 * 対象Blockが存在しない、非対応、または属性を解釈できない状態では、Table Integrationの提供対象外として正常な不在にする。
	 */
	if ( ! block || ! SUPPORTED_TABLES.has( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const body = block.attributes.body;
	/* 対応Tableであってもtbody行集合を解釈できない場合は、不完全なTable構造として利用不能にする。 */
	if ( ! Array.isArray( body ) ) {
		return null;
	}

	const rows: TableRow[] = [];
	/* Row Reorderへ構造を渡す前に、tbodyの全行がセル集合を提供する現在構造であることを確認する。 */
	for ( const row of body ) {
		/* 行をTable行として解釈できない場合は、不完全な現在構造としてTable全体を提供しない。 */
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}
		rows.push( row as TableRow );
	}

	return {
		name: block.name as SupportedTable,
		attributes: block.attributes,
		body: rows,
	};
};

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
 * 現在のtbodyから、Row Reorderが移動先として利用できない行間境界を含む行構造を生成する。
 *
 * すべての縦結合がTable内で成立している場合だけ構造を提供し、縦結合を分断する行間は移動先から除外できる形で返す。
 *
 * @param table 要求時点で行構造として解釈可能な対応Table。
 * @return 現在行数と分断不可境界。不完全な縦結合構造を含む場合はnull。
 */
const buildStructure = ( table: CurrentTable ): RowTableStructure | null => {
	const blockedBoundaries = new Set< number >();

	/* tbodyの各行を縦結合の開始行として確認し、Table全体の分断不可境界を確定する。 */
	for ( let rowIndex = 0; rowIndex < table.body.length; rowIndex++ ) {
		/* 各セルが占有する行範囲を確認し、縦結合が跨ぐ行間を行移動の禁止境界へ反映する。 */
		for ( const cell of table.body[ rowIndex ].cells ) {
			/* セル属性を解釈できない場合は、Table全体の行制約を安全に提供できない。 */
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = getRowSpan( table.name, cell );
			/* 縦結合行数が無効、またはtbody末尾を越える場合は、不完全なTable構造として提供しない。 */
			if ( rowSpan === null || rowIndex + rowSpan > table.body.length ) {
				return null;
			}

			/* 縦結合の開始行から終了行までの内部境界は、行を挿入すると結合を分断するためすべて移動先として禁止する。 */
			for ( let boundary = rowIndex + 1; boundary < rowIndex + rowSpan; boundary++ ) {
				blockedBoundaries.add( boundary );
			}
		}
	}

	return {
		rowCount: table.body.length,
		blockedBoundaries: [ ...blockedBoundaries ].sort( ( left, right ) => left - right ),
	};
};

/**
 * 行専用Table Integrationを作成する。
 *
 * @param store 要求時点のTable取得と属性更新を提供するBlock Editorストア境界。
 * @return 状態を保持せず、要求時点の対応Tableへ適応するTable Integration。
 */
export const createRowTableIntegration = (
	store: RowTableIntegrationStore
): RowTableIntegration => ( {
	getStructure: ( clientId ) => {
		const table = getCurrentTable( store, clientId );
		/* 現在Tableを提供できない場合は、外部状態変化による正常な不在としてnullを維持する。 */
		const structure = table === null ? null : buildStructure( table );
		return structure;
	},
	applyRowMove: ( move ) => {
		const table = getCurrentTable( store, move.clientId );
		/* 更新要求時に対象Tableを利用できなくなった場合は、外部状態変化として行順を更新しない。 */
		if ( table === null ) {
			return false;
		}

		const rowCount = table.body.length;
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
		const body = [ ...table.body ];
		const [ movedRow ] = body.splice( move.sourceRowIndex, 1 );
		body.splice( insertionIndex, 0, movedRow );

		store.updateBlockAttributes( move.clientId, { body } );
		return true;
	},
} );
