/**
 * 利用者向け文言の翻訳境界が、主要な表示文言と大規模反映の移動内容を正しく提供することを確認する。
 */

import {
	getColumnDndLayoutUnavailableMessage,
	getLargeColumnReorderMoveSummary,
	getLargeRowReorderMoveSummary,
	getRfApplyFailureMessage,
	getRfColumnReorderSuccessAnnouncement,
	getRfRowReorderSuccessAnnouncement,
	getColumnMergedRangeMessage,
	getRowMergedRangeMessage,
	PLUGIN_NAME,
} from './messages';

describe( 'User-facing messages', () => {
	/**
	 * RFの確定した行・列移動結果を支援技術向け文言へ変換できることを確認する。
	 *
	 * 事前条件:
	 * - RF Applyが行または列の移動前位置と反映後位置を確定している。
	 *
	 * 操作:
	 * - 確定済みの移動前位置と反映後位置から行・列の成功文言を取得する。
	 *
	 * 期待結果:
	 * - Target指定ではなく確定した移動前位置と反映後位置が文言へ反映される。
	 */
	it( 'when final RF positions are provided, should format row and column success announcements', () => {
		expect( getRfRowReorderSuccessAnnouncement( 3, 5 ) ).toBe( 'Moved row 3 to position 5.' );
		expect( getRfColumnReorderSuccessAnnouncement( 2, 4 ) ).toBe( 'Moved column 2 to position 4.' );
	} );

	/**
	 * RF反映失敗時にTable未変更まで判断できる文言を提供することを確認する。
	 *
	 * 事前条件:
	 * - RF Applyが失敗として確定している。
	 *
	 * 操作:
	 * - RF反映失敗メッセージを取得する。
	 *
	 * 期待結果:
	 * - 並び替えを完了できなかったこととTable未変更を一つの文言で確認できる。
	 */
	it( 'when RF apply fails, should explain that the reorder could not complete and the table stayed unchanged', () => {
		expect( getRfApplyFailureMessage() ).toBe(
			'The reorder could not be completed. The table was not changed.'
		);
	} );

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
	 * 現在表示でColumn DnDを利用できない場合の代替操作案内を確認する。
	 *
	 * 期待結果:
	 * - 現在表示で利用できないことと、RFで列を並び替えられることが一つの文言で取得できる。
	 */
	it( 'when column drag layout is unavailable, should provide the form alternative message', () => {
		expect( getColumnDndLayoutUnavailableMessage() ).toBe(
			'Column drag reordering is unavailable in the current view. You can reorder columns using the form.'
		);
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

	/**
	 * 原因セルが単一行で複数列を占有する場合の行方向文言を確認する。
	 *
	 * 操作:
	 * - 2行目・3〜5列目を占有する原因セルの文言を取得する。
	 *
	 * 期待結果:
	 * - 行番号と列範囲が正しいplaceholder順で表示される。
	 */
	it( 'when a row blocking merged cell spans one row and multiple columns, should format its row and column range', () => {
		expect( getRowMergedRangeMessage( 2, 2, 3, 5 ) ).toBe(
			'A merged cell in row 2 spanning columns 3–5 prevents this move.'
		);
	} );

	/**
	 * 原因セルが複数行の単一列を占有する場合の行方向文言を確認する。
	 *
	 * 操作:
	 * - 2〜4行目・3列目を占有する原因セルの文言を取得する。
	 *
	 * 期待結果:
	 * - 行範囲と列番号が正しいplaceholder順で表示される。
	 */
	it( 'when a row blocking merged cell spans multiple rows and one column, should format its row range and column', () => {
		expect( getRowMergedRangeMessage( 2, 4, 3, 3 ) ).toBe(
			'A merged cell spanning rows 2–4 in column 3 prevents this move.'
		);
	} );

	/**
	 * 原因セルが複数行・複数列を占有する場合の行方向文言を確認する。
	 *
	 * 操作:
	 * - 2〜4行目・3〜5列目を占有する原因セルの文言を取得する。
	 *
	 * 期待結果:
	 * - 行範囲と列範囲が正しいplaceholder順で表示される。
	 */
	it( 'when a row blocking merged cell spans multiple rows and columns, should format both ranges', () => {
		expect( getRowMergedRangeMessage( 2, 4, 3, 5 ) ).toBe(
			'A merged cell spanning rows 2–4 and columns 3–5 prevents this move.'
		);
	} );

	/**
	 * tbodyの原因セルを列方向でも通常の行・列位置として表示することを確認する。
	 *
	 * 操作:
	 * - tbodyの2〜4行目・3〜5列目を占有する原因セルの文言を取得する。
	 *
	 * 期待結果:
	 * - section名を付けず、tbody内の行範囲と列範囲が表示される。
	 */
	it( 'when a column blocking merged cell is in the body, should format the body row and column range', () => {
		expect( getColumnMergedRangeMessage( 'body', 2, 4, 3, 5 ) ).toBe(
			'A merged cell spanning rows 2–4 and columns 3–5 prevents this move.'
		);
	} );

	/**
	 * ヘッダー内の原因セル位置が本文と区別できることを確認する。
	 *
	 * 操作:
	 * - ヘッダー1行目・2〜3列目を占有する原因セルの文言を取得する。
	 *
	 * 期待結果:
	 * - header領域名、行番号、列範囲が正しいplaceholder順で表示される。
	 */
	it( 'when a column blocking merged cell is in one header row, should include the header section', () => {
		expect( getColumnMergedRangeMessage( 'head', 1, 1, 2, 3 ) ).toBe(
			'A merged cell in header row 1 spanning columns 2–3 prevents this move.'
		);
	} );

	/**
	 * フッター内で複数行を占有する原因セル位置が本文と区別できることを確認する。
	 *
	 * 操作:
	 * - フッター2〜3行目・4〜5列目を占有する原因セルの文言を取得する。
	 *
	 * 期待結果:
	 * - footer領域名、行範囲、列範囲が正しいplaceholder順で表示される。
	 */
	it( 'when a column blocking merged cell spans footer rows, should include the footer section', () => {
		expect( getColumnMergedRangeMessage( 'foot', 2, 3, 4, 5 ) ).toBe(
			'A merged cell spanning footer rows 2–3 and columns 4–5 prevents this move.'
		);
	} );
} );
