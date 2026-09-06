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

test( 'touch long press starts row drag and commits the visible destination', async ( {
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

test( 'touch scroll remains available before a drag starts in row mode', async ( {
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
