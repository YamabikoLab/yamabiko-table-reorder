import { getReorderKind, type ReorderKind, type ReorderMode } from './reorder-mode';

/**
 * 1回のDnDで並び替える行または列を表す。
 *
 * Table内の並び替え対象の0-based Logical Indexだけを持ち、DOMやblock固有表現を
 * Reorder Sessionへ持ち込まない。
 */
export type ReorderTarget = {
	index: number;
};

/**
 * Drop Target Resolutionが有効と判定した移動先を表す。
 *
 * `index`は元のTable順序に対する行間または列間の境界を表し、0は先頭、
 * 行数または列数と同じ値は末尾を表す。移動先の有効性そのものはこの責務では判定しない。
 */
export type ReorderDestination = {
	index: number;
};

/**
 * 進行中の1回の並び替え操作を表すReorder Session。
 *
 * 入力方式やTable実装に依存せず、並び替え種別、並び替え対象、現在の有効な移動先だけを
 * 操作中に保持する。完了またはキャンセル後はこの状態を次のDnDへ持ち越さない。
 */
export type ReorderSession = {
	kind: ReorderKind;
	target: ReorderTarget;
	destination: ReorderDestination | null;
};

/**
 * Data Updateへ渡せる確定済み並び替えを表す。
 */
export type CommittedReorder = {
	kind: ReorderKind;
	target: ReorderTarget;
	destination: ReorderDestination;
};

/**
 * 現在のReorder Modeと並び替え対象からReorder Sessionを開始する。
 *
 * 通常編集モードではDnDを開始できないため`null`を返す。
 *
 * @param mode   現在のReorder Mode。
 * @param target 並び替え対象。
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
 * 進行中のReorder Sessionへ現在の有効な移動先を反映する。
 *
 * 有効な移動先がなくなった場合は`null`を渡し、確定不能な状態へ戻す。
 *
 * @param session 進行中のReorder Session。
 * @param destination 現在の有効な移動先。存在しない場合は`null`。
 */
export const updateReorderDestination = (
	session: ReorderSession,
	destination: ReorderDestination | null
): ReorderSession => ( {
	...session,
	destination,
} );

/**
 * Reorder Sessionを完了し、確定可能な場合だけData Updateへ渡せる結果を返す。
 *
 * 有効な移動先がない場合は確定済み並び替えを生成しない。
 *
 * @param session 完了するReorder Session。
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
 * Reorder Sessionをキャンセルする。
 *
 * Data Updateへ渡す結果を生成せず、呼び出し側が進行中のReorder Sessionを破棄できることを
 * 明示するため常に`null`を返す。
 */
export const cancelReorderSession = (): null => null;
