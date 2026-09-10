/**
 * 行の確認付き大規模反映Lifecycleが、利用者の選択と反映直前のTable状態に従って安全に進むことを確認する。
 */

import {
	applyLargeRowReorder,
	cancelLargeRowReorderApply,
	completeLargeRowReorderApply,
	confirmLargeRowReorderApply,
	getLargeRowReorderApplyState,
	requestLargeRowReorderApply,
} from './reorder-apply';
import { rowTableIntegration } from './table-integration';

jest.mock( './table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		applyRowMove: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.Mock;
const applyRowMoveMock = rowTableIntegration.applyRowMove as jest.Mock;

const move = {
	tableIdentity: 'table-a',
	sourceRowIndex: 3,
	destinationBoundaryIndex: 1,
};

/** 公開Lifecycle操作だけを使って各テスト開始時に通常状態へ戻す。 */
const restoreIdleState = (): void => {
	const state = getLargeRowReorderApplyState();
	if ( state.phase === 'confirming' ) {
		cancelLargeRowReorderApply();
		return;
	}
	if ( state.phase === 'applying' ) {
		getConstraintsMock.mockReturnValue( null );
		applyLargeRowReorder();
		completeLargeRowReorderApply();
		return;
	}
	if ( state.phase === 'remounting' ) {
		completeLargeRowReorderApply();
	}
};

describe( 'Large Row Reorder apply lifecycle', () => {
	beforeEach( () => {
		restoreIdleState();
		jest.clearAllMocks();
		getConstraintsMock.mockReturnValue( { rowCount: 5, blockedBoundaries: [] } );
		applyRowMoveMock.mockReturnValue( true );
	} );

	afterEach( () => {
		restoreIdleState();
	} );

	/**
	 * 確認付き大規模行反映の正常経路で、確認後に現在Tableを再照合してから反映することを確認する。
	 *
	 * 事前条件:
	 * - 確認対象の行移動は現在のTableでも有効である。
	 *
	 * 操作:
	 * - 大規模反映を要求し、利用者が続行した後に反映し、再mount完了を通知する。
	 *
	 * 期待結果:
	 * - 行移動は1回だけ反映される。
	 * - 再mount中は反映済みとして扱われ、完了後は通常状態へ戻る。
	 */
	it( 'when a confirmed row move is still valid, should apply it once and complete the lifecycle', () => {
		expect( requestLargeRowReorderApply( move ) ).toBe( true );
		confirmLargeRowReorderApply();
		applyLargeRowReorder();

		expect( getConstraintsMock ).toHaveBeenCalledWith( 'table-a' );
		expect( applyRowMoveMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceRowIndex: 3,
			destinationBoundaryIndex: 1,
		} );
		expect( getLargeRowReorderApplyState() ).toEqual( {
			phase: 'remounting',
			move,
			applied: true,
		} );

		completeLargeRowReorderApply();
		expect( getLargeRowReorderApplyState() ).toEqual( {
			phase: 'idle',
			move: null,
			applied: false,
		} );
	} );

	/**
	 * 利用者が確認を取り消した場合はTableを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - 大規模行反映が確認待ちである。
	 *
	 * 操作:
	 * - 利用者がキャンセルする。
	 *
	 * 期待結果:
	 * - 行移動は反映されない。
	 * - 確認対象は破棄され通常状態へ戻る。
	 */
	it( 'when the user cancels a pending row move, should return to idle without changing the table', () => {
		requestLargeRowReorderApply( move );
		cancelLargeRowReorderApply();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( getLargeRowReorderApplyState() ).toEqual( {
			phase: 'idle',
			move: null,
			applied: false,
		} );
	} );

	/**
	 * 確認待ちの間にTable構造が変わった場合は、古い移動意図を現在Tableへ適用しないことを確認する。
	 *
	 * 事前条件:
	 * - 大規模行反映が確認待ちである。
	 * - 続行時には対象Tableの現在構造を取得できない。
	 *
	 * 操作:
	 * - 利用者が続行し、反映を開始する。
	 *
	 * 期待結果:
	 * - 行移動は反映されない。
	 * - 対象Tableを戻すため再mount状態へ進む。
	 */
	it( 'when the current table can no longer validate a confirmed row move, should remount without applying it', () => {
		getConstraintsMock.mockReturnValue( null );
		requestLargeRowReorderApply( move );
		confirmLargeRowReorderApply();
		applyLargeRowReorder();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( getLargeRowReorderApplyState() ).toEqual( {
			phase: 'remounting',
			move,
			applied: false,
		} );
	} );

	/**
	 * 一つの確認付き大規模反映が進行中の間は別の行移動を重ねて受理しないことを確認する。
	 *
	 * 事前条件:
	 * - 一つ目の行移動が確認待ちである。
	 *
	 * 操作:
	 * - 別の行移動について確認付き反映を要求する。
	 *
	 * 期待結果:
	 * - 二つ目の要求は受理されない。
	 * - 最初の確認対象が維持される。
	 */
	it( 'when another row apply is already pending, should reject a second request', () => {
		requestLargeRowReorderApply( move );
		const anotherMove = { ...move, sourceRowIndex: 2 };

		expect( requestLargeRowReorderApply( anotherMove ) ).toBe( false );
		expect( getLargeRowReorderApplyState() ).toEqual( {
			phase: 'confirming',
			move,
			applied: false,
		} );
	} );
} );
