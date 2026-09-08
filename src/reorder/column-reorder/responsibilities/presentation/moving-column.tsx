/**
 * Column Reorderの移動対象列を、実Tableの列順を変えない独立した移動表示として描画する。
 *
 * Column DnDの意味上のLifecycleはDnD InteractionのReact境界から受け取り、表示に必要な移動対象DOMと物理位置だけをDnD Engineから利用する。
 * 大規模Tableでは全行を複製せず、現在のeditor表示領域とその前後の少量だけを開始時表示として保持する。
 * 移動表示は物理DnDへ縦横とも追従し、利用者が元Tableからずらしてセル内容を比較できるようにする。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { useColumnDndPhase } from '@/reorder/column-reorder/integration/dnd-interaction-react';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import './moving-column.scss';

const SOURCE_CELL_CLASS = 'yamabiko-table-reorder-moving-column-source';
const DRAGGING_CLASS = 'yamabiko-table-reorder-column-dragging';
const VIEWPORT_SCAN_STEP = 8;

/** DnD開始時に確定し、移動表示へ保持する一つの移動対象列セル。 */
type ColumnMovingCellSnapshot = {
	sourceCell: HTMLTableCellElement;
	top: number;
	height: number;
	backgroundColor: string;
};

/** Column DnD開始時に確定し、そのDnD中の移動表示で維持する配置情報。 */
type ColumnMovingDisplayLayout = {
	sourceTable: HTMLTableElement;
	cells: ColumnMovingCellSnapshot[];
	columnWidth: number;
	snapshotTop: number;
	snapshotHeight: number;
	initialPositionX: number;
	initialPositionY: number;
	initialLeft: number;
	initialTop: number;
	editorDocument: Document;
};

/** 移動表示が現在追従するeditor表示領域内の位置。 */
type ColumnMovingDisplayPosition = {
	left: number;
	top: number;
};

/**
 * 計算済み背景色が、背後の背景をそのまま透過する色かを判定する。
 *
 * @param backgroundColor 現在のeditor contextで得た計算済み背景色。
 * @return 完全に透明な背景色の場合はtrue。
 */
const isTransparentBackground = ( backgroundColor: string ): boolean => {
	const normalized = backgroundColor.toLowerCase().replaceAll( ' ', '' );

	if ( normalized === 'transparent' ) {
		return true;
	}

	if ( normalized.startsWith( 'rgba(' ) ) {
		const components = normalized.slice( 5, -1 ).split( ',' );
		const alpha = components[ 3 ];
		if ( alpha !== undefined ) {
			return Number.parseFloat( alpha ) === 0;
		}
	}

	const slashAlpha = normalized.match( /\/([^)]*)\)$/ );
	if ( slashAlpha?.[ 1 ] !== undefined ) {
		const alpha = slashAlpha[ 1 ];
		const numericAlpha = alpha.endsWith( '%' )
			? Number.parseFloat( alpha ) / 100
			: Number.parseFloat( alpha );
		return numericAlpha === 0;
	}

	return false;
};

/**
 * 元Tableで実際に見えている背景を、セル背景、行背景、白背景の優先順位で解決する。
 *
 * @param cell         移動対象列として描画する元セル。
 * @param editorWindow 現在のeditor contextに対応するwindow。
 * @return 移動表示へ固定する背景色。
 */
const resolveCellBackgroundColor = ( cell: HTMLTableCellElement, editorWindow: Window ): string => {
	const cellBackgroundColor = editorWindow.getComputedStyle( cell ).backgroundColor;

	/* セル自身が背景を持つ場合は、元Table上で最も手前に見えている背景をそのまま維持する。 */
	if ( ! isTransparentBackground( cellBackgroundColor ) ) {
		return cellBackgroundColor;
	}

	const sourceRow = cell.parentElement;
	const rowBackgroundColor =
		sourceRow?.tagName === 'TR'
			? editorWindow.getComputedStyle( sourceRow ).backgroundColor
			: 'transparent';

	/* セルが透明でも元行に背景がある場合は、複製先で失われる行背景をセル表示へ引き継ぐ。 */
	if ( ! isTransparentBackground( rowBackgroundColor ) ) {
		return rowBackgroundColor;
	}

	return '#fff';
};

