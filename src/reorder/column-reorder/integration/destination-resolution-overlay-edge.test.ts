/**
 * Column Destination Resolutionが移動対象Overlay相当の移動方向側端から論理列間境界を解決することを確認する。
 *
 * Table内外判定はnative pointer位置を維持しつつ、不等幅列、LTR / RTL、Overlay先端のTable外到達を含む
 * #900の移動先切り替え規則だけを責務境界から検証する。
 */

import type { DragMoveEvent } from '@dnd-kit/dom';

import { createColumnDestinationResolver } from '@/reorder/column-reorder/integration/destination-resolution';

/**
 * 指定した物理列範囲を持つTableを生成する。
 *
 * @param ranges          DOM順の各セルが占める物理横範囲。
 * @param inlineDirection Tableの論理列進行方向。
 * @return 生成したTableとセル。
 */
const createTable = (
	ranges: ReadonlyArray< { left: number; right: number } >,
	inlineDirection: 'ltr' | 'rtl' = 'ltr'
) => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const tableLeft = Math.min( ...ranges.map( ( range ) => range.left ) );
	const tableRight = Math.max( ...ranges.map( ( range ) => range.right ) );
	const cells = ranges.map( ( range ) => {
		const cell = document.createElement( 'td' );
		jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue( {
			left: range.left,
			right: range.right,
			top: 10,
			bottom: 90,
			width: range.right - range.left,
			height: 80,
			x: range.left,
			y: 10,
			toJSON: () => ( {} ),
		} );
		return cell;
	} );

	table.style.direction = inlineDirection;
	row.append( ...cells );
	tbody.appendChild( row );
	table.appendChild( tbody );
	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( {
		left: tableLeft,
		right: tableRight,
		top: 10,
		bottom: 90,
		width: tableRight - tableLeft,
		height: 80,
		x: tableLeft,
		y: 10,
		toJSON: () => ( {} ),
	} );

	return { table, cells };
};

/**
 * native pointer位置とDnD開始時からの物理横移動を持つDnD移動イベントを生成する。
 *
 * @param pointerX native pointerの現在横位置。
 * @param initialX DnD Engineが保持する開始時横位置。
 * @param currentX DnD Engineが保持する現在横位置。
 * @return 移動先解決へ渡すDnD移動イベント。
 */
const createMoveEvent = ( pointerX: number, initialX: number, currentX: number ) =>
	( {
		nativeEvent: { clientX: pointerX, clientY: 40 },
		operation: {
			position: {
				initial: { x: initialX, y: 40 },
				current: { x: currentX, y: 40 },
			},
		},
	} ) as unknown as DragMoveEvent;

describe( 'Column destination resolution overlay edge', () => {
	/**
	 * 幅の広い列を右方向へ移動した場合、Overlay相当の右端で次の境界へ切り替わることを確認する。
	 *
	 * 事前条件:
	 * - 幅200pxの移動対象列の右隣に幅40pxの列がある。
	 * - pointerは右隣列の中点へ到達していない。
	 *
	 * 操作:
	 * - 移動対象列を開始位置から25px右へ移動した位置を解決する。
	 *
	 * 期待結果:
	 * - Overlay相当の右端が切り替え位置を越えているため境界2が返される。
	 */
	it( 'when a wide source column moves right, should switch by the overlay right edge before the pointer reaches the destination midpoint', () => {
		const { cells } = createTable( [
			{ left: 0, right: 200 },
			{ left: 200, right: 240 },
			{ left: 240, right: 280 },
		] );
		const resolver = createColumnDestinationResolver( cells[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 125, 100, 125 ) ) ).toBe( 2 );
	} );

	/**
	 * 幅の広い列を左方向へ移動した場合、Overlay相当の左端で前の境界へ切り替わることを確認する。
	 *
	 * 事前条件:
	 * - 幅200pxの移動対象列の左側に幅40pxの列が並ぶ。
	 * - pointerだけでは移動先境界がまだ切り替わらない位置にある。
	 *
	 * 操作:
	 * - 移動対象列を開始位置から25px左へ移動した位置を解決する。
	 *
	 * 期待結果:
	 * - Overlay相当の左端が切り替え位置を越えているため境界1が返される。
	 */
	it( 'when a wide source column moves left, should switch by the overlay left edge before the pointer reaches the destination midpoint', () => {
		const { cells } = createTable( [
			{ left: 0, right: 40 },
			{ left: 40, right: 80 },
			{ left: 80, right: 280 },
		] );
		const resolver = createColumnDestinationResolver( cells[ 2 ] );

		expect( resolver?.resolve( createMoveEvent( 155, 180, 155 ) ) ).toBe( 1 );
	} );

	/**
	 * Overlay相当端が先にTable外へ出ても、Table内外判定はpointer基準で維持されることを確認する。
	 *
	 * 事前条件:
	 * - pointerはTable内にある。
	 * - 右方向へ移動したOverlay相当の右端はTable右端を越えている。
	 *
	 * 操作:
	 * - 現在位置の移動先を解決する。
	 *
	 * 期待結果:
	 * - Table外扱いにはならず、末尾境界2が返される。
	 */
	it( 'when the pointer remains inside the table but the overlay edge leaves it, should keep resolving a destination', () => {
		const { cells } = createTable( [
			{ left: 0, right: 200 },
			{ left: 200, right: 240 },
		] );
		const resolver = createColumnDestinationResolver( cells[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 150, 100, 150 ) ) ).toBe( 2 );
	} );

	/**
	 * RTLでも物理左方向の移動ではOverlay相当の物理左端を選び、その後に論理位置へ正規化することを確認する。
	 *
	 * 事前条件:
	 * - RTL Tableの論理先頭列が物理右端にあり、その幅は200pxである。
	 * - pointerだけでは境界1に対応する位置にある。
	 *
	 * 操作:
	 * - 論理先頭列を物理左方向へ25px移動した位置を解決する。
	 *
	 * 期待結果:
	 * - 物理左端をRTLの論理位置へ正規化した結果として境界2が返される。
	 */
	it( 'when an rtl source moves physically left, should normalize the physical left overlay edge into logical column order', () => {
		const { cells } = createTable(
			[
				{ left: 80, right: 280 },
				{ left: 40, right: 80 },
				{ left: 0, right: 40 },
			],
			'rtl'
		);
		const resolver = createColumnDestinationResolver( cells[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 155, 180, 155 ) ) ).toBe( 2 );
	} );

	/**
	 * RTLでも物理右方向の移動ではOverlay相当の物理右端を選び、その後に論理位置へ正規化することを確認する。
	 *
	 * 事前条件:
	 * - RTL Tableの論理末尾列が物理左端にある。
	 * - pointerだけでは境界2に対応する位置にある。
	 *
	 * 操作:
	 * - 論理末尾列を物理右方向へ25px移動した位置を解決する。
	 *
	 * 期待結果:
	 * - 物理右端をRTLの論理位置へ正規化した結果として境界1が返される。
	 */
	it( 'when an rtl source moves physically right, should normalize the physical right overlay edge into logical column order', () => {
		const { cells } = createTable(
			[
				{ left: 80, right: 280 },
				{ left: 40, right: 80 },
				{ left: 0, right: 40 },
			],
			'rtl'
		);
		const resolver = createColumnDestinationResolver( cells[ 2 ] );

		expect( resolver?.resolve( createMoveEvent( 45, 20, 45 ) ) ).toBe( 1 );
	} );
} );
