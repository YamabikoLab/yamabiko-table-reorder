/**
 * 行並び替えのDnD境界が、Production責務と物理DnD Lifecycleを正しく接続することを確認する。
 *
 * Reorder Mode、Target Resolution、Destination Resolution、Input、DnD Interactionは実経路へ接続し、
 * Jestでは実行できない物理DnD EngineとDOM layoutだけを環境境界として代替する。
 */

import {
	AutoScroller,
	type BeforeDragStartEvent,
	type DragEndEvent,
	type DragMoveEvent,
	type DragStartEvent,
	Draggable,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { act, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { reorderMode } from '@/reorder/reorder-mode';
import {
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	rowDndInteraction,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import {
	createRowReorderTestRow,
	createRowReorderTestTable,
	getRowReorderTestTable,
	setRowReorderTestTables,
} from '@/reorder/row-reorder/responsibilities/table-integration.test-utils';
import { RowDnd } from './dnd';

/* @wordpress/componentsが経由するJest非対応のuuid / theme ESM境界だけを決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'row-dnd-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: ReactNode } ) => children,
} ) );

/* Jestで直接読み込めないBlock Editor Store境界だけを代替し、WordPress DataとRow Reorder責務は実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( '@/reorder/row-reorder/responsibilities/table-integration.test-utils' )
		.rowReorderTestBlockEditorStore,
} ) );

/* 物理DnDを実行できないJSDOMでは、dnd-kitのEngine境界だけを決定的なTest Doubleにする。 */
jest.mock( '@dnd-kit/dom', () => ( {
	AutoScroller: {
		configure: jest.fn( () => ( { configured: true } ) ),
	},
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

jest.mock( '@dnd-kit/react', () => ( {
	DragDropProvider: jest.fn( ( props: { children: ReactNode } ) => props.children ),
	useDragDropManager: () => ( {
		dragOperation: { status: { idle: true } },
	} ),
	useDragDropMonitor: () => undefined,
} ) );

const dragDropProviderMock = DragDropProvider as unknown as jest.Mock;
const autoScrollerConfigureMock = AutoScroller.configure as jest.Mock;
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
		reorderMode.observeTable( '__row-dnd-test-reset__' );
	} );
};

/** 3行の通常TableをProduction Table Integrationから利用できる状態にする。 */
const setDefaultTable = (): void => {
	setRowReorderTestTables( [
		createRowReorderTestTable( 'table-1', [
			createRowReorderTestRow( 'row-1', 1 ),
			createRowReorderTestRow( 'row-2', 1 ),
			createRowReorderTestRow( 'row-3', 1 ),
		] ),
	] );
};

/** 現在Tableの行識別値を表示順で取得する。 */
const getCurrentRowLabels = (): unknown[] => {
	const table = getRowReorderTestTable( 'table-1' );
	if ( table === null ) {
		throw new Error( 'Row DnD test table must be available.' );
	}

	const body = table.attributes.body as Array< { cells: Array< { content?: unknown } > } >;
	return body.map( ( row ) => row.cells[ 0 ]?.content );
};

/** Row DnD境界と対応する最小Table DOMを描画する。 */
const renderRowDnd = () => {
	const view = render(
		<RowDnd tableIdentity="table-1">
			{ ( onPointerDownCapture ) => (
				<div onPointerDownCapture={ onPointerDownCapture }>
					<table aria-label="Row DnD test table">
						<tbody>
							<tr>
								<td>row-1</td>
							</tr>
							<tr>
								<td>row-2</td>
							</tr>
							<tr>
								<td>row-3</td>
							</tr>
						</tbody>
					</table>
				</div>
			) }
		</RowDnd>
	);
	const table = view.getByRole( 'table', {
		name: 'Row DnD test table',
	} ) as HTMLTableElement;
	const tableBody = table.tBodies.item( 0 );

	if ( tableBody === null ) {
		throw new Error( 'Row DnD test table body must be available.' );
	}

	return {
		...view,
		tableBody,
		rows: Array.from( tableBody.rows ),
		providerProps: getProviderProps(),
	};
};

/**
 * JSDOMに存在しない行配置を、Destination Resolutionが利用する物理layout境界へ与える。
 *
 * @param tableBody 対象Tableのtbody。
 * @param rows      tbody直下の行。
 */
const provideRowGeometry = (
	tableBody: HTMLTableSectionElement,
	rows: HTMLTableRowElement[]
): void => {
	jest.spyOn( tableBody, 'getBoundingClientRect' ).mockReturnValue( {
		top: 0,
		bottom: rows.length * 40,
		left: 0,
		right: 100,
		width: 100,
		height: rows.length * 40,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
	} );

	rows.forEach( ( row, index ) => {
		jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue( {
			top: index * 40,
			bottom: ( index + 1 ) * 40,
			left: 0,
			right: 100,
			width: 100,
			height: 40,
			x: 0,
			y: index * 40,
			toJSON: () => ( {} ),
		} );
	} );
};

/**
 * Row Inputへ主マウス入力を送る。
 *
 * @param element 入力対象のTable要素。
 */
const firePrimaryMousePointerDown = ( element: Element ): void => {
	const pointerDown = new Event( 'pointerdown', {
		bubbles: true,
		cancelable: true,
	} );
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
 * Production Target Resolutionを通して物理DnD開始を成立させる。
 *
 * @param providerProps  DnD Engine境界のcallback群。
 * @param sourceRow      DnD開始元の行DOM。
 * @param sourceRowIndex tbody内の移動元行位置。
 */
const startPhysicalDrag = (
	providerProps: ReturnType< typeof getProviderProps >,
	sourceRow: HTMLTableRowElement,
	sourceRowIndex = 0
): void => {
	const target = {
		tableIdentity: 'table-1',
		sourceRowIndex,
	};

	providerProps.onBeforeDragStart( {
		operation: { source: { data: target } },
		preventDefault: jest.fn(),
	} as unknown as BeforeDragStartEvent );
	providerProps.onDragStart( {
		operation: { source: { element: sourceRow } },
	} as unknown as DragStartEvent );
};

/**
 * 現在のポインター位置を持つ物理DnD移動通知を作成する。
 *
 * @param sourceRow DnD開始元の行DOM。
 * @param clientX   現在の横位置。
 * @param clientY   現在の縦位置。
 * @return DnD Engineから通知される移動イベント。
 */
const createMoveEvent = (
	sourceRow: HTMLTableRowElement,
	clientX: number,
	clientY: number
): DragMoveEvent =>
	( {
		operation: { source: { element: sourceRow } },
		nativeEvent: { clientX, clientY },
	} ) as unknown as DragMoveEvent;

describe( 'Row DnD engine connection', () => {
	beforeEach( () => {
		rowDndInteraction.cancel();
		resetReorderMode();
		setDefaultTable();
		jest.clearAllMocks();
		activeDraggableDestroy = jest.fn();
		draggableConstructorMock.mockImplementation( () => ( {
			destroy: activeDraggableDestroy,
		} ) );
	} );

	afterEach( () => {
		rowDndInteraction.cancel();
		resetReorderMode();
		setRowReorderTestTables( [] );
		jest.restoreAllMocks();
	} );

	/**
	 * 行DnDでは縦方向だけAuto Scrollを許可することを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineの既定plugin群にAutoScrollerが含まれる。
	 *
	 * 操作:
	 * - Row DnD境界のplugin構成を解決する。
	 *
	 * 期待結果:
	 * - 横方向のAuto Scrollは無効化される。
	 * - 縦方向のAuto Scrollは既定の有効範囲で利用できる。
	 * - 既定AutoScrollerは重複して残らない。
	 */
	it( 'when row DnD plugins are resolved, should enable auto scroll only on the vertical axis', () => {
		const { providerProps } = renderRowDnd();
		const unrelatedPlugin = {};
		const plugins = providerProps.plugins( [ unrelatedPlugin, AutoScroller ] );

		expect( autoScrollerConfigureMock ).toHaveBeenCalledWith( {
			threshold: { x: 0, y: 0.2 },
		} );
		expect( plugins ).toEqual( [
			unrelatedPlugin,
			autoScrollerConfigureMock.mock.results[ 0 ]?.value,
		] );
	} );

	/**
	 * 行Reorder ModeでだけRow Inputが現在Tableの開始入力を受け付けることを確認する。
	 *
	 * 事前条件:
	 * - DnD境界は通常編集状態から同じReact identityで存在している。
	 *
	 * 操作:
	 * - 通常編集状態と行Reorder Mode状態で同じ行へ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 通常編集の入力では物理DnD開始候補を登録しない。
	 * - 行Reorder Modeの入力では現在行を開始候補として登録する。
	 */
	it( 'when pointer input occurs, should forward it to Row Input only while row reorder mode is active', () => {
		const { getByText } = renderRowDnd();
		const sourceCell = getByText( 'row-1' );

		firePrimaryMousePointerDown( sourceCell );
		expect( draggableConstructorMock ).not.toHaveBeenCalled();

		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		firePrimaryMousePointerDown( sourceCell );

		expect( draggableConstructorMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 開始入力後に現在Tableで移動元が成立しなくなった場合、物理DnDを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 行Reorder ModeでDnD境界が存在する。
	 * - DnD開始前には対象Tableを利用できなくなっている。
	 *
	 * 操作:
	 * - DnD Engineから開始前通知と開始通知を受ける。
	 *
	 * 期待結果:
	 * - 物理DnD開始が取り消される。
	 * - 行DnD Sessionは開始されない。
	 */
	it( 'when target resolution rejects the source, should prevent the physical drag from starting', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { providerProps } = renderRowDnd();
		setRowReorderTestTables( [] );
		const preventDefault = jest.fn();

		providerProps.onBeforeDragStart( {
			operation: {
				source: {
					data: {
						tableIdentity: 'table-1',
						sourceRowIndex: 1,
					},
				},
			},
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		providerProps.onDragStart();

		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 現在Tableで解決された移動元と開始時制約から行DnD Sessionを開始できることを確認する。
	 *
	 * 事前条件:
	 * - 3行Tableの2行目が開始可能である。
	 *
	 * 操作:
	 * - 開始前通知の後に物理DnD開始通知を受ける。
	 *
	 * 期待結果:
	 * - 行DnD Sessionがactiveになる。
	 * - 開始時制約で有効な境界3を移動先として保持できる。
	 */
	it( 'when physical drag starts after target resolution, should start the row DnD session with the resolved target and constraints', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { providerProps, rows } = renderRowDnd();
		startPhysicalDrag( providerProps, rows[ 1 ], 1 );

		expect( getRowDndPhase() ).toBe( 'active' );

		act( () => {
			rowDndInteraction.updateDestination( 3 );
		} );
		expect( getRowDndDestinationBoundaryIndex() ).toBe( 3 );
	} );

	/**
	 * 行Reorder Mode離脱時に未使用の開始解決結果とDraggable登録を即時破棄することを確認する。
	 *
	 * 事前条件:
	 * - 行Reorder Modeで開始候補と開始前解決結果が存在する。
	 *
	 * 操作:
	 * - React再描画を待たず行Reorder Modeから離脱し、その後に物理DnD開始通知を受ける。
	 *
	 * 期待結果:
	 * - 現在のDraggable登録が破棄される。
	 * - 離脱前の解決結果から行DnD Sessionを開始しない。
	 */
	it( 'when row reorder mode ends, should discard the resolved start and active draggable without a React rerender', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { providerProps, getByText, rows } = renderRowDnd();
		firePrimaryMousePointerDown( getByText( 'row-1' ) );
		providerProps.onBeforeDragStart( {
			operation: {
				source: {
					data: {
						tableIdentity: 'table-1',
						sourceRowIndex: 0,
					},
				},
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		providerProps.onDragStart( {
			operation: { source: { element: rows[ 0 ] } },
		} as unknown as DragStartEvent );

		expect( activeDraggableDestroy ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * DnD接続境界終了時に現在のDraggable登録を破棄することを確認する。
	 *
	 * 事前条件:
	 * - 行Reorder Modeで開始候補が登録されている。
	 *
	 * 操作:
	 * - Row DnD境界をunmountする。
	 *
	 * 期待結果:
	 * - Draggable登録が破棄され、境界終了後へ持ち越されない。
	 */
	it( 'when the row DnD connection unmounts, should destroy the active draggable', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { getByText, unmount } = renderRowDnd();
		firePrimaryMousePointerDown( getByText( 'row-1' ) );

		unmount();

		expect( activeDraggableDestroy ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 現在の物理入力位置から解決した論理境界をDnD Interactionへ接続することを確認する。
	 *
	 * 事前条件:
	 * - 行DnD Sessionが先頭行から開始され、Tableの物理配置を取得できる。
	 *
	 * 操作:
	 * - 2行目の下半分へ物理DnDを移動する。
	 *
	 * 期待結果:
	 * - 行順を変更できる境界2が現在の移動先として公開される。
	 */
	it( 'when destination resolution returns a boundary, should update the DnD interaction with that boundary', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { providerProps, tableBody, rows } = renderRowDnd();
		provideRowGeometry( tableBody, rows );
		startPhysicalDrag( providerProps, rows[ 0 ] );

		act( () => {
			providerProps.onDragMove( createMoveEvent( rows[ 0 ], 10, 70 ) );
		} );

		expect( getRowDndDestinationBoundaryIndex() ).toBe( 2 );
	} );

	/**
	 * 現在位置から有効な移動先を解決できない場合、DnD Interactionの移動先を空にすることを確認する。
	 *
	 * 事前条件:
	 * - 行DnD Sessionが開始され、対象Tableの物理配置を取得できる。
	 *
	 * 操作:
	 * - Tableの横方向外側へ物理DnDを移動する。
	 *
	 * 期待結果:
	 * - 現在の有効な移動先は存在しない。
	 */
	it( 'when destination resolution returns no destination, should clear the DnD interaction destination', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { providerProps, tableBody, rows } = renderRowDnd();
		provideRowGeometry( tableBody, rows );
		startPhysicalDrag( providerProps, rows[ 0 ] );

		act( () => {
			providerProps.onDragMove( createMoveEvent( rows[ 0 ], 120, 70 ) );
		} );

		expect( getRowDndDestinationBoundaryIndex() ).toBeNull();
	} );

	/**
	 * DnD開始時に移動先解決用の行DOMがなくても、最初の移動通知から解決を開始できることを確認する。
	 *
	 * 事前条件:
	 * - 開始前のTarget Resolutionは成立している。
	 * - DnD開始通知には移動元DOMが含まれない。
	 *
	 * 操作:
	 * - 最初の移動通知で移動元行DOMと現在位置を受け取る。
	 *
	 * 期待結果:
	 * - 現在位置から解決された境界2が移動先として公開される。
	 */
	it( 'when destination resolution was unavailable at drag start, should create it from the first drag move', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { providerProps, tableBody, rows } = renderRowDnd();
		provideRowGeometry( tableBody, rows );
		const target = {
			tableIdentity: 'table-1',
			sourceRowIndex: 0,
		};
		providerProps.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		providerProps.onDragStart( {
			operation: { source: { element: undefined } },
		} as unknown as DragStartEvent );

		act( () => {
			providerProps.onDragMove( createMoveEvent( rows[ 0 ], 10, 70 ) );
		} );

		expect( getRowDndDestinationBoundaryIndex() ).toBe( 2 );
	} );

	/**
	 * Session開始前に正常終了した物理DnD試行を意味的な終了処理へ接続しないことを確認する。
	 *
	 * 事前条件:
	 * - 開始前のTarget Resolutionは成立しているが、行DnD Sessionはまだ開始されていない。
	 *
	 * 操作:
	 * - canceledではない物理DnD終了通知を受ける。
	 *
	 * 期待結果:
	 * - 行DnDはidleのままで、Table行順は変化しない。
	 */
	it( 'when a physical drag ends normally before the row session starts, should not complete or cancel a session', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const before = getCurrentRowLabels();
		const { providerProps } = renderRowDnd();
		providerProps.onBeforeDragStart( {
			operation: {
				source: {
					data: {
						tableIdentity: 'table-1',
						sourceRowIndex: 0,
					},
				},
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		providerProps.onDragEnd( { canceled: false } as DragEndEvent );

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( getCurrentRowLabels() ).toEqual( before );
	} );

	/**
	 * Session開始前に取消終了した物理DnD試行を意味的な終了処理へ接続しないことを確認する。
	 *
	 * 事前条件:
	 * - 開始前のTarget Resolutionは成立しているが、行DnD Sessionはまだ開始されていない。
	 *
	 * 操作:
	 * - canceledな物理DnD終了通知を受ける。
	 *
	 * 期待結果:
	 * - 行DnDはidleのままで、Table行順は変化しない。
	 */
	it( 'when a physical drag is canceled before the row session starts, should not complete or cancel a session', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const before = getCurrentRowLabels();
		const { providerProps } = renderRowDnd();
		providerProps.onBeforeDragStart( {
			operation: {
				source: {
					data: {
						tableIdentity: 'table-1',
						sourceRowIndex: 0,
					},
				},
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		providerProps.onDragEnd( { canceled: true } as DragEndEvent );

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( getCurrentRowLabels() ).toEqual( before );
	} );

	/**
	 * Session開始済みの物理DnD正常終了をProductionの行移動確定へ接続することを確認する。
	 *
	 * 事前条件:
	 * - 先頭行から行DnD Sessionが開始され、末尾直後が有効な移動先である。
	 *
	 * 操作:
	 * - canceledではない物理DnD終了通知を一度受ける。
	 *
	 * 期待結果:
	 * - Sessionはidleへ戻る。
	 * - 先頭行が末尾へ一度だけ移動する。
	 */
	it( 'when a started physical row drag ends normally, should complete the session exactly once', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { providerProps, tableBody, rows } = renderRowDnd();
		provideRowGeometry( tableBody, rows );
		startPhysicalDrag( providerProps, rows[ 0 ] );
		act( () => {
			providerProps.onDragMove( createMoveEvent( rows[ 0 ], 10, 110 ) );
		} );

		providerProps.onDragEnd( { canceled: false } as DragEndEvent );

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( getCurrentRowLabels() ).toEqual( [ 'row-2-1', 'row-3-1', 'row-1-1' ] );
	} );

	/**
	 * Session開始済みの物理DnD取消終了をProductionのSession取消へ接続することを確認する。
	 *
	 * 事前条件:
	 * - 行DnD Sessionが開始されている。
	 *
	 * 操作:
	 * - canceledな物理DnD終了通知を一度受ける。
	 *
	 * 期待結果:
	 * - Sessionはidleへ戻る。
	 * - Table行順は変更されない。
	 */
	it( 'when a started physical row drag is canceled, should cancel the session exactly once', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const before = getCurrentRowLabels();
		const { providerProps, rows } = renderRowDnd();
		startPhysicalDrag( providerProps, rows[ 0 ] );

		providerProps.onDragEnd( { canceled: true } as DragEndEvent );

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( getCurrentRowLabels() ).toEqual( before );
	} );

	/**
	 * Session開始後に行Reorder Modeを離脱して一時接続状態が破棄されても、開始済みSessionを正常終了できることを確認する。
	 *
	 * 事前条件:
	 * - 行Reorder Modeで先頭行のSessionが開始され、末尾直後が有効な移動先である。
	 *
	 * 操作:
	 * - 行Reorder Modeを離脱した後に物理DnDを正常終了する。
	 *
	 * 期待結果:
	 * - 開始済みSessionは確定してidleへ戻る。
	 * - 行移動結果は保持される。
	 */
	it( 'when transient state is cleared after the row session starts, should still complete the session on drag end', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { providerProps, tableBody, rows } = renderRowDnd();
		provideRowGeometry( tableBody, rows );
		startPhysicalDrag( providerProps, rows[ 0 ] );
		act( () => {
			providerProps.onDragMove( createMoveEvent( rows[ 0 ], 10, 110 ) );
			reorderMode.select( 'row', 'table-1' );
		} );

		providerProps.onDragEnd( { canceled: false } as DragEndEvent );

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( getCurrentRowLabels() ).toEqual( [ 'row-2-1', 'row-3-1', 'row-1-1' ] );
		expect( reorderMode.getMode( 'table-1' ) ).toBe( 'edit' );
	} );

	/**
	 * 終了済みの物理DnD試行情報を次の試行へ持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - 一回目の物理DnDはSessionを開始して正常終了している。
	 * - 二回目は開始前解決まで成立し、Sessionはまだ開始されていない。
	 *
	 * 操作:
	 * - 二回目の物理DnDを正常終了する。
	 *
	 * 期待結果:
	 * - 過去の開始成立情報から終了済みSessionを再度確定しない。
	 * - 行DnDはidleのまま維持される。
	 */
	it( 'when a later physical row drag ends before session start, should not reuse the prior attempt state', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { providerProps, rows } = renderRowDnd();
		startPhysicalDrag( providerProps, rows[ 0 ] );
		providerProps.onDragEnd( { canceled: false } as DragEndEvent );

		providerProps.onBeforeDragStart( {
			operation: {
				source: {
					data: {
						tableIdentity: 'table-1',
						sourceRowIndex: 0,
					},
				},
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		expect( () => {
			providerProps.onDragEnd( { canceled: false } as DragEndEvent );
		} ).not.toThrow();
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );
} );
