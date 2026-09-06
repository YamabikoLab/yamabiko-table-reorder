import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	insertTable,
	moveMouse,
	pointIn,
	REJECTION,
	ROW_BUTTON,
	rowOrder,
	setPreferences,
	startMouseDrag,
	tableAttributes,
	tableData,
} from './row-reorder';

test.beforeEach( async ( { admin, page } ) => {
	await admin.createNewPost();
	await setPreferences( page );
} );

test( 'Core mouse drag shows the moving row and destination, preserves data, and undoes once', async ( {
	page,
	editor,
} ) => {
	const attributes = {
		...tableAttributes(),
		caption: 'Table caption',
		head: [ { cells: [ { tag: 'th', content: 'Heading' } ] } ],
		foot: [ { cells: [ { tag: 'td', content: 'Footer' } ] } ],
	};
	attributes.body[ 0 ].cells[ 1 ].content =
		'<strong>Bold</strong> <a href="https://example.test/">Link</a>';
	Object.assign( attributes.body[ 0 ].cells[ 1 ], { align: 'right' } );
	const { canvas, rows } = await insertTable( page, editor, 'core/table', attributes );
	const before = await tableData( editor );
	const sourceBox = await rows.first().boundingBox();
	const middle = await pointIn( rows.nth( 2 ), 0.8 );
	const end = await pointIn( rows.last(), 0.8 );
	await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
	await startMouseDrag( page, rows.first() );
	const moving = canvas.locator( '.yamabiko-table-reorder-moving-row' );
	const line = canvas.locator( '.yamabiko-table-reorder-insertion-line' );
	await expect( moving ).toBeVisible();
	await expect( moving ).toContainText( 'Row 1' );
	await expect( moving ).toHaveCSS( 'outline-style', 'solid' );
	expect(
		Math.abs( ( await moving.boundingBox() )!.width - sourceBox!.width )
	).toBeLessThanOrEqual( 2 );
	await moveMouse( page, middle );
	await expect( line ).toBeVisible();
	const middleLine = await line.boundingBox();
	await moveMouse( page, end );
	await expect.poll( async () => ( await line.boundingBox() )?.y ).toBeGreaterThan( middleLine!.y );
	expect( await tableData( editor ) ).toEqual( before );
	await page.mouse.up();
	await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'Row 2', 'Row 3', 'Row 4', 'Row 1' ] );
	await expect( moving ).toBeHidden();
	await expect( line ).toBeHidden();
	const body = before[ 0 ].body as unknown[];
	expect( await tableData( editor ) ).toEqual( [
		{ ...before[ 0 ], body: [ ...body.slice( 1 ), body[ 0 ] ] },
	] );
	await page.getByRole( 'button', { name: /^(Undo|元に戻す)$/ } ).click();
	await expect.poll( () => tableData( editor ) ).toEqual( before );
	await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'Row 1', 'Row 2', 'Row 3', 'Row 4' ] );
} );

test( 'moves the last row to the first boundary', async ( { page, editor } ) => {
	const { rows } = await insertTable( page, editor );
	const destination = await pointIn( rows.first(), 0.2 );
	await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
	await startMouseDrag( page, rows.last() );
	await moveMouse( page, destination );
	await page.mouse.up();
	await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'Row 4', 'Row 1', 'Row 2', 'Row 3' ] );
} );

test( 'dropping outside the Table leaves edited data unchanged', async ( { page, editor } ) => {
	const { canvas, block, rows } = await insertTable( page, editor );
	const before = await tableData( editor );
	const box = ( await block.boundingBox() )!;
	await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
	await startMouseDrag( page, rows.first() );
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeVisible();
	await moveMouse( page, { x: box.x - 15, y: box.y + box.height / 2 } );
	await expect( canvas.locator( '.yamabiko-table-reorder-insertion-line' ) ).toBeHidden();
	await page.mouse.up();
	await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeHidden();
	expect( await tableData( editor ) ).toEqual( before );
	await expect( page.getByRole( 'button', { name: ROW_BUTTON } ) ).toHaveAttribute(
		'aria-pressed',
		'true'
	);
} );

