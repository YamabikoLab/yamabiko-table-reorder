/**
 * 行専用Table Integrationについて、WordPress Store境界の外側から、対応Table Block差を漏らさず現在の行制約取得と確定済み行移動の反映を提供する内部仕様を確認する。
 */

import { subscribe } from '@wordpress/data';

import { rowTableIntegration } from './table-integration';
import {
	createRowReorderTestTable,
	getRowReorderTestTable,
	rowReorderTestBlockEditorStore,
	setRowReorderTestTables,
} from './table-integration.test-utils';

/* @wordpress/block-editorはJest非対応のESMを経由するため、Store境界だけを実@wordpress/dataへ登録した最小実装へ置き換える。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './table-integration.test-utils' ).rowReorderTestBlockEditorStore,
} ) );

/**
 * 任意の対応Block名とtbodyを持つ現在Tableを作成する。
 *
 * @param clientId Table個体を識別するclientId。
 * @param body     現在Tableへ登録するtbody行集合。
 * @param name     Table Integrationへ提示するBlock名。
 * @return Block Editor Storeへ登録するTable Block。
 */
const createTable = (
	clientId: string,
	body: Parameters< typeof createRowReorderTestTable >[ 1 ],
	name = 'core/table'
) => ( {
	...createRowReorderTestTable( clientId, body ),
	name,
} );

