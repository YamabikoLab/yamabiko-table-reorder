/**
 * 対応Tableの既存Block wrapperへReorder Mode中の入力制御、行・列DnD接続、Presentation対象識別を反映するReact componentを所有する。
 *
 * Gutenberg本来のBlockListBlockへReorder Mode状態をReact propsとして伝播させず、既存wrapperへ安定した入力handlerを接続する。
 * Reorder Mode固有のDOM状態はYTR専用data属性として所有し、同じEditor DOM Context内の非表示anchorから現在wrapperを解決して同期する。
 * dnd-kitの物理Lifecycleと方向固有cleanupは各DnD / Highlight境界へ委譲する。
 */

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	type ComponentType,
} from '@wordpress/element';
import type { DragEvent } from 'react';

import {
	ColumnDnd,
	type ColumnDndPointerDownHandler,
} from '@/reorder/column-reorder/integration/dnd';
import {
	ColumnHighlight,
	type ColumnHighlightPointerOutHandler,
	type ColumnHighlightPointerOverHandler,
} from '@/reorder/column-reorder/responsibilities/presentation/column-highlight';
import { reorderMode } from '@/reorder/reorder-mode';
import { subscribeReorderMode, type TableReorderMode } from '@/reorder/reorder-mode-subscription';
import { RowDnd, type RowDndPointerDownHandler } from '@/reorder/row-reorder/integration/dnd';
import {
	RowHighlight,
	type RowHighlightPointerOverHandler,
} from '@/reorder/row-reorder/responsibilities/presentation/row-highlight';
import {
	preserveEditingStartHandler,
	type EditingStartWrapperProps,
} from '@/reorder/wordpress/editing-start';

import './editing-guard.scss';

const REORDER_MODE_ATTRIBUTE = 'data-yamabiko-table-reorder-mode';

/** BlockListBlock HOCが利用するprops。 */
export type ReorderModeBlockListBlockProps = {
	clientId: string;
	isSelected: boolean;
	name: string;
	wrapperProps?: EditingStartWrapperProps;
	[ key: string ]: unknown;
};

/**
 * Gutenberg既存のpointerdown処理を維持したまま、方向固有DnDの開始入力を追加する。
 *
 * @param existingHandler  Gutenberg本体または他のfilterが設定した既存handler。
 * @param rowDndHandler    Row DnDが提供する開始入力handler。
 * @param columnDndHandler Column DnDが提供する開始入力handler。
 * @return 既存処理の後に方向固有DnDへ開始入力を通知するhandler。
 */
const preservePointerDownHandler = (
	existingHandler: EditingStartWrapperProps[ 'onPointerDownCapture' ],
	rowDndHandler: RowDndPointerDownHandler,
	columnDndHandler: ColumnDndPointerDownHandler
): RowDndPointerDownHandler => {
	const handler: RowDndPointerDownHandler = ( event ) => {
		existingHandler?.( event );
		rowDndHandler( event );
		columnDndHandler( event );
	};
	return handler;
};

/**
 * Gutenberg既存のpointerover処理を維持したまま、方向固有の操作可否表示へ現在位置を通知する。
 *
 * @param existingHandler        Gutenberg本体または他のfilterが設定した既存handler。
 * @param rowHighlightHandler    行ホバー表示が提供する判定handler。
 * @param columnHighlightHandler 列の開始前予告表示が提供する判定handler。
 * @return 既存処理の後に方向固有の操作可否表示へ入力を通知するhandler。
 */
const preservePointerOverHandler = (
	existingHandler: unknown,
	rowHighlightHandler: RowHighlightPointerOverHandler,
	columnHighlightHandler: ColumnHighlightPointerOverHandler
): RowHighlightPointerOverHandler => {
	const handler: RowHighlightPointerOverHandler = ( event ) => {
		if ( typeof existingHandler === 'function' ) {
			( existingHandler as RowHighlightPointerOverHandler )( event );
		}
		rowHighlightHandler( event );
		columnHighlightHandler( event );
	};
	return handler;
};

/**
 * Gutenberg既存のpointerout処理を維持したまま、Column Highlightへ現在セルを離れた入力を通知する。
 *
 * @param existingHandler        Gutenberg本体または他のfilterが設定した既存handler。
 * @param columnHighlightHandler 列の開始前予告表示が提供する終了判定handler。
 * @return 既存処理の後にColumn Highlightへ終了入力を通知するhandler。
 */
const preservePointerOutHandler = (
	existingHandler: unknown,
	columnHighlightHandler: ColumnHighlightPointerOutHandler
): ColumnHighlightPointerOutHandler => {
	const handler: ColumnHighlightPointerOutHandler = ( event ) => {
		if ( typeof existingHandler === 'function' ) {
			( existingHandler as ColumnHighlightPointerOutHandler )( event );
		}
		columnHighlightHandler( event );
	};
	return handler;
};

/**
 * Gutenberg既存のBlock drag開始処理を維持したまま、Reorder Mode中だけTable Block自体のnative drag開始を拒否する。
 *
 * GutenbergのBlock dragはwrapper自身のnative dragstart listenerでも開始されるため、Reorder Mode中は既定動作だけでなく伝播も停止する。
 *
 * @param existingHandler Gutenberg本体または他のfilterが設定した既存handler。
 * @param tableIdentity   Reorder Mode状態を確認するTable Identity。
 * @return 現在モードを入力時に参照してBlock drag開始可否を決めるhandler。
 */
const preserveBlockDragStartHandler = (
	existingHandler: unknown,
	tableIdentity: string
): ( ( event: DragEvent< Element > ) => void ) => {
	const handler = ( event: DragEvent< Element > ) => {
		if ( typeof existingHandler === 'function' ) {
			( existingHandler as ( dragEvent: DragEvent< Element > ) => void )( event );
		}

		if ( reorderMode.getMode( tableIdentity ) !== 'edit' ) {
			event.preventDefault();
			event.stopPropagation();
		}
	};

	return handler;
};

