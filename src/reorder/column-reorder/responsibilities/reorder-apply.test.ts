/**
 * 列の確認付き大規模反映Lifecycleが、利用者の選択と反映直前のTable状態に従って安全に進むことを確認する。
 */

import {
	applyLargeColumnReorder,
	cancelLargeColumnReorderApply,
	completeLargeColumnReorderApply,
	confirmLargeColumnReorderApply,
	getLargeColumnReorderApplyState,
	requestLargeColumnReorderApply,
} from './reorder-apply';
import { columnTableIntegration } from './table-integration';

jest.mock( './table-integration', () => ( {
	columnTableIntegration: {
		getConstraints: jest.fn(),
		applyColumnMove: jest.fn(),
	},
} ) );

const getConstraintsMock = columnTableIntegration.getConstraints as jest.Mock;
const applyColumnMoveMock = columnTableIntegration.applyColumnMove as jest.Mock;

const move = {
	tableIdentity: 'table-a',
	sourceColumnIndex: 3,
	destinationBoundaryIndex: 1,
};

/** 公開Lifecycle操作だけを使って各テスト開始時に通常状態へ戻す。 */
const restoreIdleState = (): void => {
	const state = getLargeColumnReorderApplyState();
	if ( state.phase === 'confirming' ) {
		cancelLargeColumnReorderApply();
		return;
	}
	if ( state.phase === 'applying' ) {
		getConstraintsMock.mockReturnValue( null );
		applyLargeColumnReorder();
		completeLargeColumnReorderApply();
		return;
	}
	if ( state.phase === 'remounting' ) {
		completeLargeColumnReorderApply();
	}
};

describe( 'Large Column Reorder apply lifecycle', () => {
	beforeEach( () => {
		restoreIdleState();
		jest.clearAllMocks();
		getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [] } );
		applyColumnMoveMock.mockReturnValue( true );
	} );

	afterEach( () => {
		restoreIdleState();
	} );

	/**
	 * 確認付き大規模列反映の正常経路で、確認後に現在Tableを再照合してから反映することを確認する。
	 *
	 * 事前条件:
	 * - 確認対象の列移動は現在のTableでも有効である。
	 *
	 * 操作:
	 * - 大規模反映を要求し、利用者が続行した後に反映し、再mount完了を通知する。
	 *
	 * 期待結果:
	 * - 列移動は1回だけ反映される。
	 * - 再mount中は反映済みとして扱われ、完了後は通常状態へ戻る。
	 */
	it( 'when a confirmed column move is still valid, should apply it once and complete the lifecycle', () => {
		expect( requestLargeColumnReorderApply( move ) ).toBe( true );
		confirmLargeColumnReorderApply();
		applyLargeColumnReorder();

		expect( getConstraintsMock ).toHaveBeenCalledWith( 'table-a' );
		expect( applyColumnMoveMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceColumnIndex: 3,
			destinationBoundaryIndex: 1,
		} );
		expect( getLargeColumnReorderApplyState() ).toMatchObject( {
			phase: 'remounting',
			move,
			applied: true,
		} );

		completeLargeColumnReorderApply();
		expect( getLargeColumnReorderApplyState() ).toMatchObject( {
			phase: 'idle',
			move: null,
			applied: false,
		} );
	} );

	/**
	 * 利用者が確認を取り消した場合はTableを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - 大規模列反映が確認待ちである。
	 *
	 * 操作:
	 * - 利用者がキャンセルする。
	 *
	 * 期待結果:
	 * - 列移動は反映されない。
	 * - 確認対象は破棄され通常状態へ戻る。
	 */
	it( 'when the user cancels a pending column move, should return to idle without changing the table', () => {
		requestLargeColumnReorderApply( move );
		cancelLargeColumnReorderApply();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( getLargeColumnReorderApplyState() ).toMatchObject( {
			phase: 'idle',
			move: null,
			applied: false,
		} );
	} );

	/**
	 * 確認待ちの間にTable構造が変わった場合は、古い移動意図を現在Tableへ適用しないことを確認する。
	 *
	 * 事前条件:
	 * - 大規模列反映が確認待ちである。
	 * - 続行時には対象Tableの現在構造を取得できない。
	 *
	 * 操作:
	 * - 利用者が続行し、反映を開始する。
	 *
	 * 期待結果:
	 * - 列移動は反映されない。
	 * - 対象Tableを戻すため再mount状態へ進む。
	 */
	it( 'when the current table can no longer validate a confirmed column move, should remount without applying it', () => {
		getConstraintsMock.mockReturnValue( null );
		requestLargeColumnReorderApply( move );
		confirmLargeColumnReorderApply();
		applyLargeColumnReorder();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( getLargeColumnReorderApplyState() ).toMatchObject( {
			phase: 'remounting',
			move,
			applied: false,
		} );
	} );

	/**
	 * 一つの確認付き大規模反映が進行中の間は別の列移動を重ねて受理しないことを確認する。
	 *
	 * 事前条件:
	 * - 一つ目の列移動が確認待ちである。
	 *
	 * 操作:
	 * - 別の列移動について確認付き反映を要求する。
	 *
	 * 期待結果:
	 * - 二つ目の要求は受理されない。
	 * - 最初の確認対象が維持される。
	 */
	it( 'when another column apply is already pending, should reject a second request', () => {
		requestLargeColumnReorderApply( move );
		const anotherMove = { ...move, sourceColumnIndex: 2 };

		expect( requestLargeColumnReorderApply( anotherMove ) ).toBe( false );
		expect( getLargeColumnReorderApplyState() ).toMatchObject( {
			phase: 'confirming',
			move,
			applied: false,
		} );
	} );
} );
