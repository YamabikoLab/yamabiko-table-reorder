/**
 * 並び替え反映結果を、操作を妨げない共通の一時通知として表示する。
 *
 * 通知を開始する契機や結果の正本は所有せず、確定済みの成功・失敗結果について表示時間、dismiss、
 * アイコン、配置、スタイルだけを共通Presentationとして所有する。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useRef } from '@wordpress/element';

import { REORDER_COMPLETION_NOTICE_DURATION_MS } from '@/reorder/reorder-tuning';

import './reorder-completion-notice.scss';

/** 並び替え結果通知として表示する結果種別。 */
export type ReorderCompletionNoticeStatus = 'success' | 'failure';

/**
 * 成功・失敗を色だけに依存せず識別できる結果アイコンを表示する。
 *
 * @param props        表示する結果種別。
 * @param props.status 成功または失敗の結果種別。
 * @return 成功時はチェック、失敗時は警告を表す装飾アイコン。
 */
const ReorderCompletionNoticeIcon = ( props: { status: ReorderCompletionNoticeStatus } ) => {
	const { status } = props;

	if ( status === 'failure' ) {
		return (
			<span
				className="yamabiko-table-reorder-completion__icon yamabiko-table-reorder-completion__icon--failure"
				aria-hidden="true"
			>
				<svg viewBox="0 0 24 24" focusable="false">
					<path d="M12 3.5 2.8 20h18.4L12 3.5Z" />
					<path d="M12 9v5" />
					<circle cx="12" cy="17" r="1" />
				</svg>
			</span>
		);
	}

	return (
		<span className="yamabiko-table-reorder-completion__icon" aria-hidden="true">
			<svg viewBox="0 0 24 24" focusable="false">
				<path d="m6.5 12.5 3.5 3.5 7.5-8" />
			</svg>
		</span>
	);
};

/**
 * 確定済みの並び替え結果を、成功・失敗で共通の一時通知として表示する。
 *
 * @param props          表示する結果通知。
 * @param props.status   成功または失敗の結果種別。
 * @param props.message  利用者へ表示する結果文言。
 * @param props.onRemove 表示時間満了または利用者dismiss時に通知所有者へ終了を伝える処理。
 * @return 共通デザインの一時通知。
 */
export const ReorderCompletionNotice = ( props: {
	status: ReorderCompletionNoticeStatus;
	message: string;
	onRemove: () => void;
} ) => {
	const { status, message, onRemove } = props;
	const onRemoveRef = useRef( onRemove );
	onRemoveRef.current = onRemove;

	useEffect( () => {
		const timeoutId = setTimeout(
			() => onRemoveRef.current(),
			REORDER_COMPLETION_NOTICE_DURATION_MS
		);
		return () => {
			clearTimeout( timeoutId );
		};
	}, [ message, status ] );

	const contentClassName =
		status === 'failure'
			? 'yamabiko-table-reorder-completion__content yamabiko-table-reorder-completion__content--failure'
			: 'yamabiko-table-reorder-completion__content';

	return (
		<div className="yamabiko-table-reorder-completion">
			<Snackbar onRemove={ onRemove }>
				<strong className={ contentClassName }>
					<ReorderCompletionNoticeIcon status={ status } />
					<span className="yamabiko-table-reorder-completion__message">{ message }</span>
				</strong>
			</Snackbar>
		</div>
	);
};
