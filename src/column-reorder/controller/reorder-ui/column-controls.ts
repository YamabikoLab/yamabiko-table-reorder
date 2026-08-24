import { getColumnControlDescription, getColumnControlName } from '../../messages';

/** Column handle button に付与する class。 */
export const COLUMN_HANDLE_ZONE_CLASS = 'yamabiko-table-reorder-column-handle-zone';

const HANDLE_CLASS = 'yamabiko-table-reorder-column-handle';
const DESCRIPTION_CLASS = 'yamabiko-table-reorder-column-description';
const HANDLE_GUTTER_PX = 32;

let descriptionSequence = 0;

/** 1列分の control と、その列に属する cell 群。 */
export type ColumnControlEntry = {
	cells: HTMLTableCellElement[];
	columnIndex: number;
	control: HTMLButtonElement;
	setPressed: ( isPressed: boolean ) => void;
};

/** Column control 群の UI lifecycle。 */
export type ColumnControls = {
	cleanup: () => void;
	entries: ColumnControlEntry[];
	setVisible: ( entry: ColumnControlEntry, isVisible: boolean ) => void;
};

/**
 * 結合セルのない table の各 physical column に control を追加する。
 *
 * control は代表 cell 内に置くため table の horizontal scroll と同じ座標系で動く。通常時は視覚的に
 * 隠し、controller から hover / focus / active column だけを表示する。
 */
export const createColumnControls = (
	document: Document,
	table: HTMLTableElement,
	columns: readonly HTMLTableCellElement[]
): ColumnControls => {
	const view = document.defaultView;
	const entries: ColumnControlEntry[] = [];
	const changedCells: Array< {
		cell: HTMLTableCellElement;
		paddingBlockStart: string;
		position: string;
	} > = [];

	for ( const [ columnIndex, representativeCell ] of columns.entries() ) {
		const computedStyle = view?.getComputedStyle( representativeCell );
		changedCells.push( {
			cell: representativeCell,
			paddingBlockStart: representativeCell.style.paddingBlockStart,
			position: representativeCell.style.position,
		} );

		if ( computedStyle?.position === 'static' ) {
			representativeCell.style.position = 'relative';
		}
		representativeCell.style.paddingBlockStart = computedStyle
			? `calc(${ computedStyle.paddingBlockStart } + ${ HANDLE_GUTTER_PX }px)`
			: `${ HANDLE_GUTTER_PX }px`;

		descriptionSequence += 1;
		const descriptionId = `yamabiko-table-reorder-column-description-${ descriptionSequence }`;
		const control = document.createElement( 'button' );
		control.className = COLUMN_HANDLE_ZONE_CLASS;
		control.type = 'button';
		control.contentEditable = 'false';
		control.tabIndex = 0;
		control.dataset.columnIndex = String( columnIndex );
		control.dataset.visible = 'false';
		control.setAttribute( 'aria-describedby', descriptionId );
		control.setAttribute( 'aria-label', getColumnControlName( columnIndex + 1 ) );
		control.setAttribute( 'aria-pressed', 'false' );

		const handle = document.createElement( 'span' );
		handle.className = HANDLE_CLASS;
		handle.setAttribute( 'aria-hidden', 'true' );
		handle.textContent = '⋮⋮';
		control.append( handle );

		const description = document.createElement( 'span' );
		description.className = DESCRIPTION_CLASS;
		description.id = descriptionId;
		description.textContent = getColumnControlDescription();
		control.append( description );
		representativeCell.prepend( control );

		const cells = Array.from( table.rows )
			.map( ( row ) => row.cells.item( columnIndex ) )
			.filter( ( cell ): cell is HTMLTableCellElement => cell !== null );
		entries.push( {
			cells,
			columnIndex,
			control,
			setPressed: ( isPressed ) => {
				control.setAttribute( 'aria-pressed', isPressed ? 'true' : 'false' );
			},
		} );
	}

	const setVisible = ( entry: ColumnControlEntry, isVisible: boolean ) => {
		if ( isVisible ) {
			for ( const otherEntry of entries ) {
				if ( otherEntry !== entry ) {
					otherEntry.control.dataset.visible = 'false';
				}
			}
		}
		entry.control.dataset.visible = isVisible ? 'true' : 'false';
	};

	return {
		entries,
		setVisible,
		cleanup: () => {
			for ( const entry of entries ) {
				entry.control.remove();
			}
			for ( const { cell, paddingBlockStart, position } of changedCells ) {
				cell.style.paddingBlockStart = paddingBlockStart;
				cell.style.position = position;
			}
		},
	};
};

/** Column control 操作が Gutenberg 側へ伝播しないよう停止する。 */
export const stopColumnControlInteractionPropagation = ( event: Event ) => {
	const target = event.target as Element | null;
	if ( target?.closest?.( `.${ COLUMN_HANDLE_ZONE_CLASS }` ) ) {
		event.stopPropagation();
	}
};
