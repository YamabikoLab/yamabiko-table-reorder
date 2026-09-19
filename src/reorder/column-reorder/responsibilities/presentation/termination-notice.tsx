/**
 * 列DnDを安全に継続できず終了した場合の利用者向け通知表示を所有する。
 *
 * DnD Interactionが通知対象と判断した一回性イベントだけを受け取り、表示中かどうかという一時状態はPresentation内に閉じる。
 * cancelや成立しない位置へのdropはDnD Interactionから通知されないため、この表示側で終了理由を再判定しない。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';

import { getDndTerminationMessage } from '@/messages';
import { subscribeColumnDndTerminationNotice } from '@/reorder/column-reorder/responsibilities/dnd-interaction';

import './termination-notice.scss';

/**
 * 列DnDの安全に確定できない終了通知を短時間だけ表示する。
 *
 * @return 通知対象の終了後だけ表示する一時メッセージ。それ以外はnull。
 */
export const ColumnTerminationNotice = () => {
	const [ isVisible, setIsVisible ] = useState( false );

	useEffect( () => {
		return subscribeColumnDndTerminationNotice( () => {
			setIsVisible( true );
		} );
	}, [] );

	/* 通知対象の終了が発生していない間は、利用者向けメッセージを表示しない。 */
	if ( ! isVisible ) {
		return null;
	}

	return (
		<div className="yamabiko-table-reorder-column-termination-notice">
			<Snackbar onRemove={ () => setIsVisible( false ) }>
				{ getDndTerminationMessage() }
			</Snackbar>
		</div>
	);
};
