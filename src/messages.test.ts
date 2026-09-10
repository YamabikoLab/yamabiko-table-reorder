/**
 * 利用者向け文言の翻訳境界が、主要な表示文言と大規模反映の移動内容を正しく提供することを確認する。
 */

import {
	getLargeColumnReorderMoveSummary,
	getLargeRowReorderMoveSummary,
	PLUGIN_NAME,
} from './messages';

describe( 'User-facing messages', () => {
	/**
	 * プラグイン名が翻訳境界から利用できることを確認する。
	 *
	 * 期待結果:
	 * - プラグイン名が既定の英語表記で取得できる。
	 */
	it( 'when the plugin name is loaded, should keep it available to the i18n pipeline', () => {
		expect( PLUGIN_NAME ).toBe( 'Yamabiko Table Reorder' );
	} );

	/**
	 * 大規模な行移動の確認内容を利用者向け位置で表示できることを確認する。
	 *
	 * 操作:
	 * - 1000行目から2行目への移動文言を取得する。
	 *
	 * 期待結果:
	 * - 移動元と移動先が一つの文言として表示される。
	 */
	it( 'when row positions are provided, should format the large row move summary', () => {
		expect( getLargeRowReorderMoveSummary( 1000, 2 ) ).toBe( 'Row 1000 → 2' );
	} );

	/**
	 * 大規模な列移動の確認内容を利用者向け位置で表示できることを確認する。
	 *
	 * 操作:
	 * - 10列目から4列目への移動文言を取得する。
	 *
	 * 期待結果:
	 * - 移動元と移動先が一つの文言として表示される。
	 */
	it( 'when column positions are provided, should format the large column move summary', () => {
		expect( getLargeColumnReorderMoveSummary( 10, 4 ) ).toBe( 'Column 10 → 4' );
	} );
} );
