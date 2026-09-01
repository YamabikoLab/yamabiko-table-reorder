/**
 * Reorder Modeの状態、Table単位のLifecycle、通常編集との排他、および購読境界を検証する。
 *
 * WordPressやReactには依存せず、実際に公開する内部仕様を通してReorder Mode単体の状態遷移を確認する。
 */

import { reorderModeIntegration, rowReorderMode } from './reorder-mode';

describe( 'Reorder Mode', () => {
	beforeEach( () => {
		reorderModeIntegration.notifyTableInactive( 'table-a' );
		reorderModeIntegration.notifyTableInactive( 'table-b' );
	} );

	/**
	 * 概要:
	 * - Reorder Modeが通常編集から開始することを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableでは並び替えモードが有効ではない。
	 *
	 * 操作:
	 * - Table Aの現在状態を公開内部仕様から確認する。
	 *
	 * 期待結果:
	 * - 対象Tableでは行・列の入口が選択されていない。
	 * - 通常編集を開始できる。
	 */
	it( 'when reorder mode is idle, should expose edit mode for the table', () => {
		expect( reorderModeIntegration.getSelectedKind( 'table-a' ) ).toBeNull();
		expect( reorderModeIntegration.isEditingAllowed( 'table-a' ) ).toBe( true );
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 行並び替え入口を選択すると、そのTableで行並び替えだけが有効になることを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは通常編集である。
	 *
	 * 操作:
	 * - Table Aの行並び替え入口を選択する。
	 *
	 * 期待結果:
	 * - Table Aでは行入口だけが選択状態になる。
	 * - Table Aの通常編集は開始できない。
	 * - Row Reorder向け内部仕様ではTable Aだけが有効になる。
	 */
	it( 'when row reorder is selected, should activate row mode for that table', () => {
		reorderModeIntegration.select( 'row', 'table-a' );

		expect( reorderModeIntegration.getSelectedKind( 'table-a' ) ).toBe( 'row' );
		expect( reorderModeIntegration.isEditingAllowed( 'table-a' ) ).toBe( false );
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );
		expect( rowReorderMode.isActive( 'table-b' ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 別方向の入口を選択すると、同じTableで選択方向だけが切り替わることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - Table Aの列並び替え入口を選択する。
	 *
	 * 期待結果:
	 * - 選択方向が列だけへ切り替わる。
	 * - 行と列が同時に有効な状態を作らない。
	 */
	it( 'when another reorder kind is selected, should switch exclusively to that kind', () => {
		reorderModeIntegration.select( 'row', 'table-a' );

		reorderModeIntegration.select( 'column', 'table-a' );

		expect( reorderModeIntegration.getSelectedKind( 'table-a' ) ).toBe( 'column' );
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 選択中の入口を再選択すると通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - Table Aの行並び替え入口をもう一度選択する。
	 *
	 * 期待結果:
	 * - 並び替え入口は非選択になる。
	 * - Table Aで通常編集を開始できる。
	 */
	it( 'when the active reorder entry is selected again, should return to edit mode', () => {
		reorderModeIntegration.select( 'row', 'table-a' );

		reorderModeIntegration.select( 'row', 'table-a' );

		expect( reorderModeIntegration.getSelectedKind( 'table-a' ) ).toBeNull();
		expect( reorderModeIntegration.isEditingAllowed( 'table-a' ) ).toBe( true );
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 別Tableへ操作対象が移った場合は並び替えモードを終了することを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - 現在操作しているTableとしてTable Bを通知する。
	 *
	 * 期待結果:
	 * - Table Aの行並び替えは無効になる。
	 * - Table AとTable Bのどちらも通常編集を開始できる。
	 */
	it( 'when operation moves to another table, should return to edit mode', () => {
		reorderModeIntegration.select( 'row', 'table-a' );

		reorderModeIntegration.observeTable( 'table-b' );

		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( false );
		expect( reorderModeIntegration.isEditingAllowed( 'table-a' ) ).toBe( true );
		expect( reorderModeIntegration.isEditingAllowed( 'table-b' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - 対象Tableが操作対象から外れた通知だけで、Reorder Mode側が終了判断を行うことを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - Table Bが操作対象から外れたことを通知した後、Table Aが操作対象から外れたことを通知する。
	 *
	 * 期待結果:
	 * - Table Bからの通知ではTable Aの並び替えモードを維持する。
	 * - Table Aからの通知で通常編集へ戻る。
	 */
	it( 'when a table becomes inactive, should exit only when it is the active reorder table', () => {
		reorderModeIntegration.select( 'row', 'table-a' );

		reorderModeIntegration.notifyTableInactive( 'table-b' );
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );

		reorderModeIntegration.notifyTableInactive( 'table-a' );
		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 同じTableのUI表現が再生成されても、Tableの操作対象が変わらない限りモードを維持できることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - 現在操作しているTableとして同じTable Aを改めて通知する。
	 *
	 * 期待結果:
	 * - Table Aの行並び替えは有効なまま維持される。
	 */
	it( 'when the same table is observed again, should preserve the active reorder mode', () => {
		reorderModeIntegration.select( 'row', 'table-a' );

		reorderModeIntegration.observeTable( 'table-a' );

		expect( rowReorderMode.isActive( 'table-a' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - 状態が変化した場合だけ購読者へ通知されることを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeの状態変更を購読している。
	 *
	 * 操作:
	 * - Table Aの行並び替えを選択し、同じTableを観測した後に購読を解除してTable Aを非操作対象として通知する。
	 *
	 * 期待結果:
	 * - 意味のある状態変更だけが通知される。
	 * - 購読解除後は通知されない。
	 */
	it( 'when state changes, should notify subscribers only for meaningful changes', () => {
		const listener = jest.fn();
		const unsubscribe = reorderModeIntegration.subscribe( listener );

		reorderModeIntegration.select( 'row', 'table-a' );
		reorderModeIntegration.observeTable( 'table-a' );
		unsubscribe();
		reorderModeIntegration.notifyTableInactive( 'table-a' );

		expect( listener ).toHaveBeenCalledTimes( 1 );
	} );
} );
