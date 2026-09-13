/**
 * Reorder Modeの非React購読境界を所有する。
 *
 * Zustand Store自体を利用側へ公開せず、対象Tableから見たモード変更だけを通知する。
 * WordPress wrapper同期や方向固有Lifecycle cleanupはこの契約を利用し、React renderを要求せずに現在状態へ追従する。
 */

import {
	reorderMode,
	reorderModeStore,
	type ReorderKind,
} from '@/reorder/reorder-mode';

/** 対象Tableから見たReorder Modeを表す。 */
export type TableReorderMode = ReorderKind | 'edit';

/**
 * 対象Tableから見たReorder Mode変更を受け取る処理。
 *
 * @param mode 変更後に対象Tableで有効なReorder Mode。
 */
export type ReorderModeChangeHandler = ( mode: TableReorderMode ) => void;

/**
 * 対象Tableから見たReorder Mode変更だけを購読する。
 *
 * 別Tableの状態変更など、対象Tableから見たモードが変わらない更新は通知しない。
 * 購読開始時の状態は通知せず、必要な初期同期は`reorderMode.getMode()`で現在値を参照する。
 *
 * @param tableIdentity 対象TableのIdentity。
 * @param handler       対象Tableのモードが変わった時に通知する処理。
 * @return 購読を解除する処理。
 */
export const subscribeReorderMode = (
	tableIdentity: string,
	handler: ReorderModeChangeHandler
): ( () => void ) => {
	let previousMode: TableReorderMode = reorderMode.getMode( tableIdentity );

	return reorderModeStore.subscribe( () => {
		const currentMode: TableReorderMode = reorderMode.getMode( tableIdentity );

		/* 対象Tableから見た状態が変わらないStore更新は、利用側Lifecycleへ伝播させない。 */
		if ( currentMode === previousMode ) {
			return;
		}

		previousMode = currentMode;
		handler( currentMode );
	} );
};
