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
 */
export type TableMergedCellStructure = {
	/** 結合セルが属する共通Table section。 */
	section: TableSection;
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
	/** `clientId`に対応する要求時点のcurrent blockを返す。 */
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
 * 対象blockが存在しない、対応Tableではない、または安全に共通構造へ変換できない場合は
 * `null`を返す。不完全なTable構造を部分的に返すことはしない。
 *
 * Table Integration自身はTableデータ、共通Table構造、DnD状態、Reorder Session、
 * 並び替え制約を状態として保持しない。
 */
export type TableIntegration = {
	/** 対象Tableの要求時点の共通Table構造を取得し、提供できない場合は`null`を返す。 */
	getStructure: ( clientId: string ) => TableStructure | null;
};

/**
 * Table plugin固有のsection表現を共通Table構造へ変換するときの処理順を定義する。
 *
 * すべての対応Tableをhead、body、footの同じ3sectionとして扱い、sectionごとの
 * 結合セル情報を同じ順序で共通Table構造へ集約する。
 */
const TABLE_SECTIONS: readonly TableSection[] = [ 'head', 'body', 'foot' ];

/**
 * plugin固有の1行分のデータから、logical Table grid復元に必要なcell一覧だけを取り出した表現。
 *
 * cellの内容や装飾はTable構造判定には不要なため、この中間表現では保持しない。
 */
type TableRow = {
	cells: readonly Record< string, unknown >[];
};

/**
 * 対応Table pluginがrowSpanとcolumnSpanをどのproperty名で保持するかを表す。
 *
 * Core TableとFlexible Table Blockの表記差をこの境界内へ閉じ込め、logical Table gridを
 * 復元する共通処理へplugin固有のproperty名を持ち込まないために利用する。
 */
type SpanProperties = {
	rowSpan: string;
	columnSpan: string;
};

/**
 * 1種類のTable pluginについて、plugin固有attributesを共通Table構造へ適応するContract。
 *
 * Table種類の選択と、選択後の構造変換を分離するための内部境界である。
 */
type TableStructureIntegration = {
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
 * 1つのplugin固有sectionを、logical Table grid復元に利用する行一覧へ変換する。
 *
 * headやfootを持たないTableは有効なTableとして扱えるため、section自体が存在しない場合は
 * 空のsectionとして扱う。一方、sectionが存在するのに行配列ではない場合や、行・cellの
 * 形を安全に読み取れない場合は、そのTableを正しく解釈できないため`null`を返す。
 *
 * 途中まで読み取れた行だけを返すことはしない。Reorder coreへ不完全な共通Table構造を
 * 提供しないというTable IntegrationのContractを、この段階でも維持する。
 *
 * @param section plugin固有のTable section表現。
 * @return 読み取れた行一覧。sectionが不完全な場合は`null`。
 */
const parseSectionRows = ( section: unknown ): readonly TableRow[] | null => {
	// headやfootを持たないTableも有効なため、存在しないsectionは空として扱う。
	if ( section === undefined ) {
		return [];
	}

	// 存在するsectionの構造を解釈できなければ、推測で共通構造を作らない。
	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const rows: TableRow[] = [];
	for ( const row of section ) {
		// 1行でも構造を確認できなければ、section全体を変換不能として扱う。
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const cells: Record< string, unknown >[] = [];
		for ( const cell of row.cells ) {
			// cellのpropertyを安全に参照できなければ、不完全な結果を返さない。
			if ( ! isRecord( cell ) ) {
				return null;
			}
			cells.push( cell );
		}

		rows.push( { cells } );
	}

	return rows;
};

/**
 * plugin固有cellに保存されたspan値を、共通Table構造で利用する占有数へ変換する。
 *
 * span指定がないcellは通常セルなので1を返す。指定がある場合は、Table grid上の占有数として
 * 利用できる1以上の整数だけを受け入れる。数値文字列はpluginデータとして許容するが、
 * それ以外の値は安全に構造を復元できないため`null`とする。
 *
 * @param cell     span値を保持するTable cell。
 * @param property 対象pluginがspan値を保持するproperty名。
 * @return 1以上の占有数。解釈できないspan値の場合は`null`。
 */
const parseSpan = ( cell: Record< string, unknown >, property: string ): number | null => {
	const span = cell[ property ];

	// span指定がないcellは1行・1列だけを占有する通常セルとして扱う。
	if ( span === undefined ) {
		return 1;
	}

	// Table grid上の占有数へ明確に変換できる型だけを受け入れる。
	if ( typeof span !== 'number' && typeof span !== 'string' ) {
		return null;
	}

	const value = Number( span );
	return Number.isInteger( value ) && value >= 1 ? value : null;
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
			// 先行するrowSpanが候補列を占有している場合、その位置へ現在cellは配置できない。
			if ( ( occupiedUntilRow[ column ] ?? 0 ) > rowStart ) {
				isAvailable = false;
				break;
			}
		}

		// 横方向に必要な範囲全体が空いていれば、その位置を現在cellの開始列とする。
		if ( isAvailable ) {
			return candidate;
		}

		candidate++;
	}
};

