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

/**
 * Core Tableの行をマウスDnDし、表示・データ保持・Undoまで一連の利用者向け動作を確認する。
 *
 * 事前条件:
 * - 見出し、フッター、装飾、属性を含むCore Tableが存在する。
 * - 行の並び替えモードを利用できる。
 *
 * 操作:
 * - 行の並び替えモードを有効にする。
 * - 先頭行を複数の移動先候補を経由して末尾へドラッグ＆ドロップする。
 * - 1回Undoする。
 *
 * 期待結果:
 * - DnD中は移動中の行と現在の移動先が表示される。
 * - drop前はTableの編集データが変更されない。
 * - 確定後は行だけが移動し、内容・属性・装飾・見出し・フッターが保持される。
 * - 1回のUndoで移動前の状態へ戻る。
 */
test( 'when a Core Table row is dragged by mouse and then undone, should show drag feedback, preserve edited data, and restore the original order', async ( {
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

/**
 * 末尾行をTableの先頭境界へ移動できることを確認する。
 *
 * 操作:
 * - 行の並び替えモードを有効にする。
 * - 末尾行を先頭境界へドラッグ＆ドロップする。
 *
 * 期待結果:
 * - 末尾行がTableの先頭へ移動する。
 */
test( 'when the last row is dropped at the first boundary, should move it to the beginning of the Table', async ( {
	page,
	editor,
} ) => {
	const { rows } = await insertTable( page, editor );
	const destination = await pointIn( rows.first(), 0.2 );
	await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
	await startMouseDrag( page, rows.last() );
	await moveMouse( page, destination );
	await page.mouse.up();
	await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'Row 4', 'Row 1', 'Row 2', 'Row 3' ] );
} );

/**
 * Table外へのdropでは行移動を確定せず、編集中のTableを変更しないことを確認する。
 *
 * 事前条件:
 * - 行の並び替えモードが有効である。
 *
 * 操作:
 * - 行のDnDを開始する。
 * - Table外へ移動してdropする。
 *
 * 期待結果:
 * - 有効な移動先は表示されない。
 * - Tableの編集データは変更されない。
 * - 行の並び替えモードは維持される。
 */
test( 'when a dragged row is dropped outside the Table, should leave edited data unchanged and keep row mode active', async ( {
	page,
	editor,
} ) => {
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

	/**
	 * rowspanを含む移動不可行ではDnDを開始せず、利用者へ理由を示すことを確認する。
	 *
	 * 事前条件:
	 * - rowspanにより複数行へまたがるセルを含むCore Tableが存在する。
	 * - 行の並び替えモードが有効である。
	 *
	 * 操作:
	 * - rowspanを含む行からマウスDnDの開始を試みる。
	 *
	 * 期待結果:
	 * - DnDは開始されない。
	 * - 開始を試みた位置の近くに移動できない理由が表示される。
	 * - Tableの編集データは変更されない。
	 * - 理由の表示は一定時間後に自動終了する。
	 */
	test( 'when drag starts from a row constrained by rowspan, should reject the drag, explain why near the input, and dismiss the notice automatically', async ( {
		page,
		editor,
	} ) => {
		const { canvas, rows } = await insertTable( page, editor, 'core/table', merged() );
		const before = await tableData( editor );
		await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
		const point = await pointIn( rows.first().locator( 'td' ).last() );
		await page.mouse.move( point.x, point.y );
		await page.mouse.down();
		const notice = canvas.getByTestId( 'snackbar' ).filter( { hasText: REJECTION } );
		await expect( notice ).toBeVisible();
		await expect( notice ).toHaveText( REJECTION );
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

	/**
	 * rowspanを分断する移動先は無効とし、colspanだけを含む行は有効な位置へ移動できることを確認する。
	 *
	 * 事前条件:
	 * - rowspanによる結合範囲と、colspanだけを含む移動可能行が同じTableに存在する。
	 *
	 * 操作:
	 * - colspan行をrowspanの結合範囲を分断する位置へdropする。
	 * - 同じcolspan行を結合範囲を分断しない先頭位置へdropする。
	 *
	 * 期待結果:
	 * - rowspanを分断する位置では移動が確定しない。
	 * - 有効な先頭位置ではcolspan行が移動する。
	 * - colspanを含むセルの編集データは保持される。
	 */
	test( 'when a colspan row is dropped across rowspan boundaries, should reject the splitting destination but allow a valid destination', async ( {
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

/**
 * Flexible Table Blockでも行をマウスDnDし、セル属性を保持したまま移動できることを確認する。
 *
 * 事前条件:
 * - 装飾と属性を持つセルを含むFlexible Table Blockが存在する。
 *
 * 操作:
 * - 行の並び替えモードを有効にする。
 * - 先頭行を末尾へドラッグ＆ドロップする。
 *
 * 期待結果:
 * - 先頭行が末尾へ移動する。
 * - セルの内容と属性が保持される。
 */
test( 'when a Flexible Table Block row is dragged by mouse, should move it while preserving cell content and attributes', async ( {
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

/**
 * 操作対象を別のTableへ移すと行の並び替えモードが終了し、通常編集へ戻れることを確認する。
 *
 * 事前条件:
 * - Editor内に複数のTableが存在する。
 * - 最初のTableで行の並び替えモードが有効である。
 *
 * 操作:
 * - 別のTableを選択する。
 * - 最初のTableへ戻ってセル内容を編集する。
 *
 * 期待結果:
 * - 別のTableを選択した時点で行の並び替えモードが終了する。
 * - 最初のTableへ戻っても行の並び替えモードは再開しない。
 * - セルを通常どおり編集できる。
 */
test( 'when another Table is selected during row mode, should end reorder mode and restore ordinary editing', async ( {
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
