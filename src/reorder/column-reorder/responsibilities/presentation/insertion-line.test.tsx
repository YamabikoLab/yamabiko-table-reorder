/**
 * Column Reorderの挿入線表示が、DnD Interactionの意味状態とDnD開始時の論理列境界から現在の有効な挿入位置を表現することを確認する。
 *
 * 移動先解決そのものは重複して検証せず、null時の非表示、論理境界への表示、現在の物理横移動方向への追従、
 * RTL変換、scroll時の再計測、およびDnD終了・Presentation終了時の解除を検証する。
 */

import { act, render } from '@testing-library/react';

import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { ColumnInsertionLine } from './insertion-line';

let mockSourceColumnIndex: number | null = null;
let mockDestinationBoundaryIndex: number | null = null;
let mockAnimationFrameCallback: FrameRequestCallback | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
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
 * DnD Engineから1回の横移動が通知された状態を作る。
 *
 * @param currentX 今回移動する直前のオーバーレイX座標。
 * @param nextX    今回移動しようとしているオーバーレイX座標。
 */
const movePhysicalDrag = ( currentX: number, nextX: number ): void => {
	act( () => {
		mockDragDropMonitor.onDragMove?.( {
			to: { x: nextX },
			operation: { position: { current: { x: currentX } } },
		} );
	} );
};

/** scroll通知で予約された次の描画フレームを実行する。 */
const flushAnimationFrame = (): void => {
	const callback = mockAnimationFrameCallback;
	mockAnimationFrameCallback = null;
	act( () => {
		callback?.( 0 );
	} );
};

