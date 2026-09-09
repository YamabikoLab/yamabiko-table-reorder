/**
 * Column Reorderで必要な利用者向け一時表示をまとめて接続する。
 *
 * 各PresentationはDnD Interactionが確定した意味状態、Reorder Target Resolutionの開始拒否理由、
 * 表示に必要なDnD Engineの物理情報をそれぞれの境界から利用し、表示Lifecycleと一時表示状態だけを所有する。
 * DnD開始前の開始拒否通知とDnD中の移動対象表示・周囲列移動を同じColumn Presentation境界へ集約する。
 * 現在操作中のTableだけへ接続する判断はDnD Engine Integrationが所有し、この境界ではTable選択状態を重ねて管理しない。
 */

import { ColumnDisplacement } from './column-displacement';
import { ColumnMovingDisplay } from './moving-column';
import { ColumnStartRejectionNotice } from './start-rejection-notice';

/**
 * 列並び替えに必要なPresentationを同じDnD Engine境界へ接続する。
 *
 * このcomponent自身はDnD SessionやTable選択状態を所有せず、配下の表示責務を接続する境界だけを提供する。
 *
 * @return 列並び替えの一時表示群。
 */
export const ColumnPresentation = () => (
	<>
		<ColumnDisplacement />
		<ColumnMovingDisplay />
		<ColumnStartRejectionNotice />
	</>
);
