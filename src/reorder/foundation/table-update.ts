/**
 * Table Integrationが確定済み並び替えを対応Table Blockのデータ更新へ適応する境界を提供する。
 *
 * Reorder coreからは方向と移動前後の共通位置だけを受け取り、Core TableとFlexible Table Block固有の
 * 属性構造へ変換する。更新は1回のBlock属性更新として開始し、その直後に現在Blockを再取得して
 * 成立を確認できた場合だけ`updated`を返す。
 */
import type { ConcreteReorderKind, ReorderKind } from '@/reorder/core/reorder-types';

/** Reorder coreからTable Integrationへ渡す方向共通の更新表現。 */
export type TableReorderUpdate< K extends ReorderKind = ReorderKind > = K extends ReorderKind
	? {
			kind: K;
			clientId: string;
			/** 並び替え前の0-based位置。 */
			sourceIndex: number;
			/** 並び替え後に対象が占める0-based位置。 */
			destinationIndex: number;
	  }
	: never;

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

/**
 * Table属性、行、セルとして安全に参照できるオブジェクトか判定する。
 *
 * 外部Tableデータを推測で解釈しないため、配列や`null`を属性オブジェクトとして扱わない。
 *
 * @param value 外部Tableデータから受け取った判定対象。
 * @return 属性を安全に参照できるオブジェクトなら`true`。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * 対応Table固有セルに保存された結合範囲を共通の占有数へ正規化する。
 *
 * 結合指定がない通常セルは1として扱い、指定がある場合は1以上の整数だけを有効な結合範囲とする。
 *
 * @param value 対応Table固有セルから取得した結合範囲値。
 * @return 1以上の占有数。安全に解釈できない値では`null`。
 */
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
	// Table上の占有数は1以上の整数である必要があり、それ以外から有効な構造を推測しない。
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

/**
 * 1つの並び替え対象だけを別位置へ移した新しい配列を作成する。
 *
 * 元の配列と各要素の内容は変更せず、Tableの行または物理セルの順序だけを変更するために利用する。
 *
 * @param items            並び替え前の行またはセル一覧。
 * @param sourceIndex      並び替え前の移動元位置。
 * @param destinationIndex 並び替え後に対象が占める位置。
 * @return 対象だけを指定位置へ移した新しい配列。
 */
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

/**
 * 行並び替えを`body`属性だけの1回の更新へ変換する。
 *
 * 行全体を移動単位とし、セル内容・行属性には触れず`body`の順序だけを変更する。
 *
 * @param attributes 要求時点の対応Table属性。
 * @param update     `body`区画内の移動元・移動後位置を持つ確定済み行更新。
 * @return `body`だけを含む属性差分。現在状態で安全に適用できない場合は`null`。
 */
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

/**
 * 現在セルを配置できる最初の論理列位置を求める。
 *
 * 先行行の縦結合が占有する列を避け、セルの横幅全体を配置できる最初の位置を採用する。
 *
 * @param occupiedUntilRow 各論理列が先行する縦結合に占有される終了行。
 * @param rowIndex         現在セルが属する区画内の0-based行位置。
 * @param minimumColumn    現在セルについて探索を開始する最小論理列位置。
 * @param columnSpan       現在セルが横方向に占有する列数。
 * @return 現在セルを配置できる最初の0-based論理列位置。
 */
