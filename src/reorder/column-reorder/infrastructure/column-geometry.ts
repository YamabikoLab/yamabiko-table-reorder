/**
 * 列DnDで利用する、Table全体の論理列境界のDOM計測を提供する。
 *
 * Destination Resolutionと将来のReorder Presentationが同じ列境界の定義を重複して持たないよう、
 * 現在のTableに描画されたセルから観測できる論理列境界をTable相対位置として返す。
 * DnD状態、表示状態、Lifecycleは所有せず、呼び出された時点のDOMだけを計測する。
 */

/** Table内で観測できた論理列境界のTable相対横位置。 */
export type ColumnBoundaryGeometry = {
	/** Table全体の0-based論理列間境界。 */
	index: number;
	/** Table左端を基準とする境界の横位置。 */
	offset: number;
};

/** 各論理列で、前の行から継続するrowspanが残っている行数。 */
type RemainingRowSpan = number[];

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
 * @param boundaries 論理列間境界ごとのTable相対横位置。
 * @param index      記録する0-based論理列間境界。
 * @param offset     Table左端を基準とする境界の横位置。
 */
const recordBoundary = (
	boundaries: Map< number, number >,
	index: number,
	offset: number
): void => {
	if ( ! boundaries.has( index ) ) {
		boundaries.set( index, offset );
	}
};

/**
 * 現在のTableに描画されたセルから、観測可能な論理列境界をTable相対位置として計測する。
 *
 * 横結合セルの内部境界はDOMから実測できないため推測しない。別の行で同じ論理境界を観測できる場合だけ境界として返す。
 * これにより不等幅列や結合セルを含むTableでも、実際の描画位置にない境界を人工的に生成しない。
 *
 * @param table 列DnDの対象となるTable要素。
 * @return 論理列間境界順に並んだ、観測可能なTable相対横位置。
 */
export const measureTableColumnBoundaryGeometry = (
	table: HTMLTableElement
): readonly ColumnBoundaryGeometry[] => {
	const tableRectangle = table.getBoundingClientRect();
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

		Array.from( row.cells ).forEach( ( cell ) => {
			const columnStart = resolveNextAvailableColumnIndex(
				remainingRowSpans,
				nextColumnIndex
			);
			const columnSpan = Math.max( cell.colSpan, 1 );
			const columnEnd = columnStart + columnSpan;
			const rectangle = cell.getBoundingClientRect();

			recordBoundary(
				boundaries,
				columnStart,
				rectangle.left - tableRectangle.left
			);
			recordBoundary(
				boundaries,
				columnEnd,
				rectangle.right - tableRectangle.left
			);

			const rowSpan = Math.max( cell.rowSpan, 1 );
			if ( rowSpan > 1 ) {
				for ( let index = columnStart; index < columnEnd; index += 1 ) {
					remainingRowSpans[ index ] = Math.max(
						remainingRowSpans[ index ] ?? 0,
						rowSpan
					);
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

	return Array.from( boundaries, ( [ index, offset ] ) => ( {
		index,
		offset,
	} ) ).sort( ( first, second ) => first.index - second.index );
};
