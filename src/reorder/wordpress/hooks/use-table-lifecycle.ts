/**
 * 対応Tableの選択状態とReorder ModeのLifecycle同期を所有する。
 *
 * React componentの生成状態ではなく、WordPress Editor上の現在操作対象を基準にReorder Modeへ事実を通知する。
 */

import { useEffect } from '@wordpress/element';

import { reorderModeIntegration } from '@/reorder/wordpress/reorder-mode-integration';

/** 現在選択されている対応Table Identityを返すWordPress接続境界。 */
export type GetSelectedTableIdentity = () => string | null;

/**
 * 対応Tableの選択状態とReorder ModeのLifecycleを同期する。
 *
 * componentが破棄される場合もEditorの現在選択を確認し、同じTableが操作対象のままなら再生成としてReorder Modeを維持する。
 *
 * @param tableIdentity            Lifecycleを同期するTable Identity。
 * @param isSelected               Tableが現在の操作対象として選択されているか。
 * @param getSelectedTableIdentity WordPress Editor上で現在操作対象の対応Table Identityを解決する関数。
 */
export const useTableLifecycle = (
	tableIdentity: string,
	isSelected: boolean,
	getSelectedTableIdentity: GetSelectedTableIdentity
) => {
	useEffect( () => {
		if ( isSelected ) {
			reorderModeIntegration.observeTable( tableIdentity );
		} else {
			reorderModeIntegration.notifyTableInactive( tableIdentity );
		}

		return () => {
			const selectedTableIdentity = getSelectedTableIdentity();

			/*
			 * Table componentの再生成だけでは操作対象から外れたことにならないため、Editor上の操作対象が別のBlockへ変わった場合だけ離脱を通知する。
			 */
			if ( selectedTableIdentity === tableIdentity ) {
				return;
			}

			reorderModeIntegration.notifyTableInactive( tableIdentity );
		};
	}, [ getSelectedTableIdentity, isSelected, tableIdentity ] );
};
