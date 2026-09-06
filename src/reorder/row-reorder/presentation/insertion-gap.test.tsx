/**
 * Row Reorderの挿入空間表示が、押しのけ前の論理境界を基準に移動対象1行分の空間を独立して表示することを確認する。
 */

import { act, render } from '@testing-library/react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { RowInsertionGap } from './insertion-gap';

let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: () => void;
	onDragEnd?: () => void;
} = {};

jest.mock( '@/reorder/row-reorder/dnd-interaction-react', () => ( {
	useRowDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@/reorder/editor-dom-context', () => ( {
	resolveEditorDomContext: jest.fn(),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

const resolveEditorDomContextMock = resolveEditorDomContext as jest.MockedFunction<
	typeof resolveEditorDomContext
>;

/**
 * 挿入空間の表示条件を必要な値だけで表せるDOM矩形を作成する。
 *
 * @param values テスト条件として上書きする表示寸法と位置。
 * @return 指定値以外を0としたDOM矩形。
 */
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

/** 高さの異なる4行を持つ対象Tableを用意する。 */
const createSourceTable = () => {
	const table = document.createElement( 'table' );
	const tableBody = document.createElement( 'tbody' );
	const rows = Array.from( { length: 4 }, () => {
		const row = document.createElement( 'tr' );
		row.appendChild( document.createElement( 'td' ) );
		return row;
	} );
	tableBody.append( ...rows );
	table.appendChild( tableBody );
	document.body.appendChild( table );

	jest
		.spyOn( table, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { left: -20, right: 300, width: 320 } ) );
	const bodyRectangleMock = jest
		.spyOn( tableBody, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 100, bottom: 350, height: 250 } ) );
	jest
		.spyOn( rows[ 0 ], 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 100, bottom: 140, height: 40 } ) );
	jest
		.spyOn( rows[ 1 ], 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 140, bottom: 240, height: 100 } ) );
	jest
		.spyOn( rows[ 2 ], 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 240, bottom: 290, height: 50 } ) );
	jest
		.spyOn( rows[ 3 ], 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 290, bottom: 350, height: 60 } ) );

	return { bodyRectangleMock, rows };
};

/**
 * DnD Engineから対象行の物理DnD開始が通知された状態を作る。
 *
 * @param row 物理DnDの移動対象として通知する行。
 */
const startPhysicalDrag = ( row: HTMLTableRowElement ) => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: { source: { element: row } },
		} );
	} );
};

describe( 'Row insertion gap', () => {
	beforeEach( () => {
		mockDestinationBoundaryIndex = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: { innerWidth: 240, innerHeight: 600 } as Window,
		} );
	} );

	/**
	 * 概要:
	 * - 高さの大きい行を下方向へ移動した場合も、移動先にはその行と同じ高さの1つの挿入空間を表示することを確認する。
	 *
	 * 事前条件:
	 * - 2行目の高さは100pxである。
	 * - DnD開始時の論理的な末尾境界はtbody上端から250pxである。
	 *
	 * 操作:
	 * - 2行目を最後の要素の後ろへ移動する。
	 *
	 * 期待結果:
	 * - 押し上げ後に空く末尾境界直前の100pxを、Tableの表示幅に収まる1つの挿入空間として表示する。
	 */
	it( 'when a tall source row moves downward, should show one gap with the source row height at the displaced destination', () => {
		const { rows } = createSourceTable();
		const { rerender } = render( <RowInsertionGap /> );
		startPhysicalDrag( rows[ 1 ] );
		mockDestinationBoundaryIndex = 4;
		rerender( <RowInsertionGap /> );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-insertion-gap'
		) as HTMLElement | null;
		expect( gap ).not.toBeNull();
		expect( gap?.style.top ).toBe( '250px' );
		expect( gap?.style.height ).toBe( '100px' );
		expect( gap?.style.left ).toBe( '0px' );
		expect( gap?.style.width ).toBe( '240px' );
	} );

	/**
	 * 概要:
	 * - 高さの大きい行を上方向へ移動した場合も、移動先境界から同じ高さの1つの挿入空間を表示することを確認する。
	 *
	 * 事前条件:
	 * - 2行目の高さは100pxである。
	 *
	 * 操作:
	 * - 2行目を最初の要素の手前へ移動する。
	 *
	 * 期待結果:
	 * - 先頭境界から100pxの挿入空間を表示する。
	 */
	it( 'when a tall source row moves upward, should show one gap with the source row height from the destination boundary', () => {
		const { rows } = createSourceTable();
		const { rerender } = render( <RowInsertionGap /> );
		startPhysicalDrag( rows[ 1 ] );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionGap /> );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-insertion-gap'
		) as HTMLElement | null;
		expect( gap ).not.toBeNull();
		expect( gap?.style.top ).toBe( '100px' );
		expect( gap?.style.height ).toBe( '100px' );
	} );

	/**
	 * 概要:
	 * - 押しのけ前の論理境界を維持しながら、スクロールによるTable全体の画面位置変化には追従することを確認する。
	 *
	 * 事前条件:
	 * - 末尾の挿入空間が表示されている。
	 * - DnD開始後にtbody全体が20px上へ移動する。
	 *
	 * 操作:
	 * - 移動先境界を変えずに物理移動を通知する。
	 *
	 * 期待結果:
	 * - 挿入空間も20px上へ移動し、開始時に確定した行間隔自体は変化しない。
	 */
	it( 'when the table position changes during the drag, should follow the current table position without remeasuring displaced rows', () => {
		const { bodyRectangleMock, rows } = createSourceTable();
		const { rerender } = render( <RowInsertionGap /> );
		startPhysicalDrag( rows[ 1 ] );
		mockDestinationBoundaryIndex = 4;
		rerender( <RowInsertionGap /> );

		bodyRectangleMock.mockReturnValue( rectangle( { top: 80, bottom: 330, height: 250 } ) );
		act( () => {
			mockDragDropMonitor.onDragMove?.();
		} );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-insertion-gap'
		) as HTMLElement | null;
		expect( gap?.style.top ).toBe( '230px' );
	} );

	/**
	 * 概要:
	 * - DnD Interactionから有効な移動先がなくなった場合とDnD終了時に、挿入空間を残さないことを確認する。
	 *
	 * 事前条件:
	 * - 2行目が移動対象で、有効な移動先の挿入空間が表示されている。
	 *
	 * 操作:
	 * - 有効な移動先をnullへ変更した後、別の有効な移動先を表示してDnDを終了する。
	 *
	 * 期待結果:
	 * - nullでは表示せず、DnD終了後も一時的な挿入空間を残さない。
	 */
	it( 'when there is no valid destination or the drag ends, should not leave an insertion gap', () => {
		const { rows } = createSourceTable();
		const { rerender } = render( <RowInsertionGap /> );
		startPhysicalDrag( rows[ 1 ] );
		mockDestinationBoundaryIndex = 4;
		rerender( <RowInsertionGap /> );
		expect( document.querySelector( '.yamabiko-table-reorder-insertion-gap' ) ).not.toBeNull();

		mockDestinationBoundaryIndex = null;
		rerender( <RowInsertionGap /> );
		expect( document.querySelector( '.yamabiko-table-reorder-insertion-gap' ) ).toBeNull();

		mockDestinationBoundaryIndex = 4;
		rerender( <RowInsertionGap /> );
		expect( document.querySelector( '.yamabiko-table-reorder-insertion-gap' ) ).not.toBeNull();

		act( () => {
			mockDragDropMonitor.onDragEnd?.();
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-insertion-gap' ) ).toBeNull();
	} );
} );