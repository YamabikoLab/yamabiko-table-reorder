/**
 * 列専用DnD Interactionの主要なSession Lifecycleと分岐を、公開境界から確認する。
 *
 * 開始可否はReorder Target Resolutionの責務として別テストで検証し、ここでは解決済みTargetから始まる
 * Session開始、移動先判定、complete時の現在構造への再照合、正常な中止、外部状態変化、およびLifecycle違反を検証する。
 */

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
	columnReorderMode: {
		resolveAfterDnd: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/table-integration', () => ( {
	columnTableIntegration: {
		getConstraints: jest.fn(),
		applyColumnMove: jest.fn(),
	},
} ) );

const getConstraintsMock = columnTableIntegration.getConstraints as jest.MockedFunction<
	typeof columnTableIntegration.getConstraints
>;
const applyColumnMoveMock = columnTableIntegration.applyColumnMove as jest.MockedFunction<
	typeof columnTableIntegration.applyColumnMove
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
		getConstraintsMock.mockReset();
		applyColumnMoveMock.mockReset();
		resolveAfterDndMock.mockReset();
		getConstraintsMock.mockReturnValue( availableConstraints );
		applyColumnMoveMock.mockReturnValue( true );
		terminationNoticeListener = jest.fn();
		unsubscribeTerminationNotice = subscribeColumnDndTerminationNotice( terminationNoticeListener );
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		columnDndInteraction.cancel();
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

		expect( getColumnDndPhase() ).toBe( 'active' );
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

		expect( () => columnDndInteraction.start( target, availableConstraints ) ).toThrow(
			'Column DnD start requires an idle session.'
		);
	} );

	/**
	 * 概要:
	 * - DnD進行中の移動先はSession開始時に確認した列制約だけで判定することを確認する。
	 * 事前条件:
	 * - Session開始時の列制約では境界4が分断不可で、境界3は有効である。
	 * 操作:
	 * - 境界4、続いて境界3へ移動先更新を要求する。
	 * 期待結果:
	 * - 境界4は無効化され、境界3だけが保持され、現在構造を取得し直さない。
	 */
	it( 'when destinations change during an active session, should validate them against the initial constraints', () => {
		startActiveSession( {
			columnCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		columnDndInteraction.updateDestination( 4 );
		expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();

		columnDndInteraction.updateDestination( 3 );

		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 3 );
		expect( getConstraintsMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 同位置相当、範囲外、Table構造を分断する境界を有効移動先にしないことを確認する。
	 * 事前条件:
	 * - 移動元は論理列1で、境界4は分断不可である。
	 * 操作:
	 * - 境界1、2、-1、6、4を順に移動先として要求する。
	 * 期待結果:
	 * - いずれも有効移動先として保持されない。
	 */
	it( 'when a destination does not produce a valid column move, should keep the destination unavailable', () => {
		startActiveSession( {
			columnCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		/* 列順を変更できない代表的な移動先を同じSession条件で確認する。 */
		for ( const destination of [ 1, 2, -1, 6, 4 ] ) {
			columnDndInteraction.updateDestination( destination );
			expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
		}
	} );

	/**
	 * 概要:
	 * - 一度成立した移動先が、その後成立しない候補へ変わった場合に保持され続けないことを確認する。
	 * 事前条件:
	 * - 境界3は有効な移動先である。
	 * 操作:
	 * - 境界3を有効移動先として保持した後、移動先候補なしを通知する。
	 * 期待結果:
	 * - 以前の有効移動先を破棄し、現在の移動先はnullになる。
	 */
	it( 'when a valid destination is followed by no destination, should clear the previous destination', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 3 );
		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 3 );

		columnDndInteraction.updateDestination( null );

		expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
	} );

	/**
	 * 概要:
	 * - complete時の現在構造でも移動が成立する場合だけ確定済み列移動をTableへ反映することを確認する。
	 * 事前条件:
	 * - active Sessionの移動先境界4が開始時とcomplete時の双方で有効である。
	 * 操作:
	 * - 移動先を境界4へ更新してcomplete()する。
	 * 期待結果:
	 * - 列移動を1回反映してidleへ戻り、DnD終了後のモード継続可否を現在Tableから解決する。
	 */
	it( 'when complete revalidation succeeds, should apply the column move and finish normally', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );

		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceColumnIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );

	/**
	 * 概要:
	 * - 有効な最終移動先がないdropはTableを更新しない通常終了として扱うことを確認する。
	 * 事前条件:
	 * - active Sessionは成立しているが、有効な移動先は保持していない。
	 * 操作:
	 * - complete()する。
	 * 期待結果:
	 * - 列移動と異常終了通知を発生させずidleへ戻り、その後のモード継続可否を解決する。
	 */
	it( 'when complete has no valid destination, should finish without applying a column move or notice', () => {
		startActiveSession();

		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );

	/**
	 * 概要:
	 * - complete直前の外部構造変化で移動元が単独移動できなくなった場合に安全終了することを確認する。
	 * 事前条件:
	 * - Session開始後に移動元列の直後境界が分断不可になる。
	 * 操作:
	 * - 有効な移動先を保持した状態でcomplete()する。
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を1回発行してidleへ戻る。
	 */
	it( 'when the source becomes invalid before complete, should terminate without applying the column move', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( {
			columnCount: 5,
			blockedBoundaries: [ 2 ],
		} );

		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 概要:
	 * - complete直前の外部構造変化で最終移動先が成立しなくなった場合に安全終了することを確認する。
	 * 事前条件:
	 * - Session開始時には境界4が有効だが、complete時には境界4が分断不可になっている。
	 * 操作:
	 * - 境界4を保持した状態でcomplete()する。
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を1回発行してidleへ戻る。
	 */
	it( 'when the destination becomes invalid before complete, should terminate without applying the column move', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( {
			columnCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 概要:
	 * - complete時に対象Tableを利用できなくなった場合も部分更新せず安全終了することを確認する。
	 * 事前条件:
	 * - active Sessionには有効移動先があり、complete時のTable制約を取得できない。
	 * 操作:
	 * - complete()する。
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を1回発行する。
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
	 * 概要:
	 * - 再照合後の外部状態変化で確定済み列移動を反映できない場合も安全終了することを確認する。
	 * 事前条件:
	 * - complete時の再照合は成立するが、Table Integrationは列移動を反映できない。
	 * 操作:
	 * - 有効な移動先を保持した状態でcomplete()する。
	 * 期待結果:
	 * - active Sessionをidleへ戻し、異常終了通知を1回発行する。
	 */
	it( 'when the confirmed column move cannot be applied, should finish with a termination notice', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		applyColumnMoveMock.mockReturnValueOnce( false );

		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 概要:
	 * - Table Integrationの内部Errorを通常の安全終了へ変換しないことを確認する。
	 * 事前条件:
	 * - active Sessionには有効移動先があり、complete時の現在制約取得で内部Errorが発生する。
	 * 操作:
	 * - complete()する。
	 * 期待結果:
	 * - Errorがそのまま伝播し、利用者向けの異常終了通知やReorder Modeの終了後解決は行わない。
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
	 * 概要:
	 * - cancelではTableを更新せずSessionを終了することを確認する。
	 * 事前条件:
	 * - active Sessionが存在する。
	 * 操作:
	 * - cancel()する。
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
	 * 概要:
	 * - active Sessionがないcomplete要求は内部Lifecycle違反として扱うことを確認する。
	 * 操作:
	 * - idle状態でcomplete()する。
	 * 期待結果:
	 * - Errorが伝播し、通常の終了結果へ変換されない。
	 */
	it( 'when complete is called while idle, should propagate the lifecycle error', () => {
		expect( () => columnDndInteraction.complete() ).toThrow(
			'Column DnD complete requires an active session.'
		);
	} );
} );