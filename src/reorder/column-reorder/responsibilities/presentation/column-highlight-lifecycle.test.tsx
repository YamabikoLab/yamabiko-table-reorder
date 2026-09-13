/**
 * Column HighlightがTable解析を入力時まで遅延し、DnD LifecycleをReact再描画から分離してResolverを更新することを確認する。
 */

import { fireEvent, render } from '@testing-library/react';

import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';
import {
	getColumnDndPhase,
	subscribeColumnDndState,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';

import { ColumnHighlight } from './column-highlight';

let mockColumnDndPhase: 'idle' | 'active' = 'idle';
let mockColumnDndStateListener: ( () => void ) | null = null;

jest.mock( '@/reorder/column-reorder/integration/source-column-resolution', () => ( {
	resolveColumnSourceIndex: jest.fn(),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/dnd-interaction', () => ( {
	getColumnDndPhase: jest.fn( () => mockColumnDndPhase ),
	subscribeColumnDndState: jest.fn( ( listener: () => void ) => {
		mockColumnDndStateListener = listener;
		return () => {
			mockColumnDndStateListener = null;
		};
	} ),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/target-resolution', () => ( {
	columnReorderTargetResolution: {
		createResolver: jest.fn(),
	},
} ) );

const resolveColumnSourceIndexMock = resolveColumnSourceIndex as jest.MockedFunction<
	typeof resolveColumnSourceIndex
>;
const getColumnDndPhaseMock = getColumnDndPhase as jest.MockedFunction< typeof getColumnDndPhase >;
const subscribeColumnDndStateMock = subscribeColumnDndState as jest.MockedFunction<
	typeof subscribeColumnDndState
>;
const createResolverMock = columnReorderTargetResolution.createResolver as jest.MockedFunction<
	typeof columnReorderTargetResolution.createResolver
>;

/**
 * Column HighlightのLifecycleだけを確認するTableを描画する。
 * @param props
 * @param props.childrenRender
 */
const TestTable = ( props: { childrenRender?: () => void } ) => (
	<ColumnHighlight enabled tableIdentity="table-a">
		{ ( onPointerOverCapture, onPointerOutCapture ) => {
			props.childrenRender?.();
			return (
				<div
					data-testid="wrapper"
					onPointerOverCapture={ onPointerOverCapture }
					onPointerOutCapture={ onPointerOutCapture }
				>
					<table>
						<tbody>
							<tr>
								<td data-testid="column-0">First</td>
								<td data-testid="column-1">Second</td>
							</tr>
						</tbody>
					</table>
				</div>
			);
		} }
	</ColumnHighlight>
);

describe( 'Column highlight resolver lifecycle', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockColumnDndPhase = 'idle';
		mockColumnDndStateListener = null;
		resolveColumnSourceIndexMock.mockImplementation( ( _table, cell ) => cell.cellIndex );
		createResolverMock.mockReturnValue( {
			resolve: ( sourceColumnIndex ) => ( {
				status: 'resolved',
				target: { tableIdentity: 'table-a', sourceColumnIndex },
				initialConstraints: { columnCount: 2, blockedBoundaries: [] },
			} ),
		} );
	} );

	/**
	 * Column Reorderモードを有効にしただけではTable全体解析を開始しないことを確認する。
	 *
	 * 操作:
	 * - Column Highlightを有効状態で描画する。
	 *
	 * 期待結果:
	 * - Target Resolverは生成されない。
	 * - DnD Lifecycle監視だけが接続される。
	 */
	it( 'when column reorder mode renders as enabled, should defer resolver creation until a valid highlight request', () => {
		render( <TestTable /> );

		expect( createResolverMock ).not.toHaveBeenCalled();
		expect( subscribeColumnDndStateMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 同一Highlight Lifecycleでは最初の有効な入力で生成したResolverを再利用することを確認する。
	 *
	 * 事前条件:
	 * - Column DnDはidleである。
	 *
	 * 操作:
	 * - 1列目、2列目の順にポインターを移動する。
	 *
	 * 期待結果:
	 * - Resolverは最初の入力時に1回だけ生成される。
	 */
	it( 'when multiple columns are highlighted before DnD, should reuse the lazily created resolver', () => {
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'column-0' ) );
		fireEvent.pointerOver( getByTestId( 'column-1' ) );

		expect( createResolverMock ).toHaveBeenCalledTimes( 1 );
		expect( createResolverMock ).toHaveBeenCalledWith( 'table-a' );
	} );

	/**
	 * DnD開始後は古いResolverを破棄し、active中には新しいResolverを生成しないことを確認する。
	 *
	 * 事前条件:
	 * - idle中の操作可否判定でResolverが生成済みである。
	 *
	 * 操作:
	 * - Column DnDをactiveへ移行し、別セルへポインターを移動する。
	 * - その後idleへ戻して再びセルへポインターを移動する。
	 *
	 * 期待結果:
	 * - active中はResolverを生成しない。
	 * - idle復帰後の最初の有効な判定で新しいResolverを生成する。
	 */
	it( 'when column DnD runs after a resolver was created, should recreate it only after returning to idle', () => {
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'column-0' ) );
		expect( createResolverMock ).toHaveBeenCalledTimes( 1 );

		mockColumnDndPhase = 'active';
		mockColumnDndStateListener?.();
		fireEvent.pointerOver( getByTestId( 'column-1' ) );
		expect( createResolverMock ).toHaveBeenCalledTimes( 1 );

		mockColumnDndPhase = 'idle';
		mockColumnDndStateListener?.();
		fireEvent.pointerOver( getByTestId( 'column-1' ) );
		expect( createResolverMock ).toHaveBeenCalledTimes( 2 );
	} );

	/**
	 * DnD Lifecycle通知がTable subtreeのReact再描画を発生させないことを確認する。
	 *
	 * 事前条件:
	 * - Column HighlightがDnD状態変更をReact非依存境界で購読している。
	 *
	 * 操作:
	 * - idleからactive、activeからidleへの通知を発生させる。
	 *
	 * 期待結果:
	 * - children描画処理の実行回数は増えない。
	 */
	it( 'when column DnD phase changes, should not rerender the table subtree', () => {
		const childrenRender = jest.fn();
		render( <TestTable childrenRender={ childrenRender } /> );
		const initialRenderCount = childrenRender.mock.calls.length;

		mockColumnDndPhase = 'active';
		mockColumnDndStateListener?.();
		mockColumnDndPhase = 'idle';
		mockColumnDndStateListener?.();

		expect( childrenRender.mock.calls.length ).toBe( initialRenderCount );
		expect( getColumnDndPhaseMock ).toHaveBeenCalled();
	} );
} );
