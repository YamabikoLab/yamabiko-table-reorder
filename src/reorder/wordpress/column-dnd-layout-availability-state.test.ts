/**
 * WordPress Reorder Integrationが、Column DnD Layout AvailabilityのToolbar表示用snapshotをTable Identityごとに共有することを確認する。
 */

import {
	clearColumnDndLayoutAvailabilitySnapshot,
	getColumnDndLayoutAvailabilitySnapshot,
	subscribeColumnDndLayoutAvailabilitySnapshot,
	updateColumnDndLayoutAvailabilitySnapshot,
} from '@/reorder/wordpress/column-dnd-layout-availability-state';

describe( 'Column DnD layout availability toolbar snapshot', () => {
	afterEach( () => {
		clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );
		clearColumnDndLayoutAvailabilitySnapshot( 'table-b' );
	} );

	/**
	 * Table Identityごとの現在値だけを対応するToolbar購読者へ通知することを確認する。
	 *
	 * 事前条件:
	 * - 二つのTable Identityがそれぞれ独立したToolbar入口を持つ。
	 *
	 * 操作:
	 * - 一方のTableだけをavailableへ更新する。
	 *
	 * 期待結果:
	 * - 更新対象Tableだけがavailableになり、そのTableの購読者だけに通知される。
	 */
	it( 'when one table snapshot changes, should notify only that table subscriber', () => {
		const tableAListener = jest.fn();
		const tableBListener = jest.fn();
		const unsubscribeTableA = subscribeColumnDndLayoutAvailabilitySnapshot(
			'table-a',
			tableAListener
		);
		const unsubscribeTableB = subscribeColumnDndLayoutAvailabilitySnapshot(
			'table-b',
			tableBListener
		);

		updateColumnDndLayoutAvailabilitySnapshot( 'table-a', 'available' );

		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'available' );
		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-b' ) ).toBe( 'unavailable' );
		expect( tableAListener ).toHaveBeenCalledTimes( 1 );
		expect( tableBListener ).not.toHaveBeenCalled();
		unsubscribeTableA();
		unsubscribeTableB();
	} );

	/**
	 * BlockListBlockとの接続終了後に古い表示用snapshotを残さないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableのavailable snapshotが共有されている。
	 *
	 * 操作:
	 * - 対象Tableのsnapshotを破棄する。
	 *
	 * 期待結果:
	 * - 次の評価までToolbarは安全側のunavailableを取得する。
	 */
	it( 'when the table connection ends, should discard its snapshot as unavailable', () => {
		updateColumnDndLayoutAvailabilitySnapshot( 'table-a', 'available' );

		clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );

		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'unavailable' );
	} );

	/**
	 * Toolbar購読者へ意味のある表示可否変更だけを通知することを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableのsnapshot変更をToolbarが購読している。
	 *
	 * 操作:
	 * - availableへ更新し、同じavailableを再度反映した後、接続終了としてsnapshotを破棄する。
	 *
	 * 期待結果:
	 * - availableへの変更とunavailableへの破棄でそれぞれ1回通知される。
	 * - 同じavailableの再反映では追加通知されない。
	 */
	it( 'when the same snapshot is repeated and then cleared, should notify only observable availability changes', () => {
		const listener = jest.fn();
		const unsubscribe = subscribeColumnDndLayoutAvailabilitySnapshot( 'table-a', listener );

		updateColumnDndLayoutAvailabilitySnapshot( 'table-a', 'available' );
		expect( listener ).toHaveBeenCalledTimes( 1 );

		updateColumnDndLayoutAvailabilitySnapshot( 'table-a', 'available' );
		expect( listener ).toHaveBeenCalledTimes( 1 );

		clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );
		expect( listener ).toHaveBeenCalledTimes( 2 );

		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'unavailable' );
		unsubscribe();
	} );
} );
