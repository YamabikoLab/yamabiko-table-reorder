import type { ColumnMoveTarget } from '../../column-order';
import { getColumnDestinationBeforeName, getColumnDestinationEndName } from '../../messages';

const DESTINATION_CLASS = 'yamabiko-table-reorder-column-destination';
const POINTER_TAP_THRESHOLD_PX = 5;

type ColumnMoveTargetsOptions = {
	onSelect: ( newIndex: number ) => void;
};

/** single-pointer destination UI の lifecycle。 */
export type ColumnMoveTargetsUi = {
	cleanup: () => void;
};

const getBoundaryX = (
	columns: readonly HTMLTableCellElement[],
	insertionIndex: number
): number | null => {
	if ( columns.length === 0 || insertionIndex < 0 || insertionIndex > columns.length ) {
		return null;
	}
	if ( insertionIndex === columns.length ) {
		return columns[ columns.length - 1 ].getBoundingClientRect().right;
	}
	return columns[ insertionIndex ].getBoundingClientRect().left;
};

const getHorizontalScrollContainer = ( view: Window, target: Element ): HTMLElement | null => {
	const { body, documentElement } = target.ownerDocument;
	let ancestor = target.parentElement;
	while ( ancestor ) {
		if ( ancestor !== body && ancestor !== documentElement ) {
			const overflowX = view.getComputedStyle( ancestor ).overflowX;
			if (
				( overflowX === 'auto' || overflowX === 'scroll' ) &&
				ancestor.scrollWidth > ancestor.clientWidth
			) {
				return ancestor;
			}
		}
		ancestor = ancestor.parentElement;
	}
	return null;
};

/** 有効な column boundary へ click target を追加する。 */
export const createColumnMoveTargets = (
	document: Document,
	table: HTMLTableElement,
	columns: readonly HTMLTableCellElement[],
	targets: readonly ColumnMoveTarget[],
	options: ColumnMoveTargetsOptions
): ColumnMoveTargetsUi => {
	const view = document.defaultView;
	const buttons: HTMLButtonElement[] = [];
	const cleanupListeners: Array< () => void > = [];

	for ( const target of targets ) {
		const button = document.createElement( 'button' );
		button.className = DESTINATION_CLASS;
		button.type = 'button';
		button.contentEditable = 'false';
		button.dataset.insertionIndex = String( target.insertionIndex );
		button.dataset.newIndex = String( target.newIndex );
		button.setAttribute(
			'aria-label',
			target.insertionIndex >= columns.length
				? getColumnDestinationEndName()
				: getColumnDestinationBeforeName( target.insertionIndex + 1 )
		);

		let pointerStart: { pointerId: number; x: number; y: number } | null = null;
		let suppressNextClick = false;
		const onPointerDown = ( event: PointerEvent ) => {
			if ( event.pointerType === 'mouse' ) {
				return;
			}
			pointerStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
			suppressNextClick = false;
		};
		const onPointerMove = ( event: PointerEvent ) => {
			if ( ! pointerStart || event.pointerId !== pointerStart.pointerId ) {
				return;
			}
			if (
				Math.hypot( event.clientX - pointerStart.x, event.clientY - pointerStart.y ) >
				POINTER_TAP_THRESHOLD_PX
			) {
				suppressNextClick = true;
			}
		};
		const onPointerEnd = ( event: PointerEvent ) => {
			if ( pointerStart?.pointerId === event.pointerId ) {
				pointerStart = null;
			}
		};
		const onPointerCancel = ( event: PointerEvent ) => {
			if ( pointerStart?.pointerId === event.pointerId ) {
				suppressNextClick = true;
				pointerStart = null;
			}
		};
		const onClick = ( event: MouseEvent ) => {
			event.preventDefault();
			event.stopPropagation();
			if ( suppressNextClick ) {
				suppressNextClick = false;
				return;
			}
			options.onSelect( target.newIndex );
		};

		button.addEventListener( 'pointerdown', onPointerDown );
		button.addEventListener( 'pointermove', onPointerMove );
		button.addEventListener( 'pointerup', onPointerEnd );
		button.addEventListener( 'pointercancel', onPointerCancel );
		button.addEventListener( 'click', onClick );
		cleanupListeners.push( () => {
			button.removeEventListener( 'pointerdown', onPointerDown );
			button.removeEventListener( 'pointermove', onPointerMove );
			button.removeEventListener( 'pointerup', onPointerEnd );
			button.removeEventListener( 'pointercancel', onPointerCancel );
			button.removeEventListener( 'click', onClick );
		} );
		document.body.append( button );
		buttons.push( button );
	}

	const updatePositions = () => {
		if ( ! view ) {
			return;
		}
		const tableRect = table.getBoundingClientRect();
		const scrollContainer = getHorizontalScrollContainer( view, table );
		const containerRect = scrollContainer?.getBoundingClientRect();
		const visibleLeft = Math.max( containerRect?.left ?? 0, 0 );
		const visibleRight = Math.min( containerRect?.right ?? view.innerWidth, view.innerWidth );
		const top = Math.max( tableRect.top, 0 );
		const bottom = Math.min( tableRect.bottom, view.innerHeight );

		for ( const [ index, target ] of targets.entries() ) {
			const button = buttons[ index ];
			const boundaryX = getBoundaryX( columns, target.insertionIndex );
			const isVisible =
				boundaryX !== null && boundaryX >= visibleLeft && boundaryX <= visibleRight && bottom > top;
			button.style.display = isVisible ? '' : 'none';
			if ( ! isVisible || boundaryX === null ) {
				continue;
			}
			button.style.left = `${ boundaryX }px`;
			button.style.top = `${ top }px`;
			button.style.height = `${ bottom - top }px`;
		}
	};

	updatePositions();
	view?.addEventListener( 'resize', updatePositions );
	view?.addEventListener( 'scroll', updatePositions, true );

	return {
		cleanup: () => {
			view?.removeEventListener( 'resize', updatePositions );
			view?.removeEventListener( 'scroll', updatePositions, true );
			for ( const cleanupListener of cleanupListeners ) {
				cleanupListener();
			}
			for ( const button of buttons ) {
				button.remove();
			}
		},
	};
};
