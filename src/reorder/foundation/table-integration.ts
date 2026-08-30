/**
 * Table plugin固有のデータ構造を、Reorder coreが利用する共通Table構造へ変換する境界を提供する。
 *
 * 対応Tableから要求時点のデータを取得し、`head`、`body`、`foot`の区画と結合セルの位置・範囲を
 * 共通表現へ変換する。Reorder coreはこの境界を通じて、対象Tableごとの属性構造や結合セル表現の違いを
 * 意識せずにTable構造を利用できる。
 *
 * Table IntegrationはTableデータや変換結果を保持せず、要求ごとに現在データから共通Table構造を作る。
 * 対象Tableを安全に変換できない場合は不完全な構造を返さず`null`とする。並び替え対象判定、
 * 並び替え制約の導出、移動先判定、Reorder Sessionの状態管理はこの責務に含めない。
 */

/** Table Integration内部で利用する共通のTable区画。 */
type TableSection = 'head' | 'body' | 'foot';

/**
 * Reorder coreがTableの構造上の制約を判断するために利用する共通Table構造。
 *
 * 通常セルの内容や装飾は保持せず、並び替え可否の判断に必要な結合セルの位置と範囲だけを保持する。
 * この値は要求時点のTableから作成する一時的な結果であり、Table Integrationは後続要求や別のDnDへ
 * 持ち越さない。
 */
export type TableStructure = {
	/** Table内に存在する結合セルの位置と範囲。通常セルは含まない。 */
	mergedCells: readonly TableMergedCellStructure[];
};

/** 共通Table構造上で1つの結合セルが占有する位置と範囲を表す。 */
export type TableMergedCellStructure = {
	/** 結合セルが属するTable区画。 */
	section: 'head' | 'body' | 'foot';
	/** 区画内で結合セルが開始する0-based行位置。 */
	rowStart: number;
	/** 論理Tableグリッド上で結合セルが開始する0-based列位置。 */
	columnStart: number;
	/** 結合セルが縦方向に占有する行数。 */
	rowSpan: number;
	/** 結合セルが横方向に占有する列数。 */
	columnSpan: number;
};

/**
 * Table Integrationが対象Tableの現在データを取得するために利用するBlock Editorストアの契約。
 */
export type TableIntegrationBlockStore = {
	/**
	 * `clientId`に対応する要求時点のBlockを取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 要求時点のBlock。対象が存在しない場合は`null`または`undefined`。
	 */
	getBlock: ( clientId: string ) =>
		| {
				name: string;
				attributes: unknown;
		  }
		| null
		| undefined;
};

/** 外部Table pluginとReorder coreの間でTable構造を受け渡すTable Integrationの契約。 */
export type TableIntegration = {
	/**
	 * 対象Tableの要求時点の共通Table構造を取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 共通Table構造。対象を取得できない、非対応Table、または安全に変換できない場合は`null`。
	 */
	getStructure: ( clientId: string ) => TableStructure | null;
};

/** Table区画を論理Tableグリッドへ復元する前の、Table種類に依存しないセル表現。 */
type TableCell = {
	rowSpan: number;
	columnSpan: number;
};

/** Table区画を論理Tableグリッドへ復元する前の、Table種類に依存しない行表現。 */
type TableRow = {
	cells: readonly TableCell[];
};

/** 共通構造復元へ渡すTable区画一覧。 */
type TableSections = Readonly< Record< TableSection, readonly TableRow[] > >;

/** Supported Block固有セルから取得した結合範囲の生値。 */
type TableCellSpans = {
	rowSpan: unknown;
	columnSpan: unknown;
};

/**
 * Supported Block固有差分として、セルに保存された結合範囲属性だけを解釈する内部契約。
 *
 * Table属性、区画、行、セルの構造規則とspan値の正規化はTable Integration共通処理が所有する。
 */
type SupportedTableIntegration = {
	/**
	 * 対象Table固有セルから縦横の結合範囲値を取得する。
	 *
	 * @param cell 要求時点の対象Table固有セル。
	 * @return 対象Table固有属性から取得した縦横の結合範囲値。
	 */
	getCellSpans: ( cell: Record< string, unknown > ) => TableCellSpans;
};

/** 値をTable属性、行、セルとして安全に参照できるオブジェクトか判定する。 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * 対象Table固有セルに保存された結合範囲を、共通の占有数へ正規化する。
 *
 * @param span 対象Table固有セルから取得した結合範囲値。
 * @return 1以上の占有数。解釈できない値の場合は`null`。
 */
