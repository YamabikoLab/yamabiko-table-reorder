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
import { resolveColumnDndLayoutAvailability } from '@/reorder/column-reorder/responsibilities/layout-availability';
import {
	ColumnHighlight,
	type ColumnHighlightPointerOutHandler,
	type ColumnHighlightPointerOverHandler,
} from '@/reorder/column-reorder/responsibilities/presentation/column-highlight';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
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
import {
	clearColumnDndLayoutAvailabilitySnapshot,
	updateColumnDndLayoutAvailabilitySnapshot,
} from '@/reorder/wordpress/column-dnd-layout-availability-state';

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
 * mode同期用anchorはBlockListBlockと同じReact描画先へ置き、Editor DOM Contextから現在wrapperを解決する。
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
		const anchor = modeDomAnchor.current;
		const editorDomContext = anchor === null ? null : resolveEditorDomContext( anchor );
		const wrapper = editorDomContext?.document.getElementById( `block-${ clientId }` ) ?? null;
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

	/** 現在wrapperに描画された対象Tableを、anchorと同じEditor DOM Contextから解決する。 */
	const resolveCurrentTable = useCallback( (): HTMLTableElement | null => {
		const currentWrapper = resolveCurrentWrapper();
		return currentWrapper?.querySelector< HTMLTableElement >( 'table' ) ?? null;
	}, [ resolveCurrentWrapper ] );

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

	/* 選択中Tableの現在物理配置をToolbar用snapshotへ接続し、表示変化後も利用不能なColumn Reorder Modeを維持しない。 */
	useEffect( () => {
		if ( ! isSelected ) {
			clearColumnDndLayoutAvailabilitySnapshot( clientId );
			return;
		}

		const anchor = modeDomAnchor.current;
		const wrapperParent = anchor?.parentNode ?? null;
		const editorDomContext = anchor === null ? null : resolveEditorDomContext( anchor );

		if ( wrapperParent === null || editorDomContext === null ) {
			clearColumnDndLayoutAvailabilitySnapshot( clientId );
			return;
		}

		const editorWindow = editorDomContext.window;
		let active = true;
		let evaluationScheduled = false;

		const evaluateAvailability = (): HTMLTableElement | null => {
			const table = resolveCurrentTable();
			const availability = resolveColumnDndLayoutAvailability( table );
			updateColumnDndLayoutAvailabilitySnapshot( clientId, availability );

			/* Column DnDの物理配置が失われた時点で、他の並び替え手段へ影響させず通常編集モードへ戻す。 */
			if ( availability === 'unavailable' && reorderMode.getMode( clientId ) === 'column' ) {
				reorderMode.select( 'column', clientId );
			}

			return table;
		};

		/** 同じ描画更新から届く複数の変化通知を1回のToolbar用再評価へまとめる。 */
		const scheduleAvailabilityEvaluation = (): void => {
			if ( evaluationScheduled ) {
				return;
			}

			evaluationScheduled = true;
			Promise.resolve().then( () => {
				evaluationScheduled = false;
				if ( active ) {
					evaluateAvailability();
				}
			} );
		};

		const ResizeObserverConstructor = editorWindow.ResizeObserver;
		const resizeObserver = ResizeObserverConstructor
			? new ResizeObserverConstructor( scheduleAvailabilityEvaluation )
			: null;
		let mutationObserver: MutationObserver | null = null;

		/**
		 * Toolbar表示用snapshotはTable全体の変化だけを粗い再評価契機として監視する。
		 * セル単位の常駐監視は行わず、DnD開始可否の保証は開始直前のfresh判定へ委ねる。
		 */
		const observeCurrentGeometry = (): void => {
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			mutationObserver?.observe( wrapperParent, { childList: true } );

			const wrapper = resolveCurrentWrapper();
			const table = evaluateAvailability();
			if ( wrapper !== null ) {
				mutationObserver?.observe( wrapper, { attributes: true } );
			}

			if ( table === null ) {
				return;
			}

			mutationObserver?.observe( table, { attributes: true } );
			resizeObserver?.observe( table );
		};

		mutationObserver = new editorWindow.MutationObserver( ( records ) => {
			const wrapperReconnected = records.some(
				( record ) => record.target === wrapperParent && record.type === 'childList'
			);

			if ( wrapperReconnected ) {
				observeCurrentGeometry();
				return;
			}

			scheduleAvailabilityEvaluation();
		} );
		editorWindow.addEventListener( 'resize', scheduleAvailabilityEvaluation );
		observeCurrentGeometry();

		return () => {
			active = false;
			mutationObserver?.disconnect();
			resizeObserver?.disconnect();
			editorWindow.removeEventListener( 'resize', scheduleAvailabilityEvaluation );
			clearColumnDndLayoutAvailabilitySnapshot( clientId );
		};
	}, [ clientId, isSelected, resolveCurrentTable, resolveCurrentWrapper ] );

	/* Gutenberg自身の更新だけでBlock wrapper DOMが再接続される場合に備え、Table内部ではなく同じ描画先の直下変更だけから現在modeを再同期する。 */
	useEffect( () => {
		const anchor = modeDomAnchor.current;
		const wrapperParent = anchor?.parentNode ?? null;
		const editorDomContext = anchor === null ? null : resolveEditorDomContext( anchor );

		if ( wrapperParent === null || editorDomContext === null ) {
			return;
		}

		const observer = new editorDomContext.window.MutationObserver( () => {
			synchronizeCurrentWrapper( reorderMode.getMode( clientId ) );
		} );

		observer.observe( wrapperParent, { childList: true } );

		return () => observer.disconnect();
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