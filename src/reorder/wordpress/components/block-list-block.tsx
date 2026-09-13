/**
 * 対応Tableの既存Block wrapperへReorder Mode中の入力制御、行・列DnD接続、Presentation対象識別を反映するReact componentを所有する。
 *
 * Gutenberg本来のBlockListBlockへReorder Mode状態をReact propsとして伝播させず、既存wrapperへ安定した入力handlerを接続する。
 * Reorder Mode固有のDOM状態はYTR専用data属性として所有し、非React購読で現在状態へ同期する。
 * dnd-kitの物理Lifecycleと方向固有cleanupは各DnD / Highlight境界へ委譲する。
 */

import { useCallback, useEffect, useRef, type ComponentType } from '@wordpress/element';
import type { DragEvent, Ref } from 'react';

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
import {
	subscribeReorderMode,
	type TableReorderMode,
} from '@/reorder/reorder-mode-subscription';
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
		}
	};

	return handler;
};

/**
 * Gutenbergまたは他のfilterが所有するrefへ、YTRが受け取ったwrapper要素を同じ値で通知する。
 *
 * @param existingRef Gutenberg側がwrapper propsへ設定したref。
 * @param element     現在接続されているwrapper要素。切断時はnull。
 */
const preserveWrapperRef = ( existingRef: unknown, element: HTMLElement | null ): void => {
	if ( typeof existingRef === 'function' ) {
		( existingRef as ( value: HTMLElement | null ) => void )( element );
		return;
	}

	if ( typeof existingRef === 'object' && existingRef !== null && 'current' in existingRef ) {
		( existingRef as { current: HTMLElement | null } ).current = element;
	}
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
 * wrapperがGutenberg都合で再接続された場合は、その時点の現在modeを新しい要素へ即時同期する。
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
	const wrapperElement = useRef< HTMLElement | null >( null );
	const existingWrapperRef = wrapperProps?.ref as Ref< HTMLElement > | undefined;

	const setWrapperRef = useCallback(
		( element: HTMLElement | null ) => {
			const previousElement = wrapperElement.current;

			if ( previousElement !== null && previousElement !== element ) {
				previousElement.removeAttribute( REORDER_MODE_ATTRIBUTE );
			}

			wrapperElement.current = element;
			preserveWrapperRef( existingWrapperRef, element );
			synchronizeWrapperMode( element, reorderMode.getMode( clientId ) );
		},
		[ clientId, existingWrapperRef ]
	);

	useEffect( () => {
		synchronizeWrapperMode( wrapperElement.current, reorderMode.getMode( clientId ) );
		const unsubscribe = subscribeReorderMode( clientId, ( mode ) => {
			synchronizeWrapperMode( wrapperElement.current, mode );
		} );

		return () => {
			unsubscribe();
			wrapperElement.current?.removeAttribute( REORDER_MODE_ATTRIBUTE );
		};
	}, [ clientId ] );

	const shouldPreventEditingStart = useCallback(
		() => reorderMode.getMode( clientId ) !== 'edit',
		[ clientId ]
	);
	const isRowReorderActive = useCallback(
		() => reorderMode.getMode( clientId ) === 'row',
		[ clientId ]
	);
	const isColumnReorderActive = useCallback(
		() => reorderMode.getMode( clientId ) === 'column',
		[ clientId ]
	);

	return (
		<RowHighlight enabled isActive={ isRowReorderActive } tableIdentity={ clientId }>
			{ ( rowHighlightPointerOverCapture ) => (
				<ColumnHighlight
					enabled
					isActive={ isColumnReorderActive }
					tableIdentity={ clientId }
				>
					{ ( columnHighlightPointerOverCapture, columnHighlightPointerOutCapture ) => (
						<RowDnd
							enabled
							isActive={ isRowReorderActive }
							presentationEnabled={ isSelected }
							tableIdentity={ clientId }
						>
							{ ( rowDndPointerDownCapture ) => (
								<ColumnDnd
									enabled
									isActive={ isColumnReorderActive }
									presentationEnabled={ isSelected }
									tableIdentity={ clientId }
								>
									{ ( columnDndPointerDownCapture ) => (
										<BlockListBlock
											{ ...blockProps }
											wrapperProps={ {
												...wrapperProps,
												ref: setWrapperRef,
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
