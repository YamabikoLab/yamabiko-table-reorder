import { ensureSortableRuntime } from '@/common/sortable-runtime-loader';
import { createSortableController } from './sortable-controller';
import {
	createSortableRuntime as createRuntime,
	createTableContext,
} from './sortable-controller.test-utils';

jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children }: { children: unknown } ) => children,
} ) );

jest.mock( '@/common/sortable-runtime-loader', () => ( {
	ensureSortableRuntime: jest.fn(),
} ) );

const ensureSortableRuntimeMock = ensureSortableRuntime as jest.MockedFunction<
	typeof ensureSortableRuntime
>;

const flushPromises = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe( 'createSortableController focus fallback', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		ensureSortableRuntimeMock.mockReset();
	} );

	it( 'skips a cellless row and focuses the next row control', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createTableContext( 2 );
		tbody.rows.item( 0 )?.replaceChildren();
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			rows: [ 'a', 'b' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		expect( controller.focusRowControl() ).toBe( 'focused' );
		expect( tbody.ownerDocument.activeElement ).toBe(
			tbody.rows.item( 1 )?.querySelector( '.yamabiko-table-reorder-handle-zone' )
		);
		controller.destroy();
	} );

	it( 'reports no movable rows when no row can create a control', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createTableContext( 2 );
		Array.from( tbody.rows ).forEach( ( row ) => row.replaceChildren() );
		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			rows: [ 'a', 'b' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		expect( controller.focusRowControl() ).toBe( 'no-movable-rows' );
		controller.destroy();
	} );
} );
