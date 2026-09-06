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

test( 'vertical auto scroll carries a drag to an initially offscreen destination without horizontal drift', async ( {
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
	const body = rows.first().locator( '..' );
	const destinationBox = ( await destination.boundingBox() )!;
	const destinationOffset = destinationBox.y - ( await body.boundingBox() )!.y;
	expect( ( await destination.boundingBox() )!.y ).toBeGreaterThan( viewport.height );
	await startMouseDrag( page, rows.first() );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeVisible();
	const edge = await pointIn( rows.first() );
	await moveMouse( page, { x: edge.x, y: viewport.height - 25 } );
	await expect
		.poll( async () => ( await destination.boundingBox() )!.y, { timeout: 15_000 } )
		.toBeLessThan( viewport.height - 150 );
	await page.mouse.move( edge.x, viewport.height / 2 );
	let previousY = Number.NaN;
	await expect
		.poll( async () => {
			const y = ( await body.boundingBox() )!.y;
			const stopped = y === previousY;
			previousY = y;
			return stopped;
		} )
		.toBe( true );
	// 周囲行の移動表示に依存せず、開始時の論理位置へ現在のスクロール量だけを反映する。
	await page.mouse.move(
		edge.x,
		( await body.boundingBox() )!.y + destinationOffset + destinationBox.height * 0.8
	);
	await expect( canvas.locator( '.yamabiko-table-reorder-insertion-line' ) ).toBeVisible();
	await page.mouse.up();
	const expected = Array.from( { length: 40 }, ( _, i ) => `Row ${ i + 1 }` );
	expected.splice( 0, 1 );
	expected.splice( 20, 0, 'Row 1' );
	await expect.poll( () => rowOrder( rows ) ).toEqual( expected );
	expect( ( await rows.first().boundingBox() )!.x ).toBeCloseTo( originalX, 0 );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeHidden();
} );
