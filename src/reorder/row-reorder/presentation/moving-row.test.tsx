/**
 * Row Reorderの移動対象表示が、DnD Interactionの意味状態とDnD Engineの物理情報を責務どおり組み合わせることを確認する。
 *
 * DnD Interaction本体やDnD Engine本体の実装は重複して検証せず、active Session中だけの表示、
 * 元行のレイアウトを変えない視覚的区別、縦方向追従、Session終了時の表示解除を検証する。
 */

import { act, render } from '@testing-library/react';

import { RowMovingDisplay } from './moving-row';

let rowDndPhase: 'idle' | 'active' = 'idle';
let dragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
} = {};

jest.mock( '../dnd-interaction-react', () => ( {
	useRowDndPhase: () => rowDndPhase,
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof dragDropMonitor ) => {
		dragDropMonitor = monitor;
	},
} ) );

const rectangle = ( values: Partial< DOMRect > ): DOMRect =>
	( {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		width: 0,
		height: 0,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
		...values,
	} ) as DOMRect;

const createSourceTable = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const firstCell = document.createElement( 'td' );
	const secondCell = document.createElement( 'td' );
	firstCell.textContent = 'First';
	secondCell.textContent = '';
	row.append( firstCell, secondCell );
	tbody.appendChild( row );
	table.appendChild( tbody );
	document.body.appendChild( table );

	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			left: 100,
			right: 500,
			width: 400,
		} )
	);
	jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: 80,
			bottom: 120,
			left: 100,
			right: 500,
			width: 400,
			height: 40,
		} )
	);
	jest.spyOn( firstCell, 'getBoundingClientRect' ).mockReturnValue( rectangle( { width: 220 } ) );
	jest.spyOn( secondCell, 'getBoundingClientRect' ).mockReturnValue( rectangle( { width: 180 } ) );

	return { table, row };
};

const startPhysicalDrag = ( row: HTMLTableRowElement ) => {
	act( () => {
		dragDropMonitor.onDragStart?.( {
			operation: {
				source: { element: row },
				position: {
					initial: { y: 100 },
					current: { y: 100 },
				},
			},
		} );
	} );
};

describe( 'Row moving display', () => {
	beforeEach( () => {
		rowDndPhase = 'idle';
		dragDropMonitor = {};
		document.body.replaceChildren();
	} );

	/**
	 * 概要:
	 * - 物理DnD開始だけでは移動表示を成立させず、Row DnD Sessionがactiveになった場合だけ表示することを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineは移動対象行と物理位置を提供できる。
	 * - DnD Interactionはまだidleである。
	 *
	 * 操作:
	 * - 物理DnD開始を通知した後、Row DnD Sessionをactiveへ変更する。
	 *
	 * 期待結果:
	 * - idle中は元行の表示を変更せず、active後に元行をレイアウト不変の状態で視覚的に区別してoverlayを表示する。
	 */
	it( 'when physical drag information exists and the row DnD session becomes active, should show the moving row only for the active session', () => {
		const { table, row } = createSourceTable();
		const { rerender } = render( <RowMovingDisplay /> );

		startPhysicalDrag( row );
		expect( row.style.opacity ).toBe( '' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 1 );

		rowDndPhase = 'active';
		rerender( <RowMovingDisplay /> );

		expect( row.style.opacity ).toBe( '0.35' );
		expect( table.getBoundingClientRect().width ).toBe( 400 );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 2 );
		const overlayTable = document.body.querySelectorAll( 'table' ).item( 1 );
		const overlayCells = overlayTable.querySelectorAll( 'td' );
		expect( overlayCells.item( 0 ).style.width ).toBe( '220px' );
		expect( overlayCells.item( 1 ).style.width ).toBe( '180px' );
	} );

	/**
	 * 概要:
	 * - 移動表示がDnD Engineの物理位置から縦方向だけ現在位置へ追従することを確認する。
	 *
	 * 事前条件:
	 * - Row DnD Sessionがactiveで、開始時の移動表示が成立している。
	 *
	 * 操作:
	 * - DnD Engineから開始位置より30px下の現在位置を通知する。
	 *
	 * 期待結果:
	 * - 移動表示の上端だけが30px下へ移動し、横方向の開始位置は対象Tableの表示位置を維持する。
	 */
	it( 'when the physical drag moves vertically, should follow only the vertical position while keeping the table-aligned horizontal position', () => {
		const { row } = createSourceTable();
		rowDndPhase = 'active';
		render( <RowMovingDisplay /> );
		startPhysicalDrag( row );

		act( () => {
			dragDropMonitor.onDragMove?.( {
				operation: {
					position: {
						current: { y: 130 },
					},
				},
			} );
		} );

		const overlayViewport = Array.from( document.body.children ).find(
			( element ) => ( element as HTMLElement ).style.position === 'fixed'
		) as HTMLElement | undefined;
		expect( overlayViewport?.style.top ).toBe( '110px' );
		expect( overlayViewport?.style.left ).toBe( '100px' );
	} );

	/**
	 * 概要:
	 * - Row DnD Session終了を移動表示の終了条件として扱うことを確認する。
	 *
	 * 事前条件:
	 * - active Session中に元行とoverlayの移動表示が成立している。
	 *
	 * 操作:
	 * - DnD Interactionの意味状態をidleへ変更する。
	 *
	 * 期待結果:
	 * - overlayを解除し、元行の視覚状態をDnD開始前へ戻す。
	 */
	it( 'when the row DnD session becomes idle, should remove the moving display and restore the source row', () => {
		const { row } = createSourceTable();
		rowDndPhase = 'active';
		const { rerender } = render( <RowMovingDisplay /> );
		startPhysicalDrag( row );
		expect( row.style.opacity ).toBe( '0.35' );

		rowDndPhase = 'idle';
		rerender( <RowMovingDisplay /> );

		expect( row.style.opacity ).toBe( '' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 1 );
	} );
} );
