/**
 * Column Reorderの挿入空間表示が、DnD Interactionの意味状態とDnD開始時の論理列境界から移動対象1列分の空間を独立表示することを確認する。
 */

import { act, render } from '@testing-library/react';

import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { ColumnInsertionGap } from './insertion-gap';

let mockSourceColumnIndex: number | null = null;
let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: () => void;
	onDragEnd?: () => void;
} = {};

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndSourceColumnIndex: () => mockSourceColumnIndex,
	useColumnDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@/reorder/column-reorder/infrastructure/column-geometry', () => ( {
	measureTableColumnBoundaryGeometry: jest.fn(),
	resolveTableColumnInlineDirection: jest.fn(),
} ) );

jest.mock( '@/reorder/editor-dom-context', () => ( {
	resolveEditorDomContext: jest.fn(),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

const measureTableColumnBoundaryGeometryMock =
	measureTableColumnBoundaryGeometry as jest.MockedFunction<
		typeof measureTableColumnBoundaryGeometry
	>;
const resolveTableColumnInlineDirectionMock =
	resolveTableColumnInlineDirection as jest.MockedFunction<
		typeof resolveTableColumnInlineDirection
	>;
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

/**
 * 開始時の論理列境界を持つColumn Reorder対象Tableを作成する。
 *
 * @param sourceWidth 移動対象列の開始時表示幅。
 * @return 対象Table、DnD開始セル、Table位置を変更できる矩形mock。
 */
const createSourceTable = ( sourceWidth = 80 ) => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const sourceCell = document.createElement( 'td' );
	row.appendChild( sourceCell );
	tbody.appendChild( row );
	table.appendChild( tbody );
	document.body.appendChild( table );

	const tableRectangleMock = jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: -100,
			bottom: 700,
			left: 40,
			right: 440,
			width: 400,
			height: 800,
		} )
	);
	jest
		.spyOn( sourceCell, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { width: sourceWidth } ) );

	return { table, sourceCell, tableRectangleMock };
};

/**
 * DnD EngineからColumnの物理DnD開始が通知された状態を作る。
 *
 * @param sourceCell DnD開始対象として通知するTableセル。
 */
const startPhysicalDrag = ( sourceCell: HTMLTableCellElement ): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: { source: { element: sourceCell } },
		} );
	} );
};

