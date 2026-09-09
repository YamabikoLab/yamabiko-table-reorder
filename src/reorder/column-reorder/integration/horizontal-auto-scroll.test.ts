/**
 * Column Reorderの水平自動スクロールが、対象Tableの横スクロール領域とnative pointer位置だけを利用して正しく進行することを確認する。
 *
 * 左右方向の継続スクロール、領域外判定、限界停止、再開、対象固定、終了時破棄を責務境界から検証する。
 */

import { createColumnHorizontalAutoScroll } from '@/reorder/column-reorder/integration/horizontal-auto-scroll';

/**
 * 横スクロール可能なTable領域を生成する。
 *
 * @return 並び替え対象セル、横スクロール領域、描画フレーム操作。
 */
const createScrollableTable = () => {
	const scrollArea = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const cell = document.createElement( 'td' );
	row.appendChild( cell );
	tbody.appendChild( row );
	table.appendChild( tbody );
	scrollArea.appendChild( table );
	document.body.appendChild( scrollArea );
	scrollArea.style.overflowX = 'auto';
	Object.defineProperty( scrollArea, 'clientWidth', { value: 200, configurable: true } );
	Object.defineProperty( scrollArea, 'scrollWidth', { value: 500, configurable: true } );
	Object.defineProperty( scrollArea, 'scrollLeft', {
		value: 100,
		writable: true,
		configurable: true,
	} );
	jest.spyOn( scrollArea, 'getBoundingClientRect' ).mockReturnValue( {
		left: 0,
		right: 200,
		top: 0,
		bottom: 100,
		width: 200,
		height: 100,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
	} );

	const callbacks = new Map< number, FrameRequestCallback >();
	let nextFrameId = 1;
	const view = scrollArea.ownerDocument.defaultView!;
	jest.spyOn( view, 'requestAnimationFrame' ).mockImplementation( ( callback ) => {
		const frameId = nextFrameId++;
		callbacks.set( frameId, callback );
		return frameId;
	} );
	jest.spyOn( view, 'cancelAnimationFrame' ).mockImplementation( ( frameId ) => {
		callbacks.delete( frameId );
	} );

	return {
		cell,
		scrollArea,
		runNextFrame: () => {
			const entry = callbacks.entries().next().value as
				| [ number, FrameRequestCallback ]
				| undefined;
			if ( entry === undefined ) {
				return false;
			}
			callbacks.delete( entry[ 0 ] );
			entry[ 1 ]( 0 );
			return true;
		},
		getPendingFrameCount: () => callbacks.size,
	};
};

