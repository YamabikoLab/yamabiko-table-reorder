import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	COLUMN_BUTTON,
	columnOrder,
	insertTable,
	moveMouse,
	pointIn,
	REJECTION,
	setPreferences,
	startMouseDrag,
	tableAttributes,
	tableData,
} from './column-reorder';

test.beforeEach( async ( { admin, page } ) => {
	await admin.createNewPost();
	await setPreferences( page );
} );

/**
 * 保存済みTable属性に対して、通常セルだけで構成される列移動後の期待値を作る。
 * @param attributes               移動前のTable属性。
 * @param sourceColumnIndex        移動元列。
 * @param destinationBoundaryIndex 移動先境界。
 */
function moveRegularColumn(
	attributes: Record< string, unknown >,
	sourceColumnIndex: number,
	destinationBoundaryIndex: number
) {
	const moved = structuredClone( attributes );
	for ( const sectionName of [ 'head', 'body', 'foot' ] ) {
		const section = moved[ sectionName ];
		if ( ! Array.isArray( section ) ) {
			continue;
		}

		for ( const row of section as { cells: unknown[] }[] ) {
			const [ source ] = row.cells.splice( sourceColumnIndex, 1 );
			const insertionIndex =
				destinationBoundaryIndex > sourceColumnIndex
					? destinationBoundaryIndex - 1
					: destinationBoundaryIndex;
			row.cells.splice( insertionIndex, 0, source );
		}
	}
	return moved;
}

/**
 * Core Tableの列をマウスDnDし、表示・Table全体のデータ保持・Undoまで一連の利用者向け動作を確認する。
 *
 * 事前条件:
 * - 見出し、本文、フッター、装飾、属性を含むCore Tableが存在する。
 * - 列の並び替えモードを利用できる。
 *
 * 操作:
 * - 列の並び替えモードを有効にする。
 * - 先頭列を複数の移動先候補を経由して末尾へドラッグ＆ドロップする。
 * - 1回Undoする。
 *
 * 期待結果:
 * - DnD中は移動中の列と現在の移動先を認識できる。
 * - iframe Editorでは周囲列が移動し、non-iframe Editorでは周囲列の位置を維持する。
 * - drop前はTableの編集データが変更されない。
 * - 確定後はTable全体の列だけが移動し、内容・属性・装飾・各sectionが保持される。
 * - 1回のUndoで移動前の状態へ戻る。
 */
test( 'when a Core Table column is dragged by mouse and then undone, should show drag feedback, preserve all sections, and restore the original order', async ( {
	page,
	editor,
} ) => {
	const attributes = {
		...tableAttributes(),
		caption: 'Table caption',
		head: [
			{
				cells: [ 'H1', 'H2', 'H3', 'H4' ].map( ( content ) => ( {
					tag: 'th',
					content,
				} ) ),
			},
		],
		foot: [
			{
				cells: [ 'F1', 'F2', 'F3', 'F4' ].map( ( content ) => ( {
					tag: 'td',
					content,
				} ) ),
			},
		],
	};
	attributes.body[ 0 ].cells[ 0 ].content =
		'<strong>R1C1</strong> <a href="https://example.test/">Link</a>';
	Object.assign( attributes.body[ 0 ].cells[ 0 ], { align: 'right' } );
	const { canvas, rows } = await insertTable( page, editor, 'core/table', attributes );
	const cells = rows.first().locator( ':scope > td' );
	const before = await tableData( editor );
	const sourceBox = await cells.first().boundingBox();
	const displacedStart = ( await cells.nth( 1 ).boundingBox() )!.x;
	const middle = await pointIn( cells.nth( 2 ), 0.8 );
	const end = await pointIn( cells.last(), 0.8 );
	const entry = page.getByRole( 'button', { name: COLUMN_BUTTON } );
	await expect( entry ).toBeVisible();
	await entry.click();
	await expect( entry ).toHaveAttribute( 'aria-pressed', 'true' );
	await startMouseDrag( page, cells.first() );
	const moving = canvas.locator( '.yamabiko-table-reorder-moving-column' );
	const line = canvas.locator( '.yamabiko-table-reorder-column-insertion-line' );
	await expect( moving ).toBeVisible();
	await expect( moving ).toContainText( 'R1C1' );
	await expect( moving ).toHaveCSS( 'outline-style', 'solid' );
	expect(
		Math.abs( ( await moving.boundingBox() )!.width - sourceBox!.width )
	).toBeLessThanOrEqual( 2 );
	await moveMouse( page, middle );
	await expect( line ).toBeVisible();
	const middleLine = await line.boundingBox();
	const editorUsesIframe = ( await page.locator( 'iframe[name="editor-canvas"]' ).count() ) > 0;
	if ( editorUsesIframe ) {
		await expect
			.poll( async () => ( await cells.nth( 1 ).boundingBox() )!.x )
			.toBeLessThan( displacedStart );
	} else {
		await expect
			.poll( async () => ( await cells.nth( 1 ).boundingBox() )!.x )
			.toBe( displacedStart );
	}
	await moveMouse( page, end );
	await expect.poll( async () => ( await line.boundingBox() )?.x ).toBeGreaterThan( middleLine!.x );
	expect( await tableData( editor ) ).toEqual( before );
	await page.mouse.up();
	await expect
		.poll( () => columnOrder( rows.first() ) )
		.toEqual( [ 'R1C2', 'R1C3', 'R1C4', 'R1C1 Link' ] );
	await expect( moving ).toBeHidden();
	await expect( line ).toBeHidden();
	expect( await tableData( editor ) ).toEqual( [ moveRegularColumn( before[ 0 ], 0, 4 ) ] );
	await page.getByRole( 'button', { name: /^(Undo|元に戻す)$/ } ).click();
	await expect.poll( () => tableData( editor ) ).toEqual( before );
	await expect
		.poll( () => columnOrder( rows.first() ) )
		.toEqual( [ 'R1C1 Link', 'R1C2', 'R1C3', 'R1C4' ] );
} );

