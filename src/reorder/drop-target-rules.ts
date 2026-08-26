/**
 * Drop Target Resolutionで行・列の両方から利用する共通ルールを提供する。
 */

/**
 * 境界が指定範囲の内部を分断する位置か判定する。
 *
 * @param boundary 判定対象の境界index。
 * @param start    範囲の開始index。
 * @param end      範囲の終了index。
 */
export const isBoundaryInsideRange = (
	boundary: number,
	start: number,
	end: number
): boolean => boundary > start && boundary <= end;
