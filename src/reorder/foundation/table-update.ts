/**
 * Table Integrationが確定済み並び替えを対応Table Blockのデータ更新へ適応する境界を提供する。
 *
 * Reorder coreからは方向と移動前後の共通位置だけを受け取り、Core TableとFlexible Table Block固有の
 * 属性構造へ変換する。更新は1回のBlock属性更新として開始し、その直後に現在Blockを再取得して
 * 成立を確認できた場合だけ`updated`を返す。
 */
import type { ConcreteReorderKind, ReorderKind } from '@/reorder/core/reorder-types';

/** Reorder coreからTable Integrationへ渡す方向共通の更新表現。 */
export type TableReorderUpdate< K extends ReorderKind = ReorderKind > = {
	[ Kind in K ]: {
		kind: Kind;
		clientId: string;
		/** 並び替え前の0-based位置。 */
		sourceIndex: number;
		/** 並び替え後に対象が占める0-based位置。 */
		destinationIndex: number;
	};
}[ K ];

/** 具体的な一方向へ確定したTable更新。 */
export type ConcreteTableReorderUpdate< K extends ReorderKind > = TableReorderUpdate< K > & {
	kind: ConcreteReorderKind< K >;
};

/** Table Integrationが確認できた外部更新状態。 */
export type TableUpdateResult =
	| { status: 'updated' }
	| { status: 'unavailable' }
	| { status: 'unconfirmed' };

/** Table IntegrationがBlock Editorの現在状態と更新APIを利用するための契約。 */
export type TableUpdateBlockStore = {
	/**
	 * 対象clientIdの要求時点のBlockを取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 現在Block。存在しない場合は`null`または`undefined`。
	 */
	getBlock: ( clientId: string ) => { name: string; attributes: unknown } | null | undefined;
	/**
	 * 対象Blockへ1つの属性更新を適用する。
	 *
	 * @param clientId   対象Table個体を特定するBlock EditorのclientId。
	 * @param attributes 1回の並び替えとして同時に反映する属性差分。
	 */
	updateBlockAttributes: ( clientId: string, attributes: Record< string, unknown > ) => void;
};

/** 確定した並び替えを対応Table Blockへ反映するTable Integration更新境界。 */
export type TableUpdateIntegration = {
	/**
	 * 具体方向へ確定した1回の並び替えを対象Tableへ反映する。
	 *
	 * @param update Data Updateで共通位置へ正規化済みの更新。
	 * @return 更新成立を確認できた状態、開始不可、または開始後に成立を確認できない状態。
	 */
	updateReorder: < K extends ReorderKind >(
		update: ConcreteTableReorderUpdate< K >
	) => TableUpdateResult;
};

/** 対応Table Blockの属性として安全に参照できる値。 */
type TableAttributes = Record< string, unknown >;

/** 列更新で利用するTable区画名。 */
type TableSectionName = 'head' | 'body' | 'foot';

/** 列更新時に1セルが元の論理Tableグリッド上で占有する範囲。 */
type CellPlacement = {
	cell: unknown;
	columnStart: number;
	columnSpan: number;
};

/** 列更新時に1行を元の論理Tableグリッドへ対応付けた表現。 */
type RowPlacement = {
	row: Record< string, unknown >;
	cells: readonly CellPlacement[];
};

/** 1区画の元データと論理列数。 */
type SectionPlacement = {
	name: TableSectionName;
	rows: readonly RowPlacement[];
	columnCount: number;
};

/** Table種類ごとに異なる結合範囲属性を読み取る契約。 */
type SpanReader = {
	/** @param cell 対応Table固有のセル。 @return 縦方向の占有数。 */
	getRowSpan: ( cell: Record< string, unknown > ) => number | null;
	/** @param cell 対応Table固有のセル。 @return 横方向の占有数。 */
	getColumnSpan: ( cell: Record< string, unknown > ) => number | null;
};

/** 対応Table種類ごとの更新規則。 */
type TableDataUpdater = {
	/**
	 * @param attributes 要求時点のTable属性。
	 * @param update     具体方向へ確定した並び替え。
	 * @return 1回のBlock更新へ渡す属性差分。安全に更新できない場合は`null`。
	 */
	createAttributesUpdate: (
		attributes: unknown,
		update: TableReorderUpdate
	) => Record< string, unknown > | null;
};

