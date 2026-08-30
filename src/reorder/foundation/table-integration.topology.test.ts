/**
 * Table Integrationが不成立なTable topologyを別の論理配置へ補正せず、利用不能として扱うことを確認する。
 *
 * 先行する縦結合との衝突、論理行幅の不一致、Table区画を越える縦結合を対象に、
 * 外部Tableデータを安全に共通Table構造へ適応できない場合の境界契約を確認する。
 */
import { createTableIntegration } from './table-integration';

describe( 'Table Integration topology validation', () => {
	/**
	 * 横結合セルが先行する縦結合セルの占有列と途中で衝突する場合に、別の列へ移して補正しないことを確認する。
	 *
	 * 事前条件:
	 * - 1行目の論理列1は縦結合によって2行目まで占有されている。
	 * - 2行目の先頭物理セルは論理列0から2列を占有しようとする。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - 横結合セルを右側の空き列へ移して別のTable構造を作らず、nullを返す。
	 */
	it( 'when a horizontal span would cross a row-spanned column, should return null', () => {
		const integration = createTableIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {}, { rowspan: 2 }, {} ] }, { cells: [ { colspan: 2 } ] } ],
				},
			} ),
		} );

		expect( integration.getStructure( 'overlap-client-id' ) ).toBeNull();
	} );

	/**
	 * 同じTable区画の論理行幅が一致しない場合に、不完全なTable構造を返さないことを確認する。
	 *
	 * 事前条件:
	 * - bodyの1行目は3論理列である。
	 * - bodyの2行目は2論理列しか持たない。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - 行幅を推測して補完せず、nullを返す。
	 */
	it( 'when logical row widths differ, should return null', () => {
		const integration = createTableIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {}, {}, {} ] }, { cells: [ {}, {} ] } ],
				},
			} ),
		} );

		expect( integration.getStructure( 'row-width-client-id' ) ).toBeNull();
	} );

	/**
	 * 縦結合セルが所属するTable区画の終端を越える場合に、不完全な占有範囲を受け入れないことを確認する。
	 *
	 * 事前条件:
	 * - bodyは1行だけ存在する。
	 * - bodyのセルが2行を占有するrowspanを持つ。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - 存在しない後続行まで占有する構造を返さず、nullを返す。
	 */
	it( 'when a row span exceeds the section boundary, should return null', () => {
		const integration = createTableIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { rowspan: 2 }, {} ] } ],
				},
			} ),
		} );

		expect( integration.getStructure( 'section-boundary-client-id' ) ).toBeNull();
	} );
} );
