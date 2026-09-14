/**
 * Row HighlightがTable解析を入力時まで遅延し、各対象を現在Tableから直接解決しながらDnD LifecycleをReact再描画から分離することを確認する。
 */

import { act, fireEvent, render } from '@testing-library/react';

import { reorderMode } from '@/reorder/reorder-mode';
import {
	getRowDndPhase,
	subscribeRowDndState,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import { resolveRowReorderTarget } from '@/reorder/row-reorder/responsibilities/target-resolution';

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
	resolveRowReorderTarget: jest.fn(),
} ) );

const getRowDndPhaseMock = getRowDndPhase as jest.MockedFunction< typeof getRowDndPhase >;
const subscribeRowDndStateMock = subscribeRowDndState as jest.MockedFunction<
	typeof subscribeRowDndState
>;
const resolveRowReorderTargetMock = resolveRowReorderTarget as jest.MockedFunction<
	typeof resolveRowReorderTarget
>;

/**
 * Row HighlightのLifecycleだけを確認するTableを描画する。
 * @param props
 * @param props.childrenRender
 */
const TestTable = ( props: { childrenRender?: () => void } ) => (
	<RowHighlight tableIdentity="table-a">
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

const activateRowMode = (): void => {
	act( () => {
		reorderMode.observeTable( 'table-a' );
		reorderMode.select( 'row', 'table-a' );
	} );
};

const resetReorderMode = (): void => {
	act( () => {
		reorderMode.observeTable( '__row-highlight-lifecycle-reset__' );
	} );
};

describe( 'Row highlight resolution lifecycle', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockRowDndPhase = 'idle';
		mockRowDndStateListener = null;
		resetReorderMode();
		resolveRowReorderTargetMock.mockImplementation( ( target ) => ( {
			status: 'resolved',
			target,
			initialConstraints: { rowCount: 2, blockedBoundaries: [] },
		} ) );
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * Row Highlightを接続しただけではTable全体解析を開始しないことを確認する。
	 *
	 * 操作:
	 * - Row Highlightを描画する。
	 *
	 * 期待結果:
	 * - Target Resolutionは実行されない。
	 * - DnD Lifecycle監視だけが接続される。
	 */
	it( 'when row highlight is rendered, should defer target resolution until a valid highlight request', () => {
		render( <TestTable /> );

		expect( resolveRowReorderTargetMock ).not.toHaveBeenCalled();
		expect( subscribeRowDndStateMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * hover対象が変わるたびに要求時点のTableから直接解決することを確認する。
	 *
	 * 事前条件:
	 * - Row Reorder Modeが有効で、Row DnDはidleである。
	 *
	 * 操作:
	 * - 1行目、2行目の順にポインターを移動する。
	 *
	 * 期待結果:
	 * - 各行がそれぞれ現在Tableに対するTargetとして解決される。
	 */
	it( 'when multiple rows are highlighted before DnD, should resolve each target directly', () => {
		activateRowMode();
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( resolveRowReorderTargetMock ).toHaveBeenNthCalledWith( 1, {
			tableIdentity: 'table-a',
			sourceRowIndex: 0,
		} );
		expect( resolveRowReorderTargetMock ).toHaveBeenNthCalledWith( 2, {
			tableIdentity: 'table-a',
			sourceRowIndex: 1,
		} );
	} );

	/**
	 * DnD開始後は表示を破棄し、active中にはTarget Resolutionを実行しないことを確認する。
	 *
	 * 事前条件:
	 * - Row Reorder Modeが有効で、idle中に操作可否を解決済みである。
	 *
	 * 操作:
	 * - Row DnDをactiveへ移行し、別行へポインターを移動する。
	 * - その後idleへ戻して再び行へポインターを移動する。
	 *
	 * 期待結果:
	 * - active中はTarget Resolutionを実行しない。
	 * - idle復帰後の最初の有効な判定で現在対象を直接解決する。
	 */
	it( 'when row DnD becomes active, should resolve another target only after returning to idle', () => {
		activateRowMode();
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( resolveRowReorderTargetMock ).toHaveBeenCalledTimes( 1 );

		mockRowDndPhase = 'active';
		mockRowDndStateListener?.();
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( resolveRowReorderTargetMock ).toHaveBeenCalledTimes( 1 );

		mockRowDndPhase = 'idle';
		mockRowDndStateListener?.();
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( resolveRowReorderTargetMock ).toHaveBeenCalledTimes( 2 );
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
