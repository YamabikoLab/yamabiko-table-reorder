import { expect, test } from '@wordpress/e2e-test-utils-playwright';

/**
 * WordPress管理画面でYamabiko Table Reorderが有効なプラグインとして認識されていることを確認する。
 *
 * 操作:
 * - 有効なプラグイン一覧を表示する。
 *
 * 期待結果:
 * - Yamabiko Table Reorderが有効なプラグイン一覧に表示される。
 */
test( 'when the active plugins screen is opened, should show Yamabiko Table Reorder as active', async ( {
	admin,
	page,
} ) => {
	await admin.visitAdminPage( 'plugins.php', 'plugin_status=active' );

	await expect( page.getByText( 'Yamabiko Table Reorder', { exact: true } ) ).toBeVisible();
} );
