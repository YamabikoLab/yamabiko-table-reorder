/**
 * Reorder Target Resolutionが、要求時点のTable制約から行開始対象と結合セル拒否位置を解決することを確認する。
 */

import { rowTableIntegration } from './table-integration';
import {
	createRowReorderTestRow,
	createRowReorderTestTable,
	setRowReorderTestTables,
} from './table-integration.test-utils';
import { resolveRowReorderTarget } from './target-resolution';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとTable Integrationは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './table-integration.test-utils' ).rowReorderTestBlockEditorStore,
} ) );

const target = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};
const blockingMergedRange = {
	rowStart: 0,
	rowEnd: 1,
	columnStart: 2,
	columnEnd: 3,
};

/**
 * 指定したtbodyを持つ現在Tableを登録する。
 *
 * @param body 現在Tableへ登録するtbody行集合。
 */
const setCurrentTable = ( body: Parameters< typeof createRowReorderTestTable >[ 1 ] ): void => {
	setRowReorderTestTables( [ createRowReorderTestTable( 'table-a', body ) ] );
};

/** 結合セル制約のない5行の現在Tableを登録する。 */
const setMovableTable = (): void => {
	setCurrentTable(
		Array.from( { length: 5 }, ( _value, rowIndex ) =>
			createRowReorderTestRow( `row-${ rowIndex + 1 }` )
		)
	);
};

/** 移動元行を0〜1行・2〜3列の結合セルが妨げる現在Tableを登録する。 */
const setBlockedTable = (): void => {
	setCurrentTable( [
		{ cells: [ {}, {}, { rowspan: 2, colspan: 2 } ] },
		{ cells: [ {}, {} ] },
		{ cells: [ {}, {}, {}, {} ] },
		{ cells: [ {}, {}, {}, {} ] },
		{ cells: [ {}, {}, {}, {} ] },
	] );
};

describe( 'Row Reorder Target Resolution', () => {
	beforeEach( () => {
		setRowReorderTestTables( [] );
	} );

	afterEach( () => {
		setRowReorderTestTables( [] );
		jest.restoreAllMocks();
	} );

	/**
	 * 行単位で移動可能な対象ではTargetと開始時制約を同じ解決結果で返すことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableを取得でき、移動元行の前後に分断不可境界がない。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - resolvedとしてTargetと取得した行制約が返る。
	 * - 結合セル位置の追加診断は行われない。
	 */
	it( 'when the target row is movable, should resolve the target with the current constraints', () => {
		setMovableTable();

		const result = resolveRowReorderTarget( target );

		expect( result ).toEqual( {
			status: 'resolved',
			target,
			initialConstraints: { rowCount: 5, blockedBoundaries: [] },
		} );
	} );

	/**
	 * rowspan等の結合範囲に含まれる行では原因セル位置を開始拒否結果として返すことを確認する。
	 *
	 * 事前条件:
	 * - 移動元行の直後が分断不可境界である。
	 * - 現在Tableから移動元を妨げる結合セル位置を診断できる。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - blockingMergedRangeを持つrejectedが返る。
	 * - 移動先を必要としない開始対象専用の診断が要求される。
	 */
	it( 'when the target row is blocked by a merged range, should reject it with the blocking range', () => {
		setBlockedTable();

		const result = resolveRowReorderTarget( target );

		expect( result ).toEqual( {
			status: 'rejected',
			blockingMergedRange,
		} );
	} );

	/**
	 * 開始拒否の原因位置を現在Tableから確定できない場合は理由を推測しないことを確認する。
	 *
	 * 事前条件:
	 * - 制約上は移動元行が結合範囲に含まれる。
	 * - 原因位置の診断時には現在Tableを利用できない。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when the current blocking range cannot be diagnosed, should return unavailable', () => {
		setBlockedTable();
		const getConstraints = rowTableIntegration.getConstraints;
		/* 一つの同期的な解決要求内で制約取得と原因診断の間へ外部更新を挿入する公開境界はないため、この失敗注入だけ実制約取得の直後に現在Tableを消失させる。 */
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockImplementationOnce( ( clientId ) => {
			const constraints = getConstraints( clientId );
			setRowReorderTestTables( [] );
			return constraints;
		} );

		expect( resolveRowReorderTarget( target ) ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 解決要求ごとに現在Table制約を取得し直すことを確認する。
	 *
	 * 事前条件:
	 * - 同じ行が最初の要求では移動可能で、次の要求時には結合範囲に含まれる。
	 *
	 * 操作:
	 * - 同じTargetを続けて2回解決する。
	 *
	 * 期待結果:
	 * - Table制約を要求ごとに取得し、2回目は現在の原因セル位置を持つ開始拒否になる。
	 */
	it( 'when the same target is resolved again, should use the current table for each request', () => {
		setMovableTable();

		expect( resolveRowReorderTarget( target ).status ).toBe( 'resolved' );
		setBlockedTable();
		expect( resolveRowReorderTarget( target ) ).toEqual( {
			status: 'rejected',
			blockingMergedRange,
		} );
	} );

	/**
	 * Table制約を取得できない場合は利用者向け拒否情報を作らず通常の利用不能とすることを確認する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when current table constraints are unavailable, should return unavailable', () => {
		expect( resolveRowReorderTarget( target ) ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * tbody範囲外の対象は利用者向け拒否情報を作らず通常の利用不能とすることを確認する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when the target row is outside tbody, should return unavailable', () => {
		setMovableTable();

		expect( resolveRowReorderTarget( { tableIdentity: 'table-a', sourceRowIndex: 5 } ) ).toEqual( {
			status: 'unavailable',
		} );
	} );
} );
