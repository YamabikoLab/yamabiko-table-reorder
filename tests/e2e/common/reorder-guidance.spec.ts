import type { Page } from '@playwright/test';
import type { Editor } from '@wordpress/e2e-test-utils-playwright';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext } from '../editor-context';

const GUIDANCE =
	/^(Reorder rows and columns by dragging or using the form\.|行・列をドラッグまたはフォームで並び替えられます。)$/;
const CLOSE_GUIDANCE = /^(Close reorder guidance|並び替えの案内を閉じる)$/;
const ROW_BUTTON = /^(Reorder rows|行を並び替え|行を並べ替え)$/;
const COLUMN_BUTTON = /^(Reorder columns|列を並び替え|列を並べ替え)$/;
const FORM_BUTTON = /^(Reorder with form|フォームで並び替え)$/;

/**
 * 初回案内の表示済み状態と固定ツールバーをテスト条件として設定する。
 *
 * @param page         WordPress管理画面。
 * @param acknowledged PC／タッチ双方の初回案内を表示済みにするか。
 */
async function setGuidancePreferences( page: Page, acknowledged: boolean ) {
	await page.evaluate( ( seen ) => {
		const preferences = window.wp.data.dispatch( 'core/preferences' );
		preferences.set( 'yamabiko-table-reorder', 'initialGuidanceAcknowledgedPc', seen );
		preferences.set( 'yamabiko-table-reorder', 'initialGuidanceAcknowledgedTouch', seen );
		preferences.set( 'core/edit-post', 'fixedToolbar', true );
	}, acknowledged );
}

/**
 * 初回案内を表示するためのCore Tableを挿入し、そのTableを選択する。
 *
 * @param page   WordPress管理画面。
 * @param editor WordPressの編集helper。
 */
async function insertGuidanceTable( page: Page, editor: Editor ) {
	await editor.insertBlock( {
		name: 'core/table',
		attributes: {
			hasFixedLayout: true,
			body: [
				{
					cells: [
						{ tag: 'td', content: 'A' },
						{ tag: 'td', content: 'B' },
					],
				},
			],
		},
	} );
	const canvas = await getEditorContext( page, editor.canvas );
	const block = canvas.locator( '[data-type="core/table"][data-block]' ).last();
	await editor.selectBlocks( block );
}

/**
 * 初回案内が3つの並び替え入口を共通の機能群として案内し、閉じた後は再表示されないことを確認する。
 *
 * 事前条件:
 * - PC環境の並び替え初回案内が未確認である。
 *
 * 操作:
 * - Tableを表示して初回案内を確認する。
 * - 初回案内を閉じる。
 * - 別のTableを表示する。
 *
 * 期待結果:
 * - ドラッグまたはフォームで行・列を並び替えられる案内文が表示される。
 * - 行、列、フォームの3つの並び替え入口が1つのまとまりとして強調される。
 * - 案内を閉じると案内と入口群の強調が終了する。
 * - 別のTableでは初回案内が再表示されない。
 */
test( 'when first-use guidance is dismissed, should highlight all reorder entries as one group and keep guidance acknowledged', async ( {
	admin,
	page,
	editor,
} ) => {
	await admin.createNewPost();
	await setGuidancePreferences( page, false );
	await insertGuidanceTable( page, editor );

	const guidance = page.getByText( GUIDANCE );
	const guidanceTarget = page.locator( '.yamabiko-table-reorder-guidance-target' );
	await expect( guidance ).toBeVisible();
	await expect( guidanceTarget ).toBeVisible();
	await expect( guidanceTarget ).toHaveCSS( 'box-shadow', /2px inset$/ );
	await expect( guidanceTarget.getByRole( 'button', { name: ROW_BUTTON } ) ).toBeVisible();
	await expect( guidanceTarget.getByRole( 'button', { name: COLUMN_BUTTON } ) ).toBeVisible();
	await expect( guidanceTarget.getByRole( 'button', { name: FORM_BUTTON } ) ).toBeVisible();

	await page.getByRole( 'button', { name: CLOSE_GUIDANCE } ).click();
	await expect( guidance ).toBeHidden();
	await expect( guidanceTarget ).toHaveCount( 0 );

	await insertGuidanceTable( page, editor );
	await expect( page.getByRole( 'button', { name: ROW_BUTTON } ) ).toBeVisible();
	await expect( guidance ).toBeHidden();
	await expect( guidanceTarget ).toHaveCount( 0 );
} );

/**
 * 並び替え入口の選択でも初回案内が終了し、表示済み状態が保持されることを確認する。
 *
 * 事前条件:
 * - PC環境の並び替え初回案内が未確認である。
 *
 * 操作:
 * - Tableを表示して初回案内を確認する。
 * - 並び替え入口を選択する。
 * - 別のTableを表示する。
 *
 * 期待結果:
 * - 並び替え入口を選択すると初回案内が終了する。
 * - 別のTableでは初回案内が再表示されない。
 */
test( 'when first-use guidance is completed by a reorder entry, should end the guidance and keep it acknowledged', async ( {
	admin,
	page,
	editor,
} ) => {
	await admin.createNewPost();
	await setGuidancePreferences( page, false );
	await insertGuidanceTable( page, editor );

	const guidance = page.getByText( GUIDANCE );
	const guidanceTarget = page.locator( '.yamabiko-table-reorder-guidance-target' );
	const entry = page.getByRole( 'button', { name: ROW_BUTTON } );
	await expect( guidance ).toBeVisible();
	await expect( entry ).toBeVisible();

	await entry.click();
	await expect( guidance ).toBeHidden();
	await expect( guidanceTarget ).toHaveCount( 0 );

	await insertGuidanceTable( page, editor );
	await expect( page.getByRole( 'button', { name: ROW_BUTTON } ) ).toBeVisible();
	await expect( guidance ).toBeHidden();
	await expect( guidanceTarget ).toHaveCount( 0 );
} );
