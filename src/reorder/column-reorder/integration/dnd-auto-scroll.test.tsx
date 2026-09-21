/**
 * Column DnD Engine Integrationが、Production列DnD責務を通して水平自動スクロールをSessionへ接続することを確認する。
 *
 * JSDOMにないscroll・RAFと物理DnD Engineだけを環境境界として代替する。
 */

import {
	type BeforeDragStartEvent,
	type DragEndEvent,
	type DragMoveEvent,
	type DragStartEvent,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
	columnDndInteraction,
	getColumnDndDestinationBoundaryIndex,
	getColumnDndPhase,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import {
	createColumnReorderTestRow,
	createColumnReorderTestTable,
	getColumnReorderTestTable,
	setColumnReorderTestTables,
} from '@/reorder/column-reorder/responsibilities/table-integration.test-utils';
import { reorderMode } from '@/reorder/reorder-mode';
import type { ColumnPointerPosition } from './horizontal-auto-scroll';
import { ColumnDnd } from './dnd';

jest.mock( 'uuid', () => ( { v4: () => 'column-auto-scroll-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: ReactNode } ) => children,
} ) );

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとColumn Reorder責務は実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/column-reorder/responsibilities/table-integration.test-utils'
	).columnReorderTestBlockEditorStore,
} ) );

/* 物理DnDを実行できないJSDOMでは、dnd-kitのEngine境界だけを決定的なTest Doubleにする。 */
jest.mock( '@dnd-kit/dom', () => ( {
	AutoScroller: {},
	Cursor: {},
	PreventSelection: {},
	Feedback: {},
	Draggable: jest.fn(),
	PointerSensor: { configure: jest.fn() },
	PointerActivationConstraints: { Distance: jest.fn(), Delay: jest.fn() },
} ) );
jest.mock( '@dnd-kit/dom/utilities', () => ( { getFrameTransform: jest.fn() } ) );
jest.mock( '@dnd-kit/react', () => ( {
	DragDropProvider: jest.fn( ( props: { children: ReactNode } ) => props.children ),
	useDragDropManager: () => ( { dragOperation: { status: { idle: true } } } ),
	useDragDropMonitor: () => undefined,
} ) );

let mockOnAutoScroll: ( position: ColumnPointerPosition ) => void;
const mockAutoScrollStart = jest.fn();
const mockAutoScrollUpdatePointer = jest.fn();
const mockAutoScrollStop = jest.fn();
jest.mock( './horizontal-auto-scroll', () => ( {
	createColumnHorizontalAutoScroll: ( onScroll: ( position: ColumnPointerPosition ) => void ) => {
		mockOnAutoScroll = onScroll;
		return {
			start: mockAutoScrollStart,
			updatePointer: mockAutoScrollUpdatePointer,
			stop: mockAutoScrollStop,
		};
	},
} ) );

const dragDropProviderMock = DragDropProvider as unknown as jest.Mock;

/** 現在のDragDropProviderへ渡された物理DnD Lifecycle処理を取得する。 */
const getProviderProps = () => {
	const props = dragDropProviderMock.mock.calls.at( -1 )?.[ 0 ];
	if ( ! props ) {
		throw new Error( 'ColumnDnd did not render DragDropProvider.' );
	}
	return props;
};

/** 4列TableとColumn DnD境界を描画する。 */
const renderColumnDnd = () => {
	const view = render(
		<ColumnDnd tableIdentity="table-1">
			{ () => (
				<table aria-label="Column auto scroll test table">
					<tbody>
						<tr>
							<td>column-1</td>
							<td>column-2</td>
							<td>column-3</td>
							<td>column-4</td>
						</tr>
					</tbody>
				</table>
			) }
		</ColumnDnd>
	);
	const table = view.getByRole( 'table', {
		name: 'Column auto scroll test table',
	} ) as HTMLTableElement;
	return { table, cells: Array.from( table.rows[ 0 ]?.cells ?? [] ), provider: getProviderProps() };
};

/**
 * JSDOMにない列配置を提供し、Tableの現在画面位置だけを後から変更できるようにする。
 *
 * @param table 対象Table。
 * @param cells Table内の4セル。
 */
const provideColumnGeometry = (
	table: HTMLTableElement,
	cells: HTMLTableCellElement[]
): { setTableLeft: ( left: number ) => void } => {
	let tableLeft = 0;
	jest.spyOn( table, 'getBoundingClientRect' ).mockImplementation( () => ( {
		top: 0,
		bottom: 40,
		left: tableLeft,
		right: tableLeft + 400,
		width: 400,
		height: 40,
		x: tableLeft,
		y: 0,
		toJSON: () => ( {} ),
	} ) );
	cells.forEach( ( cell, index ) => {
		jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue( {
			top: 0,
			bottom: 40,
			left: index * 100,
			right: ( index + 1 ) * 100,
			width: 100,
			height: 40,
			x: index * 100,
			y: 0,
			toJSON: () => ( {} ),
		} );
	} );
	return {
		setTableLeft: ( left ) => {
			tableLeft = left;
		},
	};
};

