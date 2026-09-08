/**
 * Column ReorderのTableデータ更新監視が、対象Tableの属性参照変更だけをResolver snapshot無効化契機として通知することを確認する。
 */

import { subscribe } from '@wordpress/data';

import { subscribeColumnTableRevision } from './table-revision';

let mockAttributes: Record< string, unknown > = { body: [] };
let mockDataListener: ( () => void ) | null = null;
const mockUnsubscribe = jest.fn();

jest.mock( '@wordpress/block-editor', () => ( {
	store: {},
} ) );

jest.mock( '@wordpress/data', () => ( {
	select: jest.fn( () => ( {
		getBlock: jest.fn( () => ( {
			attributes: mockAttributes,
		} ) ),
	} ) ),
	subscribe: jest.fn( ( listener: () => void ) => {
		mockDataListener = listener;
		return mockUnsubscribe;
	} ),
} ) );

const subscribeMock = subscribe as jest.MockedFunction< typeof subscribe >;

describe( 'Column table revision', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockAttributes = { body: [] };
		mockDataListener = null;
	} );

	/**
	 * 対象Table以外を含むWordPress Data更新で属性参照が変わらない場合は、解決基準を無効化しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象TableのBlock属性参照を取得できる。
	 *
	 * 操作:
	 * - Table属性参照を変更せずWordPress Data更新を通知する。
	 *
	 * 期待結果:
	 * - Tableデータ更新として利用側へ通知しない。
	 */
	it( 'when WordPress data changes without replacing the target table attributes, should not notify a table revision', () => {
		const listener = jest.fn();
		subscribeColumnTableRevision( 'table-a', listener );

		mockDataListener?.();

		expect( listener ).not.toHaveBeenCalled();
	} );

	/**
	 * Undo等で同一TableのBlock属性参照が変わった場合に、現在の解決基準を破棄できるよう更新を通知することを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの初期Block属性参照を取得して監視している。
	 *
	 * 操作:
	 * - 同じTable IdentityのBlock属性参照を新しい値へ変更し、WordPress Data更新を通知する。
	 *
	 * 期待結果:
	 * - Tableデータ更新が1回通知される。
	 */
	it( 'when the same table receives new block attributes, should notify a table revision', () => {
		const listener = jest.fn();
		subscribeColumnTableRevision( 'table-a', listener );
		mockAttributes = { body: [ { cells: [] } ] };

		mockDataListener?.();

		expect( listener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * Table更新監視のLifecycle終了時にWordPress Data購読を残さないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの更新監視が開始されている。
	 *
	 * 操作:
	 * - 利用側から監視終了を要求する。
	 *
	 * 期待結果:
	 * - WordPress Data購読の解除処理が実行される。
	 */
	it( 'when the table revision subscription ends, should unsubscribe from WordPress data', () => {
		const unsubscribe = subscribeColumnTableRevision( 'table-a', jest.fn() );

		unsubscribe();

		expect( subscribeMock ).toHaveBeenCalledTimes( 1 );
		expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );
	} );
} );
