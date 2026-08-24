/**
 * Column Reorderのcontrol prototypeをGutenberg BlockEditへ接続する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { Button } from '@wordpress/components';
import {
	useLayoutEffect,
	useRef,
	useState,
	type ComponentType,
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
} from '@wordpress/element';

import { supportsColumnReorder } from './block-support';
import { moveColumn } from './column-order';
import {
	getColumnControlDescription,
	getColumnControlName,
	getColumnControlsName,
	getColumnDestinationChangedAnnouncement,
	getColumnDestinationRequestedAnnouncement,
	getColumnKeyboardGuidance,
	getColumnMoveBoundaryAnnouncement,
	getColumnMoveCanceledAnnouncement,
	getColumnMoveCommittedAnnouncement,
	getColumnMoveStartedAnnouncement,
	getColumnPointerGuidance,
} from './messages';
import { resolveColumnTableContext } from './table-context';

type TableAttributes = Record< string, unknown >;

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type ColumnGeometry = {
	left: number;
	width: number;
};

type ControlGeometry = {
	columns: ColumnGeometry[];
	top: number;
};

type ColumnReorderEditProps = {
	BlockEdit: ComponentType< TableBlockEditProps >;
	props: TableBlockEditProps;
};

type InteractionMode = 'keyboard' | 'pointer';

type ReorderSession = {
	destinationIndex: number;
	mode: InteractionMode;
	sourceIndex: number;
};

const getControlGeometry = ( columns: HTMLTableCellElement[] ): ControlGeometry | null => {
	if ( columns.length === 0 ) {
		return null;
	}

	const rects = columns.map( ( cell ) => cell.getBoundingClientRect() );
	return {
		columns: rects.map( ( rect ) => ( {
			left: rect.left,
			width: rect.width,
		} ) ),
		top: Math.min( ...rects.map( ( rect ) => rect.top ) ),
	};
};

/**
 * Column Reorder対応block専用のcontrol描画component。
 *
 * column interaction stateはfeature内で所有し、確定時だけGutenberg attributesを更新する。
 *
 * @param componentProps Gutenbergから渡されるBlockEdit propsと元のBlockEdit component。
 */
