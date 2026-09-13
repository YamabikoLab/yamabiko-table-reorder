/**
 * Reorder Form（RF）の完了通知がRF Interactionの成功遷移だけを一度通知することを確認する。
 */

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ReorderFormCompletion } from './reorder-form-completion';

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode } ) => <div role="status">{ props.children }</div>,
} ) );

jest.mock( '@/messages', () => ( {
	getLargeReorderCompletionMessage: () => 'Reordering complete.',
} ) );

describe( 'Reorder Form completion presentation', () => {
	beforeEach( () => {
		jest.useFakeTimers();
	} );

	afterEach( () => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	} );

	/**
	 * 概要:
	 * - RF反映成功時に完了通知を一度だけ表示することを確認する。
	 *
	 * 事前条件:
	 * - RF Interactionが反映中である。
	 *
	 * 操作:
	 * - 状態をclosedへ遷移させ、その後closedのまま再描画する。
	 *
	 * 期待結果:
	 * - applyingからclosedへ遷移した直後だけ完了通知が表示される。
	 * - closedの再描画では新しい通知を開始しない。
	 */
	it( 'when RF apply succeeds, should notify once for the applying-to-closed transition', () => {
		const view = render( <ReorderFormCompletion status="applying" /> );

		view.rerender( <ReorderFormCompletion status="closed" /> );
		expect( screen.getAllByRole( 'status' ) ).toHaveLength( 1 );
		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();

		view.rerender( <ReorderFormCompletion status="closed" /> );
		expect( screen.getAllByRole( 'status' ) ).toHaveLength( 1 );

		act( () => {
			jest.runAllTimers();
		} );
		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - RF反映失敗または大規模確認取消では成功通知を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - RF Interactionが反映中である。
	 *
	 * 操作:
	 * - 入力を保持するopen状態へ戻す。
	 *
	 * 期待結果:
	 * - 完了通知は表示されない。
	 */
	it( 'when RF apply returns to the input session, should not show a completion notice', () => {
		const view = render( <ReorderFormCompletion status="applying" /> );

		view.rerender( <ReorderFormCompletion status="open" /> );

		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );
} );
