/**
 * プラグイン共通メッセージとして、製品で利用する表示内容が公開されていることを確認する。
 */

import { PLUGIN_NAME } from './messages';

describe( 'plugin messages', () => {
	/**
	 * 概要: プラグイン名を翻訳可能な共通メッセージとして利用できることを確認する。
	 *
	 * 事前条件:
	 * - 共通メッセージが読み込まれている。
	 *
	 * 操作:
	 * - 公開されているPLUGIN_NAMEを参照する。
	 *
	 * 期待結果:
	 * - 製品で使用するプラグイン名`Yamabiko Table Reorder`が得られる。
	 */
	it( 'when plugin messages are loaded, should expose the translatable plugin name', () => {
		expect( PLUGIN_NAME ).toBe( 'Yamabiko Table Reorder' );
	} );
} );