/**
 * 指定位置に実際に描画されている対象Tableのセルを取得する。
 *
 * @param editorDocument 現在のeditor contextに対応するdocument。
 * @param table          Column Reorder対象Table。
 * @param x              移動対象列内の横位置。
 * @param y              editor表示領域内の縦位置。
 * @return 指定位置にある対象Tableのセル。対象外の場合はnull。
 */
const resolveTableCellAtPoint = (
	editorDocument: Document,
	table: HTMLTableElement,
	x: number,
	y: number
): HTMLTableCellElement | null => {
	const element = editorDocument.elementFromPoint?.( x, y ) ?? null;
	const cell = element?.closest( 'th, td' ) as HTMLTableCellElement | null;
	const sourceCell = cell?.closest( 'table' ) === table ? cell : null;
	return sourceCell;
};

/**
 * 一つのTable行から、移動対象列の物理位置と重なるセルを解決する。
 *
 * @param row   近傍表示として確認するTable行。
 * @param table Column Reorder対象Table。
 * @param x     移動対象列内の横位置。
 * @return 横位置を覆う対象Tableセル。存在しない場合はnull。
 */
const resolveCellInRowAtX = (
	row: HTMLTableRowElement,
	table: HTMLTableElement,
	x: number
): HTMLTableCellElement | null => {
	/* 近傍一行だけを確認し、Table全行の計測へ処理範囲を広げず移動表示の余白を解決する。 */
	for ( const cell of Array.from( row.cells ) ) {
		if ( cell.closest( 'table' ) !== table ) {
			continue;
		}

		const rectangle = cell.getBoundingClientRect();
		if ( x >= rectangle.left && x < rectangle.right ) {
			return cell;
		}
	}

	return null;
};

/**
 * 現在見えている移動対象列セルと、その直前・直後の少量の近傍セルを開始時snapshotとして取得する。
 *
 * @param table          Column Reorder対象Table。
 * @param sourceCell     DnD Engineが移動対象として管理する開始セル。
 * @param editorDocument 現在のeditor contextに対応するdocument。
 * @param editorWindow   現在のeditor contextに対応するwindow。
 * @return 表示領域と少量の余白に含める移動対象列セル。
 */
