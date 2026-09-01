/**
 * Reorder Modeの選択状態とToolbar操作をReactへ接続するカスタムフックを所有する。
 *
 * ReactはReorder Mode状態の正本を持たず、対象Tableに必要な選択状態だけを購読する。
 */

import { useCallback, useSyncExternalStore } from '@wordpress/element';

import type { ReorderKind } from '@/reorder/reorder-mode';
import { reorderModeIntegration } from '@/reorder/wordpress/reorder-mode-integration';

/**
 * 対象Tableから見た現在のReorder Mode状態とToolbar操作をReactへ提供する。
 *
 * @param tableIdentity Reorder Mode状態を参照・操作するTable Identity。
 * @return 対象Tableで選択中の並び替え方向と、Toolbar入口を選択する操作。
 */
export const useReorderMode = ( tableIdentity: string ) => {
	const getSelectedKind = useCallback(
		() => reorderModeIntegration.getSelectedKind( tableIdentity ),
		[ tableIdentity ]
	);
	const selectedKind = useSyncExternalStore(
		reorderModeIntegration.subscribe,
		getSelectedKind,
		getSelectedKind
	);
	const selectMode = useCallback(
		( kind: ReorderKind ) => reorderModeIntegration.select( kind, tableIdentity ),
		[ tableIdentity ]
	);

	return { selectedKind, select: selectMode };
};
