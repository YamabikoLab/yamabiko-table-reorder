/**
 * 列専用DnD Interactionの主要なSession Lifecycleと分岐を、公開境界から確認する。
 *
 * 解決済みTargetから始まるSession開始、移動先判定、complete時の現在構造への再照合、
 * 反映規模による経路選択、正常な中止、外部状態変化、およびLifecycle違反を検証する。
 */

import { requestLargeColumnReorderApply } from '@/reorder/column-reorder/responsibilities/reorder-apply';
import { columnReorderMode } from '@/reorder/reorder-mode';
import {
	columnDndInteraction,
	getColumnDndDestinationBoundaryIndex,
	getColumnDndPhase,
	subscribeColumnDndTerminationNotice,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import type { ColumnReorderConstraints } from '@/reorder/column-reorder/responsibilities/table-integration';

jest.mock( '@/reorder/reorder-mode', () => ( {
	columnReorderMode: { resolveAfterDnd: jest.fn() },
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/reorder-apply', () => ( {
	requestLargeColumnReorderApply: jest.fn(),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/table-integration', () => ( {
	columnTableIntegration: {
		getConstraints: jest.fn(),
		getAffectedCellCount: jest.fn(),
		applyColumnMove: jest.fn(),
	},
} ) );

const getConstraintsMock = columnTableIntegration.getConstraints as jest.MockedFunction<
	typeof columnTableIntegration.getConstraints
>;
const getAffectedCellCountMock = columnTableIntegration.getAffectedCellCount as jest.MockedFunction<
	typeof columnTableIntegration.getAffectedCellCount
>;
const applyColumnMoveMock = columnTableIntegration.applyColumnMove as jest.MockedFunction<
	typeof columnTableIntegration.applyColumnMove
>;
const requestLargeColumnReorderApplyMock = requestLargeColumnReorderApply as jest.MockedFunction<
	typeof requestLargeColumnReorderApply
>;
const resolveAfterDndMock = columnReorderMode.resolveAfterDnd as jest.MockedFunction<
	typeof columnReorderMode.resolveAfterDnd
>;

const availableConstraints: ColumnReorderConstraints = {
	columnCount: 5,
	blockedBoundaries: [],
};

const target = {
	tableIdentity: 'table-a',
	sourceColumnIndex: 1,
};

/**
 * 解決済みReorder Targetから通常のactive Sessionを開始する。
 *
 * @param initialConstraints Session開始時の判定基準として使用する列制約。
 */
const startActiveSession = ( initialConstraints = availableConstraints ): void => {
	columnDndInteraction.start( target, initialConstraints );
};

describe( 'Column DnD Interaction lifecycle', () => {
	let terminationNoticeListener: jest.Mock;
	let unsubscribeTerminationNotice: () => void;

	beforeEach( () => {
		columnDndInteraction.cancel();
		jest.clearAllMocks();
		getConstraintsMock.mockReturnValue( availableConstraints );
		getAffectedCellCountMock.mockReturnValue( 20 );
		applyColumnMoveMock.mockReturnValue( true );
		requestLargeColumnReorderApplyMock.mockReturnValue( true );
		terminationNoticeListener = jest.fn();
		unsubscribeTerminationNotice = subscribeColumnDndTerminationNotice( terminationNoticeListener );
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		columnDndInteraction.cancel();
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
		expect( getColumnDndPhase() ).toBe( 'active' );
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
		expect( () => columnDndInteraction.start( target, availableConstraints ) ).toThrow(
			'Column DnD start requires an idle session.'
		);
	} );

	/**
	 * DnD中の移動先をSession開始時の列制約で判定することを確認する。
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
		startActiveSession( { columnCount: 5, blockedBoundaries: [ 4 ] } );
		columnDndInteraction.updateDestination( 4 );
		expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
		columnDndInteraction.updateDestination( 3 );
		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 3 );
		expect( getConstraintsMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 列順を変えない位置、範囲外、分断不可境界を移動先として保持しないことを確認する。
	 *
	 * 事前条件:
	 * - 移動元は論理列1で、境界4は分断不可である。
	 *
	 * 操作:
	 * - 無効な代表境界を順に通知する。
	 *
	 * 期待結果:
	 * - いずれも有効移動先として保持されない。
	 */
	it( 'when a destination does not produce a valid column move, should keep the destination unavailable', () => {
		startActiveSession( { columnCount: 5, blockedBoundaries: [ 4 ] } );
		for ( const destination of [ 1, 2, -1, 6, 4 ] ) {
			columnDndInteraction.updateDestination( destination );
			expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
		}
	} );

	/**
	 * 一度成立した移動先の後に候補なしになった場合は以前の移動先を破棄することを確認する。
	 *
	 * 事前条件:
	 * - 境界3が有効な移動先として保持されている。
	 *
	 * 操作:
	 * - 移動先候補なしを通知する。
	 *
	 * 期待結果:
	 * - 現在の移動先はnullになる。
	 */
	it( 'when a valid destination is followed by no destination, should clear the previous destination', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 3 );
		columnDndInteraction.updateDestination( null );
		expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
	} );

	/**
	 * 小規模な列移動は確認を挟まず直接反映することを確認する。
	 *
	 * 事前条件:
	 * - complete時の移動が有効で、更新対象セル数は閾値以下である。
	 *
	 * 操作:
	 * - 有効な移動先でcomplete()する。
	 *
	 * 期待結果:
	 * - 更新対象セル数を確認し、列移動を直接反映してidleへ戻る。
	 */
	it( 'when complete revalidation succeeds for a small move, should apply the column move and finish normally', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		columnDndInteraction.complete();

		expect( getAffectedCellCountMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceColumnIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( applyColumnMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( requestLargeColumnReorderApplyMock ).not.toHaveBeenCalled();
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );

	/**
	 * 大規模な列移動はDnD Session終了後に確認付き反映へ引き渡すことを確認する。
	 *
	 * 事前条件:
	 * - 更新対象セル数が共通閾値を超えている。
	 *
	 * 操作:
	 * - 有効な移動先でcomplete()する。
	 *
	 * 期待結果:
	 * - 列移動を直接反映せず、まずDnD Sessionをidleへ戻す。
	 * - 同期的なcomplete処理を抜けた後に、移動意図を確認付き反映へ1回だけ引き渡す。
	 */
	it( 'when affected cell count exceeds the threshold, should end the DnD session before requesting confirmation', async () => {
		getAffectedCellCountMock.mockReturnValue( 2_001 );
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		columnDndInteraction.complete();

		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( requestLargeColumnReorderApplyMock ).not.toHaveBeenCalled();
		expect( applyColumnMoveMock ).not.toHaveBeenCalled();

		await Promise.resolve();

		expect( requestLargeColumnReorderApplyMock ).toHaveBeenCalledTimes( 1 );
		expect( requestLargeColumnReorderApplyMock ).toHaveBeenCalledWith( {
			tableIdentity: 'table-a',
			sourceColumnIndex: 1,
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
		columnDndInteraction.updateDestination( 4 );
		columnDndInteraction.complete();

		expect( requestLargeColumnReorderApplyMock ).not.toHaveBeenCalled();
		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 列移動確定後のReorder Mode継続可否をSession終了後の現在Tableから解決することを確認する。
	 *
	 * 事前条件:
	 * - complete時の再照合と列移動は成功するが、その後Table制約を取得できない。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - 列移動は反映され、Reorder Modeへ継続不能を通知する。
	 */
	it( 'when the table becomes unavailable after a successful complete, should resolve reorder mode from the post-session table state', () => {
		getConstraintsMock.mockReturnValueOnce( availableConstraints ).mockReturnValueOnce( null );
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( getConstraintsMock ).toHaveBeenCalledTimes( 2 );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', false );
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
	it( 'when complete has no valid destination, should finish without applying a column move or notice', () => {
		startActiveSession();
		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * complete直前に移動元が無効になった場合は安全終了することを確認する。
	 *
	 * 事前条件:
	 * - Session開始後に移動元列の直後境界が分断不可になる。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を発行する。
	 */
	it( 'when current constraints reject the source, should terminate without applying the column move', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( { columnCount: 5, blockedBoundaries: [ 2 ] } );
		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
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
	 * - Tableを更新せず異常終了通知を発行する。
	 */
	it( 'when the destination becomes invalid before complete, should terminate without applying the column move', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( { columnCount: 5, blockedBoundaries: [ 4 ] } );
		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * complete時に対象Tableを利用できない場合は部分更新せず安全終了することを確認する。
	 *
	 * 事前条件:
	 * - active Sessionには有効移動先があり、現在制約を取得できない。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を発行する。
	 */
	it( 'when the table becomes unavailable before complete, should terminate without applying the column move', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( null );
		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 再照合後に列移動を反映できない場合も安全終了することを確認する。
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
	it( 'when the confirmed column move cannot be applied, should finish with a termination notice', () => {
		applyColumnMoveMock.mockReturnValueOnce( false );
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		columnDndInteraction.complete();

		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * Table Integrationの内部Errorを通常の安全終了へ変換しないことを確認する。
	 *
	 * 事前条件:
	 * - complete時の現在制約取得で内部Errorが発生する。
	 *
	 * 操作:
	 * - complete()する。
	 *
	 * 期待結果:
	 * - Errorが伝播し、利用者向け通知へ変換されない。
	 */
	it( 'when table integration throws during complete, should propagate the internal error without a termination notice', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockImplementationOnce( () => {
			throw new Error( 'Column Table Integration invariant violation.' );
		} );

		expect( () => columnDndInteraction.complete() ).toThrow(
			'Column Table Integration invariant violation.'
		);
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( resolveAfterDndMock ).not.toHaveBeenCalled();
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
	it( 'when an active session is canceled, should finish without applying a column move', () => {
		startActiveSession();
		columnDndInteraction.cancel();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );

	/**
	 * active Sessionがないcomplete要求を内部Lifecycle違反として扱うことを確認する。
	 *
	 * 操作:
	 * - idle状態でcomplete()する。
	 *
	 * 期待結果:
	 * - Errorが伝播し、通常の終了結果へ変換されない。
	 */
	it( 'when complete is called while idle, should propagate the lifecycle error', () => {
		expect( () => columnDndInteraction.complete() ).toThrow(
			'Column DnD complete requires an active session.'
		);
	} );
} );
