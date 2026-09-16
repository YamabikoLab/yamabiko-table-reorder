import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { insertTable, ROW_BUTTON, setPreferences } from './row-reorder';

const GUIDANCE =
	/^(Reorder rows and columns by dragging or using the form\.|行・列をドラッグまたはフォームで並び替えられます。)$/;

/**
 * 行の並び替え入口から初回案内を終了し、表示済み状態が保持されることを確認する。
 *
 * 事前条件:
 * - PC環境の並び替え初回案内が未確認である。
 *
 * 操作:
 * - Tableを表示して初回案内を確認する。
 * - 行の並び替え入口を選択する。
 * - 別のTableを表示する。
 *
 * 期待結果:
 * - 行の並び替え入口を選択すると初回案内が終了する。
 * - 別のTableでは初回案内が再表示されない。
 */
test( 'when first-use guidance is completed by the row entry, should end the guidance and keep it acknowledged', async ( {
	admin,
	page,
	editor,
} ) => {
	await admin.createNewPost();
	await setPreferences( page, false );
	await insertTable( page, editor );

	const guidance = page.getByText( GUIDANCE );
	const entry = page.getByRole( 'button', { name: ROW_BUTTON } );
	await expect( guidance ).toBeVisible();
	await expect( entry ).toBeVisible();

	await entry.click();
	await expect( guidance ).toBeHidden();

	await insertTable( page, editor );
	await expect( page.getByRole( 'button', { name: ROW_BUTTON } ) ).toBeVisible();
	await expect( guidance ).toBeHidden();
} );
