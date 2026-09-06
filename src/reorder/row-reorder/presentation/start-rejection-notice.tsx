/**
 * 結合セルにより行DnDを開始できない場合の利用者向け通知表示を所有する。
 *
 * Reorder Target Resolutionが返した開始拒否理由だけを受け取り、表示中かどうかという一時状態はPresentation内に閉じる。
 * 利用不能や内部Errorではこの通知を表示しない。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';

import { getRowDndStartRejectionMessage } from '@/messages';
import type { RowReorderTargetRejectionReason } from '@/reorder/row-reorder/target-resolution';

import './start-rejection-notice.scss';

/** Reorder Target Resolutionの開始拒否理由を受け取る購読listener。 */
type RowStartRejectionListener = ( reason: RowReorderTargetRejectionReason ) => void;

/** 現在の開始拒否通知購読をPresentation境界内で保持する。 */
const rowStartRejectionListeners = new Set< RowStartRejectionListener >();

/**
 * Reorder Target Resolutionが返した開始拒否理由を現在のPresentationへ通知する。
 *
 * @param reason Designで利用者へ提示する開始拒否理由。
 */
export const notifyRowStartRejection = ( reason: RowReorderTargetRejectionReason ): void => {
	rowStartRejectionListeners.forEach( ( listener ) => {
		listener( reason );
	} );
};

/**
 * 行DnD開始拒否通知を短時間だけ表示する。
 *
 * @return 結合セルにより開始できなかった後だけ表示する一時メッセージ。それ以外はnull。
 */
export const RowStartRejectionNotice = () => {
	const [ noticeSequence, setNoticeSequence ] = useState< number | null >( null );

	useEffect( () => {
		const listener: RowStartRejectionListener = ( reason ) => {
			/* 現在Designで利用者向け理由を定義している結合範囲の開始拒否だけを表示対象とする。 */
			if ( reason === 'merged-range' ) {
				setNoticeSequence( ( current ) => ( current ?? 0 ) + 1 );
			}
		};

		rowStartRejectionListeners.add( listener );
		return () => {
			rowStartRejectionListeners.delete( listener );
		};
	}, [] );

	/* 開始拒否通知が発生していない間は利用者向けメッセージを表示しない。 */
	if ( noticeSequence === null ) {
		return null;
	}

	const removeNotice = (): void => {
		setNoticeSequence( ( current ) => {
			const isRemovalForCurrentNotice = current === noticeSequence;

			/* 表示中に次の通知が発生していた場合は先の通知終了によって最新通知を消さない。 */
			if ( ! isRemovalForCurrentNotice ) {
				return current;
			}

			return null;
		} );
	};

	return (
		<div className="yamabiko-table-reorder-start-rejection-notice">
			<Snackbar key={ noticeSequence } onRemove={ removeNotice }>
				{ getRowDndStartRejectionMessage() }
			</Snackbar>
		</div>
	);
};