test.describe( 'merged cells', () => {
	const merged = () => ( {
		hasFixedLayout: true,
		body: [
			{
				cells: [
					{ tag: 'td', content: 'Merged', rowspan: '2' },
					{ tag: 'td', content: 'Upper' },
				],
			},
			{ cells: [ { tag: 'td', content: 'Lower' } ] },
			{ cells: [ { tag: 'td', content: 'Movable', colspan: '2' } ] },
		],
	} );

	test( 'rowspan prevents physical drag and explains why near the input before dismissing automatically', async ( {
		page,
		editor,
	} ) => {
		const { canvas, rows } = await insertTable( page, editor, 'core/table', merged() );
		const before = await tableData( editor );
		await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
		const point = await pointIn( rows.first().locator( 'td' ).last() );
		await page.mouse.move( point.x, point.y );
		await page.mouse.down();
		const notice = canvas.getByText( REJECTION );
		await expect( notice ).toBeVisible();
		const shown = Date.now();
		const box = ( await notice.boundingBox() )!;
		expect( Math.abs( box.x - point.x ) ).toBeLessThan( 100 );
		expect( Math.abs( box.y - point.y ) ).toBeLessThan( 100 );
		await moveMouse( page, await pointIn( rows.last() ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeHidden();
		await expect( canvas.locator( '.yamabiko-table-reorder-insertion-line' ) ).toBeHidden();
		await page.mouse.up();
		expect( await tableData( editor ) ).toEqual( before );
		await expect( notice ).toBeHidden( { timeout: 5_000 } );
		expect( Date.now() - shown ).toBeGreaterThan( 800 );
	} );

	test( 'does not commit a destination splitting rowspan, but can move a colspan row before it', async ( {
		page,
		editor,
	} ) => {
		const { canvas, rows } = await insertTable( page, editor, 'core/table', merged() );
		const before = await tableData( editor );
		const invalid = await pointIn( rows.nth( 1 ), 0.2 );
		const first = await pointIn( rows.first(), 0.2 );
		await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
		await startMouseDrag( page, rows.last() );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeVisible();
		await moveMouse( page, invalid );
		await expect( canvas.locator( '.yamabiko-table-reorder-insertion-line' ) ).toBeHidden();
		await page.mouse.up();
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeHidden();
		expect( await tableData( editor ) ).toEqual( before );
		await startMouseDrag( page, rows.last() );
		await moveMouse( page, first );
		await page.mouse.up();
		await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'Movable', 'Merged', 'Lower' ] );
		const body = before[ 0 ].body as unknown[];
		expect( await tableData( editor ) ).toEqual( [
			{ ...before[ 0 ], body: [ body[ 2 ], body[ 0 ], body[ 1 ] ] },
		] );
	} );
} );

test( 'Flexible Table Block supports representative mouse drag with cell attributes preserved', async ( {
	page,
	editor,
} ) => {
	const attributes = tableAttributes();
	Object.assign( attributes.body[ 0 ].cells[ 0 ], {
		styles: 'color:#123456',
		id: 'preserved-cell',
		content: '<em>Row 1</em>',
	} );
	const { rows } = await insertTable( page, editor, 'flexible-table-block/table', attributes );
	const before = await tableData( editor );
	const end = await pointIn( rows.last(), 0.8 );
	await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
	await startMouseDrag( page, rows.first() );
	await moveMouse( page, end );
	await page.mouse.up();
	await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'Row 2', 'Row 3', 'Row 4', 'Row 1' ] );
	const body = before[ 0 ].body as unknown[];
	expect( await tableData( editor ) ).toEqual( [
		{ ...before[ 0 ], body: [ ...body.slice( 1 ), body[ 0 ] ] },
	] );
} );

test( 'selecting another Table ends reorder mode and allows ordinary editing', async ( {
	page,
	editor,
} ) => {
	const first = await insertTable( page, editor );
	const second = await insertTable( page, editor );
	await editor.selectBlocks( first.block );
	await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
	await second.rows.first().locator( 'td' ).first().click();
	await expect( page.getByRole( 'button', { name: ROW_BUTTON } ) ).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await editor.selectBlocks( first.block );
	await expect( page.getByRole( 'button', { name: ROW_BUTTON } ) ).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await first.rows
		.first()
		.locator( '[contenteditable]' )
		.first()
		.fill( 'Edited after reorder mode' );
	await expect( first.rows.first() ).toContainText( 'Edited after reorder mode' );
} );