/**
 * 末尾列をTableの先頭境界へ移動できることを確認する。
 *
 * 操作:
 * - 列の並び替えモードを有効にする。
 * - 末尾列を先頭境界へドラッグ＆ドロップする。
 *
 * 期待結果:
 * - 末尾列がTableの先頭へ移動する。
 */
test( 'when the last column is dropped at the first boundary, should move it to the beginning of the Table', async ( {
	page,
	editor,
} ) => {
	const { rows } = await insertTable( page, editor );
	const cells = rows.first().locator( ':scope > td' );
	const destination = await pointIn( cells.first(), 0.05 );
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
	await startMouseDrag( page, cells.last() );
	await moveMouse( page, destination );
	await page.mouse.up();
	await expect
		.poll( () => columnOrder( rows.first() ) )
		.toEqual( [ 'R1C4', 'R1C1', 'R1C2', 'R1C3' ] );
} );

/**
 * Table外へのdropでは列移動を確定せず、DnD中だけの表示と編集中のTableを元へ戻すことを確認する。
 *
 * 事前条件:
 * - 列の並び替えモードが有効である。
 *
 * 操作:
 * - 列のDnDを開始する。
 * - Table外へ移動してdropする。
 *
 * 期待結果:
 * - 有効な移動先は表示されない。
 * - DnD終了後は移動中の表示が残らない。
 * - Tableの編集データは変更されず、列の並び替えモードが維持される。
 */
test( 'when a dragged column is dropped outside the Table, should clear drag feedback, keep data unchanged, and keep column mode active', async ( {
	page,
	editor,
} ) => {
	const { canvas, block, rows } = await insertTable( page, editor );
	const before = await tableData( editor );
	const box = ( await block.boundingBox() )!;
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
	await startMouseDrag( page, rows.first().locator( 'td' ).first() );
	const moving = canvas.locator( '.yamabiko-table-reorder-moving-column' );
	const line = canvas.locator( '.yamabiko-table-reorder-column-insertion-line' );
	await expect( moving ).toBeVisible();
	await moveMouse( page, { x: box.x - 15, y: box.y + box.height / 2 } );
	await expect( line ).toBeHidden();
	await page.mouse.up();
	await expect( moving ).toBeHidden();
	await expect( line ).toBeHidden();
	expect( await tableData( editor ) ).toEqual( before );
	await expect( page.getByRole( 'button', { name: COLUMN_BUTTON } ) ).toHaveAttribute(
		'aria-pressed',
		'true'
	);
} );

