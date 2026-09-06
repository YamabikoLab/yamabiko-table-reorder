/**
 * 行DnD開始拒否理由と開始を試みた位置をReorder Presentationへ渡す一回性イベント境界を所有する。
 *
 * 表示部品や表示状態を持たず、Reorder Target Resolutionが返した利用者向け開始拒否理由と、
 * その理由を利用者の操作位置付近へ提示するために必要な位置だけを現在のPresentation購読へ伝える。
 */

import type { RowReorderTargetRejectionReason } from '@/reorder/row-reorder/target-resolution';

/** 利用者が行DnD開始を試みた位置と、Designで提示する開始拒否理由。 */
export type RowStartRejectionNoticeEvent = {
	reason: RowReorderTargetRejectionReason;
	clientX: number;
	clientY: number;
};

/** Reorder Target Resolutionの開始拒否通知を受け取る購読listener。 */
type RowStartRejectionListener = ( event: RowStartRejectionNoticeEvent ) => void;

/** 現在の開始拒否通知購読をPresentation境界内で保持する。 */
const rowStartRejectionListeners = new Set< RowStartRejectionListener >();

/**
 * Reorder Target Resolutionが返した開始拒否理由を、開始を試みた位置とともに現在のPresentationへ通知する。
 *
 * @param event Designで利用者へ提示する開始拒否理由と、その表示基準となる操作位置。
 */
export const notifyRowStartRejection = ( event: RowStartRejectionNoticeEvent ): void => {
	rowStartRejectionListeners.forEach( ( listener ) => {
		listener( event );
	} );
};

/**
 * Reorder Presentationが開始拒否を一回性イベントとして受け取るために利用する。
 *
 * @param listener 開始拒否時に呼び出す購読listener。
 * @return 購読を解除する関数。
 */
export const subscribeRowStartRejection = (
	listener: RowStartRejectionListener
): ( () => void ) => {
	rowStartRejectionListeners.add( listener );

	return () => {
		rowStartRejectionListeners.delete( listener );
	};
};
