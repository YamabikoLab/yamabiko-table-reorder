/**
 * Column DnD Layout Availabilityが、表示方式を識別せず現在の物理列境界だけから安全な開始可否を判定することを確認する。
 */

import {
	evaluateColumnDndLayoutAvailability,
	resolveColumnDndLayoutAvailability,
} from '@/reorder/column-reorder/responsibilities/layout-availability';

/**
 * セルへ指定した物理横位置を設定する。
 *
 * @param cell  計測対象セル。
 * @param left  セル左端位置。
 * @param right セル右端位置。
 */
const setCellRectangle = ( cell: HTMLTableCellElement, left: number, right: number ): void => {
	jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue( {
		left,
		right,
		top: 0,
		bottom: 40,
		width: right - left,
		height: 40,
		x: left,
		y: 0,
		toJSON: () => ( {} ),
	} );
};

describe( 'Column DnD Layout Availability', () => {
	/**
	 * 通常Tableの各論理列境界が整合し、論理順に前進する場合を確認する。
	 *
	 * 事前条件:
	 * - 複数行から同じ列境界を同じ物理位置として観測できる。
	 *
	 * 操作:
	 * - 観測済み列境界の利用可否を評価する。
	 *
	 * 期待結果:
	 * - Column DnDはavailableになる。
	 */
	it( 'when observed boundaries are consistent and advance in logical order, should be available', () => {
		expect(
			evaluateColumnDndLayoutAvailability( [
				{ index: 0, offset: 0 },
				{ index: 0, offset: 0.25 },
				{ index: 1, offset: 100 },
				{ index: 1, offset: 100.25 },
				{ index: 2, offset: 220 },
				{ index: 3, offset: 360 },
			] )
		).toBe( 'available' );
	} );

	/**
	 * 横結合セル内部の未観測境界だけではTable全体を利用不可にしないことを確認する。
	 *
	 * 事前条件:
	 * - 論理境界1は観測できず、境界0、2、3は整合した物理位置にある。
	 *
	 * 操作:
	 * - 観測済み列境界の利用可否を評価する。
	 *
	 * 期待結果:
	 * - Column DnDはavailableになる。
	 */
	it( 'when a merged cell leaves an internal boundary unobserved, should evaluate the remaining boundaries as available', () => {
		expect(
			evaluateColumnDndLayoutAvailability( [
				{ index: 0, offset: 0 },
				{ index: 2, offset: 200 },
				{ index: 3, offset: 300 },
			] )
		).toBe( 'available' );
	} );

	/**
	 * Stacked / Reflow表示で同じ論理境界がセルごとに異なる物理位置へ現れる場合を確認する。
	 *
	 * 事前条件:
	 * - 各セルは同じ横幅で縦積みされ、境界1と2に開始端と終了端の両方が観測される。
	 *
	 * 操作:
	 * - 観測済み列境界の利用可否を評価する。
	 *
	 * 期待結果:
	 * - 代表境界が前進して見えてもColumn DnDはunavailableになる。
	 */
	it( 'when stacked cells observe one logical boundary at conflicting positions, should be unavailable', () => {
		expect(
			evaluateColumnDndLayoutAvailability( [
				{ index: 0, offset: 0 },
				{ index: 1, offset: 100 },
				{ index: 1, offset: 0 },
				{ index: 2, offset: 200 },
				{ index: 2, offset: 0 },
				{ index: 3, offset: 300 },
			] )
		).toBe( 'unavailable' );
	} );

	/**
	 * 異なる論理境界が同じ位置へ潰れる、または論理順に逆転する場合を確認する。
	 *
	 * 操作:
	 * - 潰れた境界と逆転した境界をそれぞれ評価する。
	 *
	 * 期待結果:
	 * - どちらも物理移動先を安全に区別できずunavailableになる。
	 */
	it( 'when distinct boundaries collapse or reverse, should be unavailable', () => {
		expect(
			evaluateColumnDndLayoutAvailability( [
				{ index: 0, offset: 0 },
				{ index: 1, offset: 100 },
				{ index: 2, offset: 100 },
			] )
		).toBe( 'unavailable' );
		expect(
			evaluateColumnDndLayoutAvailability( [
				{ index: 0, offset: 0 },
				{ index: 1, offset: 200 },
				{ index: 2, offset: 100 },
			] )
		).toBe( 'unavailable' );
	} );

	/**
	 * 計測誤差の許容範囲内しか離れていない論理境界を、利用可能な移動先として扱わないことを確認する。
	 *
	 * 事前条件:
	 * - 隣接する論理境界の物理位置差が許容値以内である。
	 *
	 * 操作:
	 * - 観測済み列境界の利用可否を評価する。
	 *
	 * 期待結果:
	 * - 物理的に区別可能な移動先を保証できないためColumn DnDはunavailableになる。
	 */
	it( 'when adjacent boundaries differ only within the measurement tolerance, should be unavailable', () => {
		expect(
			evaluateColumnDndLayoutAvailability( [
				{ index: 0, offset: 0 },
				{ index: 1, offset: 1 },
				{ index: 2, offset: 120 },
			] )
		).toBe( 'unavailable' );
	} );

	/**
	 * RTL Tableの物理位置が論理進行方向へ正規化されることを確認する。
	 *
	 * 事前条件:
	 * - TableはRTLで、論理先頭列が物理的な右側に描画されている。
	 *
	 * 操作:
	 * - 現在Table DOMからColumn DnD利用可否を解決する。
	 *
	 * 期待結果:
	 * - 正規化後の列境界が論理順に前進しavailableになる。
	 */
	it( 'when an RTL table advances from the physical right edge, should normalize it as available', () => {
		const table = document.createElement( 'table' );
		const row = document.createElement( 'tr' );
		const firstCell = document.createElement( 'td' );
		const secondCell = document.createElement( 'td' );
		table.style.direction = 'rtl';
		row.append( firstCell, secondCell );
		table.appendChild( row );
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( {
			left: 20,
			right: 320,
			top: 0,
			bottom: 40,
			width: 300,
			height: 40,
			x: 20,
			y: 0,
			toJSON: () => ( {} ),
		} );
		setCellRectangle( firstCell, 220, 320 );
		setCellRectangle( secondCell, 20, 220 );

		expect( resolveColumnDndLayoutAvailability( table ) ).toBe( 'available' );
	} );

	/**
	 * 対象Tableまたは複数の物理列境界を安全に観測できない場合を確認する。
	 *
	 * 操作:
	 * - 対象Tableなしと単一境界だけの観測を評価する。
	 *
	 * 期待結果:
	 * - 判定不能を楽観的に扱わずunavailableになる。
	 */
	it( 'when the table or multiple usable boundaries cannot be observed, should be unavailable', () => {
		expect( resolveColumnDndLayoutAvailability( null ) ).toBe( 'unavailable' );
		expect( evaluateColumnDndLayoutAvailability( [ { index: 0, offset: 0 } ] ) ).toBe(
			'unavailable'
		);
	} );
} );
