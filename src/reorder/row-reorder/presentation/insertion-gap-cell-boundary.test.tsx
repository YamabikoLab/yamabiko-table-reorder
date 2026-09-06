/**
 * Row Reorderの挿入空間が、移動元行のセル境界をTable上の列区切りとして維持することを確認する。
 */

import { act, render } from '@testing-library/react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { RowInsertionGap } from './insertion-gap';

let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/row-reorder/dnd-interaction-react', () => ( {
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
 * 挿入空間の表示条件を必要な値だけで表せるDOM矩形を作成する。
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

describe( 'Row insertion gap cell boundaries', () => {
	beforeEach( () => {
		mockDestinationBoundaryIndex = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: { innerWidth: 500, innerHeight: 600 } as Window,
		} );
	} );

	/**
	 * 概要:
	 * - 挿入空間内の列区切りが移動対象行のセル右境界と一致することを確認する。
	 *
	 * 事前条件:
	 * - Table左端は画面上50pxで、移動対象行は幅100px、150px、200pxの3セルを持つ。
	 * - 移動対象行を最後の要素の後ろへ移動できる。
	 *
	 * 操作:
	 * - 対象行でDnDを開始し、末尾境界を有効な移動先として表示する。
	 *
	 * 期待結果:
	 * - 挿入空間には1列目と2列目の右境界に対応する2本の区切りだけが表示される。
	 */
	it( 'when the source row has multiple cells, should preserve its internal cell boundaries in the insertion gap', () => {
		const table = document.createElement( 'table' );
		const tbody = document.createElement( 'tbody' );
		const sourceRow = document.createElement( 'tr' );
		const otherRow = document.createElement( 'tr' );
		const sourceCells = [ 100, 150, 200 ].map( ( width ) => {
			const cell = document.createElement( 'td' );
			jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue(
				rectangle( {
					width,
					right: 50 + sourceRow.cells.length * 100 + width,
				} )
			);
			return cell;
		} );
		sourceRow.append( ...sourceCells );
		otherRow.appendChild( document.createElement( 'td' ) );
		tbody.append( sourceRow, otherRow );
		table.appendChild( tbody );
		document.body.appendChild( table );

		jest
			.spyOn( table, 'getBoundingClientRect' )
			.mockReturnValue( rectangle( { left: 50, right: 500, width: 450 } ) );
		jest
			.spyOn( tbody, 'getBoundingClientRect' )
			.mockReturnValue( rectangle( { top: 100, bottom: 180, height: 80 } ) );
		jest
			.spyOn( sourceRow, 'getBoundingClientRect' )
			.mockReturnValue( rectangle( { top: 100, bottom: 140, height: 40 } ) );
		jest
			.spyOn( otherRow, 'getBoundingClientRect' )
			.mockReturnValue( rectangle( { top: 140, bottom: 180, height: 40 } ) );
		jest
			.spyOn( sourceCells[ 0 ], 'getBoundingClientRect' )
			.mockReturnValue( rectangle( { left: 50, right: 150, width: 100 } ) );
		jest
			.spyOn( sourceCells[ 1 ], 'getBoundingClientRect' )
			.mockReturnValue( rectangle( { left: 150, right: 300, width: 150 } ) );
		jest
			.spyOn( sourceCells[ 2 ], 'getBoundingClientRect' )
			.mockReturnValue( rectangle( { left: 300, right: 500, width: 200 } ) );

		const { rerender } = render( <RowInsertionGap /> );
		act( () => {
			mockDragDropMonitor.onDragStart?.( {
				operation: { source: { element: sourceRow } },
			} );
		} );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionGap /> );

		const boundaries = document.querySelectorAll(
			'.yamabiko-table-reorder-insertion-gap-cell-boundary'
		);
		expect( boundaries ).toHaveLength( 2 );
		expect( ( boundaries.item( 0 ) as HTMLElement ).style.left ).toBe( '100px' );
		expect( ( boundaries.item( 1 ) as HTMLElement ).style.left ).toBe( '250px' );
	} );
} );