const collectMovingColumnCells = (
	table: HTMLTableElement,
	sourceCell: HTMLTableCellElement,
	editorDocument: Document,
	editorWindow: Window
): ColumnMovingCellSnapshot[] => {
	const tableRectangle = table.getBoundingClientRect();
	const sourceRectangle = sourceCell.getBoundingClientRect();
	const visibleTop = Math.max( tableRectangle.top, 0 );
	const visibleBottom = Math.min( tableRectangle.bottom, editorWindow.innerHeight );
	const probeX = sourceRectangle.left + sourceRectangle.width / 2;
	const visibleCells: HTMLTableCellElement[] = [];
	const seenCells = new Set< HTMLTableCellElement >();
	let y = visibleTop + 0.5;

	/* Table行数ではなく現在のeditor表示領域を基準に走査し、画面上で実際に見えている移動対象列セルだけを収集する。 */
	while ( y < visibleBottom ) {
		const cell = resolveTableCellAtPoint( editorDocument, table, probeX, y );

		if ( cell === null ) {
			y += VIEWPORT_SCAN_STEP;
			continue;
		}

		const rectangle = cell.getBoundingClientRect();
		if ( ! seenCells.has( cell ) && rectangle.bottom > visibleTop && rectangle.top < visibleBottom ) {
			seenCells.add( cell );
			visibleCells.push( cell );
		}

		/* 同じセル内を細かく再計測せず、現在セルの下端から次の表示セル探索へ進む。 */
		y = rectangle.bottom > y ? rectangle.bottom + 0.5 : y + VIEWPORT_SCAN_STEP;
	}

	/* 開始セルが表示領域端の判定差で取得されなくても、実際のDnD開始対象だけは移動表示から失わない。 */
	if ( ! seenCells.has( sourceCell ) ) {
		seenCells.add( sourceCell );
		visibleCells.push( sourceCell );
	}

	visibleCells.sort(
		( first, second ) => first.getBoundingClientRect().top - second.getBoundingClientRect().top
	);
	const firstRow = visibleCells[ 0 ]?.parentElement as HTMLTableRowElement | null;
	const lastRow = visibleCells[ visibleCells.length - 1 ]?.parentElement as HTMLTableRowElement | null;
	const previousRow = firstRow ? table.rows.item( firstRow.rowIndex - 1 ) : null;
	const nextRow = lastRow ? table.rows.item( lastRow.rowIndex + 1 ) : null;
	const previousCell = previousRow ? resolveCellInRowAtX( previousRow, table, probeX ) : null;
	const nextCell = nextRow ? resolveCellInRowAtX( nextRow, table, probeX ) : null;

	/* 小さな縦移動で内容が直ちに欠けないよう、可視範囲の前後一行で同じ列位置を覆うセルだけを余白として加える。 */
	for ( const cell of [ previousCell, nextCell ] ) {
		if ( cell !== null && ! seenCells.has( cell ) ) {
			seenCells.add( cell );
			visibleCells.push( cell );
		}
	}

	return visibleCells
		.map( ( cell ) => {
			const rectangle = cell.getBoundingClientRect();
			return {
				sourceCell: cell,
				top: rectangle.top,
				height: rectangle.height,
				backgroundColor: resolveCellBackgroundColor( cell, editorWindow ),
			};
		} )
		.sort( ( first, second ) => first.top - second.top );
};

/**
 * 移動対象セルから、そのDnD中に維持するColumn Moving Overlayの配置を解決する。
 *
 * @param sourceElement    DnD Engineが現在の移動対象として管理するDOM要素。
 * @param initialPositionX DnD Engineが示すDnD開始時の横位置。
 * @param initialPositionY DnD Engineが示すDnD開始時の縦位置。
 * @return 移動表示に必要な配置情報。表示を成立させられない場合はnull。
 */
const resolveMovingDisplayLayout = (
	sourceElement: Element | undefined,
	initialPositionX: number,
	initialPositionY: number
): ColumnMovingDisplayLayout | null => {
	/* Column Reorderの移動対象としてTableセルを確認できない場合は、移動表示を成立させない。 */
	if ( ! sourceElement || ! [ 'TD', 'TH' ].includes( sourceElement.tagName ) ) {
		return null;
	}

	const sourceCell = sourceElement as HTMLTableCellElement;
	const sourceTable = sourceCell.closest( 'table' ) as HTMLTableElement | null;
	if ( sourceTable === null ) {
		return null;
	}

	const editorContext = resolveEditorDomContext( sourceCell );
	if ( editorContext === null ) {
		return null;
	}

	const sourceRectangle = sourceCell.getBoundingClientRect();
	const tableRectangle = sourceTable.getBoundingClientRect();

	/* 元列の幅と現在のTable表示領域を確定できない場合は、別の寸法を推測して移動表示を作らない。 */
	if (
		sourceRectangle.width <= 0 ||
		tableRectangle.width <= 0 ||
		tableRectangle.bottom <= 0 ||
		tableRectangle.top >= editorContext.window.innerHeight
	) {
		return null;
	}

	const cells = collectMovingColumnCells(
		sourceTable,
		sourceCell,
		editorContext.document,
		editorContext.window
	);
	if ( cells.length === 0 ) {
		return null;
	}

	const snapshotTop = Math.min( ...cells.map( ( cell ) => cell.top ) );
	const snapshotBottom = Math.max( ...cells.map( ( cell ) => cell.top + cell.height ) );

	return {
		sourceTable,
		cells,
		columnWidth: sourceRectangle.width,
		snapshotTop,
		snapshotHeight: snapshotBottom - snapshotTop,
		initialPositionX,
		initialPositionY,
		initialLeft: sourceRectangle.left,
		initialTop: snapshotTop,
		editorDocument: editorContext.document,
	};
};

