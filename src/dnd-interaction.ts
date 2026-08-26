import {
	getReorderDirection,
	type ReorderDirection,
	type ReorderMode,
} from './reorder-mode';

/**
 * 1回のDnDで移動する行または列を表す。
 *
 * 現段階ではTable内の論理indexだけを持ち、DOMやブロック固有表現を
 * 共通Reorder Sessionへ持ち込まない。
 */
export type ReorderTarget = {
	index: number;
};

/**
 * Drop Target Resolutionが有効と判定した移動先を表す。
 *
 * 移動先の有効性そのものはこの責務では判定しない。
 */
export type ReorderDestination = {
	index: number;
};

/**
 * 進行中の1回の並び替え操作を表す共通Reorder Session。
 *
 * 入力方式やTable実装に依存せず、方向、移動対象、現在の有効な移動先だけを
 * 操作中に保持する。完了またはキャンセル後はこの状態を次のDnDへ持ち越さない。
 */
export type ReorderSession = {
	direction: ReorderDirection;
	target: ReorderTarget;
	destination: ReorderDestination | null;
};

/**
 * Data Updateへ渡せる確定済みの並び替えを表す。
 */
export type CommittedReorder = {
	direction: ReorderDirection;
	target: ReorderTarget;
	destination: ReorderDestination;
};

/**
 * 現在のReorder Modeと移動対象から共通Reorder Sessionを開始する。
 *
 * 通常編集状態ではDnDを開始できないため`null`を返す。
 */
export const startReorderSession = (
	mode: ReorderMode,
	target: ReorderTarget
): ReorderSession | null => {
	const direction = getReorderDirection( mode );

	if ( direction === null ) {
		return null;
	}

	return {
		direction,
		target,
		destination: null,
	};
};

/**
 * 進行中のReorder Sessionへ現在の有効な移動先を反映する。
 *
 * 有効な移動先がなくなった場合は`null`を渡し、確定不能な状態へ戻す。
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
 * 有効な移動先がない場合は確定済みの並び替えを生成しない。
 */
export const completeReorderSession = (
	session: ReorderSession
): CommittedReorder | null => {
	if ( session.destination === null ) {
		return null;
	}

	return {
		direction: session.direction,
		target: session.target,
		destination: session.destination,
	};
};

/**
 * Reorder Sessionをキャンセルする。
 *
 * Data Updateへ渡す結果を生成せず、呼び出し側が進行中Sessionを破棄できることを
 * 明示するため常に`null`を返す。
 */
export const cancelReorderSession = (): null => null;
