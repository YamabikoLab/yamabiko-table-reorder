/**
 * 結合セルにより列DnDを開始できない場合の利用者向け通知表示を所有する。
 *
 * Reorder Target Resolutionが返したblocking merged cellと開始を試みた位置を受け取り、
 * 表示中かどうかと表示位置という一時状態はPresentation内に閉じる。
 * 利用不能や内部Errorではこの通知を表示しない。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';

import {
	getBodyBlockingMergedCellMessage,
	getSectionBlockingMergedCellMessage,
} from '@/blocking-merged-cell-message';

import {
	subscribeColumnStartRejection,
	type ColumnStartRejectionNoticeEvent,
} from './start-rejection-notice-event';
import './start-rejection-notice.scss';

const NOTICE_DURATION = 1500;

type ColumnStartRejectionNoticeState = ColumnStartRejectionNoticeEvent & {
	sequence: number;
};

/** 列DnD開始拒否通知を、開始を試みた位置の近くへ短時間だけ表示する。 */
export const ColumnStartRejectionNotice = () => {
	const [ notice, setNotice ] = useState< ColumnStartRejectionNoticeState | null >( null );
	const sequence = useRef( 0 );
	const timeoutId = useRef< ReturnType< typeof setTimeout > | null >( null );

	useEffect( () => {
		const unsubscribe = subscribeColumnStartRejection( ( event ) => {
			sequence.current += 1;
			const currentSequence = sequence.current;
			if ( timeoutId.current !== null ) {
				clearTimeout( timeoutId.current );
			}
			setNotice( { ...event, sequence: currentSequence } );
			timeoutId.current = setTimeout( () => {
				setNotice( ( current ) =>
					current?.sequence === currentSequence ? null : current
				);
			}, NOTICE_DURATION );
		} );

		return () => {
			unsubscribe();
			if ( timeoutId.current !== null ) {
				clearTimeout( timeoutId.current );
			}
		};
	}, [] );

	if ( notice === null ) {
		return null;
	}

	const removeNotice = (): void => {
		setNotice( ( current ) => ( current?.sequence === notice.sequence ? null : current ) );
	};

	const location = {
		rowStart: notice.blockingMergedCell.rowStart + 1,
		rowEnd: notice.blockingMergedCell.rowEnd + 1,
		columnStart: notice.blockingMergedCell.columnStart + 1,
		columnEnd: notice.blockingMergedCell.columnEnd + 1,
	};
	const message =
		notice.blockingMergedCell.section === 'body'
			? getBodyBlockingMergedCellMessage( location )
			: getSectionBlockingMergedCellMessage( notice.blockingMergedCell.section, location );

	return (
		<div
			className="yamabiko-table-reorder-column-start-rejection-notice"
			style={ { left: notice.clientX, top: notice.clientY } }
		>
			<Snackbar key={ notice.sequence } onRemove={ removeNotice }>
				{ message }
			</Snackbar>
		</div>
	);
};
