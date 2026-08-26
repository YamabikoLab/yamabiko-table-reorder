/**
 * Reorder Modeの初期状態、排他的な種別切り替え、終了LifecycleがContractどおりであることを確認する。
 */

import {
	createReorderMode,
	enterReorderMode,
	exitReorderMode,
	getReorderKind,
} from './reorder-mode';

describe( 'Reorder Mode', () => {
	/**
	 * 概要: Table操作が通常編集から始まり、並び替えを暗黙に有効化しないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeはまだ生成されていない。
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
	 * 概要: 行並び替えを選択したとき、DnDが行だけを対象にできる状態になることを確認する。
	 *
	 * 事前条件:
	 * - 現在は通常編集状態である。
	 *
	 * 操作:
	 * - rowのReorder Modeへ切り替える。
	 *
	 * 期待結果:
	 * - ModeとDnDへ公開するReorder Kindがともに`row`になる。
	 */
	it( 'when row reorder is selected, should expose row kind', () => {
		const mode = enterReorderMode( 'row' );

		expect( mode ).toBe( 'row' );
		expect( getReorderKind( mode ) ).toBe( 'row' );
	} );

	/**
	 * 概要: 並び替え種別を切り替えたとき、以前の種別を同時に有効なまま残さないことを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えを選択できる状態である。
	 *
	 * 操作:
	 * - columnのReorder Modeへ切り替える。
	 *
	 * 期待結果:
	 * - ModeとDnDへ公開するReorder Kindがともに`column`となり、列だけが有効になる。
	 */
	it( 'when column reorder is selected, should expose column kind', () => {
		const mode = enterReorderMode( 'column' );

		expect( mode ).toBe( 'column' );
		expect( getReorderKind( mode ) ).toBe( 'column' );
	} );

	/**
	 * 概要: 並び替え終了後は通常編集へ戻り、新しいDnDを開始できる種別が残らないことを確認する。
	 *
	 * 事前条件:
	 * - 行または列の並び替えモードが有効である。
	 *
	 * 操作:
	 * - exitReorderMode()で並び替えモードを終了する。
	 *
	 * 期待結果:
	 * - Modeは`edit`となり、DnDへ公開するReorder Kindは`null`になる。
	 */
	it( 'when reorder mode exits, should return to edit mode', () => {
		const mode = exitReorderMode();

		expect( mode ).toBe( 'edit' );
		expect( getReorderKind( mode ) ).toBeNull();
	} );
} );