test.describe( 'merged cells', () => {
	const colspanTable = () => ( {
		hasFixedLayout: true,
		body: [
			{
				cells: [
					{ tag: 'td', content: 'Merged A-B', colspan: '2' },
					{ tag: 'td', content: 'C1' },
					{ tag: 'td', content: 'D1' },
				],
			},
			{
				cells: [ 'A2', 'B2', 'C2', 'D2' ].map( ( content ) => ( {
					tag: 'td',
					content,
				} ) ),
			},
		],
	} );

	/**
	 * colspanを含む移動不可列ではDnDを開始せず、利用者へ理由を示すことを確認する。
	 *
	 * 事前条件:
	 * - colspanにより複数列へまたがるセルを含むCore Tableが存在する。
	 * - 列の並び替えモードが有効である。
	 *
	 * 操作:
	 * - colspan範囲に含まれる列からマウスDnDの開始を試みる。
	 *
	 * 期待結果:
	 * - DnDは開始されない。
	 * - 開始を試みた位置の近くに移動できない理由が表示される。
	 * - Tableの編集データは変更されない。
	 * - 理由の表示は一定時間後に自動終了する。
	 */
	test( 'when drag starts from a column constrained by colspan, should reject the drag, explain why near the input, and dismiss the notice automatically', async ( {
		page,
		editor,
	} ) => {
		const { canvas, rows } = await insertTable( page, editor, 'core/table', colspanTable() );
		const before = await tableData( editor );
		await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
		const source = rows.first().locator( 'td' ).first();
		const point = await pointIn( source, 0.25 );
		await page.mouse.move( point.x, point.y );
		await page.mouse.down();
		const notice = canvas.getByTestId( 'snackbar' ).filter( { hasText: REJECTION } );
		await expect( notice ).toBeVisible();
		await expect( notice ).toHaveText( REJECTION );
		const shown = Date.now();
		const box = ( await notice.boundingBox() )!;
		expect( Math.abs( box.x - point.x ) ).toBeLessThan( 100 );
		expect( Math.abs( box.y - point.y ) ).toBeLessThan( 100 );
		await moveMouse( page, await pointIn( rows.last().locator( 'td' ).last() ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
		await expect( canvas.locator( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeHidden();
		await page.mouse.up();
		expect( await tableData( editor ) ).toEqual( before );
		await expect( notice ).toBeHidden( { timeout: 5_000 } );
		expect( Date.now() - shown ).toBeGreaterThan( 800 );
	} );

	/**
	 * colspanを分断する移動先では、移動可能な列でもTableを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - 先頭2列にまたがる横結合セルと、その外側に移動可能列が存在する。
	 *
	 * 操作:
	 * - 末尾列を横結合セル内部の列間へdropする。
	 *
	 * 期待結果:
	 * - 横結合セル内部には確定可能な移動先を表示しない。
	 * - 列移動を確定せず、Tableの編集データを変更しない。
	 */
	test( 'when a movable column is dropped inside a colspan range, should reject the splitting destination and preserve the Table', async ( {
		page,
		editor,
	} ) => {
		const { canvas, rows } = await insertTable( page, editor, 'core/table', colspanTable() );
		const before = await tableData( editor );
		const firstRowCells = rows.first().locator( ':scope > td' );
		await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
		await startMouseDrag( page, firstRowCells.last() );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeVisible();
		await moveMouse( page, await pointIn( firstRowCells.first(), 0.5 ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeHidden();
		await page.mouse.up();
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
		expect( await tableData( editor ) ).toEqual( before );
	} );

	/**
	 * rowspanだけを含むTableでは構造を保ったまま列を移動できることを確認する。
	 *
	 * 事前条件:
	 * - 先頭列に縦結合セルを含み、横結合セルを含まないCore Tableが存在する。
	 *
	 * 操作:
	 * - 3列目をTableの先頭境界へドラッグ＆ドロップする。
	 *
	 * 期待結果:
	 * - DnDが通常どおり成立する。
	 * - 3列目がTableの先頭へ移動し、rowspanと省略セル構造が保持される。
	 */
	test( 'when a Table contains only rowspan, should move a column while preserving the logical grid', async ( {
		page,
		editor,
	} ) => {
		const attributes = {
			hasFixedLayout: true,
			body: [
				{
					cells: [
						{ tag: 'td', content: 'A1-A2', rowspan: '2' },
						{ tag: 'td', content: 'B1' },
						{ tag: 'td', content: 'C1' },
						{ tag: 'td', content: 'D1' },
					],
				},
				{
					cells: [
						{ tag: 'td', content: 'B2' },
						{ tag: 'td', content: 'C2' },
						{ tag: 'td', content: 'D2' },
					],
				},
			],
		};
		const { rows } = await insertTable( page, editor, 'core/table', attributes );
		const before = await tableData( editor );
		const firstRowCells = rows.first().locator( ':scope > td' );
		await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
		await startMouseDrag( page, firstRowCells.nth( 2 ) );
		await moveMouse( page, await pointIn( firstRowCells.first(), 0.05 ) );
		await page.mouse.up();
		await expect.poll( () => columnOrder( rows.first() ) ).toEqual( [ 'C1', 'A1-A2', 'B1', 'D1' ] );
		const body = before[ 0 ].body as { cells: unknown[] }[];
		expect( await tableData( editor ) ).toEqual( [
			{
				...before[ 0 ],
				body: [
					{
						...body[ 0 ],
						cells: [ body[ 0 ].cells[ 2 ], ...body[ 0 ].cells.slice( 0, 2 ), body[ 0 ].cells[ 3 ] ],
					},
					{
						...body[ 1 ],
						cells: [ body[ 1 ].cells[ 1 ], body[ 1 ].cells[ 0 ], body[ 1 ].cells[ 2 ] ],
					},
				],
			},
		] );
	} );
} );

/**
 * Flexible Table Blockでも列をマウスDnDし、セル属性を保持したままTable全体を更新できることを確認する。
 *
 * 事前条件:
 * - 装飾と属性を持つセルを含むFlexible Table Blockが存在する。
 *
 * 操作:
 * - 列の並び替えモードを有効にする。
 * - 先頭列を末尾へドラッグ＆ドロップする。
 *
 * 期待結果:
 * - 先頭列が末尾へ移動する。
 * - 各行のセル内容と属性が保持される。
 */
test( 'when a Flexible Table Block column is dragged by mouse, should move it while preserving cell content and attributes', async ( {
	page,
	editor,
} ) => {
	const attributes = tableAttributes();
	Object.assign( attributes.body[ 0 ].cells[ 0 ], {
		styles: 'color:#123456',
		id: 'preserved-cell',
		content: '<em>R1C1</em>',
	} );
	const { rows } = await insertTable( page, editor, 'flexible-table-block/table', attributes );
	const before = await tableData( editor );
	const cells = rows.first().locator( ':scope > td' );
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
	await startMouseDrag( page, cells.first() );
	await moveMouse( page, await pointIn( cells.last(), 0.8 ) );
	await page.mouse.up();
	await expect
		.poll( () => columnOrder( rows.first() ) )
		.toEqual( [ 'R1C2', 'R1C3', 'R1C4', 'R1C1' ] );
	expect( await tableData( editor ) ).toEqual( [ moveRegularColumn( before[ 0 ], 0, 4 ) ] );
} );

/**
 * 操作対象を別のTableへ移すと列の並び替えモードが終了し、通常編集へ戻れることを確認する。
 *
 * 事前条件:
 * - Editor内に複数のTableが存在する。
 * - 最初のTableで列の並び替えモードが有効である。
 *
 * 操作:
 * - 別のTableを選択する。
 * - 最初のTableへ戻ってセル内容を編集する。
 *
 * 期待結果:
 * - 別のTableを選択した時点で列の並び替えモードが終了する。
 * - 最初のTableへ戻っても列の並び替えモードは再開しない。
 * - セルを通常どおり編集できる。
 */
test( 'when another Table is selected during column mode, should end reorder mode and restore ordinary editing', async ( {
	page,
	editor,
} ) => {
	const first = await insertTable( page, editor );
	const second = await insertTable( page, editor );
	await editor.selectBlocks( first.block );
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
	await second.rows.first().locator( 'td' ).first().click();
	await expect( page.getByRole( 'button', { name: COLUMN_BUTTON } ) ).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await editor.selectBlocks( first.block );
	await expect( page.getByRole( 'button', { name: COLUMN_BUTTON } ) ).toHaveAttribute(
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