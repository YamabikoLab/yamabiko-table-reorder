/**
 * Reorder ModeがRow Reorderへ提供する内部仕様を確認する。
 *
 * 先のPhaseから実利用する公開境界だけを通して、行並び替えの有効状態とDnD終了後LifecycleをTable単位で検証する。
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

	/**
	 * 概要:
	 * - DnD終了後も同一Tableで行並び替えを継続できる場合は、現在の行並び替えモードを維持することを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - Table AのDnD終了後継続可否としてtrueを通知する。
	 *
	 * 期待結果:
	 * - Table Aの行並び替えが有効なまま維持される。
	 */
	it( 'when DnD can continue for the active row table, should keep row mode active', () => {
		reorderMode.select( 'row', 'table-a' );

		rowReorderMode.resolveAfterDnd( 'table-a', true );

		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - DnD終了後に同一Tableで行並び替えを継続できない場合は、通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - Table AのDnD終了後継続可否としてfalseを通知する。
	 *
	 * 期待結果:
	 * - Table Aの行並び替えが終了し、通常編集になる。
	 */
	it( 'when DnD cannot continue for the active row table, should return to edit mode', () => {
		reorderMode.select( 'row', 'table-a' );

		rowReorderMode.resolveAfterDnd( 'table-a', false );

		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( false );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
	} );

	/**
	 * 概要:
	 * - DnD終了前に通常編集へ遷移済みの場合は、過去のDnD結果で行並び替えを復元しないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aで開始した行並び替えは、DnD終了結果を受け取る前に通常編集へ戻っている。
	 *
	 * 操作:
	 * - 終了済みDnDからTable Aの継続可否trueを通知する。
	 *
	 * 期待結果:
	 * - 通常編集を維持し、Table Aの行並び替えを再設定しない。
	 */
	it( 'when edit mode is already active after DnD, should not restore row mode', () => {
		reorderMode.select( 'row', 'table-a' );
		reorderMode.select( 'row', 'table-a' );

		rowReorderMode.resolveAfterDnd( 'table-a', true );

		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
	} );

	/**
	 * 概要:
	 * - 終了済みDnDとは別Tableまたは別方向へ遷移済みの場合は、現在のReorder Modeを上書きしないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aの行DnD終了結果を受け取る前に、Table Bの列並び替えへ遷移している。
	 *
	 * 操作:
	 * - 終了済みTable Aの継続可否falseを通知する。
	 *
	 * 期待結果:
	 * - Table Bの列並び替えを維持する。
	 */
	it( 'when another table or reorder kind is already active after DnD, should keep the current mode', () => {
		reorderMode.select( 'row', 'table-a' );
		reorderMode.select( 'column', 'table-b' );

		rowReorderMode.resolveAfterDnd( 'table-a', false );

		expect( reorderMode.getMode( 'table-b' ) ).toBe( 'column' );
	} );
} );
