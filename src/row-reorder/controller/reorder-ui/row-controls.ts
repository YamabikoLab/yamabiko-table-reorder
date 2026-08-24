import { Tooltip } from '@wordpress/components';
import { createElement, createRoot, flushSync } from '@wordpress/element';
import { dragHandle, Icon } from '@wordpress/icons';

import {
	getEmptyRowLabel,
	getKeyboardHandleTooltip,
	getPointerHandleTooltip,
	getRowControlKeyboardDescription,
	getRowControlName,
	getRowControlPointerDescription,
} from '@/row-reorder/messages';
import type { TableContext } from '@/row-reorder/table-context';

/** 行control本体に付与するclass。SortableJSのhandle selectorとしても利用する。 */
export const HANDLE_ZONE_CLASS = 'yamabiko-table-reorder-handle-zone';

/** 行control内のdrag handle表示に付与するclass。 */
const HANDLE_CLASS = 'yamabiko-table-reorder-handle';

/** 支援技術向け説明文に付与するclass。 */
const DESCRIPTION_CLASS = 'yamabiko-table-reorder-description';

/** 行control用に先頭cellへ確保するinline方向の幅。 */
const HANDLE_GUTTER_PX = 32;

/** touch reorder modeで先頭cell本文に確保する最小幅。 */
const MIN_FIRST_COLUMN_CONTENT_WIDTH_PX = 32;

/** accessible nameへ含める代表情報の最大文字数。 */
const MAX_ROW_LABEL_LENGTH = 80;

/** viewport外でもcontrolを先読みして保持する上下余白。 */
const VIEWPORT_OVERSCAN_PX = 600;

/** 行controlの説明要素へ一意なIDを割り当てるための連番。 */
let descriptionSequence = 0;

type CellStyleSnapshot = {
	cell: HTMLTableCellElement;
	paddingInlineStart: string;
	position: string;
};

type PoolSlot = {
	control: HTMLButtonElement;
	mount: HTMLSpanElement;
	root: ReturnType< typeof createRoot >;
	pointerDescriptionId: string;
	keyboardDescriptionId: string;
	row: HTMLTableRowElement | null;
	cellStyle: CellStyleSnapshot | null;
	isPinned: boolean;
	isPressed: boolean;
	isVisible: boolean;
	useKeyboardDescription: boolean;
	rowControlName: string;
	render: () => void;
};

/** viewport周辺のpooled row controlを操作する最小API。 */
export type RowControls = {
	ensureControl: ( row: HTMLTableRowElement ) => HTMLButtonElement | null;
	setVisible: ( control: HTMLButtonElement, isVisible: boolean ) => void;
	setPressed: ( control: HTMLButtonElement, isPressed: boolean ) => void;
	pin: ( control: HTMLButtonElement ) => void;
	unpin: ( control: HTMLButtonElement ) => void;
	cleanup: () => void;
};

/** 行control生成時の表示mode。 */
type RowControlOptions = {
	showAll: boolean;
};

/**
 * 行内容からaccessible nameへ使う短い代表情報を返す。
 *
 * 先頭から最初の空でないcell内容を採用し、空行では基本設計の翻訳対象fallbackを返す。
 * 既にTable Reorderのcontrolが存在する場合は、その一時DOMを代表情報へ含めない。
 *
 * @param row 代表情報を取得する本文行。
 * @return 行内容の代表情報。
 */
export const getRowRepresentativeText = ( row: HTMLTableRowElement ): string => {
	for ( const cell of Array.from( row.cells ) ) {
		const clone = cell.cloneNode( true ) as HTMLTableCellElement;
		clone.querySelectorAll( `.${ HANDLE_ZONE_CLASS }` ).forEach( ( control ) => control.remove() );
		const text = clone.textContent?.replace( /\s+/g, ' ' ).trim() ?? '';
		if ( ! text ) {
			continue;
		}

		if ( text.length <= MAX_ROW_LABEL_LENGTH ) {
			return text;
		}

		return `${ text.slice( 0, MAX_ROW_LABEL_LENGTH - 1 ) }…`;
	}

	return getEmptyRowLabel();
};

