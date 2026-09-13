/**
 * Reorder Form（RF）の反映結果を、操作を妨げない一時通知として表示する。
 *
 * RF Interactionが保持する未消費のApply Outcomeを正本とし、Reactの描画履歴やTableの再mount有無に依存せず
 * 通常反映と確認付き大規模反映の成功・失敗を同じ経路から一度だけ通知する。
 */

import { useEffect, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage, getRfApplyFailureMessage } from '@/messages';
import { rfInteraction } from '@/reorder/reorder-form/responsibilities/interaction';
import { useRfApplyOutcome } from '@/reorder/reorder-form/responsibilities/interaction-react';

import {
	ReorderCompletionNotice,
	type ReorderCompletionNoticeStatus,
} from './reorder-completion-notice';

/**
 * RF Interactionが反映結果を確定した直後だけ結果通知を表示する。
 *
 * RF固有のOutcome購読とconsumeだけを所有し、表示時間、dismiss、アイコン、配置、スタイルは
 * 共通の結果通知Presentationへ委譲する。
 *
 * @param props               通知対象Table。
 * @param props.tableIdentity RF反映結果を購読するTable Identity。
 * @return 未消費の成功・失敗結果を受け取った直後だけ表示する一時通知。それ以外はnull。
 */
export const ReorderFormCompletion = ( props: { tableIdentity: string } ) => {
	const { tableIdentity } = props;
	const applyOutcome = useRfApplyOutcome( tableIdentity );
	const [ notice, setNotice ] = useState< ReorderCompletionNoticeStatus | null >( null );

	useEffect( () => {
		if ( applyOutcome.status === 'idle' ) {
			return;
		}

		/* 未消費結果はStoreで一度だけ消費し、表示中の結果種別だけをRF入口で保持する。 */
		setNotice( applyOutcome.status );
		rfInteraction.consumeApplyOutcome( tableIdentity );
	}, [ applyOutcome, tableIdentity ] );

	if ( notice === null ) {
		return null;
	}

	const message =
		notice === 'failure' ? getRfApplyFailureMessage() : getLargeReorderCompletionMessage();

	return (
		<ReorderCompletionNotice
			status={ notice }
			message={ message }
			onRemove={ () => setNotice( null ) }
		/>
	);
};
