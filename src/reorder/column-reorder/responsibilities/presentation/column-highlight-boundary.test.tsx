/**
 * Column Reorderの列ホバー表示が、Block境界を離れたときだけ現在列の一時表示を終了することを確認する。
 */

import { fireEvent, render } from '@testing-library/react';

import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';

import { ColumnHighlight } from './column-highlight';

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndPhase: () => 'idle',
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/target-resolution', () => ( {
	columnReorderTargetResolution: {
		createResolver: jest.fn(),
	},
} ) );

const createResolverMock = columnReorderTargetResolution.createResolver as jest.MockedFunction<
	typeof columnReorderTargetResolution.createResolver
>;

/**
 * 列表示の確認に必要な可視矩形を生成する。
 *
 * @param left 横位置。
 * @return editor表示領域内の矩形。
 */
const createRectangle = ( left: number ): DOMRect =>
	( {
		left,
		top: 20,
		width: 100,
		height: 40,
		right: left + 100,
		bottom: 60,
		x: left,
		y: 20,
		toJSON: () => ( {} ),
	} ) as DOMRect;

/**
 * Block境界の開始・終了入力をColumn Highlightへ接続したTableを描画する。
 *
 * @return Column Highlightへ接続されたTable。
 */
const TestTable = () => (
	<ColumnHighlight enabled tableIdentity="table-a">
		{ ( onPointerOverCapture, onPointerOutCapture ) => (
			<div
				data-testid="wrapper"
				onPointerOverCapture={ onPointerOverCapture }
				onPointerOutCapture={ onPointerOutCapture }
			>
				<table data-testid="table">
					<tbody>
						<tr>
							<td data-testid="column-0">A</td>
							<td data-testid="column-1">B</td>
						</tr>
					</tbody>
				</table>
			</div>
		) }
	</ColumnHighlight>
);

describe( 'Column highlight boundary lifecycle', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		createResolverMock.mockReturnValue( {
			resolve: jest.fn( ( sourceColumnIndex: number ) => ( {
				status: 'resolved',
				target: { tableIdentity: 'table-a', sourceColumnIndex },
				initialConstraints: { columnCount: 2, blockedBoundaries: [] },
			} ) ),
		} );
	} );

	/**
	 * Block内部の要素間移動では表示を維持し、Block境界を離れた場合だけ一時表示を終了することを確認する。
	 *
	 * 事前条件:
	 * - 列並び替えモード中に1列目へ操作可能表示が出ている。
	 *
	 * 操作:
	 * - Block内部の別セルへポインターを移動する。
	 * - 続いてBlock外へポインターを移動する。
	 *
	 * 期待結果:
	 * - Block内部の移動では現在列の一時表示を維持する。
	 * - Block外へ移動した時点でセル状態と列オーバーレイを解除する。
	 */
	it( 'when the pointer leaves the block boundary, should clear the temporary column highlight', () => {
		const { getByTestId } = render( <TestTable /> );
		const wrapper = getByTestId( 'wrapper' );
		const table = getByTestId( 'table' );
		const firstCell = getByTestId( 'column-0' );
		const secondCell = getByTestId( 'column-1' );

		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( {
			...createRectangle( 10 ),
			height: 200,
			bottom: 220,
		} as DOMRect );
		jest.spyOn( firstCell, 'getBoundingClientRect' ).mockReturnValue( createRectangle( 10 ) );
		jest.spyOn( secondCell, 'getBoundingClientRect' ).mockReturnValue( createRectangle( 110 ) );

		fireEvent.pointerOver( firstCell );
		expect( firstCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();

		fireEvent.pointerOut( firstCell, { relatedTarget: secondCell } );
		expect( firstCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();

		fireEvent.pointerOut( wrapper, { relatedTarget: document.body } );
		expect( firstCell.className ).toBe( '' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
	} );
} );
