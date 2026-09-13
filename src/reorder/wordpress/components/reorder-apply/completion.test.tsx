/**
 * Row / Columnの確認付き大規模反映結果通知が、再mount完了時の成功・失敗を共通Presentationへ接続することを確認する。
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ReorderApplyCompletion } from './completion';

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode } ) => <div role="status">{ props.children }</div>,
} ) );

jest.mock( '@/messages', () => ( {
	getLargeReorderCompletionMessage: () => 'Reordering complete.',
	getRfApplyFailureMessage: () => 'Reordering failed. The table has not been changed.',
} ) );

describe( 'WordPress Reorder Apply completion entry', () => {
	/**
	 * Row / Columnの大規模反映成功を再mount完了後に通知できることを確認する。
	 *
	 * 事前条件:
	 * - 反映成功後の再mount中である。
	 *
	 * 操作:
	 * - 再mount完了状態へ移行する。
	 *
	 * 期待結果:
	 * - 成功結果の共通通知が表示される。
	 */
	it( 'when a successful large reorder remount finishes, should show a success result notice', () => {
		const { rerender } = render( <ReorderApplyCompletion remountingStatus="success" /> );

		rerender( <ReorderApplyCompletion remountingStatus={ null } /> );

		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();
	} );

	/**
	 * Row / Columnの大規模反映が成立しなかった場合も再mount完了後に失敗を通知できることを確認する。
	 *
	 * 事前条件:
	 * - Table再照合後に反映できず、失敗結果で再mount中である。
	 *
	 * 操作:
	 * - 再mount完了状態へ移行する。
	 *
	 * 期待結果:
	 * - Tableが変更されていないことを示す失敗通知が表示される。
	 */
	it( 'when a failed large reorder remount finishes, should show a failure result notice', () => {
		const { rerender } = render( <ReorderApplyCompletion remountingStatus="failure" /> );

		rerender( <ReorderApplyCompletion remountingStatus={ null } /> );

		expect(
			screen.getByText( 'Reordering failed. The table has not been changed.' )
		).not.toBeNull();
	} );

	/**
	 * Row / Columnの再mount結果が発生していない場合は結果通知を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 大規模反映の再mount中ではない。
	 *
	 * 操作:
	 * - 通常表示を継続する。
	 *
	 * 期待結果:
	 * - 結果通知は表示されない。
	 */
	it( 'when no large reorder remount completed, should not show a result notice', () => {
		render( <ReorderApplyCompletion remountingStatus={ null } /> );

		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );
} );
