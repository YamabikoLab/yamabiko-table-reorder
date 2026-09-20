/**
 * Column RF Resolutionが解釈済み指定を要求時点の現在論理列構造へ照合し、移動候補、no-op、構造拒否、利用不能を方向固有結果として解決するContractを確認する。
 */

import { columnRfResolution } from './column-resolution';
import {
	createTestTableBlock,
	createTestTableRow,
	setTestTableBlocks,
} from './interaction.test-utils';

/* Jestで読み込めないBlock Editor Storeの環境境界だけを代替し、WordPress Dataは実Storeへ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './block-editor-store.test-utils' ).testBlockEditorStore,
} ) );

const createDefaultTable = () =>
	createTestTableBlock( 'table-a', [ createTestTableRow( 'row-1', 6 ) ] );

describe( 'Column RF Resolution', () => {
	beforeEach( () => {
		setTestTableBlocks( [ createDefaultTable() ] );
	} );

	afterEach( () => {
		setTestTableBlocks( [] );
	} );

	/**
	 * 概要:
	 * - 移動前Table上のtargetと左右指定を、現在論理列基準の移動先境界へ変換できることを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableには6論理列存在し、結合セル制約はない。
	 * - sourceとtargetは現在範囲内に存在する。
	 *
	 * 操作:
	 * - targetの左または右へのColumn RF指定を解決する。
	 *
	 * 期待結果:
	 * - 移動前Table基準の正しいdestination boundaryを持つ`resolved`候補が返る。
	 */
	it.each( [
		[ 'left' as const, 4 ],
		[ 'right' as const, 5 ],
	] )(
		'when a current Column target is resolved %s, should return the pre-move destination boundary',
		( position, destinationBoundaryIndex ) => {
			expect(
				columnRfResolution.resolve( 'table-a', {
					sourceColumnIndex: 1,
					targetColumnIndex: 4,
					position,
				} )
			).toEqual( {
				status: 'resolved',
				candidate: {
					clientId: 'table-a',
					sourceColumnIndex: 1,
					destinationBoundaryIndex,
				},
			} );
		}
	);

	/**
	 * 概要:
	 * - 並び順が変わらないColumn指定では結合セル制約よりno-opを優先することを確認する。
	 *
	 * 事前条件:
	 * - sourceの直前または直後を移動先境界とする指定が成立している。
	 * - source列は横結合セルの影響範囲にある。
	 *
	 * 操作:
	 * - Column RF指定を解決する。
	 *
	 * 期待結果:
	 * - `no-op`が返る。
	 */
	it.each( [
		[ 2, 'left' as const ],
		[ 1, 'right' as const ],
	] )(
		'when a Column move would keep the current order, should return no-op before structural rejection',
		( targetColumnIndex, position ) => {
			setTestTableBlocks( [
				createTestTableBlock( 'table-a', [ { cells: [ {}, { colspan: 2 }, {}, {}, {} ] } ] ),
			] );

			expect(
				columnRfResolution.resolve( 'table-a', {
					sourceColumnIndex: 2,
					targetColumnIndex,
					position,
				} )
			).toEqual( { status: 'no-op' } );
		}
	);

	/**
	 * 概要:
	 * - 現在Tableを利用できない場合や、入力成立後にsource / targetが現在範囲外になった場合を候補成立と区別することを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableが存在しないか、現在Tableが3列まで減少している。
	 *
	 * 操作:
	 * - 利用不能なTable、または現在範囲へ照合できないColumn指定を解決する。
	 *
	 * 期待結果:
	 * - `unavailable`が返り、候補は推測されない。
	 */
	it( 'when the current Column table or selected positions cannot be resolved, should return unavailable', () => {
		setTestTableBlocks( [] );
		expect(
			columnRfResolution.resolve( 'table-a', {
				sourceColumnIndex: 1,
				targetColumnIndex: 4,
				position: 'left',
			} )
		).toEqual( { status: 'unavailable' } );

		setTestTableBlocks( [
			createTestTableBlock( 'table-a', [ createTestTableRow( 'row-1', 3 ) ] ),
		] );
		expect(
			columnRfResolution.resolve( 'table-a', {
				sourceColumnIndex: 1,
				targetColumnIndex: 4,
				position: 'left',
			} )
		).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 概要:
	 * - 実際に並び順が変わる候補が横結合制約に抵触した場合、Table Integrationの方向固有診断をそのまま公開することを確認する。
	 *
	 * 事前条件:
	 * - source / target / destinationは現在Tableに存在する。
	 * - 候補を妨げる横結合セルが存在する。
	 *
	 * 操作:
	 * - Column RF指定を解決する。
	 *
	 * 期待結果:
	 * - `rejected`と最初の`ColumnBlockingMergedRange`がsection・行・列位置を含めて返る。
	 */
	it( 'when a changing Column move is blocked by a merged range, should return rejected with the blocking range', () => {
		setTestTableBlocks( [
			createTestTableBlock(
				'table-a',
				[ createTestTableRow( 'body-row', 6 ) ],
				[ { cells: [ {}, {}, { rowspan: 2, colspan: 3 }, {} ] }, { cells: [ {}, {}, {} ] } ]
			),
		] );

		expect(
			columnRfResolution.resolve( 'table-a', {
				sourceColumnIndex: 0,
				targetColumnIndex: 3,
				position: 'right',
			} )
		).toEqual( {
			status: 'rejected',
			blockingMergedRange: {
				section: 'head',
				rowStart: 0,
				rowEnd: 1,
				columnStart: 2,
				columnEnd: 4,
			},
		} );
	} );
} );
