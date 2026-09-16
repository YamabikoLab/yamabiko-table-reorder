/**
 * Column Reorderの移動対象列を、実Tableの列順を変えない独立した移動表示として描画する。
 *
 * Column DnDの意味上のLifecycleはDnD InteractionのReact境界から受け取り、表示に必要な移動対象DOMと物理位置だけをDnD Engineから利用する。
 * 大規模Tableでは全行を複製せず、現在のeditor表示領域に見えているセルの内容と表示寸法だけをDnD開始時に保持する。
 * 実Tableの移動元セル群は変更せず、開始時の元列位置を単一のframeで示し、移動表示は「どの列を掴み、現在どこへ動かしているか」を認識するための必要十分な表示に限定する。
 */

import { getFrameTransform } from '@dnd-kit/dom/utilities';
import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { useColumnDndPhase } from '@/reorder/column-reorder/integration/dnd-interaction-react';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import './moving-column.scss';

const DRAGGING_CLASS = 'yamabiko-table-reorder-column-dragging';
const VIEWPORT_SCAN_STEP = 8;
const FTB_EDITOR_CONTROL_SELECTOR = [
	'.ftb-table-cell-label',
	'.ftb-row-selector',
	'.ftb-column-selector',
	'.ftb-row-before-inserter',
	'.ftb-row-after-inserter',
	'.ftb-column-before-inserter',
	'.ftb-column-after-inserter',
	'.ftb-row-remover',
	'.ftb-column-remover',
].join( ', ' );

/** DnD開始時に確定し、移動表示へ保持する一つの移動対象列セル。 */
type ColumnMovingCellSnapshot = {
	sourceCell: HTMLTableCellElement;
	top: number;
	height: number;
};

