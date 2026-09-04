/**
 * 行DnD中の移動対象を、実Tableの配置を変えない独立した表示として描画する。
 *
 * DnD Engineが所有する現在の移動対象と物理位置を直接利用し、移動対象行の表示用overlayを現在のeditor contextへ描画する。
 * 移動表示は縦方向だけDnD位置へ追従し、横方向は対象Tableと現在表示領域が重なる範囲に制限する。
 * 元行は実DOM上の位置と大きさを維持したまま視覚的に区別し、DnD終了時に表示変更を解除する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

/** 行DnD開始時に確定し、そのDnD中の移動表示で維持する配置情報。 */
type RowMoveLayout = {
	sourceRow: HTMLTableRowElement;
	sourceTable: HTMLTableElement;
	sourceOpacity: string;
	rowHeight: number;
	tableWidth: number;
	clipLeft: number;
	clipWidth: number;
	tableOffsetLeft: number;
	cellWidths: number[];
	initialPositionY: number;
	initialTop: number;
	editorDocument: Document;
};

/**
 * 移動対象行から、そのDnD中に維持する表示配置を解決する。
 *
 * Tableまたは現在のeditor contextを確認できない場合や、Tableが現在表示領域と横方向に重ならない場合は移動表示を成立させない。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @param initialPositionY DnD Engineが示すDnD開始時の縦位置。
 * @return 移動表示に必要な配置情報。表示を成立させられない場合はnull。
 */
const resolveRowMoveLayout = (
	sourceElement: Element | undefined,
	initialPositionY: number
): RowMoveLayout | null => {
	/* 行DnDの移動対象としてtbody直下行を確認できない場合は、独立表示を作らない。 */
	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		return null;
	}

	const sourceRow = sourceElement as HTMLTableRowElement;
	const tableBody = sourceRow.parentElement;
	const sourceTable = sourceRow.closest( 'table' ) as HTMLTableElement | null;

	/* Row Reorderの対象範囲と対象Tableを確認できないDOMは、移動表示対象として扱わない。 */
	if ( ! tableBody || tableBody.tagName !== 'TBODY' || ! sourceTable ) {
		return null;
	}

	const editorContext = resolveEditorDomContext( sourceRow );

	/* 現在のeditor contextを解決できない場合は、別の表示環境へoverlayを描画しない。 */
	if ( editorContext === null ) {
		return null;
	}

	const rowRectangle = sourceRow.getBoundingClientRect();
	const tableRectangle = sourceTable.getBoundingClientRect();
	const viewportWidth = editorContext.window.innerWidth;
	const clipLeft = Math.max( tableRectangle.left, 0 );
	const clipRight = Math.min( tableRectangle.right, viewportWidth );
	const clipWidth = clipRight - clipLeft;

	/* 対象Tableが現在表示領域と横方向に重ならない場合は、表示可能なoverlayがない。 */
	if ( clipWidth <= 0 || tableRectangle.width <= 0 || rowRectangle.height <= 0 ) {
		return null;
	}

	const cellWidths = Array.from( sourceRow.cells, ( cell ) => cell.getBoundingClientRect().width );

	return {
		sourceRow,
		sourceTable,
		sourceOpacity: sourceRow.style.opacity,
		rowHeight: rowRectangle.height,
		tableWidth: tableRectangle.width,
		clipLeft,
		clipWidth,
		tableOffsetLeft: tableRectangle.left - clipLeft,
		cellWidths,
		initialPositionY,
		initialTop: rowRectangle.top,
		editorDocument: editorContext.document,
	};
};

/**
 * 複製した移動表示からEditor内で一意であることを前提とする識別子を除去する。
 *
 * @param row 移動表示として複製した行。
 */
const removeDuplicatedIds = ( row: HTMLTableRowElement ): void => {
	row.removeAttribute( 'id' );

	/* 元行と移動表示が同時に存在しても、子要素の識別子が重複しない状態にする。 */
	row.querySelectorAll( '[id]' ).forEach( ( element ) => {
		element.removeAttribute( 'id' );
	} );
};

/**
 * 元行の現在表示を基準に、セル配置を維持した移動表示用Tableを構成する。
 *
 * @param props 移動表示の固定配置情報と描画先tbody。
 * @param props.layout DnD開始時に確定した行とTableの表示配置。
 * @param props.tableBody 移動表示を描画するtbody。
 */