/** 値をTable属性、行、セルとして安全に参照できるオブジェクトか判定する。 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/** 結合範囲を1以上の整数へ正規化する。 */
const parseSpan = ( value: unknown ): number | null => {
	// 結合範囲が省略された通常セルは1行1列を占有する。
	if ( value === undefined ) {
		return 1;
	}

	// 対応Tableが保存し得る数値または数値文字列だけを結合範囲として解釈する。
	if ( typeof value !== 'number' && typeof value !== 'string' ) {
		return null;
	}

	const span = Number( value );
	const normalizedSpan = Number.isInteger( span ) && span >= 1 ? span : null;
	return normalizedSpan;
};

/** Core Table固有の結合範囲表現を読み取る。 */
const coreTableSpanReader: SpanReader = {
	getRowSpan: ( cell ) => parseSpan( cell.rowspan ),
	getColumnSpan: ( cell ) => parseSpan( cell.colspan ),
};

/** Flexible Table Block固有の結合範囲表現を読み取る。 */
const flexibleTableBlockSpanReader: SpanReader = {
	getRowSpan: ( cell ) => parseSpan( cell.rowSpan ),
	getColumnSpan: ( cell ) => parseSpan( cell.colSpan ),
};

/** 配列中の1要素だけを別位置へ移した新しい配列を返す。 */
const moveArrayItem = < T >(
	items: readonly T[],
	sourceIndex: number,
	destinationIndex: number
): T[] => {
	const reordered = [ ...items ];
	const [ moved ] = reordered.splice( sourceIndex, 1 );
	reordered.splice( destinationIndex, 0, moved );
	return reordered;
};

/** 行並び替えを`body`属性だけの1回の更新へ変換する。 */
const createRowAttributesUpdate = (
	attributes: unknown,
	update: TableReorderUpdate< 'row' >
): Record< string, unknown > | null => {
	// 行並び替えは要求時点で安全に参照できる`body`配列だけを更新対象とする。
	if ( ! isRecord( attributes ) || ! Array.isArray( attributes.body ) ) {
		return null;
	}

	const { sourceIndex, destinationIndex } = update;
	const isPositionAvailable =
		Number.isInteger( sourceIndex ) &&
		Number.isInteger( destinationIndex ) &&
		sourceIndex >= 0 &&
		destinationIndex >= 0 &&
		sourceIndex < attributes.body.length &&
		destinationIndex < attributes.body.length;

	// DnD確定後に外部Tableが変化して対象位置が成立しなくなった場合は更新を開始しない。
	if ( ! isPositionAvailable ) {
		return null;
	}

	return { body: moveArrayItem( attributes.body, sourceIndex, destinationIndex ) };
};

/** 現在セルを配置できる最初の論理列位置を求める。 */
const findColumnStart = (
	occupiedUntilRow: readonly number[],
	rowIndex: number,
	minimumColumn: number,
	columnSpan: number
): number => {
	let candidate = minimumColumn;

	// 先行行の縦結合を避け、セル幅全体を配置できる最初の候補を探す。
	while ( true ) {
		let isAvailable = true;
		for ( let column = candidate; column < candidate + columnSpan; column++ ) {
			// 先行する縦結合が現在行まで占有する列には新しいセルを配置しない。
			if ( ( occupiedUntilRow[ column ] ?? 0 ) > rowIndex ) {
				isAvailable = false;
				break;
			}
		}

		// セル幅全体を配置できる候補を論理開始列として確定する。
		if ( isAvailable ) {
			return candidate;
		}

		candidate++;
	}
};