/** Column DnD開始時に確定し、そのDnD中の移動表示で維持する配置情報。 */
type ColumnMovingDisplayLayout = {
	sourceTableClasses: string;
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

/** activeな物理DnDに対応する移動表示の配置と現在位置。 */
type ColumnMovingDisplayState = {
	layout: ColumnMovingDisplayLayout;
	position: {
		left: number;
		top: number;
	};
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
 * 現在見えている移動対象列セルだけを開始時snapshotとして取得する。
 *
 * 元Tableの装飾は取得せず、列内容の識別と結合セルの表示形状維持に必要なDOM参照と縦寸法だけを保持する。
 *
 * @param table            Column Reorder対象Table。
 * @param sourceCell       DnD Engineが移動対象として管理する開始セル。
 * @param initialPositionX DnD開始時に利用者が指した移動対象列内の横位置。
 * @param editorDocument   現在のeditor contextに対応するdocument。
 * @param editorWindow     現在のeditor contextに対応するwindow。
 * @return editor表示領域に見えている移動対象列セル。
 */
const collectMovingColumnCells = (
	table: HTMLTableElement,
	sourceCell: HTMLTableCellElement,
	initialPositionX: number,
	editorDocument: Document,
	editorWindow: Window
): ColumnMovingCellSnapshot[] => {
	const tableRectangle = table.getBoundingClientRect();
	const visibleTop = Math.max( tableRectangle.top, 0 );
	const visibleBottom = Math.min( tableRectangle.bottom, editorWindow.innerHeight );
	const visibleCells: HTMLTableCellElement[] = [];
	const seenCells = new Set< HTMLTableCellElement >();
	let y = visibleTop + 0.5;

	/* Table行数ではなく現在のeditor表示領域とDnD開始位置を基準に、画面上で実際に見えている移動対象列セルだけを収集する。 */
	while ( y < visibleBottom ) {
		const cell = resolveTableCellAtPoint( editorDocument, table, initialPositionX, y );

		if ( cell === null ) {
			y += VIEWPORT_SCAN_STEP;
			continue;
		}

		const rectangle = cell.getBoundingClientRect();
		if (
			! seenCells.has( cell ) &&
			rectangle.bottom > visibleTop &&
			rectangle.top < visibleBottom
		) {
			seenCells.add( cell );
			visibleCells.push( cell );
		}

		/* 同じセル内を細かく再計測せず、現在セルの下端から次の表示セル探索へ進む。 */
		y = rectangle.bottom > y ? rectangle.bottom + 0.5 : y + VIEWPORT_SCAN_STEP;
	}

	/* 表示領域端の判定差があっても、実際のDnD開始対象だけは移動表示から失わない。 */
	if ( ! seenCells.has( sourceCell ) ) {
		visibleCells.push( sourceCell );
	}

	return visibleCells
		.map( ( cell ) => {
			const rectangle = cell.getBoundingClientRect();
			return {
				sourceCell: cell,
				top: rectangle.top,
				height: rectangle.height,
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

	const frameTransform = getFrameTransform( sourceCell );
	/* DnD Engineの物理座標から現在のeditor表示領域へ戻せない場合は、別列を推測して移動表示を作らない。 */
	if ( ! Number.isFinite( frameTransform.scaleX ) || frameTransform.scaleX === 0 ) {
		return null;
	}

	const editorPositionX = ( initialPositionX - frameTransform.x ) / frameTransform.scaleX;
	const cells = collectMovingColumnCells(
		sourceTable,
		sourceCell,
		editorPositionX,
		editorContext.document,
		editorContext.window
	);
	if ( cells.length === 0 ) {
		return null;
	}

	const snapshotTop = Math.min( ...cells.map( ( cell ) => cell.top ) );
	const snapshotBottom = Math.max( ...cells.map( ( cell ) => cell.top + cell.height ) );

	return {
		sourceTableClasses: sourceTable.className,
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

	/* 元Tableと移動表示が同時に存在しても、子要素のDOM識別子が重複しない状態にする。 */
	element.querySelectorAll( '[id]' ).forEach( ( child ) => {
		child.removeAttribute( 'id' );
	} );
};

/**
 * 複製した移動表示から、Table内容ではないFTBのeditor操作要素を除去する。
 *
 * @param cell 移動表示として複製したセル。
 */
const removeFtbEditorControls = ( cell: HTMLTableCellElement ): void => {
	/* FTBの操作要素は元Tableでのみ成立するため、独立した移動表示へ持ち込まない。 */
	cell.querySelectorAll( FTB_EDITOR_CONTROL_SELECTOR ).forEach( ( element ) => {
		element.remove();
	} );
};

/**
 * DnD開始時の可視セル内容を、移動対象列の開始時寸法を保つ独立した表示へ構成する。
 *
 * @param layout    DnD開始時に確定した移動対象列の表示配置。
 * @param container 移動対象列セルを描画する境界。
 */
const renderMovingColumn = (
	layout: ColumnMovingDisplayLayout,
	container: HTMLDivElement
): void => {
	const fragment = layout.editorDocument.createDocumentFragment();

	/* 可視範囲だけを独立したセル表示へ変換し、Table全行の複製や元Table装飾の再構成を発生させない。 */
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
		removeFtbEditorControls( clonedCell );
		clonedCell.style.boxSizing = 'border-box';
		clonedCell.style.width = `${ layout.columnWidth }px`;
		clonedCell.style.minWidth = `${ layout.columnWidth }px`;
		clonedCell.style.maxWidth = `${ layout.columnWidth }px`;
		clonedCell.style.height = `${ snapshot.height }px`;

		row.appendChild( clonedCell );
		section.appendChild( row );
		table.appendChild( section );
		table.className =
			`${ layout.sourceTableClasses } yamabiko-table-reorder-moving-column-cell-table`.trim();
		table.style.top = `${ snapshot.top - layout.snapshotTop }px`;
		table.style.width = `${ layout.columnWidth }px`;
		table.style.height = `${ snapshot.height }px`;
		fragment.appendChild( table );
	} );

	container.replaceChildren( fragment );
};

/**
 * DnD開始時に確定した元列の位置と可視範囲を、実Tableを変更しない単一frameとして示す。
 *
 * @param props        移動元列表示に必要な配置。
 * @param props.layout DnD開始時に確定した移動対象列の配置情報。
 * @return 現在のeditor contextへ描画する移動元列frame。
 */
const ColumnSourceFrame = ( props: { layout: ColumnMovingDisplayLayout } ) => {
	const { layout } = props;
	const frameStyle: CSSProperties = {
		top: layout.initialTop,
		left: layout.initialLeft,
		width: layout.columnWidth,
		height: layout.snapshotHeight,
	};

	return createPortal(
		<div
			aria-hidden="true"
			className="yamabiko-table-reorder-moving-column-source-frame"
			style={ frameStyle }
		/>,
		layout.editorDocument.body
	);
};

/**
 * DnD開始時に確定した列表示を、現在の物理ドラッグ位置へ縦横とも追従する独立表示として描画する。
 * 移動表示は視覚的な補助だけを担い、複製した編集可能要素を含めて入力・フォーカス対象にしない。
 *
 * @param props          移動表示に必要な配置と現在位置。
 * @param props.layout   DnD開始時に確定した移動対象列の配置情報。
 * @param props.position 現在の移動表示位置。
 * @return 現在のeditor contextへ描画する移動対象列表示。
 */
const ColumnMovingOverlay = ( props: {
	layout: ColumnMovingDisplayLayout;
	position: ColumnMovingDisplayState[ 'position' ];
} ) => {
	const { layout, position } = props;
	const containerRef = useRef< HTMLDivElement | null >( null );

	useEffect( () => {
		const container = containerRef.current;

		/* 描画先がまだ成立していない段階では、移動対象列の複製を行わない。 */
		if ( container === null ) {
			return;
		}

		renderMovingColumn( layout, container );
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
 * Column DnDの意味状態とDnD Engineの物理情報を組み合わせ、移動元列表示と独立した移動表示だけを管理する。
 *
 * DnD Interactionからはactive / idleだけを受け取り、物理座標やDOM参照をSessionへ複製しない。
 * 実Tableの移動元セル群は変更せず、単一の移動元frame、移動表示、Insertion Lineで操作対象と移動位置を示す。
 * 移動表示は縦横とも物理移動へ追従するが、移動元frameはDnD開始時の位置へ留まり、縦方向の見かけ上の移動を論理移動先判定へ反映しない。
 *
 * @return activeなColumn DnD中は移動元列frameと移動対象列表示。それ以外はnull。
 */
export const ColumnMovingDisplay = () => {
	const phase = useColumnDndPhase();
	const sessionBecameActive = useRef( false );
	const [ movingColumn, setMovingColumn ] = useState< ColumnMovingDisplayState | null >( null );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			const dragPosition = event.operation.position;
			const initialPositionX = dragPosition.initial.x ?? 0;
			const layout = resolveMovingDisplayLayout(
				event.operation.source?.element,
				initialPositionX,
				dragPosition.initial.y
			);
			const nextMovingColumn =
				layout === null
					? null
					: {
							layout,
							position: {
								left: layout.initialLeft,
								top: layout.initialTop,
							},
					  };

			setMovingColumn( nextMovingColumn );
		},
		onDragMove: ( event ) => {
			setMovingColumn( ( currentMovingColumn ) => {
				/* DnD開始時に移動表示が成立していない場合は、物理移動だけで途中から表示を開始しない。 */
				if ( currentMovingColumn === null ) {
					return null;
				}

				const { layout } = currentMovingColumn;
				const currentPosition = event.operation.position.current;
				const currentPositionX = currentPosition.x ?? layout.initialPositionX;
				const horizontalMovement = currentPositionX - layout.initialPositionX;
				const verticalMovement = currentPosition.y - layout.initialPositionY;

				return {
					layout,
					position: {
						left: layout.initialLeft + horizontalMovement,
						top: layout.initialTop + verticalMovement,
					},
				};
			} );
		},
	} );

	useEffect( () => {
		/* 物理DnD開始直後のidleはSession開始前の一時状態であり、一度activeになったSessionがidleへ戻った場合だけ終了として扱う。 */
		if ( phase === 'idle' ) {
			if ( sessionBecameActive.current ) {
				sessionBecameActive.current = false;
				setMovingColumn( null );
			}
			return;
		}

		sessionBecameActive.current = true;
	}, [ phase ] );

	const activeLayout = movingColumn?.layout ?? null;

	useEffect( () => {
		/* Column DnD Sessionと移動表示の両方が成立している期間だけ、editor全体へ掴んでいるポインター状態を示す。 */
		if ( phase !== 'active' || activeLayout === null ) {
			return;
		}

		activeLayout.editorDocument.body.classList.add( DRAGGING_CLASS );
		return () => {
			activeLayout.editorDocument.body.classList.remove( DRAGGING_CLASS );
		};
	}, [ phase, activeLayout ] );

	const visible = phase === 'active' && movingColumn !== null;

	/* 意味上のColumn DnD Sessionまたは移動表示のどちらかが成立しない間は、利用者向け表示を出さない。 */
	if ( ! visible ) {
		return null;
	}

	return (
		<>
			<ColumnSourceFrame layout={ movingColumn.layout } />
			<ColumnMovingOverlay layout={ movingColumn.layout } position={ movingColumn.position } />
		</>
	);
};
