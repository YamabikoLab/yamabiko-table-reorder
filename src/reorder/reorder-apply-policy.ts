/**
 * Row / Column Reorderに共通する反映経路の性能チューニング方針を所有する。
 *
 * 移動内容やTable構造は解釈せず、Table Integrationが算出した更新対象セル数と
 * 端末ローカルの有効な学習閾値から、直接反映または確認付き大規模反映のどちらを使うかを判定する。
 */

import {
	getLearnedReorderApplyThreshold,
	type ReorderApplyDirection,
} from '@/reorder/reorder-apply-performance';

/**
 * 確認付き大規模反映へ切り替える更新対象セル数の初期チューニング値。
 *
 * 要件上の固定値ではなく、実機検証に基づいて調整する。
 * 端末ローカルの学習値が利用できない場合は、この値だけを判定基準とする。
 */
export const REORDER_APPLY_CONFIRM_CELL_THRESHOLD = 500;

/**
 * 更新対象セル数が確認付き大規模反映を必要とするか判定する。
 *
 * 固定閾値を超える場合は常に確認対象とし、有効な学習値が存在する場合は
 * そのセル数以上でも確認対象とする。学習値は固定閾値を安全側へ補正するためだけに使用する。
 *
 * @param affectedCellCount Table Integrationが算出した今回の更新対象セル数。
 * @param direction         Row / Columnのどちらの学習値を使用するか。
 * @param storage           現在のEditor環境のStorage。利用できない場合はnull。
 * @param nowMs             現在日時を表すUnix epochミリ秒。
 * @return 固定閾値または有効な学習閾値から確認付き大規模反映が必要な場合はtrue。
 */
export const requiresLargeReorderApply = (
	affectedCellCount: number,
	direction: ReorderApplyDirection,
	storage: Storage | null,
	nowMs: number
): boolean => {
	const exceedsDefaultThreshold =
		affectedCellCount > REORDER_APPLY_CONFIRM_CELL_THRESHOLD;
	if ( exceedsDefaultThreshold ) {
		return true;
	}

	const learnedThreshold = getLearnedReorderApplyThreshold( direction, storage, nowMs );
	const reachesLearnedThreshold =
		learnedThreshold !== null && affectedCellCount >= learnedThreshold;
	return reachesLearnedThreshold;
};
