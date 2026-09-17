/**
 * Reorder Form（RF）の反映結果を、操作を妨げない一時通知として表示する。
 *
 * RF Interactionが保持する未提示Apply Outcomeを単一のWordPress接続地点で一度だけ確保し、
 * Visual Presentationと後続Announcement Deliveryが同じ確定結果を利用できる状態を成立させる。
 * Visual Noticeの表示寿命はApply Outcomeの一回性とは独立して管理する。
 */

import { useEffect, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage, getRfApplyFailureMessage } from '@/messages';
import {
	rfInteraction,
	type RfApplyOutcome,
} from '@/reorder/reorder-form/responsibilities/interaction';
import { useRfApplyOutcome } from '@/reorder/reorder-form/responsibilities/interaction-react';

import { ReorderCompletionNotice } from './reorder-completion-notice';

/** WordPress接続がRF Interactionから一度だけ確保した提示対象Apply Outcome。 */
type RfPresentedApplyOutcome = Exclude< RfApplyOutcome, { status: 'idle' } >;

/**
 * RF Interactionが反映結果を確定した直後だけ結果通知を表示する。
 *
 * 未提示Outcome全体を一度だけローカルへ確保した時点でRF Interaction側を提示済みにする。
 * 保持中Outcomeの存在やVisual Noticeのmount / dismissは新しいAnnouncement契機を表さず、
 * 後続Announcement Deliveryは新しいOutcomeを確保した遷移だけを一回性の発行契機として利用する。
 *
 * @param props               通知対象Table。
 * @param props.tableIdentity RF反映結果を購読するTable Identity。
 * @return 確保済みの成功・失敗結果を表示する一時通知。それ以外はnull。
 */
export const ReorderFormCompletion = ( props: { tableIdentity: string } ) => {
	const { tableIdentity } = props;
	const applyOutcome = useRfApplyOutcome( tableIdentity );
	const [ presentedOutcome, setPresentedOutcome ] = useState< RfPresentedApplyOutcome | null >(
		null
	);

	useEffect( () => {
		if ( applyOutcome.status === 'idle' ) {
			return;
		}

		/* 同じ確定OutcomeをVisual Presentationと後続Announcementへ渡せるよう、提示済み化より先に全体を確保する。 */
		setPresentedOutcome( applyOutcome );
		rfInteraction.consumeApplyOutcome( tableIdentity );
	}, [ applyOutcome, tableIdentity ] );

	if ( presentedOutcome === null ) {
		return null;
	}

	const message =
		presentedOutcome.status === 'failure'
			? getRfApplyFailureMessage()
			: getLargeReorderCompletionMessage();

	return (
		<ReorderCompletionNotice
			status={ presentedOutcome.status }
			message={ message }
			onRemove={ () => setPresentedOutcome( null ) }
		/>
	);
};
