/**
 * Reorder Form（RF）の反映結果を、操作を妨げない一時通知として表示する。
 *
 * RF Interactionが保持する未消費のApply Outcomeを正本とし、Reactの描画履歴やTableの再mount有無に依存せず
 * 通常反映と確認付き大規模反映の成功・失敗を同じ経路から一度だけ通知する。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage, getRfApplyFailureMessage } from '@/messages';
import { rfInteraction } from '@/reorder/reorder-form/responsibilities/interaction';
import { useRfApplyOutcome } from '@/reorder/reorder-form/responsibilities/interaction-react';

import './reorder-form.scss';

/** 完了結果を認識できる時間を確保しつつ、Editorを長く覆わない表示時間。 */
const COMPLETION_NOTICE_DURATION_MS = 2000;

/** RF反映結果として現在表示している通知種別。 */
type ReorderFormNotice = 'success' | 'failure' | null;

/**
 * 成功・失敗を色だけに依存せず識別できる結果アイコンを表示する。
 *
 * @param props           表示する結果種別。
 * @param props.isFailure 失敗結果であるか。
 * @return 成功時はチェック、失敗時は警告を表す装飾アイコン。
 */
const ReorderFormCompletionIcon = ( props: { isFailure: boolean } ) => {
	const { isFailure } = props;

	if ( isFailure ) {
		return (
			<span
				className="yamabiko-table-reorder-rf-completion__icon yamabiko-table-reorder-rf-completion__icon--failure"
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
		<span className="yamabiko-table-reorder-rf-completion__icon" aria-hidden="true">
			<svg viewBox="0 0 24 24" focusable="false">
				<path d="m6.5 12.5 3.5 3.5 7.5-8" />
			</svg>
		</span>
	);
};

/**
 * RF Interactionが反映結果を確定した直後だけ結果通知を表示する。
 *
 * @param props               通知対象Table。
 * @param props.tableIdentity RF反映結果を購読するTable Identity。
 * @return 未消費の成功・失敗結果を受け取った直後だけ表示する一時通知。それ以外はnull。
 */
export const ReorderFormCompletion = ( props: { tableIdentity: string } ) => {
	const { tableIdentity } = props;
	const applyOutcome = useRfApplyOutcome( tableIdentity );
	const [ notice, setNotice ] = useState< ReorderFormNotice >( null );
	const timeoutRef = useRef< ReturnType< typeof setTimeout > | null >( null );

	useEffect( () => {
		if ( applyOutcome.status === 'idle' ) {
			return;
		}

		/* 未消費結果はStoreで一度だけ消費し、表示中の通知種別と表示時間だけをPresentationで所有する。 */
		setNotice( applyOutcome.status );
		rfInteraction.consumeApplyOutcome( tableIdentity );

		if ( timeoutRef.current !== null ) {
			clearTimeout( timeoutRef.current );
		}

		timeoutRef.current = setTimeout( () => {
			setNotice( null );
			timeoutRef.current = null;
		}, COMPLETION_NOTICE_DURATION_MS );
	}, [ applyOutcome, tableIdentity ] );

	useEffect(
		() => () => {
			if ( timeoutRef.current !== null ) {
				clearTimeout( timeoutRef.current );
			}
		},
		[]
	);

	if ( notice === null ) {
		return null;
	}

	const removeNotice = (): void => {
		if ( timeoutRef.current !== null ) {
			clearTimeout( timeoutRef.current );
			timeoutRef.current = null;
		}
		setNotice( null );
	};

	const isFailure = notice === 'failure';
	const message = isFailure ? getRfApplyFailureMessage() : getLargeReorderCompletionMessage();
	const contentClassName = isFailure
		? 'yamabiko-table-reorder-rf-completion__content yamabiko-table-reorder-rf-completion__content--failure'
		: 'yamabiko-table-reorder-rf-completion__content';

	return (
		<div className="yamabiko-table-reorder-rf-completion">
			<Snackbar onRemove={ removeNotice }>
				<strong className={ contentClassName }>
					<ReorderFormCompletionIcon isFailure={ isFailure } />
					<span className="yamabiko-table-reorder-rf-completion__message">
						{ message }
					</span>
				</strong>
			</Snackbar>
		</div>
	);
};
