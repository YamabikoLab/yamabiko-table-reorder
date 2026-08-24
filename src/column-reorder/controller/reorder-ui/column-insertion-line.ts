const INSERTION_LINE_CLASS = 'yamabiko-table-reorder-column-insertion-line';

/** 垂直 insertion line の UI lifecycle。 */
export type ColumnInsertionLine = {
	cleanup: () => void;
	hide: () => void;
	show: ( insertionIndex: number ) => void;
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

/** Table の column boundary に垂直 insertion line を表示する。 */
export const createColumnInsertionLine = (
	document: Document,
	table: HTMLTableElement,
	columns: readonly HTMLTableCellElement[]
): ColumnInsertionLine => {
	const view = document.defaultView;
	const line = document.createElement( 'div' );
	line.className = INSERTION_LINE_CLASS;
	line.setAttribute( 'aria-hidden', 'true' );
	line.hidden = true;
	document.body.append( line );
	let currentInsertionIndex: number | null = null;

	const updatePosition = () => {
		if ( currentInsertionIndex === null || ! view ) {
			return;
		}
		const boundaryX = getBoundaryX( columns, currentInsertionIndex );
		if ( boundaryX === null ) {
			line.style.visibility = 'hidden';
			return;
		}

		const tableRect = table.getBoundingClientRect();
		const scrollContainer = getHorizontalScrollContainer( view, table );
		const containerRect = scrollContainer?.getBoundingClientRect();
		const visibleLeft = Math.max( containerRect?.left ?? 0, 0 );
		const visibleRight = Math.min( containerRect?.right ?? view.innerWidth, view.innerWidth );
		const top = Math.max( tableRect.top, 0 );
		const bottom = Math.min( tableRect.bottom, view.innerHeight );
		if ( boundaryX < visibleLeft || boundaryX > visibleRight || bottom <= top ) {
			line.style.visibility = 'hidden';
			return;
		}

		line.style.left = `${ boundaryX }px`;
		line.style.top = `${ top }px`;
		line.style.height = `${ bottom - top }px`;
		line.style.visibility = 'visible';
	};

	view?.addEventListener( 'resize', updatePosition );
	view?.addEventListener( 'scroll', updatePosition, true );

	return {
		show: ( insertionIndex ) => {
			currentInsertionIndex = insertionIndex;
			line.dataset.insertionIndex = String( insertionIndex );
			line.hidden = false;
			updatePosition();
		},
		hide: () => {
			currentInsertionIndex = null;
			delete line.dataset.insertionIndex;
			line.hidden = true;
		},
		cleanup: () => {
			view?.removeEventListener( 'resize', updatePosition );
			view?.removeEventListener( 'scroll', updatePosition, true );
			line.remove();
		},
	};
};
