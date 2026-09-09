/**
 * Column Reorderの挿入空間が、DnD開始時に見えている移動対象列の実セル境界を横罫線として維持することを確認する。
 */

import { act, render } from '@testing-library/react';

import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { ColumnInsertionGap } from './insertion-gap';

let mockSourceColumnIndex: number | null = 0;
let mockDestinationBoundaryIndex: number | null = 2;
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
 * 表示位置と寸法だけを指定したDOM矩形を作成する。
 *
 * @param values テスト条件として指定する表示位置と寸法。
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
 * 横罫線検証に必要なColumn Reorder対象Tableを構成する。
 *
 * @param tableRect Table全体の現在位置。
 * @param cellRects 移動対象列を構成する実セルの現在位置。
 * @return Table、DnD開始セル、Table位置を変更できる矩形の差し替え。
 */
const createTable = ( tableRect: DOMRect, cellRects: DOMRect[] ) => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const cells = cellRects.map( ( cellRect ) => {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue( cellRect );
		row.appendChild( cell );
		tbody.appendChild( row );
		return cell;
	} );
	const sourceCell = cells[ 0 ];
	if ( sourceCell === undefined ) {
		throw new Error( 'Column insertion gap test requires at least one source cell.' );
	}
	table.appendChild( tbody );
	document.body.appendChild( table );
	const tableRectangleMock = jest
		.spyOn( table, 'getBoundingClientRect' )
		.mockReturnValue( tableRect );
	return { table, sourceCell, cells, tableRectangleMock };
};

/**
 * DnD開始位置の縦座標に存在する移動対象列セルを返すeditor表示を作る。
 *
 * @param cells 移動対象列を構成するセル。
 */
const installElementFromPoint = ( cells: HTMLTableCellElement[] ): void => {
	Object.defineProperty( document, 'elementFromPoint', {
		configurable: true,
		value: jest.fn( ( _x: number, y: number ) => {
			const cell = cells.find( ( candidate ) => {
				const current = candidate.getBoundingClientRect();
				return y >= current.top && y < current.bottom;
			} );
			return cell ?? null;
		} ),
	} );
};

/**
 * Column DnDの物理開始を通知する。
 *
 * @param sourceCell DnD開始セル。
 */
const startDrag = ( sourceCell: HTMLTableCellElement ): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: {
				source: { element: sourceCell },
				position: { initial: { x: 50, y: 0 } },
			},
		} );
	} );
};

/** 挿入空間内に描画された横罫線の現在位置を返す。 */
const getBoundaryTops = (): string[] =>
	Array.from(
		document.querySelectorAll< HTMLElement >(
			'.yamabiko-table-reorder-column-insertion-gap-cell-boundary'
		)
	).map( ( boundary ) => boundary.style.top );

