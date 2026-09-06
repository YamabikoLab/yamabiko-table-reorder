/**
 * 行DnDで共通利用する、tbody内の論理的な行配置のDOM計測を提供する。
 *
 * 移動先判定とReorder Presentationが同じ行境界の定義を重複して持たないよう、
 * 現在のtbodyに描画された各行の位置をtbody相対のgeometryとして返す。
 * DnD Session、表示状態、Lifecycleは所有せず、呼び出された時点のDOMだけを計測する。
 */

/** tbody内の1行が占める論理的な縦方向範囲。 */
export type RowGeometry = {
	top: number;
	bottom: number;
};

/**
 * 現在のtbodyに描画された各行の縦方向範囲を、tbody相対の論理配置として計測する。
 *
 * @param tableBody 行DnDの対象範囲となるtbody。
 * @return tbody内の行順に対応する各行の論理的な縦方向範囲。
 */
export const measureTableBodyRowGeometry = (
	tableBody: HTMLTableSectionElement
): readonly RowGeometry[] => {
	const bodyRectangle = tableBody.getBoundingClientRect();

	/* 行DnD中の各責務が同じ論理行配置を基準にできるよう、tbody内の全行を同一基準で計測する。 */
	const rowGeometry = Array.from( tableBody.rows, ( row ) => {
		const rectangle = row.getBoundingClientRect();
		return {
			top: rectangle.top - bodyRectangle.top,
			bottom: rectangle.bottom - bodyRectangle.top,
		};
	} );

	return rowGeometry;
};

/**
 * tbody内の行配置から、先頭から末尾直後までの0-based挿入境界位置を導出する。
 *
 * @param rowGeometry tbody内の行順に対応する各行の論理的な縦方向範囲。
 * @return 各行の直前と最後の行の直後に対応する論理的な境界位置。行がない場合は空配列。
 */
export const resolveRowBoundaryOffsets = (
	rowGeometry: readonly RowGeometry[]
): readonly number[] => {
	const lastRowGeometry = rowGeometry.at( -1 );

	/* 行が存在しない場合は挿入境界を成立させない。 */
	if ( lastRowGeometry === undefined ) {
		return [];
	}

	/* 末尾直後を含む全挿入位置を同じ境界定義で表すため、各行上端に最後の行下端を加える。 */
	const boundaryOffsets = rowGeometry.map( ( geometry ) => geometry.top );
	boundaryOffsets.push( lastRowGeometry.bottom );
	return boundaryOffsets;
};
