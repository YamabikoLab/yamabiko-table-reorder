import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	COLUMN_BUTTON,
	columnOrder,
	insertTable,
	moveMouse,
	setPreferences,
	startMouseDrag,
	tableAttributes,
} from './column-reorder';

/** 縦横ともにスクロール可能なAuto Scroll検証用Core Table属性を生成する。 */
function wideTableAttributes() {
	const attributes = tableAttributes( 40, 16 );
	attributes.hasFixedLayout = false;
	for ( const row of attributes.body ) {
		for ( const cell of row.cells ) {
			cell.content = `${ cell.content }-${ 'Wide'.repeat( 10 ) }`;
		}
	}
	return attributes;
}

/**
 * 列のDnD中に横Auto Scrollで画面外の移動先まで到達し、縦方向へAuto Scrollせず確定できることを確認する。
 *
 * 事前条件:
 * - 縦横ともに画面内へ収まらないCore Tableが存在する。
 * - 先頭行と先頭列は表示され、後方の行と列は画面外にある。
 * - 列の並び替えモードを利用できる。
 *
 * 操作:
 * - 先頭列のDnDを開始する。
 * - 画面右下端へドラッグして横Auto Scrollを発生させる。
 * - 当初画面外だった列が画面内へ到達した後、その列位置へドロップする。
 *
 * 期待結果:
 * - Auto Scrollによって当初画面外だった列が画面内へ到達する。
 * - DnD中もTableの縦方向の表示位置は変化しない。
 * - 先頭列が十分離れた位置へ移動する。
 */
test( 'when a column is dragged toward an offscreen destination, should auto-scroll only horizontally and commit without vertical scroll', async ( {
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
		.toBeGreaterThan( 500 );
	const cells = rows.first().locator( ':scope > td' );
	const figureBox = ( await tableFigure.boundingBox() )!;
	const viewport = page.viewportSize()!;
	expect( ( await rows.nth( 20 ).boundingBox() )!.y ).toBeGreaterThan( viewport.height );
	const destination = cells.nth( 2 );
	expect( ( await destination.boundingBox() )!.x ).toBeGreaterThan( figureBox.x + figureBox.width );
	const verticalStart = figureBox.y;
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
	await startMouseDrag( page, cells.first() );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeVisible();
	await moveMouse( page, {
		x: Math.min( figureBox.x + figureBox.width - 20, viewport.width - 20 ),
		y: viewport.height - 20,
	} );
	await expect
		.poll(
			async () => {
				const box = ( await destination.boundingBox() )!;
				return box.x + box.width / 2;
			},
			{ timeout: 15_000, intervals: [ 50 ] }
		)
		.toBeLessThan( figureBox.x + figureBox.width / 2 - 80 );
	expect( await tableFigure.evaluate( ( element ) => element.scrollLeft ) ).toBeGreaterThan( 0 );
	expect( ( await tableFigure.boundingBox() )!.y ).toBeCloseTo( verticalStart, 0 );
	await page.mouse.move( figureBox.x + figureBox.width / 2, viewport.height / 2 );
	await expect( canvas.locator( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeVisible();
	await page.mouse.up();
	await expect
		.poll( async () =>
			( await columnOrder( rows.first() ) ).indexOf( `R1C1-${ 'Wide'.repeat( 10 ) }` )
		)
		.toBeGreaterThan( 1 );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
} );
