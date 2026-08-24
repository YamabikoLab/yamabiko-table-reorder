const KEYBOARD_SCROLL_MARGIN_PX = 24;

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

/** Keyboard destination が見えるために必要な最小量だけ横 scroll する。 */
export const scrollColumnDestinationIntoView = (
	view: Window,
	table: HTMLTableElement,
	columns: readonly HTMLTableCellElement[],
	insertionIndex: number
) => {
	const currentX = getBoundaryX( columns, insertionIndex );
	if ( currentX === null ) {
		return;
	}

	const scrollContainer = getHorizontalScrollContainer( view, table );
	const containerRect = scrollContainer?.getBoundingClientRect();
	const viewportLeft = Math.max( containerRect?.left ?? 0, 0 );
	const viewportRight = Math.min( containerRect?.right ?? view.innerWidth, view.innerWidth );
	if ( viewportRight - viewportLeft <= KEYBOARD_SCROLL_MARGIN_PX * 2 ) {
		return;
	}

	const lowerBound = viewportLeft + KEYBOARD_SCROLL_MARGIN_PX;
	const upperBound = viewportRight - KEYBOARD_SCROLL_MARGIN_PX;
	let delta = 0;
	if ( currentX < lowerBound ) {
		delta = currentX - lowerBound;
	} else if ( currentX > upperBound ) {
		delta = currentX - upperBound;
	}

	if ( Math.abs( delta ) < 1 ) {
		return;
	}
	if ( scrollContainer ) {
		scrollContainer.scrollBy( { behavior: 'auto', left: delta, top: 0 } );
	} else {
		view.scrollBy( { behavior: 'auto', left: delta, top: 0 } );
	}
};
