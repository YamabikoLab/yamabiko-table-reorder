import {
	createReorderMode,
	enterReorderMode,
	exitReorderMode,
	getReorderDirection,
} from './reorder-mode';

describe( 'Reorder Mode', () => {
	/**
	 * Reorder Modeが通常編集状態から開始することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeはまだ生成されていない。
	 *
	 * 操作:
	 * - createReorderMode()を実行する。
	 *
	 * 期待結果:
	 * - `edit`が返される。
	 */
	it( 'when reorder mode is created, should start in edit mode', () => {
		expect( createReorderMode() ).toBe( 'edit' );
	} );

	/**
	 * 行並び替えを選択した場合に行だけが有効になることを確認する。
	 *
	 * 事前条件:
	 * - 現在状態は通常編集である。
	 *
	 * 操作:
	 * - row方向のReorder Modeへ切り替える。
	 *
	 * 期待結果:
	 * - 現在状態とDnD方向がどちらも`row`になる。
	 */
	it( 'when row reorder is selected, should expose row direction', () => {
		const mode = enterReorderMode( 'row' );

		expect( mode ).toBe( 'row' );
		expect( getReorderDirection( mode ) ).toBe( 'row' );
	} );

	/**
	 * 行から列へ切り替えた場合に列だけが有効になることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモードが有効である。
	 *
	 * 操作:
	 * - column方向のReorder Modeへ切り替える。
	 *
	 * 期待結果:
	 * - 現在状態とDnD方向がどちらも`column`になる。
	 */
	it( 'when column reorder is selected, should expose column direction', () => {
		const mode = enterReorderMode( 'column' );

		expect( mode ).toBe( 'column' );
		expect( getReorderDirection( mode ) ).toBe( 'column' );
	} );

	/**
	 * 並び替えモード終了後にDnD方向がなくなることを確認する。
	 *
	 * 事前条件:
	 * - 行または列の並び替えモードが有効である。
	 *
	 * 操作:
	 * - exitReorderMode()を実行する。
	 *
	 * 期待結果:
	 * - 通常編集状態へ戻り、DnD方向は`null`になる。
	 */
	it( 'when reorder mode exits, should return to edit mode', () => {
		const mode = exitReorderMode();

		expect( mode ).toBe( 'edit' );
		expect( getReorderDirection( mode ) ).toBeNull();
	} );
} );