/**
 * Production Target ResolutionとLayout Availabilityを通して列DnD Sessionを開始する。
 *
 * @param provider   DnD Engine境界のcallback群。
 * @param sourceCell DnD開始元のセルDOM。
 */
const startPhysicalDrag = (
	provider: ReturnType< typeof getProviderProps >,
	sourceCell: HTMLTableCellElement
): void => {
	provider.onBeforeDragStart( {
		operation: {
			source: {
				data: { tableIdentity: 'table-1', sourceColumnIndex: 0 },
				element: sourceCell,
			},
		},
		preventDefault: jest.fn(),
	} as unknown as BeforeDragStartEvent );
	act( () => {
		provider.onDragStart( {
			operation: { source: { element: sourceCell } },
		} as unknown as DragStartEvent );
	} );
};

/**
 * 現在のポインター位置を持つ物理DnD移動通知を作成する。
 *
 * @param sourceCell DnD開始元のセルDOM。
 */
const createMoveEvent = ( sourceCell: HTMLTableCellElement ): DragMoveEvent =>
	( {
		operation: {
			source: { element: sourceCell },
			position: { initial: { x: 0, y: 0 }, current: { x: 0, y: 0 } },
		},
		nativeEvent: { clientX: 260, clientY: 20 },
	} ) as unknown as DragMoveEvent;

/** 現在Tableの先頭行にあるセル識別値を表示順で取得する。 */
const getCurrentColumnLabels = (): unknown[] => {
	const table = getColumnReorderTestTable( 'table-1' );
	const body = table?.attributes.body as
		| Array< { cells: Array< { content?: unknown } > } >
		| undefined;
	return body?.[ 0 ]?.cells.map( ( cell ) => cell.content ) ?? [];
};

describe( 'Column DnD horizontal auto scroll integration', () => {
	beforeEach( () => {
		columnDndInteraction.cancel();
		reorderMode.observeTable( '__column-auto-scroll-test-reset__' );
		setColumnReorderTestTables( [
			createColumnReorderTestTable( 'table-1', [ createColumnReorderTestRow( 'row-1', 4 ) ] ),
		] );
		reorderMode.select( 'column', 'table-1' );
		jest.clearAllMocks();
	} );

	afterEach( () => {
		columnDndInteraction.cancel();
		reorderMode.observeTable( '__column-auto-scroll-test-reset__' );
		setColumnReorderTestTables( [] );
		jest.restoreAllMocks();
	} );

	/**
	 * 水平自動スクロールでTableの画面位置だけが変化した場合も、現在の移動先を更新できることを確認する。
	 *
	 * 期待結果:
	 * - 最新の物理入力位置をProduction Destination Resolutionで再解決し、境界4へ更新する。
	 */
	it( 'when horizontal auto scroll moves the table without a new pointer move, should resolve and update the destination again', () => {
		const { table, cells, provider } = renderColumnDnd();
		const geometry = provideColumnGeometry( table, cells );
		startPhysicalDrag( provider, cells[ 0 ] );
		const moveEvent = createMoveEvent( cells[ 0 ] );
		act( () => {
			provider.onDragMove( moveEvent );
		} );
		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 3 );

		geometry.setTableLeft( -100 );
		act( () => {
			mockOnAutoScroll( { clientX: 260, clientY: 20 } );
		} );

		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 4 );
	} );

	/**
	 * 物理DnD終了時に水平自動スクロールを停止してからProduction Sessionを確定することを確認する。
	 */
	it( 'when the physical column drag ends, should stop horizontal auto scroll before completing the session', () => {
		const stoppedPhases: string[] = [];
		mockAutoScrollStop.mockImplementation( () => {
			stoppedPhases.push( getColumnDndPhase() );
		} );
		const { table, cells, provider } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		startPhysicalDrag( provider, cells[ 0 ] );
		act( () => {
			provider.onDragMove( {
				...createMoveEvent( cells[ 0 ] ),
				nativeEvent: { clientX: 390, clientY: 20 },
			} as unknown as DragMoveEvent );
		} );

		act( () => {
			provider.onDragEnd( { canceled: false } as DragEndEvent );
		} );

		expect( stoppedPhases ).toContain( 'active' );
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( getCurrentColumnLabels() ).toEqual( [ 'row-1-2', 'row-1-3', 'row-1-4', 'row-1-1' ] );
	} );
} );
