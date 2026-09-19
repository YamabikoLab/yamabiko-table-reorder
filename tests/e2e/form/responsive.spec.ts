import type { Locator } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	APPLY,
	ABOVE,
	BELOW,
	COLLAPSE,
	EXPAND,
	fillRowReorder,
	insertTable,
	NO_OP,
	openReorderForm,
	setPreferences,
	SOURCE_ROW,
	TARGET_ROW,
} from './reorder-form';

type BoundingBox = NonNullable< Awaited< ReturnType< Locator[ 'boundingBox' ] > > >;

/**
 * 表示中の操作対象から現在の座標と寸法を取得する。
 *
 * @param locator 座標と寸法を取得する操作対象。
 * @return 現在の座標と寸法。
 */
async function getVisibleBoundingBox( locator: Locator ): Promise< BoundingBox > {
	await expect( locator ).toBeVisible();
	const box = await locator.boundingBox();
	if ( box === null ) {
		throw new Error( 'The Reorder Form operation target is not visible.' );
	}
	return box;
}

test.beforeEach( async ( { admin, page } ) => {
	await admin.createNewPost();
	await setPreferences( page );
} );

test.describe( 'wide Reorder Form presentation', () => {
	test.use( { viewport: { width: 1280, height: 900 } } );

	/**
	 * desktopではRFを移動可能なPopoverとして表示し、Tableを操作しても入力状態を維持することを確認する。
	 *
	 * 事前条件:
	 * - RFとTableを同時に確認できる十分な表示領域がある。
	 *
	 * 操作:
	 * - 行指定を入力し、RF入力部品以外の面をドラッグして移動する。
	 * - Popover外にある対象Tableのセルを操作する。
	 *
	 * 期待結果:
	 * - RFはPopoverとして移動し、入力内容を変更しない。
	 * - Popover外を操作しただけではRFを終了せず、入力内容を保持する。
	 */
	test( 'when the desktop form is moved and the Table is used, should keep the Popover open with its input', async ( {
		page,
		editor,
	} ) => {
		const { rows } = await insertTable( page, editor );
		const form = await openReorderForm( page );
		await fillRowReorder( form, 2, 4, 'below' );
		const before = await getVisibleBoundingBox( form );
		const title = form.getByRole( 'heading' );
		const titleBox = await getVisibleBoundingBox( title );

		await page.mouse.move( titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2 );
		await page.mouse.down();
		await page.mouse.move( titleBox.x + titleBox.width / 2 + 120, titleBox.y + 80, {
			steps: 8,
		} );
		await page.mouse.up();
		await expect
			.poll( async () => ( await form.boundingBox() )?.x )
			.toBeGreaterThan( before.x + 60 );
		await expect( form.getByRole( 'spinbutton', { name: SOURCE_ROW } ) ).toHaveValue( '2' );
		await expect( form.getByRole( 'spinbutton', { name: TARGET_ROW } ) ).toHaveValue( '4' );
		await expect( form.getByRole( 'radio', { name: BELOW } ) ).toBeChecked();

		await rows.first().locator( 'td' ).first().click();
		await expect( form ).toBeVisible();
		await expect( form.getByRole( 'spinbutton', { name: SOURCE_ROW } ) ).toHaveValue( '2' );
		await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeEnabled();
	} );
} );