describe( 'Table Integration', () => {
	beforeEach( () => {
		setRowReorderTestTables( [] );
	} );

	afterEach( () => {
		setRowReorderTestTables( [] );
	} );

	/**
	 * 概要:
	 * - Core Tableの現在行数とrowspanによる分断不可境界を取得できることを確認する。
	 *
	 * 事前条件:
	 * - tbodyは4行で、2行目に3行を占有するセルが存在する。
	 * - colspanだけを持つセルも存在する。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからgetConstraints()を実行する。
	 *
	 * 期待結果:
	 * - rowCountは4になる。
	 * - rowspan内部の境界2、3だけが重複なく昇順で返る。
	 * - colspanは行方向の制約を生成しない。
	 */
	it( 'when Core Table constraints are requested, should return row count and blocked row boundaries', () => {
		setRowReorderTestTables( [
			createTable( 'table-a', [
				{ cells: [ { colspan: 2 } ] },
				{ cells: [ { rowspan: 3 }, { rowspan: 2 } ] },
				{ cells: [ {} ] },
				{ cells: [ {} ] },
			] ),
		] );

		expect( rowTableIntegration.getConstraints( 'table-a' ) ).toEqual( {
			rowCount: 4,
			blockedBoundaries: [ 2, 3 ],
		} );
	} );

	/**
	 * 概要:
	 * - Flexible Table BlockのrowSpanだけをCore Tableと同じ行制約へ変換できることを確認する。
	 *
	 * 事前条件:
	 * - tbodyは3行で、先頭行に3行を占有するセルが存在する。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからgetConstraints()を実行する。
	 *
	 * 期待結果:
	 * - Flexible Table Block固有のrowSpanが解釈され、境界1、2が返る。
	 */
	it( 'when Flexible Table Block constraints are requested, should adapt rowSpan to the same row constraints', () => {
		setRowReorderTestTables( [
			createTable(
				'table-b',
				[ { cells: [ { rowSpan: 3 } ] }, { cells: [] }, { cells: [] } ],
				'flexible-table-block/table'
			),
		] );

		expect( rowTableIntegration.getConstraints( 'table-b' ) ).toEqual( {
			rowCount: 3,
			blockedBoundaries: [ 1, 2 ],
		} );
	} );

	/**
	 * 概要:
	 * - 対応外Block、消失したBlock、不完全なTable構造では行制約を提供しないことを確認する。
	 *
	 * 事前条件:
	 * - 要求ごとに非対応Block、null、body欠落のCore Tableが返る。
	 *
	 * 操作:
	 * - 各clientIdについて公開されたTable IntegrationからgetConstraints()を実行する。
	 *
	 * 期待結果:
	 * - いずれも正常な不在としてnullが返る。
	 */
	it( 'when the current Table cannot be integrated, should return null', () => {
		setRowReorderTestTables( [
			{ ...createTable( 'unsupported', [] ), name: 'core/paragraph' },
			{ ...createTable( 'invalid', [] ), attributes: {} },
		] );

		expect( rowTableIntegration.getConstraints( 'unsupported' ) ).toBeNull();
		expect( rowTableIntegration.getConstraints( 'removed' ) ).toBeNull();
		expect( rowTableIntegration.getConstraints( 'invalid' ) ).toBeNull();
	} );

	/**
	 * 行DnD開始対象を妨げる縦結合セルの具体的位置を取得できることを確認する。
	 *
	 * 事前条件:
	 * - 1〜2行目・2〜3列目を占有する結合セルが存在する。
	 *
	 * 操作:
	 * - 2行目を移動元として開始対象の構造診断を要求する。
	 *
	 * 期待結果:
	 * - 移動先指定を必要とせず、原因セルの0-based行・列範囲が返る。
	 */
	it( 'when a drag source row intersects a merged cell, should return the source blocking range', () => {
		setRowReorderTestTables( [
			createTable( 'table-a', [
				{ cells: [ {}, { rowspan: 2, colspan: 2 } ] },
				{ cells: [ {} ] },
				{ cells: [ {}, {}, {} ] },
			] ),
		] );

		expect( rowTableIntegration.getSourceBlockingMergedRange( 'table-a', 1 ) ).toEqual( {
			rowStart: 0,
			rowEnd: 1,
			columnStart: 1,
			columnEnd: 2,
		} );
		expect( rowTableIntegration.getSourceBlockingMergedRange( 'table-a', 2 ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 下方向への確定済み行移動で、移動前の境界位置を移動元行の削除後も同じ移動先を表す位置へ変換できることを確認する。
	 *
	 * 事前条件:
	 * - tbodyはA、B、C、Dの4行である。
	 * - BをDの後ろへ移動する確定済みRowMoveを受け取る。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからapplyRowMove()を実行する。
	 *
	 * 期待結果:
	 * - bodyはA、C、D、Bの順で1回更新される。
	 */
	it( 'when a confirmed row moves downward, should preserve the requested destination after removing the source row', () => {
		const rows = [ 'A', 'B', 'C', 'D' ].map( ( content ) => ( {
			cells: [ { content } ],
		} ) );
		setRowReorderTestTables( [ createTable( 'table-a', rows ) ] );
		const storeChangeListener = jest.fn();
		const unsubscribe = subscribe( storeChangeListener, rowReorderTestBlockEditorStore );

		const applied = rowTableIntegration.applyRowMove( {
			clientId: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		unsubscribe();

		expect( applied ).toBe( true );
		expect( storeChangeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowReorderTestTable( 'table-a' )?.attributes.body ).toEqual( [
			rows[ 0 ],
			rows[ 2 ],
			rows[ 3 ],
			rows[ 1 ],
		] );
	} );

	/**
	 * 概要:
	 * - 更新要求時点で行範囲が変化した場合に更新しないことを確認する。
	 *
	 * 事前条件:
	 * - Tableは2行だけ存在する。
	 * - 移動元が現在の行範囲外となったRowMoveを受け取る。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからapplyRowMove()を実行する。
	 *
	 * 期待結果:
	 * - falseが返り、属性更新は行われない。
	 */
	it( 'when the current Table no longer matches the confirmed row range, should not update it', () => {
		const rows = [ { cells: [] }, { cells: [] } ];
		setRowReorderTestTables( [ createTable( 'table-a', rows ) ] );
		const storeChangeListener = jest.fn();
		const unsubscribe = subscribe( storeChangeListener, rowReorderTestBlockEditorStore );

		const applied = rowTableIntegration.applyRowMove( {
			clientId: 'table-a',
			sourceRowIndex: 2,
			destinationBoundaryIndex: 0,
		} );
		unsubscribe();

		expect( applied ).toBe( false );
		expect( storeChangeListener ).not.toHaveBeenCalled();
		expect( getRowReorderTestTable( 'table-a' )?.attributes.body ).toEqual( rows );
	} );
} );
