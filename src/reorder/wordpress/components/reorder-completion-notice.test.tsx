/**
 * 並び替え結果の共通Presentationが、固有StoreやApply Lifecycleに依存せず成功・失敗と表示終了を扱うことを確認する。
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ReorderCompletionNotice } from './reorder-completion-notice';

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: {
		children: ReactNode;
		onRemove?: () => void;
		spokenMessage?: string;
	} ) => (
		<div data-snackbar="true" data-spoken-message={ props.spokenMessage }>
			{ props.children }
			<button type="button" onClick={ props.onRemove }>
				Dismiss
			</button>
		</div>
	),
} ) );

describe( 'Reorder completion notice presentation', () => {
	beforeEach( () => {
		jest.useFakeTimers();
	} );

	afterEach( () => {
		act( () => {
			jest.runOnlyPendingTimers();
		} );
		jest.useRealTimers();
	} );

	/**
	 * 成功結果を共通デザインの通知として表示できることを確認する。
	 *
	 * 事前条件:
	 * - 成功結果と利用者向け文言が確定している。
	 *
	 * 操作:
	 * - 共通結果通知を表示する。
	 *
	 * 期待結果:
	 * - 成功文言を含むstatus通知が表示される。
	 * - 成功を示すアイコンが色だけに依存せず描画される。
	 */
	it( 'when a success result is provided, should show the success notice presentation', () => {
		render(
			<ReorderCompletionNotice
				status="success"
				message="Reordering complete."
				onRemove={ jest.fn() }
			/>
		);

		const message = screen.getByText( 'Reordering complete.' );
		expect( message ).not.toBeNull();
		expect(
			message.closest( '[data-snackbar]' )?.getAttribute( 'data-spoken-message' )
		).toBeNull();
		expect( screen.getByText( 'Reordering complete.' ).previousElementSibling ).not.toBeNull();
	} );

	/**
	 * 失敗結果を成功と同じPresentation境界から表示できることを確認する。
	 *
	 * 事前条件:
	 * - 失敗結果と利用者向け文言が確定している。
	 *
	 * 操作:
	 * - 共通結果通知を表示する。
	 *
	 * 期待結果:
	 * - 失敗文言を含むstatus通知が表示される。
	 * - 失敗を示す警告アイコンが描画される。
	 */
	it( 'when a failure result is provided, should show the failure notice presentation', () => {
		render(
			<ReorderCompletionNotice
				status="failure"
				message="Reordering failed. The table has not been changed."
				onRemove={ jest.fn() }
			/>
		);

		expect(
			screen.getByText( 'Reordering failed. The table has not been changed.' )
		).not.toBeNull();
		expect(
			screen.getByText( 'Reordering failed. The table has not been changed.' )
				.previousElementSibling
		).not.toBeNull();
	} );

	/**
	 * 別のAnnouncement経路を持つ呼び出し元だけSnackbar既定読み上げを抑制できることを確認する。
	 *
	 * 事前条件:
	 * - RF側が独立したAnnouncement Deliveryを所有している。
	 *
	 * 操作:
	 * - 共通結果通知へ既定読み上げの抑制を指定する。
	 *
	 * 期待結果:
	 * - 視覚通知は通常どおり表示される。
	 * - Snackbarへ空のspoken messageを渡し、同じ結果の二重読み上げを発生させない。
	 */
	it( 'when a caller owns a separate announcement path, should suppress only the Snackbar spoken message', () => {
		render(
			<ReorderCompletionNotice
				status="success"
				message="Reordering complete."
				onRemove={ jest.fn() }
				suppressSpokenMessage
			/>
		);

		const message = screen.getByText( 'Reordering complete.' );
		expect( message ).not.toBeNull();
		expect(
			message.closest( '[data-snackbar]' )?.getAttribute( 'data-spoken-message' )
		).toBe( '' );
	} );

	/**
	 * 結果通知を認識できる時間だけ表示した後に通知所有者へ終了を伝えることを確認する。
	 *
	 * 事前条件:
	 * - 成功結果通知が表示されている。
	 *
	 * 操作:
	 * - 表示開始から2秒経過させる。
	 *
	 * 期待結果:
	 * - 2秒経過前は終了を通知しない。
	 * - 2秒経過時に終了処理を1回呼ぶ。
	 */
	it( 'when a result notice has been visible for two seconds, should request its removal', () => {
		const onRemove = jest.fn();
		render(
			<ReorderCompletionNotice
				status="success"
				message="Reordering complete."
				onRemove={ onRemove }
			/>
		);

		act( () => {
			jest.advanceTimersByTime( 1999 );
		} );
		expect( onRemove ).not.toHaveBeenCalled();

		act( () => {
			jest.advanceTimersByTime( 1 );
		} );
		expect( onRemove ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 利用者が通知をdismissした場合に通知所有者へ終了を伝えることを確認する。
	 *
	 * 事前条件:
	 * - 結果通知が表示されている。
	 *
	 * 操作:
	 * - 通知のdismiss操作を行う。
	 *
	 * 期待結果:
	 * - 終了処理を1回呼ぶ。
	 */
	it( 'when the user dismisses the result notice, should request its removal', () => {
		const onRemove = jest.fn();
		render(
			<ReorderCompletionNotice
				status="success"
				message="Reordering complete."
				onRemove={ onRemove }
			/>
		);

		fireEvent.click( screen.getByRole( 'button', { name: 'Dismiss' } ) );

		expect( onRemove ).toHaveBeenCalledTimes( 1 );
	} );
} );
