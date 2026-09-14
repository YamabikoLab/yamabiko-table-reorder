/**
 * 列DnD開始拒否のblocking merged rangeと開始を試みた位置をReorder Presentationへ渡す一回性イベント境界を所有する。
 *
 * 表示部品や表示状態を持たず、Reorder Target Resolutionが返した原因となる横結合範囲と、
 * その範囲を利用者の操作位置付近へ提示するために必要な位置だけを現在のPresentation購読へ伝える。
 */

import type { ColumnBlockingMergedRange } from '@/reorder/column-reorder/responsibilities/table-integration';

/** 利用者が列DnD開始を試みた位置と、開始を妨げる横結合範囲。 */
export type ColumnStartRejectionNoticeEvent = {
	blockingMergedRange: ColumnBlockingMergedRange;
	clientX: number;
	clientY: number;
};

/**
 * Reorder Target Resolutionの開始拒否通知を受け取る購読処理。
 *
 * @param event 利用者へ提示する横結合範囲と、その表示基準となる操作位置。
 */
type ColumnStartRejectionListener = ( event: ColumnStartRejectionNoticeEvent ) => void;

/** 現在の開始拒否通知購読をPresentation境界内で保持する。 */
const columnStartRejectionListeners = new Set< ColumnStartRejectionListener >();

/**
 * Reorder Target Resolutionが返したblocking merged rangeを、開始を試みた位置とともに現在のPresentationへ通知する。
 *
 * @param event 利用者へ提示する横結合範囲と、その表示基準となる操作位置。
 */
export const notifyColumnStartRejection = ( event: ColumnStartRejectionNoticeEvent ): void => {
	/* 現在生存しているPresentation購読だけへ同じ開始拒否を一回ずつ伝える。 */
	columnStartRejectionListeners.forEach( ( listener ) => {
		listener( event );
	} );
};

/**
 * Reorder Presentationが開始拒否を一回性イベントとして受け取るために利用する。
 *
 * @param listener 開始拒否時に呼び出す購読処理。
 * @return 購読を解除する関数。
 */
export const subscribeColumnStartRejection = (
	listener: ColumnStartRejectionListener
): ( () => void ) => {
	columnStartRejectionListeners.add( listener );

	return () => {
		columnStartRejectionListeners.delete( listener );
	};
};
