/**
 * Row Reorderの挿入位置表示が、DnD Interactionの有効な移動先境界を対象Tableの論理境界へ正しく表現することを確認する。
 *
 * 移動先解決そのものは重複して検証せず、null時の非表示、先頭・行間・末尾境界への対応、editor表示領域への制限、
 * 現在の縦移動方向に応じた挿入空間端への表示、スクロール時の再計測、およびDnD終了時の表示解除を検証する。
 */

import { act, render } from '@testing-library/react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { RowInsertionLine } from './insertion-line';

let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
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
 * 挿入線の表示条件を必要な値だけで表せるDOM矩形を作成する。
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

/** 挿入位置表示の成立条件を満たす2行の対象Tableを用意する。 */
const createSourceTable = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const first = document.createElement( 'tr' );
	const second = document.createElement( 'tr' );
	first.appendChild( document.createElement( 'td' ) );
	second.appendChild( document.createElement( 'td' ) );
	tbody.append( first, second );
	table.appendChild( tbody );
	document.body.appendChild( table );

	jest
		.spyOn( table, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { left: -20, right: 300, width: 320 } ) );
	const bodyRectangleMock = jest
		.spyOn( tbody, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 80, bottom: 170, height: 90 } ) );
	const firstRectangleMock = jest
		.spyOn( first, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 80, bottom: 120, height: 40 } ) );
	jest
		.spyOn( second, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 120, bottom: 170, height: 50 } ) );

	return { first, second, bodyRectangleMock, firstRectangleMock };
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

/**
 * DnD Engineから1回の縦移動が通知された状態を作る。
 *
 * @param currentY 今回移動する直前のオーバーレイY座標。
 * @param nextY 今回移動しようとしているオーバーレイY座標。
 */
const movePhysicalDrag = ( currentY: number, nextY: number ) => {
	act( () => {
		mockDragDropMonitor.onDragMove?.( {
			to: { y: nextY },
			operation: { position: { current: { y: currentY } } },
		} );
	} );
};

