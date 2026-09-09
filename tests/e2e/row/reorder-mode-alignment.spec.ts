import type { Locator } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext } from '../editor-context';
import { ROW_BUTTON, setPreferences } from './row-reorder';

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
	test.use( { viewport: { width: 1920, height: 1080 } } );

	test.beforeEach( async ( { admin, editor, page } ) => {
		await admin.createNewPost();
		await setPreferences( page );
		await editor.setContent( TABLE_CONTENT );
	} );

	/**
	 * 行の並び替えモード中でもCore Tableの配置変更を利用できることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが通常幅で配置されている。
	 * - 行の並び替えモードを利用できる。
	 *
	 * 操作:
	 * - 行の並び替えモードを有効にする。
	 * - Tableの配置を幅広、全幅、通常幅の順に変更する。
	 *
	 * 期待結果:
	 * - 各配置に応じたTable幅が反映される。
	 * - 配置変更後も行の並び替えモードが維持される。
	 */
	test( 'when Core Table alignment changes while reorder mode is active, should preserve each width and keep reorder mode active', async ( {
		editor,
		page,
	} ) => {
		const editorContext = await getEditorContext( page, editor.canvas );
		const tableBlock = editorContext.locator( '[data-type="core/table"][data-block]' );
		const tableFigure = tableBlock
			.and( editorContext.locator( 'figure.wp-block-table' ) )
			.or( tableBlock.locator( 'figure.wp-block-table' ) );
		const reorderRowsButton = page.getByRole( 'button', {
			name: ROW_BUTTON,
		} );
		const alignmentButton = page.getByRole( 'button', { name: /(Align|配置)/ } ).first();
		const alignmentOption = ( name: RegExp ) =>
			page.getByRole( 'menuitemradio', { name } ).or( page.getByRole( 'menuitem', { name } ) );

		await editor.selectBlocks( tableBlock );
		await expect( reorderRowsButton ).toBeVisible();
		await reorderRowsButton.click();
		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'true' );

		const normalWidth = await getTableWidth( tableFigure );

		await alignmentButton.click();
		await alignmentOption( /^(Wide width|幅広)/ ).click();
		await expect( tableFigure ).toHaveClass( /alignwide/ );
		const wideWidth = await getTableWidth( tableFigure );
		expect( wideWidth ).toBeGreaterThan( normalWidth );

		await alignmentButton.click();
		await alignmentOption( /^(Full width|全幅)/ ).click();
		await expect( tableFigure ).toHaveClass( /alignfull/ );
		const fullWidth = await getTableWidth( tableFigure );
		expect( fullWidth ).toBeGreaterThan( wideWidth );

		await alignmentButton.click();
		await alignmentOption( /^(None|なし)/ ).click();
		await expect( tableFigure ).not.toHaveClass( /align(?:wide|full)/ );
		await expect.poll( () => getTableWidth( tableFigure ) ).toBeCloseTo( normalWidth, 0 );

		await expect( reorderRowsButton ).toHaveAttribute( 'aria-pressed', 'true' );
	} );
} );
