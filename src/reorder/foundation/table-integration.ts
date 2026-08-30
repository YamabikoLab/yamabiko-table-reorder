/**
 * 対応Table Block固有のTableデータを、Reorder coreが利用する共通Table構造へ変換する境界を提供する。
 *
 * 対象TableはclientIdから要求時点のBlockを取得して識別し、Core TableとFlexible Table Blockの差分は
 * 結合セル属性の取得だけで吸収する。Table Integrationは取得したTableデータや変換結果を保持せず、
 * 並び替え対象判定、並び替え制約の導出、移動先判定、Reorder Sessionの状態管理を担当しない。
 */

/** Reorder coreが利用する共通Table構造。通常セルは保持しない。 */
export type TableStructure = {
	mergedCells: readonly TableMergedCellStructure[];
};

/** 共通Table構造上で1つの結合セルが占有する位置と範囲。 */
export type TableMergedCellStructure = {
	section: 'head' | 'body' | 'foot';
	rowStart: number;
	columnStart: number;
	rowSpan: number;
	columnSpan: number;
};

/**
 * Table Integrationが要求時点のBlockを取得するために利用するBlock Editorストアの契約。
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

/** 対応Table BlockとReorder coreの構造取得境界。 */
export type TableIntegration = {
	/**
	 * 対象Tableの要求時点の共通Table構造を取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 共通Table構造。対象を利用できない場合はnull。
	 */
	getStructure: ( clientId: string ) => TableStructure | null;
};

type TableSection = TableMergedCellStructure[ 'section' ];

type CellSpanReader = ( cell: Record< string, unknown > ) => {
	rowSpan: unknown;
	columnSpan: unknown;
};

const SECTION_NAMES: readonly TableSection[] = [ 'head', 'body', 'foot' ];

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
 * Table属性や行・セルとして安全に参照できるオブジェクトか判定する。
 *
 * @param value 判定対象。
 * @return 配列でもnullでもないオブジェクトの場合はtrue。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * セルの結合範囲を論理Tableグリッド上の占有数へ正規化する。
 *
 * @param span 対応Table Blockから取得した結合範囲値。
 * @return 1以上の整数。解釈できない場合はnull。
 */
const parseSpan = ( span: unknown ): number | null => {
	if ( span === undefined ) {
		return 1;
	}

	if ( typeof span !== 'number' && typeof span !== 'string' ) {
		return null;
	}

	const value = Number( span );
	const normalizedSpan = Number.isInteger( value ) && value >= 1 ? value : null;
	return normalizedSpan;
};

/**
 * 先行する縦結合セルの占有範囲を避け、現在セルを配置できる最初の論理列を求める。
 *
 * @param occupiedUntilRow 各論理列が占有されている終了行位置。
 * @param rowStart         現在の区画内行位置。
 * @param minimumColumn    探索を開始する最小列位置。
 * @param columnSpan       現在セルが横方向に占有する列数。
 * @return 現在セルの論理開始列。
 */
const findColumnStart = (
	occupiedUntilRow: readonly number[],
	rowStart: number,
	minimumColumn: number,
	columnSpan: number
): number => {
	let candidate = minimumColumn;

	// 現在セルの横結合範囲全体が空いている最初の論理列まで候補位置を進める。
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
 * 1つのTable区画を走査しながら論理Tableグリッドを復元し、結合セルだけを共通構造へ追加する。
 *
 * 全セルの中間構造は作らず、行とセルを要求時点の属性から直接読み取る。区画、行、セル、span値のいずれかを
 * 安全に解釈できない場合は部分的な構造を返さず失敗とする。
 *
 * @param section      共通Table構造上の区画。
 * @param sectionValue 対応Table Blockの区画属性。
 * @param spanReader   対応Table Block固有の結合範囲属性を取得する処理。
 * @param mergedCells  構築中の共通結合セル一覧。
 * @return 区画全体を安全に解釈できた場合はtrue。
 */
const appendSectionMergedCells = (
	section: TableSection,
	sectionValue: unknown,
	spanReader: CellSpanReader,
	mergedCells: TableMergedCellStructure[]
): boolean => {
	const isOptionalSection = section !== 'body';

	if ( sectionValue === undefined ) {
		return isOptionalSection;
	}

	if ( ! Array.isArray( sectionValue ) ) {
		return false;
	}

	const occupiedUntilRow: number[] = [];

	// 区画を上から順に走査し、縦結合が後続行で占有する論理列を継続して反映する。
	for ( let rowStart = 0; rowStart < sectionValue.length; rowStart++ ) {
		const row = sectionValue[ rowStart ];
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return false;
		}

		let minimumColumn = 0;

		// 行内のセルを左から順に配置し、結合範囲を考慮した論理開始列を確定する。
		for ( const cell of row.cells ) {
			if ( ! isRecord( cell ) ) {
				return false;
			}

			const spans = spanReader( cell );
			const rowSpan = parseSpan( spans.rowSpan );
			const columnSpan = parseSpan( spans.columnSpan );

			if ( rowSpan === null || columnSpan === null ) {
				return false;
			}

			const columnStart = findColumnStart( occupiedUntilRow, rowStart, minimumColumn, columnSpan );
			const occupiedRowEnd = rowStart + rowSpan;

			for ( let column = columnStart; column < columnStart + columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max( occupiedUntilRow[ column ] ?? 0, occupiedRowEnd );
			}

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

	return true;
};

/**
 * 対応Table Blockの要求時点の属性から共通Table構造を構築する。
 *
 * @param attributes 要求時点のTable属性。
 * @param spanReader 対応Table Block固有の結合範囲属性を取得する処理。
 * @return 共通Table構造。安全に構築できない場合はnull。
 */
const buildTableStructure = (
	attributes: unknown,
	spanReader: CellSpanReader
): TableStructure | null => {
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const mergedCells: TableMergedCellStructure[] = [];

	// head、body、footを共通規則で処理し、1区画でも成立しなければTable全体を不完全として扱う。
	for ( const section of SECTION_NAMES ) {
		const isComplete = appendSectionMergedCells(
			section,
			attributes[ section ],
			spanReader,
			mergedCells
		);

		if ( ! isComplete ) {
			return null;
		}
	}

	return { mergedCells };
};

/**
 * Reorder coreから利用するTable Integrationを作成する。
 *
 * 構造取得要求ごとにclientIdから現在のBlockを取得し直し、そのBlock名に対応するspan属性の読み取り方だけを
 * 選択する。Table属性の検証、区画走査、span正規化、論理Tableグリッド復元は共通処理が担当する。
 *
 * @param blockEditorStore 対象clientIdから要求時点のBlockを取得するストア契約。
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

		const spanReader = CELL_SPAN_READERS[ block.name ];
		if ( ! spanReader ) {
			return null;
		}

		return buildTableStructure( block.attributes, spanReader );
	},
} );
