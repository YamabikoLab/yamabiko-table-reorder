/**
 * 行専用DnD Interactionの開始、移動先更新、確定、cancelのLifecycleを確認する。
 *
 * Store内部を直接参照せず、公開されたDnD Interaction境界とTable Integrationへの更新要求を通して、
 * Session開始時制約の保持、complete時の現在構造への再照合、正常終了、およびLifecycle違反を検証する。
 */

import { rowDndInteraction } from './dnd-interaction';
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

const prepareActiveSession = () => {
	getConstraintsMock.mockReturnValueOnce( availableConstraints );
	const candidate = rowDndInteraction.prepareStart( {
		tableIdentity: 'table-a',
		sourceRowIndex: 1,
	} );

	if ( candidate === null ) {
		throw new Error( 'Test precondition failed: expected start candidate.' );
	}

	rowDndInteraction.start( candidate );
	return candidate;
};

describe( 'Row DnD Interaction lifecycle', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		try {
			rowDndInteraction.cancel();
		} catch {
			// 前テストがidleで終了している場合も、その状態をそのままテスト開始状態として利用する。
		}
	} );

	/**
	 * 概要:
	 * - 開始可能な行では、開始可否判定時の行制約を含む開始候補が返ることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは取得可能で、移動元行の前後に分断不可境界がない。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - 対象Tableと移動元行、および取得した行制約を含む開始候補が返る。
	 */
	it( 'when source row is movable, should return a start candidate with the checked constraints', () => {
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		const candidate = rowDndInteraction.prepareStart( {
			tableIdentity: 'table-a',
			sourceRowIndex: 1,
		} );

		expect( candidate ).toEqual( {
			source: {
				tableIdentity: 'table-a',
				sourceRowIndex: 1,
			},
			initialConstraints: availableConstraints,
		} );
	} );

	/**
	 * 概要:
	 * - 行単位で構造を保持できない移動元行では、DnD開始候補を成立させないことを確認する。
	 *
	 * 事前条件:
	 * - 移動元行の直後がrowspan等による分断不可境界である。
	 *
	 * 操作:
	 * - prepareStart()を実行する。
	 *
	 * 期待結果:
	 * - nullを返し、Sessionを開始しない。
	 */
	it( 'when source row crosses a blocked boundary, should reject the start candidate', () => {
		getConstraintsMock.mockReturnValueOnce( blockedSourceConstraints );

		const candidate = rowDndInteraction.prepareStart( {
			tableIdentity: 'table-a',
			sourceRowIndex: 1,
		} );

		expect( candidate ).toBeNull();
	} );

	/**
	 * 概要:
	 * - start()がprepareStart()で確認した行制約をそのままSessionへ引き継ぎ、Table構造を取得し直さないことを確認する。
	 *
	 * 事前条件:
	 * - prepareStart()で開始候補が成立している。
	 *
	 * 操作:
	 * - start()でSessionを開始し、その後の有効移動先を更新してcomplete()する。
	 *
	 * 期待結果:
	 * - complete()までの間、prepareStart()後にTable構造を追加取得せず、最終確定時だけ現在構造を1回取得する。
	 */
	it( 'when a prepared candidate starts, should keep its initial constraints until complete revalidation', () => {
		const candidate = prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.complete();

		expect( candidate.initialConstraints ).toBe( availableConstraints );
		expect( getConstraintsMock ).toHaveBeenCalledTimes( 2 );
		expect( getConstraintsMock ).toHaveBeenNthCalledWith( 1, 'table-a' );
		expect( getConstraintsMock ).toHaveBeenNthCalledWith( 2, 'table-a' );
	} );

	/**
	 * 概要:
	 * - Session開始時の行制約に対して無効な移動先は、確定可能な移動先として保持しないことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立している。
	 * - 移動先境界2はSession開始時の制約で分断不可である。
	 *
	 * 操作:
	 * - 無効な境界へupdateDestination()し、complete()する。
	 *
	 * 期待結果:
	 * - Table更新を要求せず、complete()時の現在構造取得も行わず正常終了する。
	 */
	it( 'when destination is blocked by initial constraints, should complete without updating the table', () => {
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 2 ],
		} );
		const candidate = rowDndInteraction.prepareStart( {
			tableIdentity: 'table-a',
			sourceRowIndex: 3,
		} );

		if ( candidate === null ) {
			throw new Error( 'Test precondition failed: expected start candidate.' );
		}

		rowDndInteraction.start( candidate );
		rowDndInteraction.updateDestination( 2 );
		rowDndInteraction.complete();

		expect( getConstraintsMock ).toHaveBeenCalledTimes( 1 );
		expect( applyRowMoveMock ).not.toHaveBeenCalled();
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
	} );

	/**
	 * 概要:
	 * - complete()時点で外部Table構造が変化し、最終移動先が成立しなくなった場合は更新しないことを確認する。
	 *
	 * 事前条件:
	 * - Session開始時には移動先境界4が有効である。
	 * - complete()時点では境界4が分断不可になっている。
	 *
	 * 操作:
	 * - 移動先を更新してcomplete()する。
	 *
	 * 期待結果:
	 * - Table更新を要求せずSessionを終了する。
	 */
	it( 'when complete revalidation no longer accepts the destination, should not update the table', () => {
		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 移動元行の直前または直後へのdropでは、実際の行順が変わらないため更新を発生させないことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立している。
	 * - 移動元行は1で、移動先境界2はその直後である。
	 *
	 * 操作:
	 * - 境界2を有効移動先としてcomplete()する。
	 *
	 * 期待結果:
	 * - 現在構造への再照合は行うが、Table更新は要求しない。
	 */
	it( 'when destination keeps the source row in the same order, should not update the table', () => {
		prepareActiveSession();
		getConstraintsMock.mockReturnValueOnce( availableConstraints );

		rowDndInteraction.updateDestination( 2 );
		rowDndInteraction.complete();

		expect( getConstraintsMock ).toHaveBeenCalledTimes( 2 );
		expect( applyRowMoveMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - cancel()ではTableを更新せずSessionを終了し、その後に新しいDnDを開始できることを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが成立している。
	 *
	 * 操作:
	 * - cancel()した後、新しいprepareStart()を実行する。
	 *
	 * 期待結果:
	 * - Table更新は行われず、新しい開始候補が正常に返る。
	 */
	it( 'when active session is cancelled, should end without update and allow the next start', () => {
		prepareActiveSession();

		rowDndInteraction.cancel();
		getConstraintsMock.mockReturnValueOnce( availableConstraints );
		const nextCandidate = rowDndInteraction.prepareStart( {
			tableIdentity: 'table-b',
			sourceRowIndex: 2,
		} );

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( nextCandidate ).not.toBeNull();
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
