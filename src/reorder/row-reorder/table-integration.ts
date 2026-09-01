/**
 * 行並び替えが対応Table Blockの差を意識せず、現在のtbody行構造と行更新境界を利用するための境界を提供する。
 *
 * 対応Table Block固有の差はセルの縦結合属性名だけとして吸収し、Row Reorderへは現在行数と
 * rowspanによって分断できない挿入位置だけを公開する。Tableデータや構造結果は保持せず、要求ごとに
 * 現在のBlockを取得する。
 */

/** Row Reorderが現在のTable構造を再照合するために利用する行構造。 */
export type RowTableStructure = {
	/** tbodyの現在行数。 */
	rowCount: number;
	/** rowspanを分断するため移動先として使用できない0-based挿入位置。 */
	blockedBoundaries: readonly number[];
};

/** Data UpdateからTable Integrationへ渡す確定済みの1行移動。 */
export type RowMove = {
	clientId: string;
	/** 更新直前のtbodyを基準とする0-based移動元行位置。 */
	sourceRowIndex: number;
	/** 更新直前のtbodyを基準とする0-based挿入位置。 */
	destinationBoundaryIndex: number;
};

/** Table Integrationが要求時点のBlock取得と属性更新に利用するストア契約。 */
export type RowTableIntegrationStore = {
	/**
	 * @param clientId 対象Table個体を識別するclientId。
	 * @return 要求時点のBlock。存在しない場合はnullまたはundefined。
	 */
	getBlock: ( clientId: string ) => { name: string; attributes: unknown } | null | undefined;
	/**
	 * @param clientId   更新対象Table個体を識別するclientId。
	 * @param attributes Tableへ反映する属性差分。
	 */
	updateBlockAttributes: ( clientId: string, attributes: Record< string, unknown > ) => void;
};

/** 行専用Table Integrationが外側へ提供する内部仕様。 */
export type RowTableIntegration = {
	/**
	 * @param clientId 対象Table個体を識別するclientId。
	 * @return 要求時点の行構造。取得不能または非対応Tableの場合はnull。
	 */
	getStructure: ( clientId: string ) => RowTableStructure | null;
	/**
	 * 確定済み行移動を要求時点の同一Tableへ反映する。
	 *
	 * @param move 更新直前のTable構造を基準とする確定済み行移動。
	 * @return 現在も安全に更新できた場合はtrue、外部状態変化等で更新できない場合はfalse。
	 */
	applyRowMove: ( move: RowMove ) => boolean;
};

type SupportedTable = 'core/table' | 'flexible-table-block/table';

type TableRow = Record< string, unknown > & { cells: unknown[] };

type CurrentTable = {
	name: SupportedTable;
	attributes: Record< string, unknown >;
	body: TableRow[];
};

const SUPPORTED_TABLES = new Set< string >( [ 'core/table', 'flexible-table-block/table' ] );

/**
 * 値を属性オブジェクトとして安全に参照できるか判定する。
 * @param value
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * 対応Tableの現在bodyを安全に取得する。
 * @param store
 * @param clientId
 */
const getCurrentTable = (
	store: RowTableIntegrationStore,
	clientId: string
): CurrentTable | null => {
	const block = store.getBlock( clientId );
	if ( ! block || ! SUPPORTED_TABLES.has( block.name ) || ! isRecord( block.attributes ) ) {
		return null;
	}

	const body = block.attributes.body;
	if ( ! Array.isArray( body ) ) {
		return null;
	}

	const rows: TableRow[] = [];
	for ( const row of body ) {
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
 * 対応Table固有セルから縦結合範囲を取得する。
 * @param tableName
 * @param cell
 */
const getRowSpan = (
	tableName: SupportedTable,
	cell: Record< string, unknown >
): number | null => {
	const rawRowSpan = tableName === 'core/table' ? cell.rowspan : cell.rowSpan;
	if ( rawRowSpan === undefined ) {
		return 1;
	}
	if ( typeof rawRowSpan !== 'number' && typeof rawRowSpan !== 'string' ) {
		return null;
	}

	const rowSpan = Number( rawRowSpan );
	const normalizedRowSpan = Number.isInteger( rowSpan ) && rowSpan >= 1 ? rowSpan : null;
	return normalizedRowSpan;
};

/**
 * 現在bodyからrowspanにより分断できない挿入位置を導出する。
 * @param table
 */
const buildStructure = ( table: CurrentTable ): RowTableStructure | null => {
	const blockedBoundaries = new Set< number >();

	for ( let rowIndex = 0; rowIndex < table.body.length; rowIndex++ ) {
		for ( const cell of table.body[ rowIndex ].cells ) {
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = getRowSpan( table.name, cell );
			if ( rowSpan === null || rowIndex + rowSpan > table.body.length ) {
				return null;
			}

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
 * @return 状態を保持せず現在Tableへ適応するTable Integration。
 */
export const createRowTableIntegration = (
	store: RowTableIntegrationStore
): RowTableIntegration => ( {
	getStructure: ( clientId ) => {
		const table = getCurrentTable( store, clientId );
		const structure = table === null ? null : buildStructure( table );
		return structure;
	},
	applyRowMove: ( move ) => {
		const table = getCurrentTable( store, move.clientId );
		if ( table === null ) {
			return false;
		}

		const rowCount = table.body.length;
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
