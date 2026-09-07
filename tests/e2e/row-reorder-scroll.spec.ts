import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	insertTable,
	moveMouse,
	ROW_BUTTON,
	rowOrder,
	setPreferences,
	startMouseDrag,
	tableAttributes,
} from './row-reorder';

/** 横方向にもスクロール可能なAuto Scroll検証用Core Table属性を生成する。 */
function wideTableAttributes() {
	const attributes = tableAttributes( 40, 12 );
	attributes.hasFixedLayout = false;
	for ( const row of attributes.body ) {
		for ( const [ column, cell ] of row.cells.entries() ) {
			cell.content = column === 0 ? cell.content : `Column${ column + 1 }${ 'Wide'.repeat( 12 ) }`;
		}
	}
	return attributes;
}

/**
 * 行のDnD中に縦Auto Scrollで画面外の移動先まで到達し、横方向へAuto Scrollせず確定できることを確認する。
 *
 * 事前条件:
 * - 縦横ともに画面内へ収まらないCore Tableが存在する。
 * - Tableは横方向の途中までスクロールされている。
 * - 行の並び替えモードを利用できる。
 *
 * 操作:
 * - 先頭行のDnDを開始する。
 * - 画面右下端へドラッグして縦Auto Scrollを発生させる。
 * - 当初画面外だった行が画面内へ到達した後、画面中央付近へ行をドロップする。
 *
 * 期待結果:
 * - Auto Scrollによって当初画面外だった行が画面内へ到達する。
 * - DnD中もTableの横方向のスクロール位置は変化しない。
 * - 先頭行が十分離れた位置へ移動する。
 */
test( 'when a row is dragged toward an offscreen destination, should auto-scroll only vertically and commit without horizontal scroll', async ( {
	admin,
	page,
	editor,
} ) => {
	await admin.createNewPost();
	await setPreferences( page );
	const { canvas, block, rows } = await insertTable(
		page,
		editor,
		'core/table',
		wideTableAttributes()
	);
	const tableFigure = block
		.and( canvas.locator( 'figure.wp-block-table' ) )
		.or( block.locator( 'figure.wp-block-table' ) );
	await expect
		.poll( () => tableFigure.evaluate( ( element ) => element.scrollWidth - element.clientWidth ) )
		.toBeGreaterThan( 100 );
	await tableFigure.evaluate( ( element ) => {
		element.scrollLeft = ( element.scrollWidth - element.clientWidth ) / 2;
	} );
	const source = rows.first().locator( 'td' ).nth( 6 );
	await source.scrollIntoViewIfNeeded();
	const horizontalStart = await tableFigure.evaluate( ( element ) => ( {
		scrollLeft: element.scrollLeft,
		maxScrollLeft: element.scrollWidth - element.clientWidth,
	} ) );
	expect( horizontalStart.scrollLeft ).toBeGreaterThan( 0 );
	expect( horizontalStart.scrollLeft ).toBeLessThan( horizontalStart.maxScrollLeft );
	await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
	const viewport = page.viewportSize()!;
	const destination = rows.nth( 20 );
	expect( ( await destination.boundingBox() )!.y ).toBeGreaterThan( viewport.height );
	await startMouseDrag( page, source );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeVisible();
	const tableBox = ( await tableFigure.boundingBox() )!;
	const horizontalEdge = Math.min( tableBox.x + tableBox.width - 25, viewport.width - 25 );
	await moveMouse( page, { x: horizontalEdge, y: viewport.height - 25 } );
	await expect
		.poll( async () => ( await destination.boundingBox() )!.y, { timeout: 15_000 } )
		.toBeLessThan( viewport.height - 150 );
	expect( await tableFigure.evaluate( ( element ) => element.scrollLeft ) ).toBeCloseTo(
		horizontalStart.scrollLeft,
		0
	);
	await page.mouse.move( tableBox.x + tableBox.width / 2, viewport.height / 2 );
	await expect( canvas.locator( '.yamabiko-table-reorder-insertion-line' ) ).toBeVisible();
	await page.mouse.up();
	await expect
		.poll( async () => ( await rowOrder( rows ) ).indexOf( 'Row 1' ) )
		.toBeGreaterThan( 5 );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeHidden();
} );
