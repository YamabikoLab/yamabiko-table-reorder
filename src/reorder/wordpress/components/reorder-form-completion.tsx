/**
 * Reorder Form（RF）のApply確定結果を、操作を妨げない一時通知として表示する。
 *
 * RF Interactionが所有する未消費の確定結果を一度だけPresentationへ取り込み、通知表示開始時に消費する。
 * Snackbarの表示寿命はcomponent-local stateとして管理し、RF Session Lifecycleから通知成否を推測しない。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage, getRfApplyFailureMessage } from '@/messages';
import type { RfApplyOutcome } from '@/reorder/reorder-form/responsibilities/interaction';

import './reorder-form.scss';

/** 完了結果を認識できる時間を確保しつつ、Editorを長く覆わない表示時間。 */
const COMPLETION_NOTICE_DURATION_MS = 2000;

/**
 * RF Interactionが確定した成功または失敗結果を一度だけ通知する。
 *
 * @param props                     RF Apply確定結果と消費境界。
 * @param props.applyOutcome        対象Tableに属する未消費のApply確定結果。
 * @param props.consumeApplyOutcome 通知表示を開始した確定結果をRF Interactionから消費する操作。
 * @return 未消費結果を取り込んだ直後だけ表示する一時通知。それ以外はnull。
 */
export const ReorderFormCompletion = ( props: {
	applyOutcome: RfApplyOutcome | null;
	consumeApplyOutcome: ( outcome: RfApplyOutcome ) => void;
} ) => {
	const { applyOutcome, consumeApplyOutcome } = props;
	const [ notice, setNotice ] = useState< RfApplyOutcome | null >( null );

	useEffect( () => {
		if ( applyOutcome === null ) {
			return;
		}

		setNotice( applyOutcome );
		consumeApplyOutcome( applyOutcome );
	}, [ applyOutcome, consumeApplyOutcome ] );

	useEffect( () => {
		if ( notice === null ) {
			return;
		}

		const currentNotice = notice;
		const timeoutId = setTimeout( () => {
			setNotice( ( current ) => {
				const nextNotice = current === currentNotice ? null : current;
				return nextNotice;
			} );
		}, COMPLETION_NOTICE_DURATION_MS );

		return () => clearTimeout( timeoutId );
	}, [ notice ] );

	if ( notice === null ) {
		return null;
	}

	const removeNotice = (): void => {
		setNotice( ( current ) => {
			const nextNotice = current === notice ? null : current;
			return nextNotice;
		} );
	};
	const succeeded = notice.result === 'success';
	const message = succeeded ? getLargeReorderCompletionMessage() : getRfApplyFailureMessage();
	const mark = succeeded ? '✓' : '!';

	return (
		<div className="yamabiko-table-reorder-rf-completion">
			<Snackbar onRemove={ removeNotice }>
				<strong className="yamabiko-table-reorder-rf-completion__content">
					<span aria-hidden="true">{ mark }</span>
					{ message }
				</strong>
			</Snackbar>
		</div>
	);
};
