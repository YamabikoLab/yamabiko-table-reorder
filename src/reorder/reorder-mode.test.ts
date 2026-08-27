import {
	createReorderMode,
	enterReorderMode,
	exitReorderMode,
	getReorderKind,
} from './reorder-mode';

describe( 'Reorder Mode', () => {
	/**
	 * Reorder Modeが通常編集モードから開始することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeはまだ作成されていない。
	 *
	 * 操作:
	 * - createReorderMode()を実行する。
	 *
	 * 期待結果:
	 * - 通常編集モードを表す`edit`が返される。
	 * - 行・列の並び替え種別は存在しない。
	 */
	it( 'when reorder mode is created, should start in edit mode', () => {
		const mode = createReorderMode();

		expect( mode ).toBe( 'edit' );
		expect( getReorderKind( mode ) ).toBeNull();
	} );

	/**
	 * 行並び替えを選択した場合に行だけが現在の並び替え種別になることを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは通常編集モードである。
	 *
	 * 操作:
	 * - 行並び替えモードへ切り替える。
	 *
	 * 期待結果:
	 * - 現在のReorder Modeは`row`になる。
	 * - DnDで扱う並び替え種別として`row`が返される。
	 */
	it( 'when row reorder is selected, should expose row kind', () => {
		const mode = enterReorderMode( 'row' );

		expect( mode ).toBe( 'row' );
		expect( getReorderKind( mode ) ).toBe( 'row' );
	} );

	/**
	 * 列並び替えを選択した場合に列だけが現在の並び替え種別になることを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは通常編集モードである。
	 *
	 * 操作:
	 * - 列並び替えモードへ切り替える。
	 *
	 * 期待結果:
	 * - 現在のReorder Modeは`column`になる。
	 * - DnDで扱う並び替え種別として`column`が返される。
	 */
	it( 'when column reorder is selected, should expose column kind', () => {
		const mode = enterReorderMode( 'column' );

		expect( mode ).toBe( 'column' );
		expect( getReorderKind( mode ) ).toBe( 'column' );
	} );

	/**
	 * 別方向の入口を選択した場合に選択された側へ切り替えられることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモードが有効である。
	 *
	 * 操作:
	 * - 列並び替えモードを選択する。
	 *
	 * 期待結果:
	 * - 次のReorder Modeは`column`になり、行と列が同時に有効な状態を作らない。
	 */
	it( 'when another reorder kind is selected, should switch to the selected mode', () => {
		const rowMode = enterReorderMode( 'row' );
		const columnMode = enterReorderMode( 'column' );

		expect( getReorderKind( rowMode ) ).toBe( 'row' );
		expect( columnMode ).toBe( 'column' );
		expect( getReorderKind( columnMode ) ).toBe( 'column' );
	} );

	/**
	 * 並び替えモードを終了すると通常編集モードへ戻ることを確認する。
	 *
	 * 事前条件:
	 * - 行または列の並び替えモードが有効である。
	 *
	 * 操作:
	 * - exitReorderMode()を実行する。
	 *
	 * 期待結果:
	 * - 通常編集モードを表す`edit`が返される。
	 * - 行・列の並び替え種別は存在しない。
	 */
	it( 'when reorder mode exits, should return to edit mode', () => {
		const mode = exitReorderMode();

		expect( mode ).toBe( 'edit' );
		expect( getReorderKind( mode ) ).toBeNull();
	} );
} );
