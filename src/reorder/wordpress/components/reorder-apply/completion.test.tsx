/**
 * 確認付き大規模反映の完了通知が、正常完了だけを利用者へ一時表示することを確認する。
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
		const { rerender } = render( <ReorderApplyCompletion isSuccessfulRemounting={ true } /> );

		rerender( <ReorderApplyCompletion isSuccessfulRemounting={ false } /> );

		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();
		expect( screen.getByText( '✓' ) ).not.toBeNull();
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
		const { rerender } = render( <ReorderApplyCompletion isSuccessfulRemounting={ true } /> );
		rerender( <ReorderApplyCompletion isSuccessfulRemounting={ false } /> );

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
	 * 正常な再mountを経ていない場合は、完了通知を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 正常な大規模反映後の再mountは開始されていない。
	 *
	 * 操作:
	 * - 通常表示を継続する。
	 *
	 * 期待結果:
	 * - 完了通知は表示されない。
	 */
	it( 'when no successful remount completed, should not show a completion notice', () => {
		render( <ReorderApplyCompletion isSuccessfulRemounting={ false } /> );

		expect( screen.queryByText( 'Reordering complete.' ) ).toBeNull();
	} );
} );
