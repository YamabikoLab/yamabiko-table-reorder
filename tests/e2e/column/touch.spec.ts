import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	COLUMN_BUTTON,
	columnOrder,
	insertTable,
	pointIn,
	setPreferences,
	tableAttributes,
	tableData,
	touchInput,
} from './column-reorder';

test.use( { hasTouch: true, isMobile: true, viewport: { width: 1024, height: 768 } } );

test.beforeEach( async ( { admin, page } ) => {
	await admin.createNewPost();
	await setPreferences( page );
} );

/** 横方向へ通常スクロールできるCore Table属性を生成する。 */
function wideTableAttributes() {
	const attributes = tableAttributes( 4, 12 );
	attributes.hasFixedLayout = false;
	for ( const row of attributes.body ) {
		for ( const cell of row.cells ) {
			cell.content = `${ cell.content }-${ 'Wide'.repeat( 12 ) }`;
		}
	}
	return attributes;
}

/**
 * セル内容の長押しで列のDnDを開始し、表示された移動先へ確定できることを確認する。
 *
 * 事前条件:
 * - タッチ入力を利用できる環境でTableが表示されている。
 * - 列の並び替えモードを利用できる。
 *
 * 操作:
 * - 列の並び替えモードを有効にする。
 * - 先頭列の編集可能なセル内容を長押ししてDnDを開始し、末尾の移動先へ移動する。
 * - 指を離して移動を確定する。
 *
 * 期待結果:
 * - セル内容の通常編集へ遷移せず、長押し後に移動中の列と移動先が表示される。
 * - 先頭列が末尾へ移動する。
 * - 確定後はDnD中だけの表示が終了する。
 */
test( 'when editable cell content is long-pressed and dragged by touch, should start column DnD without entering edit mode and move the column', async ( {
	page,
	editor,
} ) => {
	const { canvas, rows } = await insertTable( page, editor );
	const cells = rows.first().locator( ':scope > td' );
	const editable = cells.first().locator( '[contenteditable="true"]' ).first();
	await expect( editable ).toBeVisible();
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).tap();
	const touch = await touchInput( page );
	try {
		await touch.start( await pointIn( editable ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeVisible();
		await expect( editable ).not.toBeFocused();
		await touch.move( await pointIn( cells.last(), 0.8 ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeVisible();
		await touch.end();
		await expect
			.poll( () => columnOrder( rows.first() ) )
			.toEqual( [ 'R1C2', 'R1C3', 'R1C4', 'R1C1' ] );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
		await expect( canvas.locator( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeHidden();
	} finally {
		await touch.dispose();
	}
} );

/**
 * 見出しセル内容の長押しでも通常編集と競合せず列DnDを開始できることを確認する。
 *
 * 事前条件:
 * - タッチ入力を利用できる環境で、見出しを持つCore Tableが表示されている。
 * - 列の並び替えモードを利用できる。
 *
 * 操作:
 * - 列の並び替えモードを有効にする。
 * - 見出しセルの編集可能な内容を長押しする。
 *
 * 期待結果:
 * - 見出しセルの通常編集へ遷移しない。
 * - 見出しセルを移動元として列DnDが開始される。
 */
test( 'when editable header content is long-pressed by touch, should start column DnD without entering edit mode', async ( {
	page,
	editor,
} ) => {
	const attributes = {
		...tableAttributes(),
		head: [
			{
				cells: [ 'H1', 'H2', 'H3', 'H4' ].map( ( content ) => ( {
					tag: 'th',
					content,
				} ) ),
			},
		],
	};
	const { canvas, block } = await insertTable( page, editor, 'core/table', attributes );
	const headerCell = block.locator( 'thead > tr > th' ).first();
	const editable = headerCell.locator( '[contenteditable="true"]' ).first();
	await expect( editable ).toBeVisible();
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).tap();
	const touch = await touchInput( page );
	try {
		await touch.start( await pointIn( editable ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeVisible();
		await expect( editable ).not.toBeFocused();
		await touch.end();
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
	} finally {
		await touch.dispose();
	}
} );

/**
 * 列の並び替えモード中でもDnD開始前の通常タッチスクロールを利用できることを確認する。
 *
 * 事前条件:
 * - タッチ入力を利用できる環境で、横方向に画面内へ収まらないTableが表示されている。
 * - 列の並び替えモードが有効である。
 *
 * 操作:
 * - DnDを開始せずTable上を通常のタッチ操作で横スクロールする。
 *
 * 期待結果:
 * - Tableを横方向へスクロールできる。
 * - 列のDnDは開始されない。
 * - Tableの編集データは変更されない。
 * - 列の並び替えモードは維持される。
 */
test( 'when the user scrolls horizontally by touch before drag starts, should scroll normally without changing the Table or leaving column mode', async ( {
	page,
	editor,
} ) => {
	const { canvas, block } = await insertTable( page, editor, 'core/table', wideTableAttributes() );
	const tableFigure = block
		.and( canvas.locator( 'figure.wp-block-table' ) )
		.or( block.locator( 'figure.wp-block-table' ) );
	await expect
		.poll( () => tableFigure.evaluate( ( element ) => element.scrollWidth - element.clientWidth ) )
		.toBeGreaterThan( 100 );
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).tap();
	const before = await tableData( editor );
	const figureBox = ( await tableFigure.boundingBox() )!;
	const touch = await touchInput( page );
	try {
		await touch.scrollHorizontally( {
			x: figureBox.x + figureBox.width - 40,
			y: figureBox.y + figureBox.height / 2,
		} );
		await expect
			.poll( () => tableFigure.evaluate( ( element ) => element.scrollLeft ) )
			.toBeGreaterThan( 100 );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
		expect( await tableData( editor ) ).toEqual( before );
		await expect( page.getByRole( 'button', { name: COLUMN_BUTTON } ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	} finally {
		await touch.dispose();
	}
} );
