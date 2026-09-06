/**
 * 行DnD開始拒否理由をReorder Presentationへ渡す一回性イベント境界を所有する。
 *
 * 表示部品や表示状態を持たず、Reorder Target Resolutionが返した利用者向け開始拒否理由だけを
 * 現在のPresentation購読へ伝える。
 */

import type { RowReorderTargetRejectionReason } from '@/reorder/row-reorder/target-resolution';

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
 * Reorder Presentationが開始拒否理由を一回性イベントとして受け取るために利用する。
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