/**
 * 1つのTable sectionについてlogical Table gridを復元し、結合セルの共通構造を作成する。
 *
 * 各行を上から順に確認し、先行するrowSpanが後続行で占有している列を考慮しながら、
 * それぞれのcellがTable上のどの列から始まるかを決定する。rowSpanまたはcolumnSpanが
 * 2以上のcellだけを結合セルとして結果へ追加し、通常セルは位置計算にだけ利用する。
 *
 * rowSpanがsection末尾を越える場合は、実際に存在する行までを占有範囲として扱う。
 * span値を安全に解釈できないcellが1つでもある場合は、不完全なsection構造を返さず`null`とする。
 *
 * @param section        共通Table構造へ記録するTable section。
 * @param rows           section内のTable行一覧。
 * @param spanProperties 対象pluginのrowSpanとcolumnSpanのproperty名。
 * @return section内の結合セル一覧。構造を復元できない場合は`null`。
 */
const buildSectionMergedCells = (
	section: TableSection,
	rows: readonly TableRow[],
	spanProperties: SpanProperties
): readonly TableMergedCellStructure[] | null => {
	const occupiedUntilRow: number[] = [];
	const mergedCells: TableMergedCellStructure[] = [];

	for ( let rowStart = 0; rowStart < rows.length; rowStart++ ) {
		const row = rows[ rowStart ];
		let minimumColumn = 0;

		for ( const cell of row.cells ) {
			const declaredRowSpan = parseSpan( cell, spanProperties.rowSpan );
			const columnSpan = parseSpan( cell, spanProperties.columnSpan );

			// 1つでもspanを解釈できなければ、正しいlogical Table gridを保証できない。
			if ( declaredRowSpan === null || columnSpan === null ) {
				return null;
			}

			// section外の存在しない行は占有範囲へ含めず、現在存在する構造だけを表現する。
			const rowSpan = Math.min( declaredRowSpan, rows.length - rowStart );
			const columnStart = findColumnStart( occupiedUntilRow, rowStart, minimumColumn, columnSpan );

			for ( let column = columnStart; column < columnStart + columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max(
					occupiedUntilRow[ column ] ?? 0,
					rowStart + rowSpan
				);
			}

			// 通常セルはgrid復元に利用するが、共通Table構造には結合セルだけを残す。
			if ( rowSpan > 1 || columnSpan > 1 ) {
				mergedCells.push( {
					section,
					rowStart,
					columnStart,
					rowSpan,
					columnSpan,
				} );
			}

			minimumColumn = columnStart + columnSpan;
		}
	}

	return mergedCells;
};

