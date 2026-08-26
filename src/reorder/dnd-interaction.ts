/**
 * 入力方式に依存しない1回の並び替え操作を管理する。
 *
 * 操作中は並び替え種別、移動対象、現在有効な移動先だけを保持し、DOMやブロック固有の状態を持ち込まない。
 * これにより、マウス・タッチ・キーボードの違いにかかわらず同じ操作状態を利用できる。
 */

import { getReorderKind, type ReorderKind, type ReorderMode } from './reorder-mode';

/**
 * 1回の並び替えで移動する行または列を、テーブル上の位置で表す。
 */
export type ReorderTarget = {
	index: number;
};

/**
 * 妥当性確認済みの移動先を表す。
 *
 * `index`は元の並び順に対する行間または列間の境界位置で、0は先頭、要素数と同じ値は末尾を表す。
 */
export type ReorderDestination = {
	index: number;
};

/**
 * 開始から完了またはキャンセルまでの、1回の並び替え操作の一時状態。
 */
export type ReorderSession = {
	kind: ReorderKind;
	target: ReorderTarget;
	destination: ReorderDestination | null;
};

/**
 * データ更新へ渡せる、確定済みの1回の並び替え。
 */
export type CommittedReorder = {
	kind: ReorderKind;
	target: ReorderTarget;
	destination: ReorderDestination;
};

/**
 * 現在の操作状態で許可されている行または列の並び替えを開始する。
 *
 * 通常編集では並び替えを開始しない。
 *
 * @param mode 操作開始時点の状態。
 * @param target 今回の操作で最後まで同一対象として扱う行または列。
 * @return 開始した並び替え操作。通常編集では`null`。
 */
export const startReorderSession = (
	mode: ReorderMode,
	target: ReorderTarget
): ReorderSession | null => {
	const kind = getReorderKind( mode );

	if ( kind === null ) {
		return null;
	}

	return {
		kind,
		target,
		destination: null,
	};
};

/**
 * 進行中の並び替え操作へ、現在有効な移動先を反映する。
 *
 * 移動対象と並び替え種別は開始時のまま保持し、移動先だけを更新する。
 *
 * @param session 更新対象となる進行中の並び替え操作。
 * @param destination 現在有効な移動先。候補がない場合は`null`。
 * @return 移動先だけを更新した並び替え操作。
 */
export const updateReorderDestination = (
	session: ReorderSession,
	destination: ReorderDestination | null
): ReorderSession => ( {
	...session,
	destination,
} );

/**
 * 並び替え操作を完了し、データ更新へ渡せる確定結果を生成する。
 *
 * 有効な移動先がない操作は確定しない。
 *
 * @param session 完了する並び替え操作。
 * @return 確定済みの並び替え。有効な移動先がない場合は`null`。
 */
export const completeReorderSession = ( session: ReorderSession ): CommittedReorder | null => {
	if ( session.destination === null ) {
		return null;
	}

	return {
		kind: session.kind,
		target: session.target,
		destination: session.destination,
	};
};

/**
 * 進行中の並び替え操作を確定せず破棄する。
 *
 * @return キャンセルでは並び替え結果を生成しないため、常に`null`。
 */
export const cancelReorderSession = (): null => null;
