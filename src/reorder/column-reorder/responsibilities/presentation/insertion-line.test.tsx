/**
 * Column Reorderの挿入線表示が、DnD Interactionの移動先境界を開始時の論理列配置へ直接対応させることを確認する。
 *
 * 移動先解決そのものは重複して検証せず、null時の非表示、LTR / RTLの論理境界表示、表示領域外の非表示、scroll時の再計測、
 * およびDnD終了・Presentation終了時の解除を検証する。
 */

import { act, render } from '@testing-library/react';

import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { ColumnInsertionLine } from './insertion-line';

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

	return { table, sourceCell, tableRectangleMock };
};

const startPhysicalDrag = ( sourceCell: HTMLTableCellElement ): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: { source: { element: sourceCell } },
		} );
	} );
};

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
			} as unknown as NonNullable< Document[ 'defaultView' ] >,
		} );
	} );

	/**
	 * 有効な移動先境界がない期間は挿入線を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象列で物理DnDが開始されている。
	 * - DnD Interactionの移動先境界はnullである。
	 *
	 * 操作:
	 * - 現在の移動先状態を挿入線表示へ反映する。
	 *
	 * 期待結果:
	 * - 挿入線は表示されない。
	 */
	it( 'when the destination boundary is null, should not show an insertion line', () => {
		const { sourceCell } = createSourceTable();
		render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );

		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeNull();
	} );

	/**
	 * LTR Tableでは有効な移動先境界を開始時の論理列境界へ直接表示することを確認する。
	 *
	 * 事前条件:
	 * - LTR TableでColumn DnDが開始されている。
	 * - 境界2が現在の有効な移動先である。
	 *
	 * 操作:
	 * - 境界2を挿入線表示へ反映する。
	 *
	 * 期待結果:
	 * - 開始時に確定した境界2の物理位置へ挿入線を表示する。
	 * - 表示中のTable縦範囲だけを挿入線の高さとして使用する。
	 */
	it( 'when an LTR destination boundary is valid, should show the line directly at that logical boundary', () => {
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
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
	 * RTL Tableでも論理移動先境界を対応する物理位置へ変換して表示することを確認する。
	 *
	 * 事前条件:
	 * - RTL TableでColumn DnDが開始されている。
	 * - 境界1が現在の有効な移動先である。
	 *
	 * 操作:
	 * - 境界1を挿入線表示へ反映する。
	 *
	 * 期待結果:
	 * - Table右端を論理開始端として、境界1に対応する物理位置へ挿入線を表示する。
	 */
	it( 'when the table is RTL, should map the logical destination boundary to the corresponding physical position', () => {
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'rtl' );
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 1;
		rerender( <ColumnInsertionLine /> );

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '360px' );
	} );

	/**
	 * 入力位置が変わらないscrollでも、固定した論理境界を現在のTable位置へ追従させることを確認する。
	 *
	 * 事前条件:
	 * - 境界4の挿入線が表示されている。
	 * - Column DnD開始後にTable全体の画面上の位置が変化する。
	 *
	 * 操作:
	 * - 移動先境界を変えずにeditor内のscrollを通知する。
	 *
	 * 期待結果:
	 * - 次の描画フレームで挿入線が現在のTable位置へ追従する。
	 * - DnD開始時に確定した論理列境界自体は再計測しない。
	 */
	it( 'when an editor descendant scrolls without another drag move, should follow the current table position through the captured scroll event', () => {
		const { table, sourceCell, tableRectangleMock } = createSourceTable();
		const scrollContainer = document.createElement( 'div' );
		document.body.appendChild( scrollContainer );
		scrollContainer.appendChild( table );
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
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
		flushAnimationFrame();

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '410px' );
		expect( measureTableColumnBoundaryGeometryMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 有効な移動先境界がeditor表示領域の外にある場合は挿入線を描画しないことを確認する。
	 *
	 * 事前条件:
	 * - Column DnDが開始され、移動先境界自体は有効である。
	 * - 対象境界の現在の物理位置はeditor表示領域の横方向外にある。
	 *
	 * 操作:
	 * - 現在の有効な移動先境界を挿入線表示へ反映する。
	 *
	 * 期待結果:
	 * - 表示領域外の挿入線要素を生成しない。
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
		mockDestinationBoundaryIndex = 0;
		rerender( <ColumnInsertionLine /> );

		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeNull();
	} );

	/**
	 * DnD終了またはPresentation終了時に挿入線と予約済み再計測を残さないことを確認する。
	 *
	 * 事前条件:
	 * - Column DnD中に有効な移動先の挿入線が表示されている。
	 * - Presentation終了時にはscrollによる再計測が予約されている。
	 *
	 * 操作:
	 * - 物理DnDを終了し、別の開始後にはPresentationを終了する。
	 *
	 * 期待結果:
	 * - DnD終了後に挿入線を残さない。
	 * - Presentation終了時に予約済みの再計測を破棄する。
	 */
	it( 'when the drag or presentation ends, should clear the line and cancel a pending scroll measurement', () => {
		const { table, sourceCell } = createSourceTable();
		const scrollContainer = document.createElement( 'div' );
		document.body.appendChild( scrollContainer );
		scrollContainer.appendChild( table );
		const { rerender, unmount } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionLine /> );

		act( () => {
			mockDragDropMonitor.onDragEnd?.();
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeNull();

		startPhysicalDrag( sourceCell );
		rerender( <ColumnInsertionLine /> );
		act( () => {
			scrollContainer.dispatchEvent( new Event( 'scroll' ) );
		} );
		unmount();

		expect( cancelAnimationFrameMock ).toHaveBeenCalledWith( 1 );
	} );
} );
