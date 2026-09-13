/**
 * Reorder Form（RF）SessionとWordPress Editor上の対象Table Lifecycleの同期を所有する。
 *
 * RF Sessionの状態正本はRF Interactionに維持したまま、Table属性変更による再評価と、
 * Editor上で対象Tableから離れた場合のSession終了だけをWordPress接続境界から通知する。
 */

import { useEffect } from '@wordpress/element';

import { rfInteraction } from '@/reorder/reorder-form/responsibilities/interaction';
import type { RfInteractionReactState } from '@/reorder/reorder-form/responsibilities/interaction-react';
import type { GetSelectedTableIdentity } from '@/reorder/wordpress/hooks/use-table-lifecycle';

/**
 * 対象Tableの変更と操作対象状態をRF Interactionへ同期する。
 *
 * 同じTableのReact再mountだけではSessionを終了せず、Editor上の操作対象が別Blockへ移った場合だけ終了する。
 * RF反映中はInteraction自身が入口操作を拒否するため、このHookからSession状態を上書きしない。
 *
 * @param tableIdentity            RF対象Table Identity。
 * @param isSelected               Tableが現在Editorの操作対象として選択されているか。
 * @param getSelectedTableIdentity WordPress Editor上の現在操作対象Tableを解決する関数。
 * @param attributes               現在Table属性。変更時にRFの現在指定を再評価する契機として利用する。
 * @param rfStatus                 対象Tableから見た現在RF Session状態。
 */
export const useRfTableLifecycle = (
	tableIdentity: string,
	isSelected: boolean,
	getSelectedTableIdentity: GetSelectedTableIdentity,
	attributes: Record< string, unknown >,
	rfStatus: RfInteractionReactState[ 'status' ]
): void => {
	useEffect( () => {
		/* open中のTable内容が変化した場合だけ、保持中指定を現在Table基準で再評価する。 */
		if ( rfStatus === 'open' ) {
			rfInteraction.notifyTableChanged( tableIdentity );
		}
	}, [ attributes, rfStatus, tableIdentity ] );

	useEffect( () => {
		/* 対象Tableが操作対象から外れた時点で、open中のRFを終了する。 */
		if ( ! isSelected && rfStatus === 'open' ) {
			rfInteraction.close( tableIdentity );
		}
	}, [ isSelected, rfStatus, tableIdentity ] );

	useEffect( () => {
		return () => {
			const selectedTableIdentity = getSelectedTableIdentity();

			/* 同じTableが操作対象のままReactだけ再生成された場合はRF Sessionを維持する。 */
			if ( selectedTableIdentity === tableIdentity ) {
				return;
			}

			rfInteraction.close( tableIdentity );
		};
	}, [ getSelectedTableIdentity, tableIdentity ] );
};