describe( 'Column insertion gap cell boundaries', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		document.body.replaceChildren();
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 2;
		mockDragDropMonitor = {};
		measureTableColumnBoundaryGeometryMock.mockReturnValue( [
			{ index: 0, offset: 0 },
			{ index: 1, offset: 80 },
			{ index: 2, offset: 160 },
		] );
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'ltr' );
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: {
				innerWidth: 500,
				innerHeight: 300,
				requestAnimationFrame: ( callback: FrameRequestCallback ) => {
					callback( 0 );
					return 1;
				},
				cancelAnimationFrame: jest.fn(),
			} as unknown as Window,
		} );
	} );

	/**
	 * 通常の複数行Tableでは、移動対象列の実セル境界を重複なく挿入空間へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象列は高さ100pxの3セルで構成されている。
	 *
	 * 操作:
	 * - Column DnDを開始して有効な移動先を表示する。
	 *
	 * 期待結果:
	 * - Table外周を除く100pxと200pxの内部境界だけが1本ずつ表示される。
	 */
	it( 'when visible source cells share row boundaries, should render each internal boundary once', () => {
		const { sourceCell, cells } = createTable(
			rectangle( { top: 0, bottom: 300, left: 0, right: 160, width: 160, height: 300 } ),
			[
				rectangle( { top: 0, bottom: 100, left: 0, right: 80, width: 80, height: 100 } ),
				rectangle( { top: 100, bottom: 200, left: 0, right: 80, width: 80, height: 100 } ),
				rectangle( { top: 200, bottom: 300, left: 0, right: 80, width: 80, height: 100 } ),
			]
		);
		installElementFromPoint( cells );
		const { rerender } = render( <ColumnInsertionGap /> );
		startDrag( sourceCell );
		rerender( <ColumnInsertionGap /> );
		expect( getBoundaryTops() ).toEqual( [ '100px', '200px' ] );
	} );

	/**
	 * 縦結合セルが複数行分を占める場合、そのセル内部へ存在しない横罫線を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - 移動対象列の先頭セルは200pxの高さで2行分を占め、その下に100pxのセルがある。
	 *
	 * 操作:
	 * - Column DnDを開始して有効な移動先を表示する。
	 *
	 * 期待結果:
	 * - 縦結合セル内部の100px位置には線を作らず、実セル境界の200px位置だけを表示する。
	 */
	it( 'when a visible source cell spans multiple rows, should not invent a boundary inside the merged cell', () => {
		const { sourceCell, cells } = createTable(
			rectangle( { top: 0, bottom: 300, left: 0, right: 160, width: 160, height: 300 } ),
			[
				rectangle( { top: 0, bottom: 200, left: 0, right: 80, width: 80, height: 200 } ),
				rectangle( { top: 200, bottom: 300, left: 0, right: 80, width: 80, height: 100 } ),
			]
		);
		installElementFromPoint( cells );
		const { rerender } = render( <ColumnInsertionGap /> );
		startDrag( sourceCell );
		rerender( <ColumnInsertionGap /> );
		expect( getBoundaryTops() ).toEqual( [ '200px' ] );
	} );

	/**
	 * Table途中からviewportが始まる場合、取得セル群の端にあるTable内部境界を失わないことを確認する。
	 *
	 * 事前条件:
	 * - Table上端はviewportより100px上にあり、最初に見えるセルの上端と下端はいずれもTable内部境界である。
	 *
	 * 操作:
	 * - Column DnDを開始してviewport内の挿入空間を表示する。
	 *
	 * 期待結果:
	 * - viewport subsetの先頭・末尾という理由では境界を除外せず、clip後の正しい位置へ表示する。
	 */
	it( 'when the viewport starts inside the table, should keep internal boundaries at the edges of the captured subset', () => {
		const { sourceCell, cells } = createTable(
			rectangle( { top: -100, bottom: 300, left: 0, right: 160, width: 160, height: 400 } ),
			[
				rectangle( { top: -50, bottom: 50, left: 0, right: 80, width: 80, height: 100 } ),
				rectangle( { top: 50, bottom: 150, left: 0, right: 80, width: 80, height: 100 } ),
			]
		);
		installElementFromPoint( cells );
		const { rerender } = render( <ColumnInsertionGap /> );
		startDrag( sourceCell );
		rerender( <ColumnInsertionGap /> );
		expect( getBoundaryTops() ).toEqual( [ '-50px', '50px', '150px' ] );
	} );

	/**
	 * DnD開始後の縦スクロールでは、新たにセル境界を取得せず開始時境界の現在位置だけへ追従することを確認する。
	 *
	 * 事前条件:
	 * - DnD開始時にTable内部の100px境界が取得されている。
	 *
	 * 操作:
	 * - Tableを30px上へ移動させ、editor内のscrollを通知する。
	 *
	 * 期待結果:
	 * - 取得済み100px境界が挿入空間内で30px上へ移動し、開始時のセル探索は繰り返されない。
	 */
	it( 'when the table scrolls after drag start, should reposition the captured boundaries without taking a new snapshot', () => {
		const { sourceCell, cells, tableRectangleMock } = createTable(
			rectangle( { top: 0, bottom: 300, left: 0, right: 160, width: 160, height: 300 } ),
			[
				rectangle( { top: 0, bottom: 100, left: 0, right: 80, width: 80, height: 100 } ),
				rectangle( { top: 100, bottom: 200, left: 0, right: 80, width: 80, height: 100 } ),
			]
		);
		installElementFromPoint( cells );
		const elementFromPointMock = document.elementFromPoint as jest.MockedFunction<
			typeof document.elementFromPoint
		>;
		const { rerender } = render( <ColumnInsertionGap /> );
		startDrag( sourceCell );
		rerender( <ColumnInsertionGap /> );
		const snapshotCalls = elementFromPointMock.mock.calls.length;
		expect( getBoundaryTops() ).toEqual( [ '100px', '200px' ] );

		tableRectangleMock.mockReturnValue(
			rectangle( { top: -30, bottom: 270, left: 0, right: 160, width: 160, height: 300 } )
		);
		act( () => {
			document.dispatchEvent( new Event( 'scroll' ) );
		} );

		expect( getBoundaryTops() ).toEqual( [ '70px', '170px' ] );
		expect( elementFromPointMock ).toHaveBeenCalledTimes( snapshotCalls );
	} );
} );
