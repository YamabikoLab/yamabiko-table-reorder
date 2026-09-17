/**
 * Column HighlightがTable解析を入力時まで遅延し、各対象を現在Tableから直接解決しながらHighlight LifecycleをReact再描画から分離することを確認する。
 */

import { act, fireEvent, render } from '@testing-library/react';

import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';
import {
	getColumnDndPhase,
	subscribeColumnDndState,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { resolveColumnReorderTarget } from '@/reorder/column-reorder/responsibilities/target-resolution';
import { reorderMode } from '@/reorder/reorder-mode';

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
	resolveColumnReorderTarget: jest.fn(),
} ) );

const resolveColumnSourceIndexMock = resolveColumnSourceIndex as jest.MockedFunction<
	typeof resolveColumnSourceIndex
>;
const getColumnDndPhaseMock = getColumnDndPhase as jest.MockedFunction< typeof getColumnDndPhase >;
const subscribeColumnDndStateMock = subscribeColumnDndState as jest.MockedFunction<
	typeof subscribeColumnDndState
>;
const resolveColumnReorderTargetMock = resolveColumnReorderTarget as jest.MockedFunction<
	typeof resolveColumnReorderTarget
>;

/**
 * Column HighlightのLifecycleだけを確認するTableを描画する。
 *
 * @param props                描画条件。
 * @param props.childrenRender children描画回数を観測する処理。
 * @return Column Highlightへ接続されたTable。
 */
const TestTable = ( props: { childrenRender?: () => void } ) => (
	<ColumnHighlight tableIdentity="table-a">
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

const activateColumnMode = (): void => {
	act( () => {
		reorderMode.observeTable( 'table-a' );
		reorderMode.select( 'column', 'table-a' );
	} );
};

const resetReorderMode = (): void => {
	act( () => {
		reorderMode.observeTable( '__column-highlight-lifecycle-reset__' );
	} );
};

describe( 'Column highlight resolution lifecycle', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockColumnDndPhase = 'idle';
		mockColumnDndStateListener = null;
		resetReorderMode();
		resolveColumnSourceIndexMock.mockImplementation( ( _table, cell ) => cell.cellIndex );
		resolveColumnReorderTargetMock.mockImplementation( ( target ) => ( {
			status: 'resolved',
			target,
			initialConstraints: { columnCount: 2, blockedBoundaries: [] },
		} ) );
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * Column Highlightを接続しただけではTable全体解析を開始しないことを確認する。
	 *
	 * 操作:
	 * - Column Highlightを描画する。
	 *
	 * 期待結果:
	 * - Target Resolutionは実行されない。
	 * - DnD Lifecycle監視だけが接続される。
	 */
	it( 'when column highlight is rendered, should defer target resolution until a valid highlight request', () => {
		render( <TestTable /> );

		expect( resolveColumnReorderTargetMock ).not.toHaveBeenCalled();
		expect( subscribeColumnDndStateMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * pointer対象が変わるたびに要求時点のTableから直接解決することを確認する。
	 *
	 * 事前条件:
	 * - Column Reorder Modeが有効で、Column DnDはidleである。
	 *
	 * 操作:
	 * - 1列目、2列目の順にポインターを移動する。
	 *
	 * 期待結果:
	 * - 各列がそれぞれ現在Tableに対するTargetとして解決される。
	 */
	it( 'when multiple columns are highlighted before DnD, should resolve each target directly', () => {
		activateColumnMode();
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'column-0' ) );
		fireEvent.pointerOver( getByTestId( 'column-1' ) );

		expect( resolveColumnReorderTargetMock ).toHaveBeenNthCalledWith( 1, {
			tableIdentity: 'table-a',
			sourceColumnIndex: 0,
		} );
		expect( resolveColumnReorderTargetMock ).toHaveBeenNthCalledWith( 2, {
			tableIdentity: 'table-a',
			sourceColumnIndex: 1,
		} );
	} );

	/**
	 * scroll終了後の次のpointer入力では現在Tableからfreshに再解決することを確認する。
	 *
	 * 事前条件:
	 * - 1列目にHighlightが成立している。
	 *
	 * 操作:
	 * - Editor Documentでscrollを発生させた後、同じセルへ再びpointer入力する。
	 *
	 * 期待結果:
	 * - scroll時点で既存Highlight Lifecycleは終了する。
	 * - 次のpointer入力ではTarget Resolutionを再実行する。
	 */
	it( 'when scrolling ends a highlight lifecycle, should resolve the next pointer request fresh', () => {
		activateColumnMode();
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-0' );

		fireEvent.pointerOver( currentCell );
		expect( resolveColumnReorderTargetMock ).toHaveBeenCalledTimes( 1 );

		document.dispatchEvent( new Event( 'scroll' ) );
		fireEvent.pointerOver( currentCell );

		expect( resolveColumnReorderTargetMock ).toHaveBeenCalledTimes( 2 );
	} );

	/**
	 * DnD開始後は表示を破棄し、active中にはTarget Resolutionを実行しないことを確認する。
	 *
	 * 事前条件:
	 * - Column Reorder Modeが有効で、idle中に操作可否を解決済みである。
	 *
	 * 操作:
	 * - Column DnDをactiveへ移行し、別セルへポインターを移動する。
	 * - その後idleへ戻して再びセルへポインターを移動する。
	 *
	 * 期待結果:
	 * - active中はTarget Resolutionを実行しない。
	 * - idle復帰後の最初の有効な判定で現在対象を直接解決する。
	 */
	it( 'when column DnD becomes active, should resolve another target only after returning to idle', () => {
		activateColumnMode();
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'column-0' ) );
		expect( resolveColumnReorderTargetMock ).toHaveBeenCalledTimes( 1 );

		mockColumnDndPhase = 'active';
		mockColumnDndStateListener?.();
		fireEvent.pointerOver( getByTestId( 'column-1' ) );
		expect( resolveColumnReorderTargetMock ).toHaveBeenCalledTimes( 1 );

		mockColumnDndPhase = 'idle';
		mockColumnDndStateListener?.();
		fireEvent.pointerOver( getByTestId( 'column-1' ) );
		expect( resolveColumnReorderTargetMock ).toHaveBeenCalledTimes( 2 );
	} );

	/**
	 * Highlight表示開始・対象切替・scroll cleanupがTable subtreeのReact再描画を発生させないことを確認する。
	 *
	 * 事前条件:
	 * - Column Highlightが一時PresentationをReact stateで所有していない。
	 *
	 * 操作:
	 * - 1列目、2列目へ順にpointer入力し、scrollでHighlightを終了する。
	 *
	 * 期待結果:
	 * - children描画処理の実行回数は増えない。
	 */
	it( 'when highlight presentation changes, should not rerender the table subtree', () => {
		activateColumnMode();
		const childrenRender = jest.fn();
		const { getByTestId } = render( <TestTable childrenRender={ childrenRender } /> );
		const initialRenderCount = childrenRender.mock.calls.length;

		fireEvent.pointerOver( getByTestId( 'column-0' ) );
		fireEvent.pointerOver( getByTestId( 'column-1' ) );
		document.dispatchEvent( new Event( 'scroll' ) );

		expect( childrenRender.mock.calls.length ).toBe( initialRenderCount );
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
