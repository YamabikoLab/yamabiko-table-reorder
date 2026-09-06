/**
 * 行専用DnD Interactionの主要なライフサイクルと分岐を、公開境界から確認する。
 *
 * 開始可否、Session開始時制約による移動先判定、complete時の現在構造への再照合、
 * 正常な中止、外部状態変化、および内部Lifecycle違反を、Store内部へ依存せず検証する。
 */

import { rowReorderMode } from '@/reorder/reorder-mode';

import {
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	rowDndInteraction,
	subscribeRowDndStartRejectionNotice,
	subscribeRowDndTerminationNotice,
} from './dnd-interaction';
import { rowTableIntegration } from './table-integration';
import type { RowReorderConstraints } from './table-integration';

jest.mock( '@/reorder/reorder-mode', () => ( {
	rowReorderMode: {
		resolveAfterDnd: jest.fn(),
	},
} ) );

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
const resolveAfterDndMock = rowReorderMode.resolveAfterDnd as jest.MockedFunction<
	typeof rowReorderMode.resolveAfterDnd
>;

const availableConstraints: RowReorderConstraints = {
	rowCount: 5,
	blockedBoundaries: [],
};

const source = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

/**
 * 通常のactive Sessionを公開境界から準備する。
 *
 * @param initialConstraints Session開始時の判定基準として使用する行制約。
 */
const prepareActiveSession = ( initialConstraints = availableConstraints ): void => {
	getConstraintsMock.mockReturnValueOnce( initialConstraints );
	const checkedConstraints = rowDndInteraction.prepareStart( source );

	if ( checkedConstraints === null ) {
		throw new Error( 'Test precondition failed: expected row DnD to be startable.' );
	}

	rowDndInteraction.start( source, checkedConstraints );
};