describe( 'Column insertion line', () => {
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
	 * 有効な移動先境界がない場合は挿入線を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 物理DnDは対象列で開始している。
	 * - DnD Interactionの移動先境界はnullである。
	 *
	 * 操作:
	 * - 挿入位置表示を描画する。
	 *
	 * 期待結果:
	 * - 挿入線は表示されない。
	 */
	it( 'when the destination boundary is null, should not show an insertion line', () => {
		const { sourceCell } = createSourceTable();
		mockSourceColumnIndex = 0;
		render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );

		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-line' )
		).toBeNull();
	} );

	/**
	 * DnD開始直後の有効な移動先境界を、Tableの論理境界へ表示することを確認する。
	 *
	 * 事前条件:
	 * - DnD Interactionは先頭列を移動元、境界2を有効な移動先として保持している。
	 * - 物理横移動方向はまだ確定していない。
	 *
	 * 操作:
	 * - Column DnDを開始して境界2を表示する。
	 *
	 * 期待結果:
	 * - 開始時に計測した論理境界そのものへ、現在表示中のTable縦範囲だけ挿入線を表示する。
	 */
	it( 'when movement direction is not established, should show the line at the logical destination boundary', () => {
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 2;
		rerender( <ColumnInsertionLine /> );

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '240px' );
		expect( line?.style.top ).toBe( '0px' );
		expect( line?.style.height ).toBe( '600px' );
	} );

	/**
	 * 同じ移動先境界のまま右方向から左方向へ反転したとき、挿入線だけが現在方向へ即座に追従することを確認する。
	 *
	 * 事前条件:
	 * - 先頭列を移動対象として境界4に挿入空間が表示されている。
	 * - オーバーレイは右方向へ移動している。
	 *
	 * 操作:
	 * - 移動先境界を変えず、次の移動通知で左方向へ反転する。
	 *
	 * 期待結果:
	 * - 右方向では挿入空間の右端、反転した同じ通知後は左端へ挿入線が切り替わる。
	 */
	it( 'when movement reverses from rightward to leftward without changing the destination boundary, should switch the line to the gap left immediately', () => {
		const { sourceCell } = createSourceTable( 80 );
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionLine /> );

		movePhysicalDrag( 200, 210 );
		expect(
			( document.querySelector( '.yamabiko-table-reorder-column-insertion-line' ) as HTMLElement )
				.style.left
		).toBe( '440px' );

		movePhysicalDrag( 210, 200 );
		expect(
			( document.querySelector( '.yamabiko-table-reorder-column-insertion-line' ) as HTMLElement )
				.style.left
		).toBe( '360px' );
	} );

	/**
	 * RTLでも論理境界をTableの物理横位置へ変換して表示することを確認する。
	 *
	 * 事前条件:
	 * - RTL Tableで境界1が有効な移動先である。
	 * - 物理横移動方向はまだ確定していない。
	 *
	 * 操作:
	 * - Column DnDを開始して境界1を表示する。
	 *
	 * 期待結果:
	 * - Table右端を論理開始端として、境界1に対応する物理位置へ挿入線を表示する。
	 */
	it( 'when the table is RTL, should map the logical destination boundary to the corresponding physical position', () => {
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'rtl' );
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 2;
		mockDestinationBoundaryIndex = 1;
		rerender( <ColumnInsertionLine /> );

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '360px' );
	} );

	/**
	 * DnD開始時の論理境界を維持しながら、入力位置の更新を伴わないスクロールでもTable全体の現在位置変化へ追従することを確認する。
	 *
	 * 事前条件:
	 * - 境界4の挿入線が表示されている。
	 * - DnD開始後にTable全体が横方向へ30px移動する。
	 * - editor document配下のスクロール境界から、バブリングしないscrollが通知される。
	 *
	 * 操作:
	 * - 移動先境界とポインター位置を変えず、scrollだけを通知する。
	 *
	 * 期待結果:
	 * - documentのcapture経路で通知を受け、次の描画フレームで挿入線も30px移動する。
	 * - 開始時に確定した論理列境界自体は再計測しない。
	 */
	it( 'when an editor descendant scrolls without another drag move, should follow the current table position through the captured scroll event', () => {
		const { table, sourceCell, tableRectangleMock } = createSourceTable();
		const scrollContainer = document.createElement( 'div' );
		document.body.appendChild( scrollContainer );
		scrollContainer.appendChild( table );
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionLine /> );

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

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '410px' );
		expect( measureTableColumnBoundaryGeometryMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 現在の移動先境界が横方向のeditor表示領域外にある場合は、画面外の表示要素を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - DnD Interactionは有効な移動元と移動先を保持している。
	 * - 対象境界はeditor表示領域の右側へ完全に外れている。
	 *
	 * 操作:
	 * - 現在の有効移動先を挿入線表示へ反映する。
	 *
	 * 期待結果:
	 * - viewport外の挿入線を描画しない。
	 */
	it( 'when the insertion boundary is outside the viewport, should not render an offscreen line element', () => {
		const { sourceCell, tableRectangleMock } = createSourceTable();
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
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 0;
		rerender( <ColumnInsertionLine /> );

		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-line' )
		).toBeNull();
	} );

	/**
	 * DnD終了後とPresentation境界終了後に挿入線を残さず、予約済みのscroll再計測も破棄することを確認する。
	 *
	 * 事前条件:
	 * - Column DnD中に有効な移動先の挿入線が表示されている。
	 * - scrollによる再計測が次の描画フレームへ予約されている。
	 *
	 * 操作:
	 * - DnDを終了し、別のDnDではPresentation自体を終了する。
	 *
	 * 期待結果:
	 * - DnD終了後とPresentation終了後のいずれも挿入線を残さない。
	 * - Presentation終了時に予約済みの描画フレームを破棄する。
	 */
	it( 'when the drag or presentation ends, should clear the line and cancel a pending scroll measurement', () => {
		const { table, sourceCell } = createSourceTable();
		const scrollContainer = document.createElement( 'div' );
		document.body.appendChild( scrollContainer );
		scrollContainer.appendChild( table );
		const { rerender, unmount } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionLine /> );

		act( () => {
			mockDragDropMonitor.onDragEnd?.();
		} );
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-line' )
		).toBeNull();

		startPhysicalDrag( sourceCell );
		rerender( <ColumnInsertionLine /> );
		act( () => {
			scrollContainer.dispatchEvent( new Event( 'scroll' ) );
		} );
		unmount();

		expect( cancelAnimationFrameMock ).toHaveBeenCalledWith( 1 );
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-insertion-line' )
		).toBeNull();
	} );
} );
