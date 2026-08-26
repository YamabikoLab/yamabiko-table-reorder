/**
 * 行・列のDrop Target Resolutionで共有する、結合範囲を分断しないための境界判定規則を提供する。
 *
 * rowspan / colspanというfeature固有表現は持たず、Logical Index上で一体として扱う範囲と
 * Reorder Destination候補の関係だけを判定する。
 */

/**
 * 候補境界が、一体として保持すべき範囲の内部を分断する位置か判定する。
 *
 * 結合セルなど複数のLogical Indexを1つの構造単位として扱う範囲では、内部境界をReorder Destinationにできない。
 *
 * @param boundary 並び替え先として検討している境界index。
 * @param start    一体として保持する範囲の先頭Logical Index。
 * @param end      一体として保持する範囲の末尾Logical Index。
 * @return 境界が一体範囲を分断する場合は`true`。
 */
export const isBoundaryInsideRange = ( boundary: number, start: number, end: number ): boolean => {
	// Reorder Destinationは、一体として扱う範囲の先頭より後かつ末尾までの内部境界には設定できない。
	const splitsProtectedRange = boundary > start && boundary <= end;
	return splitsProtectedRange;
};
