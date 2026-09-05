/**
 * Row ReorderのDnD中に必要な利用者向け表示をまとめて接続する。
 *
 * 各PresentationはDnD Interactionの意味状態と、表示に必要なDnD Engineの物理情報をそれぞれ直接利用し、
 * DnD接続側へ表示Lifecycleや表示固有状態を持ち込まない。
 */

import { RowDropAnimation } from './drop-animation';
import { RowInsertionGap } from './insertion-gap';
import { RowInsertionLine } from './insertion-line';
import { RowMovingDisplay } from './moving-row';
import { RowDisplacement } from './row-displacement';
import './row-highlight.scss';

/**
 * 行DnD中に必要なPresentationを同じDnD Engine境界へ接続する。
 *
 * @return 行DnD中の一時表示群。
 */
export const RowPresentation = () => (
	<>
		<RowDisplacement />
		<RowInsertionGap />
		<RowMovingDisplay />
		<RowDropAnimation />
		<RowInsertionLine />
	</>
);
