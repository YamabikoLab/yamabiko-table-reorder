/**
 * Column Reorderの挿入位置表示が、DnD中の有効な移動先境界とdrop直後の列領域を正しく表現することを確認する。
 *
 * 移動先解決そのものは重複して検証せず、null時の非表示、LTR / RTLの論理境界表示、表示領域外の非表示、scroll時の再計測、
 * および正常なdrop後の実測列幅枠とcleanupを検証する。
 */

import { act, render } from '@testing-library/react';

import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';
import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { DND_POST_DROP_COLUMN_OUTLINE_DURATION_MS } from '@/reorder/reorder-tuning';

import { ColumnInsertionLine } from './insertion-line';

let mockDestinationBoundaryIndex: number | null = null;
let mockAnimationFrameCallback: FrameRequestCallback | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: () => void;
	onDragEnd?: ( event: { canceled: boolean } ) => void;
} = {};

const requestAnimationFrameMock = jest.fn( ( callback: FrameRequestCallback ): number => {
	mockAnimationFrameCallback = callback;
	return 1;
} );
const cancelAnimationFrameMock = jest.fn();

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@/reorder/column-reorder/integration/source-column-resolution', () => ( {
	resolveColumnSourceIndex: jest.fn(),
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

const resolveColumnSourceIndexMock = resolveColumnSourceIndex as jest.MockedFunction<
	typeof resolveColumnSourceIndex
>;
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
 * 挿入位置表示の成立条件を必要な値だけで表せるDOM矩形を作成する。
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
 * Column Reorderの挿入位置表示を成立させる対象Tableを用意する。
 *
 * @return 移動元セルとTableの表示位置を変更できるmock。
 */
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

/**
 * DnD Engineから対象列の物理DnD開始が通知された状態を作る。
 *
 * @param sourceCell 物理DnDの移動対象として通知するセル。
 */
const startPhysicalDrag = ( sourceCell: HTMLTableCellElement ): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: { source: { element: sourceCell } },
		} );
	} );
};

/**
 * DnD Engineから物理DnD終了が通知された状態を作る。
 *
 * @param canceled DnDがcancelされた終了かどうか。
 */
