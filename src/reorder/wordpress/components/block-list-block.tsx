/* eslint-disable no-console */
/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Mode中の通常編集抑止とDnD PoCを接続するReact componentを所有する。
 *
 * 新しいDOM階層は追加せず、Gutenberg既存のwrapper propsへ必要な入力抑止と基準要素参照だけを合成する。
 */

import { useCallback, useEffect, useRef } from '@wordpress/element';
import type { ComponentType } from '@wordpress/element';

import { rowReorderMode } from '@/reorder/reorder-mode';
import { connectDndKitRowPoc } from '@/reorder/row-reorder/dnd-kit-poc';
import {
	preserveEditingStartHandler,
	type EditingStartWrapperProps,
} from '@/reorder/wordpress/editing-start';
import { useEditingAllowed } from '@/reorder/wordpress/hooks/use-editing-allowed';

/** BlockListBlock HOCが利用するprops。 */
export type ReorderModeBlockListBlockProps = {
	clientId: string;
	isSelected: boolean;
	name: string;
	wrapperProps?: EditingStartWrapperProps & {
		ref?: ( element: HTMLElement | null ) => void;
	};
	[ key: string ]: unknown;
};

/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Modeの編集可否とDnD PoCを反映する。
 *
 * このcomponentは現在選択中の対応Tableに対してだけ生成され、Reorder Modeの購読とPoC接続を所有する。
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
	const wrapperElementRef = useRef< HTMLElement | null >( null );
	const cleanupPocRef = useRef< ( () => void ) | null >( null );
	const reorderWrapperRef = useCallback(
		( element: HTMLElement | null ) => {
			wrapperElementRef.current = element;
			wrapperProps?.ref?.( element );
		},
		[ wrapperProps ]
	);

	useEffect( () => {
		cleanupPocRef.current?.();
		cleanupPocRef.current = null;

		const wrapperElement = wrapperElementRef.current;
		const rowReorderActive = rowReorderMode.isActive( clientId );

		console.info( '[YTR PoC debug] effect', {
			clientId,
			editingAllowed,
			rowReorderActive,
			wrapperElement,
		} );

		/* PoCは対象Tableで行並び替えモードが有効な間だけ現在DOMへ接続する。 */
		if ( ! rowReorderActive || ! wrapperElement ) {
			return;
		}

		cleanupPocRef.current = connectDndKitRowPoc( clientId, wrapperElement );

		return () => {
			cleanupPocRef.current?.();
			cleanupPocRef.current = null;
		};
	}, [ clientId, editingAllowed ] );

	const reorderWrapperProps = ! editingAllowed
		? {
				...wrapperProps,
				onDoubleClickCapture: preserveEditingStartHandler( wrapperProps?.onDoubleClickCapture ),
				onMouseDownCapture: preserveEditingStartHandler( wrapperProps?.onMouseDownCapture ),
				onPointerDownCapture: preserveEditingStartHandler( wrapperProps?.onPointerDownCapture ),
				ref: reorderWrapperRef,
		  }
		: {
				...wrapperProps,
				ref: reorderWrapperRef,
		  };

	return <BlockListBlock { ...blockProps } wrapperProps={ reorderWrapperProps } />;
};
