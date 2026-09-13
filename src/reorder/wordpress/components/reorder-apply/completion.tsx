/**
 * 行・列・RFの正常反映完了を、操作を妨げず認識しやすい一時通知として表示する。
 *
 * 完了イベントの検知と通知Presentationを共通化し、並び替え手段ごとのSessionやApply Lifecycle自体は変更しない。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage } from '@/messages';
import type { RfInteractionReactState } from '@/reorder/reorder-form/responsibilities/interaction-react';

import './completion.scss';

/** 完了を認識できる時間を確保しつつ、編集操作を長く覆わない表示時間。 */
const COMPLETION_NOTICE_DURATION_MS = 2000;

/**
 * 正常な並び替え完了を共通の一時通知として表示する。
 *
 * Row / Columnでは反映成功後の再mount完了、RFではInteractionのapplyingからclosedへの正常終了を
 * 完了イベントとして扱う。RFのfailure / cancelledはopenへ戻るため通知対象としない。
 *
 * @param props                        完了通知の表示条件。
 * @param props.isSuccessfulRemounting Row / Columnの反映成功後に再mount中であることを示す。
 * @param props.rfStatus               対象Tableから見たRF Interaction状態。
 * @return 正常完了直後だけ表示する一時通知。それ以外はnull。
 */
export const ReorderApplyCompletion = ( props: {
	isSuccessfulRemounting: boolean;
	rfStatus: RfInteractionReactState[ 'status' ];
} ) => {
	const { isSuccessfulRemounting, rfStatus } = props;
	const wasSuccessfulRemounting = useRef( false );
	const previousRfStatus = useRef( rfStatus );
	const [ noticeSequence, setNoticeSequence ] = useState< number | null >( null );

	useEffect( () => {
		const hasJustCompletedLargeApply =
			wasSuccessfulRemounting.current && ! isSuccessfulRemounting;
		const hasJustCompletedRfApply = previousRfStatus.current === 'applying' && rfStatus === 'closed';
		wasSuccessfulRemounting.current = isSuccessfulRemounting;
		previousRfStatus.current = rfStatus;

		/* いずれの並び替え手段でも正常反映が完了した直後だけ、新しい完了通知を開始する。 */
		if ( hasJustCompletedLargeApply || hasJustCompletedRfApply ) {
			setNoticeSequence( ( current ) => ( current ?? 0 ) + 1 );
		}
	}, [ isSuccessfulRemounting, rfStatus ] );

	useEffect( () => {
		if ( noticeSequence === null ) {
			return;
		}

		const currentNoticeSequence = noticeSequence;
		const timeoutId = setTimeout( () => {
			setNoticeSequence( ( current ) => {
				/* 後から始まった完了通知は、先の通知の表示時間満了では終了させない。 */
				if ( current !== currentNoticeSequence ) {
					return current;
				}

				return null;
			} );
		}, COMPLETION_NOTICE_DURATION_MS );

		return () => {
			clearTimeout( timeoutId );
		};
	}, [ noticeSequence ] );

	/* 完了イベントが発生していない間は、利用者向け通知を表示しない。 */
	if ( noticeSequence === null ) {
		return null;
	}

	const removeNotice = (): void => {
		setNoticeSequence( ( current ) => {
			const isRemovalForCurrentNotice = current === noticeSequence;

			/* 表示中に次の完了が発生した場合は、先の通知終了によって最新の通知を消さない。 */
			if ( ! isRemovalForCurrentNotice ) {
				return current;
			}

			return null;
		} );
	};

	return (
		<div className="yamabiko-table-reorder-completion-notice">
			<Snackbar key={ noticeSequence } onRemove={ removeNotice }>
				<strong className="yamabiko-table-reorder-completion-notice__content">
					<span aria-hidden="true">✓</span>
					{ getLargeReorderCompletionMessage() }
				</strong>
			</Snackbar>
		</div>
	);
};
