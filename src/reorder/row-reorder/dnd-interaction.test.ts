/**
 * 行専用DnD Interactionの開始、移動先更新、確定、cancelのLifecycleを確認する。
 *
 * Store内部を直接参照せず、公開されたDnD Interaction境界とTable Integrationへの更新要求を通して、
 * Session開始時制約の保持、開始拒否通知、complete時の現在構造への再照合、正常終了、異常終了通知、
 * DnD終了後のReorder Mode解決、およびLifecycle違反を検証する。
 */

import { reorderMode, rowReorderMode } from '@/reorder/reorder-mode';

import {
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

const blockedSourceConstraints = {
	rowCount: 5,
	blockedBoundaries: [ 2 ] as readonly number[],
};

const source = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

const RESET_TABLE_IDENTITY = '__row-dnd-test-reset__';

const resetReorderMode = () => {
	reorderMode.observeTable( RESET_TABLE_IDENTITY );
	reorderMode.notifyTableInactive( RESET_TABLE_IDENTITY );
};

/**
 * 通常系のactive Sessionを準備する。
 *
 * prepareStartで確認した行制約をstartへ渡し、テスト対象のLifecycleをactiveまで進める。
 */
const prepareActiveSession = () => {
	getConstraintsMock.mockReturnValueOnce( availableConstraints );
	const initialConstraints = rowDndInteraction.prepareStart( source );

	if ( initialConstraints === null ) {
		throw new Error( 'Test precondition failed: expected initial constraints.' );
	}

	rowDndInteraction.start( source, initialConstraints );
	return initialConstraints;
};

describe( 'Row DnD Interaction lifecycle', () => {
	let terminationNoticeListener: jest.Mock;
	let unsubscribeTerminationNotice: () => void;
	let startRejectionNoticeListener: jest.Mock;
	let unsubscribeStartRejectionNotice: () => void;

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
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		unsubscribeStartRejectionNotice();
		rowDndInteraction.cancel();
		resetReorderMode();
	} );

	/**
	 * 概要:
	 * - 開始可能な行では、DnD開始可否判定時に確認した行制約が返り、開始拒否通知を行わないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは取得可能で、移動元行の前後に分断不可境界がない。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - Table Integrationから取得した行制約がそのまま返り、開始拒否通知は発行されない。
	 */
	it( 'when source row is movable, should return the checked initial constraints', () => {
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		const initialConstraints = rowDndInteraction.prepareStart( source );

		expect( initialConstraints ).toBe( availableConstraints );
		expect( startRejectionNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - rowspan等の結合範囲に含まれる移動元行では、DnD開始を拒否して移動不可理由の通知を1回発行することを確認する。
	 *
	 * 事前条件:
	 * - 移動元行の直後が分断不可境界である。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - nullを返し、開始拒否通知を1回発行し、異常終了通知は発行しない。
	 */
	it( 'when source row crosses a blocked boundary, should notify the start rejection once', () => {
		getConstraintsMock.mockReturnValueOnce( blockedSourceConstraints );

		const initialConstraints = rowDndInteraction.prepareStart( source );

		expect( initialConstraints ).toBeNull();
		expect( startRejectionNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Designで定義された移動不可理由によらない開始不能では、開始拒否通知を発行しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの行制約を取得できない。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - nullを返すが、開始拒否通知は発行されない。
	 */
	it( 'when table constraints are unavailable, should reject without a start rejection notice', () => {
		getConstraintsMock.mockReturnValueOnce( null );

		const initialConstraints = rowDndInteraction.prepareStart( source );

		expect( initialConstraints ).toBeNull();
		expect( startRejectionNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - tbody内の実在行ではない開始候補を、結合セルによる移動不可理由として通知しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの行制約は取得可能である。
	 * - 開始候補の行位置はtbodyの範囲外である。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - nullを返すが、開始拒否通知は発行されない。
	 */
	it( 'when source row is outside tbody, should reject without a start rejection notice', () => {
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		const initialConstraints = rowDndInteraction.prepareStart( {
			tableIdentity: 'table-a',
			sourceRowIndex: 5,
		} );

		expect( initialConstraints ).toBeNull();
		expect( startRejectionNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 開始拒否通知の購読を解除したPresentationには、その後の通知対象となる開始拒否を伝えないことを確認する。
	 *
	 * 事前条件:
	 * - 開始拒否通知listenerが購読済みである。
	 * - 移動元行の直後が分断不可境界である。
	 *
	 * 操作:
	 * - 購読を解除した後、prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - 開始拒否自体は成立するが、解除済みlistenerは呼び出されない。
	 */
	it( 'when start rejection notice subscription is removed, should stop delivering notices', () => {
		unsubscribeStartRejectionNotice();
		getConstraintsMock.mockReturnValueOnce( blockedSourceConstraints );

		const initialConstraints = rowDndInteraction.prepareStart( source );

		expect( initialConstraints ).toBeNull();
		expect( startRejectionNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - start()がprepareStart()で確認した行制約をそのままSessionへ引き継ぎ、DnD終了後のLifecycle判定とは分離されることを確認する。
	 *
	 * 事前条件:
	 * - prepareStart()で開始可能な行制約が返っている。
	 *
	 * 操作:
	 * - start()でSessionを開始し、その後の有効移動先を更新してcomplete()する。
	 *
	 * 期待結果:
	 * - Session中の確定再照合までは開始時制約を保持し、Session終了後にReorder Mode用の現在行制約を別途取得する。
	 */
	it( 'when checked constraints start a session, should keep them until complete revalidation', () => {
		const initialConstraints = prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.complete();

		expect( initialConstraints ).toBe( availableConstraints );
		expect( getConstraintsMock ).toHaveBeenCalledTimes( 3 );
		expect( getConstraintsMock ).toHaveBeenNthCalledWith( 1, 'table-a' );
		expect( getConstraintsMock ).toHaveBeenNthCalledWith( 2, 'table-a' );
		expect( getConstraintsMock ).toHaveBeenNthCalledWith( 3, 'table-a' );
	} );

	/**
	 * 概要:
	 * - Session開始時の行制約に対して無効な移動先は、確定可能な移動先として保持せず異常終了通知も行わないことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立している。
	 * - 移動先境界2はSession開始時の制約で分断不可である。
	 *
	 * 操作:
	 * - 無効な境界へupdateDestination()し、complete()する。
	 *
	 * 期待結果:
	 * - Table更新と異常終了通知を要求せず、確定用再照合は行わないが、終了後Lifecycle用の現在行制約は取得する。
	 */
	it( 'when destination is blocked by initial constraints, should complete without updating the table', () => {
		const blockedDestinationConstraints = {
			rowCount: 5,
			blockedBoundaries: [ 2 ] as readonly number[],
		};
		getConstraintsMock.mockReturnValueOnce( blockedDestinationConstraints );
		const destinationSource = {
			tableIdentity: 'table-a',
			sourceRowIndex: 3,
		};
		const initialConstraints = rowDndInteraction.prepareStart( destinationSource );

		if ( initialConstraints === null ) {
			throw new Error( 'Test precondition failed: expected initial constraints.' );
		}

		rowDndInteraction.start( destinationSource, initialConstraints );
		rowDndInteraction.updateDestination( 2 );
		rowDndInteraction.complete();

		expect( getConstraintsMock ).toHaveBeenCalledTimes( 2 );
		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 一度有効になった移動先候補がDnD中に失われた場合、過去の移動先を確定に使用しないことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立し、移動先境界4が有効である。
	 *
	 * 操作:
	 * - 境界4を設定した後、現在の移動先候補なしとしてnullへ更新し、complete()する。
	 *
	 * 期待結果:
	 * - 過去の境界4を使用してTableを更新せず、異常終了通知も発行しない。
	 */
	it( 'when the current destination is cleared before completion, should not apply the previous destination', () => {
		prepareActiveSession();

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.updateDestination( null );
		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - complete()時点の現在構造でも移動元と移動先が成立する場合だけ、Table Integrationへ確定済み行移動を渡すことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionの最終移動先はSession開始時の行制約に対して有効である。
	 * - complete()時点でも同じ移動が成立する。
	 *
	 * 操作:
	 * - 移動先を更新してcomplete()する。
	 *
	 * 期待結果:
	 * - Table Identity、移動元行、移動先境界を含む1回の行更新要求が行われる。
	 */
	it( 'when complete revalidation succeeds, should apply the confirmed row move once', () => {
		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.complete();

		expect( applyRowMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( applyRowMoveMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - complete()時点で今回の移動先だけが成立しなくなっても、対象Table自体が行並び替え可能ならReorder Modeを維持することを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 * - Session開始時には移動先境界4が有効だが、complete()時の再照合では境界4だけが分断不可になっている。
	 * - DnD終了後に取得し直すTable Aの行制約は利用可能である。
	 *
	 * 操作:
	 * - 移動先を更新してcomplete()する。
	 *
	 * 期待結果:
	 * - 今回のDnDは異常終了通知対象となるが、Table Aの行並び替えモードは維持される。
	 */
	it( 'when the completed move becomes invalid but the table remains supported, should keep row mode active', () => {
		reorderMode.select( 'row', 'table-a' );
		prepareActiveSession();
		getConstraintsMock
			.mockReturnValueOnce( {
				rowCount: 5,
				blockedBoundaries: [ 4 ],
			} )
			.mockReturnValueOnce( availableConstraints );

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - complete()時点で対象Table自体を安全に扱えなくなった場合は、DnDを異常終了として通知し、行並び替えモードも終了することを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効で、active Sessionが成立している。
	 * - complete()時の再照合とDnD終了後の継続可否確認のどちらでもTable Aの行制約を取得できない。
	 *
	 * 操作:
	 * - 有効な移動先を設定してcomplete()する。
	 *
	 * 期待結果:
	 * - Table更新を要求せず異常終了通知を1回発行し、Table Aの行並び替えを終了して通常編集へ戻る。
	 */
	it( 'when completed DnD table can no longer continue row reorder, should terminate and return reorder mode to edit', () => {
		reorderMode.select( 'row', 'table-a' );
		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( null ).mockReturnValueOnce( null );

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
	} );

	/**
	 * 概要:
	 * - complete()時点で外部Table構造が変化し、最終移動先を安全に確定できなくなった場合は異常終了通知を行うことを確認する。
	 *
	 * 事前条件:
	 * - Session開始時には移動先境界4が有効である。
	 * - complete()時点では境界4が分断不可になっている。
	 *
	 * 操作:
	 * - 移動先を更新してcomplete()する。
	 *
	 * 期待結果:
	 * - Table更新を要求せずSessionを終了し、異常終了通知を1回発行する。
	 */
	it( 'when complete revalidation no longer accepts the destination, should notify the termination once', () => {
		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - 移動元行の直前または直後へのdropでは、実際の行順が変わらないため更新も異常終了通知も発生させないことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立している。
	 * - 移動元行は1で、移動先境界2はその直後である。
	 *
	 * 操作:
	 * - 境界2を有効移動先としてcomplete()する。
	 *
	 * 期待結果:
	 * - 現在構造への再照合は行うが、Table更新および異常終了通知は要求しない。
	 */
	it( 'when destination keeps the source row in the same order, should not update the table', () => {
		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		rowDndInteraction.updateDestination( 2 );
		rowDndInteraction.complete();

		expect( getConstraintsMock ).toHaveBeenCalledTimes( 3 );
		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - cancel()ではTableを更新せずSessionを終了し、異常終了通知を行わず次のDnDを開始できることを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立している。
	 *
	 * 操作:
	 * - cancel()した後、新しいprepareStart()を実行する。
	 *
	 * 期待結果:
	 * - Table更新と異常終了通知は行われず、新しい開始判定の行制約が正常に返る。
	 */
	it( 'when active session is cancelled, should end without update and allow the next start', () => {
		prepareActiveSession();

		rowDndInteraction.cancel();
		getConstraintsMock.mockReturnValueOnce( availableConstraints );
		const nextConstraints = rowDndInteraction.prepareStart( {
			tableIdentity: 'table-b',
			sourceRowIndex: 2,
		} );

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( nextConstraints ).toBe( availableConstraints );
	} );

	/**
	 * 概要:
	 * - cancel後にSession対象Tableの現在行制約を取得できない場合は、Reorder Modeを通常編集へ戻すことを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効で、active Sessionが成立している。
	 * - DnD終了後にはTable Aの現在行制約を安全に取得できない。
	 *
	 * 操作:
	 * - cancel()する。
	 *
	 * 期待結果:
	 * - Session終了後にTable Aの現在行制約を取得し直し、行並び替えを終了して通常編集へ戻る。
	 */
	it( 'when cancelled DnD table can no longer continue row reorder, should return reorder mode to edit', () => {
		reorderMode.select( 'row', 'table-a' );
		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( null );

		rowDndInteraction.cancel();

		expect( getConstraintsMock ).toHaveBeenCalledTimes( 2 );
		expect( getConstraintsMock ).toHaveBeenNthCalledWith( 2, 'table-a' );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
	} );

	/**
	 * 概要:
	 * - 異常終了通知の購読を解除したPresentationには、その後の通知対象終了を伝えないことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立し、異常終了通知listenerが購読済みである。
	 *
	 * 操作:
	 * - 購読を解除した後、complete()時の現在構造で最終移動先を成立不能にする。
	 *
	 * 期待結果:
	 * - 通知対象の終了は成立するが、解除済みlistenerは呼び出されない。
	 */
	it( 'when termination notice subscription is removed, should stop delivering notices', () => {
		prepareActiveSession();
		unsubscribeTerminationNotice();
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.complete();

		expect( terminationNoticeListener ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - active Session中に別の開始試行を受理しないことを確認する。
	 *
	 * 事前条件:
	 * - すでにactive Sessionが成立している。
	 *
	 * 操作:
	 * - prepareStart()を再度実行する。
	 *
	 * 期待結果:
	 * - 1つのactive SessionというInvariant違反としてErrorを送出する。
	 */
	it( 'when another start is prepared during an active session, should reject the lifecycle violation', () => {
		prepareActiveSession();

		expect( () =>
			rowDndInteraction.prepareStart( {
				tableIdentity: 'table-b',
				sourceRowIndex: 0,
			} )
		).toThrow( 'Row DnD start preparation requires an idle session.' );
	} );

	/**
	 * 概要:
	 * - idle状態では移動先更新またはcompleteを受理しないことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが存在しない。
	 *
	 * 操作:
	 * - updateDestination()とcomplete()を実行する。
	 *
	 * 期待結果:
	 * - どちらもSession Lifecycle違反としてErrorを送出する。
	 */
	it( 'when session is idle, should reject destination updates and completion', () => {
		expect( () => rowDndInteraction.updateDestination( 1 ) ).toThrow(
			'Row DnD destination can only be updated during an active session.'
		);
		expect( () => rowDndInteraction.complete() ).toThrow(
			'Row DnD complete requires an active session.'
		);
	} );
} );