/** 1区画を結合セルを考慮した論理Tableグリッドへ対応付ける。 */
const parseSectionPlacement = (
	name: TableSectionName,
	section: unknown,
	spanReader: SpanReader
): SectionPlacement | null => {
	// `head`と`foot`は省略可能だが、存在する区画は行配列である必要がある。
	if ( section === undefined ) {
		return { name, rows: [], columnCount: 0 };
	}
	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const occupiedUntilRow: number[] = [];
	const rows: RowPlacement[] = [];
	let columnCount = 0;

	// 各行を表示順に論理Tableグリッドへ配置し、列移動時に元セルを失わず並べ替えられる位置対応を作る。
	for ( let rowIndex = 0; rowIndex < section.length; rowIndex++ ) {
		const row = section[ rowIndex ];
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		let minimumColumn = 0;
		const cells: CellPlacement[] = [];
		// 行内セルを順に配置し、縦結合が占有する列を避けた論理開始位置を確定する。
		for ( const cell of row.cells ) {
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = spanReader.getRowSpan( cell );
			const columnSpan = spanReader.getColumnSpan( cell );
			if ( rowSpan === null || columnSpan === null ) {
				return null;
			}

			const columnStart = findColumnStart( occupiedUntilRow, rowIndex, minimumColumn, columnSpan );
			const effectiveRowSpan = Math.min( rowSpan, section.length - rowIndex );

			// セルが占有する論理列へ縦結合の終了行を記録し、後続行の位置計算へ反映する。
			for ( let column = columnStart; column < columnStart + columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max(
					occupiedUntilRow[ column ] ?? 0,
					rowIndex + effectiveRowSpan
				);
			}

			cells.push( { cell, columnStart, columnSpan } );
			minimumColumn = columnStart + columnSpan;
			columnCount = Math.max( columnCount, minimumColumn );
		}

		rows.push( { row, cells } );
	}

	// 各論理位置がちょうど1セルに占有される矩形区画だけを安全な列更新対象として扱う。
	for ( let rowIndex = 0; rowIndex < section.length; rowIndex++ ) {
		for ( let column = 0; column < columnCount; column++ ) {
			let occupants = 0;
			for ( let originRow = 0; originRow <= rowIndex; originRow++ ) {
				for ( const placement of rows[ originRow ].cells ) {
					const cell = placement.cell;
					if ( ! isRecord( cell ) ) {
						return null;
					}
					const rowSpan = spanReader.getRowSpan( cell );
					if ( rowSpan === null ) {
						return null;
					}
					const occupiesRow = rowIndex < originRow + rowSpan;
					const occupiesColumn =
						column >= placement.columnStart &&
						column < placement.columnStart + placement.columnSpan;
					if ( occupiesRow && occupiesColumn ) {
						occupants++;
					}
				}
			}
			if ( occupants !== 1 ) {
				return null;
			}
		}
	}

	return { name, rows, columnCount };
};

/** 元の論理列位置を並び替え後の論理列位置へ変換する。 */
const getMovedColumnIndex = (
	column: number,
	sourceIndex: number,
	destinationIndex: number
): number => {
	if ( column === sourceIndex ) {
		return destinationIndex;
	}

	if ( sourceIndex < destinationIndex && column > sourceIndex && column <= destinationIndex ) {
		return column - 1;
	}

	if ( destinationIndex < sourceIndex && column >= destinationIndex && column < sourceIndex ) {
		return column + 1;
	}

	return column;
};

/** 列並び替えをTable全区画の1回の属性更新へ変換する。 */
const createColumnAttributesUpdate = (
	attributes: unknown,
	update: TableReorderUpdate< 'column' >,
	spanReader: SpanReader
): Record< string, unknown > | null => {
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const sections: SectionPlacement[] = [];
	// Table全体の列を一単位で移動するため、存在する全区画を同じ論理列対応で更新できることを確認する。
	for ( const name of [ 'head', 'body', 'foot' ] as const ) {
		const parsed = parseSectionPlacement( name, attributes[ name ], spanReader );
		if ( parsed === null ) {
			return null;
		}
		sections.push( parsed );
	}

	const populatedSections = sections.filter( ( section ) => section.columnCount > 0 );
	if ( populatedSections.length === 0 ) {
		return null;
	}

	const columnCount = populatedSections[ 0 ].columnCount;
	// Table全体の列は各区画で同じ論理列数を持つ必要があり、異なる場合は部分更新を開始しない。
	if ( populatedSections.some( ( section ) => section.columnCount !== columnCount ) ) {
		return null;
	}

	const { sourceIndex, destinationIndex } = update;
	const isPositionAvailable =
		Number.isInteger( sourceIndex ) &&
		Number.isInteger( destinationIndex ) &&
		sourceIndex >= 0 &&
		destinationIndex >= 0 &&
		sourceIndex < columnCount &&
		destinationIndex < columnCount;
	if ( ! isPositionAvailable ) {
		return null;
	}

	const insertionBoundary =
		destinationIndex <= sourceIndex ? destinationIndex : destinationIndex + 1;

	// DnD後の外部Table状態でも、移動元が横結合内部でなく移動先境界が横結合を分断しないことを確認する。
	for ( const section of populatedSections ) {
		for ( const row of section.rows ) {
			for ( const placement of row.cells ) {
				const startsBeforeSource = placement.columnStart <= sourceIndex;
				const endsAfterSource = sourceIndex < placement.columnStart + placement.columnSpan;
				if ( startsBeforeSource && endsAfterSource && placement.columnSpan > 1 ) {
					return null;
				}

				const splitsMergedCell =
					placement.columnSpan > 1 &&
					insertionBoundary > placement.columnStart &&
					insertionBoundary < placement.columnStart + placement.columnSpan;
				if ( splitsMergedCell ) {
					return null;
				}
			}
		}
	}

	const attributesUpdate: Record< string, unknown > = {};
	// 各区画の元セルを新しい論理列位置順へ並べ替え、セル内容・属性・結合範囲は変更せず保持する。
	for ( const section of sections ) {
		if ( attributes[ section.name ] === undefined ) {
			continue;
		}

		attributesUpdate[ section.name ] = section.rows.map( ( row ) => {
			const cells = [ ...row.cells ].sort( ( left, right ) => {
				const leftStart = getMovedColumnIndex( left.columnStart, sourceIndex, destinationIndex );
				const rightStart = getMovedColumnIndex( right.columnStart, sourceIndex, destinationIndex );
				return leftStart - rightStart;
			} );
			return { ...row.row, cells: cells.map( ( placement ) => placement.cell ) };
		} );
	}

	return attributesUpdate;
};

