/**
 * Reorder Target Resolutionが、要求時点のTable制約から列開始対象と結合セル拒否位置を解決することを確認する。
 */

import { columnTableIntegration } from './table-integration';
import {
	createColumnReorderTestRow,
	createColumnReorderTestTable,
	getColumnReorderTestTable,
	setColumnReorderTestTables,
} from './table-integration.test-utils';
import { resolveColumnReorderTarget } from './target-resolution';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとTable Integrationは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './table-integration.test-utils' ).columnReorderTestBlockEditorStore,
} ) );

const target = {
	tableIdentity: 'table-a',
	sourceColumnIndex: 1,
};
const blockingAfterMergedRange = {
	section: 'body' as const,
	rowStart: 0,
	rowEnd: 0,
	columnStart: 1,
	columnEnd: 2,
};
const blockingBeforeMergedRange = {
	section: 'body' as const,
	rowStart: 0,
	rowEnd: 0,
	columnStart: 0,
	columnEnd: 1,
};

/**
 * 指定したtbodyを持つ現在Tableを登録する。
 *
 * @param body 現在Tableへ登録するtbody行集合。
 */
const setCurrentTable = ( body: Parameters< typeof createColumnReorderTestTable >[ 1 ] ): void => {
	setColumnReorderTestTables( [ createColumnReorderTestTable( 'table-a', body ) ] );
};

/** 結合セル制約のない5列の現在Tableを登録する。 */
const setMovableTable = (): void => {
	setCurrentTable( [ createColumnReorderTestRow( 'row' ) ] );
};

/** 移動元列の直後境界を1〜2列の結合セルが塞ぐ現在Tableを登録する。 */
const setBlockedAfterTable = (): void => {
	setCurrentTable( [ { cells: [ {}, { colspan: 2 }, {}, {} ] } ] );
};

/** 移動元列の直前境界を0〜1列の結合セルが塞ぐ現在Tableを登録する。 */
const setBlockedBeforeTable = (): void => {
	setCurrentTable( [ { cells: [ { colspan: 2 }, {}, {}, {} ] } ] );
};

describe( 'Column Reorder Target Resolution', () => {
	beforeEach( () => {
		setColumnReorderTestTables( [] );
	} );

	afterEach( () => {
		setColumnReorderTestTables( [] );
		jest.restoreAllMocks();
	} );

	/**
	 * 列単位で移動可能な対象ではTargetと開始時制約を同じ解決結果で返すことを確認する。
	 *
	 * 期待結果:
	 * - resolvedとしてTargetと取得した列制約が返る。
	 * - 結合セル位置の追加診断は行われない。
	 */
	it( 'when the target column is movable, should resolve the target with the current constraints', () => {
		setMovableTable();

		expect( resolveColumnReorderTarget( target ) ).toEqual( {
			status: 'resolved',
			target,
			initialConstraints: { columnCount: 5, blockedBoundaries: [] },
		} );
	} );

	/**
	 * colspan範囲に含まれる列では原因セル位置を開始拒否結果として返すことを確認する。
	 *
	 * 事前条件:
	 * - 移動元列の直後が分断不可境界である。
	 *
	 * 期待結果:
	 * - blockingMergedRangeを持つrejectedが返る。
	 * - 移動先を必要としない開始対象専用の診断が要求される。
	 */
	it( 'when the target column is blocked by a merged range, should reject it with the blocking range', () => {
		setBlockedAfterTable();

		const result = resolveColumnReorderTarget( target );

		expect( result ).toEqual( {
			status: 'rejected',
			blockingMergedRange: blockingAfterMergedRange,
		} );
	} );

	/**
	 * colspanの右端側にある列も直前の分断不可境界から開始拒否になることを確認する。
	 *
	 * 期待結果:
	 * - 原因セル位置を持つrejectedが返る。
	 */
	it( 'when the boundary before the target column is blocked, should reject it with the blocking range', () => {
		setBlockedBeforeTable();

		expect( resolveColumnReorderTarget( target ) ).toEqual( {
			status: 'rejected',
			blockingMergedRange: blockingBeforeMergedRange,
		} );
	} );

	/**
	 * 開始拒否の原因位置を現在Tableから確定できない場合は理由を推測しないことを確認する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when the current blocking range cannot be diagnosed, should return unavailable', () => {
		setBlockedAfterTable();
		const getConstraints = columnTableIntegration.getConstraints;
		/* 一つの同期的な解決要求内で制約取得と原因診断の間へ外部更新を挿入する公開境界はないため、この失敗注入だけ実制約取得の直後に現在Tableを消失させる。 */
		jest.spyOn( columnTableIntegration, 'getConstraints' ).mockImplementationOnce( ( clientId ) => {
			const constraints = getConstraints( clientId );
			setColumnReorderTestTables( [] );
			return constraints;
		} );

		expect( resolveColumnReorderTarget( target ) ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 解決要求ごとに現在Table制約を取得し直すことを確認する。
	 *
	 * 事前条件:
	 * - 同じ列が最初の要求では移動可能で、次の要求時には結合範囲に含まれる。
	 *
	 * 期待結果:
	 * - Table制約を要求ごとに取得し、2回目は現在の原因セル位置を持つ開始拒否になる。
	 */
	it( 'when the same target is resolved again, should use the current table for each request', () => {
		setMovableTable();

		expect( resolveColumnReorderTarget( target ).status ).toBe( 'resolved' );
		setBlockedAfterTable();
		expect( resolveColumnReorderTarget( target ) ).toEqual( {
			status: 'rejected',
			blockingMergedRange: blockingAfterMergedRange,
		} );
	} );

	/**
	 * Table制約を取得できない場合は通常の利用不能とすることを確認する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when current table constraints are unavailable, should return unavailable', () => {
		expect( resolveColumnReorderTarget( target ) ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 論理列範囲外または整数でない対象を通常の利用不能とすることを確認する。
	 *
	 * 期待結果:
	 * - どちらもunavailableが返る。
	 */
	it.each( [ 5, 1.5 ] )(
		'when target column index %s is invalid, should return unavailable',
		( sourceColumnIndex ) => {
			setMovableTable();
			expect(
				resolveColumnReorderTarget( { tableIdentity: 'table-a', sourceColumnIndex } )
			).toEqual( { status: 'unavailable' } );
		}
	);

	/**
	 * Target Resolutionが開始可否の判定だけを行い、Tableデータを変更しないことを確認する。
	 *
	 * 操作:
	 * - 開始可能、開始拒否、Table利用不能の各条件で解決する。
	 *
	 * 期待結果:
	 * - いずれの結果でもTableへの列移動は要求されない。
	 */
	it( 'when target resolution returns any normal outcome, should not update table data', () => {
		setMovableTable();
		const movableAttributes = getColumnReorderTestTable( 'table-a' )?.attributes;
		resolveColumnReorderTarget( target );
		expect( getColumnReorderTestTable( 'table-a' )?.attributes ).toBe( movableAttributes );

		setBlockedAfterTable();
		const blockedAttributes = getColumnReorderTestTable( 'table-a' )?.attributes;
		resolveColumnReorderTarget( target );
		expect( getColumnReorderTestTable( 'table-a' )?.attributes ).toBe( blockedAttributes );

		setColumnReorderTestTables( [] );
		resolveColumnReorderTarget( target );
		expect( getColumnReorderTestTable( 'table-a' ) ).toBeNull();
	} );
} );