describe( 'Column insertion gap', () => {
	beforeEach( () => {
		mockSourceColumnIndex = null;
		mockDestinationBoundaryIndex = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		measureTableColumnBoundaryGeometryMock.mockReturnValue( [
			{ index: 0, offset: 0 },
			{ index: 1, offset: 80 },
			{ index: 2, offset: 200 },
			{ index: 3, offset: 260 },
			{ index: 4, offset: 400 },
		] );
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'ltr' );
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: { innerWidth: 500, innerHeight: 600 } as Window,
		} );
	} );

	/**
	 * 幅の異なる列間を論理終了側へ移動しても、移動先周辺列ではなく移動対象列の幅で挿入空間を表示することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象列幅は80pxで、移動先側には140px幅の論理列がある。
	 * - DnD Interactionは移動元を先頭列、移動先をTable末尾境界として保持している。
	 *
	 * 操作:
	 * - Column DnDを開始して末尾境界を有効な移動先として表示する。
	 *
	 * 期待結果:
	 * - 末尾境界直前に80px幅の挿入空間を表示する。
	 */
	it( 'when moving toward logical end across unequal columns, should show the gap with the source column width before the destination boundary', () => {
		const { sourceCell } = createSourceTable( 80 );
		const { rerender } = render( <ColumnInsertionGap /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionGap /> );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-gap'
		) as HTMLElement | null;
		expect( gap ).not.toBeNull();
		expect( gap?.style.left ).toBe( '360px' );
		expect( gap?.style.width ).toBe( '80px' );
		expect( gap?.style.top ).toBe( '0px' );
		expect( gap?.style.height ).toBe( '600px' );
	} );

	/**
	 * 論理開始側への移動では、移動先境界から論理終了方向へ移動対象列幅の空間を表示することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象列幅は60pxで、DnD Interactionが移動元論理列を3列目として保持している。
	 *
	 * 操作:
	 * - 2列目直前の境界を有効な移動先として表示する。
	 *
	 * 期待結果:
	 * - 移動先境界を開始位置として論理終了方向へ60pxの挿入空間を表示する。
	 */
	it( 'when moving toward logical start, should show the gap from the destination boundary toward logical end', () => {
		const { sourceCell } = createSourceTable( 60 );
		const { rerender } = render( <ColumnInsertionGap /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 2;
		mockDestinationBoundaryIndex = 1;
		rerender( <ColumnInsertionGap /> );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-gap'
		) as HTMLElement | null;
		expect( gap?.style.left ).toBe( '120px' );
		expect( gap?.style.width ).toBe( '60px' );
	} );

	/**
	 * RTLでも物理左右ではなくTableの論理列方向を基準に挿入空間を配置することを確認する。
	 *
	 * 事前条件:
	 * - RTL Tableで移動対象列幅は60px、移動元は3列目である。
	 *
	 * 操作:
	 * - 論理先頭境界を有効な移動先として表示する。
	 *
	 * 期待結果:
	 * - Table右端から論理終了方向へ60pxの挿入空間を表示する。
	 */
	it( 'when the table is RTL, should map the logical gap position to the corresponding physical side', () => {
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'rtl' );
		const { sourceCell } = createSourceTable( 60 );
		const { rerender } = render( <ColumnInsertionGap /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 2;
		mockDestinationBoundaryIndex = 0;
		rerender( <ColumnInsertionGap /> );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-gap'
		) as HTMLElement | null;
		expect( gap?.style.left ).toBe( '380px' );
		expect( gap?.style.width ).toBe( '60px' );
	} );

	/**
	 * DnD開始時の論理境界を維持しながら、スクロールによるTable全体の現在位置変化へ追従することを確認する。
	 *
	 * 事前条件:
	 * - 論理終了側の挿入空間が表示されている。
	 * - DnD開始後にTable全体が横方向へ30px移動する。
	 *
	 * 操作:
	 * - 移動先境界を変えずに物理移動を通知する。
	 *
	 * 期待結果:
	 * - 挿入空間も30px移動し、開始時に確定した論理列間隔自体は再計測しない。
	 */
	it( 'when the table position changes during the drag, should follow the current table position without remeasuring displaced columns', () => {
		const { sourceCell, tableRectangleMock } = createSourceTable( 80 );
		const { rerender } = render( <ColumnInsertionGap /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionGap /> );

		tableRectangleMock.mockReturnValue(
			rectangle( {
				top: -100,
				bottom: 700,
				left: 10,
				right: 410,
				width: 400,
				height: 800,
			} )
		);
		act( () => {
			mockDragDropMonitor.onDragMove?.();
		} );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-gap'
		) as HTMLElement | null;
		expect( gap?.style.left ).toBe( '330px' );
		expect( measureTableColumnBoundaryGeometryMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * Tableのうち現在のeditor表示領域と重なる縦範囲だけへ挿入空間を描画することを確認する。
	 *
	 * 事前条件:
	 * - Tableは表示領域より上から始まり、表示領域下端より下まで続いている。
	 *
	 * 操作:
	 * - 有効な移動先を表示する。
	 *
	 * 期待結果:
	 * - Table全高ではなく現在表示中の600pxだけを挿入空間として描画する。
	 */
	it( 'when the table extends beyond the viewport, should draw only the vertically visible table range', () => {
		const { sourceCell } = createSourceTable( 80 );
		const { rerender } = render( <ColumnInsertionGap /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionGap /> );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-gap'
		) as HTMLElement | null;
		expect( gap?.style.top ).toBe( '0px' );
		expect( gap?.style.height ).toBe( '600px' );
	} );

	/**
	 * 有効な移動先がない期間とDnD終了後、およびPresentation境界終了後に挿入空間を残さないことを確認する。
	 *
	 * 事前条件:
	 * - Column DnD中に有効な移動先の挿入空間が表示されている。
	 *
	 * 操作:
	 * - 有効な移動先を解除し、再表示後にDnDを終了する。さらに別のDnDで表示した状態からPresentationを終了する。
	 *
	 * 期待結果:
	 * - 有効な移動先がない場合、DnD終了後、Presentation終了後のいずれも一時表示を残さない。
	 */
	it( 'when there is no valid destination or the drag or presentation ends, should not leave an insertion gap', () => {
		const { sourceCell } = createSourceTable( 80 );
		const { rerender, unmount } = render( <ColumnInsertionGap /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionGap /> );
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' )
		).not.toBeNull();

		mockDestinationBoundaryIndex = null;
		rerender( <ColumnInsertionGap /> );
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' )
		).toBeNull();

		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionGap /> );
		act( () => {
			mockDragDropMonitor.onDragEnd?.();
		} );
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' )
		).toBeNull();

		startPhysicalDrag( sourceCell );
		rerender( <ColumnInsertionGap /> );
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' )
		).not.toBeNull();
		unmount();
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' )
		).toBeNull();
	} );
} );
