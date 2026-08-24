const GUIDANCE_CLASS = 'yamabiko-table-reorder-column-guidance';
const GUIDANCE_HIDDEN_CLASS = 'is-hidden';

/** Column reorder 操作中案内の lifecycle。 */
export type ColumnReorderGuidanceUi = {
	cleanup: () => void;
};

/** Table に関連付く操作中案内を owning document へ追加する。 */
export const createColumnReorderGuidance = (
	document: Document,
	table: HTMLTableElement,
	message: string
): ColumnReorderGuidanceUi => {
	const view = document.defaultView;
	const guidance = document.createElement( 'div' );
	guidance.className = GUIDANCE_CLASS;
	guidance.contentEditable = 'false';
	guidance.textContent = message;
	document.body.append( guidance );

	const updateVisibility = () => {
		if ( ! view ) {
			return;
		}
		const tableRect = table.getBoundingClientRect();
		const isVisible =
			tableRect.bottom > 0 &&
			tableRect.top < view.innerHeight &&
			tableRect.right > 0 &&
			tableRect.left < view.innerWidth;
		guidance.classList.toggle( GUIDANCE_HIDDEN_CLASS, ! isVisible );
	};

	updateVisibility();
	view?.addEventListener( 'resize', updateVisibility );
	view?.addEventListener( 'scroll', updateVisibility, true );

	return {
		cleanup: () => {
			view?.removeEventListener( 'resize', updateVisibility );
			view?.removeEventListener( 'scroll', updateVisibility, true );
			guidance.remove();
		},
	};
};