/**
 * viewport周辺の移動可能行へpooled row controlをbindする。
 *
 * pool slotはReact root / control DOM / description IDだけを長寿命で保持し、row / cell参照はbind中だけ
 * 保持する。scroll / resizeは現在のTableContextに属するdocument / windowから検知し、同一frame内の
 * 再同期を1回へまとめる。
 *
 * @param context              解決済みTable context。
 * @param nonMovableRowIndices controlを作成しない行index。
 * @param options              controlの表示mode。
 * @return pooled row control API。
 */
export const createRowControls = (
	context: TableContext,
	nonMovableRowIndices: readonly number[],
	options: RowControlOptions
): RowControls => {
	const { document, tbody, window: view } = context;
	const nonMovableRows = new Set( nonMovableRowIndices );
	const slots: PoolSlot[] = [];
	const slotByRow = new Map< HTMLTableRowElement, PoolSlot >();
	const slotByControl = new Map< HTMLButtonElement, PoolSlot >();
	const table = tbody.closest< HTMLTableElement >( 'table' );
	const overflowContainer = table?.parentElement ?? null;
	const sizingCell = table?.rows.item( 0 )?.cells.item( 0 ) ?? null;
	const originalTableMinWidth = table?.style.minWidth ?? '';
	const originalSizingCellWidth = sizingCell?.style.width ?? '';
	const originalOverflowX = overflowContainer?.style.overflowX ?? '';
	let pendingFrame: number | null = null;
	let cleanedUp = false;

	if ( options.showAll && table && overflowContainer && sizingCell ) {
		const tableWidth = table.getBoundingClientRect().width;
		const firstColumnWidth = sizingCell.getBoundingClientRect().width;
		const requiredFirstColumnWidth = HANDLE_GUTTER_PX + MIN_FIRST_COLUMN_CONTENT_WIDTH_PX;
		const extraWidth = Math.max( 0, requiredFirstColumnWidth - firstColumnWidth );

		if ( extraWidth > 0 ) {
			overflowContainer.style.overflowX = 'auto';
			table.style.minWidth = `${ tableWidth + extraWidth }px`;
			sizingCell.style.width = `${ firstColumnWidth + extraWidth }px`;
		}
	}

	const isMovableRow = ( row: HTMLTableRowElement ) => {
		const rowIndex = row.sectionRowIndex;
		return row.parentElement === tbody && rowIndex >= 0 && ! nonMovableRows.has( rowIndex );
	};

	const restoreCellStyle = ( slot: PoolSlot ) => {
		if ( ! slot.cellStyle ) {
			return;
		}
		const { cell, paddingInlineStart, position } = slot.cellStyle;
		cell.style.paddingInlineStart = paddingInlineStart;
		cell.style.position = position;
		slot.cellStyle = null;
	};

	const syncDescription = ( slot: PoolSlot ) => {
		const descriptionId = slot.useKeyboardDescription
			? slot.keyboardDescriptionId
			: options.showAll
				? undefined
				: slot.pointerDescriptionId;
		if ( slot.isPressed || ! descriptionId ) {
			slot.control.removeAttribute( 'aria-describedby' );
		} else {
			slot.control.setAttribute( 'aria-describedby', descriptionId );
		}
	};

	const createSlot = (): PoolSlot => {
		descriptionSequence += 1;
		const descriptionBaseId = `yamabiko-table-reorder-description-${ descriptionSequence }`;
		const pointerDescriptionId = `${ descriptionBaseId }-pointer`;
		const keyboardDescriptionId = `${ descriptionBaseId }-keyboard`;
		const mount = document.createElement( 'span' );
		mount.style.display = 'contents';
		const root = createRoot( mount );
		const slot = {
			control: null as unknown as HTMLButtonElement,
			mount,
			root,
			pointerDescriptionId,
			keyboardDescriptionId,
			row: null,
			cellStyle: null,
			isPinned: false,
			isPressed: false,
			isVisible: options.showAll,
			useKeyboardDescription: false,
			rowControlName: '',
			render: () => undefined,
		} satisfies PoolSlot;

		slot.render = () => {
			const tooltipText = slot.useKeyboardDescription
				? getKeyboardHandleTooltip()
				: options.showAll
					? undefined
					: getPointerHandleTooltip();
			const anchor = createElement(
				'button',
				{
					'aria-label': slot.rowControlName,
					'aria-pressed': slot.isPressed,
					className: HANDLE_ZONE_CLASS,
					contentEditable: false,
					tabIndex: 0,
					type: 'button',
				},
				createElement(
					'span',
					{
						'aria-hidden': true,
						className: HANDLE_CLASS,
					},
					createElement( Icon, {
						icon: dragHandle,
						size: 20,
					} )
				),
				createElement(
					'span',
					{
						className: DESCRIPTION_CLASS,
						id: pointerDescriptionId,
					},
					getRowControlPointerDescription()
				),
				createElement(
					'span',
					{
						className: DESCRIPTION_CLASS,
						id: keyboardDescriptionId,
					},
					getRowControlKeyboardDescription()
				)
			);
			root.render(
				createElement( Tooltip, {
					children: anchor,
					text: slot.isPressed ? undefined : tooltipText,
				} )
			);
		};

		flushSync( slot.render );
		const control = mount.querySelector< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` );
		if ( ! control ) {
			root.unmount();
			throw new Error( 'Failed to create row control' );
		}
		slot.control = control;
		control.dataset.visible = options.showAll ? 'true' : 'false';
		control.addEventListener( 'focus', () => {
			slot.useKeyboardDescription = true;
			syncDescription( slot );
			slot.render();
		} );
		control.addEventListener( 'blur', () => {
			slot.useKeyboardDescription = false;
			syncDescription( slot );
			slot.render();
		} );
		slotByControl.set( control, slot );
		slots.push( slot );
		return slot;
	};

	const unbind = ( slot: PoolSlot ) => {
		if ( slot.row ) {
			slotByRow.delete( slot.row );
		}
		restoreCellStyle( slot );
		slot.mount.remove();
		slot.row = null;
		slot.isPressed = false;
		slot.isVisible = options.showAll;
		slot.useKeyboardDescription = false;
		slot.rowControlName = '';
		slot.control.dataset.visible = options.showAll ? 'true' : 'false';
		flushSync( slot.render );
		syncDescription( slot );
	};

	const bind = ( slot: PoolSlot, row: HTMLTableRowElement ) => {
		const firstCell = row.cells.item( 0 );
		if ( ! firstCell ) {
			return null;
		}
		if ( slot.row ) {
			unbind( slot );
		}

		const rowIndex = row.sectionRowIndex;
		const rowLabel = getRowRepresentativeText( row );
		const computedStyle = view.getComputedStyle( firstCell );
		slot.cellStyle = {
			cell: firstCell,
			paddingInlineStart: firstCell.style.paddingInlineStart,
			position: firstCell.style.position,
		};
		if ( computedStyle.position === 'static' ) {
			firstCell.style.position = 'relative';
		}
		firstCell.style.paddingInlineStart = `calc(${ computedStyle.paddingInlineStart } + ${ HANDLE_GUTTER_PX }px)`;

		slot.row = row;
		slot.isPressed = false;
		slot.isVisible = options.showAll;
		slot.useKeyboardDescription = false;
		slot.rowControlName = getRowControlName( rowIndex + 1, rowLabel );
		slot.control.dataset.visible = options.showAll ? 'true' : 'false';
		flushSync( slot.render );
		syncDescription( slot );
		firstCell.prepend( slot.mount );
		slotByRow.set( row, slot );
		return slot.control;
	};

	const acquireSlot = () => slots.find( ( slot ) => ! slot.row && ! slot.isPinned ) ?? createSlot();

	const ensureControl = ( row: HTMLTableRowElement ): HTMLButtonElement | null => {
		if ( cleanedUp || ! isMovableRow( row ) || ! row.cells.item( 0 ) ) {
			return null;
		}
		const existing = slotByRow.get( row );
		if ( existing ) {
			return existing.control;
		}
		return bind( acquireSlot(), row );
	};

	const collectNearbyRows = () => {
		const viewportTop = -VIEWPORT_OVERSCAN_PX;
		const viewportBottom = view.innerHeight + VIEWPORT_OVERSCAN_PX;
		return Array.from( tbody.rows ).filter( ( row ) => {
			if ( ! isMovableRow( row ) || ! row.cells.item( 0 ) ) {
				return false;
			}
			const rect = row.getBoundingClientRect();
			return rect.bottom >= viewportTop && rect.top <= viewportBottom;
		} );
	};

	const syncControls = () => {
		if ( cleanedUp ) {
			return;
		}
		const nearbyRows = collectNearbyRows();
		const desiredRows = new Set( nearbyRows );

		for ( const slot of slots ) {
			if ( slot.row && ! slot.isPinned && ! desiredRows.has( slot.row ) ) {
				unbind( slot );
			}
		}
		for ( const row of nearbyRows ) {
			ensureControl( row );
		}
	};

	const scheduleSync = () => {
		if ( cleanedUp || pendingFrame !== null ) {
			return;
		}
		pendingFrame = view.requestAnimationFrame( () => {
			pendingFrame = null;
			syncControls();
		} );
	};

	const setVisible = ( control: HTMLButtonElement, isVisible: boolean ) => {
		const slot = slotByControl.get( control );
		if ( ! slot?.row ) {
			return;
		}
		if ( isVisible && ! options.showAll ) {
			for ( const otherSlot of slots ) {
				if ( otherSlot !== slot && otherSlot.row ) {
					otherSlot.isVisible = false;
					otherSlot.control.dataset.visible = 'false';
				}
			}
		}
		slot.isVisible = isVisible;
		control.dataset.visible = isVisible ? 'true' : 'false';
	};

	const setPressed = ( control: HTMLButtonElement, isPressed: boolean ) => {
		const slot = slotByControl.get( control );
		if ( ! slot?.row || slot.isPressed === isPressed ) {
			return;
		}
		slot.isPressed = isPressed;
		flushSync( slot.render );
		syncDescription( slot );
	};

	const pin = ( control: HTMLButtonElement ) => {
		const slot = slotByControl.get( control );
		if ( slot?.row ) {
			slot.isPinned = true;
		}
	};

	const unpin = ( control: HTMLButtonElement ) => {
		const slot = slotByControl.get( control );
		if ( ! slot ) {
			return;
		}
		slot.isPinned = false;
		scheduleSync();
	};

	const onScroll = () => scheduleSync();
	const onResize = () => scheduleSync();
	document.addEventListener( 'scroll', onScroll, true );
	view.addEventListener( 'resize', onResize );
	syncControls();

	const cleanup = () => {
		if ( cleanedUp ) {
			return;
		}
		cleanedUp = true;
		document.removeEventListener( 'scroll', onScroll, true );
		view.removeEventListener( 'resize', onResize );
		if ( pendingFrame !== null ) {
			view.cancelAnimationFrame( pendingFrame );
			pendingFrame = null;
		}
		for ( const slot of slots ) {
			unbind( slot );
			slot.root.unmount();
		}
		slotByRow.clear();
		slotByControl.clear();
		if ( table ) {
			table.style.minWidth = originalTableMinWidth;
		}
		if ( sizingCell ) {
			sizingCell.style.width = originalSizingCellWidth;
		}
		if ( overflowContainer ) {
			overflowContainer.style.overflowX = originalOverflowX;
		}
	};

	return { ensureControl, setVisible, setPressed, pin, unpin, cleanup };
};

/**
 * 行control上のeventがGutenberg側へ伝播しないよう停止する。
 *
 * native button自身のfocus / click既定動作は維持し、Table ReorderのcontrollerとSortableJSが
 * 同じcontrolを操作入口として扱えるよう`preventDefault()`は行わない。
 *
 * @param event 行control操作か判定するDOM event。
 */
export const stopRowControlInteractionPropagation = ( event: Event ) => {
	const target = event.target as Element | null;
	if ( target?.closest?.( `.${ HANDLE_ZONE_CLASS }` ) ) {
		event.stopPropagation();
	}
};
