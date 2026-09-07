/**
 * Row ReorderのDnD中と確定処理中に必要な利用者向け表示をまとめて接続する。
 *
 * 各PresentationはDnD Interactionの意味状態、Reorder Target Resolutionの開始拒否理由、
 * 表示に必要なDnD Engineの物理情報をそれぞれの境界から利用し、表示Lifecycleと表示状態を自身で所有する。
 */

import { RowCommitDisplay } from './commit-display';
import { RowDropAnimation } from './drop-animation';
import { RowInsertionGap } from './insertion-gap';
import { RowInsertionLine } from './insertion-line';
import { RowMovingDisplay } from './moving-row';
import { RowDisplacement } from './row-displacement';
import { RowStartRejectionNotice } from './start-rejection-notice';
import { RowTerminationNotice } from './termination-notice';

/**
 * 行DnDとdrop確定中に必要なPresentationを同じDnD Engine境界へ接続する。
 *
 * @return 行DnDと確定処理中の一時表示群。
 */
export const RowPresentation = () => (
	<>
		<RowDisplacement />
		<RowInsertionGap />
		<RowMovingDisplay />
		<RowDropAnimation />
		<RowCommitDisplay />
		<RowInsertionLine />
		<RowStartRejectionNotice />
		<RowTerminationNotice />
	</>
);