/**
 * 1つのTable blockのattributes全体をReorder core共通のTable構造へ変換する。
 *
 * 対応Table pluginのattributesからhead、body、footを同じ共通sectionとして読み取り、
 * 各sectionのlogical Table gridを個別に復元したうえで、結合セル情報を1つの
 * `TableStructure`へ集約する。plugin固有のspan property名の違いは呼び出し側から受け取り、
 * この処理自体はCore TableとFlexible Table Blockで共通利用する。
 *
 * attributesまたはいずれかのsectionを安全に解釈できない場合は、読み取れた部分だけで
 * Table構造を推測せず`null`を返す。対応不能なTableに不完全な共通構造を提供しないという
 * Table IntegrationのContractをTable全体で保証する。
 *
 * @param attributes     要求時点のTable block attributes。
 * @param spanProperties 対象pluginのrowSpanとcolumnSpanのproperty名。
 * @return 要求時点の共通Table構造。完全に構築できない場合は`null`。
 */
const buildTableStructure = (
	attributes: unknown,
	spanProperties: SpanProperties
): TableStructure | null => {
	// attributesを安全に参照できなければ、Table sectionを推測して処理しない。
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const mergedCells: TableMergedCellStructure[] = [];
	for ( const section of TABLE_SECTIONS ) {
		const rows = parseSectionRows( attributes[ section ] );

		// 1sectionでも解釈できなければ、Table全体を変換不能として扱う。
		if ( rows === null ) {
			return null;
		}

		const sectionMergedCells = buildSectionMergedCells( section, rows, spanProperties );

		// 1sectionでもgridを復元できなければ、不完全なTable構造を返さない。
		if ( sectionMergedCells === null ) {
			return null;
		}

		mergedCells.push( ...sectionMergedCells );
	}

	return { mergedCells };
};

/**
 * Core Tableのattributesを共通Table構造へ適応するTable Integration。
 *
 * Core Tableが結合範囲を`rowspan`と`colspan`で保持するというplugin固有知識をここに閉じ込める。
 * logical Table gridの復元方法や共通Table構造の形は他の対応Tableと共有する。
 */
const coreTableIntegration: TableStructureIntegration = {
	getStructure: ( attributes ) =>
		buildTableStructure( attributes, {
			rowSpan: 'rowspan',
			columnSpan: 'colspan',
		} ),
};

/**
 * Flexible Table Blockのattributesを共通Table構造へ適応するTable Integration。
 *
 * Flexible Table Blockが結合範囲を`rowSpan`と`colSpan`で保持するというplugin固有知識を
 * ここに閉じ込める。Reorder coreや共通grid復元処理へこの表記差を漏らさない。
 */
const flexibleTableBlockIntegration: TableStructureIntegration = {
	getStructure: ( attributes ) =>
		buildTableStructure( attributes, {
			rowSpan: 'rowSpan',
			columnSpan: 'colSpan',
		} ),
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
 * または選択したIntegrationがattributesを安全に変換できない場合は`null`を返す。
 * Reorder固有の移動対象判定、制約導出、移動先判定はこの境界では行わない。
 *
 * この実装では#571の構造取得側を提供する。確定した並び替えをTable plugin固有の方法で
 * 反映する処理は、後続のData Update実装から利用する同じTable Integration境界へ接続する。
 *
 * @param blockEditorStore 対象`clientId`から要求時点のcurrent blockを取得するstore Contract。
 * @return 状態を保持せず要求時点のTable構造を提供するTable Integration。
 */
export const createTableIntegration = (
	blockEditorStore: TableIntegrationBlockStore
): TableIntegration => ( {
	getStructure: ( clientId ) => {
		const block = blockEditorStore.getBlock( clientId );

		// 対象Table個体のcurrent blockを取得できなければ、以前のデータで代替しない。
		if ( ! block ) {
			return null;
		}

		const integration = TABLE_INTEGRATIONS[ block.name ];

		// 対応表にないTable種類は、推測で既存Integrationへ割り当てず非対応Tableとする。
		if ( ! integration ) {
			return null;
		}

		return integration.getStructure( block.attributes );
	},
} );
