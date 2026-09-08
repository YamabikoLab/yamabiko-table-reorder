/**
 * Column Highlightが、同一Tableのデータrevision更新後に更新前のResolver snapshotを持ち越さないことを確認する。
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
 * 同一Table更新時のHighlight Lifecycleを確認する最小Tableを描画する。
 *
 * @param props               描画条件。
 * @param props.tableRevision WordPress Integrationが提供する同一Tableデータの不透明なrevision。
 * @return Column Highlightへ接続されたTable。
 */
const TestTable = ( props: { tableRevision: unknown } ) => (
	<ColumnHighlight enabled tableIdentity="table-a" tableRevision={ props.tableRevision }>
		{ ( onPointerOverCapture ) => (
			<div onPointerOverCapture={ onPointerOverCapture }>
				<table>
					<tbody>
						<tr>
							<td data-testid="first-cell">A</td>
							<td>B</td>
						</tr>
					</tbody>
				</table>
			</div>
		) }
	</ColumnHighlight>
);

describe( 'Column highlight table revision lifecycle', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * Undo等で同じTable IdentityのTableデータが更新された場合に、更新前の開始可否判断を再利用しないことを確認する。
	 *
	 * 事前条件:
	 * - 同じTable Identityで、更新前は1列目が開始可能と解決される。
	 * - Table更新後は同じ論理列が結合範囲により開始拒否と解決される。
	 *
	 * 操作:
	 * - 更新前に1列目をホバーしてResolver snapshotを生成する。
	 * - 同一Tableのデータrevisionを更新する。
	 * - 1列目を再度ホバーする。
	 *
	 * 期待結果:
	 * - 更新前の操作可能表示はrevision更新時に終了する。
	 * - 次のホバーでは新しいTarget Resolverが生成され、現在構造の開始拒否表示になる。
	 */
	it( 'when the same table revision changes, should rebuild the target resolver before the next highlight', () => {
		const initialResolve = jest.fn( () => ( {
			status: 'resolved' as const,
			target: { tableIdentity: 'table-a', sourceColumnIndex: 0 },
			initialConstraints: { columnCount: 2, blockedBoundaries: [] },
		} ) );
		const refreshedResolve = jest.fn( () => ( {
			status: 'rejected' as const,
			reason: 'merged-range' as const,
		} ) );
		createResolverMock
			.mockReturnValueOnce( { resolve: initialResolve } )
			.mockReturnValueOnce( { resolve: refreshedResolve } );
		const initialRevision = { body: [] };
		const { getByTestId, rerender } = render( <TestTable tableRevision={ initialRevision } /> );
		const cell = getByTestId( 'first-cell' );

		fireEvent.pointerOver( cell );
		expect( cell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );

		rerender( <TestTable tableRevision={ { body: [ { cells: [] } ] } } /> );
		expect( cell.className ).toBe( '' );

		fireEvent.pointerOver( cell );

		expect( createResolverMock ).toHaveBeenCalledTimes( 2 );
		expect( initialResolve ).toHaveBeenCalledWith( 0 );
		expect( refreshedResolve ).toHaveBeenCalledWith( 0 );
		expect( cell.className ).toBe( 'yamabiko-table-reorder-column-unavailable-cell' );
	} );
} );
