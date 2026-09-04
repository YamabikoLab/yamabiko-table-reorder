/**
 * 行専用DnD Interactionの正常Lifecycleで、既存テストから抜けている主要な内部仕様を確認する。
 *
 * 開始不能時の通知要否、開始可否判定時制約の固定、行順が変わらないdrop、
 * および通常cancel後のReorder Mode継続判断を、公開境界から観測できる振る舞いとして検証する。
 */

import { reorderMode, rowReorderMode } from '@/reorder/reorder-mode';

import {
	getRowDndDestinationBoundaryIndex,
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

const RESET_TABLE_IDENTITY = '__row-dnd-normal-lifecycle-test-reset__';

const resetReorderMode = (): void => {
	reorderMode.observeTable( RESET_TABLE_IDENTITY );
	reorderMode.notifyTableInactive( RESET_TABLE_IDENTITY );
};

/** 開始可能な行DnD Sessionを成立させる。 */
const prepareActiveSession = (): void => {
	getConstraintsMock.mockReturnValueOnce( availableConstraints );
	const preparation = rowDndInteraction.prepareStart( source );

	if ( preparation === null ) {
		throw new Error( 'Test precondition failed: expected start preparation.' );
	}

	rowDndInteraction.start( preparation );
};

describe( 'Row DnD Interaction normal lifecycle contracts', () => {
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
	 * - Designで定義された移動不可理由によらない開始不能では、開始拒否通知を発行しないことを確認する。
	 *
	 * 事前条件:
	 * - 1回目は対象Tableの行制約を取得できない。
	 * - 2回目は行制約を取得できるが、開始候補がtbodyの範囲外である。
	 *
	 * 操作:
	 * - それぞれの開始候補でprepareStart()を実行する。
	 *
	 * 期待結果:
	 * - どちらもnullを返すが、開始拒否通知、異常終了通知、Error記録は発生しない。
	 */
	it( 'when start is unavailable without a design rejection reason, should reject without a notice', () => {
		getConstraintsMock.mockReturnValueOnce( null );

		const unavailableTablePreparation = rowDndInteraction.prepareStart( source );
		const outsideBodyPreparation = rowDndInteraction.prepareStart( {
			tableIdentity: 'table-a',
			sourceRowIndex: availableConstraints.rowCount,
		} );

		expect( unavailableTablePreparation ).toBeNull();
		expect( outsideBodyPreparation ).toBeNull();
		expect( startRejectionNoticeListener ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( consoleErrorSpy ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Session開始時の移動先判定はprepareStart()で確認した行制約へ固定され、start時の外部Table状態へ差し替わらないことを確認する。
	 *
	 * 事前条件:
	 * - 開始可否判定時は境界4が分断不可である。
	 * - prepareStart()後の現在Tableでは境界4が利用可能になっている。
	 *
	 * 操作:
	 * - 準備値からSessionを開始し、境界4へ移動先更新を要求する。
	 *
	 * 期待結果:
	 * - 境界4はSession開始時制約に従って有効移動先にならず、Table構造も再取得しない。
	 */
	it( 'when table constraints change after preparation, should keep using the prepared constraints for the session', () => {
		const preparedConstraints = {
			rowCount: 5,
			blockedBoundaries: [ 4 ] as readonly number[],
		};
		getConstraintsMock.mockReturnValueOnce( preparedConstraints );
		const preparation = rowDndInteraction.prepareStart( source );

		if ( preparation === null ) {
			throw new Error( 'Test precondition failed: expected start preparation.' );
		}

		rowDndInteraction.start( preparation );
		getConstraintsMock.mockReturnValue( availableConstraints );
		rowDndInteraction.updateDestination( 4 );

		expect( getRowDndDestinationBoundaryIndex() ).toBeNull();
		expect( getConstraintsMock ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( consoleErrorSpy ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 移動元行の直前または直後へのdropでは、行順が変化しないためTable更新や異常終了通知を行わないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えモードが有効である。
	 * - 移動元行は1で、境界1と境界2はいずれも有効である。
	 *
	 * 操作:
	 * - 境界1へのdropと境界2へのdropをそれぞれcomplete()する。
	 *
	 * 期待結果:
	 * - どちらもTable更新を行わず正常終了し、行並び替えモードを維持する。
	 */
	it( 'when drop keeps the source row in the same order, should complete without applying a row move', () => {
		reorderMode.select( 'row', 'table-a' );
		prepareActiveSession();
		rowDndInteraction.updateDestination( 1 );
		rowDndInteraction.complete();

		prepareActiveSession();
		rowDndInteraction.updateDestination( 2 );
		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );
		expect( consoleErrorSpy ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - complete時の再照合後にTable更新だけが外部状態変化で成立しなくなった場合、内部Errorではなく安全な確定不能として終了することを確認する。
	 *
	 * 事前条件:
	 * - complete時の現在行制約では移動元と移動先が有効である。
	 * - Table Integrationは更新要求時点の外部状態変化により行移動を適用できずfalseを返す。
	 *
	 * 操作:
	 * - 行順が変化する移動先でcomplete()する。
	 *
	 * 期待結果:
	 * - Sessionはidleへ戻り、異常終了通知を1回発行するが、Error記録は行わない。
	 */
	it( 'when row move becomes unavailable after complete revalidation, should terminate without logging an error', () => {
		prepareActiveSession();
		rowDndInteraction.updateDestination( 4 );
		applyRowMoveMock.mockReturnValueOnce( false );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( consoleErrorSpy ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 通常cancel後は終了対象Tableの現在状態だけでReorder Mode継続可否を解決することを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えモードが有効である。
	 * - 1回目のcancel後は現在行制約を取得でき、2回目のcancel後は取得できない。
	 *
	 * 操作:
	 * - それぞれactive Sessionをcancelする。
	 *
	 * 期待結果:
	 * - 1回目は行並び替えモードを維持し、2回目は通常編集へ戻る。どちらもTable更新と異常終了通知は行わない。
	 */
	it( 'when active session is cancelled, should resolve row mode from the current table availability', () => {
		reorderMode.select( 'row', 'table-a' );
		prepareActiveSession();

		rowDndInteraction.cancel();

		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );

		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( null );

		rowDndInteraction.cancel();

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( consoleErrorSpy ).not.toHaveBeenCalled();
	} );
} );
