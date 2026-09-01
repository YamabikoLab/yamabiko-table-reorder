/**
 * 対応Tableの既存Block wrapperへReorder Mode中の通常編集抑止を接続するReact componentを所有する。
 *
 * 新しいDOM階層は追加せず、Gutenberg既存のwrapper propsへ必要な入力抑止だけを合成する。
 */

import type { ComponentType } from '@wordpress/element';

import {
	preserveEditingStartHandler,
	type EditingStartWrapperProps,
} from '@/reorder/wordpress/editing-start';
import { useEditingAllowed } from '@/reorder/wordpress/hooks/use-editing-allowed';

/** BlockListBlock HOCが利用するprops。 */
export type ReorderModeBlockListBlockProps = {
	clientId: string;
	name: string;
	wrapperProps?: EditingStartWrapperProps;
	[ key: string ]: unknown;
};

/**
 * 対応Tableの既存Block wrapperへReorder Modeの編集可否を反映する。
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
				onPointerDownCapture: preserveEditingStartHandler( wrapperProps?.onPointerDownCapture ),
		  }
		: wrapperProps;

	return <BlockListBlock { ...blockProps } wrapperProps={ reorderWrapperProps } />;
};