test.describe( 'narrow Reorder Form presentation', () => {
	test.use( { viewport: { width: 600, height: 720 } } );

	/**
	 * 狭い表示ではRFを画面下部へ固定し、折りたたみと再展開の間も入力状態を保持することを確認する。
	 *
	 * 事前条件:
	 * - RFを狭い表示へ切り替えるEditor幅でCore Tableが選択されている。
	 *
	 * 操作:
	 * - RFへ行指定を入力する。
	 * - RFを折りたたみ、再度展開する。
	 *
	 * 期待結果:
	 * - RFは画面下部へ固定される。
	 * - 折りたたみ中は入力の要約を確認できる。
	 * - 再展開後も入力内容と選択状態を保持する。
	 * - 折りたたみ中も指定全体の結果を支援技術向け通知から認識できる。
	 */
	test( 'when the narrow form is collapsed and expanded, should remain docked and preserve the selection', async ( {
		page,
		editor,
	} ) => {
		await insertTable( page, editor );
		const form = await openReorderForm( page );
		const popover = page.locator( '.yamabiko-table-reorder-rf-popover.is-narrow' );
		await expect( popover ).toBeVisible();
		await expect( popover ).toHaveCSS( 'position', 'fixed' );
		await expect( popover ).toHaveCSS( 'bottom', '0px' );
		await fillRowReorder( form, 2, 4, 'below' );

		const collapseButton = form.getByRole( 'button', { name: COLLAPSE } );
		await expect( collapseButton ).toHaveAttribute( 'aria-expanded', 'true' );
		await collapseButton.press( 'Enter' );
		await expect( form ).toContainText( /2 → 4 · (Below|下)/ );
		await expect( form.getByRole( 'spinbutton', { name: SOURCE_ROW } ) ).toBeHidden();
		const expandButton = form.getByRole( 'button', { name: EXPAND } );
		await expect( expandButton ).toHaveAttribute( 'aria-expanded', 'false' );
		await expandButton.press( 'Space' );

		await expect( form.getByRole( 'spinbutton', { name: SOURCE_ROW } ) ).toHaveValue( '2' );
		await expect( form.getByRole( 'spinbutton', { name: TARGET_ROW } ) ).toHaveValue( '4' );
		await expect( form.getByRole( 'radio', { name: BELOW } ) ).toBeChecked();
		await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeEnabled();

		await fillRowReorder( form, 1, 2, 'above' );
		const announcement = form.getByRole( 'status' ).filter( { hasText: NO_OP } );
		await expect( announcement ).toHaveText( NO_OP );
		await expect( form.getByRole( 'radio', { name: ABOVE } ) ).toBeFocused();
		await collapseButton.press( 'Enter' );
		await expect( form.getByRole( 'spinbutton', { name: SOURCE_ROW } ) ).toBeHidden();
		await expect( announcement ).toBeVisible();
		await expect( announcement ).toHaveCount( 1 );
	} );

	/**
	 * 狭い表示の上端操作でRFの高さを変え、低い表示でも内部スクロールから全操作へ到達できることを確認する。
	 *
	 * 事前条件:
	 * - RFが画面下部へ展開表示されている。
	 *
	 * 操作:
	 * - 行指定を入力する。
	 * - RF上端を上方向と下方向へ操作して高さを変更する。
	 * - RFを低くした状態で内部をスクロールする。
	 *
	 * 期待結果:
	 * - RFの高さを上下に変更できる。
	 * - 高さ変更後も入力内容と選択状態を保持する。
	 * - 内部スクロールによって案内、確定、Cancelを含む操作へ到達できる。
	 */
	test( 'when the narrow form height is adjusted, should preserve input and keep all form actions reachable by internal scrolling', async ( {
		page,
		editor,
	} ) => {
		await insertTable( page, editor );
		const form = await openReorderForm( page );
		const popover = page.locator( '.yamabiko-table-reorder-rf-popover.is-narrow' );
		const content = popover.locator( '.components-popover__content' );
		const header = form.locator( '.yamabiko-table-reorder-rf__header' );
		await fillRowReorder( form, 2, 4, 'below' );
		const initialHeight = ( await getVisibleBoundingBox( content ) ).height;
		const headerBox = await getVisibleBoundingBox( header );

		const handleX = headerBox.x + headerBox.width / 2;
		const handleY = headerBox.y + 6;
		await page.mouse.move( handleX, handleY );
		await page.mouse.down();
		await page.mouse.move( handleX, handleY - 90, { steps: 8 } );
		await page.mouse.up();
		await expect
			.poll( async () => ( await content.boundingBox() )?.height )
			.toBeGreaterThan( initialHeight + 50 );

		const raisedHeaderBox = await getVisibleBoundingBox( header );
		await page.mouse.move( raisedHeaderBox.x + raisedHeaderBox.width / 2, raisedHeaderBox.y + 6 );
		await page.mouse.down();
		await page.mouse.move( raisedHeaderBox.x + raisedHeaderBox.width / 2, raisedHeaderBox.y + 306, {
			steps: 10,
		} );
		await page.mouse.up();
		await expect
			.poll( async () => ( await content.boundingBox() )?.height )
			.toBeLessThan( initialHeight );

		await expect( form.getByRole( 'spinbutton', { name: SOURCE_ROW } ) ).toHaveValue( '2' );
		await expect( form.getByRole( 'spinbutton', { name: TARGET_ROW } ) ).toHaveValue( '4' );
		await expect( form.getByRole( 'radio', { name: BELOW } ) ).toBeChecked();
		await expect
			.poll( () => content.evaluate( ( element ) => element.scrollHeight > element.clientHeight ) )
			.toBe( true );
		const scrollHeight = await content.evaluate( ( element ) => element.scrollHeight );
		await content.hover();
		await page.mouse.wheel( 0, scrollHeight );
		await expect
			.poll( () =>
				content.evaluate(
					( element ) => element.scrollTop + element.clientHeight >= element.scrollHeight
				)
			)
			.toBe( true );
		const applyButton = form.getByRole( 'button', { name: APPLY } );
		const cancelButton = form.getByRole( 'button', { name: /^(Cancel|キャンセル)$/ } );
		await expect( applyButton ).toBeVisible();
		await expect( applyButton ).toBeInViewport();
		await expect( cancelButton ).toBeVisible();
		await expect( cancelButton ).toBeInViewport();
	} );
} );
