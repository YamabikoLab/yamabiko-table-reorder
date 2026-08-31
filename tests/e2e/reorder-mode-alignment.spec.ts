import type { Locator } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext } from './editor-context';

const TABLE_CONTENT = `<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Alpha</td><td>Bravo</td></tr><tr><td>Charlie</td><td>Delta</td></tr></tbody></table></figure>
<!-- /wp:table -->`;

/**
 * Table内容の実際の表示幅を取得する。
 *
 * @param tableFigure Core Tableのfigure要素。
 * @return 現在の表示幅。
 */
const getTableWidth = async ( tableFigure: Locator ) =>
	tableFigure.evaluate( ( element ) => element.getBoundingClientRect().width );

test.describe( 'Reorder Mode Table alignment', () => {
	test.beforeEach( async ( { admin, editor } ) => {
		await admin.createNewPost();
		await editor.setContent( TABLE_CONTENT );
	} );

	test( 'keeps Core Table normal, wide, and full widths working while Reorder Mode is active', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableBlock = editorContext.locator( '[data-type="core/table"][data-block]' );
		const tableFigure = tableBlock.locator( 'figure.wp-block-table' );
		const reorderRowsButton = page.getByRole( 'button', {
			name: /^(Reorder rows|行を並べ替え)$/,
		} );
		const alignmentButton = page.getByRole( 'button', { name: /(Align|配置)/ } ).first();

		await editor.selectBlocks( tableBlock );
		await expect( reorderRowsButton ).toBeVisible();
		await reorderRowsButton.click();
		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'true' );

		const normalWidth = await getTableWidth( tableFigure );

		await alignmentButton.click();
		await page.getByRole( 'menuitem', { name: /^(Wide width|幅広)$/ } ).click();
		await expect( tableFigure ).toHaveClass( /alignwide/ );
		const wideWidth = await getTableWidth( tableFigure );
		expect( wideWidth ).toBeGreaterThan( normalWidth );

		await alignmentButton.click();
		await page.getByRole( 'menuitem', { name: /^(Full width|全幅)$/ } ).click();
		await expect( tableFigure ).toHaveClass( /alignfull/ );
		const fullWidth = await getTableWidth( tableFigure );
		expect( fullWidth ).toBeGreaterThan( wideWidth );

		await alignmentButton.click();
		await page.getByRole( 'menuitem', { name: /^(None|なし)$/ } ).click();
		await expect( tableFigure ).not.toHaveClass( /align(?:wide|full)/ );
		await expect.poll( () => getTableWidth( tableFigure ) ).toBeCloseTo( normalWidth, 0 );

		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'true' );
	} );
} );
