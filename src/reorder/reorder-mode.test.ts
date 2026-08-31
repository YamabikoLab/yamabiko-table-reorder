import { createReorderMode } from './reorder-mode';

describe( 'Reorder Mode', () => {
	/**
	 * Reorder Modeが通常編集から開始することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeはまだ作成されていない。
	 *
	 * 操作:
	 * - Reorder Modeを作成する。
	 *
	 * 期待結果:
	 * - 対象Tableでは行・列の入口が選択されていない。
	 * - 通常編集を開始できる。
	 */
	it( 'when reorder mode is created, should start in edit mode', () => {
		const mode = createReorderMode();

		expect( mode.isSelected( 'row', 'table-a' ) ).toBe( false );
		expect( mode.isSelected( 'column', 'table-a' ) ).toBe( false );
		expect( mode.isEditingAllowed( 'table-a' ) ).toBe( true );
		expect( mode.rowReorder.isActive( 'table-a' ) ).toBe( false );
	} );

	/**
	 * 行並び替え入口を選択すると、そのTableで行並び替えだけが有効になることを確認する。
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
		const mode = createReorderMode();

		mode.select( 'row', 'table-a' );

		expect( mode.isSelected( 'row', 'table-a' ) ).toBe( true );
		expect( mode.isSelected( 'column', 'table-a' ) ).toBe( false );
		expect( mode.isEditingAllowed( 'table-a' ) ).toBe( false );
		expect( mode.rowReorder.isActive( 'table-a' ) ).toBe( true );
		expect( mode.rowReorder.isActive( 'table-b' ) ).toBe( false );
	} );

	/**
	 * 別方向の入口を選択すると、同じTableで選択方向だけが切り替わることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - Table Aの列並び替え入口を選択する。
	 *
	 * 期待結果:
	 * - 行入口は非選択となり、列入口だけが選択状態になる。
	 * - 行と列が同時に有効な状態を作らない。
	 */
	it( 'when another reorder kind is selected, should switch exclusively to that kind', () => {
		const mode = createReorderMode();
		mode.select( 'row', 'table-a' );

		mode.select( 'column', 'table-a' );

		expect( mode.isSelected( 'row', 'table-a' ) ).toBe( false );
		expect( mode.isSelected( 'column', 'table-a' ) ).toBe( true );
		expect( mode.rowReorder.isActive( 'table-a' ) ).toBe( false );
	} );

	/**
	 * 選択中の入口を再選択すると通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - Table Aの行並び替え入口をもう一度選択する。
	 *
	 * 期待結果:
	 * - 行入口は非選択になる。
	 * - Table Aで通常編集を開始できる。
	 */
	it( 'when the active reorder entry is selected again, should return to edit mode', () => {
		const mode = createReorderMode();
		mode.select( 'row', 'table-a' );

		mode.select( 'row', 'table-a' );

		expect( mode.isSelected( 'row', 'table-a' ) ).toBe( false );
		expect( mode.isEditingAllowed( 'table-a' ) ).toBe( true );
		expect( mode.rowReorder.isActive( 'table-a' ) ).toBe( false );
	} );

	/**
	 * 別Tableへ操作対象が移った場合は並び替えモードを終了することを確認する。
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
		const mode = createReorderMode();
		mode.select( 'row', 'table-a' );

		mode.observeTable( 'table-b' );

		expect( mode.rowReorder.isActive( 'table-a' ) ).toBe( false );
		expect( mode.isEditingAllowed( 'table-a' ) ).toBe( true );
		expect( mode.isEditingAllowed( 'table-b' ) ).toBe( true );
	} );

	/**
	 * 同じTableのUI表現が再生成されても、Tableの操作対象が変わらない限りモードを維持できることを確認する。
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
		const mode = createReorderMode();
		mode.select( 'row', 'table-a' );

		mode.observeTable( 'table-a' );

		expect( mode.rowReorder.isActive( 'table-a' ) ).toBe( true );
	} );

	/**
	 * Reorder Modeを明示的に終了すると通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効である。
	 *
	 * 操作:
	 * - Reorder Modeを終了する。
	 *
	 * 期待結果:
	 * - Table Aの行並び替えは無効になる。
	 * - Table Aで通常編集を開始できる。
	 */
	it( 'when reorder mode exits, should return to edit mode', () => {
		const mode = createReorderMode();
		mode.select( 'row', 'table-a' );

		mode.exit();

		expect( mode.rowReorder.isActive( 'table-a' ) ).toBe( false );
		expect( mode.isEditingAllowed( 'table-a' ) ).toBe( true );
	} );

	/**
	 * 状態が変化した場合だけ購読者へ通知されることを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeの状態変更を購読している。
	 *
	 * 操作:
	 * - Table Aの行並び替えを選択し、同じTableを観測した後に購読を解除して終了する。
	 *
	 * 期待結果:
	 * - 意味のある状態変更だけが通知される。
	 * - 購読解除後は通知されない。
	 */
	it( 'when state changes, should notify subscribers only for meaningful changes', () => {
		const mode = createReorderMode();
		const listener = jest.fn();
		const unsubscribe = mode.subscribe( listener );

		mode.select( 'row', 'table-a' );
		mode.observeTable( 'table-a' );
		unsubscribe();
		mode.exit();

		expect( listener ).toHaveBeenCalledTimes( 1 );
		expect( mode.getRevision() ).toBe( 2 );
	} );
} );
