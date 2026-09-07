import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	insertTable,
	pointIn,
	ROW_BUTTON,
	rowOrder,
	setPreferences,
	tableAttributes,
	tableData,
	touchInput,
} from './row-reorder';

test.use( { hasTouch: true, isMobile: true, viewport: { width: 1024, height: 768 } } );

test.beforeEach( async ( { admin, page } ) => {
	await admin.createNewPost();
	await setPreferences( page );
} );

/**
 * タッチの長押しで行のDnDを開始し、表示された移動先へ確定できることを確認する。
 *
 * 事前条件:
 * - タッチ入力を利用できる環境でTableが表示されている。
 * - 行の並び替えモードを利用できる。
 *
 * 操作:
 * - 行の並び替えモードを有効にする。
 * - 先頭行を長押ししてDnDを開始し、末尾の移動先へ移動する。
 * - 指を離して移動を確定する。
 *
 * 期待結果:
 * - 長押し後に移動中の行と移動先が表示される。
 * - 先頭行が末尾へ移動する。
 * - 確定後は移動中の表示が終了する。
 */
test( 'when a row is long-pressed and dragged by touch, should move it to the visible destination', async ( {
	page,
	editor,
} ) => {
	const { canvas, rows } = await insertTable( page, editor );
	await page.getByRole( 'button', { name: ROW_BUTTON } ).tap();
	const end = await pointIn( rows.last(), 0.8 );
	const touch = await touchInput( page );
	try {
		await touch.start( await pointIn( rows.first() ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeVisible();
		await touch.move( end );
		await expect( canvas.locator( '.yamabiko-table-reorder-insertion-line' ) ).toBeVisible();
		await touch.end();
		await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'Row 2', 'Row 3', 'Row 4', 'Row 1' ] );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeHidden();
	} finally {
		await touch.dispose();
	}
} );

/**
 * 行の並び替えモード中でもDnD開始前の通常タッチスクロールを利用できることを確認する。
 *
 * 事前条件:
 * - タッチ入力を利用できる環境で、画面内に収まらないTableが表示されている。
 * - 行の並び替えモードが有効である。
 *
 * 操作:
 * - DnDを開始せずTable上を通常のタッチ操作でスクロールする。
 *
 * 期待結果:
 * - Tableを縦方向へスクロールできる。
 * - 行のDnDは開始されない。
 * - Tableの編集データは変更されない。
 * - 行の並び替えモードは維持される。
 */
test( 'when the user scrolls by touch before drag starts, should scroll normally without changing the Table or leaving row mode', async ( {
	page,
	editor,
} ) => {
	const { canvas, rows } = await insertTable( page, editor, 'core/table', tableAttributes( 40 ) );
	await page.getByRole( 'button', { name: ROW_BUTTON } ).tap();
	const before = await tableData( editor );
	const originalY = ( await rows.first().boundingBox() )!.y;
	const touch = await touchInput( page );
	try {
		await touch.scroll( await pointIn( rows.nth( 5 ) ) );
		await expect
			.poll( async () => ( await rows.first().boundingBox() )!.y )
			.toBeLessThan( originalY - 100 );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeHidden();
		expect( await tableData( editor ) ).toEqual( before );
		await expect( page.getByRole( 'button', { name: ROW_BUTTON } ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	} finally {
		await touch.dispose();
	}
} );
