/**
 * 共通完了通知が、Row / Column / RFの正常完了だけを利用者へ一時表示することを確認する。
 */

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ReorderApplyCompletion } from './completion';

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode } ) => <div role="status">{ props.children }</div>,
} ) );

jest.mock( '@/messages', () => ( {
	getLargeReorderCompletionMessage: () => 'Reordering complete.',
} ) );

describe( 'WordPress Reorder Apply completion notice', () => {
	/**
	 * 正常な大規模反映が完了した直後に、フォーカスを奪わない完了通知を表示することを確認する。
	 *
	 * 事前条件:
	 * - 反映成功後の再mount中である。
	 *
	 * 操作:
	 * - 再mount完了状態へ移行する。
	 *
	 * 期待結果:
	 * - 完了メッセージと成功を示す記号を含む一時通知が表示される。
	 */
	it( 'when a successful remount finishes, should show a completion notice with a success mark', () => {
		const { rerender } = render(
			<ReorderApplyCompletion isSuccessfulRemounting={ true } rfStatus="closed" />
		);

		rerender( <ReorderApplyCompletion isSuccessfulRemounting={ false } rfStatus="closed" /> );

		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();
		expect( screen.getByText( '✓' ) ).not.toBeNull();
	} );

	/**
	 * RFの正常反映完了もRow / Columnと同じPresentationから一度だけ通知することを確認する。
	 *
	 * 事前条件:
	 * - RF Interactionが反映中である。
	 *
	 * 操作:
	 * - RF Interactionをclosedへ遷移させ、その後closedのまま再描画する。
	 *
	 * 期待結果:
	 * - applyingからclosedへ遷移した直後だけ共通完了通知が表示される。
	 * - closedの再描画では新しい通知を開始しない。
	 */
	it( 'when RF apply succeeds, should notify once through the common completion presentation', () => {
		const view = render(
			<ReorderApplyCompletion isSuccessfulRemounting={ false } rfStatus="applying" />
		);

		view.rerender( <ReorderApplyCompletion isSuccessfulRemounting={ false } rfStatus="closed" /> );
		expect( screen.getAllByRole( 'status' ) ).toHaveLength( 1 );
		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();

		view.rerender( <ReorderApplyCompletion isSuccessfulRemounting={ false } rfStatus="closed" /> );
		expect( screen.getAllByRole( 'status' ) ).toHaveLength( 1 );
	} );

	/**
	 * RF反映失敗または大規模確認取消では成功通知を表示しないことを確認する。
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
		const view = render(
			<ReorderApplyCompletion isSuccessfulRemounting={ false } rfStatus="applying" />
		);

		view.rerender( <ReorderApplyCompletion isSuccessfulRemounting={ false } rfStatus="open" /> );

		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );

	/**
	 * 完了通知が表示された場合に、利用者が完了を確認できる時間を確保した後で自動的に終了することを確認する。
	 *
	 * 事前条件:
	 * - 正常な大規模反映後の再mountが完了している。
	 *
	 * 操作:
	 * - 完了通知の表示開始から2秒経過させる。
	 *
	 * 期待結果:
	 * - 2秒経過前は完了通知が表示されている。
	 * - 2秒経過後は完了通知が終了する。
	 */
	it( 'when a completion notice has been visible for two seconds, should remove the notice', () => {
		jest.useFakeTimers();
		const { rerender } = render(
			<ReorderApplyCompletion isSuccessfulRemounting={ true } rfStatus="closed" />
		);
		rerender( <ReorderApplyCompletion isSuccessfulRemounting={ false } rfStatus="closed" /> );

		act( () => {
			jest.advanceTimersByTime( 1999 );
		} );
		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();

		act( () => {
			jest.advanceTimersByTime( 1 );
		} );
		expect( screen.queryByText( 'Reordering complete.' ) ).toBeNull();
		jest.useRealTimers();
	} );

	/**
	 * 正常な完了イベントを経ていない場合は、完了通知を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 正常な大規模反映後の再mountもRF正常終了も発生していない。
	 *
	 * 操作:
	 * - 通常表示を継続する。
	 *
	 * 期待結果:
	 * - 完了通知は表示されない。
	 */
	it( 'when no successful reorder completed, should not show a completion notice', () => {
		render( <ReorderApplyCompletion isSuccessfulRemounting={ false } rfStatus="closed" /> );

		expect( screen.queryByText( 'Reordering complete.' ) ).toBeNull();
	} );
} );
