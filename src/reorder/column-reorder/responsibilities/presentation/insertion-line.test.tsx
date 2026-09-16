/**
 * Column Reorderの挿入線表示が、DnD Interactionの移動先境界を開始時の論理列配置へ直接対応させることを確認する。
 *
 * 移動先解決そのものは重複して検証せず、null時の非表示、LTR / RTLの論理境界表示、scroll時の再計測、
 * およびDnD終了・Presentation終了時の解除を検証する。
 */

import { act, render } from '@testing-library/react';

import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { ColumnInsertionLine } from './insertion-line';

let mockDestinationBoundaryIndex: number | null = null;
let mockAnimationFrameCallback: FrameRequestCallback | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: () => void;
	onDragEnd?: () => void;
} = {};

const requestAnimationFrameMock = jest.fn( ( callback: FrameRequestCallback ): number => {
	mockAnimationFrameCallback = callback;
	return 1;
} );
const cancelAnimationFrameMock = jest.fn();

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@/reorder/column-reorder/infrastructure/column-geometry', () => ( {
	measureTableColumnBoundaryGeometry: jest.fn(),
	resolveTableColumnInlineDirection: jest.fn(),
} ) );

jest.mock( '@/reorder/editor-dom-context', () => ( {
	resolveEditorDomContext: jest.fn(),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

const measureTableColumnBoundaryGeometryMock =
	measureTableColumnBoundaryGeometry as jest.MockedFunction<
		typeof measureTableColumnBoundaryGeometry
	>;
const resolveTableColumnInlineDirectionMock =
	resolveTableColumnInlineDirection as jest.MockedFunction<
		typeof resolveTableColumnInlineDirection
	>;
const resolveEditorDomContextMock = resolveEditorDomContext as jest.MockedFunction<
	typeof resolveEditorDomContext
>;

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

const createSourceTable = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const sourceCell = document.createElement( 'td' );
	row.appendChild( sourceCell );
	tbody.appendChild( row );
	table.appendChild( tbody );
	document.body.appendChild( table );

	const tableRectangleMock = jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: -100,
			bottom: 700,
			left: 40,
			right: 440,
			width: 400,
			height: 800,
		} )
	);

	return { table, sourceCell, tableRectangleMock };
};

const startPhysicalDrag = ( sourceCell: HTMLTableCellElement ): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: { source: { element: sourceCell } },
		} );
	} );
};

const flushAnimationFrame = (): void => {
	const callback = mockAnimationFrameCallback;
	mockAnimationFrameCallback = null;
	act( () => {
		callback?.( 0 );
	} );
};

describe( 'Column insertion line', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockDestinationBoundaryIndex = null;
		mockAnimationFrameCallback = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		measureTableColumnBoundaryGeometryMock.mockReturnValue( [
			{ index: 0, offset: 0 },
			{ index: 1, offset: 80 },
			{ index: 2, offset: 200 },
			{ index: 3, offset: 260 },
			{ index: 4, offset: 400 },
		] );
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'ltr' );
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: {
				innerWidth: 500,
				innerHeight: 600,
				requestAnimationFrame: requestAnimationFrameMock,
				cancelAnimationFrame: cancelAnimationFrameMock,
			} as unknown as NonNullable< Document[ 'defaultView' ] >,
		} );
	} );

	it( 'when the destination boundary is null, should not show an insertion line', () => {
		const { sourceCell } = createSourceTable();
		render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );

		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeNull();
	} );

	it( 'when an LTR destination boundary is valid, should show the line directly at that logical boundary', () => {
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 2;
		rerender( <ColumnInsertionLine /> );

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '240px' );
		expect( line?.style.top ).toBe( '0px' );
		expect( line?.style.height ).toBe( '600px' );
	} );

	it( 'when the table is RTL, should map the logical destination boundary to the corresponding physical position', () => {
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'rtl' );
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 1;
		rerender( <ColumnInsertionLine /> );

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '360px' );
	} );

	it( 'when an editor descendant scrolls without another drag move, should follow the current table position through the captured scroll event', () => {
		const { table, sourceCell, tableRectangleMock } = createSourceTable();
		const scrollContainer = document.createElement( 'div' );
		document.body.appendChild( scrollContainer );
		scrollContainer.appendChild( table );
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionLine /> );

		tableRectangleMock.mockReturnValue(
			rectangle( {
				top: -100,
				bottom: 700,
				left: 10,
				right: 410,
				width: 400,
				height: 800,
			} )
		);
		act( () => {
			scrollContainer.dispatchEvent( new Event( 'scroll' ) );
		} );
		flushAnimationFrame();

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '410px' );
		expect( measureTableColumnBoundaryGeometryMock ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'when the drag or presentation ends, should clear the line and cancel a pending scroll measurement', () => {
		const { table, sourceCell } = createSourceTable();
		const scrollContainer = document.createElement( 'div' );
		document.body.appendChild( scrollContainer );
		scrollContainer.appendChild( table );
		const { rerender, unmount } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnInsertionLine /> );

		act( () => {
			mockDragDropMonitor.onDragEnd?.();
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeNull();

		startPhysicalDrag( sourceCell );
		rerender( <ColumnInsertionLine /> );
		act( () => {
			scrollContainer.dispatchEvent( new Event( 'scroll' ) );
		} );
		unmount();

		expect( cancelAnimationFrameMock ).toHaveBeenCalledWith( 1 );
	} );
} );
