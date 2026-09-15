/**
 * Row ReorderのDnD中に必要な利用者向け表示をまとめて接続する。
 *
 * 各PresentationはDnD Interactionの意味状態、Reorder Target Resolutionの開始拒否理由、
 * 表示に必要なDnD Engineの物理情報をそれぞれの境界から利用し、表示Lifecycleと表示状態を自身で所有する。
 */

import { RowInsertionLine } from './insertion-line';
import { RowMovingDisplay } from './moving-row';
import {
	RowStartRejectionNotice,
	type RowStartRejectionNoticeHandle,
} from './start-rejection-notice';
import { RowTerminationNotice } from './termination-notice';
import type { Ref } from 'react';

/**
 * 行DnDに必要なPresentationを同じDnD Engine境界へ接続する。
 *
 * @param props                         行DnD表示に必要な値。
 * @param props.startRejectionNoticeRef 開始拒否表示要求をNoticeだけへ接続する参照。
 * @return 行DnDの一時表示群。
 */
export const RowPresentation = ( props: {
	startRejectionNoticeRef: Ref< RowStartRejectionNoticeHandle >;
} ) => (
	<>
		<RowMovingDisplay />
		<RowInsertionLine />
		<RowStartRejectionNotice ref={ props.startRejectionNoticeRef } />
		<RowTerminationNotice />
	</>
);