const findColumnStart = (
	occupiedUntilRow: readonly number[],
	rowIndex: number,
	minimumColumn: number,
	columnSpan: number
): number => {
	let candidate = minimumColumn;

	// 先行行の縦結合を避け、セル幅全体を配置できる最初の候補が確定するまで探索する。
	while ( true ) {
		let isAvailable = true;
		// 候補位置からセルが占有する全論理列を確認し、縦結合との重なりがない位置だけを採用する。
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

/**
 * 1つのTable区画を結合セルを考慮した論理Tableグリッドへ対応付ける。
 *
 * 元のセル内容や属性を保持したまま列順だけを変更できるよう、各セルの論理開始列と占有列数を確定する。
 * 安全な矩形グリッドとして解釈できない区画は列更新対象にしない。
 *
 * @param name       対応付けるTable区画。
 * @param section    要求時点の対応Table固有区画データ。
 * @param spanReader 対応Table種類に応じた結合範囲の読み取り規則。
 * @return 論理列対応を持つ区画。安全に解釈できない場合は`null`。
 */
const parseSectionPlacement = (
	name: TableSectionName,
	section: unknown,
	spanReader: SpanReader
): SectionPlacement | null => {
	// 存在しない区画は空区画として扱い、Table全体として更新可能かどうかは呼び出し側で判断する。
	if ( section === undefined ) {
		return { name, rows: [], columnCount: 0 };
	}

	// 存在する区画を行一覧として解釈できない場合は、列更新に利用できる構造を推測しない。
	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const occupiedUntilRow: number[] = [];
	const rows: RowPlacement[] = [];
	let columnCount = 0;

	// 各行を表示順に論理Tableグリッドへ配置し、列移動時に元セルを失わず並べ替えられる位置対応を作る。
	for ( let rowIndex = 0; rowIndex < section.length; rowIndex++ ) {
		const row = section[ rowIndex ];
		// 区画内の各行は、セル一覧を保持するTable行として安全に参照できる必要がある。
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		let minimumColumn = 0;
		const cells: CellPlacement[] = [];
		// 行内セルを順に配置し、縦結合が占有する列を避けた論理開始位置を確定する。
		for ( const cell of row.cells ) {
			// 各セルは結合範囲を安全に参照できるTableセルとして成立する必要がある。
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = spanReader.getRowSpan( cell );
			const columnSpan = spanReader.getColumnSpan( cell );
			// 縦横どちらかの占有範囲を確定できないセルがあれば、区画全体を更新対象として成立させない。
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

	// 区画の全論理位置について占有セルを確認し、欠落や重複がない矩形グリッドだけを列更新対象とする。
	for ( let rowIndex = 0; rowIndex < section.length; rowIndex++ ) {
		for ( let column = 0; column < columnCount; column++ ) {
			let occupants = 0;
			// 現在位置へ届き得る先行行を確認し、縦結合を含めてその位置を占有するセル数を数える。
			for ( let originRow = 0; originRow <= rowIndex; originRow++ ) {
				for ( const placement of rows[ originRow ].cells ) {
					const cell = placement.cell;
					// 位置対応作成後も外部セルを安全に参照できることを前提にせず、成立確認時に再確認する。
					if ( ! isRecord( cell ) ) {
						return null;
					}

					const rowSpan = spanReader.getRowSpan( cell );
					// 縦方向の占有範囲を確認できなければ、その論理位置の成立を保証しない。
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

			// 1つの論理位置に占有セルの欠落または重複があれば、有効なTable構造として列更新しない。
			if ( occupants !== 1 ) {
				return null;
			}
		}
	}

	return { name, rows, columnCount };
};

/**
 * 元の論理列位置を並び替え後の論理列位置へ変換する。
 *
 * 移動対象の最終位置と、その移動によって1列ずつ詰まる範囲だけを変換し、影響範囲外の列位置は維持する。
 *
 * @param column           並び替え前の論理列位置。
 * @param sourceIndex      並び替え前の移動元位置。
 * @param destinationIndex 並び替え後に移動対象が占める位置。
 * @return 並び替え後の論理列位置。
 */
const getMovedColumnIndex = (
	column: number,
	sourceIndex: number,
	destinationIndex: number
): number => {
	// 移動対象列自身は確定済みの移動後位置へ対応付ける。
	if ( column === sourceIndex ) {
		return destinationIndex;
	}

	// 右方向への移動では、移動元より後ろから移動先までの列を1列ずつ左へ詰める。
	if ( sourceIndex < destinationIndex && column > sourceIndex && column <= destinationIndex ) {
		return column - 1;
	}

	// 左方向への移動では、移動先から移動元直前までの列を1列ずつ右へずらす。
	if ( destinationIndex < sourceIndex && column >= destinationIndex && column < sourceIndex ) {
		return column + 1;
	}

	// 移動範囲外の列は元の論理位置を維持する。
	return column;
};

/**
 * 列並び替えをTable全区画の1回の属性更新へ変換する。
 *
 * 各区画を同じ論理列グリッドとして扱い、セル内容・属性・結合範囲を変更せず物理セル順だけを更新する。
 * DnD確定後の外部状態でも結合セルを分断しない場合にだけ更新差分を成立させる。
 *
 * @param attributes 要求時点の対応Table属性。
 * @param update     Table全体の移動元・移動後位置を持つ確定済み列更新。
 * @param spanReader 対応Table種類に応じた結合範囲の読み取り規則。
 * @return 存在する全区画を含む属性差分。現在状態で安全に適用できない場合は`null`。
 */
const createColumnAttributesUpdate = (
	attributes: unknown,
	update: TableReorderUpdate< 'column' >,
	spanReader: SpanReader
): Record< string, unknown > | null => {
	// 列更新では複数区画を一組として扱うため、Table属性全体を安全に参照できる必要がある。
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const sections: SectionPlacement[] = [];
	// Table全体の列を一単位で移動するため、存在する全区画を同じ論理列対応で更新できることを確認する。
	for ( const name of [ 'head', 'body', 'foot' ] as const ) {
		const parsed = parseSectionPlacement( name, attributes[ name ], spanReader );
		// 1区画でも安全に論理列へ対応付けられなければ、Table全体の部分更新を開始しない。
		if ( parsed === null ) {
			return null;
		}
		sections.push( parsed );
	}

	const populatedSections = sections.filter( ( section ) => section.columnCount > 0 );
	// 並び替える列を持つ区画が1つもなければ、列更新として成立させない。
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
	// DnD確定後の外部Tableで移動元または移動後位置が成立しなくなった場合は更新を開始しない。
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
				// 移動元列が現在の横結合セルに含まれる場合、そのセルを列単位へ分解せず更新を中止する。
				if ( startsBeforeSource && endsAfterSource && placement.columnSpan > 1 ) {
					return null;
				}

				const splitsMergedCell =
					placement.columnSpan > 1 &&
					insertionBoundary > placement.columnStart &&
					insertionBoundary < placement.columnStart + placement.columnSpan;
				// 移動先が横結合範囲の内部境界なら、結合を分断する更新を開始しない。
				if ( splitsMergedCell ) {
					return null;
				}
			}
		}
	}

	const attributesUpdate: Record< string, unknown > = {};
	// 各区画の元セルを新しい論理列位置順へ並べ替え、セル内容・属性・結合範囲は変更せず保持する。
	for ( const section of sections ) {
		// 元Tableに存在しない区画は新たに作らず、既存区画だけを属性更新へ含める。
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

/**
 * Block属性のうち今回の更新対象が期待した内容へ反映されたか確認する。
 *
 * 更新差分に含まれる値だけを再帰的に比較し、更新対象外のBlock属性が存在していても成立確認を妨げない。
 *
 * @param actual   更新後に再取得したBlock属性またはその部分値。
 * @param expected 今回の更新差分で期待する属性またはその部分値。
 * @return 更新対象の内容が期待結果と等価なら`true`。
 */
const areEquivalent = ( actual: unknown, expected: unknown ): boolean => {
	// 同一値または同一参照なら、その更新対象は期待結果と一致している。
	if ( Object.is( actual, expected ) ) {
		return true;
	}

	// どちらかが配列なら、両方が同じ要素数の配列として各位置の内容まで一致する必要がある。
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

	// 配列以外は両方とも属性オブジェクトとして参照できる場合だけ部分属性を比較する。
	if ( ! isRecord( actual ) || ! isRecord( expected ) ) {
		return false;
	}

	const expectedKeys = Object.keys( expected );
	// 更新差分に含まれる各属性だけを確認し、今回変更していない外部属性は成立判定の対象にしない。
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
		// DnD確定後に対象Tableが存在しなくなった場合は、過去の状態で更新を推測せず開始不可として返す。
		if ( ! block ) {
			return { status: 'unavailable' };
		}

		const updater = TABLE_UPDATERS[ block.name ];
		// 要求時点で対応対象ではないTable種類へ更新方法を推測して適用しない。
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
		// 更新開始後に対象Tableを取得できなくなった場合やTable種類が変化した場合は成立状態を推測しない。
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
