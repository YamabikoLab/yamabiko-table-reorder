import { expect, test } from '@wordpress/e2e-test-utils-playwright';

const frontendAssetPathPattern =
	/\/yamabiko-table-reorder\/build\/(?:index\.js|runtime\.js|index\.css)$/;

const frontendAssetSelectors = [
	'#yamabiko-table-reorder-index-js',
	'#yamabiko-table-reorder-webpack-runtime-js',
	'#yamabiko-table-reorder-index-css',
].join( ', ' );

/**
 * 通常のサイト閲覧時にYamabiko Table ReorderのEditor用アセットが追加されないことを確認する。
 *
 * 事前条件:
 * - Yamabiko Table Reorderが有効化されている。
 *
 * 操作:
 * - 未認証の訪問者としてサイトの公開ページを表示する。
 *
 * 期待結果:
 * - Yamabiko Table ReorderのJavaScriptとCSSが読み込まれない。
 * - 公開ページのHTMLにYamabiko Table ReorderのJavaScriptとCSSが出力されない。
 */
test( 'when a public site page is opened, should not load editor assets', async ( {
	context,
	page,
} ) => {
	const requestedFrontendAssets: string[] = [];

	await context.clearCookies();
	page.on( 'request', ( request ) => {
		const pathname = new URL( request.url() ).pathname;

		if ( frontendAssetPathPattern.test( pathname ) ) {
			requestedFrontendAssets.push( pathname );
		}
	} );

	const response = await page.goto( '/' );

	expect( response?.ok() ).toBe( true );
	expect( requestedFrontendAssets ).toEqual( [] );
	await expect( page.locator( frontendAssetSelectors ) ).toHaveCount( 0 );
} );
