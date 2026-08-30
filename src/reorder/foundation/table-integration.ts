/**
 * 対応Table BlockとReorder coreの間で、要求時点のTable構造を共通表現として提供する境界を担う。
 *
 * Reorder coreが対応Table Block固有の属性表現へ依存しないように、Table IntegrationはTable個体を
 * clientIdで識別し、対応Table Blockごとの差異を境界内で吸収する。提供する共通Table構造は、
 * 並び替え制約の判断に必要な結合セルの位置と範囲だけを表し、通常セルの内容や装飾は所有しない。
 *
 * Table Integrationは要求ごとに現在のTableデータを参照し、Tableデータや共通Table構造を状態として
 * 保持しない。Tableの監視、並び替え対象判定、並び替え制約の導出、移動先判定、Reorder Sessionの
 * 状態管理は他のReorder責務が所有する。
 */

/**
 * Reorder coreが利用する共通Table構造。
 *
 * Table Block固有のセル表現を持たず、行・列の並び替え制約を判断するために必要な結合セルだけを保持する。
 * この値は要求時点のTableから構築される結果であり、Table Integrationが後続要求へ保持する状態ではない。
 */
export type TableStructure = {
	/** Table内に存在する結合セルの位置と占有範囲。通常セルは含まない。 */
	mergedCells: readonly TableMergedCellStructure[];
};

/**
 * 共通Table構造上で1つの結合セルが占有する位置と範囲。
 *
 * 行位置は結合セルが属するTable区画内、列位置は結合を考慮した論理Tableグリッド上の0-based位置で表す。
 * Reorder coreはこの表現だけを利用し、対応Table Block固有の結合セル属性を再解釈しない。
 */
export type TableMergedCellStructure = {
	/** 結合セルが属するTable区画。 */
	section: 'head' | 'body' | 'foot';
	/** Table区画内で結合セルが開始する0-based行位置。 */
	rowStart: number;
	/** 論理Tableグリッド上で結合セルが開始する0-based列位置。 */
	columnStart: number;
	/** 結合セルが縦方向に占有する行数。 */
	rowSpan: number;
	/** 結合セルが横方向に占有する列数。 */
	columnSpan: number;
};

/**
 * Table Integrationが要求時点のBlockを取得するために利用するBlock Editorストアの契約。
 *
 * Table個体の識別にはclientIdを利用し、要求のたびに現在のBlockを取得する。以前取得したBlockや属性を
 * 再利用しないことで、Table編集やEditor lifecycleによる外部状態の変化をTable Integrationの状態として
 * 管理しない。
 */
