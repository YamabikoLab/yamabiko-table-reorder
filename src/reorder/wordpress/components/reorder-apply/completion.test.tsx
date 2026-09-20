/**
 * Row / Columnの確認付き大規模反映結果通知が、表示復帰完了時の成功・失敗を共通Presentationへ接続することを確認する。
 */

import { render, screen } from '@testing-library/react';

import { ReorderApplyCompletion } from './completion';

/* @wordpress/componentsのuuid / theme ESM境界だけをJestで読める決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'reorder-apply-completion-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

describe( 'WordPress Reorder Apply completion entry', () => {
	/**
	 * Row / Columnの大規模反映成功を表示復帰完了後に通知できることを確認する。
	 *
	 * 事前条件:
	 * - 反映成功後の表示復帰中である。
	 *
	 * 操作:
	 * - 表示復帰完了状態へ移行する。
	 *
	 * 期待結果:
	 * - 成功結果の共通通知が表示される。
	 */
	it( 'when a successful large reorder restoration finishes, should show a success result notice', () => {
		const { rerender } = render( <ReorderApplyCompletion restorationStatus="success" /> );

		rerender( <ReorderApplyCompletion restorationStatus={ null } /> );

		expect(
			screen.getByText( 'Reordering complete.', {
				selector: '.yamabiko-table-reorder-completion__message',
			} )
		).not.toBeNull();
	} );

	/**
	 * Row / Columnの大規模反映が成立しなかった場合も表示復帰完了後に失敗を通知できることを確認する。
	 *
	 * 事前条件:
	 * - Table再照合後に反映できず、失敗結果で表示復帰中である。
	 *
	 * 操作:
	 * - 表示復帰完了状態へ移行する。
	 *
	 * 期待結果:
	 * - Tableが変更されていないことを示す失敗通知が表示される。
	 */
	it( 'when a failed large reorder restoration finishes, should show a failure result notice', () => {
		const { rerender } = render( <ReorderApplyCompletion restorationStatus="failure" /> );

		rerender( <ReorderApplyCompletion restorationStatus={ null } /> );

		expect(
			screen.getByText( 'The reorder could not be completed. The table was not changed.', {
				selector: '.yamabiko-table-reorder-completion__message',
			} )
		).not.toBeNull();
	} );

	/**
	 * Row / Columnの表示復帰結果が発生していない場合は結果通知を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 大規模反映の表示復帰中ではない。
	 *
	 * 操作:
	 * - 通常表示を継続する。
	 *
	 * 期待結果:
	 * - 結果通知は表示されない。
	 */
	it( 'when no large reorder restoration completed, should not show a result notice', () => {
		render( <ReorderApplyCompletion restorationStatus={ null } /> );

		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );
} );
