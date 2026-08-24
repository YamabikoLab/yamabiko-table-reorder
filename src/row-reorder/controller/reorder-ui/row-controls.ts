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

/** 通常scrollでviewport windowを補充し直すoverscan余白。 */
const VIEWPORT_REFILL_THRESHOLD_PX = VIEWPORT_OVERSCAN_PX / 2;

/** 行controlの説明要素へ一意なIDを割り当てるための連番。 */
let descriptionSequence = 0;

type CellStyleSnapshot = {
	cell: HTMLTableCellElement;
	paddingInlineStart: string;
	position: string;
};

type RowBindingMeasurement = {
	cellStyle: CellStyleSnapshot;
	computedPaddingInlineStart: string;
	computedPosition: string;
	firstCell: HTMLTableCellElement;
	row: HTMLTableRowElement;
	rowControlName: string;
};

type PoolSlot = {
	control: HTMLButtonElement | null;
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

type ViewportWindow = {
	firstIndex: number;
	firstRow: HTMLTableRowElement;
	lastIndex: number;
	lastRow: HTMLTableRowElement;
};

type ViewportBounds = {
	top: number;
	bottom: number;
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
 * 保持する。viewport windowはpinned / on-demand bindingと分離し、通常scrollではwindow境界だけを
 * incrementalに更新する。初期化、大きなscroll jump、resizeでは二分探索でanchorを再解決する。
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
	const viewportRows = new Set< HTMLTableRowElement >();
	const table = tbody.closest< HTMLTableElement >( 'table' );
	const overflowContainer = table?.parentElement ?? null;
	const sizingCell = table?.rows.item( 0 )?.cells.item( 0 ) ?? null;
	const originalTableMinWidth = table?.style.minWidth ?? '';
	const originalSizingCellWidth = sizingCell?.style.width ?? '';
	const originalOverflowX = overflowContainer?.style.overflowX ?? '';
	let viewportWindow: ViewportWindow | null = null;
	let pendingFrame: number | null = null;
	let forceReanchor = true;
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
		const control = slot.control;
		if ( ! control ) {
			return;
		}
		let descriptionId: string | undefined;
		if ( slot.useKeyboardDescription ) {
			descriptionId = slot.keyboardDescriptionId;
		} else if ( ! options.showAll ) {
			descriptionId = slot.pointerDescriptionId;
		}
		if ( slot.isPressed || ! descriptionId ) {
			control.removeAttribute( 'aria-describedby' );
		} else {
			control.setAttribute( 'aria-describedby', descriptionId );
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
		const slot: PoolSlot = {
			control: null,
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
		};

		slot.render = () => {
			let tooltipText: string | undefined;
			if ( slot.useKeyboardDescription ) {
				tooltipText = getKeyboardHandleTooltip();
			} else if ( ! options.showAll ) {
				tooltipText = getPointerHandleTooltip();
			}
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

		slots.push( slot );
		return slot;
	};

	const initializeControl = ( slot: PoolSlot ): HTMLButtonElement => {
		if ( slot.control ) {
			return slot.control;
		}
		const control = slot.mount.querySelector< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` );
		if ( ! control ) {
			slot.root.unmount();
			throw new Error( 'Failed to create row control' );
		}
		slot.control = control;
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
		return control;
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
		if ( slot.control ) {
			slot.control.dataset.visible = options.showAll ? 'true' : 'false';
		}
	};

	const measureRowBinding = ( row: HTMLTableRowElement ): RowBindingMeasurement | null => {
		const firstCell = row.cells.item( 0 );
		if ( ! firstCell ) {
			return null;
		}
		const rowIndex = row.sectionRowIndex;
		const rowLabel = getRowRepresentativeText( row );
		const computedStyle = view.getComputedStyle( firstCell );
		return {
			cellStyle: {
				cell: firstCell,
				paddingInlineStart: firstCell.style.paddingInlineStart,
				position: firstCell.style.position,
			},
			computedPaddingInlineStart: computedStyle.paddingInlineStart,
			computedPosition: computedStyle.position,
			firstCell,
			row,
			rowControlName: getRowControlName( rowIndex + 1, rowLabel ),
		};
	};

	const bindMeasured = ( slot: PoolSlot, measurement: RowBindingMeasurement ) => {
		if ( slot.row ) {
			unbind( slot );
		}
		const {
			cellStyle,
			computedPaddingInlineStart,
			computedPosition,
			firstCell,
			row,
			rowControlName,
		} = measurement;
		slot.cellStyle = cellStyle;
		if ( computedPosition === 'static' ) {
			firstCell.style.position = 'relative';
		}
		firstCell.style.paddingInlineStart = `calc(${ computedPaddingInlineStart } + ${ HANDLE_GUTTER_PX }px)`;

		slot.row = row;
		slot.isPressed = false;
		slot.isVisible = options.showAll;
		slot.useKeyboardDescription = false;
		slot.rowControlName = rowControlName;
		flushSync( slot.render );
		const control = initializeControl( slot );
		control.dataset.visible = options.showAll ? 'true' : 'false';
		syncDescription( slot );
		firstCell.prepend( slot.mount );
		slotByRow.set( row, slot );
		return control;
	};

	const bind = ( slot: PoolSlot, row: HTMLTableRowElement ) => {
		const measurement = measureRowBinding( row );
		return measurement ? bindMeasured( slot, measurement ) : null;
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

	const getViewportBounds = ( overscanPx = VIEWPORT_OVERSCAN_PX ): ViewportBounds => ( {
		top: -overscanPx,
		bottom: view.innerHeight + overscanPx,
	} );

	const findAnchorIndex = (): number | null => {
		const rowCount = tbody.rows.length;
		if ( rowCount === 0 ) {
			return null;
		}

		let low = 0;
		let high = rowCount - 1;
		let anchorIndex = rowCount - 1;
		while ( low <= high ) {
			const middle = Math.floor( ( low + high ) / 2 );
			const row = tbody.rows.item( middle );
			if ( ! row ) {
				break;
			}
			if ( row.getBoundingClientRect().bottom >= 0 ) {
				anchorIndex = middle;
				high = middle - 1;
			} else {
				low = middle + 1;
			}
		}
		return anchorIndex;
	};

	const resolveViewportWindowWithBinarySearch = (): ViewportWindow | null => {
		const anchorIndex = findAnchorIndex();
		if ( anchorIndex === null ) {
			return null;
		}
		const bounds = getViewportBounds();
		let firstIndex = anchorIndex;
		let lastIndex = anchorIndex;

		while ( firstIndex > 0 ) {
			const previousRow = tbody.rows.item( firstIndex - 1 );
			if ( ! previousRow || previousRow.getBoundingClientRect().bottom < bounds.top ) {
				break;
			}
			firstIndex -= 1;
		}
		while ( lastIndex < tbody.rows.length - 1 ) {
			const nextRow = tbody.rows.item( lastIndex + 1 );
			if ( ! nextRow || nextRow.getBoundingClientRect().top > bounds.bottom ) {
				break;
			}
			lastIndex += 1;
		}
		while ( firstIndex <= lastIndex ) {
			const firstRow = tbody.rows.item( firstIndex );
			if ( ! firstRow || firstRow.getBoundingClientRect().bottom >= bounds.top ) {
				break;
			}
			firstIndex += 1;
		}
		while ( firstIndex <= lastIndex ) {
			const lastRow = tbody.rows.item( lastIndex );
			if ( ! lastRow || lastRow.getBoundingClientRect().top <= bounds.bottom ) {
				break;
			}
			lastIndex -= 1;
		}
		if ( firstIndex > lastIndex ) {
			return null;
		}
		const firstRow = tbody.rows.item( firstIndex );
		const lastRow = tbody.rows.item( lastIndex );
		if ( ! firstRow || ! lastRow ) {
			return null;
		}
		return { firstIndex, firstRow, lastIndex, lastRow };
	};

	const isViewportWindowValid = ( currentWindow: ViewportWindow ) =>
		currentWindow.firstRow.parentElement === tbody &&
		currentWindow.lastRow.parentElement === tbody &&
		currentWindow.firstRow.sectionRowIndex === currentWindow.firstIndex &&
		currentWindow.lastRow.sectionRowIndex === currentWindow.lastIndex;

	const removeViewportRow = ( row: HTMLTableRowElement ) => {
		viewportRows.delete( row );
		const slot = slotByRow.get( row );
		if ( slot && ! slot.isPinned ) {
			unbind( slot );
		}
	};

	const applyViewportWindow = ( nextWindow: ViewportWindow | null ) => {
		const nextViewportRows = new Set< HTMLTableRowElement >();
		if ( nextWindow ) {
			for ( let index = nextWindow.firstIndex; index <= nextWindow.lastIndex; index += 1 ) {
				const row = tbody.rows.item( index );
				if ( row && isMovableRow( row ) && row.cells.item( 0 ) ) {
					nextViewportRows.add( row );
				}
			}
		}
		const measurements: RowBindingMeasurement[] = [];
		for ( const row of nextViewportRows ) {
			if ( slotByRow.has( row ) ) {
				continue;
			}
			const measurement = measureRowBinding( row );
			if ( measurement ) {
				measurements.push( measurement );
			}
		}
		for ( const row of viewportRows ) {
			if ( ! nextViewportRows.has( row ) ) {
				removeViewportRow( row );
			}
		}
		viewportRows.clear();
		for ( const row of nextViewportRows ) {
			viewportRows.add( row );
		}
		for ( const measurement of measurements ) {
			bindMeasured( acquireSlot(), measurement );
		}
		viewportWindow = nextWindow;
	};

	const updateViewportWindowIncrementally = (
		currentWindow: ViewportWindow
	): ViewportWindow | null => {
		const bounds = getViewportBounds();
		const firstRect = currentWindow.firstRow.getBoundingClientRect();
		const lastRect = currentWindow.lastRow.getBoundingClientRect();
		if ( lastRect.bottom < bounds.top || firstRect.top > bounds.bottom ) {
			return null;
		}

		const refillBounds = getViewportBounds( VIEWPORT_REFILL_THRESHOLD_PX );
		const hasTopCoverage = currentWindow.firstIndex === 0 || firstRect.top <= refillBounds.top;
		const hasBottomCoverage =
			currentWindow.lastIndex === tbody.rows.length - 1 || lastRect.bottom >= refillBounds.bottom;
		if ( hasTopCoverage && hasBottomCoverage ) {
			return currentWindow;
		}

		const previousFirstIndex = currentWindow.firstIndex;
		const previousLastIndex = currentWindow.lastIndex;
		let { firstIndex, lastIndex } = currentWindow;
		while ( firstIndex <= lastIndex ) {
			const row = tbody.rows.item( firstIndex );
			if ( ! row || row.getBoundingClientRect().bottom >= bounds.top ) {
				break;
			}
			firstIndex += 1;
		}
		while ( firstIndex <= lastIndex ) {
			const row = tbody.rows.item( lastIndex );
			if ( ! row || row.getBoundingClientRect().top <= bounds.bottom ) {
				break;
			}
			lastIndex -= 1;
		}
		if ( firstIndex > lastIndex ) {
			return null;
		}

		while ( firstIndex > 0 ) {
			const previousRow = tbody.rows.item( firstIndex - 1 );
			if ( ! previousRow || previousRow.getBoundingClientRect().bottom < bounds.top ) {
				break;
			}
			firstIndex -= 1;
		}
		while ( lastIndex < tbody.rows.length - 1 ) {
			const nextRow = tbody.rows.item( lastIndex + 1 );
			if ( ! nextRow || nextRow.getBoundingClientRect().top > bounds.bottom ) {
				break;
			}
			lastIndex += 1;
		}

		const firstRow = tbody.rows.item( firstIndex );
		const lastRow = tbody.rows.item( lastIndex );
		if ( ! firstRow || ! lastRow ) {
			return null;
		}

		const rowsToRemove: HTMLTableRowElement[] = [];
		if ( firstIndex > previousFirstIndex ) {
			for ( let index = previousFirstIndex; index < firstIndex; index += 1 ) {
				const row = tbody.rows.item( index );
				if ( row ) {
					rowsToRemove.push( row );
				}
			}
		}
		if ( lastIndex < previousLastIndex ) {
			for ( let index = lastIndex + 1; index <= previousLastIndex; index += 1 ) {
				const row = tbody.rows.item( index );
				if ( row ) {
					rowsToRemove.push( row );
				}
			}
		}

		const rowsToAdd: HTMLTableRowElement[] = [];
		if ( firstIndex < previousFirstIndex ) {
			for ( let index = firstIndex; index < previousFirstIndex; index += 1 ) {
				const row = tbody.rows.item( index );
				if ( row && isMovableRow( row ) && row.cells.item( 0 ) ) {
					rowsToAdd.push( row );
				}
			}
		}
		if ( lastIndex > previousLastIndex ) {
			for ( let index = previousLastIndex + 1; index <= lastIndex; index += 1 ) {
				const row = tbody.rows.item( index );
				if ( row && isMovableRow( row ) && row.cells.item( 0 ) ) {
					rowsToAdd.push( row );
				}
			}
		}

		const measurements = new Map< HTMLTableRowElement, RowBindingMeasurement >();
		for ( const row of rowsToAdd ) {
			if ( slotByRow.has( row ) ) {
				continue;
			}
			const measurement = measureRowBinding( row );
			if ( measurement ) {
				measurements.set( row, measurement );
			}
		}

		for ( const row of rowsToRemove ) {
			removeViewportRow( row );
		}
		for ( const row of rowsToAdd ) {
			viewportRows.add( row );
			if ( slotByRow.has( row ) ) {
				continue;
			}
			const measurement = measurements.get( row );
			if ( measurement ) {
				bindMeasured( acquireSlot(), measurement );
			}
		}

		return { firstIndex, firstRow, lastIndex, lastRow };
	};

	const releaseBindingsOutsideViewport = () => {
		for ( const slot of slots ) {
			if ( slot.row && ! slot.isPinned && ! viewportRows.has( slot.row ) ) {
				unbind( slot );
			}
		}
	};

	const syncControls = () => {
		if ( cleanedUp ) {
			return;
		}
		if ( forceReanchor || ! viewportWindow || ! isViewportWindowValid( viewportWindow ) ) {
			applyViewportWindow( resolveViewportWindowWithBinarySearch() );
			forceReanchor = false;
			releaseBindingsOutsideViewport();
			return;
		}

		const nextWindow = updateViewportWindowIncrementally( viewportWindow );
		if ( nextWindow ) {
			viewportWindow = nextWindow;
		} else {
			applyViewportWindow( resolveViewportWindowWithBinarySearch() );
		}
		releaseBindingsOutsideViewport();
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
				if ( otherSlot !== slot && otherSlot.row && otherSlot.control ) {
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
	const onResize = () => {
		forceReanchor = true;
		scheduleSync();
	};
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
		viewportWindow = null;
		viewportRows.clear();
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
