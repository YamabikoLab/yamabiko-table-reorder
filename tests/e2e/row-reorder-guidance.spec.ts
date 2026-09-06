import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { GUIDANCE, insertTable, ROW_BUTTON, setPreferences } from './row-reorder';

for ( const [ completion, action ] of [
	[ 'row entry', ROW_BUTTON ],
	[ 'close', /^(Close reorder guidance|並び替えの案内を閉じる)$/ ],
] as const ) {
	test( `first-use guidance highlights the row entry, ends on ${ completion }, and stays acknowledged`, async ( {
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
