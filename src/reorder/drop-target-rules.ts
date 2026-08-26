/**
 * 行・列のDrop Target Resolutionが共有する、結合範囲を壊さないための境界判定規則を提供する。
 *
 * rowspan / colspanというfeature固有表現は持たず、Logical Index上の範囲と境界の関係だけを扱う。
 */

/**
 * 候補境界が占有範囲の内部にあり、その範囲を分断する位置か判定する。
 *
 * 結合セルのように一体として保持すべき範囲では、この判定に該当する境界を移動先として利用しない。
 *
 * @param boundary 並び替え先として検討している境界index。
 * @param start    一体として保持する範囲の先頭Logical Index。
 * @param end      一体として保持する範囲の末尾Logical Index。
 * @return 境界が範囲を分断する場合は`true`。
 */
export const isBoundaryInsideRange = (
	boundary: number,
	start: number,
	end: number
): boolean => boundary > start && boundary <= end;
