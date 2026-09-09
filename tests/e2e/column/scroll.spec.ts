import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	COLUMN_BUTTON,
	columnOrder,
	insertTable,
	moveMouse,
	pointIn,
	setPreferences,
	startMouseDrag,
	tableAttributes,
} from './column-reorder';

/** 横Auto Scroll検証用Core Table属性を生成する。 */
function wideTableAttributes() {
	const attributes = tableAttributes( 4, 16 );
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
 * - 横方向に画面内へ収まらないCore Tableが存在する。
 * - 先頭列は表示され、後方の列は画面外にある。
 * - 列の並び替えモードを利用できる。
 *
 * 操作:
 * - 先頭列のDnDを開始する。
 * - Tableの右端へドラッグして横Auto Scrollを発生させる。
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
	expect( ( await cells.nth( 2 ).boundingBox() )!.x ).toBeGreaterThan(
		figureBox.x + figureBox.width
	);
	const verticalStart = figureBox.y;
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
	await startMouseDrag( page, cells.first() );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeVisible();
	await moveMouse( page, {
		x: figureBox.x + figureBox.width - 20,
		y: figureBox.y + figureBox.height / 2,
	} );
	await expect
		.poll( () => tableFigure.evaluate( ( element ) => element.scrollLeft ), {
			timeout: 15_000,
		} )
		.toBeGreaterThan( 500 );
	await page.mouse.move( figureBox.x + figureBox.width / 2, figureBox.y + figureBox.height / 2 );
	const destinationIndex = await cells.evaluateAll(
		( elements, bounds ) =>
			elements.findIndex( ( element, index ) => {
				const rectangle = element.getBoundingClientRect();
				return (
					index > 1 && rectangle.right > bounds.left + 40 && rectangle.left < bounds.right - 40
				);
			} ),
		{ left: figureBox.x, right: figureBox.x + figureBox.width }
	);
	expect( destinationIndex ).toBeGreaterThan( 1 );
	const destination = cells.nth( destinationIndex );
	const destinationBox = ( await destination.boundingBox() )!;
	expect( ( await tableFigure.boundingBox() )!.y ).toBeCloseTo( verticalStart, 0 );
	await moveMouse( page, {
		x: Math.min(
			figureBox.x + figureBox.width - 40,
			Math.max( figureBox.x + 40, destinationBox.x + destinationBox.width * 0.8 )
		),
		y: ( await pointIn( destination ) ).y,
	} );
	await expect( canvas.locator( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeVisible();
	await page.mouse.up();
	await expect
		.poll( async () =>
			( await columnOrder( rows.first() ) ).indexOf( `R1C1-${ 'Wide'.repeat( 10 ) }` )
		)
		.toBeGreaterThan( 1 );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
} );