const endPhysicalDrag = ( canceled: boolean ): void => {
	act( () => {
		mockDragDropMonitor.onDragEnd?.( { canceled } );
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
		jest.useFakeTimers();
		jest.clearAllMocks();
		mockDestinationBoundaryIndex = null;
		mockAnimationFrameCallback = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		resolveColumnSourceIndexMock.mockReturnValue( 1 );
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

	afterEach( () => {
		jest.useRealTimers();
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
	 * 正常なLTR drop後は最後の境界の論理開始側へ移動元列の実測幅で枠を表示することを確認する。
	 *
	 * 事前条件:
	 * - LTR Tableで論理列1を移動している。
	 * - 移動元列幅は開始時境界1から境界2までの120pxである。
	 * - 移動元より後方の境界3に挿入線が表示されている。
	 *
	 * 操作:
	 * - cancelされていない物理DnD終了を通知する。
	 *
	 * 期待結果:
	 * - 挿入線は消える。
	 * - 境界3の論理開始側へ120px幅の列領域枠を表示する。
	 * - 表示時間の経過後に枠を自動で消去する。
	 */
	it( 'when a forward LTR drop completes with a visible insertion line, should show the measured source width before that boundary and then clear it', () => {
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 3;
		rerender( <ColumnInsertionLine /> );
		endPhysicalDrag( false );

		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeNull();
		const outline = document.querySelector(
			'.yamabiko-table-reorder-post-drop-column-outline'
		) as HTMLElement | null;
		expect( outline?.style.left ).toBe( '180px' );
		expect( outline?.style.width ).toBe( '120px' );
		expect( outline?.style.top ).toBe( '0px' );
		expect( outline?.style.height ).toBe( '600px' );

		act( () => {
			jest.advanceTimersByTime( DND_POST_DROP_COLUMN_OUTLINE_DURATION_MS - 1 );
		} );
		expect(
			document.querySelector( '.yamabiko-table-reorder-post-drop-column-outline' )
		).not.toBeNull();

		act( () => {
			jest.advanceTimersByTime( 1 );
		} );
		expect(
			document.querySelector( '.yamabiko-table-reorder-post-drop-column-outline' )
		).toBeNull();
	} );

	/**
	 * RTL Tableで論理前方へdropした場合も、論理方向を対応する物理左側へ変換して枠を表示することを確認する。
	 *
	 * 事前条件:
	 * - RTL Tableで論理列1を移動している。
	 * - 移動元より前方の境界0に挿入線が表示されている。
	 *
	 * 操作:
	 * - cancelされていない物理DnD終了を通知する。
	 *
	 * 期待結果:
	 * - 境界0の物理左側へ移動元列幅120pxの枠を表示する。
	 */
	it( 'when a backward RTL drop completes with a visible insertion line, should place the outline on the corresponding physical side', () => {
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'rtl' );
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 0;
		rerender( <ColumnInsertionLine /> );
		endPhysicalDrag( false );

		const outline = document.querySelector(
			'.yamabiko-table-reorder-post-drop-column-outline'
		) as HTMLElement | null;
		expect( outline?.style.left ).toBe( '320px' );
		expect( outline?.style.width ).toBe( '120px' );
	} );

	/**
	 * LTR Tableで論理前方へdropした場合は、境界の物理右側へ移動元列幅ぶんの枠を表示することを確認する。
	 *
	 * 事前条件:
	 * - LTR Tableで論理列1を移動している。
	 * - 移動元より前方の境界0に挿入線が表示されている。
	 *
	 * 操作:
	 * - cancelされていない物理DnD終了を通知する。
	 *
	 * 期待結果:
	 * - 境界0の物理位置を左端として、右側へ移動元列幅120pxの枠を表示する。
	 */
	it( 'when a backward LTR drop completes with a visible insertion line, should extend the outline to the physical right of that boundary', () => {
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 0;
		rerender( <ColumnInsertionLine /> );
		endPhysicalDrag( false );

		const outline = document.querySelector(
			'.yamabiko-table-reorder-post-drop-column-outline'
		) as HTMLElement | null;
		expect( outline?.style.left ).toBe( '40px' );
		expect( outline?.style.width ).toBe( '120px' );
	} );

	/**
	 * cancelまたは移動元列幅を確定できない終了ではdrop後枠を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 有効な挿入線を表示できるColumn DnDである。
	 *
	 * 操作:
	 * - cancel終了と、移動元論理列を解決できない正常終了をそれぞれ通知する。
	 *
	 * 期待結果:
	 * - どちらの終了でもdrop後枠を表示しない。
	 */
	it( 'when the drag is canceled or the source width cannot be resolved, should not show a post-drop outline', () => {
		const first = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( first.sourceCell );
		mockDestinationBoundaryIndex = 3;
		rerender( <ColumnInsertionLine /> );
		endPhysicalDrag( true );
		expect(
			document.querySelector( '.yamabiko-table-reorder-post-drop-column-outline' )
		).toBeNull();

		resolveColumnSourceIndexMock.mockReturnValue( null );
		const second = createSourceTable();
		startPhysicalDrag( second.sourceCell );
		rerender( <ColumnInsertionLine /> );
		endPhysicalDrag( false );
		expect(
			document.querySelector( '.yamabiko-table-reorder-post-drop-column-outline' )
		).toBeNull();
	} );

	/**
	 * 新しいDnD開始とPresentation終了で前回のdrop後表示とtimerを残さないことを確認する。
	 *
	 * 事前条件:
	 * - 正常なdrop後の列領域枠と自動消去timerが存在する。
	 *
	 * 操作:
	 * - 次のDnDを開始して前回表示を破棄し、そのDnDの正常drop後にPresentationを終了する。
	 *
	 * 期待結果:
	 * - 新しいDnD開始時に前回の枠とtimerを破棄する。
	 * - Presentation終了時に新しいdrop後timerも破棄する。
	 */
	it( 'when another drag starts or the presentation unmounts, should clear the previous post-drop outline timer', () => {
		const first = createSourceTable();
		const { rerender, unmount } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( first.sourceCell );
		mockDestinationBoundaryIndex = 3;
		rerender( <ColumnInsertionLine /> );
		endPhysicalDrag( false );
		expect( jest.getTimerCount() ).toBe( 1 );

		const second = createSourceTable();
		startPhysicalDrag( second.sourceCell );
		expect(
			document.querySelector( '.yamabiko-table-reorder-post-drop-column-outline' )
		).toBeNull();
		expect( jest.getTimerCount() ).toBe( 0 );

		rerender( <ColumnInsertionLine /> );
		endPhysicalDrag( false );
		expect( jest.getTimerCount() ).toBe( 1 );
		unmount();
		expect( jest.getTimerCount() ).toBe( 0 );
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
	 * - 物理DnDをcancel終了し、別の開始後にはPresentationを終了する。
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

		endPhysicalDrag( true );
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
