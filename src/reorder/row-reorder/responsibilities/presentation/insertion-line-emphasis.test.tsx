/**
 * Row Reorderの挿入線強調が、移動先境界の変更時だけ再開始されるLifecycleを確認する。
 *
 * Table位置の再計測では現在の挿入線表示を維持し、移動先境界が変わった場合だけ新しい境界表示へ切り替わることを検証する。
 */

import { act, render } from '@testing-library/react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { RowInsertionLine } from './insertion-line';

let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: () => void;
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
 * 挿入線の表示条件を必要な値だけで表せるDOM矩形を作成する。
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

/** 挿入線の境界変更Lifecycleを確認できる2行の対象Tableを用意する。 */
const createSourceTable = () => {
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
		.mockReturnValue( rectangle( { left: 0, right: 240, width: 240 } ) );
	jest
		.spyOn( tbody, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 80, bottom: 170, height: 90 } ) );
	jest
		.spyOn( first, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 80, bottom: 120, height: 40 } ) );
	jest
		.spyOn( second, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { top: 120, bottom: 170, height: 50 } ) );

	return first;
};

describe( 'Row insertion line emphasis lifecycle', () => {
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
	 * Table位置の再計測では強調対象を再生成せず、移動先境界の変更時だけ新しい挿入線表示へ切り替わることを確認する。
	 *
	 * 事前条件:
	 * - Row DnD中に有効な移動先境界が表示されている。
	 *
	 * 操作:
	 * - 同じ移動先境界のままTable位置の再計測を発生させる。
	 * - その後、別の移動先境界へ変更する。
	 *
	 * 期待結果:
	 * - 再計測だけでは同じ挿入線表示が維持される。
	 * - 移動先境界が変わった場合は新しい挿入線表示へ切り替わる。
	 */
	it( 'when measurement changes without a new destination, should restart the insertion emphasis only after the destination boundary changes', () => {
		const sourceRow = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );

		act( () => {
			mockDragDropMonitor.onDragStart?.( {
				operation: { source: { element: sourceRow } },
			} );
		} );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionLine /> );

		const initialLine = document.querySelector( '.yamabiko-table-reorder-insertion-line' );
		expect( initialLine ).not.toBeNull();

		act( () => {
			mockDragDropMonitor.onDragMove?.();
		} );

		const remeasuredLine = document.querySelector( '.yamabiko-table-reorder-insertion-line' );
		expect( remeasuredLine ).toBe( initialLine );

		mockDestinationBoundaryIndex = 1;
		rerender( <RowInsertionLine /> );

		const changedBoundaryLine = document.querySelector( '.yamabiko-table-reorder-insertion-line' );
		expect( changedBoundaryLine ).not.toBe( initialLine );
	} );
} );
