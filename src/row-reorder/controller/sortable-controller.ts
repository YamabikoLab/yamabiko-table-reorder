/**
 * Table ReorderのSortableJS instanceとdrag session lifecycleを管理する。
 *
 * SortableJS callbacks、drag session state、keyboard / single-pointer session、行control制御、
 * DOM所有権handoff、cleanupを集約し、React / Gutenberg統合層とは狭いcallback境界で接続する。
 * UI描画やReact state自体は扱わず、drag中にSortableJSが変更する行DOMはcommit前またはdestroy時に元へ戻す。
 */

import {
	getDestinationChangedAnnouncement,
	getDestinationRequestedAnnouncement,
	getKeyboardActiveMessage,
	getMoveBoundaryAnnouncement,
	getMoveCanceledAnnouncement,
	getMoveCommittedAnnouncement,
	getMoveStartedAnnouncement,
	getNoMovableRowsAnnouncement,
	getRowspanBlockedAnnouncement,
	getTouchModeMessage,
} from '@/row-reorder/messages';
import type { TableContext } from '@/row-reorder/table-context';
import { createInsertionLine, fixFallbackRowCellWidths } from './drag-ui';
import {
	announceLiveStatus,
	createReorderGuidance,
	createRowControls,
	createRowMoveTargets,
	getRowRepresentativeText,
	HANDLE_ZONE_CLASS,
	scrollKeyboardDestinationIntoView,
	type ReorderGuidanceUi,
	type RowMoveTargetsUi,
	stopRowControlInteractionPropagation,
} from './reorder-ui';
import {
	getMoveInsertionIndex,
	getNextValidRowMoveIndex,
	getRowMoveInsertionIndex,
	getValidRowMoveTargets,
	isNoopRowMove,
	isRowMoveAllowed,
	reorderRows,
	restoreOriginalRowOrder,
	type RowMoveDirection,
} from './row-order';
import { resolveAutoScrollTarget } from './scroll-target';
import { ensureSortableRuntime, type SortableInstance } from '@/common/sortable-runtime-loader';

/** SortableJSのauto-scrollを開始する端からの距離。 */
const AUTO_SCROLL_SENSITIVITY_PX = 80;

/** SortableJSのauto-scroll速度。 */
const AUTO_SCROLL_SPEED_PX = 8;

/** drag完了直後に同じhandleへ発生するclickを単一ポインター開始として扱わない時間。 */
const DRAG_CLICK_SUPPRESSION_MS = 250;

/** Table Reorderが利用する操作方式。 */
export type ReorderInteractionMode = 'hover' | 'touch';

/** Toolbar focus要求の結果。 */
export type FocusRowControlResult = 'focused' | 'current-row-not-movable' | 'no-movable-rows';

/** React / Gutenberg統合層からcontrollerへ渡す設定。 */
type SortableControllerOptions = {
	context: TableContext;
	forbiddenInsertionIndices: readonly number[];
	interactionMode: ReorderInteractionMode;
	nonMovableRowIndices: readonly number[];
	onCommit: ( reorderedRows: unknown[], focusRowIndex?: number ) => void;
	rows: readonly unknown[] | null;
	runtimeUrl: string;
};

/** React側へ公開するcontroller lifecycleの最小interface。 */
export type SortableController = {
	destroy: () => void;
	focusRowControl: () => FocusRowControlResult;
	focusRowControlAt: ( rowIndex: number ) => boolean;
};

type SortableEventLike = {
	newIndex?: number;
	oldIndex?: number;
};

type SortableChooseEventLike = {
	item: HTMLElement;
};

type SortableMoveEventLike = {
	related: HTMLElement;
	willInsertAfter: boolean;
};

type SortableOptions = {
	animation: number;
	bubbleScroll: boolean;
	draggable: string;
	forceFallback: boolean;
	handle: string;
	onChoose: ( event: SortableChooseEventLike ) => void;
	onEnd: ( event: SortableEventLike ) => void;
	onMove: ( event: SortableMoveEventLike, originalEvent: Event ) => boolean | void;
	onStart: () => void;
	onUnchoose: () => void;
	scroll: boolean | HTMLElement;
	scrollSensitivity: number;
	scrollSpeed: number;
};

