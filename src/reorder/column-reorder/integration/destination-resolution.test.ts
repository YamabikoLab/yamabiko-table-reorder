/**
 * 列DnD中の移動先解決が、DnD開始時の論理的なTable配置と現在の物理入力位置から正しい列間境界を返すことを確認する。
 *
 * 表示上の列移動や横スクロールによる画面上の位置変化から独立して、Table内の論理列境界を解決する振る舞いだけを検証する。
 */

import type { DragMoveEvent } from '@dnd-kit/dom';

import { createColumnDestinationResolver } from '@/reorder/column-reorder/integration/destination-resolution';

/**
 * 指定したTable横位置を基準に、不等幅の3列Tableを生成する。
 *
 * @param tableLeft Tableの現在の画面左端位置。
 * @return 移動元候補セル、各セル、Table、およびTable位置更新境界。
 */
const createThreeColumnTable = ( tableLeft = 0 ) => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	let currentTableLeft = tableLeft;
	const columnOffsets = [ 0, 80, 200, 320 ];
	const cells = Array.from( { length: 3 }, ( _, index ) => {
		const cell = document.createElement( 'td' );
		jest.spyOn( cell, 'getBoundingClientRect' ).mockImplementation( () => ( {
			left: currentTableLeft + columnOffsets[ index ]!,
			right: currentTableLeft + columnOffsets[ index + 1 ]!,
			top: 10,
			bottom: 90,
			width: columnOffsets[ index + 1 ]! - columnOffsets[ index ]!,
			height: 80,
			x: currentTableLeft + columnOffsets[ index ]!,
			y: 10,
			toJSON: () => ( {} ),
		} ) );
		return cell;
	} );

	row.append( ...cells );
	tbody.appendChild( row );
	table.appendChild( tbody );
	jest.spyOn( table, 'getBoundingClientRect' ).mockImplementation( () => ( {
		left: currentTableLeft,
		right: currentTableLeft + 320,
		top: 10,
		bottom: 90,
		width: 320,
		height: 80,
		x: currentTableLeft,
		y: 10,
		toJSON: () => ( {} ),
	} ) );

	return {
		table,
		cells,
		setTableLeft: ( nextLeft: number ) => {
			currentTableLeft = nextLeft;
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
const createMoveEvent = ( clientX: number, clientY = 40 ) =>
	( {
		nativeEvent: { clientX, clientY },
	} ) as unknown as DragMoveEvent;

describe( 'Column destination resolution', () => {
	/**
	 * 概要:
	 * - 先頭列の左半分から先頭境界を解決できることを確認する。
	 * 事前条件:
	 * - 不等幅の3列Tableがあり、先頭列の左半分が指されている。
	 * 操作:
	 * - DnD開始時にResolverを生成し、現在位置を解決する。
	 * 期待結果:
	 * - 先頭境界0が返される。
	 */
	it( 'when pointer targets the left half of the first column, should resolve the first boundary', () => {
		const { cells } = createThreeColumnTable();
		const resolver = createColumnDestinationResolver( cells[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 20 ) ) ).toBe( 0 );
	} );

	/**
	 * 概要:
	 * - 中間列の右半分から中間境界を解決できることを確認する。
	 * 事前条件:
	 * - 不等幅の3列Tableがあり、2列目の右半分が指されている。
	 * 操作:
	 * - 現在位置を解決する。
	 * 期待結果:
	 * - 2列目直後の境界2が返される。
	 */
	it( 'when pointer targets the right half of a middle column, should resolve the boundary after that column', () => {
		const { cells } = createThreeColumnTable();
		const resolver = createColumnDestinationResolver( cells[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 170 ) ) ).toBe( 2 );
	} );

	/**
	 * 概要:
	 * - 末尾列の右半分から末尾直後境界を解決できることを確認する。
	 * 事前条件:
	 * - 不等幅の3列Tableがあり、末尾列の右半分が指されている。
	 * 操作:
	 * - 現在位置を解決する。
	 * 期待結果:
	 * - 末尾直後の境界3が返される。
	 */
	it( 'when pointer targets the right half of the last column, should resolve the final boundary', () => {
		const { cells } = createThreeColumnTable();
		const resolver = createColumnDestinationResolver( cells[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 290 ) ) ).toBe( 3 );
	} );

	/**
	 * 概要:
	 * - Table外の物理位置を移動先として扱わないことを確認する。
	 * 事前条件:
	 * - Tableの描画範囲を取得でき、ポインターが横方向または縦方向の外側にある。
	 * 操作:
	 * - 各Table外位置を解決する。
	 * 期待結果:
	 * - いずれも有効な移動先がないためnullが返される。
	 */
	it( 'when pointer is outside the table, should resolve no destination', () => {
		const { cells } = createThreeColumnTable();
		const resolver = createColumnDestinationResolver( cells[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 350 ) ) ).toBeNull();
		expect( resolver?.resolve( createMoveEvent( 100, 120 ) ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 現在の物理入力位置を取得できないDnD移動通知から移動先を推測しないことを確認する。
	 * 事前条件:
	 * - DnD開始時のTable配置は正常に取得できている。
	 * - 移動通知にはポインター座標が含まれない。
	 * 操作:
	 * - 現在位置を解決する。
	 * 期待結果:
	 * - 有効な移動先がないためnullが返される。
	 */
	it( 'when the drag move does not provide pointer coordinates, should resolve no destination', () => {
		const { cells } = createThreeColumnTable();
		const resolver = createColumnDestinationResolver( cells[ 0 ] );
		const event = { nativeEvent: {} } as unknown as DragMoveEvent;

		expect( resolver?.resolve( event ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - DnD中の横スクロールでTable自体の画面位置が変わった場合に現在位置へ追従することを確認する。
	 * 事前条件:
	 * - Resolver生成後にTableの画面左端位置が100px左へ移動する。
	 * 操作:
	 * - 横スクロール後の現在位置を解決する。
	 * 期待結果:
	 * - 同じ論理列に対応する現在の画面位置から境界2が返される。
	 */
	it( 'when the table moves horizontally during drag, should resolve against its current screen position', () => {
		const { cells, setTableLeft } = createThreeColumnTable();
		const resolver = createColumnDestinationResolver( cells[ 0 ] );
		setTableLeft( -100 );

		expect( resolver?.resolve( createMoveEvent( 70 ) ) ).toBe( 2 );
	} );

	/**
	 * 概要:
	 * - DnD開始後にセルの表示位置が変わっても開始時の論理境界を維持することを確認する。
	 * 事前条件:
	 * - Resolver生成後に2列目の描画位置だけが大きく変化する。
	 * 操作:
	 * - 表示位置変更後のポインター位置を解決する。
	 * 期待結果:
	 * - 開始時の論理境界に基づく境界2が返される。
	 */
	it( 'when column display positions change after drag start, should keep using the initial logical column boundaries', () => {
		const { cells } = createThreeColumnTable();
		const resolver = createColumnDestinationResolver( cells[ 0 ] );
		jest.spyOn( cells[ 1 ]!, 'getBoundingClientRect' ).mockReturnValue( {
			left: 500,
			right: 620,
			top: 10,
			bottom: 90,
			width: 120,
			height: 80,
			x: 500,
			y: 10,
			toJSON: () => ( {} ),
		} );

		expect( resolver?.resolve( createMoveEvent( 170 ) ) ).toBe( 2 );
	} );

	/**
	 * 概要:
	 * - 生成済みResolverを複数回利用しても開始時の列境界が変化しないことを確認する。
	 * 事前条件:
	 * - DnD開始時のTable配置からResolverが生成されている。
	 * 操作:
	 * - 異なる物理位置を同じResolverで順に解決する。
	 * 期待結果:
	 * - 各位置が同じ開始時境界を基準とする境界1、2へ解決される。
	 */
	it( 'when a resolver handles multiple move events, should keep the initial column geometry', () => {
		const { cells } = createThreeColumnTable();
		const resolver = createColumnDestinationResolver( cells[ 0 ] );

		expect( resolver?.resolve( createMoveEvent( 60 ) ) ).toBe( 1 );
		expect( resolver?.resolve( createMoveEvent( 170 ) ) ).toBe( 2 );
	} );

	/**
	 * 概要:
	 * - Column Reorder対象として成立しないDOMから不完全なResolverを生成しないことを確認する。
	 * 事前条件:
	 * - 移動対象としてTableセルに属さない要素が渡される。
	 * 操作:
	 * - Destination Resolverの生成を要求する。
	 * 期待結果:
	 * - Resolverを生成せずnullが返される。
	 */
	it( 'when source element is not part of a table cell, should not create a destination resolver', () => {
		const element = document.createElement( 'div' );

		expect( createColumnDestinationResolver( element ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 横結合内部の観測できない論理境界を物理位置から推測しないことを確認する。
	 * 事前条件:
	 * - 3論理列すべてを覆う1つの横結合セルだけが描画されている。
	 * 操作:
	 * - 横結合セルの中央付近を解決する。
	 * 期待結果:
	 * - 観測できない内部境界1、2ではなく、観測可能な末尾境界3が返される。
	 */
	it( 'when a merged cell hides internal column boundaries, should not infer those boundaries', () => {
		const table = document.createElement( 'table' );
		const tbody = document.createElement( 'tbody' );
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.colSpan = 3;
		row.appendChild( cell );
		tbody.appendChild( row );
		table.appendChild( tbody );
		jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue( {
			left: 0,
			right: 300,
			top: 0,
			bottom: 80,
			width: 300,
			height: 80,
			x: 0,
			y: 0,
			toJSON: () => ( {} ),
		} );
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( {
			left: 0,
			right: 300,
			top: 0,
			bottom: 80,
			width: 300,
			height: 80,
			x: 0,
			y: 0,
			toJSON: () => ( {} ),
		} );
		const resolver = createColumnDestinationResolver( cell );

		expect( resolver?.resolve( createMoveEvent( 200, 40 ) ) ).toBe( 3 );
	} );
} );
