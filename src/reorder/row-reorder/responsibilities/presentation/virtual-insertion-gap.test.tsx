/**
 * Row ReorderのVirtual Insertion Gapが、移動先境界と移動元行高からdrop後の行領域を正しく示すことを確認する。
 *
 * 移動先解決そのものは重複して検証せず、上方向・下方向の展開規則と実測行高の反映を確認する。
 */

import { act, render } from '@testing-library/react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { RowInsertionLine } from './insertion-line';

let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/row-reorder/integration/dnd-interaction-react', () => ( {
	useRowDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@/reorder/editor-dom-context', () => ( {
	resolveEditorDomContext: jest.fn(),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

const resolveEditorDomContextMock = resolveEditorDomContext as jest.MockedFunction<
	typeof resolveEditorDomContext
>;

/**
 * Virtual Insertion Gapの配置条件を必要な値だけで表せるDOM矩形を作成する。
 *
 * @param values テスト条件として上書きする表示寸法と位置。
 * @return 指定値以外を0としたDOM矩形。
 */
const rectangle = ( values: Partial< DOMRect > ): DOMRect =>
	( {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		width: 0,
		height: 0,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
		...values,
	} ) as DOMRect;

/**
 * Virtual Insertion Gapの成立条件を満たす2行の対象Tableを用意する。
 *
 * @param firstHeight  先頭行の実測高さとして扱う値。
 * @param secondHeight 2行目の実測高さとして扱う値。
 * @return DnD開始元として利用する2行。
 */
const createSourceTable = ( firstHeight = 40, secondHeight = 50 ) => {
	const tableTop = 80;
	const firstBottom = tableTop + firstHeight;
	const secondBottom = firstBottom + secondHeight;
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const first = document.createElement( 'tr' );
	const second = document.createElement( 'tr' );
	first.appendChild( document.createElement( 'td' ) );
	second.appendChild( document.createElement( 'td' ) );
	tbody.append( first, second );
	table.appendChild( tbody );
	document.body.appendChild( table );

	jest
		.spyOn( table, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { left: -20, right: 300, width: 320 } ) );
	jest
		.spyOn( tbody, 'getBoundingClientRect' )
		.mockReturnValue(
			rectangle( { top: tableTop, bottom: secondBottom, height: firstHeight + secondHeight } )
		);
	jest.spyOn( first, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: tableTop,
			bottom: firstBottom,
			height: firstHeight,
		} )
	);
	jest.spyOn( second, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: firstBottom,
			bottom: secondBottom,
			height: secondHeight,
		} )
	);

	return { first, second };
};

/**
 * DnD Engineから対象行の物理DnD開始が通知された状態を作る。
 *
 * @param row 物理DnDの移動対象として通知する行。
 */
const startPhysicalDrag = ( row: HTMLTableRowElement ) => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: { source: { element: row } },
		} );
	} );
};

describe( 'Row virtual insertion gap', () => {
	beforeEach( () => {
		mockDestinationBoundaryIndex = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: { innerWidth: 240, innerHeight: 600 } as unknown as NonNullable<
				Document[ 'defaultView' ]
			>,
		} );
	} );

	/**
	 * 概要:
	 * - 下方向の移動では、drop後に移動行が占める領域をdestination boundaryの上側へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 先頭の40px行を最終境界へ移動している。
	 *
	 * 操作:
	 * - 境界2を有効な移動先として表示する。
	 *
	 * 期待結果:
	 * - Virtual Insertion Gapは最終境界の上側40pxへ表示される。
	 * - 表示幅は現在表示領域とTableが重なる横幅に制限される。
	 */
	it( 'when a row moves downward, should show the measured source-row area above the destination boundary', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-virtual-insertion-gap'
		) as HTMLElement;
		expect( gap ).not.toBeNull();
		expect( gap.style.top ).toBe( '130px' );
		expect( gap.style.height ).toBe( '40px' );
		expect( gap.style.left ).toBe( '0px' );
		expect( gap.style.width ).toBe( '240px' );
	} );

	/**
	 * 概要:
	 * - 上方向の移動では、drop後に移動行が占める領域をdestination boundaryの下側へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 2行目の50px行を先頭境界へ移動している。
	 *
	 * 操作:
	 * - 境界0を有効な移動先として表示する。
	 *
	 * 期待結果:
	 * - Virtual Insertion Gapは先頭境界の下側50pxへ表示される。
	 */
	it( 'when a row moves upward, should show the measured source-row area below the destination boundary', () => {
		const { second } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( second );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionLine /> );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-virtual-insertion-gap'
		) as HTMLElement;
		expect( gap ).not.toBeNull();
		expect( gap.style.top ).toBe( '80px' );
		expect( gap.style.height ).toBe( '50px' );
	} );

	/**
	 * 概要:
	 * - 高さのある移動元行でも固定値ではなく実測高さをVirtual Insertion Gapへ反映することを確認する。
	 *
	 * 事前条件:
	 * - 先頭行は90pxの高さで描画されている。
	 *
	 * 操作:
	 * - 最終境界を有効な移動先として表示する。
	 *
	 * 期待結果:
	 * - Virtual Insertion Gapは移動元行と同じ90pxの高さになる。
	 */
	it( 'when the source row has a taller measured height, should preserve that height in the virtual insertion gap', () => {
		const { first } = createSourceTable( 90, 50 );
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );

		const gap = document.querySelector(
			'.yamabiko-table-reorder-virtual-insertion-gap'
		) as HTMLElement;
		expect( gap.style.top ).toBe( '130px' );
		expect( gap.style.height ).toBe( '90px' );
	} );
} );