type ReorderSession =
	| { kind: 'idle' }
	| {
			kind: 'keyboard';
			control: HTMLButtonElement;
			currentIndex: number;
			lastBoundaryDirection: RowMoveDirection | null;
			oldIndex: number;
			rowLabel: string;
			guidance: ReorderGuidanceUi;
	  }
	| {
			kind: 'pointer';
			control: HTMLButtonElement;
			oldIndex: number;
			rowLabel: string;
			targetsUi: RowMoveTargetsUi;
	  }
	| { kind: 'dragging' };

type DragSnapshot = {
	rows: HTMLTableRowElement[];
	rowLabel: string;
};

type MousePoint = {
	x: number;
	y: number;
};

export const createSortableController = (
	options: SortableControllerOptions
): SortableController => {
	const {
		context: { blockElement, document, tbody, window: view },
		forbiddenInsertionIndices,
		interactionMode,
		nonMovableRowIndices,
		onCommit,
		rows,
		runtimeUrl,
	} = options;
	const useHoverMode = interactionMode === 'hover';
	const insertionLine = createInsertionLine( document );
	const rowControls = createRowControls( options.context, nonMovableRowIndices, {
		showAll: ! useHoverMode,
	} );
	const nonMovableRows = new Set( nonMovableRowIndices );
	const blockSelectionEvents = [ 'pointerdown', 'mousedown', 'click' ] as const;
	const getRowFromElement = ( element: Element | null ): HTMLTableRowElement | null => {
		const row = element?.closest< HTMLTableRowElement >( 'tr' ) ?? null;
		return row?.parentElement === tbody ? row : null;
	};
	const getRowIndexFromElement = ( element: Element | null ): number | null => {
		const row = getRowFromElement( element );
		return row ? row.sectionRowIndex : null;
	};
	const getControlFromElement = ( element: Element | null ): HTMLButtonElement | null => {
		const control = element?.closest< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` ) ?? null;
		return control && getRowFromElement( control ) ? control : null;
	};
	const getRowFromControl = ( control: HTMLButtonElement ) => getRowFromElement( control );
	const constraints = {
		forbiddenInsertionIndices,
		nonMovableRowIndices,
		rowCount: rows?.length ?? tbody.rows.length,
	};

	let destroyed = false;
	let sortable: SortableInstance | null = null;
	let dragSnapshot: DragSnapshot | null = null;
	let activeControl: HTMLButtonElement | null = null;
	let dragControl: HTMLButtonElement | null = null;
	let session: ReorderSession = { kind: 'idle' };
	let touchModeGuidance: ReorderGuidanceUi | null = useHoverMode
		? null
		: createReorderGuidance( document, tbody, getTouchModeMessage() );
	let lastActiveRowIndex: number | null = getRowIndexFromElement(
		tbody.ownerDocument.activeElement
	);
	let lastMousePoint: MousePoint | null = null;
	let pendingHoverFrame: number | null = null;
	let blockDragSuppressed = false;
	let originalDraggable: string | null = null;
	let suppressPointerClickUntil = 0;
	let restoreFallbackCellWidths: () => void = () => undefined;

	const announce = ( message: string ) => announceLiveStatus( document, message );
	const commitRowMove = ( {
		oldIndex,
		newIndex,
		rowLabel,
		focusRowIndex,
	}: {
		oldIndex: number;
		newIndex: number;
		rowLabel: string;
		focusRowIndex?: number;
	} ): boolean => {
		if (
			! rows ||
			isNoopRowMove( oldIndex, newIndex ) ||
			! isRowMoveAllowed( oldIndex, newIndex, constraints )
		) {
			return false;
		}
		const reorderedRows = reorderRows( rows, oldIndex, newIndex );
		if ( ! reorderedRows ) {
			return false;
		}
		announce( getMoveCommittedAnnouncement( rowLabel, oldIndex + 1, newIndex + 1 ) );
		if ( focusRowIndex === undefined ) {
			onCommit( reorderedRows );
		} else {
			onCommit( reorderedRows, focusRowIndex );
		}
		return true;
	};
	const restoreFallbackWidths = () => {
		restoreFallbackCellWidths();
		restoreFallbackCellWidths = () => undefined;
	};
	const restoreDragRows = () => {
		if ( dragSnapshot ) {
			restoreOriginalRowOrder( tbody, dragSnapshot.rows );
		}
	};
	const cleanupDragSnapshot = () => {
		restoreDragRows();
		dragSnapshot = null;
	};
	const suppressBlockDrag = () => {
		if ( blockDragSuppressed ) {
			return;
		}
		originalDraggable = blockElement.getAttribute( 'draggable' );
		blockElement.draggable = false;
		blockDragSuppressed = true;
	};
	const restoreBlockDrag = () => {
		if ( ! blockDragSuppressed ) {
			return;
		}
		if ( originalDraggable === null ) {
			blockElement.removeAttribute( 'draggable' );
		} else {
			blockElement.setAttribute( 'draggable', originalDraggable );
		}
		originalDraggable = null;
		blockDragSuppressed = false;
	};
	const sessionControl = () =>
		session.kind === 'keyboard' || session.kind === 'pointer' ? session.control : null;
	const maybeUnpinControl = ( control: HTMLButtonElement ) => {
		if (
			control === activeControl ||
			control === dragControl ||
			control === sessionControl() ||
			control.matches( ':focus' )
		) {
			return;
		}
		rowControls.unpin( control );
	};
	const activateControl = ( control: HTMLButtonElement ) => {
		if ( activeControl && activeControl !== control ) {
			const previous = activeControl;
			if ( ! previous.matches( ':focus' ) ) {
				rowControls.setVisible( previous, false );
			}
			activeControl = null;
			maybeUnpinControl( previous );
		}
		activeControl = control;
		rowControls.pin( control );
		suppressBlockDrag();
		rowControls.setVisible( control, true );
	};
	const deactivateControl = ( control: HTMLButtonElement ) => {
		if (
			control === sessionControl() ||
			( session.kind === 'dragging' && control === dragControl )
		) {
			return;
		}
		if ( ! control.matches( ':focus' ) ) {
			rowControls.setVisible( control, false );
		}
		if ( activeControl === control ) {
			activeControl = null;
			restoreBlockDrag();
		}
		maybeUnpinControl( control );
	};
	const releaseActiveControl = () => {
		const control = activeControl;
		if ( control && ! control.matches( ':focus' ) ) {
			rowControls.setVisible( control, false );
		}
		activeControl = null;
		restoreBlockDrag();
		if ( control ) {
			maybeUnpinControl( control );
		}
	};
	const rememberRowFromEvent = ( event: Event ) => {
		const rowIndex = getRowIndexFromElement( event.target as Element | null );
		if ( rowIndex !== null ) {
			lastActiveRowIndex = rowIndex;
		}
	};
	const rememberMousePoint = ( event: PointerEvent ) => {
		if ( event.pointerType === 'mouse' ) {
			lastMousePoint = { x: event.clientX, y: event.clientY };
		}
	};
	const syncHoverFromMousePoint = () => {
		if ( ! useHoverMode || ! lastMousePoint || session.kind !== 'idle' ) {
			return;
		}
		const pointedElement = document.elementFromPoint( lastMousePoint.x, lastMousePoint.y );
		const hoveredRow = getRowFromElement( pointedElement );
		const hoveredControl = hoveredRow ? rowControls.ensureControl( hoveredRow ) : null;
		if ( hoveredControl ) {
			activateControl( hoveredControl );
		} else {
			releaseActiveControl();
		}
	};
	const scheduleHoverSync = () => {
		if ( ! useHoverMode || ! lastMousePoint || pendingHoverFrame !== null ) {
			return;
		}
		pendingHoverFrame = view.requestAnimationFrame( () => {
			pendingHoverFrame = null;
			if ( ! destroyed ) {
				syncHoverFromMousePoint();
			}
		} );
	};
	const showKeyboardCandidate = (
		keyboardSession: Extract< ReorderSession, { kind: 'keyboard' } >
	) => {
		if ( keyboardSession.currentIndex === keyboardSession.oldIndex ) {
			insertionLine.hide();
			return;
		}
		const insertionIndex = getRowMoveInsertionIndex(
			keyboardSession.oldIndex,
			keyboardSession.currentIndex
		);
		if ( insertionIndex <= 0 ) {
			const firstRow = tbody.rows.item( 0 );
			if ( firstRow ) {
				insertionLine.show( firstRow, false );
			}
			return;
		}
		if ( insertionIndex >= tbody.rows.length ) {
			const lastRow = tbody.rows.item( tbody.rows.length - 1 );
			if ( lastRow ) {
				insertionLine.show( lastRow, true );
			}
			return;
		}
		const nextRow = tbody.rows.item( insertionIndex );
		if ( nextRow ) {
			insertionLine.show( nextRow, false );
		}
	};
	const finishKeyboardSession = ( commit: boolean ) => {
		if ( session.kind !== 'keyboard' ) {
			return;
		}
		const keyboardSession = session;
		keyboardSession.guidance.cleanup();
		insertionLine.hide();
		rowControls.setPressed( keyboardSession.control, false );
		session = { kind: 'idle' };
		releaseActiveControl();
		if (
			commit &&
			commitRowMove( {
				oldIndex: keyboardSession.oldIndex,
				newIndex: keyboardSession.currentIndex,
				rowLabel: keyboardSession.rowLabel,
				focusRowIndex: keyboardSession.currentIndex,
			} )
		) {
			return;
		}
		if ( ! commit ) {
			announce(
				getMoveCanceledAnnouncement( keyboardSession.rowLabel, keyboardSession.oldIndex + 1 )
			);
		}
		touchModeGuidance?.setHidden( false );
		keyboardSession.control.focus();
		maybeUnpinControl( keyboardSession.control );
	};
	const finishSinglePointerSession = ( newIndex?: number, announceCancellation = true ) => {
		if ( session.kind !== 'pointer' ) {
			return;
		}
		const pointerSession = session;
		pointerSession.targetsUi.cleanup();
		rowControls.setPressed( pointerSession.control, false );
		session = { kind: 'idle' };
		releaseActiveControl();
		if (
			newIndex !== undefined &&
			commitRowMove( {
				oldIndex: pointerSession.oldIndex,
				newIndex,
				rowLabel: pointerSession.rowLabel,
				focusRowIndex: newIndex,
			} )
		) {
			return;
		}
		if ( announceCancellation ) {
			announce(
				getMoveCanceledAnnouncement( pointerSession.rowLabel, pointerSession.oldIndex + 1 )
			);
		}
		touchModeGuidance?.setHidden( false );
		pointerSession.control.focus();
		maybeUnpinControl( pointerSession.control );
	};
	const startSinglePointerSession = ( control: HTMLButtonElement ) => {
		if ( session.kind !== 'idle' || ! rows ) {
			return;
		}
		const row = getRowFromControl( control );
		const oldIndex = row?.sectionRowIndex ?? -1;
		if ( ! row || oldIndex < 0 || nonMovableRows.has( oldIndex ) ) {
			return;
		}
		const targets = getValidRowMoveTargets( oldIndex, constraints );
		if ( targets.length === 0 ) {
			control.focus();
			return;
		}
		const rowLabel = getRowRepresentativeText( row );
		activateControl( control );
		rowControls.pin( control );
		rowControls.setPressed( control, true );
		control.focus();
		touchModeGuidance?.setHidden( true );
		const targetsUi = createRowMoveTargets( document, tbody, targets, {
			isTouch: ! useHoverMode,
			onCancel: () => finishSinglePointerSession(),
			onSelect: ( newIndex ) => finishSinglePointerSession( newIndex ),
		} );
		session = { kind: 'pointer', control, oldIndex, rowLabel, targetsUi };
		announce( getDestinationRequestedAnnouncement( rowLabel ) );
	};
	const findMovableControl = (
		startIndex: number,
		direction: -1 | 1
	): HTMLButtonElement | null => {
		for (
			let index = startIndex + direction;
			index >= 0 && index < tbody.rows.length;
			index += direction
		) {
			if ( nonMovableRows.has( index ) ) {
				continue;
			}
			const row = tbody.rows.item( index );
			if ( ! row ) {
				continue;
			}
			const control = rowControls.ensureControl( row );
			if ( control ) {
				return control;
			}
		}
		return null;
	};
	const onPointerOver = ( event: PointerEvent ) => {
		rememberMousePoint( event );
		if ( ! useHoverMode || event.pointerType !== 'mouse' || session.kind !== 'idle' ) {
			return;
		}
		const row = getRowFromElement( event.target as Element | null );
		if ( ! row ) {
			return;
		}
		const relatedRow = getRowFromElement( event.relatedTarget as Element | null );
		if ( relatedRow === row ) {
			return;
		}
		const control = rowControls.ensureControl( row );
		if ( control ) {
			activateControl( control );
		}
	};
	const onPointerOut = ( event: PointerEvent ) => {
		rememberMousePoint( event );
		if ( ! useHoverMode || event.pointerType !== 'mouse' ) {
			return;
		}
		const row = getRowFromElement( event.target as Element | null );
		if ( ! row ) {
			return;
		}
		const relatedRow = getRowFromElement( event.relatedTarget as Element | null );
		if ( relatedRow === row ) {
			return;
		}
		const control = row.querySelector< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` );
		if ( control ) {
			deactivateControl( control );
		}
	};
	const onPointerMove = ( event: PointerEvent ) => rememberMousePoint( event );
	const onPointerDown = ( event: PointerEvent ) => {
		rememberMousePoint( event );
		rememberRowFromEvent( event );
		const control = getControlFromElement( event.target as Element | null );
		if ( control && event.pointerType === 'mouse' && session.kind === 'idle' ) {
			activateControl( control );
		}
	};
	const onMouseDown = ( event: MouseEvent ) => {
		if (
			useHoverMode &&
			event.button === 0 &&
			getControlFromElement( event.target as Element | null )
		) {
			event.preventDefault();
		}
	};
	const onClick = ( event: MouseEvent ) => {
		const control = getControlFromElement( event.target as Element | null );
		if ( ! control ) {
			return;
		}
		if ( event.detail === 0 || session.kind === 'keyboard' || session.kind === 'dragging' ) {
			return;
		}
		if ( view.performance.now() < suppressPointerClickUntil ) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		if ( session.kind === 'pointer' && session.control === control ) {
			return;
		}
		startSinglePointerSession( control );
	};
	const onFocusIn = ( event: FocusEvent ) => {
		rememberRowFromEvent( event );
		const control = getControlFromElement( event.target as Element | null );
		if ( ! control ) {
			return;
		}
		lastActiveRowIndex = getRowIndexFromElement( control );
		rowControls.pin( control );
		rowControls.setVisible( control, true );
	};
	const onFocusOut = ( event: FocusEvent ) => {
		const control = getControlFromElement( event.target as Element | null );
		if ( ! control ) {
			return;
		}
		if ( session.kind === 'keyboard' && session.control === control ) {
			queueMicrotask( () => {
				if ( ! destroyed && session.kind === 'keyboard' && session.control === control ) {
					control.focus();
				}
			} );
			return;
		}
		if ( useHoverMode && activeControl !== control ) {
			rowControls.setVisible( control, false );
		}
		queueMicrotask( () => {
			if ( ! destroyed ) {
				maybeUnpinControl( control );
			}
		} );
	};
	const onKeyDown = ( event: KeyboardEvent ) => {
		const control = getControlFromElement( event.target as Element | null );
		if ( ! control || session.kind === 'dragging' || session.kind === 'pointer' ) {
			return;
		}
		if ( event.repeat && ( event.key === 'Enter' || event.key === ' ' ) ) {
			return;
		}
		if ( session.kind === 'idle' ) {
			const isUnmodifiedArrowKey =
				( event.key === 'ArrowUp' || event.key === 'ArrowDown' ) &&
				! event.shiftKey &&
				! event.ctrlKey &&
				! event.altKey &&
				! event.metaKey;
			if ( isUnmodifiedArrowKey ) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if ( event.key === 'Tab' ) {
				const rowIndex = getRowIndexFromElement( control );
				const nextControl =
					rowIndex === null ? null : findMovableControl( rowIndex, event.shiftKey ? -1 : 1 );
				if ( nextControl ) {
					event.preventDefault();
					event.stopPropagation();
					nextControl.focus();
				}
				return;
			}
			if ( event.key !== 'Enter' && event.key !== ' ' ) {
				return;
			}
			const row = getRowFromControl( control );
			const rowIndex = row?.sectionRowIndex ?? -1;
			if ( ! row || rowIndex < 0 || nonMovableRows.has( rowIndex ) ) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const rowLabel = getRowRepresentativeText( row );
			activateControl( control );
			rowControls.pin( control );
			touchModeGuidance?.setHidden( true );
			rowControls.setPressed( control, true );
			const guidance = createReorderGuidance( document, tbody, getKeyboardActiveMessage() );
			session = {
				kind: 'keyboard',
				control,
				currentIndex: rowIndex,
				lastBoundaryDirection: null,
				oldIndex: rowIndex,
				rowLabel,
				guidance,
			};
			announce( getMoveStartedAnnouncement( rowLabel, rowIndex + 1, constraints.rowCount ) );
			control.focus();
			return;
		}
		const keyboardSession = session;
		if ( keyboardSession.control !== control ) {
			return;
		}
		if ( event.key === 'Tab' ) {
			event.preventDefault();
			event.stopPropagation();
			control.focus();
			return;
		}
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			event.stopPropagation();
			finishKeyboardSession( false );
			return;
		}
		if ( event.key === 'Enter' || event.key === ' ' ) {
			event.preventDefault();
			event.stopPropagation();
			finishKeyboardSession( true );
			return;
		}
		if ( event.key !== 'ArrowUp' && event.key !== 'ArrowDown' ) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		const direction: RowMoveDirection = event.key === 'ArrowUp' ? 'up' : 'down';
		const nextIndex = getNextValidRowMoveIndex(
			keyboardSession.oldIndex,
			keyboardSession.currentIndex,
			direction,
			constraints
		);
		if ( nextIndex === null ) {
			if ( keyboardSession.lastBoundaryDirection !== direction ) {
				announce( getMoveBoundaryAnnouncement( keyboardSession.rowLabel, direction ) );
				keyboardSession.lastBoundaryDirection = direction;
			}
			return;
		}
		keyboardSession.currentIndex = nextIndex;
		keyboardSession.lastBoundaryDirection = null;
		showKeyboardCandidate( keyboardSession );
		announce(
			getDestinationChangedAnnouncement(
				keyboardSession.rowLabel,
				nextIndex + 1,
				constraints.rowCount
			)
		);
		scrollKeyboardDestinationIntoView(
			view,
			tbody,
			getRowMoveInsertionIndex( keyboardSession.oldIndex, nextIndex )
		);
	};
	const onDocumentKeyDown = ( event: KeyboardEvent ) => {
		if ( event.key === 'Escape' && useHoverMode && session.kind === 'pointer' ) {
			event.preventDefault();
			event.stopPropagation();
			finishSinglePointerSession();
		}
	};
	const onDocumentScroll = () => scheduleHoverSync();

	for ( const eventName of blockSelectionEvents ) {
		tbody.addEventListener( eventName, stopRowControlInteractionPropagation );
	}
	document.addEventListener( 'keydown', onDocumentKeyDown, true );
	tbody.addEventListener( 'focusin', onFocusIn );
	tbody.addEventListener( 'focusout', onFocusOut );
	tbody.addEventListener( 'pointerdown', onPointerDown );
	tbody.addEventListener( 'click', onClick );
	tbody.addEventListener( 'keydown', onKeyDown );
	if ( useHoverMode ) {
		document.addEventListener( 'pointermove', onPointerMove, true );
		document.addEventListener( 'scroll', onDocumentScroll, true );
		tbody.addEventListener( 'mousedown', onMouseDown );
		tbody.addEventListener( 'pointerover', onPointerOver );
		tbody.addEventListener( 'pointerout', onPointerOut );
		const hoveredRow = Array.from( tbody.rows ).find( ( row ) => row.matches( ':hover' ) );
		if ( hoveredRow ) {
			const control = rowControls.ensureControl( hoveredRow );
			if ( control ) {
				activateControl( control );
			}
		}
	}

	void ensureSortableRuntime( document, view, runtimeUrl ).then( ( Sortable ) => {
		if ( destroyed || ! Sortable ) {
			return;
		}
		const sortableOptions: SortableOptions = {
			animation: 150,
			bubbleScroll: true,
			draggable: 'tr',
			forceFallback: true,
			handle: `.${ HANDLE_ZONE_CLASS }`,
			onChoose: ( event ) => {
				if ( session.kind !== 'keyboard' ) {
					insertionLine.hide();
				}
				const row = event.item as HTMLTableRowElement;
				dragControl = row.querySelector< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` );
				if ( dragControl ) {
					rowControls.pin( dragControl );
				}
				dragSnapshot = {
					rows: Array.from( tbody.rows ),
					rowLabel: getRowRepresentativeText( row ),
				};
				restoreFallbackWidths();
				restoreFallbackCellWidths = fixFallbackRowCellWidths( event.item );
			},
			onStart: () => {
				if ( session.kind === 'keyboard' ) {
					return;
				}
				if ( session.kind === 'pointer' ) {
					finishSinglePointerSession( undefined, false );
				}
				insertionLine.hide();
				session = { kind: 'dragging' };
				suppressPointerClickUntil = Number.POSITIVE_INFINITY;
				suppressBlockDrag();
				if ( dragControl ) {
					rowControls.setVisible( dragControl, true );
				}
			},
			onMove: ( event ) => {
				if ( session.kind !== 'dragging' ) {
					if ( session.kind !== 'keyboard' ) {
						insertionLine.hide();
					}
					return false;
				}
				if ( ! dragSnapshot ) {
					insertionLine.hide();
					return;
				}
				const insertionIndex = getMoveInsertionIndex(
					{
						insertAfter: event.willInsertAfter,
						relatedElement: event.related,
					},
					dragSnapshot.rows
				);
				if ( insertionIndex === null ) {
					insertionLine.hide();
					return;
				}
				if ( forbiddenInsertionIndices.includes( insertionIndex ) ) {
					insertionLine.hide();
					return false;
				}
				const relatedRow = event.related.closest< HTMLTableRowElement >( 'tr' );
				if ( ! relatedRow || relatedRow.parentElement !== tbody ) {
					insertionLine.hide();
					return;
				}
				insertionLine.show( relatedRow, event.willInsertAfter );
			},
			onEnd: ( event ) => {
				const completedDrag = session.kind === 'dragging';
				const completedSnapshot = dragSnapshot;
				const completedControl = dragControl;
				if ( completedDrag ) {
					insertionLine.hide();
					session = { kind: 'idle' };
					suppressPointerClickUntil = view.performance.now() + DRAG_CLICK_SUPPRESSION_MS;
				}
				restoreFallbackWidths();
				cleanupDragSnapshot();
				dragControl = null;
				if ( ! completedDrag ) {
					if ( session.kind === 'keyboard' ) {
						showKeyboardCandidate( session );
						session.control.focus();
					}
					if ( completedControl ) {
						maybeUnpinControl( completedControl );
					}
					return;
				}
				if ( useHoverMode ) {
					syncHoverFromMousePoint();
				} else {
					restoreBlockDrag();
				}
				if ( completedControl ) {
					maybeUnpinControl( completedControl );
				}
				const { oldIndex, newIndex } = event;
				if ( oldIndex === undefined || newIndex === undefined || ! completedSnapshot ) {
					return;
				}
				commitRowMove( {
					oldIndex,
					newIndex,
					rowLabel: completedSnapshot.rowLabel,
				} );
			},
			onUnchoose: () => {
				if ( session.kind === 'keyboard' ) {
					showKeyboardCandidate( session );
				} else {
					insertionLine.hide();
				}
				if ( suppressPointerClickUntil === Number.POSITIVE_INFINITY ) {
					suppressPointerClickUntil = view.performance.now() + DRAG_CLICK_SUPPRESSION_MS;
				}
				restoreFallbackWidths();
			},
			scroll: resolveAutoScrollTarget( options.context ),
			scrollSensitivity: AUTO_SCROLL_SENSITIVITY_PX,
			scrollSpeed: AUTO_SCROLL_SPEED_PX,
		};
		const createdSortable = Sortable.create( tbody, sortableOptions );
		if ( destroyed ) {
			createdSortable.destroy();
			return;
		}
		sortable = createdSortable;
	} );

	const focusRowControlAt = ( rowIndex: number ): boolean => {
		if ( nonMovableRows.has( rowIndex ) ) {
			return false;
		}
		const row = tbody.rows.item( rowIndex );
		const control = row ? rowControls.ensureControl( row ) : null;
		if ( ! control ) {
			return false;
		}
		lastActiveRowIndex = rowIndex;
		rowControls.pin( control );
		rowControls.setVisible( control, true );
		control.focus();
		return true;
	};

	return {
		focusRowControl: () => {
			const firstFocusableRowIndex = Array.from( tbody.rows ).findIndex( ( row, rowIndex ) => {
				if ( nonMovableRows.has( rowIndex ) ) {
					return false;
				}
				return rowControls.ensureControl( row ) !== null;
			} );
			if ( firstFocusableRowIndex < 0 ) {
				announce( getNoMovableRowsAnnouncement() );
				return 'no-movable-rows';
			}
			const activeRowIndex = getRowIndexFromElement( tbody.ownerDocument.activeElement );
			if ( activeRowIndex !== null ) {
				lastActiveRowIndex = activeRowIndex;
			}
			if ( lastActiveRowIndex !== null ) {
				if ( nonMovableRows.has( lastActiveRowIndex ) ) {
					const row = tbody.rows.item( lastActiveRowIndex );
					if ( row ) {
						announce( getRowspanBlockedAnnouncement( getRowRepresentativeText( row ) ) );
					}
					return 'current-row-not-movable';
				}
				if ( focusRowControlAt( lastActiveRowIndex ) ) {
					return 'focused';
				}
			}
			focusRowControlAt( firstFocusableRowIndex );
			return 'focused';
		},
		focusRowControlAt,
		destroy: () => {
			if ( destroyed ) {
				return;
			}
			destroyed = true;
			if ( session.kind === 'keyboard' ) {
				rowControls.setPressed( session.control, false );
				session.guidance.cleanup();
			} else if ( session.kind === 'pointer' ) {
				announce( getMoveCanceledAnnouncement( session.rowLabel, session.oldIndex + 1 ) );
				session.targetsUi.cleanup();
				rowControls.setPressed( session.control, false );
			}
			session = { kind: 'idle' };
			touchModeGuidance?.cleanup();
			touchModeGuidance = null;
			sortable?.destroy();
			sortable = null;
			insertionLine.cleanup();
			restoreFallbackWidths();
			document.removeEventListener( 'keydown', onDocumentKeyDown, true );
			for ( const eventName of blockSelectionEvents ) {
				tbody.removeEventListener( eventName, stopRowControlInteractionPropagation );
			}
			tbody.removeEventListener( 'focusin', onFocusIn );
			tbody.removeEventListener( 'focusout', onFocusOut );
			tbody.removeEventListener( 'pointerdown', onPointerDown );
			tbody.removeEventListener( 'click', onClick );
			tbody.removeEventListener( 'keydown', onKeyDown );
			if ( useHoverMode ) {
				document.removeEventListener( 'pointermove', onPointerMove, true );
				document.removeEventListener( 'scroll', onDocumentScroll, true );
				tbody.removeEventListener( 'mousedown', onMouseDown );
				tbody.removeEventListener( 'pointerover', onPointerOver );
				tbody.removeEventListener( 'pointerout', onPointerOut );
			}
			if ( pendingHoverFrame !== null ) {
				view.cancelAnimationFrame( pendingHoverFrame );
				pendingHoverFrame = null;
			}
			cleanupDragSnapshot();
			dragControl = null;
			releaseActiveControl();
			rowControls.cleanup();
		},
	};
};
