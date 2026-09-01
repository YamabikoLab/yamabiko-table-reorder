/**
 * Reorder Mode中の通常編集可否をReactへ接続するカスタムフックを所有する。
 *
 * Reactは状態の正本を持たず、対象Tableの編集可否だけを購読する。
 */

import { useCallback, useSyncExternalStore } from '@wordpress/element';

import { reorderModeIntegration } from '@/reorder/reorder-mode';

/**
 * 対象Tableで通常編集を開始できるかをReactへ提供する。
 *
 * @param tableIdentity 編集可否を購読するTable Identity。
 * @return 対象Tableで通常編集を開始できる場合はtrue。それ以外はfalse。
 */
export const useEditingAllowed = ( tableIdentity: string ) => {
	const getEditingAllowed = useCallback(
		() => reorderModeIntegration.isEditingAllowed( tableIdentity ),
		[ tableIdentity ]
	);
	const editingAllowed = useSyncExternalStore(
		reorderModeIntegration.subscribe,
		getEditingAllowed,
		getEditingAllowed
	);

	return editingAllowed;
};
