/**
 * Column Reorderの開始前予告表示が、Reorder ModeとReorder Target Resolutionの開始可否に従って現在セルだけへ反映されることを確認する。
 */

import { act, createEvent, fireEvent, render } from '@testing-library/react';

import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';
import {
	getColumnDndPhase,
	subscribeColumnDndState,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';
import { reorderMode } from '@/reorder/reorder-mode';

import { ColumnHighlight } from './column-highlight';

let mockColumnDndPhase: 'idle' | 'active' = 'idle';
let mockColumnDndStateListener: ( () => void ) | null = null;

jest.mock( '@/reorder/column-reorder/responsibilities/dnd-interaction', () => ( {
	getColumnDndPhase: jest.fn( () => mockColumnDndPhase ),
	subscribeColumnDndState: jest.fn( ( listener: () => void ) => {
		mockColumnDndStateListener = listener;
		return () => {
			mockColumnDndStateListener = null;
		};
	} ),
} ) );

jest.mock( '@/reorder/column-reorder/integration/source-column-resolution', () => ( {
	resolveColumnSourceIndex: jest.fn(),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/target-resolution', () => ( {
	columnReorderTargetResolution: {
		createResolver: jest.fn(),
	},
} ) );

const resolveColumnSourceIndexMock = resolveColumnSourceIndex as jest.MockedFunction<
	typeof resolveColumnSourceIndex
>;
const createResolverMock = columnReorderTargetResolution.createResolver as jest.MockedFunction<
	typeof columnReorderTargetResolution.createResolver
>;

/** ポインター終了入力を明示して通知する。 */
const firePointerOut = (
	target: Element,
	pointerType: 'mouse' | 'touch',
	relatedTarget: EventTarget | null = null
): void => {
	const event = createEvent.pointerOut( target );
	Object.defineProperty( event, 'pointerType', { configurable: true, value: pointerType } );
	Object.defineProperty( event, 'relatedTarget', { configurable: true, value: relatedTarget } );
	fireEvent( target, event );
};

const resetReorderMode = () => {
	act( () => {
		reorderMode.observeTable( '__column-highlight-test-reset__' );
	} );
};

/** 開始前のセル予告表示を確認するためのTableを描画する。 */
const TestTable = ( props: { tableIdentity?: string } ) => (
	<ColumnHighlight tableIdentity={ props.tableIdentity ?? 'table-a' }>
		{ ( onPointerOverCapture, onPointerOutCapture ) => (
			<div
				data-testid="wrapper"
				onPointerOverCapture={ onPointerOverCapture }
				onPointerOutCapture={ onPointerOutCapture }
			>
				<table>
					<tbody>
						<tr>
							<td data-testid="column-0">A</td>
							<td data-testid="column-1">
								<span data-testid="column-1-child">B</span>
							</td>
							<td data-testid="column-2">C</td>
						</tr>
					</tbody>
				</table>
			</div>
		) }
	</ColumnHighlight>
);

describe( 'Column highlight', () => {
	let resolveMock: jest.Mock;

	beforeEach( () => {
		jest.clearAllMocks();
		resetReorderMode();
		act( () => {
			reorderMode.select( 'column', 'table-a' );
		} );
		mockColumnDndPhase = 'idle';
		mockColumnDndStateListener = null;
		resolveColumnSourceIndexMock.mockImplementation( ( _table, cell ) => cell.cellIndex );
		resolveMock = jest.fn( ( sourceColumnIndex: number ) => ( {
			status: 'resolved',
			target: { tableIdentity: 'table-a', sourceColumnIndex },
			initialConstraints: { columnCount: 3, blockedBoundaries: [] },
		} ) );
		createResolverMock.mockReturnValue( { resolve: resolveMock } );
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * 概要:
	 * - 開始可能な列では現在セルだけを操作可能として予告することを確認する。
	 *
	 * 操作:
	 * - 2列目のセルへポインターを移動する。
	 *
	 * 期待結果:
	 * - 現在セルだけに操作可能表示が付く。
	 * - 列全体を表すOverlayは生成されない。
	 */
	it( 'when target resolution resolves the current column, should preview only the current cell as highlightable', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'mouse' } );

		expect( getByTestId( 'column-1' ).className ).toBe(
			'yamabiko-table-reorder-column-highlightable-cell'
		);
		expect( getByTestId( 'column-0' ).className ).toBe( '' );
		expect( getByTestId( 'column-2' ).className ).toBe( '' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 開始拒否となる列では現在セルだけを移動不可として予告することを確認する。
	 *
	 * 期待結果:
	 * - 現在セルだけに移動不可表示が付き、他セルには表示が付かない。
	 */
	it( 'when target resolution rejects the current column, should preview only the current cell as unavailable', () => {
		resolveMock.mockReturnValue( { status: 'rejected', reason: 'merged-range' } );
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'mouse' } );

		expect( getByTestId( 'column-1' ).className ).toBe(
			'yamabiko-table-reorder-column-unavailable-cell'
		);
		expect( getByTestId( 'column-0' ).className ).toBe( '' );
		expect( getByTestId( 'column-2' ).className ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - 利用不能な列では操作可否を推測して表示しないことを確認する。
	 *
	 * 期待結果:
	 * - 現在セルに操作可能または移動不可の表示を付けない。
	 */
	it( 'when target resolution returns unavailable, should not preview an availability state', () => {
		resolveMock.mockReturnValue( { status: 'unavailable' } );
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'mouse' } );
		expect( getByTestId( 'column-1' ).className ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - 同一セル内部の移動では同じ開始可否判定を繰り返さないことを確認する。
	 *
	 * 操作:
	 * - セルから同じセル内の子要素へポインターを移動する。
	 *
	 * 期待結果:
	 * - 論理列解決と開始可否判定は1回だけ行われる。
	 */
	it( 'when the pointer moves inside the same cell, should not resolve the same preview again', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'mouse' } );
		fireEvent.pointerOver( getByTestId( 'column-1-child' ), { pointerType: 'mouse' } );
		expect( resolveColumnSourceIndexMock ).toHaveBeenCalledTimes( 1 );
		expect( resolveMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - マウスが現在セルを離れた場合は予告表示を終了することを確認する。
	 *
	 * 操作:
	 * - 2列目から3列目へマウスポインターを移動する。
	 *
	 * 期待結果:
	 * - 2列目の開始前表示が解除される。
	 */
	it( 'when the mouse leaves the current cell, should clear the cell preview', () => {
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		const nextCell = getByTestId( 'column-2' );
		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );
		firePointerOut( currentCell, 'mouse', nextCell );
		expect( currentCell.className ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - タッチではpointeroutだけで予告表示を終了しないことを確認する。
	 *
	 * 期待結果:
	 * - 現在セルの操作可能表示を維持する。
	 */
	it( 'when touch input ends on the current cell, should keep the cell preview', () => {
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		fireEvent.pointerOver( currentCell, { pointerType: 'touch' } );
		firePointerOut( currentCell, 'touch' );
		expect( currentCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
	} );

	/**
	 * 概要:
	 * - 別セルが操作対象になった場合は予告表示を新しいセルへ移すことを確認する。
	 *
	 * 期待結果:
	 * - 以前の表示が解除され、新しいセルへ操作可能表示が付く。
	 */
	it( 'when touch input recognizes another cell, should move the preview to the new cell', () => {
		const { getByTestId } = render( <TestTable /> );
		const previousCell = getByTestId( 'column-1' );
		const nextCell = getByTestId( 'column-2' );
		fireEvent.pointerOver( previousCell, { pointerType: 'touch' } );
		fireEvent.pointerOver( nextCell, { pointerType: 'touch' } );
		expect( previousCell.className ).toBe( '' );
		expect( nextCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
	} );

	/**
	 * 概要:
	 * - Column DnD開始時に開始前予告を破棄することを確認する。
	 *
	 * 操作:
	 * - Column DnD Lifecycleをactiveへ移行する。
	 *
	 * 期待結果:
	 * - 開始前のセル予告表示が解除される。
	 */
	it( 'when column DnD starts, should clear the pre-drag cell preview', () => {
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );
		mockColumnDndPhase = 'active';
		mockColumnDndStateListener?.();
		expect( currentCell.className ).toBe( '' );
		expect( getColumnDndPhase() ).toBe( 'active' );
		expect( subscribeColumnDndState ).toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Table Identity変更時に前Tableの予告表示とResolverを持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aのセルに操作可能表示が付いている。
	 *
	 * 操作:
	 * - Table IdentityをTable Bへ変更し、Table Bのセルへ再びポインターを移動する。
	 *
	 * 期待結果:
	 * - Table Aの表示が解除され、Table B用のTarget Resolverが新しく利用される。
	 */
	it( 'when the target table changes, should clear the previous preview and use a resolver for the new table', () => {
		const { getByTestId, rerender } = render( <TestTable tableIdentity="table-a" /> );
		const currentCell = getByTestId( 'column-1' );
		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );

		act( () => {
			reorderMode.observeTable( 'table-b' );
			reorderMode.select( 'column', 'table-b' );
		} );
		rerender( <TestTable tableIdentity="table-b" /> );
		expect( currentCell.className ).toBe( '' );

		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );
		expect( createResolverMock ).toHaveBeenCalledWith( 'table-b' );
	} );

	/**
	 * 概要:
	 * - Column Reorder Mode離脱時に表示を即時破棄し、通常編集では再表示しないことを確認する。
	 *
	 * 操作:
	 * - 表示成立後に同じToolbar入口を再選択して通常編集へ戻し、別セルへポインターを移動する。
	 *
	 * 期待結果:
	 * - 既存表示が解除され、通常編集では新しい表示も付かない。
	 */
	it( 'when column reorder mode ends, should clear the current cell preview and stop marking cells', () => {
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );
		expect( currentCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
		act( () => {
			reorderMode.select( 'column', 'table-a' );
		} );
		expect( currentCell.className ).toBe( '' );
		fireEvent.pointerOver( getByTestId( 'column-2' ), { pointerType: 'mouse' } );
		expect( getByTestId( 'column-2' ).className ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - Presentation境界終了時に開始前表示を実Tableへ残さないことを確認する。
	 *
	 * 事前条件:
	 * - セルに操作可能表示が付いている。
	 *
	 * 操作:
	 * - Column Highlightをunmountする。
	 *
	 * 期待結果:
	 * - 対象セルの開始前表示が解除される。
	 */
	it( 'when the presentation boundary unmounts, should remove the temporary cell preview', () => {
		const { getByTestId, unmount } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );
		unmount();
		expect( currentCell.className ).toBe( '' );
	} );
} );
