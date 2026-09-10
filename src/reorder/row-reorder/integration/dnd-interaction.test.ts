/**
 * 行専用DnD Interactionの主要なSession Lifecycleと分岐を、公開境界から確認する。
 *
 * 開始可否はReorder Target Resolutionの責務として別テストで検証し、ここでは解決済みTargetから始まる
 * Session開始、移動先判定、complete時の現在構造への再照合、反映規模による経路選択、正常な中止、外部状態変化、およびLifecycle違反を検証する。
 */

import { rowReorderMode } from '@/reorder/reorder-mode';
import { requestLargeRowReorderApply } from '@/reorder/row-reorder/responsibilities/reorder-apply';

import {
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	rowDndInteraction,
	subscribeRowDndTerminationNotice,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';
import type { RowReorderConstraints } from '@/reorder/row-reorder/responsibilities/table-integration';

jest.mock( '@/reorder/reorder-mode', () => ( {
	rowReorderMode: {
		resolveAfterDnd: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/reorder-apply', () => ( {
	requestLargeRowReorderApply: jest.fn(),
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		getAffectedCellCount: jest.fn(),
		applyRowMove: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.MockedFunction<
	typeof rowTableIntegration.getConstraints
>;
const getAffectedCellCountMock = rowTableIntegration.getAffectedCellCount as jest.MockedFunction<
	typeof rowTableIntegration.getAffectedCellCount
>;
const applyRowMoveMock = rowTableIntegration.applyRowMove as jest.MockedFunction<
	typeof rowTableIntegration.applyRowMove
>;
const requestLargeRowReorderApplyMock = requestLargeRowReorderApply as jest.MockedFunction<
	typeof requestLargeRowReorderApply
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
		getConstraintsMock.mockReturnValue( availableConstraints );
		getAffectedCellCountMock.mockReturnValue( 20 );
		applyRowMoveMock.mockReturnValue( true );
		requestLargeRowReorderApplyMock.mockReturnValue( true );
		terminationNoticeListener = jest.fn();
		unsubscribeTerminationNotice = subscribeRowDndTerminationNotice( terminationNoticeListener );
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		rowDndInteraction.cancel();
	} );

	/**
	 * 解決済みTargetからactive Sessionを開始できることを確認する。
	 *
	 * 事前条件:
	 * - DnD Interactionはidleである。
	 *
	 * 操作:
	 * - start()を実行する。
	 *
	 * 期待結果:
	 * - activeへ遷移し、開始時にTable Integrationへ問い合わせない。
	 */
	it( 'when start receives a resolved target, should begin an active session without resolving the table again', () => {
		startActiveSession();

		expect( getRowDndPhase() ).toBe( 'active' );
		expect( getConstraintsMock ).not.toHaveBeenCalled();
	} );

	/**
	 * active Session中に別Sessionを開始できないことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが存在する。
	 *
	 * 操作:
	 * - start()を再度実行する。
	 *
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
	 * DnD中の移動先をSession開始時の行制約で判定することを確認する。
	 *
	 * 事前条件:
	 * - 境界4は分断不可、境界3は有効である。
	 *
	 * 操作:
	 * - 境界4、続いて境界3へ移動先を更新する。
	 *
	 * 期待結果:
	 * - 境界3だけが保持され、現在構造を取得し直さない。
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
	 * 小規模な行移動は確認を挟まず直接反映することを確認する。
	 *
	 * 事前条件:
	 * - complete時の移動が有効で、更新対象セル数は閾値以下である。
	 *
	 * 操作:
	 * - 有効な移動先でcomplete()する。
	 *
	 * 期待結果:
	 * - 更新対象セル数を確認し、行移動を直接1回反映してidleへ戻る。
	 */
	it( 'when complete revalidation succeeds for a small move, should apply the row move and finish normally', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( getAffectedCellCountMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( applyRowMoveMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( requestLargeRowReorderApplyMock ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );

	/**
	 * 大規模な行移動はDnD Session終了後に確認付き反映へ引き渡すことを確認する。
	 *
	 * 事前条件:
	 * - 更新対象セル数が共通閾値を超えている。
	 *
	 * 操作:
	 * - 有効な移動先でcomplete()する。
	 *
	 * 期待結果:
	 * - 行移動を直接反映せず、まずDnD Sessionをidleへ戻す。
	 * - 同期的なcomplete処理を抜けた後に、移動意図を確認付き反映へ1回だけ引き渡す。
	 */
	it( 'when affected cell count exceeds the threshold, should end the DnD session before requesting confirmation', async () => {
		getAffectedCellCountMock.mockReturnValue( 2_001 );
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( requestLargeRowReorderApplyMock ).not.toHaveBeenCalled();
		expect( applyRowMoveMock ).not.toHaveBeenCalled();

		await Promise.resolve();

		expect( requestLargeRowReorderApplyMock ).toHaveBeenCalledTimes( 1 );
		expect( requestLargeRowReorderApplyMock ).toHaveBeenCalledWith( {
			tableIdentity: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
	} );

	/**
	 * 更新対象セル数を安全に算出できない場合はTableを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - complete時の移動自体は有効だが、更新対象セル数を取得できない。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - 直接反映も確認付き反映も行わず、異常終了通知を発行する。
	 */
	it( 'when affected cell count cannot be resolved, should terminate without changing the table', () => {
		getAffectedCellCountMock.mockReturnValue( null );
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( requestLargeRowReorderApplyMock ).not.toHaveBeenCalled();
		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 有効な最終移動先がないdropを正常終了として扱うことを確認する。
	 *
	 * 操作:
	 * - 移動先を保持せずcomplete()する。
	 *
	 * 期待結果:
	 * - Tableを更新せず異常終了通知も発生しない。
	 */
	it( 'when complete has no valid destination, should finish without applying a row move or notice', () => {
		startActiveSession();

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * complete直前に移動元が無効になった場合は安全終了することを確認する。
	 *
	 * 事前条件:
	 * - Session開始後に移動元行が結合範囲へ含まれる。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を1回発行する。
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
	 * complete直前に移動先が無効になった場合は安全終了することを確認する。
	 *
	 * 事前条件:
	 * - Session開始後に最終移動先が分断不可境界になる。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を1回発行する。
	 */
	it( 'when the destination becomes invalid before complete, should terminate without applying the row move', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 再照合後に行移動を反映できない場合も安全終了することを確認する。
	 *
	 * 事前条件:
	 * - complete時の再照合は成立するが、Table Integrationで反映できない。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - idleへ戻り、異常終了通知を1回発行する。
	 */
	it( 'when the confirmed row move cannot be applied, should finish with a termination notice', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );
		applyRowMoveMock.mockReturnValueOnce( false );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * cancelではTableを更新せずSessionを終了することを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが存在する。
	 *
	 * 操作:
	 * - cancel()する。
	 *
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
