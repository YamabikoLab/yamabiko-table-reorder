/** Reorder coreが共通して扱うTable section。 */
type TableSection = 'head' | 'body' | 'foot';

/**
 * Reorder coreが利用するTable構造。
 * 通常セルは持たず、結合セルだけを保持する。
 */
export type TableStructure = {
	mergedCells: readonly TableMergedCellStructure[];
};

/**
 * 1つの結合セルの位置と範囲。
 */
export type TableMergedCellStructure = {
	/** 結合セルが属するTable section。 */
	section: TableSection;
	/** section内の0-based開始行。 */
	rowStart: number;
	/** 論理Table grid上の0-based開始列。 */
	columnStart: number;
	/** 縦方向に占有する行数。 */
	rowSpan: number;
	/** 横方向に占有する列数。 */
	columnSpan: number;
};

/**
 * Table Integrationが対象clientIdから要求時点のblockを再取得するために利用する
 * Block Editor storeの最小Contract。
 */
export type TableIntegrationBlockStore = {
	/** clientIdに対応する現在のblockを返す。 */
	getBlock: ( clientId: string ) =>
		| {
				name: string;
				attributes: unknown;
		  }
		| null
		| undefined;
};

/**
 * 外部Table plugin固有の構造表現をReorder coreから隠蔽し、
 * 要求時点の共通Table structureを提供するTable IntegrationのContract。
 */
export type TableIntegration = {
	/** 対象clientIdの要求時点の共通Table structureを取得する。 */
	getStructure: ( clientId: string ) => TableStructure | null;
};

const TABLE_SECTIONS: readonly TableSection[] = [ 'head', 'body', 'foot' ];

type TableRow = {
	cells: readonly Record< string, unknown >[];
};

type SpanProperties = {
	rowSpan: string;
	columnSpan: string;
};

type TableStructureIntegration = {
	getStructure: ( attributes: unknown ) => TableStructure | null;
};

/**
 * propertyを安全に参照できるobjectかを判定する。
 *
 * @param value 判定対象の値。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * plugin固有のsection表現をlogical Table grid構築で利用できる行配列へ変換する。
 * 不完全なsectionは共通Table structureへ変換できないためnullを返す。
 *
 * @param section plugin固有のTable section表現。
 */