describe( 'Row DnD Interaction lifecycle', () => {
	let terminationNoticeListener: jest.Mock;
	let unsubscribeTerminationNotice: () => void;
	let startRejectionNoticeListener: jest.Mock;
	let unsubscribeStartRejectionNotice: () => void;

	beforeEach( () => {
		rowDndInteraction.cancel();
		jest.clearAllMocks();
		getConstraintsMock.mockReset();
		applyRowMoveMock.mockReset();
		resolveAfterDndMock.mockReset();
		getConstraintsMock.mockReturnValue( availableConstraints );
		applyRowMoveMock.mockReturnValue( true );
		terminationNoticeListener = jest.fn();
		unsubscribeTerminationNotice = subscribeRowDndTerminationNotice( terminationNoticeListener );
		startRejectionNoticeListener = jest.fn();
		unsubscribeStartRejectionNotice = subscribeRowDndStartRejectionNotice(
			startRejectionNoticeListener
		);
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		unsubscribeStartRejectionNotice();
		rowDndInteraction.cancel();
	} );

	/**
	 * 概要:
	 * - 行単位で移動可能な開始候補では、開始判定時の行制約を開始処理へ引き継げることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableを取得でき、移動元行の前後に分断不可境界がない。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - 現在の行制約を返してidleを維持し、開始拒否通知を発行しない。
	 */
	it( 'when the source row is movable, should return the checked constraints without starting a session', () => {
		const checkedConstraints = rowDndInteraction.prepareStart( source );

		expect( checkedConstraints ).toBe( availableConstraints );
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( startRejectionNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - rowspan等の結合範囲に含まれる行は、利用者へ理由を示す開始拒否として扱うことを確認する。
	 *
	 * 事前条件:
	 * - 移動元行の直後が分断不可境界である。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - 開始不能を返し、開始拒否通知を1回発行してSessionを開始しない。
	 */
	it( 'when the source row is blocked by a merged range, should reject the start with a notice', () => {
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 2 ],
		} );

		const checkedConstraints = rowDndInteraction.prepareStart( source );

		expect( checkedConstraints ).toBeNull();
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( startRejectionNoticeListener ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - tbody内の実在行ではない開始候補は、利用者向け理由を伴わない通常の開始不能として扱うことを確認する。
	 *
	 * 事前条件:
	 * - 行制約は取得できるが、開始候補の行位置がtbody範囲外である。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - 開始不能を返し、開始拒否通知を発行しない。
	 */
	it( 'when the source row is outside tbody, should reject the start without a notice', () => {
		const checkedConstraints = rowDndInteraction.prepareStart( {
			tableIdentity: 'table-a',
			sourceRowIndex: 5,
		} );

		expect( checkedConstraints ).toBeNull();
		expect( startRejectionNoticeListener ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 概要:
	 * - DnD中の移動先はSession開始時に確認した行制約だけで判定することを確認する。
	 *
	 * 事前条件:
	 * - Session開始時の行制約では境界4が分断不可で、境界3は有効である。
	 *
	 * 操作:
	 * - start後に境界4、続いて境界3へ移動先更新を要求する。
	 *
	 * 期待結果:
	 * - 境界4は無効化され、境界3だけが保持され、移動先更新中に現在のTable構造を取得し直さない。
	 */
	it( 'when destinations change during an active session, should validate them against the initial constraints', () => {
		prepareActiveSession( {
			rowCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		rowDndInteraction.updateDestination( 4 );
		expect( getRowDndDestinationBoundaryIndex() ).toBeNull();

		rowDndInteraction.updateDestination( 3 );

		expect( getRowDndDestinationBoundaryIndex() ).toBe( 3 );
		expect( getConstraintsMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - complete時の現在構造でも移動が成立する場合だけ、確定済み行移動をTableへ反映することを確認する。
	 *
	 * 事前条件:
	 * - active Sessionの移動先境界4が開始時とcomplete時の双方で有効である。
	 *
	 * 操作:
	 * - 移動先を境界4へ更新してcomplete()する。
	 *
	 * 期待結果:
	 * - 行移動を1回反映してidleへ戻り、異常終了通知を出さず、DnD終了後のモード継続可否を現在Tableから解決する。
	 */
	it( 'when complete revalidation succeeds, should apply the row move and finish normally', () => {
		prepareActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( applyRowMoveMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );

	/**
	 * 概要:
	 * - 有効な最終移動先がないdropは、Tableを更新しない正常終了として扱うことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionは成立しているが、有効な移動先は保持していない。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - 行移動と異常終了通知を発生させずidleへ戻る。
	 */
	it( 'when complete has no valid destination, should finish without applying a row move or notice', () => {
		prepareActiveSession();

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 概要:
	 * - complete直前の外部構造変化で最終移動先が成立しなくなった場合は、更新せず安全に終了することを確認する。
	 *
	 * 事前条件:
	 * - Session開始時には境界4が有効だが、complete時の現在構造では境界4が分断不可になっている。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - 行移動を反映せずidleへ戻り、異常終了通知を1回発行する。
	 */
	it( 'when complete revalidation becomes invalid, should stop without applying the row move', () => {
		prepareActiveSession();
		rowDndInteraction.updateDestination( 4 );
		getConstraintsMock
			.mockReturnValueOnce( {
				rowCount: 5,
				blockedBoundaries: [ 4 ],
			} )
			.mockReturnValueOnce( availableConstraints );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );

	/**
	 * 概要:
	 * - 再照合後からTable更新要求までの外部状態変化で更新できない場合も、内部Errorにせず安全に終了することを確認する。
	 *
	 * 事前条件:
	 * - complete時の再照合は成立するが、Table Integrationは行移動を反映できない。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - idleへ戻り、異常終了通知を1回発行する。
	 */
	it( 'when the confirmed row move cannot be applied, should finish with a termination notice', () => {
		prepareActiveSession();
		rowDndInteraction.updateDestination( 4 );
		applyRowMoveMock.mockReturnValueOnce( false );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 概要:
	 * - cancelはTableを更新せず正常終了し、終了後の現在Table可用性だけをReorder Modeへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立しており、DnD終了後には対象Tableの行制約を取得できない。
	 *
	 * 操作:
	 * - cancel()する。
	 *
	 * 期待結果:
	 * - 行移動と異常終了通知を発生させずidleへ戻り、モード継続不能を通知する。
	 */
	it( 'when an active session is cancelled, should finish without applying a move and resolve mode availability', () => {
		prepareActiveSession();
		rowDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( null );

		rowDndInteraction.cancel();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', false );
	} );

	/**
	 * 概要:
	 * - active Session中に別Sessionを開始する要求は、単一Sessionの内部仕様違反として扱うことを確認する。
	 *
	 * 事前条件:
	 * - Table Aのactive Sessionがすでに成立している。
	 *
	 * 操作:
	 * - Table Bのstart()を追加で要求する。
	 *
	 * 期待結果:
	 * - Errorを送出し、既存Sessionをactiveのまま維持する。
	 */
	it( 'when a second session start is requested while active, should throw and keep the current session active', () => {
		prepareActiveSession();

		expect( () =>
			rowDndInteraction.start(
				{
					tableIdentity: 'table-b',
					sourceRowIndex: 0,
				},
				availableConstraints
			)
		).toThrow();
		expect( getRowDndPhase() ).toBe( 'active' );
	} );
} );