/**
 * YTRが所有するReorder Mode DOM状態だけを現在modeへ同期する。
 *
 * @param element 現在のTable Block wrapper。
 * @param mode    対象Tableから見た現在のReorder Mode。
 */
const synchronizeWrapperMode = ( element: HTMLElement | null, mode: TableReorderMode ): void => {
	if ( element === null ) {
		return;
	}

	if ( mode === 'edit' ) {
		element.removeAttribute( REORDER_MODE_ATTRIBUTE );
		return;
	}

	element.setAttribute( REORDER_MODE_ATTRIBUTE, mode );
};

/**
 * 対応Tableの既存Block wrapperへ安定した入力境界とReorder Mode固有DOM同期を接続する。
 *
 * Reorder Mode変更は非React購読でYTR専用data属性と方向固有Lifecycleへ通知し、Gutenberg本来のBlockListBlock propsを変更しない。
 * mode同期用anchorはBlockListBlockと同じReact描画先へ置くため、iframe / non-iframeを推測せずownerDocumentから現在wrapperを解決する。
 * Gutenberg側の通常rerender時にも現在wrapperを再解決して現在modeを同期する。
 *
 * @param props                Gutenbergから渡されるBlockListBlock propsと元のcomponent。
 * @param props.BlockListBlock Gutenberg本来のBlock wrapperを描画するcomponent。
 * @param props.blockProps     現在Blockの識別・選択状態・属性・既存wrapper propsを含む値。
 * @return Gutenberg本来のBlock wrapper構造を維持したBlockListBlock。
 */
export const ReorderModeBlockListBlock = ( props: {
	BlockListBlock: ComponentType< ReorderModeBlockListBlockProps >;
	blockProps: ReorderModeBlockListBlockProps;
} ) => {
	const { BlockListBlock, blockProps } = props;
	const { clientId, isSelected, wrapperProps } = blockProps;
	const modeDomAnchor = useRef< HTMLTemplateElement | null >( null );
	const synchronizedWrapper = useRef< HTMLElement | null >( null );

	const resolveCurrentWrapper = useCallback( (): HTMLElement | null => {
		const editorDocument = modeDomAnchor.current?.ownerDocument;
		const wrapper = editorDocument?.getElementById( `block-${ clientId }` ) ?? null;
		return wrapper;
	}, [ clientId ] );

	const synchronizeCurrentWrapper = useCallback(
		( mode: TableReorderMode ) => {
			const nextWrapper = resolveCurrentWrapper();
			const previousWrapper = synchronizedWrapper.current;

			if ( previousWrapper !== null && previousWrapper !== nextWrapper ) {
				previousWrapper.removeAttribute( REORDER_MODE_ATTRIBUTE );
			}

			synchronizedWrapper.current = nextWrapper;
			synchronizeWrapperMode( nextWrapper, mode );
		},
		[ resolveCurrentWrapper ]
	);

	/* Gutenberg側の通常renderでwrapperが再接続された場合も、現在modeを新しいDOMへ同期する。 */
	useLayoutEffect( () => {
		synchronizeCurrentWrapper( reorderMode.getMode( clientId ) );
	} );

	useEffect( () => {
		const unsubscribe = subscribeReorderMode( clientId, synchronizeCurrentWrapper );

		return () => {
			unsubscribe();
			synchronizedWrapper.current?.removeAttribute( REORDER_MODE_ATTRIBUTE );
			synchronizedWrapper.current = null;
		};
	}, [ clientId, synchronizeCurrentWrapper ] );

	const shouldPreventEditingStart = useCallback(
		() => reorderMode.getMode( clientId ) !== 'edit',
		[ clientId ]
	);

	return (
		<RowHighlight tableIdentity={ clientId }>
			{ ( rowHighlightPointerOverCapture ) => (
				<ColumnHighlight tableIdentity={ clientId }>
					{ ( columnHighlightPointerOverCapture, columnHighlightPointerOutCapture ) => (
						<RowDnd presentationEnabled={ isSelected } tableIdentity={ clientId }>
							{ ( rowDndPointerDownCapture ) => (
								<ColumnDnd presentationEnabled={ isSelected } tableIdentity={ clientId }>
									{ ( columnDndPointerDownCapture ) => (
										<>
											<template ref={ modeDomAnchor } />
											<BlockListBlock
												{ ...blockProps }
												wrapperProps={ {
													...wrapperProps,
													onDoubleClickCapture: preserveEditingStartHandler(
														wrapperProps?.onDoubleClickCapture,
														shouldPreventEditingStart
													),
													onMouseDownCapture: preserveEditingStartHandler(
														wrapperProps?.onMouseDownCapture,
														shouldPreventEditingStart
													),
													onDragStartCapture: preserveBlockDragStartHandler(
														wrapperProps?.onDragStartCapture,
														clientId
													),
													onPointerOverCapture: preservePointerOverHandler(
														wrapperProps?.onPointerOverCapture,
														rowHighlightPointerOverCapture,
														columnHighlightPointerOverCapture
													),
													onPointerOutCapture: preservePointerOutHandler(
														wrapperProps?.onPointerOutCapture,
														columnHighlightPointerOutCapture
													),
													onPointerDownCapture: preservePointerDownHandler(
														wrapperProps?.onPointerDownCapture,
														rowDndPointerDownCapture,
														columnDndPointerDownCapture
													),
												} }
											/>
										</>
									) }
								</ColumnDnd>
							) }
						</RowDnd>
					) }
				</ColumnHighlight>
			) }
		</RowHighlight>
	);
};
