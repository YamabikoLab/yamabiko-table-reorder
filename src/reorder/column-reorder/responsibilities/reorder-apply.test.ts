/**
 * 列の確認付き大規模反映Lifecycleが、利用者の選択と反映直前のTable状態に従って安全に進むことを確認する。
 */

import { subscribe } from '@wordpress/data';

import {
	applyLargeColumnReorder,
	cancelLargeColumnReorderApply,
	completeLargeColumnReorderApply,
	confirmLargeColumnReorderApply,
	getLargeColumnReorderApplyState,
	getLargeColumnReorderDestinationColumnIndex,
	requestLargeColumnReorderApply,
} from './reorder-apply';
import {
	columnReorderTestBlockEditorStore,
	createColumnReorderTestTable,
	getColumnReorderTestTable,
	setColumnReorderTestTables,
} from './table-integration.test-utils';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとTable Integrationは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './table-integration.test-utils' ).columnReorderTestBlockEditorStore,
} ) );

const move = {
	tableIdentity: 'table-a',
	sourceColumnIndex: 3,
	destinationBoundaryIndex: 1,
};

/** 識別可能な5列を持つ現在Tableを登録する。 */
const setDefaultTable = (): void => {
	setColumnReorderTestTables( [
		createColumnReorderTestTable( 'table-a', [
			{
				cells: [ 'A', 'B', 'C', 'D', 'E' ].map( ( content ) => ( { content } ) ),
			},
		] ),
	] );
};

/** 現在Tableの列識別値を表示順で取得する。 */
const getCurrentColumnLabels = (): unknown[] => {
	const table = getColumnReorderTestTable( 'table-a' );
	const body = table?.attributes.body as Array< { cells: Array< { content?: unknown } > } >;
	return body[ 0 ]?.cells.map( ( cell ) => cell.content ) ?? [];
};

/** 公開Lifecycle操作だけを使って各テスト開始時に通常状態へ戻す。 */
const restoreIdleState = (): void => {
	const state = getLargeColumnReorderApplyState();
	if ( state.phase === 'confirming' ) {
		cancelLargeColumnReorderApply();
		return;
	}
	if ( state.phase === 'applying' ) {
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
		setDefaultTable();
	} );

	afterEach( () => {
		restoreIdleState();
		setColumnReorderTestTables( [] );
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
	 * - 現在Tableの列順が1回の属性更新でA、D、B、C、Eになる。
	 * - 再mount中は反映済みとして扱われ、完了後は通常状態へ戻る。
	 */
	it( 'when a confirmed column move is still valid, should apply it once and complete the lifecycle', () => {
		const storeChangeListener = jest.fn();
		const unsubscribe = subscribe( storeChangeListener, columnReorderTestBlockEditorStore );
		expect( requestLargeColumnReorderApply( move ) ).toBe( true );
		confirmLargeColumnReorderApply();
		applyLargeColumnReorder();
		unsubscribe();

		expect( storeChangeListener ).toHaveBeenCalledTimes( 1 );
		expect( getCurrentColumnLabels() ).toEqual( [ 'A', 'D', 'B', 'C', 'E' ] );
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
	 * 列Apply LifecycleがPresentationへ反映後最終位置を提供するとき、Table Integrationの方向固有解釈を正本として利用することを確認する。
	 *
	 * 事前条件:
	 * - 大規模列反映が確認待ちである。
	 * - 保持中Moveでは4列目を2列目の位置へ移動する。
	 *
	 * 操作:
	 * - 反映後最終論理列位置を取得する。
	 *
	 * 期待結果:
	 * - Table Integrationの方向固有解釈による0-based最終論理列位置1が返る。
	 */
	it( 'when a column apply holds a move, should provide its final column position from Table Integration', () => {
		requestLargeColumnReorderApply( move );

		expect( getLargeColumnReorderDestinationColumnIndex() ).toBe( 1 );
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
		const initialColumns = getCurrentColumnLabels();
		requestLargeColumnReorderApply( move );
		cancelLargeColumnReorderApply();

		expect( getCurrentColumnLabels() ).toEqual( initialColumns );
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
	 * - 続行前に対象TableがBlock Editor Storeから消失する。
	 *
	 * 操作:
	 * - 利用者が続行し、反映を開始する。
	 *
	 * 期待結果:
	 * - 列移動は反映されない。
	 * - 対象Tableを戻すため再mount状態へ進む。
	 */
	it( 'when the current table can no longer validate a confirmed column move, should remount without applying it', () => {
		requestLargeColumnReorderApply( move );
		confirmLargeColumnReorderApply();
		setColumnReorderTestTables( [] );
		applyLargeColumnReorder();

		expect( getColumnReorderTestTable( 'table-a' ) ).toBeNull();
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
