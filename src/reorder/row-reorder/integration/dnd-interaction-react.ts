/**
 * 行専用DnD Interactionが所有する共有状態をReactから購読する境界を提供する。
 *
 * DnD Interaction本体のStoreやLifecycle操作をReactへ持ち込まず、Reorder Presentationが必要とする
 * 公開状態だけをReact Hookとして提供する。
 */

import { useSyncExternalStore } from 'react';

import {
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	subscribeRowDndState,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';

/**
 * Reorder Presentationが行DnD中の表示開始・終了をReact描画へ反映するために利用する。
 *
 * @return 現在の行DnD Lifecycle状態。
 */
export const useRowDndPhase = (): ReturnType< typeof getRowDndPhase > =>
	useSyncExternalStore( subscribeRowDndState, getRowDndPhase );

/**
 * Reorder Presentationが現在の有効な挿入位置をReact描画へ反映するために利用する。
 *
 * @return 現在の有効な0-based移動先境界。idleまたは有効な移動先がない場合はnull。
 */
export const useRowDndDestinationBoundaryIndex = (): number | null =>
	useSyncExternalStore( subscribeRowDndState, getRowDndDestinationBoundaryIndex );
