/**
 * Reorder Presentationが、実Tableの配置を変更せずに移動対象行の独立表示を描画することを確認する。
 *
 * DnD Engineから受け取る開始・移動・終了だけを入力とし、横方向の表示範囲、縦方向の追従、
 * 元行のレイアウト不変な視覚区別、および空セルを含むセル配置の維持を検証する。
 */

import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/dom';
import { act, render, screen } from '@testing-library/react';

import { RowReorderPresentation } from './presentation';

type MonitorHandlers = {
	onDragStart: ( event: DragStartEvent ) => void;
	onDragMove: ( event: DragMoveEvent ) => void;
	onDragEnd: ( event: DragEndEvent ) => void;
};

let mockMonitorHandlers: MonitorHandlers | null = null;

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: jest.fn( ( handlers: MonitorHandlers ) => {
		mockMonitorHandlers = handlers;
	} ),
} ) );

const rectangle = ( values: {
	top: number;
	left: number;
	width: number;
	height: number;
} ): DOMRect => {
	const { top, left, width, height } = values;
	return {
		top,
		left,
		width,
		height,
		right: left + width,
		bottom: top + height,
		x: left,
		y: top,
		toJSON: () => ( {} ),
	};
};

const createSourceRow = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const firstCell = document.createElement( 'td' );
	const emptyCell = document.createElement( 'td' );
	firstCell.textContent = 'Alpha';
	row.append( firstCell, emptyCell );
	tbody.appendChild( row );
	table.appendChild( tbody );

	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( { top: 80, left: -40, width: 300, height: 120 } )
	);
	jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( { top: 100, left: -40, width: 300, height: 40 } )
	);
	jest.spyOn( firstCell, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( { top: 100, left: -40, width: 120, height: 40 } )
	);
	jest.spyOn( emptyCell, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( { top: 100, left: 80, width: 180, height: 40 } )
	);

	return { row };
};

const getMonitorHandlers = (): MonitorHandlers => {
	if ( mockMonitorHandlers === null ) {
		throw new Error( 'DnD monitor handlers were not captured.' );
	}
	return mockMonitorHandlers;
};

describe( 'Row Reorder Presentation', () => {
	beforeEach( () => {
		mockMonitorHandlers = null;
		document.body.replaceChildren();
	} );

	/**
	 * 概要:
	 * - 移動対象行を元位置に残したまま、Tableと現在表示領域の交差範囲へ独立した移動表示を描画することを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの左側40pxが現在表示領域の外にあり、移動対象行には内容のあるセルと空セルが存在する。
	 * - 元行にはDnD開始前から透明度が設定されている。
	 *
	 * 操作:
	 * - DnD開始後に縦方向へ35px移動し、その後DnDを終了する。
	 *
	 * 期待結果:
	 * - overlayはTableと現在表示領域が重なる横幅だけ表示され、横位置は移動せず縦方向だけ35px追従する。
	 * - 空セルを含む各セルは元行の幅を維持し、元行はDnD中だけ視覚的に区別される。
	 * - DnD終了後はoverlayが解除され、元行の透明度が開始前の値へ戻る。
	 */
	it( 'when a row drag moves vertically, should render a clipped row overlay and preserve the source row layout', () => {
		const { row } = createSourceRow();
		row.style.opacity = '0.8';
		render( <RowReorderPresentation /> );
		const handlers = getMonitorHandlers();

		act( () => {
			handlers.onDragStart( {
				operation: {
					source: { element: row },
					position: {
						initial: { x: 10, y: 200 },
						current: { x: 10, y: 200 },
					},
				},
			} as unknown as DragStartEvent );
		} );

		const overlayText = screen.getByText( 'Alpha' );
		const overlayTable = overlayText.closest( 'table' );
		const overlay = overlayTable?.parentElement;
		const clonedRow = overlayTable?.rows.item( 0 ) ?? null;

		expect( overlay ).not.toBeNull();
		expect( overlay?.style.left ).toBe( '0px' );
		expect( overlay?.style.width ).toBe( '260px' );
		expect( overlay?.style.top ).toBe( '100px' );
		expect( clonedRow?.cells.item( 0 )?.style.width ).toBe( '120px' );
		expect( clonedRow?.cells.item( 1 )?.style.width ).toBe( '180px' );
		expect( row.style.opacity ).toBe( '0.35' );

		act( () => {
			handlers.onDragMove( {
				operation: {
					position: {
						initial: { x: 10, y: 200 },
						current: { x: 200, y: 235 },
					},
				},
			} as unknown as DragMoveEvent );
		} );

		expect( overlay?.style.left ).toBe( '0px' );
		expect( overlay?.style.top ).toBe( '135px' );

		act( () => {
			handlers.onDragEnd( {} as DragEndEvent );
		} );

		expect( screen.queryByText( 'Alpha' ) ).toBeNull();
		expect( row.style.opacity ).toBe( '0.8' );
	} );
} );
