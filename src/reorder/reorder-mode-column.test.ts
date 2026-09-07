/**
 * Reorder ModeがColumn Reorderへ提供する内部仕様を確認する。
 *
 * Column DnD Interactionから利用する公開境界だけを通して、列並び替えの有効状態とDnD終了後LifecycleをTable単位で検証する。
 */

import { columnReorderMode, reorderMode } from '@/reorder/reorder-mode';

const RESET_TABLE_IDENTITY = '__column-reorder-mode-test-reset__';

/** Reorder Modeをテスト間で通常編集状態へ戻す。 */
const resetReorderMode = (): void => {
	reorderMode.observeTable( RESET_TABLE_IDENTITY );
	reorderMode.notifyTableInactive( RESET_TABLE_IDENTITY );
};

describe( 'Column Reorder Mode contract', () => {
	beforeEach( () => {
		resetReorderMode();
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * 概要:
	 * - Column Reorder向け内部仕様が、対象Tableで列並び替えが有効な場合だけtrueを返すことを確認する。
	 * 事前条件:
	 * - Reorder Modeは通常編集状態である。
	 * 操作:
	 * - Table Aで列並び替えを選択し、Table AとTable Bの有効状態を確認する。
	 * 期待結果:
	 * - Table Aだけtrueを返し、別Tableはfalseを返す。
	 */
	it( 'when column mode is active for a table, should report active only for that table', () => {
		reorderMode.select( 'column', 'table-a' );

		expect( columnReorderMode.isActive( 'table-a' ) ).toBe( true );
		expect( columnReorderMode.isActive( 'table-b' ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - DnD終了後も同一Tableで列並び替えを継続できる場合は現在モードを維持することを確認する。
	 * 事前条件:
	 * - Table Aで列並び替えが有効である。
	 * 操作:
	 * - Table AのDnD終了後継続可否としてtrueを通知する。
	 * 期待結果:
	 * - Table Aの列並び替えが有効なまま維持される。
	 */
	it( 'when DnD can continue for the active column table, should keep column mode active', () => {
		reorderMode.select( 'column', 'table-a' );

		columnReorderMode.resolveAfterDnd( 'table-a', true );

		expect( columnReorderMode.isActive( 'table-a' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - DnD終了後に同一Tableで列並び替えを継続できない場合は通常編集へ戻ることを確認する。
	 * 事前条件:
	 * - Table Aで列並び替えが有効である。
	 * 操作:
	 * - Table AのDnD終了後継続可否としてfalseを通知する。
	 * 期待結果:
	 * - Table Aの列並び替えが終了し、通常編集になる。
	 */
	it( 'when DnD cannot continue for the active column table, should return to edit mode', () => {
		reorderMode.select( 'column', 'table-a' );

		columnReorderMode.resolveAfterDnd( 'table-a', false );

		expect( columnReorderMode.isActive( 'table-a' ) ).toBe( false );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
	} );

	/**
	 * 概要:
	 * - 終了済みDnDとは別Tableまたは別方向へ遷移済みの場合は現在のReorder Modeを上書きしないことを確認する。
	 * 事前条件:
	 * - Table Aの列DnD終了結果を受け取る前に、Table Bの行並び替えへ遷移している。
	 * 操作:
	 * - 終了済みTable Aの継続可否falseを通知する。
	 * 期待結果:
	 * - Table Bの行並び替えを維持する。
	 */
	it( 'when another table or reorder kind is already active after DnD, should keep the current mode', () => {
		reorderMode.select( 'column', 'table-a' );
		reorderMode.select( 'row', 'table-b' );

		columnReorderMode.resolveAfterDnd( 'table-a', false );

		expect( reorderMode.getMode( 'table-b' ) ).toBe( 'row' );
	} );
} );
