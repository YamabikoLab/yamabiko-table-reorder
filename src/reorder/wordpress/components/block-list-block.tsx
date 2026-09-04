/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Mode中の通常編集抑止を接続するReact componentを所有する。
 *
 * 新しいDOM階層は追加せず、Gutenberg既存のwrapper propsへ必要な入力抑止だけを合成する。
 * DnD開始に必要なpointer入力は変更せず、通常編集の開始だけを成立させない。
 */

import type { ComponentType } from '@wordpress/element';

import { useEditingAllowed } from '@/reorder/reorder-mode-react';
import {
	preserveEditingStartHandler,
	type EditingStartWrapperProps,
} from '@/reorder/wordpress/editing-start';

/** BlockListBlock HOCが利用するprops。 */
export type ReorderModeBlockListBlockProps = {
	clientId: string;
	isSelected: boolean;
	name: string;
	wrapperProps?: EditingStartWrapperProps;
	[ key: string ]: unknown;
};

/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Modeの編集可否を反映する。
 *
 * このcomponentは現在選択中の対応Tableに対してだけ生成され、Reorder Modeの購読を所有する。
 * Reorder Mode中もpointerdownは既存propsのままDnD開始へ渡し、通常編集開始につながる入力だけを抑止する。
 *
 * @param props                Gutenbergから渡されるBlockListBlock propsと元のcomponent。
 * @param props.BlockListBlock
 * @param props.blockProps
 * @return Gutenberg本来のBlock wrapper構造を維持したBlockListBlock。
 */
export const ReorderModeBlockListBlock = ( props: {
	BlockListBlock: ComponentType< ReorderModeBlockListBlockProps >;
	blockProps: ReorderModeBlockListBlockProps;
} ) => {
	const { BlockListBlock, blockProps } = props;
	const { clientId, wrapperProps } = blockProps;
	const editingAllowed = useEditingAllowed( clientId );
	const reorderWrapperProps = ! editingAllowed
		? {
				...wrapperProps,
				onDoubleClickCapture: preserveEditingStartHandler( wrapperProps?.onDoubleClickCapture ),
				onMouseDownCapture: preserveEditingStartHandler( wrapperProps?.onMouseDownCapture ),
		  }
		: wrapperProps;

	return <BlockListBlock { ...blockProps } wrapperProps={ reorderWrapperProps } />;
};
