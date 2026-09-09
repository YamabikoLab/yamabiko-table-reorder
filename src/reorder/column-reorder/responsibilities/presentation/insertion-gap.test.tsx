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
let mockAnimationFrameCallback: FrameRequestCallback | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: () => void;
	onDragEnd?: () => void;
} = {};

const requestAnimationFrameMock = jest.fn( ( callback: FrameRequestCallback ): number => {
	mockAnimationFrameCallback = callback;
	return 1;
} );
const cancelAnimationFrameMock = jest.fn();

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
 * @return 対象Table、DnD開始セル、Table位置を変更できる矩形のテスト用差し替え。
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

/**
 * scroll通知で予約された次の描画フレームを実行する。
 */
const flushAnimationFrame = (): void => {
	const callback = mockAnimationFrameCallback;
	mockAnimationFrameCallback = null;
	act( () => {
		callback?.( 0 );
	} );
};

describe( 'Column insertion gap', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockSourceColumnIndex = null;
		mockDestinationBoundaryIndex = null;
		mockAnimationFrameCallback = null;
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
			window: {
				innerWidth: 500,
				innerHeight: 600,
				requestAnimationFrame: requestAnimationFrameMock,
				cancelAnimationFrame: cancelAnimationFrameMock,
			} as unknown as Window,
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
	 * DnD開始時の論理境界を維持しながら、入力位置の更新を伴わないスクロールでもTable全体の現在位置変化へ追従することを確認する。
	 *
	 * 事前条件:
	 * - 論理終了側の挿入空間が表示されている。
	 * - DnD開始後にTable全体が横方向へ30px移動する。
	 * - editor document配下のスクロール境界から、バブリングしないscrollが通知される。
	 *
	 * 操作:
	 * - 移動先境界とポインター位置を変えず、スクロール境界からscrollだけを通知する。
	 *
	 * 期待結果:
	 * - documentのcapture経路で通知を受け、次の描画フレームで挿入空間も30px移動する。
	 * - 開始時に確定した論理列間隔自体は再計測しない。
	 */
	it( 'when an editor descendant scrolls without another drag move, should follow the current table position through the captured scroll event', () => {
		const { table, sourceCell, tableRectangleMock } = createSourceTable( 80 );
		const scrollContainer = document.createElement( 'div' );
		document.body.appendChild( scrollContainer );
		scrollContainer.appendChild( table );
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
			scrollContainer.dispatchEvent( new Event( 'scroll' ) );
		} );
		expect( requestAnimationFrameMock ).toHaveBeenCalledTimes( 1 );
		flushAnimationFrame();

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
	 * DnD Interactionが移動元論理列を所有していない場合に、source DOMから移動方向を推測しないことを確認する。
	 *
	 * 事前条件:
	 * - 物理DnDの開始対象と有効な移動先境界は存在する。
	 * - DnD Interactionには移動元論理列が存在しない。
	 *
	 * 操作:
	 * - 有効な移動先境界を挿入空間表示へ反映する。
	 *
	 * 期待結果:
	 * - 移動方向をPresentation側で補完せず、挿入空間を表示しない。
	 */
	it( 'when DnD Interaction has no source column, should not infer a gap direction from the source DOM', () => {
		const { sourceCell } = createSourceTable( 80 );
		const { rerender } = render( <ColumnInsertionGap /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionGap /> );

		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' ) ).toBeNull();
	} );

	/**
	 * 現在の移動先に対応する挿入空間がeditor表示領域と重ならない場合は、画面外の表示要素を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - DnD Interactionは有効な移動元と移動先を保持している。
	 * - 対象Tableはeditor表示領域の右側へ完全に外れている。
	 *
	 * 操作:
	 * - 現在の有効移動先を挿入空間表示へ反映する。
	 *
	 * 期待結果:
	 * - viewport外の挿入空間を描画しない。
	 */
	it( 'when the insertion gap is outside the viewport, should not render an offscreen gap element', () => {
		const { sourceCell, tableRectangleMock } = createSourceTable( 80 );
		tableRectangleMock.mockReturnValue(
			rectangle( {
				top: 100,
				bottom: 500,
				left: 600,
				right: 1000,
				width: 400,
				height: 400,
			} )
		);
		const { rerender } = render( <ColumnInsertionGap /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionGap /> );

		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' ) ).toBeNull();
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
		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' ) ).toBeNull();

		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionGap /> );
		act( () => {
			mockDragDropMonitor.onDragEnd?.();
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' ) ).toBeNull();

		startPhysicalDrag( sourceCell );
		rerender( <ColumnInsertionGap /> );
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' )
		).not.toBeNull();
		unmount();
		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-gap' ) ).toBeNull();
	} );
} );
