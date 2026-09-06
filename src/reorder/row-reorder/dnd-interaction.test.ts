/**
 * 行専用DnD Interactionの主要なSession Lifecycleと分岐を、公開境界から確認する。
 *
 * 開始可否はReorder Target Resolutionの責務として別テストで検証し、ここでは解決済みTargetから始まる
 * Session開始、移動先判定、complete時の現在構造への再照合、正常な中止、外部状態変化、およびLifecycle違反を検証する。
 */

import { rowReorderMode } from '@/reorder/reorder-mode';

import {
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	rowDndInteraction,
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

const target = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

/**
 * 解決済みReorder Targetから通常のactive Sessionを開始する。
 *
 * @param initialConstraints Session開始時の判定基準として使用する行制約。
 */
const startActiveSession = ( initialConstraints = availableConstraints ): void => {
	rowDndInteraction.start( target, initialConstraints );
};

describe( 'Row DnD Interaction lifecycle', () => {
	let terminationNoticeListener: jest.Mock;
	let unsubscribeTerminationNotice: () => void;

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
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		rowDndInteraction.cancel();
	} );

	/**
	 * 概要:
	 * - 解決済みTargetと開始時制約からactive Sessionを開始できることを確認する。
	 * 事前条件:
	 * - DnD Interactionはidleである。
	 * 操作:
	 * - start()を実行する。
	 * 期待結果:
	 * - activeへ遷移し、開始時にTable Integrationへ問い合わせない。
	 */
	it( 'when start receives a resolved target, should begin an active session without resolving the table again', () => {
		startActiveSession();

		expect( getRowDndPhase() ).toBe( 'active' );
		expect( getConstraintsMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - active Session中に別Sessionを開始できないことを確認する。
	 * 事前条件:
	 * - active Sessionが存在する。
	 * 操作:
	 * - start()を再度実行する。
	 * 期待結果:
	 * - Lifecycle違反としてErrorになる。
	 */
	it( 'when start is called during an active session, should reject the lifecycle violation', () => {
		startActiveSession();

		expect( () => rowDndInteraction.start( target, availableConstraints ) ).toThrow(
			'Row DnD start requires an idle session.'
		);
	} );

	/**
	 * 概要:
	 * - DnD中の移動先はSession開始時に確認した行制約だけで判定することを確認する。
	 * 事前条件:
	 * - Session開始時の行制約では境界4が分断不可で、境界3は有効である。
	 * 操作:
	 * - 境界4、続いて境界3へ移動先更新を要求する。
	 * 期待結果:
	 * - 境界4は無効化され、境界3だけが保持され、現在構造を取得し直さない。
	 */
	it( 'when destinations change during an active session, should validate them against the initial constraints', () => {
		startActiveSession( {
			rowCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		rowDndInteraction.updateDestination( 4 );
		expect( getRowDndDestinationBoundaryIndex() ).toBeNull();

		rowDndInteraction.updateDestination( 3 );

		expect( getRowDndDestinationBoundaryIndex() ).toBe( 3 );
		expect( getConstraintsMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - complete時の現在構造でも移動が成立する場合だけ確定済み行移動をTableへ反映することを確認する。
	 * 事前条件:
	 * - active Sessionの移動先境界4が開始時とcomplete時の双方で有効である。
	 * 操作:
	 * - 移動先を境界4へ更新してcomplete()する。
	 * 期待結果:
	 * - 行移動を1回反映してidleへ戻り、DnD終了後のモード継続可否を現在Tableから解決する。
	 */
	it( 'when complete revalidation succeeds, should apply the row move and finish normally', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

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
	 * - 有効な最終移動先がないdropはTableを更新しない正常終了として扱うことを確認する。
	 * 事前条件:
	 * - active Sessionは成立しているが、有効な移動先は保持していない。
	 * 操作:
	 * - complete()する。
	 * 期待結果:
	 * - 行移動と異常終了通知を発生させずidleへ戻る。
	 */
	it( 'when complete has no valid destination, should finish without applying a row move or notice', () => {
		startActiveSession();

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 概要:
	 * - complete直前の外部構造変化で移動元が成立しなくなった場合に安全終了することを確認する。
	 * 事前条件:
	 * - Session開始後に移動元行が結合範囲へ含まれる。
	 * 操作:
	 * - complete()する。
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を1回発行してidleへ戻る。
	 */
	it( 'when the source becomes invalid before complete, should terminate without applying the row move', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 2 ],
		} );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 概要:
	 * - cancelではTableを更新せずSessionを終了することを確認する。
	 * 事前条件:
	 * - active Sessionが存在する。
	 * 操作:
	 * - cancel()する。
	 * 期待結果:
	 * - Table更新なしでidleへ戻り、モード継続可否を解決する。
	 */
	it( 'when an active session is canceled, should finish without applying a row move', () => {
		startActiveSession();

		rowDndInteraction.cancel();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );
} );
