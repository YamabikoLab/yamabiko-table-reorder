/**
 * 行専用DnD Interactionが所有する共有状態をReactから購読する境界を提供する。
 *
 * DnD Interaction本体のStoreやLifecycle操作をReactへ持ち込まず、PresentationとAuto Scrollが必要とする
 * 公開状態だけをReact Hookとして提供する。
 */

import { useSyncExternalStore } from 'react';

import {
	getRowDndActive,
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	subscribeRowDndState,
} from './dnd-interaction';

/**
 * Reorder Presentationが行DnD中の表示開始・終了をReact描画へ反映するために利用する。
 *
 * @return 現在の行DnD Lifecycle状態。
 */
export const useRowDndPhase = (): ReturnType< typeof getRowDndPhase > =>
	useSyncExternalStore( subscribeRowDndState, getRowDndPhase );

/**
 * Auto Scrollが行DnD中だけ自動スクロール許可状態をReact描画へ反映するために利用する。
 *
 * @return 行DnD Sessionがactiveな場合はtrue。それ以外はfalse。
 */
export const useRowDndActive = (): boolean =>
	useSyncExternalStore( subscribeRowDndState, getRowDndActive );

/**
 * Reorder Presentationが現在の有効な挿入位置をReact描画へ反映するために利用する。
 *
 * @return 現在の有効な0-based移動先境界。idleまたは有効な移動先がない場合はnull。
 */
export const useRowDndDestinationBoundaryIndex = (): number | null =>
	useSyncExternalStore( subscribeRowDndState, getRowDndDestinationBoundaryIndex );
