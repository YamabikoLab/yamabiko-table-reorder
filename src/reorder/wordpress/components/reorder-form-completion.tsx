/**
 * Reorder Form（RF）の正常反映完了を、操作を妨げない一時通知として表示する。
 *
 * RF Interactionが保持する未消費のApply Outcomeを正本とし、Reactの描画履歴やTableの再mount有無に依存せず
 * 通常反映と確認付き大規模反映の成功を同じ経路から一度だけ通知する。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage } from '@/messages';
import { rfInteraction } from '@/reorder/reorder-form/responsibilities/interaction';
import { useRfApplyOutcome } from '@/reorder/reorder-form/responsibilities/interaction-react';

import './reorder-form.scss';

/** 完了を認識できる時間を確保しつつ、Editorを長く覆わない表示時間。 */
const COMPLETION_NOTICE_DURATION_MS = 2000;

/**
 * RF Interactionが正常反映を完了した直後だけ完了通知を表示する。
 *
 * @param props               通知対象Table。
 * @param props.tableIdentity RF完了結果を購読するTable Identity。
 * @return 未消費の正常完了を受け取った直後だけ表示する一時通知。それ以外はnull。
 */
export const ReorderFormCompletion = ( props: { tableIdentity: string } ) => {
	const { tableIdentity } = props;
	const applyOutcome = useRfApplyOutcome( tableIdentity );
	const [ isNoticeVisible, setIsNoticeVisible ] = useState( false );
	const timeoutRef = useRef< ReturnType< typeof setTimeout > | null >( null );

	useEffect( () => {
		if ( applyOutcome.status !== 'success' ) {
			return;
		}

		/* 成功事実はStoreで一度だけ消費し、表示時間だけをPresentationのlocal stateで所有する。 */
		rfInteraction.consumeApplyOutcome( tableIdentity );
		setIsNoticeVisible( true );

		if ( timeoutRef.current !== null ) {
			clearTimeout( timeoutRef.current );
		}

		timeoutRef.current = setTimeout( () => {
			setIsNoticeVisible( false );
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

	if ( ! isNoticeVisible ) {
		return null;
	}

	const removeNotice = (): void => {
		if ( timeoutRef.current !== null ) {
			clearTimeout( timeoutRef.current );
			timeoutRef.current = null;
		}
		setIsNoticeVisible( false );
	};

	return (
		<div className="yamabiko-table-reorder-rf-completion">
			<Snackbar onRemove={ removeNotice }>
				<strong className="yamabiko-table-reorder-rf-completion__content">
					<span aria-hidden="true">✓</span>
					{ getLargeReorderCompletionMessage() }
				</strong>
			</Snackbar>
		</div>
	);
};
