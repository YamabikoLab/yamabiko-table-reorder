import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { applyStackedTableLayout } from '../stacked-table';

import {
	ABOVE,
	APPLY,
	COLUMNS,
	COMPLETION,
	fillColumnReorder,
	fillRowReorder,
	insertTable,
	moveRegularColumn,
	NO_OP,
	openReorderForm,
	reorderForm,
	ROWS,
	rowOrder,
	setPreferences,
	SOURCE_COLUMN,
	SOURCE_ROW,
	tableAttributes,
	tableData,
	TARGET_ROW,
	columnOrder,
} from './reorder-form';

test.beforeEach( async ( { admin, page } ) => {
	await admin.createNewPost();
	await setPreferences( page );
} );

/**
 * Stacked / Reflow表示でもColumn RFを代替操作として利用できることを確認する。
 *
 * 事前条件:
 * - Core Tableの各セルが縦積みで表示され、Column DnDは利用できない。
 *
 * 操作:
 * - RFを列へ切り替え、先頭列を末尾へ並び替える。
 *
 * 期待結果:
 * - Column RFは利用可能で、Table全体の論理列順が指定どおり変更される。
 */
test( 'when a Table is stacked, should keep column form reorder available as an alternative', async ( {
	page,
	editor,
} ) => {
	const { table, rows } = await insertTable( page, editor );
	await applyStackedTableLayout( table );
	const form = await openReorderForm( page );
	await form.getByRole( 'radio', { name: COLUMNS } ).click();
	await fillColumnReorder( form, 1, 4, 'right' );
	await form.getByRole( 'button', { name: APPLY } ).click();

	await expect
		.poll( () => columnOrder( rows.first() ) )
		.toEqual( [ 'R1C2', 'R1C3', 'R1C4', 'R1C1' ] );
} );

/**
 * Core TableからRFを開始すると行入力を表示し、有効な指定が揃うまで反映できないことを確認する。
 *
 * 事前条件:
 * - 4行のCore Tableが選択されている。
 *
 * 操作:
 * - TableツールバーからRFを開始する。
 * - 行の範囲外値を入力する。
 *
 * 期待結果:
 * - RF入口と入力画面を利用でき、行が初期選択される。
 * - 現在行範囲と整数条件が常に表示される。
 * - 未入力または範囲外の指定ではエラーを追加表示せず、並び替えを実行できない。
 */
test( 'when Reorder Form opens for a Core Table, should start with rows and disable apply until a valid selection is complete', async ( {
	page,
	editor,
} ) => {
	await insertTable( page, editor );
	const form = await openReorderForm( page );
	await expect( form ).toBeVisible();
	await expect( form.getByRole( 'radio', { name: ROWS } ) ).toBeChecked();
	await expect( form.getByRole( 'radio', { name: COLUMNS } ) ).not.toBeChecked();
	await expect(
		form.getByText( /^(Enter an integer from 1 to 4\.|1〜4の整数を入力してください。)$/ )
	).toBeVisible();
	await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeDisabled();

	await form.getByRole( 'spinbutton', { name: SOURCE_ROW } ).fill( '5' );
	await form.getByRole( 'spinbutton', { name: TARGET_ROW } ).fill( '2' );
	await form.getByRole( 'radio', { name: ABOVE } ).click();
	await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeDisabled();
	await expect( form.getByRole( 'status' ) ).toHaveCount( 0 );
} );

/**
 * Core Tableの行を並び替え前のTarget rowとの位置関係で移動し、一回のUndoで元へ戻せることを確認する。
 *
 * 事前条件:
 * - 内容、属性、装飾を持つ4行のCore Tableが存在する。
 *
 * 操作:
 * - RFで2行目を、並び替え前に4行目だった行の下へ移動する。
 * - 一回Undoする。
 *
 * 期待結果:
 * - 指定したTarget rowの直後へ行が移動し、保持対象データを失わない。
 * - RFが終了し、完了通知を確認できる。
 * - 一回のUndoで移動前のTableへ戻る。
 */
test( 'when a Core Table row is reordered with the form and undone, should use the pre-move target, preserve data, and restore the Table', async ( {
	page,
	editor,
} ) => {
	const attributes = {
		...tableAttributes(),
		caption: 'RF row caption',
	};
	attributes.body[ 1 ].cells[ 1 ].content =
		'<strong>R2C2</strong> <a href="https://example.test/">Link</a>';
	Object.assign( attributes.body[ 1 ].cells[ 1 ], { align: 'right' } );
	const { canvas, rows } = await insertTable( page, editor, 'core/table', attributes );
	const before = await tableData( editor );
	const form = await openReorderForm( page );
	await fillRowReorder( form, 2, 4, 'below' );
	await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeEnabled();
	await form.getByRole( 'button', { name: APPLY } ).click();

	await expect( canvas.getByText( COMPLETION ) ).toBeVisible();
	await expect( form ).toBeHidden();
	await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'R1C1', 'R3C1', 'R4C1', 'R2C1' ] );
	const body = before[ 0 ].body as unknown[];
	await expect
		.poll( () => tableData( editor ) )
		.toEqual( [ { ...before[ 0 ], body: [ body[ 0 ], body[ 2 ], body[ 3 ], body[ 1 ] ] } ] );

	await page.getByRole( 'button', { name: /^(Undo|元に戻す)$/ } ).click();
	await expect.poll( () => tableData( editor ) ).toEqual( before );
	await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'R1C1', 'R2C1', 'R3C1', 'R4C1' ] );
} );

