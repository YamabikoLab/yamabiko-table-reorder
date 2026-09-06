/**
 * WordPress EditorのTableツールバーへReorder Mode入口と初回案内を表示するReactコンポーネントを所有する。
 *
 * 行・列の入口を排他的なReorder Mode状態へ接続し、0.5.0では公開済みの行入口だけを初回案内で強調する。
 */

import { BlockControls } from '@wordpress/block-editor';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { useState } from '@wordpress/element';

import { getColumnReorderName, getRowReorderName } from '@/messages';
import { useReorderMode } from '@/reorder/reorder-mode-react';
import { ReorderGuidance } from '@/reorder/wordpress/components/guidance';
import { useReorderGuidance } from '@/reorder/wordpress/hooks/use-reorder-guidance';

import './toolbar.scss';

/** Reorder Modeのツールバーへ接続する対象Tableを表す。 */
type ReorderModeToolbarProps = {
	tableIdentity: string;
};

/** 行並び替えのツールバー入口に表示する専用アイコン。 */
const rowReorderIcon = (
	<svg
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect height="4" rx="0.75" width="14" x="2.5" y="3.5" />
		<line x1="6" x2="6" y1="3.5" y2="7.5" />
		<line x1="8.25" x2="13.75" y1="5.5" y2="5.5" />
		<rect height="4" rx="0.75" width="14" x="2.5" y="10" />
		<line x1="6" x2="6" y1="10" y2="14" />
		<line x1="8.25" x2="13.75" y1="12" y2="12" />
		<rect height="4" rx="0.75" width="14" x="2.5" y="16.5" />
		<line x1="6" x2="6" y1="16.5" y2="20.5" />
		<line x1="8.25" x2="13.75" y1="18.5" y2="18.5" />
		<line x1="20" x2="20" y1="6.25" y2="17.75" />
		<polyline points="18,8.25 20,6.25 22,8.25" />
		<polyline points="18,15.75 20,17.75 22,15.75" />
	</svg>
);

/** 列並び替えのツールバー入口に表示する専用アイコン。 */
const columnReorderIcon = (
	<svg
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect height="14" rx="0.75" width="4" x="3.5" y="2.5" />
		<line x1="3.5" x2="7.5" y1="6" y2="6" />
		<rect height="14" rx="0.75" width="4" x="10" y="2.5" />
		<line x1="10" x2="14" y1="6" y2="6" />
		<rect height="14" rx="0.75" width="4" x="16.5" y="2.5" />
		<line x1="16.5" x2="20.5" y1="6" y2="6" />
		<line x1="6.25" x2="17.75" y1="20" y2="20" />
		<polyline points="8.25,18 6.25,20 8.25,22" />
		<polyline points="15.75,18 17.75,20 15.75,22" />
	</svg>
);

/**
 * 対応Tableの行・列並び替え入口をReorder Modeへ接続し、公開中の入口と初回案内を表示する。
 *
 * @param props ツールバーを表示するTable Identity。
 * @return 現在のReorder Mode選択状態と初回案内状態を反映したツールバー入口。
 */
export const ReorderModeToolbar = ( props: ReorderModeToolbarProps ) => {
	const { tableIdentity } = props;
	const { selectedKind, select: selectMode } = useReorderMode( tableIdentity );
	const [ guidanceAnchor, setGuidanceAnchor ] = useState< HTMLElement | null >( null );
	const { dismiss, isVisible: isGuidanceVisible } = useReorderGuidance(
		tableIdentity,
		guidanceAnchor
	);

	/* 初回案内中は、0.5.0で公開する行入口だけを開始位置として通常時より強調する。 */
	const rowGuidanceTargetClassName = isGuidanceVisible
		? 'yamabiko-table-reorder-guidance-target'
		: undefined;

	return (
		<BlockControls>
			<ToolbarGroup>
				{ /* 選択中の方向だけを現在の並び替えモードとして表示する。 */ }
				<ToolbarButton
					ref={ setGuidanceAnchor }
					className={ rowGuidanceTargetClassName }
					icon={ rowReorderIcon }
					isPressed={ selectedKind === 'row' }
					label={ getRowReorderName() }
					onClick={ () => selectMode( 'row' ) }
				/>
				<ToolbarButton
					className="yamabiko-table-reorder-column-entry"
					icon={ columnReorderIcon }
					isPressed={ selectedKind === 'column' }
					label={ getColumnReorderName() }
					onClick={ () => selectMode( 'column' ) }
				/>
			</ToolbarGroup>
			<ReorderGuidance
				anchor={ guidanceAnchor }
				isVisible={ isGuidanceVisible }
				onDismiss={ dismiss }
			/>
		</BlockControls>
	);
};
