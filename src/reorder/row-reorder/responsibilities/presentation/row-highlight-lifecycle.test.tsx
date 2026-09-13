/**
 * Row HighlightがTable解析を入力時まで遅延し、DnD LifecycleをReact再描画から分離してResolverを更新することを確認する。
 */

import { fireEvent, render } from '@testing-library/react';

import {
	getRowDndPhase,
	subscribeRowDndState,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import { rowReorderTargetResolution } from '@/reorder/row-reorder/responsibilities/target-resolution';

import { RowHighlight } from './row-highlight';

let mockRowDndPhase: 'idle' | 'active' = 'idle';
let mockRowDndStateListener: ( () => void ) | null = null;

jest.mock( '@/reorder/row-reorder/responsibilities/dnd-interaction', () => ( {
	getRowDndPhase: jest.fn( () => mockRowDndPhase ),
	subscribeRowDndState: jest.fn( ( listener: () => void ) => {
		mockRowDndStateListener = listener;
		return () => {
			mockRowDndStateListener = null;
		};
	} ),
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/target-resolution', () => ( {
	rowReorderTargetResolution: {
		createResolver: jest.fn(),
	},
} ) );

const getRowDndPhaseMock = getRowDndPhase as jest.MockedFunction< typeof getRowDndPhase >;
const subscribeRowDndStateMock = subscribeRowDndState as jest.MockedFunction<
	typeof subscribeRowDndState
>;
const createResolverMock = rowReorderTargetResolution.createResolver as jest.MockedFunction<
	typeof rowReorderTargetResolution.createResolver
>;

/** Row HighlightのLifecycleだけを確認するTableを描画する。 */
const TestTable = ( props: { childrenRender?: () => void } ) => (
	<RowHighlight enabled tableIdentity="table-a">
		{ ( onPointerOverCapture ) => {
			props.childrenRender?.();
			return (
				<div data-testid="wrapper" onPointerOverCapture={ onPointerOverCapture }>
					<table>
						<tbody>
							<tr data-testid="row-0">
								<td>First</td>
							</tr>
							<tr data-testid="row-1">
								<td>Second</td>
							</tr>
						</tbody>
					</table>
				</div>
			);
		} }
	</RowHighlight>
);

describe( 'Row highlight resolver lifecycle', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockRowDndPhase = 'idle';
		mockRowDndStateListener = null;
		createResolverMock.mockReturnValue( {
			resolve: ( sourceRowIndex ) => ( {
				status: 'resolved',
				target: { tableIdentity: 'table-a', sourceRowIndex },
				initialConstraints: { rowCount: 2, blockedBoundaries: [] },
			} ),
		} );
	} );

	/**
	 * Row Reorderモードを有効にしただけではTable全体解析を開始しないことを確認する。
	 *
	 * 操作:
	 * - Row Highlightを有効状態で描画する。
	 *
	 * 期待結果:
	 * - Target Resolverは生成されない。
	 * - DnD Lifecycle監視だけが接続される。
	 */
	it( 'when row reorder mode renders as enabled, should defer resolver creation until a valid highlight request', () => {
		render( <TestTable /> );

		expect( createResolverMock ).not.toHaveBeenCalled();
		expect( subscribeRowDndStateMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 同一Highlight Lifecycleでは最初の有効な入力で生成したResolverを再利用することを確認する。
	 *
	 * 事前条件:
	 * - Row DnDはidleである。
	 *
	 * 操作:
	 * - 1行目、2行目の順にポインターを移動する。
	 *
	 * 期待結果:
	 * - Resolverは最初の入力時に1回だけ生成される。
	 */
	it( 'when multiple rows are highlighted before DnD, should reuse the lazily created resolver', () => {
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );

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
	 * - Row DnDをactiveへ移行し、別行へポインターを移動する。
	 * - その後idleへ戻して再び行へポインターを移動する。
	 *
	 * 期待結果:
	 * - active中はResolverを生成しない。
	 * - idle復帰後の最初の有効な判定で新しいResolverを生成する。
	 */
	it( 'when row DnD runs after a resolver was created, should recreate it only after returning to idle', () => {
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( createResolverMock ).toHaveBeenCalledTimes( 1 );

		mockRowDndPhase = 'active';
		mockRowDndStateListener?.();
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( createResolverMock ).toHaveBeenCalledTimes( 1 );

		mockRowDndPhase = 'idle';
		mockRowDndStateListener?.();
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( createResolverMock ).toHaveBeenCalledTimes( 2 );
	} );

	/**
	 * DnD Lifecycle通知がTable subtreeのReact再描画を発生させないことを確認する。
	 *
	 * 事前条件:
	 * - Row HighlightがDnD状態変更をReact非依存境界で購読している。
	 *
	 * 操作:
	 * - idleからactive、activeからidleへの通知を発生させる。
	 *
	 * 期待結果:
	 * - children描画処理の実行回数は増えない。
	 */
	it( 'when row DnD phase changes, should not rerender the table subtree', () => {
		const childrenRender = jest.fn();
		render( <TestTable childrenRender={ childrenRender } /> );
		const initialRenderCount = childrenRender.mock.calls.length;

		mockRowDndPhase = 'active';
		mockRowDndStateListener?.();
		mockRowDndPhase = 'idle';
		mockRowDndStateListener?.();

		expect( childrenRender.mock.calls.length ).toBe( initialRenderCount );
		expect( getRowDndPhaseMock ).toHaveBeenCalled();
	} );
} );