export type TableIntegrationBlockStore = {
	/**
	 * clientIdに対応する現在のBlockを取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 要求時点のBlock。存在しない場合はnullまたはundefined。
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
 * 対応Table BlockとReorder coreの間でTable構造を受け渡すTable Integrationの契約。
 *
 * 呼び出し側はTable個体のclientIdだけを指定し、対応Table Block固有の属性構造や結合セル属性を扱わない。
 * 対象Blockが存在しない、非対応Table Blockである、またはTable全体を安全に共通構造へ変換できない場合は
 * nullを返し、不完全なTable構造を提供しない。
 */
export type TableIntegration = {
	/**
	 * 対象Tableの要求時点の共通Table構造を取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 共通Table構造。対象を利用できない場合はnull。
	 */
	getStructure: ( clientId: string ) => TableStructure | null;
};

/**
 * Table Integrationが共通Table構造で扱うTable区画。
 *
 * 対応Table BlockのTable構造は、Reorder coreへ公開する前にhead、body、footの共通区画として扱う。
 */
type TableSection = TableMergedCellStructure[ 'section' ];

/**
 * 対応Table Block固有セルから結合範囲属性を取得する内部境界。
 *
 * Core TableとFlexible Table Blockの現在の構造取得上の差異は結合範囲属性名だけであるため、
 * その差異だけをこの境界へ閉じ込める。値の妥当性やTable構造規則は共通処理が判断する。
 *
 * @param cell 対応Table Blockの1セル。
 * @return 対応Table Block固有属性から取得した縦横の結合範囲値。
 */
type CellSpanReader = ( cell: Record< string, unknown > ) => {
	rowSpan: unknown;
	columnSpan: unknown;
};

/**
 * 共通Table構造として解釈するTable区画の順序。
 *
 * 各区画を同じ規則で評価し、どの対応Table Blockでも区画ごとの構造解釈を共通に保つ。
 */
const SECTION_NAMES: readonly TableSection[] = [ 'head', 'body', 'foot' ];

/**
 * 対応Table Blockごとに異なる結合範囲属性の読み取り規則。
 *
 * Block名は対応Table Blockの種類を選択するためだけに利用し、Table属性、区画、行、セルの構造規則は
 * この対応表では分岐させない。
 */
const CELL_SPAN_READERS: Readonly< Partial< Record< string, CellSpanReader > > > = {
	'core/table': ( cell ) => ( {
		rowSpan: cell.rowspan,
		columnSpan: cell.colspan,
	} ),
	'flexible-table-block/table': ( cell ) => ( {
		rowSpan: cell.rowSpan,
		columnSpan: cell.colSpan,
	} ),
};

/**
 * Table属性、行、セルとして安全に参照できるオブジェクトか判定する。
 *
 * 不完全な外部Tableデータから共通Table構造を推測しないため、属性を参照できる値だけをTableデータとして
 * 受け入れる。
 *
 * @param value 判定対象。
 * @return 配列でもnullでもないオブジェクトの場合はtrue。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * セルの結合範囲を論理Tableグリッド上の占有数へ正規化する。
 *
 * 結合範囲が未指定の通常セルは1行または1列を占有するものとして扱う。値が指定されている場合は、
 * Table上の占有数として成立する1以上の整数だけを受け入れ、安全に解釈できない値では構造取得を成立させない。
 *
 * @param span 対応Table Blockから取得した結合範囲値。
 * @return 1以上の整数。解釈できない場合はnull。
 */
const parseSpan = ( span: unknown ): number | null => {
	// 結合範囲が指定されていないセルは、1行または1列を占有する通常セルとして扱う。
	if ( span === undefined ) {
		return 1;
	}

	// 対応Table Blockが保持し得る数値表現以外は、占有範囲を確定できない外部データとして扱う。
	if ( typeof span !== 'number' && typeof span !== 'string' ) {
		return null;
	}

	const value = Number( span );
	// Table上の占有数は1以上の整数だけが成立し、それ以外の値から共通Table構造を推測しない。
	const normalizedSpan = Number.isInteger( value ) && value >= 1 ? value : null;
	return normalizedSpan;
};

/**
 * 先行する縦結合セルの占有を考慮し、現在セルが本来開始する論理列を解決する。
 *
 * 同じ行で先行するセルの直後が縦結合によって占有されている場合だけ開始位置を進める。
 * 開始位置が決まった後の横結合範囲に別の縦結合占有が含まれる場合は、別の空き位置へ移動して補正せず
 * Table topologyの不成立として呼び出し側へ返す。
 *
 * @param occupiedUntilRow 各論理列が先行する縦結合セルによって占有される終了行位置。
 * @param rowStart         現在セルが属するTable区画内の0-based行位置。
 * @param minimumColumn    同じ行で先行するセルから決まる最小開始列。
 * @param columnSpan       現在セルが横方向に占有する列数。
 * @return 現在セルの論理開始列。横結合範囲が既存占有と衝突する場合はnull。
 */
const findColumnStart = (
	occupiedUntilRow: readonly number[],
	rowStart: number,
	minimumColumn: number,
	columnSpan: number
): number | null => {
	let columnStart = minimumColumn;

	// 現在セルより前の物理セルが存在しない占有列だけを飛ばし、物理セル順から決まる本来の開始位置を確定する。
	while ( ( occupiedUntilRow[ columnStart ] ?? 0 ) > rowStart ) {
		columnStart++;
	}

	// 開始位置の後ろにある既存占有をまたぐ横結合は、別位置へ移して意味を変えず不成立として扱う。
	for ( let column = columnStart; column < columnStart + columnSpan; column++ ) {
		if ( ( occupiedUntilRow[ column ] ?? 0 ) > rowStart ) {
			return null;
		}
	}

	return columnStart;
};

/**
 * 1つのTable区画から論理Tableグリッド上の結合セル構造を構築する。
 *
 * Table区画内のすべてのセルを評価して論理位置を復元するが、共通Table構造として保持するのは結合セルだけとする。
 * 区画、行、セル、結合範囲、論理行幅、縦結合範囲のいずれかを安全に解釈できない場合は、
 * そのTableを不完全な構造として扱う。headとfootは省略できるが、Table本体であるbodyは必須とする。
 *
 * @param section      共通Table構造上の区画。
 * @param sectionValue 対応Table Blockの区画属性。
 * @param spanReader   対応Table Block固有の結合範囲属性を取得する境界。
 * @param mergedCells  同じTableについて既に構築済みの結合セル一覧。
 * @return 区画全体を安全に解釈できた場合は論理列数。省略された区画は0。不成立の場合はnull。
 */
const appendSectionMergedCells = (
	section: TableSection,
	sectionValue: unknown,
	spanReader: CellSpanReader,
	mergedCells: TableMergedCellStructure[]
): number | null => {
	const isOptionalSection = section !== 'body';

	// headとfootの省略は有効なTableとして扱うが、bodyの欠落では共通Table構造を成立させない。
	if ( sectionValue === undefined ) {
		return isOptionalSection ? 0 : null;
	}

	// 存在するTable区画は行の集合として解釈できる必要があり、それ以外から行構造を推測しない。
	if ( ! Array.isArray( sectionValue ) ) {
		return null;
	}

	const occupiedUntilRow: number[] = [];
	let sectionColumnCount: number | null = null;

	// 区画内のすべての行を順序どおり評価し、縦結合セルが後続行で占有する論理列を引き継ぐ。
	for ( let rowStart = 0; rowStart < sectionValue.length; rowStart++ ) {
		const row = sectionValue[ rowStart ];
		// 各行はセルの集合を持つTable行として解釈できる場合だけ、論理Tableグリッドへ取り込む。
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		let minimumColumn = 0;

		// 行内のすべてのセルを元の順序で評価し、結合を考慮した論理列上の位置を確定する。
		for ( const cell of row.cells ) {
			// 各セルは対応Table Block固有の結合範囲属性を安全に参照できる必要がある。
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const spans = spanReader( cell );
			const rowSpan = parseSpan( spans.rowSpan );
			const columnSpan = parseSpan( spans.columnSpan );

			// 縦横どちらかの占有範囲を確定できないセルがあれば、Table区画全体を不完全として扱う。
			if ( rowSpan === null || columnSpan === null ) {
				return null;
			}

			const columnStart = findColumnStart( occupiedUntilRow, rowStart, minimumColumn, columnSpan );
			// 横結合範囲が先行する縦結合占有と衝突する場合は、別の論理位置へ移して補正しない。
			if ( columnStart === null ) {
				return null;
			}

			const occupiedRowEnd = rowStart + rowSpan;
			// 縦結合は所属区画内だけで完結する必要があり、存在しない行まで占有する構造を受け入れない。
			if ( occupiedRowEnd > sectionValue.length ) {
				return null;
			}

			// 現在セルが占有するすべての論理列へ縦方向の占有範囲を反映し、後続行の位置解決に利用する。
			for ( let column = columnStart; column < columnStart + columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max( occupiedUntilRow[ column ] ?? 0, occupiedRowEnd );
			}

			// Reorder coreが構造上の制約判断に必要とする結合セルだけを共通Table構造へ記録する。
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

		let rowColumnCount = occupiedUntilRow.length;
		// 過去の縦結合が終了した末尾列を行幅へ含めず、現在行で実際に占有される論理列数を確定する。
		while ( rowColumnCount > 0 && ( occupiedUntilRow[ rowColumnCount - 1 ] ?? 0 ) <= rowStart ) {
			rowColumnCount--;
		}

		// 同じ区画の全行は同じ論理列数で成立する必要があり、不足列を推測して補完しない。
		if ( sectionColumnCount !== null && rowColumnCount !== sectionColumnCount ) {
			return null;
		}
		sectionColumnCount = rowColumnCount;
	}

	return sectionColumnCount ?? 0;
};

/**
 * 対応Table Blockの要求時点の属性から共通Table構造を構築する。
 *
 * head、body、footを同じ構造規則で評価し、すべての区画を安全に解釈できた場合だけTable全体の共通構造を
 * 提供する。途中まで解釈できた結合セルだけを部分的な結果として返さない。
 *
 * @param attributes 要求時点のTable属性。
 * @param spanReader 対応Table Block固有の結合範囲属性を取得する境界。
 * @return 共通Table構造。安全に構築できない場合はnull。
 */
const buildTableStructure = (
	attributes: unknown,
	spanReader: CellSpanReader
): TableStructure | null => {
	// Table属性そのものを安全に参照できない場合は、Table区画の存在や構造を推測しない。
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const mergedCells: TableMergedCellStructure[] = [];
	let tableColumnCount: number | null = null;

	// Table全区画を共通規則で評価し、すべて成立した場合だけ1つの共通Table構造として提供する。
	for ( const section of SECTION_NAMES ) {
		const sectionColumnCount = appendSectionMergedCells(
			section,
			attributes[ section ],
			spanReader,
			mergedCells
		);

		// 1区画でも安全に解釈できなければ、部分的なTable構造をReorder coreへ公開しない。
		if ( sectionColumnCount === null ) {
			return null;
		}

		// 存在する各区画は同じ論理列数でTable全体を構成する必要があり、区画間の不足列を推測しない。
		if ( sectionColumnCount > 0 ) {
			if ( tableColumnCount !== null && sectionColumnCount !== tableColumnCount ) {
				return null;
			}
			tableColumnCount = sectionColumnCount;
		}
	}

	return { mergedCells };
};

/**
 * Reorder coreから利用するTable Integrationを作成する。
 *
 * 構造取得要求ごとにclientIdから現在のBlockを取得し、そのBlock名で対応Table Blockを判定する。
 * 対応Table Block間で異なる結合範囲属性の読み取りだけを選択し、Table属性、区画、行、セルの構造規則、
 * 結合範囲の妥当性、論理Tableグリッド上の位置は共通規則として扱う。
 *
 * 作成したTable IntegrationはBlockや共通Table構造を保持せず、次の要求でも現在のBlockを基準とする。
 * 対象Blockが存在しない場合や対応Table Blockとして安全に解釈できない場合は正常な利用不能としてnullを返す。
 *
 * @param blockEditorStore 対象clientIdから要求時点のBlockを取得するストア契約。
 * @return 状態を保持せず要求時点のTable構造を提供するTable Integration。
 */
export const createTableIntegration = (
	blockEditorStore: TableIntegrationBlockStore
): TableIntegration => ( {
	getStructure: ( clientId ) => {
		const block = blockEditorStore.getBlock( clientId );
		// 対象Tableが要求時点で存在しない場合は、過去のBlockや推測したTable構造で代替しない。
		if ( ! block ) {
			return null;
		}

		const spanReader = CELL_SPAN_READERS[ block.name ];
		// 非対応BlockはReorder core向けのTable構造を提供できる対象として扱わない。
		if ( ! spanReader ) {
			return null;
		}

		return buildTableStructure( block.attributes, spanReader );
	},
} );
