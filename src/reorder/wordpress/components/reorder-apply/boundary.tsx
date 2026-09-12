/**
 * WordPressのTable編集表示へ確認付き大規模反映を接続するBoundary。
 *
 * 対象Tableの現在Presentation状態を選び、「確認 → 反映 → 復帰」のUI構造を接続する。
 * 方向固有Store、Move意味、paint待ち、Editor DOM Context解決、scroll / focus実装は各private責務へ委譲する。
 */

import type { ReactNode } from 'react';

import { getLargeReorderApplyingMessage } from '@/messages';

import { useReorderApplyPresentationState } from './adapter';
import { ReorderApplying } from './applying';
import { ReorderApplyConfirmation } from './confirmation';
import { useReorderApplyLifecycle } from './lifecycle';

/**
 * 対象TableのBlockEditへ確認付き大規模反映UIと表示Lifecycleを接続する。
 *
 * @param props          対象Tableと通常表示。
 * @param props.clientId 対象Table個体のclientId。
 * @param props.children 通常時に表示するGutenberg本来のTable編集UI。
 * @return 通常Table、確認Modal、反映中表示、または復帰中表示。
 */
export const ReorderApplyTableBoundary = ( props: { clientId: string; children: ReactNode } ) => {
	const { clientId, children } = props;
	const presentation = useReorderApplyPresentationState( clientId );
	const { applyingAnchorRef, restorationAnchorRef } = useReorderApplyLifecycle( presentation );

	if ( presentation.phase === 'applying' ) {
		return <ReorderApplying anchorRef={ applyingAnchorRef } />;
	}

	return (
		<>
			{ children }
			{ presentation.phase === 'remounting' && (
				<div ref={ restorationAnchorRef } role="status">
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
	);
};
