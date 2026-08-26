/**
 * 入力方式に依存しない1回の並び替え操作を、Reorder Sessionとして管理するContractを提供する。
 *
 * DnD中に保持するのは並び替え種別、対象、現在の有効な移動先だけとし、DOMやblock固有状態を
 * Sessionへ持ち込まない。完了・キャンセルによって操作結果を明確に確定または破棄できるようにする。
 */

import { getReorderKind, type ReorderKind, type ReorderMode } from './reorder-mode';

/**
 * 1回の並び替えで移動する行または列を、Table上のLogical Indexで表す。
 *
 * DOM要素や入力イベントではなくTable構造上の位置を保持することで、入力方式を越えて同じ対象を扱う。
 */
export type ReorderTarget = {
	index: number;
};

/**
 * Drop Target Resolutionが有効と判定した移動先を表す。
 *
 * `index`は元のTable順序に対する行間または列間の境界で、0は先頭、要素数と同じ値は末尾を表す。
 * Sessionは有効性を再判定せず、このContractを確定候補として保持する。
 */
export type ReorderDestination = {
	index: number;
};

/**
 * 開始から完了またはキャンセルまでの、1回の並び替え操作の一時状態。
 *
 * 行・列と入力方式に共通のLifecycleを表し、次の操作へ状態を持ち越さない。
 */
export type ReorderSession = {
	kind: ReorderKind;
	target: ReorderTarget;
	destination: ReorderDestination | null;
};

/**
 * Data Updateへ渡せる、確定済みの1回の並び替え。
 *
 * 有効なReorder Destinationが存在するSessionだけがこのContractへ変換される。
 */
export type CommittedReorder = {
	kind: ReorderKind;
	target: ReorderTarget;
	destination: ReorderDestination;
};

/**
 * 現在のReorder Modeで許可されている並び替え種別について、新しいSessionを開始する。
 *
 * 通常編集では並び替え操作を開始しないため、Sessionを生成せず`null`を返す。
 *
 * @param mode   操作開始時点のReorder Mode。
 * @param target 今回のSessionが最後まで同一対象として扱うReorder Target。
 * @return 開始したReorder Session。通常編集では`null`。
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
 * 進行中のSessionへ、Drop Target Resolutionが現在有効とした移動先だけを反映する。
 *
 * 対象や並び替え種別はSessionのidentityとして保持し、移動先が失効した場合は`null`へ戻せる。
 *
 * @param session     更新対象となる進行中のReorder Session。
 * @param destination 現時点で有効なReorder Destination。確定候補がない場合は`null`。
 * @return identityを維持したまま移動先だけを更新したReorder Session。
 */
export const updateReorderDestination = (
	session: ReorderSession,
	destination: ReorderDestination | null
): ReorderSession => ( {
	...session,
	destination,
} );

/**
 * Sessionを完了し、Data Updateへ渡してよい確定結果だけを生成する。
 *
 * 有効な移動先がないSessionは確定できないため、Committed Reorderへ変換しない。
 *
 * @param session 完了するReorder Session。
 * @return Data Updateへ渡せるCommitted Reorder。有効な移動先がない場合は`null`。
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
 * 進行中のSessionを確定結果へ変換せず破棄する。
 *
 * キャンセルではData Updateを発生させないというLifecycleを、常に`null`を返すContractとして表す。
 */
export const cancelReorderSession = (): null => null;
