/**
 * Reorder機能をWordPress Editorの拡張ポイントへ接続する配線を所有する。
 *
 * WordPress固有の対応Block判定とEditor選択状態の解決をこの境界へ閉じ込め、Reorder Mode本体へ持ち込まない。
 * #910 PoCでは反映開始後の全Block編集抑止もこのBlockEdit接続境界で適用する。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { select } from '@wordpress/data';
import type { ComponentType } from '@wordpress/element';

import {
	ReorderModeBlockListBlock,
	type ReorderModeBlockListBlockProps,
} from '@/reorder/wordpress/components/block-list-block';
import { ReorderModeEdit, type TableBlockEditProps } from '@/reorder/wordpress/components/edit';
import { useLargeReorderPocEditingGuard } from '@/reorder/wordpress/components/large-reorder-poc';

/** Reorder Modeへ接続するTable Block名。 */
const SUPPORTED_TABLE_BLOCKS = new Set( [ 'core/table', 'flexible-table-block/table' ] );

/**
 * 現在の操作対象として選択されている対応Table Identityを取得する。
 *
 * React componentの生成状態ではなくEditorの選択状態を正本とし、Table componentの再生成と操作対象の離脱を区別する。
 *
 * @return 現在選択されている対応Table Identity。対応Tableが操作対象でなければnull。
 */
const getSelectedTableIdentity = () => {
	const blockEditor = select( blockEditorStore );
	const selectedBlockClientId = blockEditor.getSelectedBlockClientId();
	const selectedBlock = selectedBlockClientId
		? blockEditor.getBlock( selectedBlockClientId )
		: null;
	const selectedTableIdentity =
		selectedBlockClientId && selectedBlock && SUPPORTED_TABLE_BLOCKS.has( selectedBlock.name )
			? selectedBlockClientId
			: null;

	return selectedTableIdentity;
};

/**
 * BlockEditへReorder ModeのToolbar接続境界を追加するHOC。
 *
 * BlockEdit自体は独自DOM要素で囲まず、Gutenberg本来のBlock構造を維持する。
 * #910 PoCの反映開始後は対応Block種別にかかわらずWordPressの編集modeをdisabledへ切り替える。
 *
 * @param BlockEdit Gutenbergが提供する元のBlockEdit component。
 * @return 対応TableだけへReorder Modeを接続し、PoC中は全Blockへ編集抑止を適用するBlockEdit component。
 */
export const withReorderMode = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithReorderMode( props: TableBlockEditProps ) {
		useLargeReorderPocEditingGuard();

		/* Reorder Modeの責務は対応Tableだけに限定し、その他のBlockにはPoC中の編集抑止以外で介入しない。 */
		if ( ! SUPPORTED_TABLE_BLOCKS.has( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<ReorderModeEdit
				BlockEdit={ BlockEdit }
				getSelectedTableIdentity={ getSelectedTableIdentity }
				props={ props }
			/>
		);
	};

/**
 * Gutenberg既存のBlock wrapperへ、並び替えモード中の内容編集抑止だけを追加するHOC。
 *
 * 新しいDOM階層を追加せず、Block Toolbarや配置操作を既存のEditor構造のまま利用可能にする。
 * 対応Tableでは選択状態にかかわらず同じReorder Mode接続境界を維持し、選択切替で既存Block subtreeを再生成しない。
 *
 * @param BlockListBlock Gutenbergが提供する元のBlockListBlock component。
 * @return 対応Tableへ安定したReorder Mode接続境界を追加したcomponent。非対応Blockは元のcomponentを返す。
 */
export const withReorderModeBlockListBlock = (
	BlockListBlock: ComponentType< ReorderModeBlockListBlockProps >
) =>
	function WithReorderModeBlockListBlock( props: ReorderModeBlockListBlockProps ) {
		/* 非対応BlockはReorder Mode接続境界の外に保ち、対応Tableだけへ責務を限定する。 */
		if ( ! SUPPORTED_TABLE_BLOCKS.has( props.name ) ) {
			return <BlockListBlock { ...props } />;
		}

		return <ReorderModeBlockListBlock BlockListBlock={ BlockListBlock } blockProps={ props } />;
	};
