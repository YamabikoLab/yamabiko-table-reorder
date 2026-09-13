/**
 * WordPressのTable編集表示へ確認付き大規模反映と共通完了通知を接続するBoundary。
 *
 * 対象Tableの現在Presentation状態を選び、「確認 → 反映 → 復帰 → 完了通知」のUI構造を接続する。
 * 方向固有Store、Move意味、paint待ち、Editor DOM Context解決、scroll / focus実装は各private責務へ委譲する。
 */

import type { ReactNode } from 'react';

import { getLargeReorderApplyingMessage } from '@/messages';
import type { RfInteractionReactState } from '@/reorder/reorder-form/responsibilities/interaction-react';

import { useReorderApplyPresentationState } from './adapter';
import { ReorderApplying } from './applying';
import { ReorderApplyCompletion } from './completion';
import { ReorderApplyConfirmation } from './confirmation';
import { useReorderApplyLifecycle } from './lifecycle';

/**
 * 対象TableのBlockEditへ確認付き大規模反映UIと共通完了通知を接続する。
 *
 * RFの通常 / 大規模反映を含む完了通知は、このBoundary配下の共通Completion Presentationから表示する。
 * RF大規模反映ではRF Interactionの正常終了を完了イベントとして扱うため、再mount完了との二重通知は行わない。
 *
 * @param props          対象Tableと通常表示。
 * @param props.clientId 対象Table個体のclientId。
 * @param props.children 通常時に表示するGutenberg本来のTable編集UI。
 * @param props.rfStatus 対象Tableから見たRF Interaction状態。
 * @return 通常Table、確認Modal、反映中表示、復帰中表示、および共通完了通知。
 */
export const ReorderApplyTableBoundary = ( props: {
	clientId: string;
	children: ReactNode;
	rfStatus?: RfInteractionReactState[ 'status' ];
} ) => {
	const { clientId, children, rfStatus = 'closed' } = props;
	const presentation = useReorderApplyPresentationState( clientId );
	const { applyingReferenceElementRef, restorationReferenceElementRef } =
		useReorderApplyLifecycle( presentation );
	const isSuccessfulRemounting =
		presentation.phase === 'remounting' && presentation.applied && presentation.owner !== 'rf';

	return (
		<>
			{ presentation.phase === 'applying' ? (
				<ReorderApplying referenceElementRef={ applyingReferenceElementRef } />
			) : (
				<>
					{ children }
					{ presentation.phase === 'remounting' && (
						<div ref={ restorationReferenceElementRef } role="status">
							{ getLargeReorderApplyingMessage() }
						</div>
					) }
					{ presentation.phase === 'confirming' && (
						<ReorderApplyConfirmation
							moveSummary={ presentation.moveSummary }
							onConfirm={ presentation.confirm }
							onCancel={ presentation.cancel }
						/>
					) }
				</>
			) }
			<ReorderApplyCompletion
				isSuccessfulRemounting={ isSuccessfulRemounting }
				rfStatus={ rfStatus }
			/>
		</>
	);
};
