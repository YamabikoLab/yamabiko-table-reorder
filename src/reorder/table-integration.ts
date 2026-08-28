/**
 * Table Integrationの構造取得境界を実装する。
 *
 * このファイルは、WordPress Core TableとFlexible Table Blockが持つplugin固有のTableデータを、
 * Reorder coreが共通して利用できるTable構造へ変換する責務を担当する。Reorder coreはこの境界を
 * 利用することで、対象Table pluginごとのattributes構造、section表現、span property名の違いを
 * 意識せず、同じ共通Table構造だけを扱える。
 *
 * 構造取得では、対象Table個体を`clientId`で特定し、要求のたびにBlock Editor storeからcurrent
 * blockを取得し直す。取得した`block.name`でTable種類を判定し、Core TableまたはFlexible Table
 * Blockに対応するIntegrationを選択する。選択されたIntegrationがplugin固有attributesを
 * plugin非依存のsection、row、cell表現へ正規化し、その後の共通処理がrowSpanとcolumnSpanを
 * 考慮したlogical Table gridを復元する。共通Table構造には、並び替え制約の判断に必要な
 * 結合セルの位置と範囲だけを保持し、通常セルの内容や装飾は保持しない。
 *
 * 対象blockが存在しない場合、非対応Tableの場合、またはplugin固有データを安全に共通構造へ変換できない
 * 場合は`null`を返し、読み取れた部分だけから不完全なTable構造を作らない。headとfootは任意だが、
 * bodyはTable本体として必須とし、欠落している場合は変換不能として扱う。
 *
 * Table Integrationは状態を所有しない。取得したblock、attributes、共通Table構造を後続要求へ持ち越さず、
 * Tableの追加・削除・構造変更も監視しない。また、Reorder固有の移動対象判定、制約情報の導出、移動先判定、
 * DnD状態、Reorder Sessionは担当しない。
 *
 * このファイルでは要求時点の共通Table構造を提供する構造取得側を実装する。確定した並び替えを対象Tableへ
 * 反映する更新側は、Data Updateから同じTable Integration境界を利用して接続する。
 */

/**
 * Table IntegrationがReorder coreへ提供する共通のTable sectionを表す。
 *
 * 対象Table pluginごとに異なるsection表現を、Reorder coreではhead、body、footの
 * 3種類だけで扱えるようにするための共通表現である。
 */
type TableSection = 'head' | 'body' | 'foot';

/**
 * Reorder coreがTableの構造上の制約を判断するために利用する共通Table構造。
 *
 * Table全体のセル内容や装飾を複製するのではなく、並び替え可否の判断に必要な
 * 結合セルの位置と範囲だけを保持する。これによりReorder coreはCore Tableや
 * Flexible Table Blockそれぞれのデータ形式を知らずに、同じ構造情報を利用できる。
 * Reorder Target ResolutionなどTable Integrationの利用側が、この共通Contractを直接参照する。
 *
 * この値は要求時点のTableから作成する一時的な結果であり、Table Integrationは
 * 後続の要求や別のDnDへ持ち越さない。
 */
export type TableStructure = {
	/** Table内に存在する結合セルの位置と範囲。通常セルは含まない。 */
	mergedCells: readonly TableMergedCellStructure[];
};

/**
 * 共通Table構造上で1つの結合セルが占有する位置と範囲を表す。
 *
 * 行番号と列番号は画面上の見た目ではなく、rowSpanとcolumnSpanを考慮して復元した
 * logical Table grid上の位置で表す。これにより、Reorder coreはTable plugin固有の
 * cell配列表現を再解釈せず、結合セルが行・列のどこを占有しているか判断できる。
 * `TableStructure`とともにTable Integrationの共通Contractとして利用側へ公開する。
 */
export type TableMergedCellStructure = {
	/** 結合セルが属する共通Table section。 */
	section: 'head' | 'body' | 'foot';
	/** section内で結合セルが開始する0-based行位置。 */
	rowStart: number;
	/** logical Table grid上で結合セルが開始する0-based列位置。 */
	columnStart: number;
	/** 結合セルが縦方向に占有する行数。 */
	rowSpan: number;
	/** 結合セルが横方向に占有する列数。 */
	columnSpan: number;
};

