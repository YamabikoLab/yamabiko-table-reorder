/**
 * 列並び替えのDnD境界が、Production責務と物理DnD Lifecycleを正しく接続することを確認する。
 *
 * Reorder Mode、Target Resolution、Destination Resolution、Input、DnD Interactionは実経路へ接続し、
 * Jestでは実行できない物理DnD EngineとDOM layout・scroll境界だけを代替する。
 */

import {
	AutoScroller,
	type BeforeDragStartEvent,
	Cursor,
	type DragEndEvent,
	type DragMoveEvent,
	type DragStartEvent,
	Draggable,
	Feedback,
	PreventSelection,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { act, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { reorderMode } from '@/reorder/reorder-mode';
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
import { ColumnDnd } from './dnd';

/* @wordpress/componentsが経由するJest非対応のuuid / theme ESM境界だけを決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'column-dnd-test-uuid' } ) );
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
	PointerActivationConstraints: {
		Distance: jest.fn(),
		Delay: jest.fn(),
	},
} ) );

jest.mock( '@dnd-kit/dom/utilities', () => ( {
	getFrameTransform: jest.fn(),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	DragDropProvider: jest.fn( ( props: { children: ReactNode } ) => props.children ),
	useDragDropManager: () => ( { dragOperation: { status: { idle: true } } } ),
	useDragDropMonitor: () => undefined,
} ) );

/* JSDOMにないscroll・RAF境界だけを停止可能なSessionとして代替する。 */
const mockHorizontalAutoScrollStart = jest.fn();
const mockHorizontalAutoScrollUpdatePointer = jest.fn();
const mockHorizontalAutoScrollStop = jest.fn();
jest.mock( './horizontal-auto-scroll', () => ( {
	createColumnHorizontalAutoScroll: () => ( {
		start: mockHorizontalAutoScrollStart,
		updatePointer: mockHorizontalAutoScrollUpdatePointer,
		stop: mockHorizontalAutoScrollStop,
	} ),
} ) );

const dragDropProviderMock = DragDropProvider as unknown as jest.Mock;
const draggableConstructorMock = Draggable as unknown as jest.Mock;
let activeDraggableDestroy: jest.Mock;

/** DnD Engine境界へ渡された最新のcallback群を取得する。 */
const getProviderProps = () => {
	const props = dragDropProviderMock.mock.calls.at( -1 )?.[ 0 ];
	if ( ! props ) {
		throw new Error( 'DragDropProvider props were not captured.' );
	}
	return props;
};

/** Reorder Modeを通常編集へ戻す。 */
const resetReorderMode = (): void => {
	act( () => {
		reorderMode.observeTable( '__column-dnd-test-reset__' );
	} );
};

/** 4列の通常TableをProduction Table Integrationから利用できる状態にする。 */
const setDefaultTable = (): void => {
	setColumnReorderTestTables( [
		createColumnReorderTestTable( 'table-1', [ createColumnReorderTestRow( 'row-1', 4 ) ] ),
	] );
};

/** 現在Tableの先頭行にあるセル識別値を表示順で取得する。 */
const getCurrentColumnLabels = (): unknown[] => {
	const table = getColumnReorderTestTable( 'table-1' );
	const body = table?.attributes.body as
		| Array< { cells: Array< { content?: unknown } > } >
		| undefined;
	return body?.[ 0 ]?.cells.map( ( cell ) => cell.content ) ?? [];
};

/** Column DnD境界と対応する最小Table DOMを描画する。 */
const renderColumnDnd = () => {
	const view = render(
		<ColumnDnd tableIdentity="table-1">
			{ ( onPointerDownCapture ) => (
				<div onPointerDownCapture={ onPointerDownCapture }>
					<table aria-label="Column DnD test table">
						<tbody>
							<tr>
								<td>column-1</td>
								<td>column-2</td>
								<td>column-3</td>
								<td>column-4</td>
							</tr>
						</tbody>
					</table>
				</div>
			) }
		</ColumnDnd>
	);
	const table = view.getByRole( 'table', {
		name: 'Column DnD test table',
	} ) as HTMLTableElement;
	return {
		...view,
		table,
		cells: Array.from( table.rows[ 0 ]?.cells ?? [] ),
		providerProps: getProviderProps(),
	};
};

/**
 * JSDOMに存在しない列配置を、Layout AvailabilityとDestination Resolutionへ与える。
 *
 * @param table 対象Table。
 * @param cells Table内の4セル。
 */
const provideColumnGeometry = ( table: HTMLTableElement, cells: HTMLTableCellElement[] ): void => {
	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( {
		top: 0,
		bottom: 40,
		left: 0,
		right: 400,
		width: 400,
		height: 40,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
	} );
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
};

/**
 * Column Inputへ主マウス入力を送る。
 *
 * @param element 入力対象のTable要素。
 */
const firePrimaryMousePointerDown = ( element: Element ): void => {
	const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
	Object.defineProperties( pointerDown, {
		button: { value: 0 },
		isPrimary: { value: true },
		pointerType: { value: 'mouse' },
		clientX: { value: 10 },
		clientY: { value: 10 },
	} );
	fireEvent( element, pointerDown );
};

/**
 * Production Target ResolutionとLayout Availabilityを通して物理DnD開始を成立させる。
 *
 * @param providerProps     DnD Engine境界のcallback群。
 * @param sourceCell        DnD開始元のセルDOM。
 * @param sourceColumnIndex Table内の移動元論理列位置。
 */
const startPhysicalDrag = (
	providerProps: ReturnType< typeof getProviderProps >,
	sourceCell: HTMLTableCellElement,
	sourceColumnIndex = 0
): void => {
	providerProps.onBeforeDragStart( {
		operation: {
			source: {
				data: { tableIdentity: 'table-1', sourceColumnIndex },
				element: sourceCell,
			},
		},
		preventDefault: jest.fn(),
	} as unknown as BeforeDragStartEvent );
	act( () => {
		providerProps.onDragStart( {
			operation: { source: { element: sourceCell } },
		} as unknown as DragStartEvent );
	} );
};

/**
 * 現在のポインター位置を持つ物理DnD移動通知を作成する。
 *
 * @param sourceCell DnD開始元のセルDOM。
 * @param clientX    現在の水平位置。
 */
const createMoveEvent = ( sourceCell: HTMLTableCellElement, clientX: number ): DragMoveEvent =>
	( {
		operation: {
			source: { element: sourceCell },
			position: { initial: { x: 0, y: 0 }, current: { x: 0, y: 0 } },
		},
		nativeEvent: { clientX, clientY: 20 },
	} ) as unknown as DragMoveEvent;

describe( 'Column DnD Engine Integration', () => {
	beforeEach( () => {
		columnDndInteraction.cancel();
		resetReorderMode();
		setDefaultTable();
		jest.clearAllMocks();
		activeDraggableDestroy = jest.fn();
		draggableConstructorMock.mockImplementation( () => ( { destroy: activeDraggableDestroy } ) );
	} );

	afterEach( () => {
		columnDndInteraction.cancel();
		resetReorderMode();
		setColumnReorderTestTables( [] );
		jest.restoreAllMocks();
	} );

	/** Column ReorderではDnD Engine既定のAuto Scrollを無効化することを確認する。 */
	it( 'when DnD engine plugins are configured, should disable engine auto scroll for column reorder', () => {
		const { providerProps } = renderColumnDnd();
		const unrelatedPlugin = {};

		expect(
			providerProps.plugins( [ unrelatedPlugin, Cursor, PreventSelection, Feedback, AutoScroller ] )
		).toEqual( [ unrelatedPlugin ] );
	} );

	/** 列Reorder ModeでだけColumn Inputが現在Tableの開始入力を受け付けることを確認する。 */
	it( 'when pointer input occurs, should forward it to Column Input only while column reorder mode is active', () => {
		const { getByText } = renderColumnDnd();
		const sourceCell = getByText( 'column-1' );

		firePrimaryMousePointerDown( sourceCell );
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		firePrimaryMousePointerDown( sourceCell );

		expect( draggableConstructorMock ).toHaveBeenCalledTimes( 1 );
	} );

	/** 解決済み対象、論理移動先、確定結果をProduction経路で接続することを確認する。 */
	it( 'when second-stage resolution succeeds and the physical drag completes, should connect the resolved target, logical destination, and complete lifecycle', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const { providerProps, table, cells } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		startPhysicalDrag( providerProps, cells[ 0 ] );
		act( () => {
			providerProps.onDragMove( createMoveEvent( cells[ 0 ], 390 ) );
			providerProps.onDragEnd( { canceled: false } as DragEndEvent );
		} );

		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( getCurrentColumnLabels() ).toEqual( [ 'row-1-2', 'row-1-3', 'row-1-4', 'row-1-1' ] );
	} );

	/** DnD開始時にResolverがなくても、最初の移動通知から解決を開始できることを確認する。 */
	it( 'when destination resolution is unavailable at drag start but available on move, should retry and forward the resolved logical boundary', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const { providerProps, table, cells } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		providerProps.onBeforeDragStart( {
			operation: {
				source: { data: { tableIdentity: 'table-1', sourceColumnIndex: 0 }, element: cells[ 0 ] },
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		act( () => {
			providerProps.onDragStart( {
				operation: { source: { element: undefined } },
			} as unknown as DragStartEvent );
			providerProps.onDragMove( createMoveEvent( cells[ 0 ], 260 ) );
		} );

		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 3 );
	} );

	/** 第二段階の現在Target Resolutionが利用不能なら物理DnDを開始しないことを確認する。 */
	it( 'when second-stage target resolution becomes unavailable, should prevent the physical drag and not start a column session', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const { providerProps, table, cells } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		setColumnReorderTestTables( [] );
		const preventDefault = jest.fn();

		providerProps.onBeforeDragStart( {
			operation: {
				source: { data: { tableIdentity: 'table-1', sourceColumnIndex: 0 }, element: cells[ 0 ] },
			},
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		providerProps.onDragStart();

		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/** 現在の物理列配置が利用不能なら列DnDの副作用を開始しないことを確認する。 */
	it( 'when the current column layout is unavailable before active drag, should reject every column DnD side effect', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const { providerProps, cells } = renderColumnDnd();
		const preventDefault = jest.fn();

		providerProps.onBeforeDragStart( {
			operation: {
				source: { data: { tableIdentity: 'table-1', sourceColumnIndex: 0 }, element: cells[ 0 ] },
			},
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		providerProps.onDragStart();

		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( mockHorizontalAutoScrollStart ).not.toHaveBeenCalled();
	} );

	/** Session開始前の物理DnD正常終了を意味的な終了処理へ接続しないことを確認する。 */
	it( 'when a physical drag ends normally before the column session starts, should not complete or cancel a session', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const before = getCurrentColumnLabels();
		const { providerProps, table, cells } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		providerProps.onBeforeDragStart( {
			operation: {
				source: { data: { tableIdentity: 'table-1', sourceColumnIndex: 0 }, element: cells[ 0 ] },
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		providerProps.onDragEnd( { canceled: false } as DragEndEvent );

		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( getCurrentColumnLabels() ).toEqual( before );
	} );

	/** Session開始前の物理DnD取消終了を意味的な終了処理へ接続しないことを確認する。 */
	it( 'when a physical drag is canceled before the column session starts, should not complete or cancel a session', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const before = getCurrentColumnLabels();
		const { providerProps, table, cells } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		providerProps.onBeforeDragStart( {
			operation: {
				source: { data: { tableIdentity: 'table-1', sourceColumnIndex: 0 }, element: cells[ 0 ] },
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		providerProps.onDragEnd( { canceled: true } as DragEndEvent );

		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( getCurrentColumnLabels() ).toEqual( before );
	} );

	/** Reorder Mode離脱時に未使用の開始解決結果とDraggable登録を即時破棄することを確認する。 */
	it( 'when column reorder mode ends, should discard the resolved start and active draggable without a React rerender', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const { providerProps, table, cells, getByText } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		firePrimaryMousePointerDown( getByText( 'column-1' ) );
		providerProps.onBeforeDragStart( {
			operation: {
				source: { data: { tableIdentity: 'table-1', sourceColumnIndex: 0 }, element: cells[ 0 ] },
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		providerProps.onDragStart( {
			operation: { source: { element: cells[ 0 ] } },
		} as unknown as DragStartEvent );

		expect( activeDraggableDestroy ).toHaveBeenCalledTimes( 1 );
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/** Session開始済みの物理DnD取消終了をProductionのSession取消へ接続することを確認する。 */
	it( 'when the physical drag ends as canceled, should cancel the column session without completing it', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const before = getCurrentColumnLabels();
		const { providerProps, table, cells } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		startPhysicalDrag( providerProps, cells[ 0 ] );

		act( () => {
			providerProps.onDragEnd( { canceled: true } as DragEndEvent );
		} );

		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( getCurrentColumnLabels() ).toEqual( before );
	} );

	/** Session開始後に一時状態を破棄しても、開始済みSessionを正常終了できることを確認する。 */
	it( 'when transient state is cleared after the column session starts, should still complete the session on drag end', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const { providerProps, table, cells } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		startPhysicalDrag( providerProps, cells[ 0 ] );
		act( () => {
			providerProps.onDragMove( createMoveEvent( cells[ 0 ], 390 ) );
			reorderMode.select( 'column', 'table-1' );
		} );

		act( () => {
			providerProps.onDragEnd( { canceled: false } as DragEndEvent );
		} );

		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( getCurrentColumnLabels() ).toEqual( [ 'row-1-2', 'row-1-3', 'row-1-4', 'row-1-1' ] );
		expect( reorderMode.getMode( 'table-1' ) ).toBe( 'edit' );
	} );

	/** 終了済みの物理DnD試行情報を次の試行へ持ち越さないことを確認する。 */
	it( 'when a later physical column drag ends before session start, should not reuse the prior attempt state', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		const { providerProps, table, cells } = renderColumnDnd();
		provideColumnGeometry( table, cells );
		startPhysicalDrag( providerProps, cells[ 0 ] );
		act( () => {
			providerProps.onDragEnd( { canceled: false } as DragEndEvent );
		} );
		providerProps.onBeforeDragStart( {
			operation: {
				source: { data: { tableIdentity: 'table-1', sourceColumnIndex: 0 }, element: cells[ 0 ] },
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		expect( () => {
			providerProps.onDragEnd( { canceled: false } as DragEndEvent );
		} ).not.toThrow();
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );
} );
