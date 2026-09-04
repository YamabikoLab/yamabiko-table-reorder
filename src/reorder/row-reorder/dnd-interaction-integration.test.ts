/**
 * 行専用DnD InteractionとDnD Engineの接続契約を検証する。
 *
 * DnD Engineのライフサイクル通知を通して、開始準備値の一回性と接続ごとの分離、
 * Session開始後だけ行を移動先候補として登録すること、物理状態から移動先境界への変換、
 * 通常終了・取消・共通回復処理への接続を、外部から観測できる振る舞いとして確認する。
 */

import type { DragDropManager } from '@dnd-kit/dom';
import { Droppable } from '@dnd-kit/dom';

import {
	createRowDndOperationBoundary,
	type RowDndFailureRecoveryHooks,
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

/** DnD Engineが登録するライフサイクル通知をテストから発火するための関数型。 */
type EngineCallback = ( event: unknown ) => void;

/** DnD Engine接続の購読と物理DnD取消を観測するテスト用境界。 */
type EngineHarness = {
	manager: DragDropManager;
	listeners: Map< string, EngineCallback >;
};

/** DnD Interactionの操作境界への接続だけを観測するテスト用代替を生成する。 */
const createBoundary = (): jest.Mocked< RowDndOperationBoundary > => ( {
	prepareStart: jest.fn(),
	start: jest.fn(),
	updateDestination: jest.fn(),
	complete: jest.fn(),
	cancel: jest.fn(),
	recoverFailure: jest.fn(),
	isRecovering: jest.fn( () => false ),
} );

/** DnD Engineのライフサイクル購読と物理DnD取消を記録できるテスト環境を生成する。 */
const createEngineHarness = (): EngineHarness => {
	const listeners = new Map< string, EngineCallback >();
	const manager = {
		actions: {
			stop: jest.fn(),
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
	};
};

/**
 * 同じtbody直下に属する行を、DnD開始時点の現在行として生成する。
 *
 * @param rowCount 生成するtbody直下行数。
 * @return 同じtbodyに属するTable行。
 */
const createTableRows = ( rowCount = 3 ): HTMLTableRowElement[] => {
	const table = document.createElement( 'table' );
	const body = document.createElement( 'tbody' );
	table.appendChild( body );

	/* Session開始時に登録対象となる現在のtbody直下行を必要数だけ用意する。 */
	for ( let index = 0; index < rowCount; index++ ) {
		body.appendChild( document.createElement( 'tr' ) );
	}

	return Array.from( body.rows );
};

/**
 * DnD EngineがRow DnD開始対象として通知するEntityを生成する。
 *
 * @param row            開始対象として通知するTable行。
 * @param sourceRowIndex tbody内の0-based開始行位置。
 * @return Table Aの開始対象を表すDnD Engine Entity。
 */
const createSourceEntity = ( row: HTMLTableRowElement, sourceRowIndex = 1 ) => ( {
	data: {
		tableIdentity: 'table-a',
		sourceRowIndex,
	},
	element: row,
} );

/**
 * DnD Engineが各ライフサイクル通知で提供する現在の物理DnD状態を生成する。
 *
 * @param source 現在の開始対象Entity。
 * @param target 現在の移動先候補。候補がない場合はnull。
 * @param y      現在の縦方向の物理入力位置。
 * @return 接続境界へ通知する物理DnD状態。
 */
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

/** Table Aの行1について開始可能と判定済みの開始準備値。 */
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

/** DnD Engineへ一時登録された移動先候補を観測するJest代替。 */
const droppableMock = Droppable as unknown as jest.Mock;

/** 接続ごとに生成されるDnD Interaction操作境界と回復hookを観測するJest代替。 */
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
	 * - beforedragstart通知を発火する。
	 *
	 * 期待結果:
	 * - 開始をpreventDefaultし、startやDroppable登録へ進まない。
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
	 * - 開始準備値は同じ接続内で一回だけ消費され、Session開始後にだけ現在行を移動先登録することを確認する。
	 *
	 * 事前条件:
	 * - prepareStart()は開始可能な準備値を返し、start操作も成功する。
	 *
	 * 操作:
	 * - beforedragstart後にdragstartを2回発火する。
	 *
	 * 期待結果:
	 * - 最初のdragstartだけがstartと3行分のDroppable登録へ進み、2回目は準備値欠如として共通回復処理へ合流する。
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
		expect( boundary.recoverFailure ).toHaveBeenCalledWith( 'start', expect.any( Error ), {
			tableIdentity: 'table-a',
		} );
	} );

	/**
	 * 概要:
	 * - 開始準備値を接続インスタンス間で共有しないことを確認する。
	 *
	 * 事前条件:
	 * - 2つのDnD Engine接続が存在し、最初の接続だけが開始準備済みである。
	 *
	 * 操作:
	 * - 準備していない2つ目の接続でdragstartを発火する。
	 *
	 * 期待結果:
	 * - 2つ目の接続は1つ目の準備値を使用せず、startせずに共通回復処理へ合流する。
	 */
	it( 'when another connection prepared a start, should not reuse that preparation', () => {
		const firstBoundary = createBoundary();
		const secondBoundary = createBoundary();
		const firstEngine = createEngineHarness();
		const secondEngine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		firstBoundary.prepareStart.mockReturnValue( preparation );
		createBoundaryMock.mockReturnValueOnce( firstBoundary ).mockReturnValueOnce( secondBoundary );
		connectRowDndInteraction( firstEngine.manager );
		connectRowDndInteraction( secondEngine.manager );

		firstEngine.listeners.get( 'beforedragstart' )?.( {
			operation: createOperation( source ),
			preventDefault: jest.fn(),
		} );
		secondEngine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( source ),
		} );

		expect( secondBoundary.start ).not.toHaveBeenCalled();
		expect( secondBoundary.recoverFailure ).toHaveBeenCalledWith( 'start', expect.any( Error ), {
			tableIdentity: 'table-a',
		} );
	} );

	/**
	 * 概要:
	 * - 新しい開始試行が開始不能だった場合、以前の未消費準備値を次回開始へ持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - 最初の開始前判定は開始可能、次の開始前判定は開始不能である。
	 *
	 * 操作:
	 * - 2回のbeforedragstart通知後にdragstartを発火する。
	 *
	 * 期待結果:
	 * - 最初の準備値ではstartせず、準備値欠如として共通回復処理へ合流する。
	 */
	it( 'when a later start attempt is rejected, should not carry the previous preparation forward', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		boundary.prepareStart.mockReturnValueOnce( preparation ).mockReturnValueOnce( null );
		connectRowDndInteraction( engine.manager );

		engine.listeners.get( 'beforedragstart' )?.( {
			operation: createOperation( source ),
			preventDefault: jest.fn(),
		} );
		engine.listeners.get( 'beforedragstart' )?.( {
			operation: createOperation( source ),
			preventDefault: jest.fn(),
		} );
		engine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( source ),
		} );

		expect( boundary.start ).not.toHaveBeenCalled();
		expect( boundary.recoverFailure ).toHaveBeenCalledWith( 'start', expect.any( Error ), {
			tableIdentity: 'table-a',
		} );
	} );

	/**
	 * 概要:
	 * - start操作が共通回復処理へ入った場合、dragStart通知が後続のDroppable登録へ進まないことを確認する。
	 *
	 * 事前条件:
	 * - 開始準備値は存在するが、操作境界のstart()はfalseを返す。
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
	 * - Table Aの行1について開始準備済みだが、dragStart時には行2が開始対象として示される。
	 *
	 * 操作:
	 * - 異なる開始対象でdragstartを発火する。
	 *
	 * 期待結果:
	 * - startを実行せず、準備済みTable Identityを回復情報としてstartの共通回復処理へ合流する。
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
		expect( boundary.recoverFailure ).toHaveBeenCalledWith( 'start', expect.any( Error ), {
			tableIdentity: 'table-a',
		} );
	} );

	/**
	 * 概要:
	 * - DnD Engineの現在の移動先候補と縦位置を行の前後境界へ変換し、候補不在時は有効移動先なしへ戻すことを確認する。
	 *
	 * 事前条件:
	 * - target行の矩形はtop=100、height=40である。
	 *
	 * 操作:
	 * - 行中央より上をdragmove、下をdragover、候補なしをdragmoveで通知する。
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
		engine.listeners.get( 'dragover' )?.( {
			operation: createOperation( source, target, 130 ),
		} );
		engine.listeners.get( 'dragmove' )?.( {
			operation: createOperation( source, null, 130 ),
		} );

		expect( boundary.updateDestination.mock.calls ).toEqual( [ [ 1 ], [ 2 ], [ null ] ] );
	} );

	/**
	 * 概要:
	 * - 移動先更新中の接続内部仕様違反を、独自処理せずupdateDestinationの共通回復処理へ接続することを確認する。
	 *
	 * 事前条件:
	 * - 開始対象はTable Aだが、DnD EngineがTable Bの移動先候補を通知する。
	 *
	 * 操作:
	 * - 不一致な移動先候補でdragmoveを発火する。
	 *
	 * 期待結果:
	 * - updateDestinationは実行せず、Table Aを回復情報として共通回復処理へ合流する。
	 */
	it( 'when progress contains an invalid target, should join update destination failure recovery', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		const target = {
			data: {
				tableIdentity: 'table-b',
				rowIndex: 1,
			},
			element: rows[ 1 ],
		};
		connectRowDndInteraction( engine.manager );

		engine.listeners.get( 'dragmove' )?.( {
			operation: createOperation( source, target, 110 ),
		} );

		expect( boundary.updateDestination ).not.toHaveBeenCalled();
		expect( boundary.recoverFailure ).toHaveBeenCalledWith(
			'updateDestination',
			expect.any( Error ),
			{ tableIdentity: 'table-a' }
		);
	} );

	/**
	 * 概要:
	 * - 正常なDnD終了では一時登録を1回だけ破棄してcompleteへ接続することを確認する。
	 *
	 * 事前条件:
	 * - 3行分のDroppableが登録済みである。
	 *
	 * 操作:
	 * - canceled=falseのdragendを発火し、その後接続解除関数を呼ぶ。
	 *
	 * 期待結果:
	 * - completeを1回実行し、各Droppableはdragendで1回だけdestroyされ、後続の接続解除で二重破棄されない。
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

	/**
	 * 概要:
	 * - 物理DnDがcancelされた場合、Tableを確定せずcancelへ接続することを確認する。
	 *
	 * 事前条件:
	 * - 行DnD Sessionが開始済みである。
	 *
	 * 操作:
	 * - canceled=trueのdragendを発火する。
	 *
	 * 期待結果:
	 * - cancelを1回実行し、completeは実行しない。
	 */
	it( 'when the physical drag is canceled, should cancel without completing the session', () => {
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
		engine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( source ),
		} );
		engine.listeners.get( 'dragend' )?.( {
			operation: createOperation( source ),
			canceled: true,
		} );

		expect( boundary.cancel ).toHaveBeenCalledTimes( 1 );
		expect( boundary.complete ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 共通回復処理中にDnD Engineの終了通知が再入しても、通常のcancelや追加の回復処理へ進まないことを確認する。
	 *
	 * 事前条件:
	 * - 操作境界は共通回復処理中である。
	 *
	 * 操作:
	 * - canceled=trueのdragendを発火する。
	 *
	 * 期待結果:
	 * - cancel、complete、recoverFailureのいずれも新たに実行しない。
	 */
	it( 'when drag end re-enters during recovery, should ignore the normal end lifecycle', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		boundary.isRecovering.mockReturnValue( true );
		connectRowDndInteraction( engine.manager );

		engine.listeners.get( 'dragend' )?.( {
			operation: createOperation( source ),
			canceled: true,
		} );

		expect( boundary.cancel ).not.toHaveBeenCalled();
		expect( boundary.complete ).not.toHaveBeenCalled();
		expect( boundary.recoverFailure ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 接続が共通回復処理へ、開始準備値・物理DnD・移動先一時登録の破棄責務を渡すことを確認する。
	 *
	 * 事前条件:
	 * - 開始準備値と3行分のDroppableが存在し、物理DnDはactiveである。
	 *
	 * 操作:
	 * - createRowDndOperationBoundary()へ渡された3つの回復hookを実行する。
	 *
	 * 期待結果:
	 * - 物理DnDはcancelされ、Droppableは全件破棄され、その後のdragstartでは準備値が残っていない。
	 */
	it( 'when failure recovery hooks run, should discard connection-owned transient state', () => {
		const engine = createEngineHarness();
		const rows = createTableRows();
		const source = createSourceEntity( rows[ 1 ] );
		boundary.prepareStart.mockReturnValue( preparation );
		boundary.start.mockReturnValue( true );
		connectRowDndInteraction( engine.manager );
		const recoveryHooks = createBoundaryMock.mock.calls[ 0 ][ 0 ] as RowDndFailureRecoveryHooks;

		engine.listeners.get( 'beforedragstart' )?.( {
			operation: createOperation( source ),
			preventDefault: jest.fn(),
		} );
		engine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( source ),
		} );
		const createdDroppables = droppableMock.mock.results.map( ( result ) => result.value );

		recoveryHooks.discardPreparedStart();
		recoveryHooks.cancelActiveDnd();
		recoveryHooks.discardTemporaryDndState();
		engine.listeners.get( 'dragstart' )?.( {
			operation: createOperation( source ),
		} );

		expect( engine.manager.actions.stop ).toHaveBeenCalledWith( { canceled: true } );
		createdDroppables.forEach( ( droppable ) => {
			expect( droppable.destroy ).toHaveBeenCalledTimes( 1 );
		} );
		expect( boundary.start ).toHaveBeenCalledTimes( 1 );
		expect( boundary.recoverFailure ).toHaveBeenCalledWith( 'start', expect.any( Error ), {
			tableIdentity: 'table-a',
		} );
	} );
} );
