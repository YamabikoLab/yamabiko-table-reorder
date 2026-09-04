/**
 * 行専用DnD InteractionとDnD EngineのLifecycle接続を確認する。
 *
 * DnD Engine callbackを直接発火し、開始準備値の一回性、Session開始後の移動先登録、
 * 物理状態から移動先境界への変換、および正常終了・failure recoveryへの接続を検証する。
 */

import type { DragDropManager } from '@dnd-kit/dom';
import { Droppable } from '@dnd-kit/dom';

import {
	createRowDndOperationBoundary,
	type RowDndOperationBoundary,
	type RowDndStartPreparation,
} from './dnd-interaction';
import { connectRowDndInteraction } from './dnd-interaction-integration';

jest.mock( '@dnd-kit/dom', () => ( {
	Droppable: jest.fn().mockImplementation( () => ( {
		destroy: jest.fn(),
	} ) ),
} ) );

jest.mock( './dnd-interaction', () => ( {
	createRowDndOperationBoundary: jest.fn(),
} ) );

type EngineCallback = ( event: any ) => void;

type EngineHarness = {
	manager: DragDropManager;
	listeners: Map< string, EngineCallback >;
	stop: jest.Mock;
};

const createBoundary = (): jest.Mocked< RowDndOperationBoundary > => ( {
	prepareStart: jest.fn(),
	start: jest.fn(),
	updateDestination: jest.fn(),
	complete: jest.fn(),
	cancel: jest.fn(),
	recoverFailure: jest.fn(),
	isRecovering: jest.fn( () => false ),
} );

const createEngineHarness = (): EngineHarness => {
	const listeners = new Map< string, EngineCallback >();
	const stop = jest.fn();
	const manager = {
		actions: {
			stop,
		},
		dragOperation: {
			status: {
				idle: false,
			},
		},
		monitor: {
			addEventListener: jest.fn( ( name: string, listener: EngineCallback ) => {
				listeners.set( name, listener );
				return (): void => {
					listeners.delete( name );
				};
			} ),
		},
	} as unknown as DragDropManager;

	return {
		manager,
		listeners,
		stop,
	};
};

const createTableRows = ( rowCount = 3 ): HTMLTableRowElement[] => {
	const table = document.createElement( 'table' );
	const body = document.createElement( 'tbody' );
	table.appendChild( body );

	for ( let index = 0; index < rowCount; index++ ) {
		body.appendChild( document.createElement( 'tr' ) );
	}

	return Array.from( body.rows );
};

const createSourceEntity = ( row: HTMLTableRowElement, sourceRowIndex = 1 ) => ( {
	data: {
		tableIdentity: 'table-a',
		sourceRowIndex,
	},
	element: row,
} );

const createOperation = (
	source: ReturnType< typeof createSourceEntity >,
	target: unknown = null,
	y = 0
) => ( {
	source,
	target,
	position: {
		current: {
			x: 0,
			y,
		},
	},
} );

const preparation: RowDndStartPreparation = {
	source: {
		tableIdentity: 'table-a',
		sourceRowIndex: 1,
	},
	initialConstraints: {
		rowCount: 3,
		blockedBoundaries: [],
	},
};

const droppableMock = Droppable as unknown as jest.Mock;
const createBoundaryMock = createRowDndOperationBoundary as jest.MockedFunction<
	typeof createRowDndOperationBoundary
>;

