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

/**
 * Table Integration内部で利用する共通のTable区画。
 *
 * 対応Tableの区画は`head`、`body`、`foot`の3種類として共通に解釈する。
 */
type TableSection = 'head' | 'body' | 'foot';

/**
 * Reorder coreがTableの構造上の制約を判断するために利用する共通Table構造。
 *
 * 通常セルの内容や装飾は保持せず、並び替え可否の判断に必要な結合セルの位置と範囲だけを保持する。
 * Reorder Target ResolutionなどTable Integrationの利用側は、この共通契約を直接参照する。
 *
 * この値は要求時点のTableから作成する一時的な結果であり、Table Integrationは後続要求や別のDnDへ
 * 持ち越さない。
 */
export type TableStructure = {
	/** Table内に存在する結合セルの位置と範囲。通常セルは含まない。 */
	mergedCells: readonly TableMergedCellStructure[];
};

/**
 * 共通Table構造上で1つの結合セルが占有する位置と範囲を表す。
 *
 * 行位置と列位置は、結合による占有範囲を考慮した論理Tableグリッド上で表す。
 * `TableStructure`とともにTable Integrationの共通契約として利用側へ公開する。
 */
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
 *
 * `clientId`は対象Table個体の識別に利用する。要求ごとに現在のBlockを取得し、以前取得したBlockや属性を
 * 再利用しない。`block.name`はTable個体の識別ではなく、対応Table種類の判定にだけ利用する。
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

/**
 * 外部Table pluginとReorder coreの間でTable構造を受け渡すTable Integrationの契約。
 *
 * 呼び出し側は対象Tableの`clientId`だけを渡し、対象Table固有の属性構造や結合セル表現を意識しない。
 * 対象Blockが存在しない、非対応Table、`body`区画が欠落している、または安全に共通構造へ変換できない場合は
 * `null`を返し、不完全なTable構造は提供しない。
 *
 * Table Integration自身はTableデータ、共通Table構造、DnD状態、Reorder Session、並び替え制約を
 * 状態として保持しない。
 */
export type TableIntegration = {
	/**
	 * 対象Tableの要求時点の共通Table構造を取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 共通Table構造。対象を取得できない、非対応Table、または安全に変換できない場合は`null`。
	 */
	getStructure: ( clientId: string ) => TableStructure | null;
};

/**
 * Table区画を論理Tableグリッドへ復元する前の、Table種類に依存しないセル表現。
 *
 * 対応Table固有の結合範囲属性はSupported Block境界で取得し、共通処理は正規化後の`rowSpan`と
 * `columnSpan`だけを扱う。
 */
type TableCell = {
	rowSpan: number;
	columnSpan: number;
};

/**
 * Table区画を論理Tableグリッドへ復元する前の、Table種類に依存しない行表現。
 *
 * セル内容や装飾はTable構造判定に不要なため保持しない。
 */
type TableRow = {
	cells: readonly TableCell[];
};

/**
 * 対応Table属性から作成し、共通構造復元へ渡すTable区画一覧。
 *
 * `head`と`foot`は省略可能なため空配列へ正規化する。`body`はTable本体として必須とし、欠落時は
 * この表現を成立させない。
 */
type TableSections = Readonly< Record< TableSection, readonly TableRow[] > >;

/**
 * Supported Block固有セルから取得した結合範囲の生値。
 *
 * 属性名だけをSupported Block境界で解釈し、値自体の妥当性や既定値は共通処理で解釈する。
 */
type TableCellSpans = {
	rowSpan: unknown;
	columnSpan: unknown;
};

