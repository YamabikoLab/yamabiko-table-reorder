/**
 * Announcement Deliveryが呼び出し元で確定した通知文言だけを、focusを変えず一回分のlive region更新として公開することを確認する。
 */

import { act, render, screen } from '@testing-library/react';

import { AnnouncementDelivery } from './delivery';

/* @wordpress/componentsのuuid / theme ESM境界だけをJestで読める決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'announcement-delivery-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

describe( 'Announcement Delivery', () => {
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
	 * 確定済み文言を通知しても現在の操作focusを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - 利用者のfocusは既存の操作要素にある。
	 * - 呼び出し元から一回分の通知文言が渡される。
	 *
	 * 操作:
	 * - Announcement Deliveryを表示する。
	 *
	 * 期待結果:
	 * - polite live regionへ文言が公開される。
	 * - 既存のfocusは移動しない。
	 */
	it( 'when a result message is delivered, should announce it without moving focus', () => {
		const focused = document.createElement( 'button' );
		document.body.appendChild( focused );
		focused.focus();

		render(
			<AnnouncementDelivery message="This selection won't change the order." source={ {} } />
		);

		act( () => {
			jest.runOnlyPendingTimers();
		} );

		expect( screen.getByRole( 'status' ).textContent ).toBe(
			"This selection won't change the order."
		);
		expect( focused.ownerDocument.activeElement ).toBe( focused );

		focused.remove();
	} );

	/**
	 * 同じ文言でも呼び出し元から新しい結果が渡された場合だけ新しい通知として公開することを確認する。
	 *
	 * 事前条件:
	 * - 一回目の通知はすでに公開済みである。
	 *
	 * 操作:
	 * - 同じ通知契機のまま再描画する。
	 * - 続けて、別の通知契機として同じ文言を渡す。
	 *
	 * 期待結果:
	 * - 通常の再描画では新しいlive region更新を開始しない。
	 * - 新しい通知契機では同じ文言でも再度公開する。
	 */
	it( 'when the same message is rerendered, should deliver it again only for a new source occurrence', () => {
		const source = {};
		const view = render( <AnnouncementDelivery message="No change." source={ source } /> );

		act( () => {
			jest.runOnlyPendingTimers();
		} );
		expect( jest.getTimerCount() ).toBe( 0 );

		view.rerender( <AnnouncementDelivery message="No change." source={ source } /> );
		expect( jest.getTimerCount() ).toBe( 0 );

		view.rerender( <AnnouncementDelivery message="No change." source={ {} } /> );
		expect( screen.getByRole( 'status' ).textContent ).toBe( '' );
		expect( jest.getTimerCount() ).toBe( 1 );

		act( () => {
			jest.runOnlyPendingTimers();
		} );
		expect( screen.getByRole( 'status' ).textContent ).toBe( 'No change.' );
	} );
} );
