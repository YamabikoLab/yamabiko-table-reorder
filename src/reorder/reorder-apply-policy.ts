/**
 * Row / Column Reorderに共通する反映経路の性能チューニング方針を所有する。
 *
 * 移動内容やTable構造は解釈せず、Table Integrationが算出した更新対象セル数だけから
 * 直接反映または確認付き大規模反映のどちらを使うかを判定する。
 */

/**
 * 確認付き大規模反映へ切り替える更新対象セル数の初期チューニング値。
 *
 * 要件上の固定値ではなく、実機検証に基づいて調整する。
 */
export const REORDER_APPLY_CONFIRM_CELL_THRESHOLD = 500;

/**
 * 更新対象セル数が確認付き大規模反映を必要とするか判定する。
 *
 * @param affectedCellCount Table Integrationが算出した今回の更新対象セル数。
 * @return 共通閾値を超える場合はtrue。
 */
export const requiresLargeReorderApply = ( affectedCellCount: number ): boolean => {
	const requiresLargeApply = affectedCellCount > REORDER_APPLY_CONFIRM_CELL_THRESHOLD;
	return requiresLargeApply;
};
