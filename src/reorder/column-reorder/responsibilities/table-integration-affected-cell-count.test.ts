/**
 * 列専用Table Integrationが、並び替えで表示位置が変わる論理範囲に含まれる物理セル数を算出することを確認する。
 */

import { columnTableIntegration } from './table-integration';
import {
	createColumnReorderTestTable,
	setColumnReorderTestTables,
	type ColumnReorderTestTableRow,
} from './table-integration.test-utils';

/* @wordpress/block-editorはJest非対応のESMを経由するため、Store境界だけを実@wordpress/dataへ登録した最小実装へ置き換える。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './table-integration.test-utils' ).columnReorderTestBlockEditorStore,
} ) );

type TestTableAttributes = {
	body: ColumnReorderTestTableRow[];
	head?: ColumnReorderTestTableRow[];
	foot?: ColumnReorderTestTableRow[];
};

/**
 * 指定したTable sectionを持つ現在Tableを登録する。
 *
 * @param attributes 現在Tableへ登録するsection属性。
 */
const setCurrentTable = ( attributes: TestTableAttributes ): void => {
	setColumnReorderTestTables( [
		{
			...createColumnReorderTestTable( 'table-a', attributes.body, attributes.head ),
			attributes,
		},
	] );
};

describe( 'Column Table Integration affected cell count', () => {
	beforeEach( () => {
		setColumnReorderTestTables( [] );
	} );

	afterEach( () => {
		setColumnReorderTestTables( [] );
	} );

	/**
	 * 列移動の影響範囲では、結合セルを論理列数へ展開せず1つの物理セルとして数えることを確認する。
	 *
	 * 事前条件:
	 * - 4論理列のTableにhead、body、footがあり、headには2列結合セルが1つ存在する。
	 * - 4列目を先頭へ移動するため全論理列が表示位置変更範囲に入る。
	 *
	 * 操作:
	 * - 更新対象セル数を取得する。
	 *
	 * 期待結果:
	 * - headの3物理セル、bodyの4物理セル、footの4物理セルを合計した11が返る。
	 */
	it( 'when a column move spans the table width, should count merged cells once as physical cells', () => {
		setCurrentTable( {
			head: [ { cells: [ {}, { colspan: 2 }, {} ] } ],
			body: [ { cells: [ {}, {}, {}, {} ] } ],
			foot: [ { cells: [ {}, {}, {}, {} ] } ],
		} );

		expect(
			columnTableIntegration.getAffectedCellCount( {
				clientId: 'table-a',
				sourceColumnIndex: 3,
				destinationBoundaryIndex: 0,
			} )
		).toBe( 11 );
	} );

	/**
	 * 結合セルを分断する移動では更新対象セル数を提供しないことを確認する。
	 *
	 * 事前条件:
	 * - 2列結合セルの内部境界が移動先として指定される。
	 *
	 * 操作:
	 * - 更新対象セル数を取得する。
	 *
	 * 期待結果:
	 * - 安全な列移動として解釈できないためnullが返る。
	 */
	it( 'when the destination splits a merged cell, should return null', () => {
		setCurrentTable( {
			body: [ { cells: [ {}, { colspan: 2 }, {} ] } ],
		} );

		expect(
			columnTableIntegration.getAffectedCellCount( {
				clientId: 'table-a',
				sourceColumnIndex: 3,
				destinationBoundaryIndex: 2,
			} )
		).toBeNull();
	} );
} );
