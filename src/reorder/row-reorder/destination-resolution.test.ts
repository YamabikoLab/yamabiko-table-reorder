/**
 * 行DnD中の移動先解決が、DnD開始時の論理的なTable配置と現在の物理入力位置から正しい境界を返すことを確認する。
 *
 * 表示上の行移動やスクロールによる画面上の位置変化から独立して、tbody内の論理境界を解決する振る舞いだけを検証する。
 */

import type { DragMoveEvent } from '@dnd-kit/dom';

import { createRowDestinationResolver } from './destination-resolution';

/**
 * 指定位置と高さを持つ2行Tableを生成する。
 *
 * @param bodyTop tbodyの現在の画面上端位置。
 * @return 移動元候補行とtbody。
 */
const createTableRows = ( bodyTop = 0 ) => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	let currentBodyTop = bodyTop;
	const rows = Array.from( { length: 2 }, ( _, index ) => {
		const row = document.createElement( 'tr' );
		row.appendChild( document.createElement( 'td' ) );
		jest.spyOn( row, 'getBoundingClientRect' ).mockImplementation( () => ( {
			top: currentBodyTop + index * 40,
			bottom: currentBodyTop + ( index + 1 ) * 40,
			left: 0,
			right: 100,
			width: 100,
			height: 40,
			x: 0,
			y: currentBodyTop + index * 40,
			toJSON: () => ( {} ),
		} ) );
		return row;
	} );
	tbody.append( ...rows );
	table.appendChild( tbody );
	jest.spyOn( tbody, 'getBoundingClientRect' ).mockImplementation( () => ( {
		top: currentBodyTop,
		bottom: currentBodyTop + 80,
		left: 0,
		right: 100,
		width: 100,
		height: 80,
		x: 0,
		y: currentBodyTop,
		toJSON: () => ( {} ),
	} ) );

	return {
		rows,
		tbody,
		setBodyTop: ( nextTop: number ) => {
			currentBodyTop = nextTop;
		},
	};
};

/**
 * 現在のポインター位置を持つDnD移動イベントを生成する。
 *
 * @param clientX ポインターの画面上の横位置。
 * @param clientY ポインターの画面上の縦位置。
 * @return 移動先解決へ渡す物理DnD移動イベント。
 */
const createMoveEvent = ( clientX: number, clientY: number ) =>
	( {
		nativeEvent: { clientX, clientY },
	} ) as unknown as DragMoveEvent;

describe( 'Row destination resolution', () => {
	/**
	 * 概要:
	 * - 行の上半分を指した場合にその行の直前境界を返すことを確認する。
	 * 事前条件:
	 * - 40px高の2行Tableがあり、2行目の上半分が指されている。
	 * 操作:
	 * - DnD開始時に解決境界を生成し、現在位置を解決する。
	 * 期待結果:
	 * - 2行目直前の境界1が返される。
	 */
	it( 'when pointer targets the upper half of a row, should resolve the boundary before that row', () => {
		const { rows } = createTableRows();
		const resolver = createRowDestinationResolver( rows[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 10, 50 ) ) ).toBe( 1 );
	} );

	/**
	 * 概要:
	 * - 行の下半分を指した場合にその行の直後境界を返すことを確認する。
	 * 事前条件:
	 * - 40px高の2行Tableがあり、1行目の下半分が指されている。
	 * 操作:
	 * - DnD開始時に解決境界を生成し、現在位置を解決する。
	 * 期待結果:
	 * - 1行目直後の境界1が返される。
	 */
	it( 'when pointer targets the lower half of a row, should resolve the boundary after that row', () => {
		const { rows } = createTableRows();
		const resolver = createRowDestinationResolver( rows[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 10, 30 ) ) ).toBe( 1 );
	} );

	/**
	 * 概要:
	 * - 対象Tableの横方向外側を移動先として扱わないことを確認する。
	 * 事前条件:
	 * - tbodyの横幅を取得でき、ポインターがその外側にある。
	 * 操作:
	 * - 現在位置を解決する。
	 * 期待結果:
	 * - 有効な移動先がないためnullが返される。
	 */
	it( 'when pointer is horizontally outside the table body, should resolve no destination', () => {
		const { rows } = createTableRows();
		const resolver = createRowDestinationResolver( rows[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 120, 30 ) ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - DnD開始後に表示上の行位置が変わっても開始時の論理境界を維持することを確認する。
	 * 事前条件:
	 * - 解決境界生成後に、行のgetBoundingClientRectが異なる表示位置を返す。
	 * 操作:
	 * - 表示位置変更後のポインター位置を解決する。
	 * 期待結果:
	 * - 開始時の論理境界に基づく移動先が返される。
	 */
	it( 'when row display positions change after drag start, should keep using the initial logical row boundaries', () => {
		const { rows } = createTableRows();
		const resolver = createRowDestinationResolver( rows[ 0 ] );
		jest.spyOn( rows[ 1 ], 'getBoundingClientRect' ).mockReturnValue( {
			top: 200,
			bottom: 240,
			left: 0,
			right: 100,
			width: 100,
			height: 40,
			x: 0,
			y: 200,
			toJSON: () => ( {} ),
		} );

		expect( resolver?.resolve( createMoveEvent( 10, 50 ) ) ).toBe( 1 );
	} );

	/**
	 * 概要:
	 * - DnD中のスクロールでtbody自体の画面位置が変わった場合に現在位置へ追従することを確認する。
	 * 事前条件:
	 * - DnD開始後にtbodyの画面上端位置が40px上へ移動する。
	 * 操作:
	 * - スクロール後の現在位置を解決する。
	 * 期待結果:
	 * - 同じ論理行に対応する現在の画面位置から移動先境界が返される。
	 */
	it( 'when the table body moves during drag, should resolve against its current screen position', () => {
		const { rows, setBodyTop } = createTableRows();
		const resolver = createRowDestinationResolver( rows[ 0 ] );
		setBodyTop( -40 );

		expect( resolver?.resolve( createMoveEvent( 10, 10 ) ) ).toBe( 1 );
	} );

	/**
	 * 概要:
	 * - Row Reorder対象として成立しないDOMから解決境界を生成しないことを確認する。
	 * 事前条件:
	 * - 移動対象としてtbody直下行ではない要素が渡される。
	 * 操作:
	 * - 移動先解決境界を生成する。
	 * 期待結果:
	 * - 不完全な解決境界を生成せずnullが返される。
	 */
	it( 'when source element is not a direct tbody row, should not create a destination resolver', () => {
		const element = document.createElement( 'div' );

		expect( createRowDestinationResolver( element ) ).toBeNull();
	} );
} );