/**
 * Core Tableの列を並び替え前のTarget columnとの位置関係でTable全体に反映できることを確認する。
 *
 * 事前条件:
 * - 見出し、本文、フッター、内容、属性、装飾を持つCore Tableが存在する。
 *
 * 操作:
 * - RFを列へ切り替える。
 * - 先頭列を、並び替え前の4列目の右へ移動する。
 *
 * 期待結果:
 * - 見出しと列番号で列を識別できる。
 * - Table全体の列順だけが変更され、各sectionと保持対象データが維持される。
 */
test( 'when a Core Table column is reordered with the form, should identify headings and preserve all sections and cell data', async ( {
	page,
	editor,
} ) => {
	const attributes = {
		...tableAttributes(),
		caption: 'RF column caption',
		head: [
			{
				cells: [ 'Alpha', 'Bravo', 'Charlie', 'Delta' ].map( ( content ) => ( {
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
	attributes.body[ 0 ].cells[ 0 ].content = '<em>R1C1</em>';
	Object.assign( attributes.body[ 0 ].cells[ 0 ], { align: 'center' } );
	const { rows } = await insertTable( page, editor, 'core/table', attributes );
	const before = await tableData( editor );
	const form = await openReorderForm( page );
	await form.getByRole( 'radio', { name: COLUMNS } ).click();
	await expect( form.getByRole( 'combobox', { name: SOURCE_COLUMN } ) ).toContainText(
		/Alpha \(Column 1\)|Alpha（1列目）/
	);
	await fillColumnReorder( form, 1, 4, 'right' );
	await form.getByRole( 'button', { name: APPLY } ).click();

	await expect
		.poll( () => columnOrder( rows.first() ) )
		.toEqual( [ 'R1C2', 'R1C3', 'R1C4', 'R1C1' ] );
	await expect
		.poll( () => tableData( editor ) )
		.toEqual( [ moveRegularColumn( before[ 0 ], 0, 4 ) ] );
} );

/**
 * Row / Columnの入力を独立して保持し、現在方向のno-opだけを案内することを確認する。
 *
 * 事前条件:
 * - RFが行方向で開かれている。
 *
 * 操作:
 * - 行へ並び順が変わらない指定を入力する。
 * - 列へ切り替え、列の有効な指定を入力する。
 * - 行へ戻る。
 * - 一回Undoする。
 *
 * 期待結果:
 * - no-opではTableを変更できない。
 * - 列へ切り替えると行のno-op案内を引き継がず、列入力を独立して受け付ける。
 * - 行へ戻ると以前の行入力を保持し、現在Tableに対するno-op案内を表示する。
 * - no-opが編集履歴を作らないため、一回のUndoは直前のTable挿入を戻す。
 */
test( 'when direction changes in one form session, should preserve independent inputs and show only the current direction result', async ( {
	page,
	editor,
} ) => {
	await insertTable( page, editor );
	const before = await tableData( editor );
	const form = await openReorderForm( page );
	await fillRowReorder( form, 1, 2, 'above' );
	await expect( form.getByText( NO_OP ) ).toBeVisible();
	await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeDisabled();

	await form.getByRole( 'radio', { name: COLUMNS } ).click();
	await expect( form.getByText( NO_OP ) ).toBeHidden();
	await fillColumnReorder( form, 1, 3, 'right' );
	await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeEnabled();

	await form.getByRole( 'radio', { name: ROWS } ).click();
	await expect( form.getByRole( 'spinbutton', { name: SOURCE_ROW } ) ).toHaveValue( '1' );
	await expect( form.getByRole( 'spinbutton', { name: TARGET_ROW } ) ).toHaveValue( '2' );
	await expect( form.getByText( NO_OP ) ).toBeVisible();
	expect( await tableData( editor ) ).toEqual( before );
	await page.getByRole( 'button', { name: /^(Undo|元に戻す)$/ } ).click();
	await expect.poll( () => tableData( editor ) ).toEqual( [] );
} );

/**
 * 結合セルを分断する代表的な行・列指定では原因rangeを示し、Tableを変更しないことを確認する。
 *
 * 事前条件:
 * - rowspanとcolspanを含むCore Tableが存在する。
 *
 * 操作:
 * - 行方向でrowspanを分断する位置を指定する。
 * - 列方向へ切り替え、colspanを分断する位置を指定する。
 *
 * 期待結果:
 * - 各方向で原因となる行・列rangeを含むメッセージを表示する。
 * - 並び替えを実行できず、Tableデータを変更しない。
 */
test( 'when row or column input would split merged cells, should identify the blocking range and preserve the Table', async ( {
	page,
	editor,
} ) => {
	const attributes = {
		hasFixedLayout: true,
		body: [
			{
				cells: [
					{ tag: 'td', content: 'A1-A2', rowspan: '2' },
					{ tag: 'td', content: 'B1-C1', colspan: '2' },
				],
			},
			{
				cells: [
					{ tag: 'td', content: 'B2' },
					{ tag: 'td', content: 'C2' },
				],
			},
			{ cells: [ 'A3', 'B3', 'C3' ].map( ( content ) => ( { tag: 'td', content } ) ) },
		],
	};
	await insertTable( page, editor, 'core/table', attributes );
	const before = await tableData( editor );
	const form = await openReorderForm( page );
	await fillRowReorder( form, 3, 2, 'above' );
	await expect( form.getByRole( 'status' ) ).toContainText(
		/merged cell spanning rows 1–2 in column 1|1〜2行目の1列目に結合セル/
	);
	await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeDisabled();

	await form.getByRole( 'radio', { name: COLUMNS } ).click();
	await expect( form.getByRole( 'status' ) ).toHaveCount( 0 );
	await fillColumnReorder( form, 1, 2, 'right' );
	await expect( form.getByRole( 'status' ) ).toContainText(
		/merged cell in row 1 spanning columns 2–3|1行目の2〜3列目に結合セル/
	);
	await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeDisabled();
	expect( await tableData( editor ) ).toEqual( before );
} );

/**
 * Flexible Table BlockでもRFの行移動が成立し、セル内容と属性を保持することを確認する。
 *
 * 事前条件:
 * - 内容、装飾、属性を持つFlexible Table Blockが存在する。
 *
 * 操作:
 * - RFで先頭行を末尾行の下へ移動する。
 *
 * 期待結果:
 * - 先頭行が末尾へ移動する。
 * - セル内容、装飾、属性が保持される。
 */
test( 'when a Flexible Table Block row is reordered with the form, should preserve cell content and attributes', async ( {
	page,
	editor,
} ) => {
	const attributes = tableAttributes();
	Object.assign( attributes.body[ 0 ].cells[ 0 ], {
		styles: 'color:#123456',
		id: 'rf-preserved-row-cell',
		content: '<em>R1C1</em>',
	} );
	const { rows } = await insertTable( page, editor, 'flexible-table-block/table', attributes );
	const before = await tableData( editor );
	const form = await openReorderForm( page );
	await fillRowReorder( form, 1, 4, 'below' );
	await form.getByRole( 'button', { name: APPLY } ).click();

	await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'R2C1', 'R3C1', 'R4C1', 'R1C1' ] );
	const body = before[ 0 ].body as unknown[];
	await expect
		.poll( () => tableData( editor ) )
		.toEqual( [ { ...before[ 0 ], body: [ ...body.slice( 1 ), body[ 0 ] ] } ] );
} );

/**
 * Flexible Table BlockでもRFの列移動が成立し、セル内容と属性を保持することを確認する。
 *
 * 事前条件:
 * - 内容、装飾、属性を持つFlexible Table Blockが存在する。
 *
 * 操作:
 * - RFで先頭列を末尾列の右へ移動する。
 *
 * 期待結果:
 * - 先頭列が末尾へ移動する。
 * - 各行のセル内容、装飾、属性が保持される。
 */
test( 'when a Flexible Table Block column is reordered with the form, should preserve cell content and attributes', async ( {
	page,
	editor,
} ) => {
	const attributes = tableAttributes();
	Object.assign( attributes.body[ 0 ].cells[ 0 ], {
		styles: 'color:#123456',
		id: 'rf-preserved-column-cell',
		content: '<strong>R1C1</strong>',
	} );
	const { rows } = await insertTable( page, editor, 'flexible-table-block/table', attributes );
	const before = await tableData( editor );
	const form = await openReorderForm( page );
	await form.getByRole( 'radio', { name: COLUMNS } ).click();
	await fillColumnReorder( form, 1, 4, 'right' );
	await form.getByRole( 'button', { name: APPLY } ).click();

	await expect
		.poll( () => columnOrder( rows.first() ) )
		.toEqual( [ 'R1C2', 'R1C3', 'R1C4', 'R1C1' ] );
	await expect
		.poll( () => tableData( editor ) )
		.toEqual( [ moveRegularColumn( before[ 0 ], 0, 4 ) ] );
	await expect( reorderForm( page ) ).toBeHidden();
} );
