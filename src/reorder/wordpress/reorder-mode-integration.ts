/**
 * Reorder Mode本体をWordPress / Reactから利用するための接続境界を所有する。
 *
 * Reorder Modeの状態遷移ルールは本体へ委ね、Toolbar操作、Table lifecycle通知、表示用状態、
 * 編集可否、React購読が必要とする形だけへ適応する。
 */

import { reorderMode, type ReorderKind } from '@/reorder/reorder-mode';

/**
 * WordPress / React接続が利用するReorder Modeの最小内部仕様を表す。
 *
 * Reorder Mode本体の状態遷移規則は持たず、WordPress接続が必要とする表示状態と編集可否へ適応する。
 */
type ReorderModeIntegration = {
	select: ( kind: ReorderKind, tableIdentity: string ) => void;
	observeTable: ( tableIdentity: string ) => void;
	notifyTableInactive: ( tableIdentity: string ) => void;
	getSelectedKind: ( tableIdentity: string ) => ReorderKind | null;
	isEditingAllowed: ( tableIdentity: string ) => boolean;
	subscribe: ( listener: () => void ) => () => void;
};

/**
 * WordPress / React接続へ提供する共有Reorder Mode内部仕様。
 *
 * 表示用の選択状態と編集可否はReorder Mode本体の現在モードから導出し、状態そのものは所有しない。
 */
export const reorderModeIntegration: ReorderModeIntegration = {
	select: reorderMode.select,
	observeTable: reorderMode.observeTable,
	notifyTableInactive: reorderMode.notifyTableInactive,
	getSelectedKind: ( tableIdentity ) => {
		const mode = reorderMode.getMode( tableIdentity );
		const selectedKind = mode === 'edit' ? null : mode;

		return selectedKind;
	},
	isEditingAllowed: ( tableIdentity ) => {
		const mode = reorderMode.getMode( tableIdentity );
		const editingAllowed = mode === 'edit';

		return editingAllowed;
	},
	subscribe: reorderMode.subscribe,
};
