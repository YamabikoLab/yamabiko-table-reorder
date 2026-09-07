/**
 * 列DnDで利用する、Table全体の論理列境界のDOM計測を提供する。
 *
 * Destination Resolutionと将来のReorder Presentationが同じ列境界の定義を重複して持たないよう、
 * 現在のTableに描画されたセルから観測できる論理列境界をTable相対位置として返す。
 * DnD状態、表示状態、Lifecycleは所有せず、呼び出された時点のDOMだけを計測する。
 */

/** Table内の論理列進行方向。 */
export type ColumnInlineDirection = 'ltr' | 'rtl';

/** Table内で観測できた論理列境界の論理進行方向上の位置。 */
export type ColumnBoundaryGeometry = {
	/** Table全体の0-based論理列間境界。 */
	index: number;
	/** Tableの論理開始端を基準として、論理列進行方向へ増加する境界位置。 */
	offset: number;
};

/** 各論理列で、前の行から継続するrowspanが残っている行数。 */
type RemainingRowSpan = number[];

/**
 * 対象Tableの論理列進行方向を現在のEditor DOMから解決する。
 *
 * 継承された`direction`も含めて実際の描画方向を利用し、RTL Editorでも論理列番号と物理配置を同じ基準へ正規化する。
 *
 * @param table 列DnDの対象となるTable要素。
 * @return Tableの論理列進行方向。
 */
export const resolveTableColumnInlineDirection = (
	table: HTMLTableElement
): ColumnInlineDirection => {
	const editorWindow = table.ownerDocument.defaultView;
	const computedDirection = editorWindow?.getComputedStyle( table ).direction;
	const inlineDirection: ColumnInlineDirection = computedDirection === 'rtl' ? 'rtl' : 'ltr';
	return inlineDirection;
};

/**
 * 現在行でセルを配置できる次の論理列位置を解決する。
 *
 * @param remainingRowSpans 前の行から継続する縦結合の占有状態。
 * @param startIndex        探索を開始する論理列位置。
 * @return 現在行で次のセルを配置できる論理列位置。
 */
const resolveNextAvailableColumnIndex = (
	remainingRowSpans: RemainingRowSpan,
	startIndex: number
): number => {
	let columnIndex = startIndex;

	/* 縦結合が占有する論理列を飛ばし、現在行のセルが実際に開始する位置を確定する。 */
	while ( ( remainingRowSpans[ columnIndex ] ?? 0 ) > 0 ) {
		columnIndex += 1;
	}

	return columnIndex;
};

/**
 * 既に観測済みの論理列境界を保ちつつ、新しい境界位置を記録する。
 *
 * 同じ論理境界はTable内の複数行から観測できる。開始時Table配置の列境界として最初に観測した位置を採用し、
 * 行ごとの装飾差や小さな描画差によって同一境界の基準が揺れないようにする。
 *
 * @param boundaries 論理列間境界ごとの論理進行方向上の位置。
 * @param index      記録する0-based論理列間境界。
 * @param offset     Tableの論理開始端を基準とする境界位置。
 */
const recordBoundary = (
	boundaries: Map< number, number >,
	index: number,
	offset: number
): void => {
	/* 同一論理境界はDnD開始時に最初に観測した位置を基準とし、別行の観測値で開始時配置を揺らさない。 */
	if ( ! boundaries.has( index ) ) {
		boundaries.set( index, offset );
	}
};

/**
 * 現在のTableに描画されたセルから、観測可能な論理列境界を論理進行方向上の位置として計測する。
 *
 * 横結合セルの内部境界はDOMから実測できないため推測しない。別の行で同じ論理境界を観測できる場合だけ境界として返す。
 * LTRでは左端、RTLでは右端を論理開始位置0として正規化し、論理列番号が増える方向とoffsetが増える方向を一致させる。
 * これにより不等幅列や結合セルを含むTableでも、実際の描画位置にない境界を人工的に生成しない。
 *
 * @param table 列DnDの対象となるTable要素。
 * @return 論理列間境界順に並んだ、観測可能な論理進行方向上の位置。
 */
export const measureTableColumnBoundaryGeometry = (
	table: HTMLTableElement
): readonly ColumnBoundaryGeometry[] => {
	const tableRectangle = table.getBoundingClientRect();
	const inlineDirection = resolveTableColumnInlineDirection( table );
	const boundaries = new Map< number, number >();
	const remainingRowSpans: RemainingRowSpan = [];
	const rows = Array.from( table.rows );
	let currentSection: Element | null = null;

	/* Table全体で同じ論理列番号を維持するため、同一section内では縦結合による占有状態を引き継ぎながら各行を解釈する。 */
	rows.forEach( ( row ) => {
		/* rowspanは行グループを跨がないため、sectionが変わった時点で前sectionの占有状態を持ち越さない。 */
		if ( row.parentElement !== currentSection ) {
			remainingRowSpans.length = 0;
			currentSection = row.parentElement;
		}

		let nextColumnIndex = 0;

		/* 現在行の各セルを論理列へ対応付け、DOMから直接観測できる左右境界だけを開始時配置へ記録する。 */
		Array.from( row.cells ).forEach( ( cell ) => {
			const columnStart = resolveNextAvailableColumnIndex( remainingRowSpans, nextColumnIndex );
			const columnSpan = Math.max( cell.colSpan, 1 );
			const columnEnd = columnStart + columnSpan;
			const rectangle = cell.getBoundingClientRect();
			let columnStartOffset = rectangle.left - tableRectangle.left;
			let columnEndOffset = rectangle.right - tableRectangle.left;

			/* RTLでは右端を論理開始位置とし、論理列番号と境界offsetが同じ向きに増えるよう物理位置を正規化する。 */
			if ( inlineDirection === 'rtl' ) {
				columnStartOffset = tableRectangle.right - rectangle.right;
				columnEndOffset = tableRectangle.right - rectangle.left;
			}

			recordBoundary( boundaries, columnStart, columnStartOffset );
			recordBoundary( boundaries, columnEnd, columnEndOffset );

			const rowSpan = Math.max( cell.rowSpan, 1 );

			/* 縦結合セルが後続行でも占有する論理列を記録し、次行のセルを同じ列へ重ねて解釈しない。 */
			if ( rowSpan > 1 ) {
				for ( let index = columnStart; index < columnEnd; index += 1 ) {
					remainingRowSpans[ index ] = Math.max( remainingRowSpans[ index ] ?? 0, rowSpan );
				}
			}

			nextColumnIndex = columnEnd;
		} );

		/* 次の行では、現在行を消費した縦結合だけ残す。 */
		for ( let index = 0; index < remainingRowSpans.length; index += 1 ) {
			const remaining = remainingRowSpans[ index ] ?? 0;
			remainingRowSpans[ index ] = Math.max( remaining - 1, 0 );
		}
	} );

	/* 呼び出し側がTable内の論理順だけを基準に扱えるよう、観測順ではなく列間境界順で返す。 */
	return Array.from( boundaries, ( [ index, offset ] ) => ( {
		index,
		offset,
	} ) ).sort( ( first, second ) => first.index - second.index );
};
