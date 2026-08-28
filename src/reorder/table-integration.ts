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

/** propertyを安全に参照できるobjectかを判定する。 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * plugin固有のsection表現をlogical Table grid構築で利用できる行配列へ変換する。
 * 不完全なsectionは共通Table structureへ変換できないためnullを返す。
 */
const parseSectionRows = ( section: unknown ): readonly TableRow[] | null => {
	if ( section === undefined ) {
		return [];
	}

	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const rows: TableRow[] = [];
	for ( const row of section ) {
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const cells: Record< string, unknown >[] = [];
		for ( const cell of row.cells ) {
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
 */
const parseSpan = ( cell: Record< string, unknown >, property: string ): number | null => {
	const span = cell[ property ];
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
 * 先行するrowSpanが占有する列を避け、現在cellが開始できる最初の論理列を返す。
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
 * 1つのTable sectionからlogical Table gridを復元し、結合セルだけを抽出する。
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
			if ( declaredRowSpan === null || columnSpan === null ) {
				return null;
			}

			const rowSpan = Math.min( declaredRowSpan, rows.length - rowStart );
			const columnStart = findColumnStart( occupiedUntilRow, rowStart, minimumColumn, columnSpan );

			for ( let column = columnStart; column < columnStart + columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max(
					occupiedUntilRow[ column ] ?? 0,
					rowStart + rowSpan
				);
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

	return mergedCells;
};

/**
 * plugin固有のspan property名を使って各sectionのlogical Table gridを復元し、
 * Reorder core共通のTable structureを構築する。
 */
const buildTableStructure = (
	attributes: unknown,
	spanProperties: SpanProperties
): TableStructure | null => {
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const mergedCells: TableMergedCellStructure[] = [];
	for ( const section of TABLE_SECTIONS ) {
		const rows = parseSectionRows( attributes[ section ] );
		if ( rows === null ) {
			return null;
		}

		const sectionMergedCells = buildSectionMergedCells( section, rows, spanProperties );
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