/**
 * 複製した移動表示から、元Tableとの同時存在を許可できないDOM識別子を除去する。
 *
 * @param element 移動表示として複製した要素。
 */
const removeDuplicatedIds = ( element: Element ): void => {
	element.removeAttribute( 'id' );
	element.querySelectorAll( '[id]' ).forEach( ( child ) => child.removeAttribute( 'id' ) );
};

/**
 * DnD開始時のセル表示を、移動対象列の開始時配置を保つ独立した表示へ構成する。
 *
 * @param layout    DnD開始時に確定した移動対象列の表示配置。
 * @param container 移動対象列セルを描画する境界。
 */
const renderMovingColumn = ( layout: ColumnMovingDisplayLayout, container: HTMLDivElement ): void => {
	const fragment = layout.editorDocument.createDocumentFragment();

	/* 可視範囲と少量の余白だけを独立したセル表示へ変換し、Table全行の複製を発生させない。 */
	layout.cells.forEach( ( snapshot ) => {
		const sourceRow = snapshot.sourceCell.parentElement as HTMLTableRowElement | null;
		const sourceSection = sourceRow?.parentElement as HTMLTableSectionElement | null;
		const table = layout.editorDocument.createElement( 'table' );
		const sectionName = sourceSection?.tagName.toLowerCase();
		const section = layout.editorDocument.createElement(
			sectionName === 'thead' || sectionName === 'tfoot' ? sectionName : 'tbody'
		);
		const row = layout.editorDocument.createElement( 'tr' );
		const clonedCell = snapshot.sourceCell.cloneNode( true ) as HTMLTableCellElement;

		removeDuplicatedIds( clonedCell );
		clonedCell.classList.remove( SOURCE_CELL_CLASS );
		clonedCell.style.boxSizing = 'border-box';
		clonedCell.style.width = `${ layout.columnWidth }px`;
		clonedCell.style.minWidth = `${ layout.columnWidth }px`;
		clonedCell.style.maxWidth = `${ layout.columnWidth }px`;
		clonedCell.style.height = `${ snapshot.height }px`;
		clonedCell.style.backgroundColor = snapshot.backgroundColor;
		row.className = sourceRow?.className ?? '';
		row.appendChild( clonedCell );
		section.appendChild( row );
		table.appendChild( section );
		table.className = `${ layout.sourceTable.className } yamabiko-table-reorder-moving-column-cell-table`.trim();
		table.style.top = `${ snapshot.top - layout.snapshotTop }px`;
		table.style.width = `${ layout.columnWidth }px`;
		table.style.height = `${ snapshot.height }px`;
		fragment.appendChild( table );
	} );

	container.replaceChildren( fragment );
};

/**
 * DnD開始時に確定した列表示を、現在の物理ドラッグ位置へ縦横とも追従する独立表示として描画する。
 *
 * @param props          移動表示に必要な配置と現在位置。
 * @param props.layout   DnD開始時に確定した移動対象列の配置情報。
 * @param props.position 現在の移動表示位置。
 * @return 現在のeditor contextへ描画する移動対象列表示。
 */
