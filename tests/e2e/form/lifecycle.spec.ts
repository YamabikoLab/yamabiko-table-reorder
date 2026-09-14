import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	APPLY,
	CANCEL,
	COLUMN_BUTTON,
	COLUMNS,
	COMPLETION,
	CONTINUE,
	fillColumnReorder,
	fillRowReorder,
	insertTable,
	LARGE_CONFIRMATION,
	moveRegularColumn,
	openReorderForm,
	reorderForm,
	RF_BUTTON,
	ROW_BUTTON,
	setPreferences,
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
 * Cancel、RF入口の再選択、別Blockへの移動ではTableを変更せずRFを終了し、再選択時に自動再開しないことを確認する。
 *
 * 事前条件:
 * - ParagraphとCore Tableが存在し、TableでRFを利用できる。
 *
 * 操作:
 * - 有効な行指定を入力してCancelする。
 * - RFを再開始し、RF入口を再度選択する。
 * - RFをもう一度開始してからParagraphを選択し、Tableへ戻る。
 *
 * 期待結果:
 * - どの終了経路でもTableは変更されない。
 * - RFは終了し、Tableへ戻ってもRFや以前の入力を自動再開しない。
 */
test( 'when the form is cancelled, toggled, or left for another block, should preserve the Table and remain closed after returning', async ( {
	page,
	editor,
} ) => {
	await editor.insertBlock( { name: 'core/paragraph', attributes: { content: 'Outside RF' } } );
	const { canvas, block } = await insertTable( page, editor );
	const paragraph = canvas.locator( '[data-type="core/paragraph"][data-block]' ).filter( {
		hasText: 'Outside RF',
	} );
	const before = await tableData( editor );

	let form = await openReorderForm( page );
	await fillRowReorder( form, 1, 4, 'below' );
	await form.getByRole( 'button', { name: CANCEL } ).click();
	await expect( form ).toBeHidden();
	expect( await tableData( editor ) ).toEqual( before );

	form = await openReorderForm( page );
	await page.getByRole( 'button', { name: RF_BUTTON } ).click();
	await expect( form ).toBeHidden();

	form = await openReorderForm( page );
	await paragraph.click();
	await expect( form ).toBeHidden();
	await editor.selectBlocks( block );
	await expect( reorderForm( page ) ).toBeHidden();
	await expect( page.getByRole( 'button', { name: RF_BUTTON } ) ).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	expect( await tableData( editor ) ).toEqual( before );
} );

/**
 * RFとRow / Column DnDを相互に切り替えると、同じTableで一つの並び替え手段だけが有効になることを確認する。
 *
 * 事前条件:
 * - Core TableでRow / Column DnDとRFの入口を利用できる。
 *
 * 操作:
 * - Row DnDからRFへ切り替える。
 * - RFからColumn DnDへ切り替える。
 * - Column DnDからRFへ切り替え、Cancelする。
 *
 * 期待結果:
 * - 新しい並び替え手段を開始するたびに以前の手段が終了する。
 * - RF終了後に以前のDnD modeを自動再開しない。
 */
test( 'when switching between DnD and Reorder Form, should keep only the selected method active and never restore the previous mode', async ( {
	page,
	editor,
} ) => {
	await insertTable( page, editor );
	const rowButton = page.getByRole( 'button', { name: ROW_BUTTON } );
	const columnButton = page.getByRole( 'button', { name: COLUMN_BUTTON } );

	await rowButton.click();
	await expect( rowButton ).toHaveAttribute( 'aria-pressed', 'true' );
	let form = await openReorderForm( page );
	await expect( form ).toBeVisible();
	await expect( rowButton ).toHaveAttribute( 'aria-pressed', 'false' );

	await columnButton.click();
	await expect( form ).toBeHidden();
	await expect( columnButton ).toHaveAttribute( 'aria-pressed', 'true' );

	form = await openReorderForm( page );
	await expect( form ).toBeVisible();
	await expect( columnButton ).toHaveAttribute( 'aria-pressed', 'false' );
	await form.getByRole( 'button', { name: CANCEL } ).click();
	await expect( rowButton ).toHaveAttribute( 'aria-pressed', 'false' );
	await expect( columnButton ).toHaveAttribute( 'aria-pressed', 'false' );
} );

