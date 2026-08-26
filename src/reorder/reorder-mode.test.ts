/**
 * テーブル操作が通常編集から始まり、行・列の並び替えを排他的に切り替えられることを確認する。
 */

import {
	createReorderMode,
	enterReorderMode,
	exitReorderMode,
	getReorderKind,
} from './reorder-mode';

describe( 'Reorder Mode', () => {
	/**
	 * 概要: テーブル操作の初期状態では並び替えを有効にしないことを確認する。
	 *
	 * 事前条件:
	 * - 操作状態はまだ生成されていない。
	 *
	 * 操作:
	 * - createReorderMode()で初期状態を生成する。
	 *
	 * 期待結果:
	 * - 通常編集を表す`edit`が返される。
	 */
	it( 'when reorder mode is created, should start in edit mode', () => {
		expect( createReorderMode() ).toBe( 'edit' );
	} );

	/**
	 * 概要: 行並び替えを選択したとき、行だけを並び替え対象にできることを確認する。
	 *
	 * 事前条件:
	 * - 現在は通常編集状態である。
	 *
	 * 操作:
	 * - 行並び替えへ切り替える。
	 *
	 * 期待結果:
	 * - 操作状態と並び替え種別がともに`row`になる。
	 */
	it( 'when row reorder is selected, should expose row kind', () => {
		const mode = enterReorderMode( 'row' );

		expect( mode ).toBe( 'row' );
		expect( getReorderKind( mode ) ).toBe( 'row' );
	} );

	/**
	 * 概要: 列並び替えを選択したとき、行並び替えを同時に有効なまま残さないことを確認する。
	 *
	 * 事前条件:
	 * - 行または列の並び替えへ切り替えられる状態である。
	 *
	 * 操作:
	 * - 列並び替えへ切り替える。
	 *
	 * 期待結果:
	 * - 操作状態と並び替え種別がともに`column`となり、列だけが有効になる。
	 */
	it( 'when column reorder is selected, should expose column kind', () => {
		const mode = enterReorderMode( 'column' );

		expect( mode ).toBe( 'column' );
		expect( getReorderKind( mode ) ).toBe( 'column' );
	} );

	/**
	 * 概要: 並び替え終了後は通常編集へ戻り、新しい並び替えを開始できる種別が残らないことを確認する。
	 *
	 * 事前条件:
	 * - 行または列の並び替えが有効である。
	 *
	 * 操作:
	 * - exitReorderMode()で並び替えを終了する。
	 *
	 * 期待結果:
	 * - 操作状態は`edit`となり、並び替え種別は`null`になる。
	 */
	it( 'when reorder mode exits, should return to edit mode', () => {
		const mode = exitReorderMode();

		expect( mode ).toBe( 'edit' );
		expect( getReorderKind( mode ) ).toBeNull();
	} );
} );
