import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	insertTable,
	moveMouse,
	pointIn,
	ROW_BUTTON,
	rowOrder,
	setPreferences,
	startMouseDrag,
	tableAttributes,
} from './row-reorder';

/**
 * 行のDnD中に縦Auto Scrollで画面外の移動先まで到達し、横位置を崩さず確定できることを確認する。
 *
 * 事前条件:
 * - 画面内に収まらない行数のCore Tableが存在する。
 * - 行の並び替えモードを利用できる。
 *
 * 操作:
 * - 先頭行のDnDを開始する。
 * - 画面下端へドラッグして縦Auto Scrollを発生させる。
 * - 当初画面外だった行が画面内へ到達した後、画面中央付近へ行をドロップする。
 *
 * 期待結果:
 * - Auto Scrollによって当初画面外だった行が画面内へ到達する。
 * - 先頭行が十分離れた位置へ移動する。
 * - Tableの横位置は変化しない。
 */
test( 'when a row is dragged toward an offscreen destination, should auto-scroll vertically and commit without horizontal drift', async ( {
	admin,
	page,
	editor,
} ) => {
	await admin.createNewPost();
	await setPreferences( page );
	const { canvas, rows } = await insertTable( page, editor, 'core/table', tableAttributes( 40 ) );
	await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
	const viewport = page.viewportSize()!;
	const destination = rows.nth( 20 );
	const originalX = ( await rows.first().boundingBox() )!.x;
	expect( ( await destination.boundingBox() )!.y ).toBeGreaterThan( viewport.height );
	await startMouseDrag( page, rows.first() );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeVisible();
	const edge = await pointIn( rows.first() );
	await moveMouse( page, { x: edge.x, y: viewport.height - 25 } );
	await expect
		.poll( async () => ( await destination.boundingBox() )!.y, { timeout: 15_000 } )
		.toBeLessThan( viewport.height - 150 );
	await page.mouse.move( edge.x, viewport.height / 2 );
	await expect( canvas.locator( '.yamabiko-table-reorder-insertion-line' ) ).toBeVisible();
	await page.mouse.up();
	await expect.poll( async () => ( await rowOrder( rows ) ).indexOf( 'Row 1' ) ).toBeGreaterThan( 5 );
	expect( ( await rows.first().boundingBox() )!.x ).toBeCloseTo( originalX, 0 );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeHidden();
} );