const renderClonedRow = ( props: {
	layout: RowMoveLayout;
	tableBody: HTMLTableSectionElement;
} ): void => {
	const { layout, tableBody } = props;
	const clonedRow = layout.sourceRow.cloneNode( true ) as HTMLTableRowElement;
	removeDuplicatedIds( clonedRow );
	clonedRow.style.height = `${ layout.rowHeight }px`;

	/* 空セルを含む場合も元行のセル幅を基準として、列配置が内容量によって変化しないよう固定する。 */
	Array.from( clonedRow.cells ).forEach( ( cell, index ) => {
		const width = layout.cellWidths[ index ];
		if ( width === undefined ) {
			return;
		}
		cell.style.boxSizing = 'border-box';
		cell.style.width = `${ width }px`;
		cell.style.minWidth = `${ width }px`;
		cell.style.maxWidth = `${ width }px`;
	} );

	tableBody.replaceChildren( clonedRow );
};

/**
 * DnD開始時に確定した行表示を、現在の縦位置へ追従する独立overlayとして描画する。
 *
 * @param props 移動表示に必要な配置と現在位置。
 * @param props.layout DnD開始時に確定した元行とTableの配置情報。
 * @param props.top 現在の移動表示上端位置。
 * @return 現在のeditor contextへ描画する移動対象行overlay。
 */
const RowMoveOverlay = ( props: { layout: RowMoveLayout; top: number } ) => {
	const { layout, top } = props;
	const tableBodyRef = useRef< HTMLTableSectionElement | null >( null );

	useEffect( () => {
		const tableBody = tableBodyRef.current;
		if ( tableBody === null ) {
			return;
		}

		renderClonedRow( { layout, tableBody } );
	}, [ layout ] );

	const clipStyle: CSSProperties = {
		position: 'fixed',
		zIndex: 100000,
		top,
		left: layout.clipLeft,
		width: layout.clipWidth,
		height: layout.rowHeight,
		overflow: 'hidden',
		pointerEvents: 'none',
		boxSizing: 'border-box',
		outline: '2px solid currentColor',
		boxShadow: '0 4px 12px rgb(0 0 0 / 20%)',
	};
	const tableStyle: CSSProperties = {
		position: 'absolute',
		top: 0,
		left: layout.tableOffsetLeft,
		width: layout.tableWidth,
		tableLayout: 'fixed',
		margin: 0,
	};

	return createPortal(
		<div aria-hidden="true" style={ clipStyle }>
			<table
				className={ layout.sourceTable.className }
				style={ tableStyle }
				aria-hidden="true"
			>
				<tbody ref={ tableBodyRef } />
			</table>
		</div>,
		layout.editorDocument.body
	);
};

/**
 * DnD Engineの現在の移動対象と物理位置から、Row Reorderの移動対象表示を管理する。
 *
 * 物理位置をDnD InteractionのSessionへ複製せず、DnD開始・移動・終了を直接購読して表示だけを更新する。
 * 元行はDnD中も実Table内に残し、透明度だけを変更することでTableレイアウトとDroppable位置を維持する。
 *
 * @return activeな行DnD中は移動対象行overlay。それ以外はnull。
 */
export const RowReorderPresentation = () => {
	const activeLayout = useRef< RowMoveLayout | null >( null );
	const [ layout, setLayout ] = useState< RowMoveLayout | null >( null );
	const [ top, setTop ] = useState( 0 );

	/** 現在の移動表示と元行の視覚変更を終了する。 */
	const clearPresentation = (): void => {
		const currentLayout = activeLayout.current;
		if ( currentLayout !== null ) {
			currentLayout.sourceRow.style.opacity = currentLayout.sourceOpacity;
		}
		activeLayout.current = null;
		setLayout( null );
	};

	useEffect( () => {
		return () => {
			const currentLayout = activeLayout.current;
			if ( currentLayout !== null ) {
				currentLayout.sourceRow.style.opacity = currentLayout.sourceOpacity;
			}
			activeLayout.current = null;
		};
	}, [] );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			const position = event.operation.position;
			const nextLayout = resolveRowMoveLayout(
				event.operation.source?.element,
				position.initial.y
			);

			clearPresentation();

			/* 表示可能な移動対象が成立した場合だけ、元行をレイアウト不変の視覚状態へ切り替える。 */
			if ( nextLayout !== null ) {
				nextLayout.sourceRow.style.opacity = '0.35';
				activeLayout.current = nextLayout;
				setTop( nextLayout.initialTop );
				setLayout( nextLayout );
			}
		},
		onDragMove: ( event ) => {
			const currentLayout = activeLayout.current;
			if ( currentLayout === null ) {
				return;
			}

			const currentPositionY = event.operation.position.current.y;
			const verticalMovement = currentPositionY - currentLayout.initialPositionY;
			setTop( currentLayout.initialTop + verticalMovement );
		},
		onDragEnd: () => {
			clearPresentation();
		},
	} );

	if ( layout === null ) {
		return null;
	}

	return <RowMoveOverlay layout={ layout } top={ top } />;
};
