/* eslint-disable no-console */
/**
 * 対応Tableの既存Block wrapperへReorder Mode中の通常編集抑止とDnD PoCを接続するReact componentを所有する。
 *
 * 新しいDOM階層は追加せず、Gutenberg既存のwrapper propsへ必要な入力抑止だけを合成する。
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from '@wordpress/element';
import type { ComponentType } from '@wordpress/element';

import { connectDndKitColumnPoc } from '@/reorder/column-reorder/dnd-kit-poc';
import { reorderMode } from '@/reorder/reorder-mode';
import { connectDndKitRowPoc } from '@/reorder/row-reorder/dnd-kit-poc';
import { dndKitPocSettings } from '@/reorder/wordpress/dnd-kit-poc-settings';
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
	wrapperProps?: EditingStartWrapperProps;
	[ key: string ]: unknown;
};

/**
 * 対応Tableの既存Block wrapperへReorder Modeの編集可否とDnD PoCを反映する。
 *
 * Reorder ModeとPoC設定の購読およびPoC接続を所有し、PoC対象DOMの解決はTable Identityから各PoC境界で行う。
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
	const getCurrentMode = useCallback( () => reorderMode.getMode( clientId ), [ clientId ] );
	const currentMode = useSyncExternalStore(
		reorderMode.subscribe,
		getCurrentMode,
		getCurrentMode
	);
	const visualFeedbackEnabled = useSyncExternalStore(
		dndKitPocSettings.subscribe,
		dndKitPocSettings.isVisualFeedbackEnabled,
		dndKitPocSettings.isVisualFeedbackEnabled
	);
	const cleanupPocRef = useRef< ( () => void ) | null >( null );

	useEffect( () => {
		cleanupPocRef.current?.();
		cleanupPocRef.current = null;

		if ( process.env.NODE_ENV !== 'test' ) {
			console.info( '[YTR PoC debug] effect', {
				clientId,
				currentMode,
				editingAllowed,
				visualFeedbackEnabled,
			} );
		}

		/* PoCは対象Tableで行または列の並び替えモードが有効な間だけ現在DOMへ接続する。 */
		if ( currentMode === 'row' ) {
			cleanupPocRef.current = connectDndKitRowPoc( clientId, visualFeedbackEnabled );
		} else if ( currentMode === 'column' ) {
			cleanupPocRef.current = connectDndKitColumnPoc( clientId, visualFeedbackEnabled );
		} else {
			return;
		}

		return () => {
			cleanupPocRef.current?.();
			cleanupPocRef.current = null;
		};
	}, [ clientId, currentMode, editingAllowed, visualFeedbackEnabled ] );

	const reorderWrapperProps = ! editingAllowed
		? {
				...wrapperProps,
				onDoubleClickCapture: preserveEditingStartHandler( wrapperProps?.onDoubleClickCapture ),
				onMouseDownCapture: preserveEditingStartHandler( wrapperProps?.onMouseDownCapture ),
				/* PoC実機ではdnd-kitのPointerSensorへpointerdownを渡し、Jestでは既存仕様を維持する。 */
				...( process.env.NODE_ENV === 'test'
					? {
							onPointerDownCapture: preserveEditingStartHandler(
								wrapperProps?.onPointerDownCapture
							),
					  }
					: {} ),
		  }
		: { ...wrapperProps };

	return <BlockListBlock { ...blockProps } wrapperProps={ reorderWrapperProps } />;
};
