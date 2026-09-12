/**
 * 確認付き大規模反映の完了を、操作を妨げない一時通知として表示する。
 *
 * 反映成功後の再mount完了を検知して通知表示だけを所有し、Apply Lifecycleや方向固有状態は変更しない。
 */

import { Dashicon, Snackbar } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage } from '@/messages';

import './completion.scss';

/**
 * 大規模反映が正常完了した場合に、フォーカスを奪わない完了通知を短時間だけ表示する。
 *
 * @param props                        完了通知の表示条件。
 * @param props.isSuccessfulRemounting 反映成功後の再mount中であることを示す。
 * @return 完了直後だけ表示する一時通知。それ以外はnull。
 */
export const ReorderApplyCompletion = ( props: { isSuccessfulRemounting: boolean } ) => {
	const { isSuccessfulRemounting } = props;
	const wasSuccessfulRemounting = useRef( false );
	const [ noticeSequence, setNoticeSequence ] = useState< number | null >( null );

	useEffect( () => {
		const hasJustCompleted = wasSuccessfulRemounting.current && ! isSuccessfulRemounting;
		wasSuccessfulRemounting.current = isSuccessfulRemounting;

		/* 正常な再mountが完了した直後だけ、新しい完了通知を開始する。 */
		if ( hasJustCompleted ) {
			setNoticeSequence( ( current ) => ( current ?? 0 ) + 1 );
		}
	}, [ isSuccessfulRemounting ] );

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
				<span className="yamabiko-table-reorder-completion-notice__content">
					<span aria-hidden="true">
						<Dashicon icon="yes-alt" />
					</span>
					{ getLargeReorderCompletionMessage() }
				</span>
			</Snackbar>
		</div>
	);
};
