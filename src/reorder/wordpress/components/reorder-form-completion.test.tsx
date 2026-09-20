/**
 * Reorder Form（RF）の結果通知入口がRF Interactionの未提示Apply Outcome全体を一度だけ確保して表示することを確認する。
 */

import { act, render, screen } from '@testing-library/react';

import { rfInteractionStore } from '@/reorder/reorder-form/responsibilities/interaction';

import { ReorderFormCompletion } from './reorder-form-completion';

/* @wordpress/componentsのuuid / theme ESM境界だけをJestで読める決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'reorder-form-completion-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

/* Jestで読み込めないBlock Editor Storeの環境境界だけを代替し、WordPress Dataは実Storeへ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/reorder-form/responsibilities/block-editor-store.test-utils'
	).testBlockEditorStore,
} ) );

const successOutcome = {
	status: 'success' as const,
	tableIdentity: 'table-a',
	moveSummary: {
		kind: 'row' as const,
		sourcePosition: 2,
		destinationPosition: 5,
	},
};

/**
 * RF Interaction Storeへ結果通知前の状態を設定する。
 *
 * @param applyOutcome 対象Tableの未提示反映結果。
 */
const setApplyOutcome = (
	applyOutcome:
		| typeof successOutcome
		| {
				status: 'failure';
				tableIdentity: string;
		  }
): void => {
	rfInteractionStore.setState( {
		session: { status: 'closed' },
		applyOutcome,
	} );
};

describe( 'Reorder Form completion entry', () => {
	beforeEach( () => {
		jest.useFakeTimers();
		rfInteractionStore.setState( rfInteractionStore.getInitialState(), true );
	} );

	afterEach( () => {
		act( () => {
			jest.runOnlyPendingTimers();
			rfInteractionStore.setState( rfInteractionStore.getInitialState(), true );
		} );
		jest.useRealTimers();
	} );

	/**
	 * RF成功Outcome全体を確保してからRF Interaction側を一度だけ提示済みにすることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableに行移動成功の未提示Outcomeがある。
	 *
	 * 操作:
	 * - RF結果通知入口を表示し、同じTableで再mountする。
	 *
	 * 期待結果:
	 * - 成功通知と確定した行移動のAnnouncementが表示される。
	 * - Outcomeは提示済みになり、再mount後には同じ通知を表示しない。
	 */
	it( 'when a successful RF outcome exists before mount, should present it once and mark it presented', () => {
		setApplyOutcome( successOutcome );

		const view = render( <ReorderFormCompletion tableIdentity="table-a" /> );
		act( () => {
			jest.advanceTimersByTime( 0 );
		} );

		expect(
			screen.getByText( 'Reordering complete.', {
				selector: '.yamabiko-table-reorder-completion__message',
			} )
		).not.toBeNull();
		expect( screen.getByRole( 'status' ).textContent ).toBe( 'Moved row 2 to position 5.' );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );

		view.unmount();
		render( <ReorderFormCompletion tableIdentity="table-a" /> );
		expect(
			screen.queryByText( 'Reordering complete.', {
				selector: '.yamabiko-table-reorder-completion__message',
			} )
		).toBeNull();
	} );

	/**
	 * 対象Tableに未提示RF結果がなければ通知も提示済み化も行わないことを確認する。
	 *
	 * 事前条件:
	 * - 別Tableにだけ未提示の成功Outcomeがある。
	 *
	 * 操作:
	 * - 対象TableのRF結果通知入口を表示する。
	 *
	 * 期待結果:
	 * - 対象Tableには結果通知を表示しない。
	 * - 別TableのOutcomeは未提示のまま保持する。
	 */
	it( 'when the target table has no RF outcome, should not show or consume a notice', () => {
		setApplyOutcome( { ...successOutcome, tableIdentity: 'table-b' } );

		render( <ReorderFormCompletion tableIdentity="table-a" /> );

		expect( screen.queryByRole( 'status' ) ).toBeNull();
		expect( rfInteractionStore.getState().applyOutcome ).toMatchObject( {
			status: 'success',
			tableIdentity: 'table-b',
		} );
	} );

	/**
	 * failure OutcomeはMove summaryを要求せず同じ入口から失敗通知へ利用できることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableに失敗の未提示Outcomeがある。
	 *
	 * 操作:
	 * - RF結果通知入口を表示する。
	 *
	 * 期待結果:
	 * - 失敗の視覚通知とAnnouncementが表示される。
	 * - Outcomeは提示済みになる。
	 */
	it( 'when RF apply fails, should show a failure notice and mark the outcome presented', () => {
		setApplyOutcome( { status: 'failure', tableIdentity: 'table-a' } );

		render( <ReorderFormCompletion tableIdentity="table-a" /> );
		act( () => {
			jest.advanceTimersByTime( 0 );
		} );

		const failureMessage = 'The reorder could not be completed. The table was not changed.';
		expect(
			screen.getByText( failureMessage, {
				selector: '.yamabiko-table-reorder-completion__message',
			} )
		).not.toBeNull();
		expect( screen.getByRole( 'status' ).textContent ).toBe( failureMessage );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );

	/**
	 * 保持中の提示済みOutcomeによる再render自体を新しいOutcome取得として扱わないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの成功Outcomeを通知入口が確保済みである。
	 *
	 * 操作:
	 * - 同じ通知入口を再描画する。
	 *
	 * 期待結果:
	 * - 確保済みの視覚通知は維持される。
	 * - RF Interaction側に新しい未提示Outcomeは作られない。
	 */
	it( 'when a presented outcome remains during rerender, should not mark it presented again', () => {
		setApplyOutcome( successOutcome );
		const view = render( <ReorderFormCompletion tableIdentity="table-a" /> );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );

		view.rerender( <ReorderFormCompletion tableIdentity="table-a" /> );

		expect(
			screen.getByText( 'Reordering complete.', {
				selector: '.yamabiko-table-reorder-completion__message',
			} )
		).not.toBeNull();
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );
} );
