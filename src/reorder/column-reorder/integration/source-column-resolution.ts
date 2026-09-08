/**
 * Column Reorderで、現在TableのセルをTable全体の論理列位置へ対応付けるDOM解決境界を所有する。
 *
 * Input InteractionとReorder Presentationが同じ結合セル解釈を利用できるよう、rowspanとcolspanを反映した論理列解決を提供する。
 * 単発入力では対象section内を必要な位置まで解釈し、PresentationではTableごとに一度構築した対応関係を再利用できる。
 */

/** 各論理列で、前の行から継続するrowspanが残っている行数。 */
type RemainingRowSpan = number[];

/** 論理列へ対応付けたセルを受け取り、同じsectionの解釈を続けるか決める処理。 */
type LogicalCellVisitor = ( cell: HTMLTableCellElement, columnStart: number ) => boolean;

/**
 * 現在行でセルを配置できる次の論理列位置を解決する。
 *
 * @param remainingRowSpans 前の行から継続する縦結合の占有状態。
 * @param startIndex        探索を開始する論理列位置。
 * @return 現在セルを配置できる0-based論理列位置。
 */
const resolveNextAvailableColumnIndex = (
	remainingRowSpans: RemainingRowSpan,
	startIndex: number
): number => {
	let columnIndex = startIndex;

	/* 前行から継続する縦結合が占有する列を除外し、現在セルが開始する論理列を求める。 */
	while ( ( remainingRowSpans[ columnIndex ] ?? 0 ) > 0 ) {
		columnIndex += 1;
	}

	return columnIndex;
};

/**
 * 一つのTable sectionを、結合範囲を反映した論理列順で解釈する。
 *
 * @param table   Column Reorder対象Table。
 * @param section 解釈するTable直下section。
 * @param visitor 各セルの論理列位置を受け取る処理。falseを返すとその時点で終了する。
 */
const visitSectionLogicalCells = (
	table: HTMLTableElement,
	section: HTMLTableSectionElement,
	visitor: LogicalCellVisitor
): void => {
	/* 対象Table直下の標準sectionだけをTable全体の論理列として解釈する。 */
	if (
		section.parentElement !== table ||
		! [ 'THEAD', 'TBODY', 'TFOOT' ].includes( section.tagName )
	) {
		return;
	}

	const remainingRowSpans: RemainingRowSpan = [];

	/* 同一section内では前行から継続する縦結合を引き継ぎ、物理セルをTable全体の論理列へ対応付ける。 */
	for ( const row of Array.from( section.rows ) ) {
		let nextColumnIndex = 0;

		/* 一行内のセル順と結合幅を保ちながら、各セルが開始する論理列を確定する。 */
		for ( const cell of Array.from( row.cells ) ) {
			const columnStart = resolveNextAvailableColumnIndex( remainingRowSpans, nextColumnIndex );
			const columnSpan = Math.max( cell.colSpan, 1 );
			const columnEnd = columnStart + columnSpan;
			const shouldContinue = visitor( cell, columnStart );

			if ( ! shouldContinue ) {
				return;
			}

			const rowSpan = Math.max( cell.rowSpan, 1 );

			/* 後続行でも同じ論理列を占有する縦結合を記録し、別セルを重ねて解釈しない。 */
			if ( rowSpan > 1 ) {
				for ( let index = columnStart; index < columnEnd; index += 1 ) {
					remainingRowSpans[ index ] = Math.max( remainingRowSpans[ index ] ?? 0, rowSpan );
				}
			}

			nextColumnIndex = columnEnd;
		}

		/* 次行へ進む前に現在行で消費した縦結合期間を1行分減らす。 */
		for ( let index = 0; index < remainingRowSpans.length; index += 1 ) {
			const remaining = remainingRowSpans[ index ] ?? 0;
			remainingRowSpans[ index ] = Math.max( remaining - 1, 0 );
		}
	}
};

/**
 * 対象セルが属するTable直下sectionを取得する。
 *
 * @param table      Column Reorder対象Table。
 * @param targetCell 論理列位置を解決するセル。
 * @return 対象Table直下の標準section。対象外のセルではnull。
 */
const resolveDirectTableSection = (
	table: HTMLTableElement,
	targetCell: HTMLTableCellElement
): HTMLTableSectionElement | null => {
	const targetRow = targetCell.parentElement;
	const targetSection = targetRow?.parentElement;

	/* 入れ子Tableや標準section外のセルは、現在Tableの列開始対象として扱わない。 */
	if (
		! targetRow ||
		targetRow.tagName !== 'TR' ||
		! targetSection ||
		! [ 'THEAD', 'TBODY', 'TFOOT' ].includes( targetSection.tagName ) ||
		targetSection.parentElement !== table
	) {
		return null;
	}

	return targetSection as HTMLTableSectionElement;
};

/**
 * 現在Table内のセルが開始する0-based論理列位置を解決する。
 *
 * 単発の開始入力では対象sectionだけを解釈し、対象セルへ到達した時点で終了する。
 *
 * @param table      Column Reorder対象Table。
 * @param targetCell ポインター入力が開始されたTableセル。
 * @return 対象セルが開始する0-based論理列位置。安全に解釈できない場合はnull。
 */
export const resolveColumnSourceIndex = (
	table: HTMLTableElement,
	targetCell: HTMLTableCellElement
): number | null => {
	const section = resolveDirectTableSection( table, targetCell );
	if ( section === null ) {
		return null;
	}

	let sourceColumnIndex: number | null = null;
	visitSectionLogicalCells( table, section, ( cell, columnStart ) => {
		if ( cell === targetCell ) {
			sourceColumnIndex = columnStart;
			return false;
		}
		return true;
	} );
	return sourceColumnIndex;
};

/** 同一Tableで複数セルの論理列位置を再利用する解決境界。 */
export type ColumnSourceIndexResolver = {
	/**
	 * @param cell 現在Table内のセル。
	 * @return セルが開始する0-based論理列位置。対象外のセルではnull。
	 */
	resolve: ( cell: HTMLTableCellElement ) => number | null;
};

/**
 * 現在Tableのセルと論理列位置の対応を一度だけ解釈し、複数の表示判定で再利用できるResolverを生成する。
 *
 * HighlightのホットパスではこのResolverを再利用することで、ホバー対象変更ごとに対象行までの走査を繰り返さない。
 *
 * @param table Column Reorder対象Table。
 * @return 現在DOMを基準とするセル→論理列Resolver。
 */
export const createColumnSourceIndexResolver = (
	table: HTMLTableElement
): ColumnSourceIndexResolver => {
	const columnIndexes = new WeakMap< HTMLTableCellElement, number >();

	/* Table直下の各sectionを独立したrowspan範囲として解釈し、現在DOMのセル位置を一度だけ記録する。 */
	for ( const child of Array.from( table.children ) ) {
		if ( ! [ 'THEAD', 'TBODY', 'TFOOT' ].includes( child.tagName ) ) {
			continue;
		}
		visitSectionLogicalCells( table, child as HTMLTableSectionElement, ( cell, columnStart ) => {
			columnIndexes.set( cell, columnStart );
			return true;
		} );
	}

	return {
		resolve: ( cell ) => columnIndexes.get( cell ) ?? null,
	};
};
