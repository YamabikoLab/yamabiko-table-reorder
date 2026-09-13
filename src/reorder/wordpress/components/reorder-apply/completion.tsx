/**
 * Row / Columnの確認付き大規模反映結果を、共通の結果通知Presentationへ接続する。
 *
 * Apply Lifecycleの再mount終了を通知開始契機として所有し、成功・失敗の表示方法や表示時間は共通Presentationへ委譲する。
 */

import { useEffect, useRef, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage, getRfApplyFailureMessage } from '@/messages';
import {
	ReorderCompletionNotice,
	type ReorderCompletionNoticeStatus,
} from '@/reorder/wordpress/components/reorder-completion-notice';

/**
 * Row / Columnの大規模反映が再mountを終えた直後に、確定済み結果を一時通知として表示する。
 *
 * @param props                  Row / Column大規模反映の再mount結果。
 * @param props.remountingStatus 再mount中の成功・失敗結果。対象外または再mount外ではnull。
 * @return 再mount完了直後だけ表示する結果通知。それ以外はnull。
 */
export const ReorderApplyCompletion = ( props: {
	remountingStatus: ReorderCompletionNoticeStatus | null;
} ) => {
	const { remountingStatus } = props;
	const previousRemountingStatus = useRef< ReorderCompletionNoticeStatus | null >( null );
	const [ notice, setNotice ] = useState< ReorderCompletionNoticeStatus | null >( null );

	useEffect( () => {
		const completedStatus =
			previousRemountingStatus.current !== null && remountingStatus === null
				? previousRemountingStatus.current
				: null;
		previousRemountingStatus.current = remountingStatus;

		/* Row / Columnの再mountが終了した直後だけ、その反映結果を通知開始条件として扱う。 */
		if ( completedStatus !== null ) {
			setNotice( completedStatus );
		}
	}, [ remountingStatus ] );

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