describe( 'Row DnD Interaction DnD Engine integration', () => {
	let boundary: jest.Mocked< RowDndOperationBoundary >;

	beforeEach( () => {
		jest.clearAllMocks();
		boundary = createBoundary();
		createBoundaryMock.mockReturnValue( boundary );
	} );

	/**
	 * 概要:
	 * - 開始可否判定が開始不能を返した場合、物理DnDを成立させないことを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineの開始対象は有効だが、prepareStart()はnullを返す。
	 *
	 * 操作:
	 * - beforedragstart callbackを発火する。
	 *
	 * 期待結果:
	 * - callbackをpreventDefaultし、startやDroppable登録へ進まない。
	 */
	it( 'when start preparation is rejected, should prevent the physical drag', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		const preventDefault = jest.fn();
		boundary.prepareStart.mockReturnValue( null );
		connectRowDndInteraction( engine.manager );

		engine.listeners.get( 'beforedragstart' )?.( {
			operation: createOperation( source ),
			preventDefault,
		} );

		expect( boundary.prepareStart ).toHaveBeenCalledWith( preparation.source );
		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( boundary.start ).not.toHaveBeenCalled();
		expect( droppableMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 開始準備値は同じ接続インスタンス内で一回だけ消費され、Session開始後にだけ現在行を移動先登録することを確認する。
	 *
	 * 事前条件:
	 * - prepareStart()は開始可能な準備値を返し、start operationも成功する。
	 *
	 * 操作:
	 * - beforedragstartの後にdragstartを2回発火する。
	 *
	 * 期待結果:
	 * - 最初のdragstartだけがstartと3行分のDroppable登録へ進み、2回目は準備値欠如としてfailure recoveryへ合流する。
	 */
	it( 'when drag starts, should consume the preparation once and register only current rows', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		boundary.prepareStart.mockReturnValue( preparation );
		boundary.start.mockReturnValue( true );
		connectRowDndInteraction( engine.manager );

		engine.listeners.get( 'beforedragstart' )?.( {
			operation: createOperation( source ),
			preventDefault: jest.fn(),
		} );
		expect( droppableMock ).not.toHaveBeenCalled();

		engine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( source ),
		} );
		engine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( source ),
		} );

		expect( boundary.start ).toHaveBeenCalledTimes( 1 );
		expect( boundary.start ).toHaveBeenCalledWith( preparation );
		expect( droppableMock ).toHaveBeenCalledTimes( 3 );
		expect( boundary.recoverFailure ).toHaveBeenCalledWith(
			'start',
			expect.any( Error ),
			{ tableIdentity: 'table-a' }
		);
	} );

	/**
	 * 概要:
	 * - start operationがfailure recoveryへ入った場合、dragStart callbackが後続のDroppable登録へ進まないことを確認する。
	 *
	 * 事前条件:
	 * - 開始準備値は存在するが、operation boundaryのstart()はfalseを返す。
	 *
	 * 操作:
	 * - beforedragstart後にdragstartを発火する。
	 *
	 * 期待結果:
	 * - startは1回実行されるが、Droppableは1件も生成しない。
	 */
	it( 'when start operation recovers from failure, should not register droppables', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		boundary.prepareStart.mockReturnValue( preparation );
		boundary.start.mockReturnValue( false );
		connectRowDndInteraction( engine.manager );

		engine.listeners.get( 'beforedragstart' )?.( {
			operation: createOperation( source ),
			preventDefault: jest.fn(),
		} );
		engine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( source ),
		} );

		expect( boundary.start ).toHaveBeenCalledTimes( 1 );
		expect( droppableMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - prepareStart後にDnD Engineの開始対象が変化した場合、別対象へ準備値を誤適用しないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aの行1について開始準備済みだが、dragStart時には行2がsourceとして示される。
	 *
	 * 操作:
	 * - 異なるsourceでdragstartを発火する。
	 *
	 * 期待結果:
	 * - startを実行せず、準備済みTable Identityをcontextとしてstart failure recoveryへ合流する。
	 */
	it( 'when the engine source changes after preparation, should recover without starting another source', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const preparedSource = createSourceEntity( rows[ 1 ] );
		const changedSource = createSourceEntity( rows[ 2 ], 2 );
		boundary.prepareStart.mockReturnValue( preparation );
		connectRowDndInteraction( engine.manager );

		engine.listeners.get( 'beforedragstart' )?.( {
			operation: createOperation( preparedSource ),
			preventDefault: jest.fn(),
		} );
		engine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( changedSource ),
		} );

		expect( boundary.start ).not.toHaveBeenCalled();
		expect( droppableMock ).not.toHaveBeenCalled();
		expect( boundary.recoverFailure ).toHaveBeenCalledWith(
			'start',
			expect.any( Error ),
			{ tableIdentity: 'table-a' }
		);
	} );

	/**
	 * 概要:
	 * - DnD Engineの現在targetと縦位置を行の前後境界へ変換し、target不在時は有効移動先なしへ戻すことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立済みで、target行の矩形はtop=100、height=40である。
	 *
	 * 操作:
	 * - 行中央より上、下、targetなしの順にdragmove callbackを発火する。
	 *
	 * 期待結果:
	 * - updateDestination()へ順に行直前境界1、行直後境界2、nullを渡す。
	 */
	it( 'when the physical target changes, should translate it to row boundaries and clear missing targets', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		const target = {
			data: {
				tableIdentity: 'table-a',
				rowIndex: 1,
			},
			element: rows[ 1 ],
		};
		jest.spyOn( rows[ 1 ], 'getBoundingClientRect' ).mockReturnValue( {
			top: 100,
			height: 40,
		} as DOMRect );
		connectRowDndInteraction( engine.manager );

		engine.listeners.get( 'dragmove' )?.( {
			operation: createOperation( source, target, 110 ),
		} );
		engine.listeners.get( 'dragmove' )?.( {
			operation: createOperation( source, target, 130 ),
		} );
		engine.listeners.get( 'dragmove' )?.( {
			operation: createOperation( source, null, 130 ),
		} );

		expect( boundary.updateDestination.mock.calls ).toEqual( [ [ 1 ], [ 2 ], [ null ] ] );
	} );

	/**
	 * 概要:
	 * - 正常なDnD終了では一時登録を1回だけ破棄して終了種別をcomplete / cancelへ対応付けることを確認する。
	 *
	 * 事前条件:
	 * - 3行分のDroppableが登録済みである。
	 *
	 * 操作:
	 * - canceled=falseのdragendを発火し、その後cleanup関数を呼ぶ。
	 *
	 * 期待結果:
	 * - completeを1回実行し、各Droppableはdragendで1回だけdestroyされ、後続cleanupで二重破棄されない。
	 */
	it( 'when drag completes, should cleanup temporary targets once before completing the session', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		boundary.prepareStart.mockReturnValue( preparation );
		boundary.start.mockReturnValue( true );
		const disconnect = connectRowDndInteraction( engine.manager );

		engine.listeners.get( 'beforedragstart' )?.( {
			operation: createOperation( source ),
			preventDefault: jest.fn(),
		} );
		engine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( source ),
		} );
		const createdDroppables = droppableMock.mock.results.map( ( result ) => result.value );

		engine.listeners.get( 'dragend' )?.( {
			operation: createOperation( source ),
			canceled: false,
		} );
		disconnect();

		expect( boundary.complete ).toHaveBeenCalledTimes( 1 );
		expect( boundary.cancel ).not.toHaveBeenCalled();
		createdDroppables.forEach( ( droppable ) => {
			expect( droppable.destroy ).toHaveBeenCalledTimes( 1 );
		} );
	} );
} );