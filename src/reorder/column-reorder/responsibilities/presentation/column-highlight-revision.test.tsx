/**
 * Column Highlightが、同一TableのBlockデータ更新後に更新前のResolver snapshotを持ち越さないことを確認する。
 */

import { act, fireEvent, render } from '@testing-library/react';

import { subscribeColumnTableRevision } from '@/reorder/column-reorder/integration/table-revision';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';

import { ColumnHighlight } from './column-highlight';

let mockTableRevisionListener: ( () => void ) | null = null;

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndPhase: () => 'idle',
} ) );

jest.mock( '@/reorder/column-reorder/integration/table-revision', () => ( {
	subscribeColumnTableRevision: jest.fn( ( _tableIdentity: string, listener: () => void ) => {
		mockTableRevisionListener = listener;
		return jest.fn();
	} ),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/target-resolution', () => ( {
	columnReorderTargetResolution: {
		createResolver: jest.fn(),
	},
} ) );

const subscribeColumnTableRevisionMock = subscribeColumnTableRevision as jest.MockedFunction<
	typeof subscribeColumnTableRevision
>;
const createResolverMock = columnReorderTargetResolution.createResolver as jest.MockedFunction<
	typeof columnReorderTargetResolution.createResolver
>;

/** 同一Table更新時のHighlight Lifecycleを確認する最小Tableを描画する。 */
const TestTable = () => (
	<ColumnHighlight enabled tableIdentity="table-a">
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
		mockTableRevisionListener = null;
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
	 * - 同一TableのBlockデータ更新を通知する。
	 * - 1列目を再度ホバーする。
	 *
	 * 期待結果:
	 * - 更新前の操作可能表示はTable更新時に終了する。
	 * - 次のホバーでは新しいTarget Resolverが生成され、現在構造の開始拒否表示になる。
	 */
	it( 'when the same table data changes, should rebuild the target resolver before the next highlight', () => {
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
		const { getByTestId } = render( <TestTable /> );
		const cell = getByTestId( 'first-cell' );

		fireEvent.pointerOver( cell );
		expect( cell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );

		act( () => {
			mockTableRevisionListener?.();
		} );
		expect( cell.className ).toBe( '' );

		fireEvent.pointerOver( cell );

		expect( subscribeColumnTableRevisionMock ).toHaveBeenCalledWith(
			'table-a',
		expect.any( Function )
		);
		expect( createResolverMock ).toHaveBeenCalledTimes( 2 );
		expect( initialResolve ).toHaveBeenCalledWith( 0 );
		expect( refreshedResolve ).toHaveBeenCalledWith( 0 );
		expect( cell.className ).toBe( 'yamabiko-table-reorder-column-unavailable-cell' );
	} );
} );