describe( 'Row insertion line', () => {
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
	 * - 有効な移動先境界がない場合は挿入線を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 物理DnDは対象行で開始している。
	 * - DnD Interactionの移動先境界はnullである。
	 *
	 * 操作:
	 * - 挿入位置表示を描画する。
	 *
	 * 期待結果:
	 * - 挿入線は表示されない。
	 */
	it( 'when the destination boundary is null, should not show an insertion line', () => {
		const { first } = createSourceTable();
		render( <RowInsertionLine /> );
		startPhysicalDrag( first );

		expect( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 最初の要素の手前を示す移動先境界を、先頭行の論理的な上端へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 2行のTableで境界0が有効な移動先である。
	 *
	 * 操作:
	 * - 物理DnD開始後に境界0を表示する。
	 *
	 * 期待結果:
	 * - 先頭行の論理的な上端へ挿入線が表示される。
	 */
	it( 'when the destination is before the first row, should show the line at the first logical row top', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionLine /> );

		const line = document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement;
		expect( line ).not.toBeNull();
		expect( line.style.top ).toBe( '80px' );
	} );

	/**
	 * 概要:
	 * - 行間の有効な移動先境界を、その論理境界へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 2行のTableで境界1が有効な移動先である。
	 * - Table左端は表示領域外、右端は表示領域より外側にある。
	 *
	 * 操作:
	 * - 物理DnD開始後に境界1を表示する。
	 *
	 * 期待結果:
	 * - 行間の論理境界へ、現在表示領域とTableが重なる横幅だけ挿入線が表示される。
	 */
	it( 'when an internal destination boundary is active, should show the line at the logical boundary within the visible table width', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 1;
		rerender( <RowInsertionLine /> );

		const line = document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement;
		expect( line ).not.toBeNull();
		expect( line.style.top ).toBe( '120px' );
		expect( line.style.left ).toBe( '0px' );
		expect( line.style.width ).toBe( '240px' );
	} );

	/**
	 * 概要:
	 * - 最後の要素の後ろを示す移動先境界を、最終行の論理的な下端へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 2行のTableで境界2が有効な移動先である。
	 *
	 * 操作:
	 * - 物理DnD開始後に境界2を表示する。
	 *
	 * 期待結果:
	 * - 最終行の論理的な下端へ挿入線が表示される。
	 */
	it( 'when the destination is after the last row, should show the line at the last logical row bottom', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );

		const line = document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement;
		expect( line ).not.toBeNull();
		expect( line.style.top ).toBe( '170px' );
	} );

	/**
	 * 概要:
	 * - 上方向移動で周囲行が押し下げられても、挿入線を挿入空間の上端へ維持することを確認する。
	 *
	 * 事前条件:
	 * - 2行目を移動対象としてDnDを開始している。
	 * - 移動先は先頭境界であり、押しのけ表示によって先頭行の物理位置だけが下へ移動している。
	 *
	 * 操作:
	 * - 上方向の物理移動を通知する。
	 *
	 * 期待結果:
	 * - 挿入線は押し下げられた行へ追従せず、挿入空間の上端へ表示される。
	 */
	it( 'when rows are displaced during an upward move, should keep the line at the insertion gap top', () => {
		const { second, firstRectangleMock } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( second );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionLine /> );

		firstRectangleMock.mockReturnValue( rectangle( { top: 170, bottom: 210, height: 40 } ) );
		movePhysicalDrag( 140, 130 );

		expect(
			( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement ).style
				.top
		).toBe( '80px' );
	} );

	/**
	 * 概要:
	 * - 移動先境界を変えず下方向から上方向へ反転したとき、挿入線だけが現在方向へ即座に追従することを確認する。
	 *
	 * 事前条件:
	 * - 1行目を移動対象として境界2に挿入空間が表示されている。
	 * - オーバーレイは下方向へ移動している。
	 *
	 * 操作:
	 * - 移動先境界を変えず、次の移動通知で上方向へ反転する。
	 *
	 * 期待結果:
	 * - 下方向では挿入空間の下端、反転した同じ通知後は上端へ挿入線が切り替わる。
	 */
	it( 'when movement reverses from downward to upward without changing the destination boundary, should switch the line to the gap top immediately', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );

		movePhysicalDrag( 120, 130 );
		expect(
			( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement ).style
				.top
		).toBe( '170px' );

		movePhysicalDrag( 130, 120 );
		expect(
			( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement ).style
				.top
		).toBe( '130px' );
	} );

	/**
	 * 概要:
	 * - 移動先境界を変えず上方向から下方向へ反転したとき、挿入線だけが現在方向へ即座に追従することを確認する。
	 *
	 * 事前条件:
	 * - 2行目を移動対象として境界0に挿入空間が表示されている。
	 * - オーバーレイは上方向へ移動している。
	 *
	 * 操作:
	 * - 移動先境界を変えず、次の移動通知で下方向へ反転する。
	 *
	 * 期待結果:
	 * - 上方向では挿入空間の上端、反転した同じ通知後は下端へ挿入線が切り替わる。
	 */
	it( 'when movement reverses from upward to downward without changing the destination boundary, should switch the line to the gap bottom immediately', () => {
		const { second } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( second );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionLine /> );

		movePhysicalDrag( 130, 120 );
		expect(
			( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement ).style
				.top
		).toBe( '80px' );

		movePhysicalDrag( 120, 130 );
		expect(
			( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement ).style
				.top
		).toBe( '130px' );
	} );

	/**
	 * 概要:
	 * - 移動先境界が変わらなくても、Table全体の物理移動に伴って論理境界の表示位置を再計測することを確認する。
	 *
	 * 事前条件:
	 * - 境界0の挿入線が先頭境界に表示されている。
	 * - editor内のスクロール等により、tbody全体の表示位置が変化している。
	 *
	 * 操作:
	 * - DnD Engineから縦位置が変わらない物理移動を通知する。
	 *
	 * 期待結果:
	 * - 移動先境界を変更せず、挿入線がtbody全体の現在位置へ追従する。
	 */
	it( 'when the table body moves without changing the destination boundary, should remeasure the current logical boundary position', () => {
		const { first, bodyRectangleMock } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionLine /> );
		expect(
			( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement ).style
				.top
		).toBe( '80px' );

		bodyRectangleMock.mockReturnValue( rectangle( { top: 60, bottom: 150, height: 90 } ) );
		movePhysicalDrag( 100, 100 );

		expect(
			( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement ).style
				.top
		).toBe( '60px' );
	} );

	/**
	 * 概要:
	 * - 物理DnD終了時に、そのDnDの挿入位置表示を残さないことを確認する。
	 *
	 * 事前条件:
	 * - 有効な移動先境界に挿入線が表示されている。
	 *
	 * 操作:
	 * - DnD Engineから物理DnD終了を通知する。
	 *
	 * 期待結果:
	 * - 挿入線が表示から除去される。
	 */
	it( 'when the physical drag ends, should remove the insertion line', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 1;
		rerender( <RowInsertionLine /> );
		expect( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) ).not.toBeNull();

		act( () => {
			mockDragDropMonitor.onDragEnd?.();
		} );

		expect( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) ).toBeNull();
	} );
} );
