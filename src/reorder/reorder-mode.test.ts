/**
 * Reorder ModeがRow Reorderへ提供する内部仕様を確認する。
 *
 * 先のPhaseから実利用する公開境界だけを通して、行並び替えの有効状態をTable単位で検証する。
 */

import { reorderMode, rowReorderMode } from '@/reorder/reorder-mode';

const RESET_TABLE_IDENTITY = '__reorder-mode-test-reset__';

const resetReorderMode = () => {
	reorderMode.observeTable( RESET_TABLE_IDENTITY );
	reorderMode.notifyTableInactive( RESET_TABLE_IDENTITY );
};

describe( 'Row Reorder Mode contract', () => {
	beforeEach( () => {
		resetReorderMode();
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * 概要:
	 * - Row Reorder向け内部仕様が、対象Tableで行並び替えが有効な場合だけtrueを返すことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは通常編集状態である。
	 *
	 * 操作:
	 * - Table Aで行並び替えを選択し、Table AとTable Bの有効状態を確認する。
	 *
	 * 期待結果:
	 * - Table Aだけtrueを返し、別Tableはfalseを返す。
	 */
	it( 'when row mode is active for a table, should report active only for that table', () => {
		reorderMode.select( 'row', 'table-a' );

		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );
		expect( rowReorderMode.isActive( 'table-b' ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 列並び替え中はRow Reorder向け内部仕様が有効にならないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは通常編集状態である。
	 *
	 * 操作:
	 * - Table Aで列並び替えを選択し、Row Reorderの有効状態を確認する。
	 *
	 * 期待結果:
	 * - Table Aでもfalseを返す。
	 */
	it( 'when column mode is active for a table, should report row reorder as inactive', () => {
		reorderMode.select( 'column', 'table-a' );

		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 通常編集へ戻った後はRow Reorder向け内部仕様が無効になることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - 選択中の行並び替え入口を再選択して通常編集へ戻す。
	 *
	 * 期待結果:
	 * - Table Aでfalseを返す。
	 */
	it( 'when active row mode is selected again, should report row reorder as inactive after returning to edit mode', () => {
		reorderMode.select( 'row', 'table-a' );
		reorderMode.select( 'row', 'table-a' );

		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( false );
	} );
} );
