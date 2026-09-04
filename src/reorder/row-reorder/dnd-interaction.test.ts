/**
 * 行専用DnD Interactionの正常Lifecycleと共通failure recoveryを確認する。
 *
 * Store内部を直接参照せず、公開されたDnD Interaction境界、failure recovery境界、Table Integration、
 * Reorder Mode、および一回性通知を通して、正常終了と内部Errorからのsafe idle復帰を検証する。
 */

import { reorderMode, rowReorderMode } from '@/reorder/reorder-mode';

import {
	createRowDndOperationBoundary,
	getRowDndPhase,
	rowDndInteraction,
	subscribeRowDndStartRejectionNotice,
	subscribeRowDndTerminationNotice,
} from './dnd-interaction';
import { rowTableIntegration } from './table-integration';

jest.mock( './table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		applyRowMove: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.MockedFunction<
	typeof rowTableIntegration.getConstraints
>;
const applyRowMoveMock = rowTableIntegration.applyRowMove as jest.MockedFunction<
	typeof rowTableIntegration.applyRowMove
>;

const availableConstraints = {
	rowCount: 5,
	blockedBoundaries: [] as readonly number[],
};

const source = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

const RESET_TABLE_IDENTITY = '__row-dnd-test-reset__';

const resetReorderMode = (): void => {
	reorderMode.observeTable( RESET_TABLE_IDENTITY );
	reorderMode.notifyTableInactive( RESET_TABLE_IDENTITY );
};

/** 通常系のactive Sessionを準備する。 */
const prepareActiveSession = (): void => {
	getConstraintsMock.mockReturnValueOnce( availableConstraints );
	const preparation = rowDndInteraction.prepareStart( source );

	if ( preparation === null ) {
		throw new Error( 'Test precondition failed: expected start preparation.' );
	}

	rowDndInteraction.start( preparation );
};

describe( 'Row DnD Interaction lifecycle and failure recovery', () => {
	let terminationNoticeListener: jest.Mock;
	let unsubscribeTerminationNotice: () => void;
	let startRejectionNoticeListener: jest.Mock;
	let unsubscribeStartRejectionNotice: () => void;
	let consoleErrorSpy: jest.SpyInstance;

	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReset();
		applyRowMoveMock.mockReset();
		getConstraintsMock.mockReturnValue( availableConstraints );
		rowDndInteraction.cancel();
		resetReorderMode();
		terminationNoticeListener = jest.fn();
		unsubscribeTerminationNotice = subscribeRowDndTerminationNotice( terminationNoticeListener );
		startRejectionNoticeListener = jest.fn();
		unsubscribeStartRejectionNotice = subscribeRowDndStartRejectionNotice(
			startRejectionNoticeListener
		);
		consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation( () => undefined );
	} );

	afterEach( () => {
		consoleErrorSpy.mockRestore();
		unsubscribeTerminationNotice();
		unsubscribeStartRejectionNotice();
		rowDndInteraction.cancel();
		resetReorderMode();
	} );

	/**
	 * 概要:
	 * - 開始可能な行では、開始対象と開始可否判定時に確認した行制約を同じ開始準備値として返すことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは取得可能で、移動元行の前後に分断不可境界がない。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - 開始対象とTable Integrationから取得した行制約が組で返り、開始拒否通知とError記録は発生しない。
	 */
	it( 'when source row is movable, should return the source with the checked initial constraints', () => {
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		const preparation = rowDndInteraction.prepareStart( source );

		expect( preparation ).toEqual( {
			source,
			initialConstraints: availableConstraints,
		} );
		expect( startRejectionNoticeListener ).not.toHaveBeenCalled();
		expect( consoleErrorSpy ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - rowspan等の結合範囲に含まれる移動元行では、通常の開始拒否として扱うことを確認する。
	 *
	 * 事前条件:
	 * - 移動元行の直後が分断不可境界である。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - nullを返し開始拒否通知を1回発行するが、内部Errorとして記録しない。
	 */
	it( 'when source row crosses a blocked boundary, should notify the start rejection without logging an error', () => {
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 2 ],
		} );

		const preparation = rowDndInteraction.prepareStart( source );

		expect( preparation ).toBeNull();
		expect( startRejectionNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( consoleErrorSpy ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 正常なcompleteでは現在構造へ再照合して行移動を確定し、Session終了後にReorder Mode継続可否を解決することを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立し、移動先境界4が開始時とcomplete時の双方で有効である。
	 *
	 * 操作:
	 * - 移動先を更新してcomplete()する。
	 *
	 * 期待結果:
	 * - Table更新を1回要求し、idleへ戻り、異常終了通知とError記録は行わない。
	 */
	it( 'when complete revalidation succeeds, should apply the confirmed move and return to idle', () => {
		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.complete();

		expect( applyRowMoveMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( consoleErrorSpy ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - complete時の外部環境変化は内部Errorとせず、安全な異常終了通知だけを行うことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionの移動先は開始時には有効だが、complete時には分断不可になっている。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - Table更新せずidleへ戻り、異常終了通知を1回発行するがError記録は行わない。
	 */
	it( 'when complete revalidation becomes unavailable normally, should notify termination without logging an error', () => {
		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 4 ],
		} );
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( consoleErrorSpy ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - prepareStart中の内部Errorは共通failure recoveryで1回だけ記録し、物理DnD成立前のfailureとして通知しないことを確認する。
	 *
	 * 事前条件:
	 * - Table Integrationが開始可否判定中にErrorを送出する。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - nullを返してidleを維持し、Errorを1回記録するが異常終了通知とReorder Mode終了後判断は行わない。
	 */
	it( 'when prepareStart throws internally, should recover to idle without a termination notice', () => {
		const error = new Error( 'constraints failed' );
		getConstraintsMock.mockImplementationOnce( () => {
			throw error;
		} );
		reorderMode.select( 'row', 'table-a' );

		const preparation = rowDndInteraction.prepareStart( source );

		expect( preparation ).toBeNull();
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( consoleErrorSpy ).toHaveBeenCalledTimes( 1 );
		expect( consoleErrorSpy ).toHaveBeenCalledWith(
			'[Yamabiko Table Reorder] Row DnD prepareStart failed.',
			error
		);
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - start中のLifecycle違反もoperation boundaryから共通failure recoveryへ合流することを確認する。
	 *
	 * 事前条件:
	 * - Table Aのactive Sessionがすでに成立している。
	 *
	 * 操作:
	 * - Table Bのstart()を追加で要求する。
	 *
	 * 期待結果:
	 * - Errorを外へ再送出せずSessionを破棄してidleへ戻し、start failureとして1回記録・通知する。
	 */
	it( 'when start violates the active-session invariant, should recover without rethrowing', () => {
		prepareActiveSession();

		expect( () =>
			rowDndInteraction.start( {
				source: {
					tableIdentity: 'table-b',
					sourceRowIndex: 0,
				},
				initialConstraints: availableConstraints,
			} )
		).not.toThrow();

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( consoleErrorSpy ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - updateDestination中の内部Errorは共通failure recoveryでsafe idleへ戻ることを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが存在しないため、移動先更新要求は内部Lifecycle違反になる。
	 *
	 * 操作:
	 * - updateDestination()を実行する。
	 *
	 * 期待結果:
	 * - Errorを外へ再送出せず1回記録し、idleを維持して異常終了通知を1回発行する。
	 */
	it( 'when updateDestination throws internally, should recover through the common failure path', () => {
		expect( () => rowDndInteraction.updateDestination( 1 ) ).not.toThrow();

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( consoleErrorSpy ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - complete中のTable Integration ErrorはSessionを破棄し、現在Table状態からReorder Mode継続可否を再取得することを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効なactive Sessionが成立している。
	 * - complete再照合の最初の取得だけがErrorとなり、回復後の現在行制約は取得可能である。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - Errorを1回記録してidleへ戻り、異常終了通知を1回発行し、Table Aの行並び替えモードを維持する。
	 */
	it( 'when complete throws internally, should recover and resolve row mode from the current table state', () => {
		reorderMode.select( 'row', 'table-a' );
		prepareActiveSession();
		rowDndInteraction.updateDestination( 4 );
		getConstraintsMock
			.mockImplementationOnce( () => {
				throw new Error( 'complete constraints failed' );
			} )
			.mockReturnValueOnce( availableConstraints );

		rowDndInteraction.complete();

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( consoleErrorSpy ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - Reorder Mode継続可否の再取得自体が失敗しても、safe idleを維持し二重logしないことを確認する。
	 *
	 * 事前条件:
	 * - complete再照合とfailure recovery中の現在Table再取得が連続してErrorを送出する。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - 元のcomplete failureだけを1回記録し、canContinue=falseとして行並び替えモードを終了する。
	 */
	it( 'when failure recovery cannot re-read current constraints, should keep idle and resolve row mode as unavailable', () => {
		reorderMode.select( 'row', 'table-a' );
		prepareActiveSession();
		rowDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockImplementation( () => {
			throw new Error( 'constraints unavailable' );
		} );

		rowDndInteraction.complete();

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( consoleErrorSpy ).toHaveBeenCalledTimes( 1 );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
	} );

	/**
	 * 概要:
	 * - execution boundaryから渡されたErrorも同じ共通failure recoveryのcleanup順序へ合流することを確認する。
	 *
	 * 事前条件:
	 * - 接続インスタンスに開始準備値、activeな物理DnD、Droppable一時登録のcleanupが存在する。
	 *
	 * 操作:
	 * - recoverFailure()へupdateDestination Errorを渡す。
	 *
	 * 期待結果:
	 * - 開始準備値破棄、物理DnD cancel、一時登録破棄の順で1回ずつ実行し、Errorと異常終了通知も1回だけ発生する。
	 */
	it( 'when an execution boundary forwards an error, should join the same ordered failure recovery', () => {
		const cleanupOrder: string[] = [];
		const boundary = createRowDndOperationBoundary( {
			discardPreparedStart: () => cleanupOrder.push( 'preparedStart' ),
			cancelActiveDnd: () => cleanupOrder.push( 'activeDnd' ),
			discardTemporaryDndState: () => cleanupOrder.push( 'temporaryDndState' ),
		} );

		boundary.recoverFailure( 'updateDestination', new Error( 'engine callback failed' ), {
			tableIdentity: 'table-a',
		} );

		expect( cleanupOrder ).toEqual( [ 'preparedStart', 'activeDnd', 'temporaryDndState' ] );
		expect( consoleErrorSpy ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 概要:
	 * - failure recoveryから物理DnDをcancelした際の終了callbackが、同じ回復処理へ再入しないことを確認する。
	 *
	 * 事前条件:
	 * - cancelActiveDnd()が同期的にrecoverFailure()を再度要求する接続インスタンスを使用する。
	 *
	 * 操作:
	 * - 最初のrecoverFailure()を実行する。
	 *
	 * 期待結果:
	 * - 再入要求は無視され、cleanup・Error記録・異常終了通知が二重に発生しない。
	 */
	it( 'when engine cancellation re-enters recovery, should suppress duplicate cleanup logging and notification', () => {
		const discardPreparedStart = jest.fn();
		const discardTemporaryDndState = jest.fn();
		let reenterRecovery = (): void => undefined;

		const cancelActiveDnd = jest.fn( () => {
			reenterRecovery();
		} );

		const boundary = createRowDndOperationBoundary( {
			discardPreparedStart,
			cancelActiveDnd,
			discardTemporaryDndState,
		} );

		reenterRecovery = () => {
			boundary.recoverFailure( 'cancel', new Error( 're-entered callback' ), {
				tableIdentity: 'table-a',
			} );
		};

		/* 最初のfailure recoveryを開始する。 */
		boundary.recoverFailure( 'complete', new Error( 'original failure' ), {
			tableIdentity: 'table-a',
		} );

		expect( discardPreparedStart ).toHaveBeenCalledTimes( 1 );
		expect( cancelActiveDnd ).toHaveBeenCalledTimes( 1 );
		expect( discardTemporaryDndState ).toHaveBeenCalledTimes( 1 );
		expect( consoleErrorSpy ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - cleanup途中の追加Errorが後続cleanupとsafe idle復帰を妨げないことを確認する。
	 *
	 * 事前条件:
	 * - 開始準備値破棄と物理DnD cancelがErrorを送出し、一時登録破棄は正常に完了する。
	 *
	 * 操作:
	 * - recoverFailure()を実行する。
	 *
	 * 期待結果:
	 * - 後続cleanupまで実行してidleへ戻り、元のfailureだけを1回記録する。
	 */
	it( 'when cleanup steps throw during recovery, should continue cleanup and keep the original log single', () => {
		const discardTemporaryDndState = jest.fn();
		const boundary = createRowDndOperationBoundary( {
			discardPreparedStart: () => {
				throw new Error( 'prepared cleanup failed' );
			},
			cancelActiveDnd: () => {
				throw new Error( 'engine cancel failed' );
			},
			discardTemporaryDndState,
		} );

		boundary.recoverFailure( 'cancel', new Error( 'original failure' ), {
			tableIdentity: 'table-a',
		} );

		expect( discardTemporaryDndState ).toHaveBeenCalledTimes( 1 );
		expect( consoleErrorSpy ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );
} );