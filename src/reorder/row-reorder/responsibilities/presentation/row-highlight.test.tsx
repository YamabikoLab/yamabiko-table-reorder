/**
 * Row Reorderの行ホバー表示が、Reorder ModeとReorder Target Resolutionの開始可否に従って操作可能・移動不可を表示することを確認する。
 */

import { act, fireEvent, render } from '@testing-library/react';

import { reorderMode } from '@/reorder/reorder-mode';
import { rowReorderTargetResolution } from '@/reorder/row-reorder/responsibilities/target-resolution';

import { RowHighlight } from './row-highlight';

jest.mock( '@/reorder/row-reorder/responsibilities/dnd-interaction', () => ( {
	getRowDndPhase: () => 'idle',
	subscribeRowDndState: () => () => {},
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/target-resolution', () => ( {
	rowReorderTargetResolution: {
		createResolver: jest.fn(),
	},
} ) );

const createResolverMock = rowReorderTargetResolution.createResolver as jest.MockedFunction<
	typeof rowReorderTargetResolution.createResolver
>;

const resetReorderMode = () => {
	act( () => {
		reorderMode.observeTable( '__row-highlight-test-reset__' );
	} );
};

const TestTable = () => (
	<RowHighlight tableIdentity="table-a">
		{ ( onPointerOverCapture ) => (
			<div data-testid="wrapper" onPointerOverCapture={ onPointerOverCapture }>
				<table>
					<tbody>
						<tr data-testid="row-0"><td>First</td></tr>
						<tr data-testid="row-1"><td>Second</td></tr>
						<tr data-testid="row-2"><td>Third</td></tr>
					</tbody>
				</table>
			</div>
		) }
	</RowHighlight>
);

describe( 'Row highlight', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		resetReorderMode();
		act( () => {
			reorderMode.select( 'row', 'table-a' );
		} );
		createResolverMock.mockReturnValue( {
			resolve: ( sourceRowIndex ) => ( {
				status: 'resolved',
				target: { tableIdentity: 'table-a', sourceRowIndex },
				initialConstraints: { rowCount: 3, blockedBoundaries: [] },
			} ),
		} );
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * Target Resolutionが開始可能とした行だけが操作可能表示の対象になることを確認する。
	 *
	 * 期待結果:
	 * - 3行目だけがホバー表示対象として識別される。
	 */
	it( 'when target resolution resolves the hovered row, should mark only that row as highlightable', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-0' ).className ).toBe( '' );
		expect( getByTestId( 'row-1' ).className ).toBe( '' );
		expect( getByTestId( 'row-2' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );
	} );

	/**
	 * 結合範囲により開始拒否となる行を移動不可表示として識別できることを確認する。
	 *
	 * 期待結果:
	 * - 既存表示が解除され、拒否対象行に移動不可表示が付く。
	 */
	it( 'when target resolution rejects the hovered row, should show the row as unavailable', () => {
		createResolverMock.mockReturnValue( {
			resolve: ( sourceRowIndex ) =>
				sourceRowIndex === 1
					? { status: 'rejected', reason: 'merged-range' }
					: {
							status: 'resolved',
							target: { tableIdentity: 'table-a', sourceRowIndex },
							initialConstraints: { rowCount: 3, blockedBoundaries: [ 1 ] },
					  },
		} );
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-2' ).className ).toBe( '' );
		expect( getByTestId( 'row-1' ).className ).toBe( 'yamabiko-table-reorder-row-unavailable' );
	} );

	/**
	 * Target Resolutionが利用不能の場合は可否表示を推測しないことを確認する。
	 */
	it( 'when target resolution returns unavailable, should not mark the hovered row with an availability state', () => {
		createResolverMock.mockReturnValue( { resolve: () => ( { status: 'unavailable' } ) } );
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-2' ).className ).toBe( '' );
	} );

	/**
	 * Row Reorder Mode離脱時に表示を即時破棄し、その後の通常編集入力で再表示しないことを確認する。
	 *
	 * 操作:
	 * - 表示成立後に同じToolbar入口を再選択して通常編集へ戻し、別行へポインターを移動する。
	 *
	 * 期待結果:
	 * - 既存表示が解除され、通常編集では新しい表示も付かない。
	 */
	it( 'when row reorder mode ends, should clear the current row state and stop marking rows', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( getByTestId( 'row-2' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );

		act( () => {
			reorderMode.select( 'row', 'table-a' );
		} );
		expect( getByTestId( 'row-2' ).className ).toBe( '' );

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( getByTestId( 'row-0' ).className ).toBe( '' );
	} );
} );
