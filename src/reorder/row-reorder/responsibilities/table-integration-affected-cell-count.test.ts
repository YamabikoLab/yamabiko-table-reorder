/**
 * 行専用Table Integrationが、並び替えで表示位置が変わる範囲の物理セル数を算出することを確認する。
 */

import { rowTableIntegration } from './table-integration';
import { createRowReorderTestTable, setRowReorderTestTables } from './table-integration.test-utils';

/* @wordpress/block-editorはJest非対応のESMを経由するため、Store境界だけを実@wordpress/dataへ登録した最小実装へ置き換える。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './table-integration.test-utils' ).rowReorderTestBlockEditorStore,
} ) );

/**
 * 指定したtbodyを持つ現在Tableを登録する。
 *
 * @param body 現在Tableへ登録するtbody行集合。
 */
const setCurrentTable = ( body: Parameters< typeof createRowReorderTestTable >[ 1 ] ): void => {
	setRowReorderTestTables( [ createRowReorderTestTable( 'table-a', body ) ] );
};

describe( 'Row Table Integration affected cell count', () => {
	beforeEach( () => {
		setRowReorderTestTables( [] );
	} );

	afterEach( () => {
		setRowReorderTestTables( [] );
	} );

	/**
	 * 長距離の行移動では、移動元から挿入先までに含まれる物理セルだけを数えることを確認する。
	 *
	 * 事前条件:
	 * - tbodyの各行は2、3、1、4個の物理セルを持つ。
	 * - 最終行を2行目へ移動する。
	 *
	 * 操作:
	 * - 更新対象セル数を取得する。
	 *
	 * 期待結果:
	 * - 表示位置が変わる2〜4行目の物理セル数8が返る。
	 */
	it( 'when a row moves across multiple rows, should count physical cells only in the affected range', () => {
		setCurrentTable( [
			{ cells: [ {}, {} ] },
			{ cells: [ {}, {}, {} ] },
			{ cells: [ {} ] },
			{ cells: [ {}, {}, {}, {} ] },
		] );

		expect(
			rowTableIntegration.getAffectedCellCount( {
				clientId: 'table-a',
				sourceRowIndex: 3,
				destinationBoundaryIndex: 1,
			} )
		).toBe( 8 );
	} );

	/**
	 * Table構造を安全に解釈できない場合は更新対象セル数を推測しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Core Tableのtbody行がセル配列を持たない。
	 *
	 * 操作:
	 * - 更新対象セル数を取得する。
	 *
	 * 期待結果:
	 * - nullが返る。
	 */
	it( 'when the affected row range cannot be interpreted safely, should return null', () => {
		setRowReorderTestTables( [
			{
				...createRowReorderTestTable( 'table-a', [ { cells: [ {} ] } ] ),
				attributes: { body: [ { cells: [ {} ] }, {} ] },
			},
		] );

		expect(
			rowTableIntegration.getAffectedCellCount( {
				clientId: 'table-a',
				sourceRowIndex: 1,
				destinationBoundaryIndex: 0,
			} )
		).toBeNull();
	} );
} );
