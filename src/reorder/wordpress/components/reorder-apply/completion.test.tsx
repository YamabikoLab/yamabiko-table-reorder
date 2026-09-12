/**
 * 確認付き大規模反映の完了通知が、正常完了だけを利用者へ一時表示することを確認する。
 */

import { render, screen } from '@testing-library/react';
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
