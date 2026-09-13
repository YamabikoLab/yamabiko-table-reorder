/**
 * Reorder Form（RF）の正常反映完了を、操作を妨げない一時通知として表示する。
 *
 * RF Interactionの`applying`から`closed`への遷移だけを成功として扱い、通常反映と確認付き大規模反映を
 * 同じ経路から一度だけ通知する。Apply LifecycleやRF Session状態そのものは変更しない。
 */

import { Snackbar } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';

import { getLargeReorderCompletionMessage } from '@/messages';
import type { RfInteractionReactState } from '@/reorder/reorder-form/responsibilities/interaction-react';

import './reorder-form.scss';

/** 完了を認識できる時間を確保しつつ、Editorを長く覆わない表示時間。 */
const COMPLETION_NOTICE_DURATION_MS = 2000;

/**
 * RF Interactionが正常反映を完了した直後だけ完了通知を表示する。
 *
 * @param props        現在RF状態。
 * @param props.status 対象Tableから見たRF Interaction状態。
 * @return 正常反映直後だけ表示する一時通知。それ以外はnull。
 */
export const ReorderFormCompletion = ( props: { status: RfInteractionReactState[ 'status' ] } ) => {
	const { status } = props;
	const previousStatus = useRef( status );
	const [ noticeSequence, setNoticeSequence ] = useState< number | null >( null );

	useEffect( () => {
		const completed = previousStatus.current === 'applying' && status === 'closed';
		previousStatus.current = status;

		/* failure / cancelledはopenへ戻るため、applying→closedだけが正常反映を表す。 */
		if ( completed ) {
			setNoticeSequence( ( current ) => ( current ?? 0 ) + 1 );
		}
	}, [ status ] );

	useEffect( () => {
		if ( noticeSequence === null ) {
			return;
		}

		const currentNoticeSequence = noticeSequence;
		const timeoutId = setTimeout( () => {
			setNoticeSequence( ( current ) => {
				const nextSequence = current === currentNoticeSequence ? null : current;
				return nextSequence;
			} );
		}, COMPLETION_NOTICE_DURATION_MS );

		return () => clearTimeout( timeoutId );
	}, [ noticeSequence ] );

	if ( noticeSequence === null ) {
		return null;
	}

	const removeNotice = (): void => {
		setNoticeSequence( ( current ) => {
			const nextSequence = current === noticeSequence ? null : current;
			return nextSequence;
		} );
	};

	return (
		<div className="yamabiko-table-reorder-rf-completion">
			<Snackbar key={ noticeSequence } onRemove={ removeNotice }>
				<strong className="yamabiko-table-reorder-rf-completion__content">
					<span aria-hidden="true">✓</span>
					{ getLargeReorderCompletionMessage() }
				</strong>
			</Snackbar>
		</div>
	);
};