const ColumnMovingOverlay = ( props: {
	layout: ColumnMovingDisplayLayout;
	position: ColumnMovingDisplayPosition;
} ) => {
	const { layout, position } = props;
	const containerRef = useRef< HTMLDivElement | null >( null );

	useEffect( () => {
		if ( containerRef.current !== null ) {
			renderMovingColumn( layout, containerRef.current );
		}
	}, [ layout ] );

	const overlayStyle: CSSProperties = {
		top: position.top,
		left: position.left,
		width: layout.columnWidth,
		height: layout.snapshotHeight,
	};

	return createPortal(
		<div
			ref={ ( element ) => {
				containerRef.current = element;
				element?.setAttribute( 'inert', '' );
			} }
			aria-hidden="true"
			className="editor-styles-wrapper yamabiko-table-reorder-moving-column"
			style={ overlayStyle }
		/>,
		layout.editorDocument.body
	);
};

/**
 * Column DnDの意味状態とDnD Engineの物理情報を組み合わせ、移動対象列の独立表示だけを管理する。
 *
 * 元Tableの列順は変更せず、開始時に取得した可視範囲と少量の余白だけをそのDnD中のsnapshotとして維持する。
 * 移動表示は縦横とも物理移動へ追従するが、縦方向の見かけ上の移動を論理移動先判定へ反映しない。
 *
 * @return activeなColumn DnD中は移動対象列表示。それ以外はnull。
 */
export const ColumnMovingDisplay = () => {
	const phase = useColumnDndPhase();
	const activeLayout = useRef< ColumnMovingDisplayLayout | null >( null );
	const sessionBecameActive = useRef( false );
	const [ layout, setLayout ] = useState< ColumnMovingDisplayLayout | null >( null );
	const [ position, setPosition ] = useState< ColumnMovingDisplayPosition >( {
		left: 0,
		top: 0,
	} );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			const dragPosition = event.operation.position;
			const initialPositionX = dragPosition.initial.x ?? 0;
			const initialPositionY = dragPosition.initial.y;
			const nextLayout = resolveMovingDisplayLayout(
				event.operation.source?.element,
				initialPositionX,
				initialPositionY
			);

			activeLayout.current = nextLayout;
			setLayout( nextLayout );
			if ( nextLayout !== null ) {
				setPosition( {
					left: nextLayout.initialLeft,
					top: nextLayout.initialTop,
				} );
			}
		},
		onDragMove: ( event ) => {
			const currentLayout = activeLayout.current;
			if ( currentLayout === null ) {
				return;
			}

			const currentPosition = event.operation.position.current;
			const currentPositionX = currentPosition.x ?? currentLayout.initialPositionX;
			setPosition( {
				left: currentLayout.initialLeft + currentPositionX - currentLayout.initialPositionX,
				top: currentLayout.initialTop + currentPosition.y - currentLayout.initialPositionY,
			} );
		},
	} );

	useEffect( () => {
		/* 物理DnD開始直後のidleを終了と誤認せず、一度activeになった意味Sessionがidleへ戻った場合だけ表示を破棄する。 */
		if ( phase === 'idle' ) {
			if ( sessionBecameActive.current ) {
				sessionBecameActive.current = false;
				activeLayout.current = null;
				setLayout( null );
			}
			return;
		}

		sessionBecameActive.current = true;
	}, [ phase ] );

	useEffect( () => {
		/* active Session中だけ元列の描画対象セルを半透明にし、DnD終了時は元Table表示へ確実に戻す。 */
		if ( phase !== 'active' || layout === null ) {
			return;
		}

		layout.cells.forEach( ( snapshot ) => snapshot.sourceCell.classList.add( SOURCE_CELL_CLASS ) );
		layout.editorDocument.body.classList.add( DRAGGING_CLASS );
		return () => {
			layout.cells.forEach( ( snapshot ) => snapshot.sourceCell.classList.remove( SOURCE_CELL_CLASS ) );
			layout.editorDocument.body.classList.remove( DRAGGING_CLASS );
		};
	}, [ phase, layout ] );

	const visible = phase === 'active' && layout !== null;
	const movingDisplay = visible ? <ColumnMovingOverlay layout={ layout } position={ position } /> : null;
	return movingDisplay;
};
