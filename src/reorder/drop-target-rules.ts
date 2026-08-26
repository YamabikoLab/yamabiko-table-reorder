/**
 * 行・列に共通する、結合範囲を分断しないための境界判定を提供する。
 *
 * rowspanやcolspanそのものは扱わず、一体として保持する範囲と移動先候補の位置関係だけを判定する。
 */

/**
 * 候補境界が、一体として保持すべき範囲の内部を分断する位置かを判定する。
 *
 * @param boundary 並び替え先として検討している境界位置。
 * @param start    一体として保持する範囲の先頭位置。
 * @param end      一体として保持する範囲の末尾位置。
 * @return 範囲を分断する境界であれば`true`。
 */
export const isBoundaryInsideRange = ( boundary: number, start: number, end: number ): boolean => {
	const splitsProtectedRange = boundary > start && boundary <= end;
	return splitsProtectedRange;
};