/**
 * Supported Block固有差分として、セルに保存された結合範囲属性だけを解釈する内部契約。
 *
 * Table属性、区画、行、セルの構造規則とspan値の正規化はTable Integration共通処理が所有する。
 * 現在のSupported Block間では、Core Tableの`rowspan` / `colspan`とFlexible Table Blockの
 * `rowSpan` / `colSpan`だけがこの境界で異なる。
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

/**
 * 値をTable属性、行、セルとして安全に参照できるオブジェクトか判定する。
 *
 * Table構造を推測しないため、属性を持つデータとして扱えるのは`null`でも配列でもないオブジェクトだけとする。
 *
 * @param value 判定対象の値。
 * @return Tableデータのオブジェクトとして安全に参照できる場合は`true`。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * 対象Table固有セルに保存された結合範囲を、共通の占有数へ正規化する。
 *
 * 結合範囲の指定がないセルは通常セルとして1を返す。指定がある場合は1以上の整数だけを受け入れる。
 * 数値文字列は対象Tableデータとして許容し、それ以外は安全に構造を復元できないため`null`とする。
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
 * 区画、行、セルの構造規則は対応Table間で同じものとしてTable Integrationが共通に解釈し、
 * セルの結合範囲属性名だけをSupported Block固有境界へ委譲する。
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
 * `head`と`foot`は省略可能とし、`body`はTable本体として必須とする。いずれかの区画を安全に解釈できない
 * 場合は部分的なTable構造を作らず`null`を返す。区画構造の規則はSupported Blockごとに複製しない。
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
 * 先行行の縦結合が後続行の列を占有している場合、その占有範囲を避けて現在セルの横幅全体を配置できる
 * 最初の列を採用する。これにより、物理的なセル配列位置ではなく結合を考慮した論理列位置を確定する。
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
 * 先行する縦結合の占有範囲を考慮して各セルの論理列位置を確定し、縦または横に2以上を占有するセルだけを
 * 結合セルとして結果へ含める。通常セルは位置計算に利用するが共通Table構造には保持しない。
 * 縦結合が区画末尾を越える指定は、実在する行までを占有範囲として扱う。
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
 * `head`、`body`、`foot`それぞれについて結合を考慮した論理Tableグリッドを復元し、結合セルだけを
 * `TableStructure`へ集約する。対象Table固有属性はこの処理へ持ち込まない。
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

/**
 * Core Table固有の結合範囲属性をTable Integration共通処理へ渡す。
 *
 * Core Table固有差分として`rowspan`と`colspan`だけを読み取り、値の正規化やTable構造規則は解釈しない。
 */
const coreTableIntegration: SupportedTableIntegration = {
	getCellSpans: ( cell ) => ( {
		rowSpan: cell.rowspan,
		columnSpan: cell.colspan,
	} ),
};

/**
 * Flexible Table Block固有の結合範囲属性をTable Integration共通処理へ渡す。
 *
 * Flexible Table Block固有差分として`rowSpan`と`colSpan`だけを読み取り、値の正規化やTable構造規則は
 * 解釈しない。
 */
const flexibleTableBlockIntegration: SupportedTableIntegration = {
	getCellSpans: ( cell ) => ( {
		rowSpan: cell.rowSpan,
		columnSpan: cell.colSpan,
	} ),
};

/**
 * 要求時点のTable種類に対応するSupported Block差分を選択する対応表。
 *
 * 対象Table個体を`clientId`で取得した後、そのBlockの`block.name`をTable種類の判定に利用する。
 * 対応していないTable種類には境界を割り当てず、非対応Tableを明確に区別する。
 */
const TABLE_INTEGRATIONS: Readonly< Partial< Record< string, SupportedTableIntegration > > > = {
	'core/table': coreTableIntegration,
	'flexible-table-block/table': flexibleTableBlockIntegration,
};

/**
 * Reorder coreから利用するTable Integrationを作成する。
 *
 * 構造取得要求ごとに対象Tableの現在Blockを取得し、そのTable種類に対応する結合範囲属性だけを選択してから、
 * 共通の構造確認、span正規化、論理Tableグリッド復元を行う。Block、属性、共通Table構造は内部状態として
 * 保持せず、後続要求では現在のストア状態を基準にする。
 *
 * 対象Blockが存在しない、非対応Table、または属性を安全に変換できない場合は`null`を返す。
 * Reorder固有の並び替え対象判定、並び替え制約導出、移動先判定はこの境界では行わない。
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