/** Core Tableの行・列更新規則。 */
const coreTableUpdater: TableDataUpdater = {
	createAttributesUpdate: ( attributes, update ) => {
		// Table Integrationは更新に含まれる具体方向に応じてBlock固有のデータ更新規則だけを選択する。
		if ( update.kind === 'row' ) {
			return createRowAttributesUpdate( attributes, update );
		}
		return createColumnAttributesUpdate( attributes, update, coreTableSpanReader );
	},
};

/** Flexible Table Blockの行・列更新規則。 */
const flexibleTableBlockUpdater: TableDataUpdater = {
	createAttributesUpdate: ( attributes, update ) => {
		// Table Integrationは更新に含まれる具体方向に応じてBlock固有のデータ更新規則だけを選択する。
		if ( update.kind === 'row' ) {
			return createRowAttributesUpdate( attributes, update );
		}
		return createColumnAttributesUpdate( attributes, update, flexibleTableBlockSpanReader );
	},
};

/** 対応Table Block名からBlock固有更新規則を選択する対応表。 */
const TABLE_UPDATERS: Readonly< Partial< Record< string, TableDataUpdater > > > = {
	'core/table': coreTableUpdater,
	'flexible-table-block/table': flexibleTableBlockUpdater,
};

/** Block属性値が期待した更新結果と同じ内容か再帰的に確認する。 */
const areEquivalent = ( actual: unknown, expected: unknown ): boolean => {
	if ( Object.is( actual, expected ) ) {
		return true;
	}

	if ( Array.isArray( actual ) || Array.isArray( expected ) ) {
		if (
			! Array.isArray( actual ) ||
			! Array.isArray( expected ) ||
			actual.length !== expected.length
		) {
			return false;
		}
		return actual.every( ( value, index ) => areEquivalent( value, expected[ index ] ) );
	}

	if ( ! isRecord( actual ) || ! isRecord( expected ) ) {
		return false;
	}

	const expectedKeys = Object.keys( expected );
	return expectedKeys.every(
		( key ) => key in actual && areEquivalent( actual[ key ], expected[ key ] )
	);
};

/**
 * 対応Table Blockの更新を提供するTable Integration境界を作成する。
 *
 * @param blockStore 現在Blockの取得と1回の属性更新を提供するBlock Editorストア契約。
 * @return 状態を保持せず、要求ごとに外部Table状態を確認する更新境界。
 */
export const createTableUpdateIntegration = (
	blockStore: TableUpdateBlockStore
): TableUpdateIntegration => ( {
	updateReorder: ( update ) => {
		const block = blockStore.getBlock( update.clientId );
		if ( ! block ) {
			return { status: 'unavailable' };
		}

		const updater = TABLE_UPDATERS[ block.name ];
		if ( ! updater ) {
			return { status: 'unavailable' };
		}

		const attributesUpdate = updater.createAttributesUpdate( block.attributes, update );
		// 現在の外部Table状態を安全に更新表現へ変換できない場合は更新を開始しない。
		if ( attributesUpdate === null ) {
			return { status: 'unavailable' };
		}

		blockStore.updateBlockAttributes( update.clientId, attributesUpdate );

		const updatedBlock = blockStore.getBlock( update.clientId );
		// 更新開始後に対象Tableを取得できなくなった場合は成立状態を推測しない。
		if (
			! updatedBlock ||
			updatedBlock.name !== block.name ||
			! isRecord( updatedBlock.attributes )
		) {
			return { status: 'unconfirmed' };
		}

		const isConfirmed = areEquivalent( updatedBlock.attributes, attributesUpdate );
		const result: TableUpdateResult = isConfirmed
			? { status: 'updated' }
			: { status: 'unconfirmed' };
		return result;
	},
} );
