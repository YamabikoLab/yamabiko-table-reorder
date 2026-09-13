/**
 * Row / Columnの確認付き大規模反映結果を、共通の結果通知Presentationへ接続する。
 *
 * Apply Lifecycleの表示復帰終了を通知開始契機として所有し、成功・失敗の表示方法や表示時間は共通Presentationへ委譲する。
 */

import { useEffect, useRef, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage, getRfApplyFailureMessage } from '@/messages';
import {
	ReorderCompletionNotice,
	type ReorderCompletionNoticeStatus,
} from '@/reorder/wordpress/components/reorder-completion-notice';

/**
 * Row / Columnの大規模反映が表示復帰を終えた直後に、確定済み結果を一時通知として表示する。
 *
 * @param props                   Row / Column大規模反映の表示復帰結果。
 * @param props.restorationStatus 表示復帰中の成功・失敗結果。対象外または表示復帰外ではnull。
 * @return 表示復帰完了直後だけ表示する結果通知。それ以外はnull。
 */
export const ReorderApplyCompletion = ( props: {
	restorationStatus: ReorderCompletionNoticeStatus | null;
} ) => {
	const { restorationStatus } = props;
	const previousRestorationStatus = useRef< ReorderCompletionNoticeStatus | null >( null );
	const [ notice, setNotice ] = useState< ReorderCompletionNoticeStatus | null >( null );

	useEffect( () => {
		const completedStatus =
			previousRestorationStatus.current !== null && restorationStatus === null
				? previousRestorationStatus.current
				: null;
		previousRestorationStatus.current = restorationStatus;

		/* Row / Columnの表示復帰が終了した直後だけ、その反映結果を通知開始条件として扱う。 */
		if ( completedStatus !== null ) {
			setNotice( completedStatus );
		}
	}, [ restorationStatus ] );

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
