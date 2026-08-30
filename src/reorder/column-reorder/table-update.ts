/**
 * 列並び替えに固有のTableデータ更新規則を提供する。
 *
 * 列更新ではTable全区画を同じ論理列グリッドとして扱い、結合セルを分断しない範囲で列順だけを変更する。
 * セル内容、属性、装飾、結合範囲は保持し、対応Table Block固有の属性構造はTable Integrationへ委譲する。
 */
import type {
	ConcreteTableReorderUpdate,
	TableUpdateCell,
	TableUpdateChanges,
	TableUpdateData,
	TableUpdateRow,
	TableUpdateSection,
	TableUpdateSectionName,
} from '@/reorder/foundation/table-update';

/** 列更新時に1セルが元の論理Tableグリッド上で占有する範囲。 */
type CellPlacement = {
	cell: TableUpdateCell;
	columnStart: number;
	rowSpan: number;
	columnSpan: number;
};

/** 列更新時に1行を元の論理Tableグリッドへ対応付けた表現。 */
type RowPlacement = {
	row: TableUpdateRow;
	cells: readonly CellPlacement[];
};

/** 1区画の存在状態、元データ、論理列数。 */
type SectionPlacement = {
	name: TableUpdateSectionName;
	exists: boolean;
	rows: readonly RowPlacement[];
	columnCount: number;
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
 * 欠落や重複のない矩形グリッドとして成立しない区画は列更新対象にしない。
 *
 * @param name    対応付けるTable区画。
 * @param section Table Integrationが作成した現在区画の共通更新用データ。
 * @return 論理列対応を持つ区画。安全な論理グリッドとして成立しない場合は`null`。
 */
const resolveSectionPlacement = (
	name: TableUpdateSectionName,
	section: TableUpdateSection
): SectionPlacement | null => {
	// 元Tableに存在しない区画は列数0の空区画として保持し、更新時にも新規作成しない。
	if ( ! section.exists ) {
		return { name, exists: false, rows: [], columnCount: 0 };
	}

	const occupiedUntilRow: number[] = [];
	const rows: RowPlacement[] = [];
	let columnCount = 0;

	// 各行を表示順に論理Tableグリッドへ配置し、列移動時に元セルを失わず並べ替えられる位置対応を作る。
	for ( let rowIndex = 0; rowIndex < section.rows.length; rowIndex++ ) {
		const row = section.rows[ rowIndex ];
		let minimumColumn = 0;
		const cells: CellPlacement[] = [];

		// 行内セルを順に配置し、縦結合が占有する列を避けた論理開始位置を確定する。
		for ( const cell of row.cells ) {
			// 列の論理グリッドを確定するには縦横両方の結合範囲が必要であり、解釈できないセルがあれば列更新しない。
			if ( cell.rowSpan === null || cell.columnSpan === null ) {
				return null;
			}

			const rowSpan = cell.rowSpan;
			const columnSpan = cell.columnSpan;
			const columnStart = findColumnStart( occupiedUntilRow, rowIndex, minimumColumn, columnSpan );
			const effectiveRowSpan = Math.min( rowSpan, section.rows.length - rowIndex );

			// セルが占有する論理列へ縦結合の終了行を記録し、後続行の位置計算へ反映する。
			for ( let column = columnStart; column < columnStart + columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max(
					occupiedUntilRow[ column ] ?? 0,
					rowIndex + effectiveRowSpan
				);
			}

			cells.push( { cell, columnStart, rowSpan, columnSpan } );
			minimumColumn = columnStart + columnSpan;
			columnCount = Math.max( columnCount, minimumColumn );
		}

		rows.push( { row, cells } );
	}

	// 区画の全論理位置について占有セルを確認し、欠落や重複がない矩形グリッドだけを列更新対象とする。
	for ( let rowIndex = 0; rowIndex < section.rows.length; rowIndex++ ) {
		for ( let column = 0; column < columnCount; column++ ) {
			let occupants = 0;
			// 現在位置へ届き得る先行行を確認し、縦結合を含めてその位置を占有するセル数を数える。
			for ( let originRow = 0; originRow <= rowIndex; originRow++ ) {
				for ( const placement of rows[ originRow ].cells ) {
					const occupiesRow = rowIndex < originRow + placement.rowSpan;
					const occupiesColumn =
						column >= placement.columnStart &&
						column < placement.columnStart + placement.columnSpan;
					// 現在位置を縦横とも占有するセルだけを、この論理位置の占有セルとして数える。
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

	return { name, exists: true, rows, columnCount };
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
 * 確定済み列並び替えをTable全区画のTableデータ変更へ変換する。
 *
 * @param table  Table Integrationが要求時点の対応Tableから作成した共通更新用データ。
 * @param update Table全体の移動元・移動後位置を持つ確定済み列更新。
 * @return 存在する全区画を含む変更。現在状態で安全に適用できない場合は`null`。
 */
export const resolveColumnTableUpdateChanges = (
	table: TableUpdateData,
	update: ConcreteTableReorderUpdate< 'column' >
): TableUpdateChanges | null => {
	const sections: SectionPlacement[] = [];
	// Table全体の列を一単位で移動するため、存在する全区画を同じ論理列対応で更新できることを確認する。
	for ( const name of [ 'head', 'body', 'foot' ] as const ) {
		const placement = resolveSectionPlacement( name, table[ name ] );
		// 1区画でも安全な論理グリッドとして成立しなければ、Table全体の列更新を開始しない。
		if ( placement === null ) {
			return null;
		}
		sections.push( placement );
	}

	const populatedSections = sections.filter( ( section ) => section.columnCount > 0 );
	const [ firstPopulatedSection ] = populatedSections;
	// 並び替える列を持つ区画が1つもなければ、列更新として成立させない。
	if ( firstPopulatedSection === undefined ) {
		return null;
	}

	const columnCount = firstPopulatedSection.columnCount;
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

	const changes: TableUpdateChanges = {};
	// 存在する各区画の元セルを新しい論理列位置順へ並べ替え、セル内容・属性・結合範囲は変更せず保持する。
	for ( const section of sections ) {
		// 元Tableに存在しない区画は属性変更へ含めず、新しい区画を作成しない。
		if ( ! section.exists ) {
			continue;
		}

		changes[ section.name ] = section.rows.map( ( row ) => {
			const cells = [ ...row.cells ].sort( ( left, right ) => {
				const leftStart = getMovedColumnIndex( left.columnStart, sourceIndex, destinationIndex );
				const rightStart = getMovedColumnIndex( right.columnStart, sourceIndex, destinationIndex );
				return leftStart - rightStart;
			} );
			return { data: row.row.data, cells: cells.map( ( placement ) => placement.cell ) };
		} );
	}

	return changes;
};