describe( 'Column horizontal auto scroll', () => {
	afterEach( () => {
		document.body.replaceChildren();
		jest.restoreAllMocks();
	} );

	/**
	 * ポインターが右端領域に留まる間、自動スクロールが継続することを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableに横スクロール可能な領域がある。
	 * - ポインターがその右端領域内にある。
	 *
	 * 操作:
	 * - ポインター位置を1回通知し、複数描画フレームを進行させる。
	 *
	 * 期待結果:
	 * - ポインターの追加移動がなくてもscroll位置が描画フレームごとに進む。
	 * - 各実スクロール後に移動先再解決の通知が行われる。
	 */
	it( 'when pointer remains in the right edge area, should continue horizontal scrolling without additional pointer moves', () => {
		const { cell, scrollArea, runNextFrame } = createScrollableTable();
		const onScroll = jest.fn();
		const autoScroll = createColumnHorizontalAutoScroll( onScroll );
		autoScroll.start( cell );
		autoScroll.updatePointer( { clientX: 190, clientY: 50 } );

		expect( runNextFrame() ).toBe( true );
		expect( scrollArea.scrollLeft ).toBe( 116 );
		expect( runNextFrame() ).toBe( true );
		expect( scrollArea.scrollLeft ).toBe( 132 );
		expect( onScroll ).toHaveBeenCalledTimes( 2 );
	} );

	/**
	 * ポインターが左端領域にある場合、右端と対称に左方向へスクロールすることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableに横スクロール可能な領域がある。
	 * - ポインターがその左端領域内にある。
	 *
	 * 操作:
	 * - ポインター位置を通知して1描画フレーム進行させる。
	 *
	 * 期待結果:
	 * - scroll位置が左方向へ進む。
	 * - 実スクロール後に移動先再解決の通知が行われる。
	 */
	it( 'when pointer is in the left edge area, should scroll horizontally toward the left', () => {
		const { cell, scrollArea, runNextFrame } = createScrollableTable();
		const onScroll = jest.fn();
		const autoScroll = createColumnHorizontalAutoScroll( onScroll );
		autoScroll.start( cell );
		autoScroll.updatePointer( { clientX: 10, clientY: 50 } );

		expect( runNextFrame() ).toBe( true );
		expect( scrollArea.scrollLeft ).toBe( 84 );
		expect( onScroll ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 対象スクロール領域の外側にあるポインターから自動スクロールを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableに横スクロール可能な領域がある。
	 *
	 * 操作:
	 * - 対象領域の左右外側と上下外側のポインター位置を順に通知する。
	 *
	 * 期待結果:
	 * - いずれの位置でも自動スクロール用の描画フレームは予約されない。
	 */
	it( 'when pointer is outside the scroll area, should not start horizontal auto scroll', () => {
		const { cell, getPendingFrameCount } = createScrollableTable();
		const autoScroll = createColumnHorizontalAutoScroll( jest.fn() );
		autoScroll.start( cell );

		autoScroll.updatePointer( { clientX: -10, clientY: 50 } );
		expect( getPendingFrameCount() ).toBe( 0 );
		autoScroll.updatePointer( { clientX: 210, clientY: 50 } );
		expect( getPendingFrameCount() ).toBe( 0 );
		autoScroll.updatePointer( { clientX: 10, clientY: -10 } );
		expect( getPendingFrameCount() ).toBe( 0 );
		autoScroll.updatePointer( { clientX: 190, clientY: 110 } );
		expect( getPendingFrameCount() ).toBe( 0 );
	} );

	/**
	 * スクロール限界へ到達した場合に不要な描画フレーム予約を継続しないことを確認する。
	 *
	 * 事前条件:
	 * - ポインターが右端領域内にある。
	 * - scroll位置がそれ以上変化しない状態である。
	 *
	 * 操作:
	 * - 自動スクロールの描画フレームを1回進行させる。
	 *
	 * 期待結果:
	 * - 移動先再解決は行われない。
	 * - 次の描画フレームは予約されない。
	 */
	it( 'when scrolling cannot advance at the current edge, should stop the auto scroll loop', () => {
		const { cell, scrollArea, runNextFrame, getPendingFrameCount } = createScrollableTable();
		Object.defineProperty( scrollArea, 'scrollLeft', {
			get: () => 300,
			set: () => undefined,
			configurable: true,
		} );
		const onScroll = jest.fn();
		const autoScroll = createColumnHorizontalAutoScroll( onScroll );
		autoScroll.start( cell );
		autoScroll.updatePointer( { clientX: 190, clientY: 50 } );

		expect( runNextFrame() ).toBe( true );
		expect( onScroll ).not.toHaveBeenCalled();
		expect( getPendingFrameCount() ).toBe( 0 );
	} );

	/**
	 * 限界停止後にポインターが再びスクロール可能な端領域へ動いた場合に再開できることを確認する。
	 *
	 * 事前条件:
	 * - 直前の自動スクロールはscroll位置が変化せず停止している。
	 *
	 * 操作:
	 * - scroll可能状態へ戻した後、ポインター位置を再通知する。
	 *
	 * 期待結果:
	 * - 新しい描画フレームが予約され、自動スクロールが再開する。
	 */
	it( 'when pointer moves again after an edge stop, should restart if horizontal scrolling is possible', () => {
		const { cell, scrollArea, runNextFrame, getPendingFrameCount } = createScrollableTable();
		let blocked = true;
		let currentScrollLeft = 100;
		Object.defineProperty( scrollArea, 'scrollLeft', {
			get: () => currentScrollLeft,
			set: ( value: number ) => {
				if ( ! blocked ) {
					currentScrollLeft = value;
				}
			},
			configurable: true,
		} );
		const autoScroll = createColumnHorizontalAutoScroll( jest.fn() );
		autoScroll.start( cell );
		autoScroll.updatePointer( { clientX: 190, clientY: 50 } );
		runNextFrame();
		expect( getPendingFrameCount() ).toBe( 0 );

		blocked = false;
		autoScroll.updatePointer( { clientX: 189, clientY: 50 } );
		expect( getPendingFrameCount() ).toBe( 1 );
		runNextFrame();
		expect( currentScrollLeft ).toBe( 116 );
	} );

	/**
	 * DnD終了時に描画フレームと対象参照を破棄することを確認する。
	 *
	 * 事前条件:
	 * - 自動スクロール用の描画フレームが予約されている。
	 *
	 * 操作:
	 * - DnD終了としてstopを要求する。
	 *
	 * 期待結果:
	 * - 予約済み描画フレームは破棄される。
	 * - その後に描画フレーム処理は進行しない。
	 */
	it( 'when column drag stops, should cancel the pending frame and discard session auto scroll state', () => {
		const { cell, getPendingFrameCount, runNextFrame } = createScrollableTable();
		const autoScroll = createColumnHorizontalAutoScroll( jest.fn() );
		autoScroll.start( cell );
		autoScroll.updatePointer( { clientX: 190, clientY: 50 } );
		expect( getPendingFrameCount() ).toBe( 1 );

		autoScroll.stop();
		expect( getPendingFrameCount() ).toBe( 0 );
		expect( runNextFrame() ).toBe( false );
	} );
} );
