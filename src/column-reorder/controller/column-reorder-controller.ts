import {
	getColumnMoveInsertionIndex,
	getNextColumnMoveIndex,
	getValidColumnMoveTargets,
	isNoopColumnMove,
	moveColumn,
	type ColumnMoveDirection,
} from '../column-order';
import {
	getColumnDestinationChangedAnnouncement,
	getColumnDestinationRequestedAnnouncement,
	getColumnKeyboardGuidance,
	getColumnMoveBoundaryAnnouncement,
	getColumnMoveCanceledAnnouncement,
	getColumnMoveCommittedAnnouncement,
	getColumnMoveStartedAnnouncement,
	getColumnPointerGuidance,
} from '../messages';
import type { ColumnTableContext } from '../table-context';
import {
	announceColumnLiveStatus,
	createColumnControls,
	createColumnInsertionLine,
	createColumnMoveTargets,
	createColumnReorderGuidance,
	scrollColumnDestinationIntoView,
	stopColumnControlInteractionPropagation,
	type ColumnControlEntry,
	type ColumnMoveTargetsUi,
	type ColumnReorderGuidanceUi,
} from './reorder-ui';

type ColumnReorderControllerOptions< TAttributes extends Record< string, unknown > > = {
	attributes: TAttributes;
	context: ColumnTableContext;
	onCommit: ( attributes: TAttributes, focusColumnIndex: number ) => void;
};

/** React / Gutenberg integration へ公開する controller lifecycle。 */
export type ColumnReorderController = {
	destroy: () => void;
	focusColumnControlAt: ( columnIndex: number ) => boolean;
};

type KeyboardSession = {
	currentIndex: number;
	entry: ColumnControlEntry;
	guidance: ColumnReorderGuidanceUi;
	lastBoundaryDirection: ColumnMoveDirection | null;
	oldIndex: number;
};

type PointerSession = {
	entry: ColumnControlEntry;
	guidance: ColumnReorderGuidanceUi;
	oldIndex: number;
	targetsUi: ColumnMoveTargetsUi;
};

type ReorderSession =
	| { kind: 'idle' }
	| ( { kind: 'keyboard' } & KeyboardSession )
	| ( { kind: 'pointer' } & PointerSession );

/**
 * Column Reorder の keyboard / single-pointer interaction を管理する。
 *
 * @param options controller 生成に必要な context、attributes、commit callback。
 */
