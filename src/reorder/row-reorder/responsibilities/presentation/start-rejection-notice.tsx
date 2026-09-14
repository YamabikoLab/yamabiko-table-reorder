/**
 * 結合セルにより行DnDを開始できない場合の利用者向け通知表示を所有する。
 *
 * 原因となる結合セル位置と開始を試みた位置を一回性の表示要求として受け取り、
 * 表示内容、表示位置、連続通知、表示終了という一時状態をこのPresentation内に閉じる。
 * 利用不能や内部Errorではこの通知を表示しない。
 */

import { Snackbar } from '@wordpress/components';
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from '@wordpress/element';

import { getRowMergedRangeMessage } from '@/messages';
import { DND_START_REJECTION_NOTICE_DURATION_MS } from '@/reorder/reorder-tuning';
import type { RowBlockingMergedRange } from '@/reorder/row-reorder/responsibilities/table-integration';

import './start-rejection-notice.scss';

/** 行DnD開始拒否通知を表示する一回性要求。 */
export type RowStartRejectionNoticeRequest = {
	blockingMergedRange: RowBlockingMergedRange;
	clientX: number;
	clientY: number;
};

/** 行DnD開始拒否通知が外側へ公開する表示境界。 */
export type RowStartRejectionNoticeHandle = {
	/**
	 * 現在の開始拒否を表示し、表示終了時間をこの要求から数え直す。
	 *
	 * @param request 原因となる結合セル位置と開始を試みた位置。
	 */
	show: ( request: RowStartRejectionNoticeRequest ) => void;
};

/** 行DnD開始拒否通知の一回分の表示状態。 */
type RowStartRejectionNoticeState = RowStartRejectionNoticeRequest & {
	sequence: number;
};

/**
 * 行DnD開始拒否通知を、開始を試みた位置の近くへ短時間だけ表示する。
 *
 * 新しい開始拒否が続けて発生した場合は表示時間をその通知から数え直し、先の通知終了によって最新通知を消さない。
 */
export const RowStartRejectionNotice = forwardRef< RowStartRejectionNoticeHandle >(
	function RowStartRejectionNoticeView( _props, ref ) {
		const [ notice, setNotice ] = useState< RowStartRejectionNoticeState | null >( null );
		const sequence = useRef( 0 );
		const timeoutId = useRef< ReturnType< typeof setTimeout > | null >( null );

		const show = useCallback( ( request: RowStartRejectionNoticeRequest ): void => {
			sequence.current += 1;
			const currentSequence = sequence.current;

			if ( timeoutId.current !== null ) {
				clearTimeout( timeoutId.current );
			}

			setNotice( {
				...request,
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
			}, DND_START_REJECTION_NOTICE_DURATION_MS );
		}, [] );

		useImperativeHandle( ref, () => ( { show } ), [ show ] );

		useEffect( () => {
			return () => {
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

		const { rowStart, rowEnd, columnStart, columnEnd } = notice.blockingMergedRange;
		const message = getRowMergedRangeMessage(
			rowStart + 1,
			rowEnd + 1,
			columnStart + 1,
			columnEnd + 1
		);

		return (
			<div
				className="yamabiko-table-reorder-start-rejection-notice"
				style={ {
					left: notice.clientX,
					top: notice.clientY,
				} }
			>
				<Snackbar key={ notice.sequence } onRemove={ removeNotice }>
					{ message }
				</Snackbar>
			</div>
		);
	}
);