/**
 * Table Integrationが対象Tableの現在データを取得するために利用するBlock Editor storeのContract。
 *
 * `clientId`は対象Table個体を特定するために利用する。Table Integrationは要求のたびに
 * `clientId`からcurrent blockを取得し直し、以前取得したblockやattributesを再利用しない。
 * これにより、Table編集やeditor lifecycleの変化後でも要求時点のデータを基準にできる。
 *
 * `block.name`はTable個体の識別には利用せず、取得したTableがCore Tableか
 * Flexible Table BlockかというTable種類の判定にだけ利用する。
 */
export type TableIntegrationBlockStore = {
	/**
	 * `clientId`に対応する要求時点のcurrent blockを取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return current block。対象が存在しない場合は`null`または`undefined`。
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
 * 外部Table pluginとReorder coreの間でTable構造を受け渡すTable IntegrationのContract。
 *
 * 呼び出し側は対象Tableの`clientId`だけを渡し、Table plugin固有のattributes構造や
 * span property名を意識しない。Table Integrationは要求時点のcurrent blockを取得し、
 * 対応Tableであれば共通Table構造へ変換して返す。
 *
 * 対象blockが存在しない、対応Tableではない、bodyが欠落している、または安全に共通構造へ
 * 変換できない場合は`null`を返す。不完全なTable構造を部分的に返すことはしない。
 *
 * Table Integration自身はTableデータ、共通Table構造、DnD状態、Reorder Session、
 * 並び替え制約を状態として保持しない。
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
 * Table sectionをlogical Table gridへ復元する前のplugin非依存cell表現。
 *
 * plugin固有のspan property名は各Integrationで解釈済みであり、共通grid復元処理は
 * `rowSpan`と`columnSpan`だけを利用する。
 */
type TableCell = {
	rowSpan: number;
	columnSpan: number;
};

/**
 * Table sectionをlogical Table gridへ復元する前のplugin非依存row表現。
 *
 * cell内容や装飾はTable構造判定には不要なため保持しない。
 */
type TableRow = {
	cells: readonly TableCell[];
};

/**
 * 各Integrationがplugin固有attributesから作成し、共通grid復元処理へ渡すsection一覧。
 *
 * headとfootは元データで省略可能だが、この共通表現では空配列へ正規化する。
 * bodyは元データに必須であり、欠落時はこの表現自体を作成しない。
 */
type TableSections = Readonly< Record< TableSection, readonly TableRow[] > >;

/**
 * 1種類のTable pluginについて、plugin固有attributesを共通Table構造へ適応するContract。
 *
 * Table種類の選択と、選択後の構造変換を分離するための内部境界である。各Integrationは
 * plugin固有attributesを完全に解釈できた場合だけ共通Table構造を返し、不完全な構造を推測しない。
 */
type TableStructureIntegration = {
	/**
	 * plugin固有attributesを共通Table構造へ変換する。
	 *
	 * @param attributes 要求時点のplugin固有Table attributes。
	 * @return 共通Table構造。安全に変換できない場合は`null`。
	 */
	getStructure: ( attributes: unknown ) => TableStructure | null;
};

/**
 * 値をTable attributes、row、cellとして安全に参照できるobjectか判定する。
 *
 * 配列や`null`を通常objectとして扱わないことで、不完全なpluginデータから
 * 推測でTable構造を作成することを防ぐ。
 *
 * @param value 判定対象の値。
 * @return propertyを安全に参照できるobjectの場合は`true`。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * plugin固有cellに保存されたspan値を、plugin非依存の占有数へ正規化する。
 *
 * span指定がないcellは通常セルなので1を返す。指定がある場合は、Table grid上の占有数として
 * 利用できる1以上の整数だけを受け入れる。数値文字列はpluginデータとして許容するが、
 * それ以外の値は安全に構造を復元できないため`null`とする。
 *
 * @param span plugin固有cellから取得したspan値。
 * @return 1以上の占有数。解釈できないspan値の場合は`null`。
 */
const parseSpan = ( span: unknown ): number | null => {
	if ( span === undefined ) {
		return 1;
	}

	if ( typeof span !== 'number' && typeof span !== 'string' ) {
		return null;
	}

	const value = Number( span );
	return Number.isInteger( value ) && value >= 1 ? value : null;
};

/**
 * Core Table固有の1sectionをplugin非依存row表現へ正規化する。
 *
 * Core Tableのrowは`cells`配列を持ち、cellの結合範囲は`rowspan`と`colspan`で表される。
 * これらのplugin固有shapeとproperty名はこの適応処理で解釈し、共通grid復元処理へ渡さない。
 *
 * @param section  Core Table固有のsection値。
 * @param optional section欠落を空sectionとして許容する場合は`true`。
 * @return 正規化済みrow一覧。sectionを安全に解釈できない場合は`null`。
 */
const normalizeCoreTableRows = (
	section: unknown,
	optional: boolean
): readonly TableRow[] | null => {
	if ( section === undefined ) {
		return optional ? [] : null;
	}

	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const rows: TableRow[] = [];
	for ( const row of section ) {
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const cells: TableCell[] = [];
		for ( const cell of row.cells ) {
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = parseSpan( cell.rowspan );
			const columnSpan = parseSpan( cell.colspan );
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
 * Core Table固有attributesを共通grid復元処理が利用するplugin非依存section表現へ正規化する。
 *
 * headとfootは省略可能なので空sectionへ正規化する。bodyはTable本体として必須であり、
 * 欠落または不完全な場合は部分的なTable構造を作らず`null`を返す。
 *
 * @param attributes 要求時点のCore Table attributes。
 * @return plugin非依存section一覧。安全に正規化できない場合は`null`。
 */
const normalizeCoreTableAttributes = ( attributes: unknown ): TableSections | null => {
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const head = normalizeCoreTableRows( attributes.head, true );
	const body = normalizeCoreTableRows( attributes.body, false );
	const foot = normalizeCoreTableRows( attributes.foot, true );

	if ( head === null || body === null || foot === null ) {
		return null;
	}

	return { head, body, foot };
};

/**
 * Flexible Table Block固有の1sectionをplugin非依存row表現へ正規化する。
 *
 * Flexible Table Blockのrowは`cells`配列を持ち、cellの結合範囲は`rowSpan`と`colSpan`で表される。
 * このplugin固有shapeとproperty名はこの適応処理で解釈し、共通grid復元処理へ渡さない。
 *
 * @param section  Flexible Table Block固有のsection値。
 * @param optional section欠落を空sectionとして許容する場合は`true`。
 * @return 正規化済みrow一覧。sectionを安全に解釈できない場合は`null`。
 */
const normalizeFlexibleTableBlockRows = (
	section: unknown,
	optional: boolean
): readonly TableRow[] | null => {
	if ( section === undefined ) {
		return optional ? [] : null;
	}

	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const rows: TableRow[] = [];
	for ( const row of section ) {
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const cells: TableCell[] = [];
		for ( const cell of row.cells ) {
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = parseSpan( cell.rowSpan );
			const columnSpan = parseSpan( cell.colSpan );
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
 * Flexible Table Block固有attributesを共通grid復元処理が利用するplugin非依存section表現へ正規化する。
 *
 * headとfootは省略可能なので空sectionへ正規化する。bodyはTable本体として必須であり、
 * 欠落または不完全な場合は部分的なTable構造を作らず`null`を返す。
 *
 * @param attributes 要求時点のFlexible Table Block attributes。
 * @return plugin非依存section一覧。安全に正規化できない場合は`null`。
 */
const normalizeFlexibleTableBlockAttributes = ( attributes: unknown ): TableSections | null => {
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const head = normalizeFlexibleTableBlockRows( attributes.head, true );
	const body = normalizeFlexibleTableBlockRows( attributes.body, false );
	const foot = normalizeFlexibleTableBlockRows( attributes.foot, true );

	if ( head === null || body === null || foot === null ) {
		return null;
	}

	return { head, body, foot };
};

/**
 * 現在cellがlogical Table grid上で開始できる最初の列位置を求める。
 *
 * 前の行にrowSpanを持つ結合セルがあると、その結合セルは後続行の同じ列を引き続き占有する。
 * そのため、cell配列上の単純なindexを列位置として利用せず、先行する結合セルの占有範囲を
 * 避けながら、現在cellのcolumnSpan全体を配置できる最初の列を探す。
 *
 * @param occupiedUntilRow 各論理列がどの行まで先行するrowSpanに占有されるかを表す一覧。
 * @param rowStart         現在cellが属するsection内の0-based行位置。
 * @param minimumColumn    現在cellについて探索を開始する最小列位置。
 * @param columnSpan       現在cellが横方向に占有する列数。
 * @return 現在cellを配置できるlogical Table grid上の0-based開始列位置。
 */
const findColumnStart = (
	occupiedUntilRow: readonly number[],
	rowStart: number,
	minimumColumn: number,
	columnSpan: number
): number => {
	let candidate = minimumColumn;

	while ( true ) {
		let isAvailable = true;
		for ( let column = candidate; column < candidate + columnSpan; column++ ) {
			if ( ( occupiedUntilRow[ column ] ?? 0 ) > rowStart ) {
				isAvailable = false;
				break;
			}
		}

		if ( isAvailable ) {
			return candidate;
		}

		candidate++;
	}
};

/**
 * 1つのplugin非依存Table sectionについてlogical Table gridを復元し、結合セルの共通構造を作成する。
 *
 * 各行を上から順に確認し、先行するrowSpanが後続行で占有している列を考慮しながら、
 * それぞれのcellがTable上のどの列から始まるかを決定する。rowSpanまたはcolumnSpanが
 * 2以上のcellだけを結合セルとして結果へ追加し、通常セルは位置計算にだけ利用する。
 *
 * rowSpanがsection末尾を越える場合は、実際に存在する行までを占有範囲として扱う。
 * plugin固有attributesやspan property名はこの処理では扱わない。
 *
 * @param section 共通Table構造へ記録するTable section。
 * @param rows    plugin非依存に正規化されたsection内のTable行一覧。
 * @return section内の結合セル一覧。
 */
const buildSectionMergedCells = (
	section: TableSection,
	rows: readonly TableRow[]
): readonly TableMergedCellStructure[] => {
	const occupiedUntilRow: number[] = [];
	const mergedCells: TableMergedCellStructure[] = [];

	for ( let rowStart = 0; rowStart < rows.length; rowStart++ ) {
		const row = rows[ rowStart ];
		let minimumColumn = 0;

		for ( const cell of row.cells ) {
			const rowSpan = Math.min( cell.rowSpan, rows.length - rowStart );
			const columnStart = findColumnStart(
				occupiedUntilRow,
				rowStart,
				minimumColumn,
				cell.columnSpan
			);

			for ( let column = columnStart; column < columnStart + cell.columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max(
					occupiedUntilRow[ column ] ?? 0,
					rowStart + rowSpan
				);
			}

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
 * plugin非依存に正規化されたsection一覧からReorder core共通のTable構造を構築する。
 *
 * 各Integrationがplugin固有attributes、row、cell、span propertyを解釈した後のデータだけを受け取り、
 * head、body、footそれぞれのlogical Table gridを復元する。この処理はCore Tableや
 * Flexible Table Blockのraw attributesを参照せず、Table種類追加時にも変更を要求しない境界とする。
 *
 * @param sections plugin非依存に正規化されたTable section一覧。
 * @return Reorder coreが利用する共通Table構造。
 */
const buildTableStructure = ( sections: TableSections ): TableStructure => {
	const mergedCells: TableMergedCellStructure[] = [];

	for ( const section of [ 'head', 'body', 'foot' ] as const ) {
		mergedCells.push( ...buildSectionMergedCells( section, sections[ section ] ) );
	}

	return { mergedCells };
};

/**
 * Core Tableのattributesを共通Table構造へ適応するTable Integration。
 *
 * Core Table固有のattributes、row、cell、`rowspan` / `colspan`をplugin非依存表現へ
 * 正規化してから、logical Table gridを復元する共通処理へ渡す。Core Table固有知識を
 * このIntegration側に閉じ込め、共通grid復元処理へ漏らさない。attributesを安全に正規化できない場合は
 * `null`を返し、不完全な共通Table構造を生成しない。
 */
const coreTableIntegration: TableStructureIntegration = {
	getStructure: ( attributes ) => {
		const sections = normalizeCoreTableAttributes( attributes );
		return sections === null ? null : buildTableStructure( sections );
	},
};

/**
 * Flexible Table Blockのattributesを共通Table構造へ適応するTable Integration。
 *
 * Flexible Table Block固有のattributes、row、cell、`rowSpan` / `colSpan`をplugin非依存表現へ
 * 正規化してから、logical Table gridを復元する共通処理へ渡す。Flexible Table Block固有知識を
 * このIntegration側に閉じ込め、共通grid復元処理へ漏らさない。attributesを安全に正規化できない場合は
 * `null`を返し、不完全な共通Table構造を生成しない。
 */
const flexibleTableBlockIntegration: TableStructureIntegration = {
	getStructure: ( attributes ) => {
		const sections = normalizeFlexibleTableBlockAttributes( attributes );
		return sections === null ? null : buildTableStructure( sections );
	},
};

/**
 * current blockのTable種類から利用するTable Integrationを選択する対応表。
 *
 * `clientId`で対象Table個体を取得した後、そのcurrent blockの`block.name`を使って
 * Table種類だけを識別する。Table種類ごとの分岐をReorder coreへ漏らさず、対応していない
 * `block.name`にはIntegrationを割り当てないことで、非対応Tableを明確に区別する。
 */
const TABLE_INTEGRATIONS: Readonly< Partial< Record< string, TableStructureIntegration > > > = {
	'core/table': coreTableIntegration,
	'flexible-table-block/table': flexibleTableBlockIntegration,
};

/**
 * Reorder coreから利用するTable Integrationを作成する。
 *
 * 構造取得要求を受けるたびに、対象Table個体を`clientId`でBlock Editor storeから取得し直す。
 * 取得したcurrent blockの`block.name`から、その時点のTable種類に対応するIntegrationを選択し、
 * current attributesを共通Table構造へ変換する。
 *
 * block、attributes、共通Table構造を内部状態として保持しないため、後続要求では必ず現在の
 * store状態を基準にする。Tableの追加・削除・構造変更を監視する責務も持たない。
 *
 * `clientId`に対応するcurrent blockが存在しない場合、`block.name`が対応Tableではない場合、
 * bodyが欠落している場合、または選択したIntegrationがattributesを安全に変換できない場合は
 * `null`を返す。Reorder固有の移動対象判定、制約導出、移動先判定はこの境界では行わない。
 *
 * この実装は要求時点の共通Table構造を提供する構造取得側を担う。確定した並び替えをTable plugin固有の
 * 方法で反映する更新側は、Data Updateから利用する同じTable Integration境界へ接続する。
 *
 * @param blockEditorStore 対象`clientId`から要求時点のcurrent blockを取得するstore Contract。
 * @return 状態を保持せず要求時点のTable構造を提供するTable Integration。
 */
export const createTableIntegration = (
	blockEditorStore: TableIntegrationBlockStore
): TableIntegration => ( {
	getStructure: ( clientId ) => {
		const block = blockEditorStore.getBlock( clientId );

		if ( ! block ) {
			return null;
		}

		const integration = TABLE_INTEGRATIONS[ block.name ];

		if ( ! integration ) {
			return null;
		}

		return integration.getStructure( block.attributes );
	},
} );