export const createColumnReorderController = < TAttributes extends Record< string, unknown > >(
	options: ColumnReorderControllerOptions< TAttributes >
): ColumnReorderController => {
	const {
		attributes,
		context: { blockElement, columns, document, table, window: view },
		onCommit,
	} = options;
	const columnControls = createColumnControls( document, table, columns );
	const entries = columnControls.entries;
	const insertionLine = createColumnInsertionLine( document, table, columns );
	const entryByControl = new Map( entries.map( ( entry ) => [ entry.control, entry ] ) );
	const entryByCell = new Map< HTMLTableCellElement, ColumnControlEntry >();
	for ( const entry of entries ) {
		for ( const cell of entry.cells ) {
			entryByCell.set( cell, entry );
		}
	}
	const blockSelectionEvents = [ 'pointerdown', 'mousedown', 'click' ] as const;
	const columnCount = columns.length;
	let session: ReorderSession = { kind: 'idle' };
	let activeEntry: ColumnControlEntry | null = null;
	let destroyed = false;
	let blockDragSuppressed = false;
	let originalDraggable: string | null = null;

	const announce = ( message: string ) => announceColumnLiveStatus( document, message );
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
	const activateEntry = ( entry: ColumnControlEntry ) => {
		if ( activeEntry && activeEntry !== entry ) {
			columnControls.setVisible( activeEntry, false );
		}
		activeEntry = entry;
		suppressBlockDrag();
		columnControls.setVisible( entry, true );
	};
	const deactivateEntry = ( entry: ColumnControlEntry ) => {
		const sessionEntry = session.kind === 'idle' ? null : session.entry;
		if ( sessionEntry === entry ) {
			return;
		}
		if ( ! entry.control.matches( ':focus' ) ) {
			columnControls.setVisible( entry, false );
		}
		if ( activeEntry === entry ) {
			activeEntry = null;
			restoreBlockDrag();
		}
	};
	const releaseEntry = () => {
		if ( activeEntry && ! activeEntry.control.matches( ':focus' ) ) {
			columnControls.setVisible( activeEntry, false );
		}
		activeEntry = null;
		restoreBlockDrag();
	};
	const commitColumnMove = ( oldIndex: number, newIndex: number ): boolean => {
		if ( isNoopColumnMove( oldIndex, newIndex ) ) {
			return false;
		}
		const nextAttributes = moveColumn( attributes, oldIndex, newIndex );
		if ( ! nextAttributes ) {
			return false;
		}
		announce( getColumnMoveCommittedAnnouncement( oldIndex + 1, newIndex + 1 ) );
		onCommit( nextAttributes, newIndex );
		return true;
	};
	const showKeyboardCandidate = ( keyboardSession: KeyboardSession ) => {
		if ( keyboardSession.currentIndex === keyboardSession.oldIndex ) {
			insertionLine.hide();
			return;
		}
		insertionLine.show(
			getColumnMoveInsertionIndex( keyboardSession.oldIndex, keyboardSession.currentIndex )
		);
	};
	const finishKeyboardSession = ( commit: boolean ) => {
		if ( session.kind !== 'keyboard' ) {
			return;
		}
		const keyboardSession = session;
		keyboardSession.guidance.cleanup();
		insertionLine.hide();
		keyboardSession.entry.setPressed( false );
		session = { kind: 'idle' };
		releaseEntry();
		if ( commit && commitColumnMove( keyboardSession.oldIndex, keyboardSession.currentIndex ) ) {
			return;
		}
		if ( ! commit ) {
			announce( getColumnMoveCanceledAnnouncement( keyboardSession.oldIndex + 1 ) );
		}
		keyboardSession.entry.control.focus();
	};
	const finishPointerSession = ( newIndex?: number ) => {
		if ( session.kind !== 'pointer' ) {
			return;
		}
		const pointerSession = session;
		pointerSession.targetsUi.cleanup();
		pointerSession.guidance.cleanup();
		pointerSession.entry.setPressed( false );
		session = { kind: 'idle' };
		releaseEntry();
		if ( newIndex !== undefined && commitColumnMove( pointerSession.oldIndex, newIndex ) ) {
			return;
		}
		if ( newIndex === undefined ) {
			announce( getColumnMoveCanceledAnnouncement( pointerSession.oldIndex + 1 ) );
		}
		pointerSession.entry.control.focus();
	};
	const startPointerSession = ( entry: ColumnControlEntry ) => {
		if ( session.kind !== 'idle' ) {
			return;
		}
		const targets = getValidColumnMoveTargets( entry.columnIndex, columnCount );
		if ( targets.length === 0 ) {
			entry.control.focus();
			return;
		}
		activateEntry( entry );
		entry.setPressed( true );
		entry.control.focus();
		const guidance = createColumnReorderGuidance( document, table, getColumnPointerGuidance() );
		const targetsUi = createColumnMoveTargets( document, table, columns, targets, {
			onSelect: ( newIndex ) => finishPointerSession( newIndex ),
		} );
		session = {
			kind: 'pointer',
			entry,
			guidance,
			oldIndex: entry.columnIndex,
			targetsUi,
		};
		announce( getColumnDestinationRequestedAnnouncement( entry.columnIndex + 1 ) );
	};
	const startKeyboardSession = ( entry: ColumnControlEntry ) => {
		activateEntry( entry );
		entry.setPressed( true );
		const guidance = createColumnReorderGuidance( document, table, getColumnKeyboardGuidance() );
		session = {
			kind: 'keyboard',
			currentIndex: entry.columnIndex,
			entry,
			guidance,
			lastBoundaryDirection: null,
			oldIndex: entry.columnIndex,
		};
		announce( getColumnMoveStartedAnnouncement( entry.columnIndex + 1, columnCount ) );
		entry.control.focus();
	};
	const onCellPointerEnter = ( event: PointerEvent ) => {
		if ( event.pointerType !== 'mouse' || session.kind !== 'idle' ) {
			return;
		}
		const entry = entryByCell.get( event.currentTarget as HTMLTableCellElement );
		if ( entry ) {
			activateEntry( entry );
		}
	};
	const onCellPointerLeave = ( event: PointerEvent ) => {
		if ( event.pointerType !== 'mouse' ) {
			return;
		}
		const entry = entryByCell.get( event.currentTarget as HTMLTableCellElement );
		if ( entry ) {
			deactivateEntry( entry );
		}
	};
	const onControlFocus = ( event: FocusEvent ) => {
		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( entry ) {
			activateEntry( entry );
		}
	};
	const onControlBlur = ( event: FocusEvent ) => {
		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( ! entry ) {
			return;
		}
		if ( session.kind === 'keyboard' && session.entry === entry ) {
			queueMicrotask( () => {
				if ( ! destroyed && session.kind === 'keyboard' && session.entry === entry ) {
					entry.control.focus();
				}
			} );
			return;
		}
		if ( session.kind === 'idle' && activeEntry !== entry ) {
			columnControls.setVisible( entry, false );
		}
	};
	const onControlMouseDown = ( event: MouseEvent ) => {
		if ( event.button === 0 ) {
			event.preventDefault();
		}
	};
	const onControlClick = ( event: MouseEvent ) => {
		if ( event.detail === 0 || session.kind === 'keyboard' ) {
			return;
		}
		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( ! entry ) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		if ( session.kind === 'pointer' ) {
			return;
		}
		startPointerSession( entry );
	};
	const onControlKeyDown = ( event: KeyboardEvent ) => {
		const entry = entryByControl.get( event.currentTarget as HTMLButtonElement );
		if ( ! entry || session.kind === 'pointer' ) {
			return;
		}
		if ( event.repeat && ( event.key === 'Enter' || event.key === ' ' ) ) {
			return;
		}

		if ( session.kind === 'idle' ) {
			if ( event.key === 'Tab' ) {
				const entryIndex = entries.indexOf( entry );
				const nextEntry = entries[ entryIndex + ( event.shiftKey ? -1 : 1 ) ];
				if ( nextEntry ) {
					event.preventDefault();
					event.stopPropagation();
					nextEntry.control.focus();
				}
				return;
			}
			const isModified = event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
			if ( isModified ) {
				return;
			}
			if ( event.key === 'ArrowLeft' || event.key === 'ArrowRight' ) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if ( event.key !== 'Enter' && event.key !== ' ' ) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			startKeyboardSession( entry );
			return;
		}

		const keyboardSession = session;
		if ( keyboardSession.entry !== entry ) {
			return;
		}
		if ( event.key === 'Tab' ) {
			event.preventDefault();
			event.stopPropagation();
			entry.control.focus();
			return;
		}
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			event.stopPropagation();
			finishKeyboardSession( false );
			return;
		}
		const isModified = event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
		if ( isModified ) {
			return;
		}
		if ( event.key === 'Enter' || event.key === ' ' ) {
			event.preventDefault();
			event.stopPropagation();
			finishKeyboardSession( true );
			return;
		}
		if ( event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' ) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		const direction: ColumnMoveDirection = event.key === 'ArrowLeft' ? 'left' : 'right';
		const nextIndex = getNextColumnMoveIndex(
			keyboardSession.currentIndex,
			direction,
			columnCount
		);
		if ( nextIndex === null ) {
			if ( keyboardSession.lastBoundaryDirection !== direction ) {
				announce( getColumnMoveBoundaryAnnouncement( direction ) );
				keyboardSession.lastBoundaryDirection = direction;
			}
			return;
		}

		keyboardSession.currentIndex = nextIndex;
		keyboardSession.lastBoundaryDirection = null;
		showKeyboardCandidate( keyboardSession );
		announce( getColumnDestinationChangedAnnouncement( nextIndex + 1, columnCount ) );
		scrollColumnDestinationIntoView(
			view,
			table,
			columns,
			getColumnMoveInsertionIndex( keyboardSession.oldIndex, nextIndex )
		);
	};
	const onDocumentKeyDown = ( event: KeyboardEvent ) => {
		if ( event.key === 'Escape' && session.kind === 'pointer' ) {
			event.preventDefault();
			event.stopPropagation();
			finishPointerSession();
		}
	};

	for ( const eventName of blockSelectionEvents ) {
		table.addEventListener( eventName, stopColumnControlInteractionPropagation );
	}
	document.addEventListener( 'keydown', onDocumentKeyDown, true );
	for ( const entry of entries ) {
		entry.control.addEventListener( 'focus', onControlFocus );
		entry.control.addEventListener( 'blur', onControlBlur );
		entry.control.addEventListener( 'mousedown', onControlMouseDown );
		entry.control.addEventListener( 'click', onControlClick );
		entry.control.addEventListener( 'keydown', onControlKeyDown );
		for ( const cell of entry.cells ) {
			cell.addEventListener( 'pointerenter', onCellPointerEnter );
			cell.addEventListener( 'pointerleave', onCellPointerLeave );
		}
	}

	const hoveredEntry = entries.find( ( entry ) =>
		entry.cells.some( ( cell ) => cell.matches( ':hover' ) )
	);
	if ( hoveredEntry ) {
		activateEntry( hoveredEntry );
	}

	return {
		focusColumnControlAt: ( columnIndex ) => {
			const entry = entries[ columnIndex ];
			if ( ! entry ) {
				return false;
			}
			columnControls.setVisible( entry, true );
			entry.control.focus();
			return true;
		},
		destroy: () => {
			destroyed = true;
			if ( session.kind === 'keyboard' ) {
				session.guidance.cleanup();
			} else if ( session.kind === 'pointer' ) {
				session.targetsUi.cleanup();
				session.guidance.cleanup();
			}
			for ( const eventName of blockSelectionEvents ) {
				table.removeEventListener( eventName, stopColumnControlInteractionPropagation );
			}
			document.removeEventListener( 'keydown', onDocumentKeyDown, true );
			for ( const entry of entries ) {
				entry.control.removeEventListener( 'focus', onControlFocus );
				entry.control.removeEventListener( 'blur', onControlBlur );
				entry.control.removeEventListener( 'mousedown', onControlMouseDown );
				entry.control.removeEventListener( 'click', onControlClick );
				entry.control.removeEventListener( 'keydown', onControlKeyDown );
				for ( const cell of entry.cells ) {
					cell.removeEventListener( 'pointerenter', onCellPointerEnter );
					cell.removeEventListener( 'pointerleave', onCellPointerLeave );
				}
			}
			insertionLine.cleanup();
			columnControls.cleanup();
			restoreBlockDrag();
		},
	};
};