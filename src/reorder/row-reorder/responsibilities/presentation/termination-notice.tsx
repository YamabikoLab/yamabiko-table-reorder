/**
 * 行DnDを安全に継続できず終了した場合の利用者向け通知表示を所有する。
 *
 * DnD Interactionが通知対象と判断した一回性イベントだけを受け取り、表示中かどうかという一時状態はPresentation内に閉じる。
 * キャンセルや成立しない位置へのドロップはDnD Interactionから通知されないため、この表示側で終了理由を再判定しない。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';

import { getRowDndTerminationMessage } from '@/messages';
import { subscribeRowDndTerminationNotice } from '@/reorder/row-reorder/dnd-interaction';

import './termination-notice.scss';

/**
 * 行DnDの異常終了通知を短時間だけ表示する。
 *
 * 同じ表示中に次の通知が発生した場合も、新しい通知として表示時間を開始し直す。
 *
 * @return 通知対象の終了後だけ表示する一時メッセージ。それ以外はnull。
 */
export const RowTerminationNotice = () => {
	const [ noticeSequence, setNoticeSequence ] = useState< number | null >( null );

	useEffect( () => {
		return subscribeRowDndTerminationNotice( () => {
			setNoticeSequence( ( current ) => ( current ?? 0 ) + 1 );
		} );
	}, [] );

	/* 通知対象の終了が発生していない間は、利用者向けメッセージを表示しない。 */
	if ( noticeSequence === null ) {
		return null;
	}

	const removeNotice = (): void => {
		setNoticeSequence( ( current ) => {
			const isRemovalForCurrentNotice = current === noticeSequence;

			/* 表示中に次の通知が発生していた場合は、先の通知の表示終了によって最新の通知を消さない。 */
			if ( ! isRemovalForCurrentNotice ) {
				return current;
			}

			return null;
		} );
	};

	return (
		<div className="yamabiko-table-reorder-termination-notice">
			<Snackbar key={ noticeSequence } onRemove={ removeNotice }>
				{ getRowDndTerminationMessage() }
			</Snackbar>
		</div>
	);
};
