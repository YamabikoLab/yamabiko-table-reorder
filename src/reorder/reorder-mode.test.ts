import { createReorderMode } from './reorder-mode';

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
	 * - 現在状態は通常編集モードを表す`edit`になる。
	 * - 行・列の並び替え種別は存在しない。
	 */
	it( 'when reorder mode is created, should start in edit mode', () => {
		const mode = createReorderMode();

		expect( mode.getState() ).toBe( 'edit' );
		expect( mode.getReorderKind() ).toBeNull();
	} );

	/**
	 * 行並び替えを選択した場合に同じReorder Modeの現在状態が行へ切り替わることを確認する。
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
		const mode = createReorderMode();

		mode.enter( 'row' );

		expect( mode.getState() ).toBe( 'row' );
		expect( mode.getReorderKind() ).toBe( 'row' );
	} );

	/**
	 * 列並び替えを選択した場合に同じReorder Modeの現在状態が列へ切り替わることを確認する。
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
		const mode = createReorderMode();

		mode.enter( 'column' );

		expect( mode.getState() ).toBe( 'column' );
		expect( mode.getReorderKind() ).toBe( 'column' );
	} );

	/**
	 * 別方向の入口を選択した場合に同じ現在状態が選択された側へ切り替わることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモードが有効である。
	 *
	 * 操作:
	 * - 同じReorder Modeで列並び替えモードを選択する。
	 *
	 * 期待結果:
	 * - 現在状態は`column`になり、行と列が同時に有効な状態を作らない。
	 */
	it( 'when another reorder kind is selected, should switch to the selected mode', () => {
		const mode = createReorderMode();
		mode.enter( 'row' );

		expect( mode.getState() ).toBe( 'row' );
		expect( mode.getReorderKind() ).toBe( 'row' );

		mode.enter( 'column' );

		expect( mode.getState() ).toBe( 'column' );
		expect( mode.getReorderKind() ).toBe( 'column' );
	} );

	/**
	 * 並び替えモードを終了すると同じReorder Modeの現在状態が通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモードが有効である。
	 *
	 * 操作:
	 * - 同じReorder Modeでexit()を実行する。
	 *
	 * 期待結果:
	 * - 現在状態は通常編集モードを表す`edit`へ戻る。
	 * - 行・列の並び替え種別は存在しない。
	 */
	it( 'when reorder mode exits, should return to edit mode', () => {
		const mode = createReorderMode();
		mode.enter( 'row' );

		mode.exit();

		expect( mode.getState() ).toBe( 'edit' );
		expect( mode.getReorderKind() ).toBeNull();
	} );
} );