const parseSectionRows = ( section: unknown ): readonly TableRow[] | null => {
	// headやfootを持たないTableもあるため、未定義sectionは空sectionとして扱う。
	if ( section === undefined ) {
		return [];
	}

	// sectionが行配列でなければ共通Table structureへ安全に適応できない。
	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const rows: TableRow[] = [];
	for ( const row of section ) {
		// 行構造が不完全な場合は部分的なTable structureを返さない。
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const cells: Record< string, unknown >[] = [];
		for ( const cell of row.cells ) {
			// cell構造が不完全な場合もsection全体を変換不能として扱う。
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
 * cellのspan値を正の整数へ正規化する。
 * propertyが存在しない場合は通常セルとして1を返す。
 *
 * @param cell     span値を保持するTable cell。
 * @param property plugin固有のspan property名。
 */
const parseSpan = ( cell: Record< string, unknown >, property: string ): number | null => {
	const span = cell[ property ];

	// span指定がなければ、HTML Tableと同じく1セル分を占有する通常セルとして扱う。
	if ( span === undefined ) {
		return 1;
	}

	// plugin由来のspan値は数値または数値文字列だけを受け入れる。
	if ( typeof span !== 'number' && typeof span !== 'string' ) {
		return null;
	}

	const value = Number( span );
	return Number.isInteger( value ) && value >= 1 ? value : null;
};

/**
 * 先行するrowSpanが占有する列を避け、現在cellが開始できる最初の論理列を返す。
 *
 * @param occupiedUntilRow 各論理列が何行目まで占有されているかを表す配列。
 * @param rowStart         現在cellが属するsection内の0-based行index。
 * @param minimumColumn    現在cellが探索を開始する最小論理列index。
 * @param columnSpan       現在cellが横方向に占有する列数。
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
			// 先行するrowSpanが候補列を占有している間は、その位置からcellを開始できない。
			if ( ( occupiedUntilRow[ column ] ?? 0 ) > rowStart ) {
				isAvailable = false;
				break;
			}
		}

		// columnSpan全体が空いていれば、その候補列がlogical Table grid上の開始列になる。
		if ( isAvailable ) {
			return candidate;
		}

		candidate++;
	}
};

/**
 * 1つのTable sectionからlogical Table gridを復元し、結合セルだけを抽出する。
 *
 * @param section        共通Table structureへ記録するTable section。
 * @param rows           section内のTable行一覧。
 * @param spanProperties plugin固有のrowSpan / columnSpan property名。
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

			// span値を正規化できないcellを含む場合は、不完全なTable structureを返さない。
			if ( declaredRowSpan === null || columnSpan === null ) {
				return null;
			}

			// section末尾を越えるrowSpanは存在する行数までに制限してlogical gridを構築する。
			const rowSpan = Math.min( declaredRowSpan, rows.length - rowStart );
			const columnStart = findColumnStart( occupiedUntilRow, rowStart, minimumColumn, columnSpan );

			for ( let column = columnStart; column < columnStart + columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max(
					occupiedUntilRow[ column ] ?? 0,
					rowStart + rowSpan
				);
			}

			// 共通Table structureは通常セルを保持せず、結合セルだけを保持する。
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
 * plugin固有のspan property名を使って各sectionのlogical Table gridを復元し、
 * Reorder core共通のTable structureを構築する。
 *
 * @param attributes     要求時点のTable block attributes。
 * @param spanProperties plugin固有のrowSpan / columnSpan property名。
 */
const buildTableStructure = (
	attributes: unknown,
	spanProperties: SpanProperties
): TableStructure | null => {
	// attributesをTable sectionとして参照できない場合は、共通構造を生成しない。
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const mergedCells: TableMergedCellStructure[] = [];
	for ( const section of TABLE_SECTIONS ) {
		const rows = parseSectionRows( attributes[ section ] );

		// いずれかのsectionを解釈できなければ、部分的なTable structureを返さない。
		if ( rows === null ) {
			return null;
		}

		const sectionMergedCells = buildSectionMergedCells( section, rows, spanProperties );

		// いずれかのsectionでlogical gridを復元できなければ、Table全体を変換不能とする。
		if ( sectionMergedCells === null ) {
			return null;
		}

		mergedCells.push( ...sectionMergedCells );
	}

	return { mergedCells };
};

/** Core Tableのlowercase span propertyを共通Table structureへ適応するIntegration。 */
const coreTableIntegration: TableStructureIntegration = {
	getStructure: ( attributes ) =>
		buildTableStructure( attributes, {
			rowSpan: 'rowspan',
			columnSpan: 'colspan',
		} ),
};

/** Flexible Table BlockのcamelCase span propertyを共通Table structureへ適応するIntegration。 */
const flexibleTableBlockIntegration: TableStructureIntegration = {
	getStructure: ( attributes ) =>
		buildTableStructure( attributes, {
			rowSpan: 'rowSpan',
			columnSpan: 'colSpan',
		} ),
};

/** block.nameでTableの種類を識別し、対応するIntegrationを直接選択するmapping。 */
const TABLE_INTEGRATIONS: Readonly< Partial< Record< string, TableStructureIntegration > > > = {
	'core/table': coreTableIntegration,
	'flexible-table-block/table': flexibleTableBlockIntegration,
};

/**
 * Block Editor storeを利用するTable Integrationを作成する。
 *
 * Table structureを要求されるたびにclientIdから現在のblockを再取得し、その時点の
 * block.nameに対応するIntegrationを選択する。取得したblock、attributes、
 * Table structureは後続の要求へ保持しない。
 *
 * @param blockEditorStore 対象clientIdから要求時点のblockを再取得するstore Contract。
 */
export const createTableIntegration = (
	blockEditorStore: TableIntegrationBlockStore
): TableIntegration => ( {
	getStructure: ( clientId ) => {
		const block = blockEditorStore.getBlock( clientId );

		// clientIdに対応するcurrent blockを取得できなければ、対象Tableを解決できない。
		if ( ! block ) {
			return null;
		}

		const integration = TABLE_INTEGRATIONS[ block.name ];

		// block.nameに対応するIntegrationがなければ、非対応Tableとして扱う。
		if ( ! integration ) {
			return null;
		}

		return integration.getStructure( block.attributes );
	},
} );