const parseSpan = ( span: unknown ): number | null => {
	// 結合範囲が指定されていないセルは、1行1列を占有する通常セルとして扱う。
	if ( span === undefined ) {
		return 1;
	}

	// 対応Tableが結合範囲として表現できる数値または数値文字列以外は受け入れない。
	if ( typeof span !== 'number' && typeof span !== 'string' ) {
		return null;
	}

	const value = Number( span );
	// Table上の占有数は1以上の整数である必要があり、それ以外では共通Table構造を確定しない。
	const normalizedSpan = Number.isInteger( value ) && value >= 1 ? value : null;
	return normalizedSpan;
};

/**
 * 1つのTable区画をTable種類に依存しない行表現へ正規化する。
 *
 * @param section     対象Tableの区画値。
 * @param optional    区画欠落を空区画として許容する場合は`true`。
 * @param integration Supported Block固有の結合範囲属性を取得する契約。
 * @return 正規化済み行一覧。区画を安全に解釈できない場合は`null`。
 */
const normalizeTableRows = (
	section: unknown,
	optional: boolean,
	integration: SupportedTableIntegration
): readonly TableRow[] | null => {
	// `head`と`foot`は省略を許容するが、Table本体である`body`は必須とする。
	if ( section === undefined ) {
		if ( optional ) {
			return [];
		}

		return null;
	}

	// 存在するTable区画は行の一覧として解釈できる必要がある。
	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const rows: TableRow[] = [];
	// 区画を構成するすべての行を確認し、1行でも解釈できない場合は部分的な区画を作らない。
	for ( const row of section ) {
		// 各行はセル一覧を持つTable行として解釈できる場合だけ共通表現へ取り込む。
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const cells: TableCell[] = [];
		// 行内のすべてのセルを正規化し、行全体の結合範囲を共通表現として成立させる。
		for ( const cell of row.cells ) {
			// 各セルはSupported Block固有の結合範囲属性を安全に参照できる必要がある。
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const spans = integration.getCellSpans( cell );
			const rowSpan = parseSpan( spans.rowSpan );
			const columnSpan = parseSpan( spans.columnSpan );
			// 縦横どちらかの結合範囲を確定できないセルがあれば、区画全体を不完全として扱う。
			if ( rowSpan === null || columnSpan === null ) {
				return null;
			}

			cells.push( { rowSpan, columnSpan } );
		}

		rows.push( { cells } );
	}

	return rows;
};

/**
 * Supported BlockのTable属性を共通構造復元で利用するTable区画一覧へ正規化する。
 *
 * @param attributes  要求時点の対象Table属性。
 * @param integration Supported Block固有の結合範囲属性を取得する契約。
 * @return 共通のTable区画一覧。安全に正規化できない場合は`null`。
 */
const normalizeTableAttributes = (
	attributes: unknown,
	integration: SupportedTableIntegration
): TableSections | null => {
	// Table属性そのものを安全に参照できない場合は、区画構造を推測しない。
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const head = normalizeTableRows( attributes.head, true, integration );
	const body = normalizeTableRows( attributes.body, false, integration );
	const foot = normalizeTableRows( attributes.foot, true, integration );
	const hasUnavailableSection = head === null || body === null || foot === null;

	// 共通Table構造は`head`、`body`、`foot`を一組として成立させ、部分的に解釈できた区画だけでは作らない。
	if ( hasUnavailableSection ) {
		return null;
	}

	return { head, body, foot };
};

/**
 * 現在セルが論理Tableグリッド上で開始できる最初の列位置を求める。
 *
 * @param occupiedUntilRow 各論理列がどの行まで先行する縦結合に占有されるかを表す一覧。
 * @param rowStart         現在セルが属する区画内の0-based行位置。
 * @param minimumColumn    現在セルについて探索を開始する最小列位置。
 * @param columnSpan       現在セルが横方向に占有する列数。
 * @return 現在セルを配置できる論理Tableグリッド上の0-based開始列位置。
 */
const findColumnStart = (
	occupiedUntilRow: readonly number[],
	rowStart: number,
	minimumColumn: number,
	columnSpan: number
): number => {
	let candidate = minimumColumn;

	// 現在セルを置ける最初の論理列が確定するまで、先行する縦結合と重ならない候補位置を探す。
	while ( true ) {
		let isAvailable = true;
		// 候補位置からセルの横幅全体を確認し、1列でも縦結合に占有されていればその候補を採用しない。
		for ( let column = candidate; column < candidate + columnSpan; column++ ) {
			// 先行する縦結合が占有中の列を含む候補位置には、新しいセルを配置しない。
			if ( ( occupiedUntilRow[ column ] ?? 0 ) > rowStart ) {
				isAvailable = false;
				break;
			}
		}

		// 現在セルの横幅全体を配置できる最初の候補位置を、そのセルの論理開始列として確定する。
		if ( isAvailable ) {
			return candidate;
		}

		candidate++;
	}
};

