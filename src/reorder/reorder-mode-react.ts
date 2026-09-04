/**
 * Reorder ModeのZustand storeをReactへ接続する境界を所有する。
 *
 * React側はReorder Mode状態の正本を持たず、対象Tableに必要な状態だけをselectorで購読する。
 * WordPress固有componentはZustand storeへ直接依存せず、この境界が提供するHookだけを利用する。
 */

import { useCallback } from '@wordpress/element';
import { useStore } from 'zustand';

import {
	reorderMode,
	reorderModeStore,
	type ReorderKind,
	type ReorderModeStore,
} from '@/reorder/reorder-mode';

/**
 * 対象Tableから見た現在の並び替え方向をReactへ提供する。
 *
 * @param tableIdentity Reorder Mode状態を購読するTable Identity。
 * @return 対象Tableで選択中の並び替え方向。通常編集の場合はnull。
 */
const useSelectedReorderKind = ( tableIdentity: string ) => {
	const selectedKind = useStore( reorderModeStore, ( state: ReorderModeStore ) => {
		const mode = state.mode;
		const selectedForTable =
			mode.kind !== 'edit' && mode.tableIdentity === tableIdentity ? mode.kind : null;

		return selectedForTable;
	} );

	return selectedKind;
};

/**
 * 対象Tableから見た現在のReorder Mode状態とToolbar操作をReactへ提供する。
 *
 * @param tableIdentity Reorder Mode状態を参照・操作するTable Identity。
 * @return 対象Tableで選択中の並び替え方向と、Toolbar入口を選択する操作。
 */
export const useReorderMode = ( tableIdentity: string ) => {
	const selectedKind = useSelectedReorderKind( tableIdentity );
	const selectMode = useCallback(
		( kind: ReorderKind ) => reorderMode.select( kind, tableIdentity ),
		[ tableIdentity ]
	);

	return { selectedKind, select: selectMode };
};

/**
 * 対象Tableで通常編集を開始できるかをReactへ提供する。
 *
 * @param tableIdentity 編集可否を購読するTable Identity。
 * @return 対象Tableで通常編集を開始できる場合はtrue。それ以外はfalse。
 */
export const useEditingAllowed = ( tableIdentity: string ) => {
	const selectedKind = useSelectedReorderKind( tableIdentity );
	const editingAllowed = selectedKind === null;

	return editingAllowed;
};
