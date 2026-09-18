import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	APPLY,
	COLUMNS,
	insertTable,
	reorderForm,
	RF_BUTTON,
	rowOrder,
	setPreferences,
	SOURCE_COLUMN,
	SOURCE_ROW,
	tableData,
	TARGET_ROW,
} from './reorder-form';

/**
 * Keyboard操作だけで指定した要素へTab移動する。
 *
 * @param page   管理画面。
 * @param target Keyboard focusを到達させる対象。
 */
async function tabTo( page: Page, target: Locator ): Promise< void > {
	for ( let attempt = 0; attempt < 40; attempt += 1 ) {
		const focused = await target.evaluate(
			( element ) => element.ownerDocument.activeElement === element
		);
		if ( focused ) {
			return;
		}
		await page.keyboard.press( 'Tab' );
	}

	throw new Error( 'Keyboard focus did not reach the Reorder Form target.' );
}

/**
 * Gutenbergの標準Keyboard経路でBlock Toolbar内のRF入口へ移動する。
 *
 * @param page 管理画面。
 * @return Keyboard focusが到達したRF ToolbarButton。
 */
async function focusReorderFormToolbarButton( page: Page ): Promise< Locator > {
	const button = page.getByRole( 'button', { name: RF_BUTTON } );
	await page.keyboard.press( 'Alt+F10' );

	for ( let attempt = 0; attempt < 40; attempt += 1 ) {
		const focused = await button.evaluate(
			( element ) => element.ownerDocument.activeElement === element
		);
		if ( focused ) {
			return button;
		}
		await page.keyboard.press( 'ArrowRight' );
	}

	throw new Error( 'Keyboard focus did not reach the Reorder Form toolbar entry.' );
}

test.beforeEach( async ( { admin, page } ) => {
	await admin.createNewPost();
	await setPreferences( page );
} );

/**
 * Core TableのRF入口から行並び替えの反映までを標準Keyboard操作だけで完了できることを確認する。
 *
 * 事前条件:
 * - Core Tableが選択され、Block Toolbarを利用できる。
 *
 * 操作:
 * - KeyboardでBlock Toolbarへ移動し、toolbar内の標準移動でRF入口を選ぶ。
 * - EnterでRFを開く。
 * - Tabとnative input / radioの標準Keyboard操作で行指定を入力して反映する。
 *
 * 期待結果:
 * - RF入口をKeyboardだけで起動できる。
 * - 行並び替えをKeyboardだけで完了できる。
 * - 指定した行順がTableへ反映される。
 */
test( 'when Reorder Form row input is used from the Block Toolbar, should complete the move with standard keyboard interaction', async ( {
	page,
	editor,
} ) => {
	const { rows } = await insertTable( page, editor );
	await focusReorderFormToolbarButton( page );
	await page.keyboard.press( 'Enter' );
	await expect( reorderForm( page ) ).toBeVisible();

	const form = reorderForm( page );
	const source = form.getByRole( 'spinbutton', { name: SOURCE_ROW } );
	await tabTo( page, source );
	await page.keyboard.type( '1' );

	const target = form.getByRole( 'spinbutton', { name: TARGET_ROW } );
	await tabTo( page, target );
	await page.keyboard.type( '3' );

	const below = form.getByRole( 'radio', { name: /^(Below|下)$/ } );
	await tabTo( page, below );
	await page.keyboard.press( 'Space' );

	const apply = form.getByRole( 'button', { name: APPLY } );
	await tabTo( page, apply );
	await expect( apply ).toBeEnabled();
	await page.keyboard.press( 'Enter' );

	await expect.poll( () => rowOrder( rows ) ).toEqual( [ 'R2C1', 'R3C1', 'R1C1', 'R4C1' ] );
} );

/**
 * Core TableのRFでColumnへ切り替え、列並び替えの反映までを標準Keyboard操作だけで完了できることを確認する。
 *
 * 事前条件:
 * - Core Tableが選択され、RF入口をBlock Toolbarから利用できる。
 *
 * 操作:
 * - KeyboardでRFを開く。
 * - native radio / selectの標準Keyboard操作でColumnへ切り替え、移動元・移動先・位置を指定する。
 * - Keyboardで並び替えを実行する。
 *
 * 期待結果:
 * - Columnの主要入力をKeyboardだけで操作できる。
 * - 列並び替えをKeyboardだけで完了できる。
 */
test( 'when Reorder Form column input is selected, should complete the move with standard keyboard interaction', async ( {
	page,
	editor,
} ) => {
	await insertTable( page, editor );
	await focusReorderFormToolbarButton( page );
	await page.keyboard.press( 'Space' );
	const form = reorderForm( page );
	await expect( form ).toBeVisible();

	const rowsRadio = form.getByRole( 'radio', { name: /^(Rows|行)$/ } );
	await tabTo( page, rowsRadio );
	await page.keyboard.press( 'ArrowRight' );
	await expect( form.getByRole( 'radio', { name: COLUMNS } ) ).toBeChecked();

	const source = form.getByRole( 'combobox', { name: SOURCE_COLUMN } );
	await tabTo( page, source );
	await page.keyboard.press( 'ArrowDown' );

	const target = form.getByRole( 'combobox', { name: /^(Target column|移動先の列)$/ } );
	await tabTo( page, target );
	await page.keyboard.press( 'ArrowDown' );
	await page.keyboard.press( 'ArrowDown' );

	const right = form.getByRole( 'radio', { name: /^(Right|右)$/ } );
	await tabTo( page, right );
	await page.keyboard.press( 'Space' );

	const before = await tableData( editor );
	const apply = form.getByRole( 'button', { name: APPLY } );
	await tabTo( page, apply );
	await expect( apply ).toBeEnabled();
	await page.keyboard.press( 'Enter' );

	await expect.poll( () => tableData( editor ) ).not.toEqual( before );
	await expect( form ).toBeHidden();
} );

/**
 * RF入力画面をKeyboardだけでCancelできることを確認する。
 *
 * 事前条件:
 * - RFがBlock Toolbarから開かれている。
 *
 * 操作:
 * - TabでCancelへ移動し、Enterで実行する。
 *
 * 期待結果:
 * - RFが閉じる。
 * - Tableデータは変更されない。
 */
test( 'when Cancel is reached from an open Reorder Form, should close without changing the Table', async ( {
	page,
	editor,
} ) => {
	await insertTable( page, editor );
	const before = await tableData( editor );
	await focusReorderFormToolbarButton( page );
	await page.keyboard.press( 'Enter' );
	const form = reorderForm( page );
	await expect( form ).toBeVisible();

	const source = form.getByRole( 'spinbutton', { name: SOURCE_ROW } );
	await tabTo( page, source );
	await page.keyboard.type( '1' );
	const target = form.getByRole( 'spinbutton', { name: TARGET_ROW } );
	await tabTo( page, target );
	await page.keyboard.type( '3' );
	const below = form.getByRole( 'radio', { name: /^(Below|下)$/ } );
	await tabTo( page, below );
	await page.keyboard.press( 'Space' );

	const apply = form.getByRole( 'button', { name: APPLY } );
	await tabTo( page, apply );
	await expect( apply ).toBeEnabled();
	const cancel = form.getByRole( 'button', { name: /^(Cancel|キャンセル)$/ } );
	await page.keyboard.press( 'Shift+Tab' );
	await expect( cancel ).toBeFocused();
	await page.keyboard.press( 'Enter' );

	await expect( form ).toBeHidden();
	expect( await tableData( editor ) ).toEqual( before );
} );