/**
 * 310セルを更新するRow RFでは確認を表示し、中止後にTableと入力を保持してRFへ戻ることを確認する。
 *
 * 事前条件:
 * - 結合セルのない31行×10列のCore Tableが存在する。
 *
 * 操作:
 * - 1行目を31行目の下へ移動する指定で並び替えを要求する。
 * - 大規模反映の確認でCancelする。
 *
 * 期待結果:
 * - 反映前に確認が表示される。
 * - CancelではTableを変更せず、入力内容を保持したRFへ戻る。
 */
test( 'when a 310-cell row reorder is cancelled at confirmation, should preserve the Table and return to the populated form', async ( {
	page,
	editor,
} ) => {
	await insertTable( page, editor, 'core/table', tableAttributes( 31, 10 ) );
	const before = await tableData( editor );
	const form = await openReorderForm( page );
	await fillRowReorder( form, 1, 31, 'below' );
	await form.getByRole( 'button', { name: APPLY } ).click();

	const confirmation = page.getByRole( 'dialog', { name: LARGE_CONFIRMATION } );
	await expect( confirmation ).toBeVisible();
	expect( await tableData( editor ) ).toEqual( before );
	await confirmation.getByRole( 'button', { name: CANCEL } ).click();
	await expect( confirmation ).toBeHidden();
	await expect( form ).toBeVisible();
	await expect( form.getByRole( 'spinbutton', { name: SOURCE_ROW } ) ).toHaveValue( '1' );
	await expect( form.getByRole( 'spinbutton', { name: TARGET_ROW } ) ).toHaveValue( '31' );
	await expect( form.getByRole( 'button', { name: APPLY } ) ).toBeEnabled();
	expect( await tableData( editor ) ).toEqual( before );
} );

/**
 * 310セルを更新するColumn RFを続行すると、通常編集へ戻って結果セルと完了通知を確認できることを確認する。
 *
 * 事前条件:
 * - 結合セルやTable sectionを持たない31行×10列のCore Tableが存在する。
 *
 * 操作:
 * - 1列目を10列目の右へ移動する指定で並び替えを要求する。
 * - 大規模反映の確認でContinueする。
 *
 * 期待結果:
 * - Table全体の列順が変更され、RFが終了して完了通知を確認できる。
 * - 結果確認用フォーカスは移動後セル自体に置かれ、セル内の編集領域を自動選択しない。
 */
test( 'when a 310-cell column reorder is continued, should restore ordinary editing, focus the result cell, and show completion', async ( {
	page,
	editor,
} ) => {
	const { rows } = await insertTable( page, editor, 'core/table', tableAttributes( 31, 10 ) );
	const before = await tableData( editor );
	const form = await openReorderForm( page );
	await form.getByRole( 'radio', { name: COLUMNS } ).click();
	await fillColumnReorder( form, 1, 10, 'right' );
	await form.getByRole( 'button', { name: APPLY } ).click();

	const confirmation = page.getByRole( 'dialog', { name: LARGE_CONFIRMATION } );
	await expect( confirmation ).toBeVisible();
	await confirmation.getByRole( 'button', { name: CONTINUE } ).click();
	await expect( confirmation ).toBeHidden();
	await expect( reorderForm( page ) ).toBeHidden();
	await expect( page.getByText( COMPLETION ) ).toBeVisible();
	await expect
		.poll( () => columnOrder( rows.first() ) )
		.toEqual( [ 'R1C2', 'R1C3', 'R1C4', 'R1C5', 'R1C6', 'R1C7', 'R1C8', 'R1C9', 'R1C10', 'R1C1' ] );
	await expect
		.poll( () => tableData( editor ) )
		.toEqual( [ moveRegularColumn( before[ 0 ], 0, 10 ) ] );

	const resultCell = rows.first().locator( ':scope > td' ).last();
	await expect
		.poll( () =>
			resultCell.evaluate( ( cell ) => ( {
				cellFocused: cell.ownerDocument.activeElement === cell,
				editableFocused:
					cell.querySelector( '[contenteditable="true"]' ) === cell.ownerDocument.activeElement,
			} ) )
		)
		.toEqual( { cellFocused: true, editableFocused: false } );
} );
