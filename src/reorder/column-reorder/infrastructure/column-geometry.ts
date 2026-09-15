/**
 * 列DnDで利用する、Table全体の論理列境界のDOM計測を提供する。
 *
 * Destination Resolutionと将来のReorder Presentationが同じ列境界の定義を重複して持たないよう、
 * 現在のTableに描画されたセルから観測できる論理列境界を、全観測位置と代表位置の両方でTable相対位置として返す。
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

/** 1つのDOMセルから観測した論理列境界の論理進行方向上の位置。 */
export type ColumnBoundaryObservation = ColumnBoundaryGeometry;

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
 * 1つのDOMセルから得た論理列境界位置を、他セルの観測値を失わず記録する。
 *
 * 同じ論理境界はTable内の複数セルから観測できるため、物理配置の整合性を別責務が評価できるよう全観測値を維持する。
 *
 * @param observations DOMセルごとの論理列間境界観測。
 * @param index        記録する0-based論理列間境界。
 * @param offset       Tableの論理開始端を基準とする境界位置。
 */
const recordBoundary = (
	observations: ColumnBoundaryObservation[],
	index: number,
	offset: number
): void => {
	observations.push( { index, offset } );
};

/**
 * 現在のTableに描画されたセルから、観測可能な論理列境界を論理進行方向上の位置として計測する。
 *
 * 横結合セルの内部境界はDOMから実測できないため推測しない。別の行で同じ論理境界を観測できる場合だけ境界として返す。
 * 描画boxを持たないセルは論理列位置や縦結合の解釈には含めるが、現在の物理配置を表さないため境界観測には含めない。
 * LTRでは左端、RTLでは右端を論理開始位置0として正規化し、論理列番号が増える方向とoffsetが増える方向を一致させる。
 * これにより不等幅列や結合セルを含むTableでも、実際の描画位置にない境界を人工的に生成しない。
 *
 * @param table 列DnDの対象となるTable要素。
 * @return 論理列間境界順に並んだ、観測可能な論理進行方向上の位置。
 */
export const measureTableColumnBoundaryObservations = (
	table: HTMLTableElement
): readonly ColumnBoundaryObservation[] => {
	const tableRectangle = table.getBoundingClientRect();
	const inlineDirection = resolveTableColumnInlineDirection( table );
	const observations: ColumnBoundaryObservation[] = [];
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

		/* 現在行の各セルを論理列へ対応付け、描画boxを持つセルから直接観測できる左右境界だけを記録する。 */
		Array.from( row.cells ).forEach( ( cell ) => {
			const columnStart = resolveNextAvailableColumnIndex( remainingRowSpans, nextColumnIndex );
			const columnSpan = Math.max( cell.colSpan, 1 );
			const columnEnd = columnStart + columnSpan;
			const rectangle = cell.getBoundingClientRect();
			const hasRenderedBox = rectangle.width > 0 || rectangle.height > 0;

			if ( hasRenderedBox ) {
				let columnStartOffset = rectangle.left - tableRectangle.left;
				let columnEndOffset = rectangle.right - tableRectangle.left;

				/* RTLでは右端を論理開始位置とし、論理列番号と境界offsetが同じ向きに増えるよう物理位置を正規化する。 */
				if ( inlineDirection === 'rtl' ) {
					columnStartOffset = tableRectangle.right - rectangle.right;
					columnEndOffset = tableRectangle.right - rectangle.left;
				}

				recordBoundary( observations, columnStart, columnStartOffset );
				recordBoundary( observations, columnEnd, columnEndOffset );
			}

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

	/* 呼び出し側が同一境界の全観測値を保ったまま論理順で扱えるよう、列間境界順に並べる。 */
	return observations.sort( ( first, second ) => first.index - second.index );
};

/**
 * 現在のTableに描画されたセルから、移動先解決に利用する代表列境界を計測する。
 *
 * 同一論理境界の最初の観測位置を従来どおり代表値とし、開始時Table配置の移動先判定を別行の観測値で揺らさない。
 * 横結合セル内部の未観測境界は推測せず、別セルから直接観測できた境界だけを返す。
 *
 * @param table 列DnDの対象となるTable要素。
 * @return 論理列間境界順に並んだ、移動先解決用の代表位置。
 */
export const measureTableColumnBoundaryGeometry = (
	table: HTMLTableElement
): readonly ColumnBoundaryGeometry[] => {
	const representativeBoundaries = new Map< number, number >();
	const observations = measureTableColumnBoundaryObservations( table );

	/* Destination Resolutionの開始時基準を維持するため、論理境界ごとに最初の観測位置だけを代表値とする。 */
	observations.forEach( ( observation ) => {
		if ( ! representativeBoundaries.has( observation.index ) ) {
			representativeBoundaries.set( observation.index, observation.offset );
		}
	} );

	return Array.from( representativeBoundaries, ( [ index, offset ] ) => ( {
		index,
		offset,
	} ) );
};
