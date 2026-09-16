/**
 * 列専用DnD Interactionが所有する共有状態をReactから購読する境界を提供する。
 *
 * DnD Interaction本体のStoreやLifecycle操作をReactへ持ち込まず、Reorder Presentationが必要とする
 * 公開状態だけをReact Hookとして提供する。
 */

import { useSyncExternalStore } from 'react';

import {
	getColumnDndDestinationBoundaryIndex,
	getColumnDndPhase,
	subscribeColumnDndState,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';

/**
 * Reorder Presentationが列DnD中の表示開始・終了をReact描画へ反映するために利用する。
 *
 * @return 現在の列DnD Lifecycle状態。
 */
export const useColumnDndPhase = (): ReturnType< typeof getColumnDndPhase > =>
	useSyncExternalStore( subscribeColumnDndState, getColumnDndPhase );

/**
 * Reorder Presentationが現在の有効な挿入位置をReact描画へ反映するために利用する。
 *
 * @return 実際に列順を変更できる現在の0-based移動先境界。idleまたは有効な移動先がない場合はnull。
 */
export const useColumnDndDestinationBoundaryIndex = (): number | null =>
	useSyncExternalStore( subscribeColumnDndState, getColumnDndDestinationBoundaryIndex );
