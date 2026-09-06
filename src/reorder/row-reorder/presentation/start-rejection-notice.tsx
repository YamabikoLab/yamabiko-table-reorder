/**
 * 結合セルにより行DnDを開始できない場合の利用者向け通知表示を所有する。
 *
 * Reorder Target Resolutionが返した開始拒否理由と開始を試みた位置を受け取り、
 * 表示中かどうかと表示位置という一時状態はPresentation内に閉じる。
 * 利用不能や内部Errorではこの通知を表示しない。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';

import { getRowDndStartRejectionMessage } from '@/messages';

import {
	subscribeRowStartRejection,
	type RowStartRejectionNoticeEvent,
} from './start-rejection-notice-event';
import './start-rejection-notice.scss';

const NOTICE_DURATION = 1500;

type RowStartRejectionNoticeState = RowStartRejectionNoticeEvent & {
	sequence: number;
};

/**
 * 行DnD開始拒否通知を、開始を試みた位置の近くへ短時間だけ表示する。
 *
 * 新しい開始拒否が続けて発生した場合は表示時間をその通知から数え直し、先の通知終了によって最新通知を消さない。
 *
 * @return 結合セルにより開始できなかった後だけ表示する一時メッセージ。それ以外はnull。
 */
export const RowStartRejectionNotice = () => {
	const [ notice, setNotice ] = useState< RowStartRejectionNoticeState | null >( null );
	const sequence = useRef( 0 );
	const timeoutId = useRef< ReturnType< typeof setTimeout > | null >( null );

	useEffect( () => {
		const unsubscribe = subscribeRowStartRejection( ( event ) => {
			sequence.current += 1;
			const currentSequence = sequence.current;

			if ( timeoutId.current !== null ) {
				clearTimeout( timeoutId.current );
			}

			setNotice( {
				...event,
				sequence: currentSequence,
			} );

			timeoutId.current = setTimeout( () => {
				setNotice( ( current ) => {
					const isTimeoutForCurrentNotice = current?.sequence === currentSequence;

					/* 新しい通知へ切り替わっている場合は、先の通知に属する終了処理で表示を消さない。 */
					if ( ! isTimeoutForCurrentNotice ) {
						return current;
					}

					return null;
				} );
			}, NOTICE_DURATION );
		} );

		return () => {
			unsubscribe();

			if ( timeoutId.current !== null ) {
				clearTimeout( timeoutId.current );
			}
		};
	}, [] );

	/* 開始拒否通知が発生していない間は利用者向けメッセージを表示しない。 */
	if ( notice === null ) {
		return null;
	}

	const removeNotice = (): void => {
		setNotice( ( current ) => {
			const isRemovalForCurrentNotice = current?.sequence === notice.sequence;

			/* 表示中に次の通知が発生していた場合は先の通知終了によって最新通知を消さない。 */
			if ( ! isRemovalForCurrentNotice ) {
				return current;
			}

			return null;
		} );
	};

	return (
		<div
			className="yamabiko-table-reorder-start-rejection-notice"
			style={ {
				left: notice.clientX,
				top: notice.clientY,
			} }
		>
			<Snackbar key={ notice.sequence } onRemove={ removeNotice }>
				{ getRowDndStartRejectionMessage() }
			</Snackbar>
		</div>
	);
};
