import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { GUIDANCE, insertTable, ROW_BUTTON, setPreferences } from './row-reorder';

for ( const [ completion, action ] of [
	[ 'row entry', ROW_BUTTON ],
	[ 'close', /^(Close reorder guidance|並び替えの案内を閉じる)$/ ],
] as const ) {
	/**
	 * 初回案内が行の並び替え入口を案内し、利用者が案内を終了した後は再表示されないことを確認する。
	 *
	 * 事前条件:
	 * - 並び替えの初回案内が未確認である。
	 *
	 * 操作:
	 * - Tableを表示して初回案内を確認する。
	 * - 行の並び替え入口の選択または案内を閉じる操作で初回案内を終了する。
	 * - 別のTableを表示する。
	 *
	 * 期待結果:
	 * - 初回案内の表示中は行の並び替え入口が強調される。
	 * - 終了操作後は案内と強調が終了する。
	 * - 別のTableでは初回案内が再表示されない。
	 */
	test( `when first-use guidance is completed by ${ completion }, should end the guidance and keep it acknowledged`, async ( {
		admin,
		page,
		editor,
	} ) => {
		await admin.createNewPost();
		await setPreferences( page, false );
		await insertTable( page, editor );
		const guidance = page.getByText( GUIDANCE );
		const entry = page.getByRole( 'button', { name: ROW_BUTTON } );
		await expect( guidance ).toBeVisible();
		await expect( entry ).toHaveCSS( 'outline-style', 'solid' );
		await expect( entry ).toHaveCSS( 'outline-width', '2px' );
		await page.getByRole( 'button', { name: action } ).click();
		await expect( guidance ).toBeHidden();
		await expect( entry ).not.toHaveCSS( 'outline-width', '2px' );
		await insertTable( page, editor );
		await expect( entry ).toBeVisible();
		await expect( guidance ).toBeHidden();
		await expect( entry ).not.toHaveCSS( 'outline-width', '2px' );
	} );
}