const ColumnReorderEdit = ( componentProps: ColumnReorderEditProps ) => {
	const { BlockEdit, props } = componentProps;
	const { attributes, clientId, isSelected, setAttributes } = props;
	const [ editorCanvasReference, setEditorCanvasReference ] = useState< HTMLSpanElement | null >(
		null
	);
	const [ geometry, setGeometry ] = useState< ControlGeometry | null >( null );
	const [ session, setSession ] = useState< ReorderSession | null >( null );
	const [ announcement, setAnnouncement ] = useState( '' );
	const toolbarRef = useRef< HTMLDivElement | null >( null );
	const pendingFocusIndexRef = useRef< number | null >( null );

	useLayoutEffect( () => {
		if ( ! isSelected || ! editorCanvasReference ) {
			setGeometry( null );
			setSession( null );
			return;
		}

		let resizeObserver: ResizeObserver | null = null;

		const refreshGeometry = () => {
			const currentContext = resolveColumnTableContext( editorCanvasReference, clientId );
			if ( ! currentContext ) {
				setGeometry( null );
				setSession( null );
				return;
			}

			setGeometry( getControlGeometry( currentContext.columns ) );
		};

		const context = resolveColumnTableContext( editorCanvasReference, clientId );
		if ( ! context ) {
			setGeometry( null );
			setSession( null );
			return;
		}

		refreshGeometry();
		context.window.addEventListener( 'resize', refreshGeometry );
		context.window.addEventListener( 'scroll', refreshGeometry, true );

		const ResizeObserverConstructor = ( context.window as Window & typeof globalThis )
			.ResizeObserver;
		if ( ResizeObserverConstructor ) {
			resizeObserver = new ResizeObserverConstructor( refreshGeometry );
			resizeObserver.observe( context.table );
		}

		return () => {
			context.window.removeEventListener( 'resize', refreshGeometry );
			context.window.removeEventListener( 'scroll', refreshGeometry, true );
			resizeObserver?.disconnect();
		};
	}, [ editorCanvasReference, attributes, clientId, isSelected ] );

	useLayoutEffect( () => {
		const pendingFocusIndex = pendingFocusIndexRef.current;
		if ( pendingFocusIndex === null || ! geometry ) {
			return;
		}

		const control = toolbarRef.current?.querySelector< HTMLButtonElement >(
			`[data-column-index="${ pendingFocusIndex }"]`
		);
		if ( control ) {
			control.focus();
			pendingFocusIndexRef.current = null;
		}
	}, [ attributes, geometry, session ] );

	const restoreFocus = ( columnIndex: number ) => {
		pendingFocusIndexRef.current = columnIndex;
	};

	const startSession = ( sourceIndex: number, mode: InteractionMode ) => {
		setSession( {
			destinationIndex: sourceIndex,
			mode,
			sourceIndex,
		} );
		setAnnouncement(
			mode === 'keyboard'
				? getColumnMoveStartedAnnouncement( sourceIndex + 1, geometry?.columns.length ?? 0 )
				: getColumnDestinationRequestedAnnouncement( sourceIndex + 1 )
		);
	};

	const cancelSession = () => {
		if ( ! session ) {
			return;
		}

		restoreFocus( session.sourceIndex );
		setAnnouncement( getColumnMoveCanceledAnnouncement( session.sourceIndex + 1 ) );
		setSession( null );
	};

	const commitSession = ( destinationIndex: number ) => {
		if ( ! session ) {
			return;
		}

		const sourceIndex = session.sourceIndex;
		if ( destinationIndex === sourceIndex ) {
			restoreFocus( sourceIndex );
			setSession( null );
			return;
		}

		const nextAttributes = moveColumn( attributes, sourceIndex, destinationIndex );
		if ( ! nextAttributes ) {
			restoreFocus( sourceIndex );
			setSession( null );
			return;
		}

		restoreFocus( destinationIndex );
		setAnnouncement( getColumnMoveCommittedAnnouncement( sourceIndex + 1, destinationIndex + 1 ) );
		setSession( null );
		setAttributes( nextAttributes );
	};

	const moveKeyboardDestination = ( direction: 'left' | 'right' ) => {
		if ( ! session || session.mode !== 'keyboard' || ! geometry ) {
			return;
		}

		const delta = direction === 'left' ? -1 : 1;
		const nextIndex = session.destinationIndex + delta;
		if ( nextIndex < 0 || nextIndex >= geometry.columns.length ) {
			setAnnouncement( getColumnMoveBoundaryAnnouncement( direction ) );
			return;
		}

		setSession( { ...session, destinationIndex: nextIndex } );
		setAnnouncement(
			getColumnDestinationChangedAnnouncement( nextIndex + 1, geometry.columns.length )
		);
	};

	const handleControlKeyDown = (
		event: ReactKeyboardEvent< HTMLButtonElement >,
		columnIndex: number
	) => {
		if ( event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ) {
			return;
		}

		if ( session ) {
			if ( event.key === 'ArrowLeft' || event.key === 'ArrowRight' ) {
				event.preventDefault();
				moveKeyboardDestination( event.key === 'ArrowLeft' ? 'left' : 'right' );
				return;
			}

			if ( event.key === 'Enter' || event.key === ' ' ) {
				event.preventDefault();
				commitSession( session.destinationIndex );
				return;
			}

			if ( event.key === 'Escape' ) {
				event.preventDefault();
				cancelSession();
			}

			return;
		}

		if ( event.key === 'Enter' || event.key === ' ' ) {
			event.preventDefault();
			startSession( columnIndex, 'keyboard' );
		}
	};

	const handleControlClick = (
		event: ReactMouseEvent< HTMLButtonElement >,
		columnIndex: number
	) => {
		if ( event.detail === 0 ) {
			return;
		}

		if ( ! session ) {
			startSession( columnIndex, 'pointer' );
			return;
		}

		if ( session.mode === 'pointer' ) {
			commitSession( columnIndex );
		}
	};

	const showControls = isSelected && geometry;
	const guidance = session
		? session.mode === 'keyboard'
			? getColumnKeyboardGuidance()
			: getColumnPointerGuidance()
		: null;

	return (
		<>
			<BlockEdit { ...props } />
			{ showControls && (
				<>
					<div
						aria-label={ getColumnControlsName() }
						className="yamabiko-column-reorder-controls"
						ref={ toolbarRef }
						role="toolbar"
					>
						{ geometry.columns.map( ( column, index ) => {
							const isActive = session?.sourceIndex === index;
							const isDestination = session?.destinationIndex === index;
							return (
								<Button
									key={ index }
									aria-description={ getColumnControlDescription() }
									aria-label={ getColumnControlName( index + 1 ) }
									aria-pressed={ isActive }
									className="yamabiko-column-reorder-control"
									data-column-index={ index }
									data-destination={ isDestination ? 'true' : undefined }
									onClick={ ( event ) => handleControlClick( event, index ) }
									onKeyDown={ ( event ) => handleControlKeyDown( event, index ) }
									style={ {
										left: `${ column.left }px`,
										top: `${ geometry.top }px`,
										width: `${ column.width }px`,
									} }
								>
									<span aria-hidden="true">⋮⋮</span>
								</Button>
							);
						} ) }
					</div>
					{ guidance && (
						<div className="yamabiko-column-reorder-guidance" role="status">
							{ guidance }
						</div>
					) }
					<div aria-live="polite" className="yamabiko-column-reorder-live-status">
						{ announcement }
					</div>
				</>
			) }
			{ /*
			 * Existing Table blocks are extended through editor.BlockEdit, so Column
			 * Reorder cannot attach a ref directly to their canvas DOM.
			 *
			 * This editor-only element provides the DOM-local reference used to resolve
			 * the current editor document and window without browsing-context discovery.
			 */ }
			<span aria-hidden="true" hidden ref={ setEditorCanvasReference } />
		</>
	);
};

/**
 * BlockEditへColumn Reorderのcontrol描画境界を追加するHOC。
 *
 * @param BlockEdit Gutenbergが提供する元のBlockEdit component。
 * @return Column Reorderを接続したBlockEdit component。
 */
export const withColumnReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithColumnReorder( props: TableBlockEditProps ) {
		if ( ! supportsColumnReorder( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		return <ColumnReorderEdit BlockEdit={ BlockEdit } props={ props } />;
	};