/**
 * 1つのTable区画について論理Tableグリッドを復元し、結合セルの共通構造を作成する。
 *
 * @param section 共通Table構造へ記録するTable区画。
 * @param rows    Table種類に依存しない区画内の行一覧。
 * @return 区画内の結合セル一覧。
 */
const buildSectionMergedCells = (
	section: TableSection,
	rows: readonly TableRow[]
): readonly TableMergedCellStructure[] => {
	const occupiedUntilRow: number[] = [];
	const mergedCells: TableMergedCellStructure[] = [];

	// 区画の行を上から順に配置し、先行行の縦結合による占有を後続行の論理列位置へ反映する。
	for ( let rowStart = 0; rowStart < rows.length; rowStart++ ) {
		const row = rows[ rowStart ];
		let minimumColumn = 0;

		// 1行内のセルを表示順に配置し、各セルについて結合を考慮した論理開始列を確定する。
		for ( const cell of row.cells ) {
			const rowSpan = Math.min( cell.rowSpan, rows.length - rowStart );
			const columnStart = findColumnStart(
				occupiedUntilRow,
				rowStart,
				minimumColumn,
				cell.columnSpan
			);

			// 現在セルが占有するすべての論理列へ縦方向の占有期限を反映し、後続行との重なりを防ぐ。
			for ( let column = columnStart; column < columnStart + cell.columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max(
					occupiedUntilRow[ column ] ?? 0,
					rowStart + rowSpan
				);
			}

			// 共通Table構造には、並び替え制約の判断に必要な結合セルだけを保持する。
			if ( rowSpan > 1 || cell.columnSpan > 1 ) {
				mergedCells.push( {
					section,
					rowStart,
					columnStart,
					rowSpan,
					columnSpan: cell.columnSpan,
				} );
			}

			minimumColumn = columnStart + cell.columnSpan;
		}
	}

	return mergedCells;
};

/**
 * 正規化済みのTable区画一覧からReorder core共通のTable構造を構築する。
 *
 * @param sections Table種類に依存しないTable区画一覧。
 * @return Reorder coreが利用する共通Table構造。
 */
const buildTableStructure = ( sections: TableSections ): TableStructure => {
	const mergedCells: TableMergedCellStructure[] = [];

	// `head`、`body`、`foot`をそれぞれ独立した論理Tableグリッドとして復元し、Table全体の結合セル構造へ集約する。
	for ( const section of [ 'head', 'body', 'foot' ] as const ) {
		mergedCells.push( ...buildSectionMergedCells( section, sections[ section ] ) );
	}

	return { mergedCells };
};

/** Core Table固有の結合範囲属性をTable Integration共通処理へ渡す。 */
const coreTableIntegration: SupportedTableIntegration = {
	getCellSpans: ( cell ) => ( {
		rowSpan: cell.rowspan,
		columnSpan: cell.colspan,
	} ),
};

/** Flexible Table Block固有の結合範囲属性をTable Integration共通処理へ渡す。 */
const flexibleTableBlockIntegration: SupportedTableIntegration = {
	getCellSpans: ( cell ) => ( {
		rowSpan: cell.rowSpan,
		columnSpan: cell.colSpan,
	} ),
};

/** 要求時点のTable種類に対応するSupported Block差分を選択する対応表。 */
const TABLE_INTEGRATIONS: Readonly< Partial< Record< string, SupportedTableIntegration > > > = {
	'core/table': coreTableIntegration,
	'flexible-table-block/table': flexibleTableBlockIntegration,
};

/**
 * Reorder coreから利用するTable Integrationを作成する。
 *
 * @param blockEditorStore 対象`clientId`から要求時点のBlockを取得するストア契約。
 * @return 状態を保持せず要求時点のTable構造を提供するTable Integration。
 */
export const createTableIntegration = (
	blockEditorStore: TableIntegrationBlockStore
): TableIntegration => ( {
	getStructure: ( clientId ) => {
		const block = blockEditorStore.getBlock( clientId );

		// 対象Tableの現在データを取得できない場合は、共通Table構造を推測しない。
		if ( ! block ) {
			return null;
		}

		const integration = TABLE_INTEGRATIONS[ block.name ];

		// 対応対象として定義されていないTable種類はReorder coreへ公開しない。
		if ( ! integration ) {
			return null;
		}

		const sections = normalizeTableAttributes( block.attributes, integration );
		// 対象Tableの全区画を安全に正規化できない場合は、部分的な共通Table構造を返さない。
		if ( sections === null ) {
			return null;
		}

		return buildTableStructure( sections );
	},
} );