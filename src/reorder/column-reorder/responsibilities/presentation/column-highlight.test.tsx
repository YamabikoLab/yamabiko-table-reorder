/**
 * Column Reorderの開始前予告表示が、Reorder Target Resolutionの開始可否に従って現在セルだけへ反映されることを確認する。
 */

import { createEvent, fireEvent, render } from '@testing-library/react';

import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';

import { ColumnHighlight } from './column-highlight';

let mockColumnDndPhase: 'idle' | 'active' = 'idle';

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndPhase: () => mockColumnDndPhase,
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

/**
 * ポインター終了入力の入力手段と移動先を明示して通知する。
 *
 * @param target        ポインターが離れる要素。
 * @param pointerType   入力手段を識別するPointer Eventsの種別。
 * @param relatedTarget ポインターの移動先。
 */
const firePointerOut = (
	target: Element,
	pointerType: 'mouse' | 'touch',
	relatedTarget: EventTarget | null = null
): void => {
	const event = createEvent.pointerOut( target );
	Object.defineProperty( event, 'pointerType', {
		configurable: true,
		value: pointerType,
	} );
	Object.defineProperty( event, 'relatedTarget', {
		configurable: true,
		value: relatedTarget,
	} );
	fireEvent( target, event );
};

/**
 * 開始前のセル予告表示を確認するためのTableを描画する。
 *
 * @param props               描画条件。
 * @param props.enabled       列並び替えモードを有効にする場合はtrue。
 * @param props.tableIdentity 現在Tableの識別値。
 * @return Column Highlightへ接続されたTable。
 */
const TestTable = ( props: { enabled?: boolean; tableIdentity?: string } ) => (
	<ColumnHighlight
		enabled={ props.enabled ?? true }
		tableIdentity={ props.tableIdentity ?? 'table-a' }
	>
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
		mockColumnDndPhase = 'idle';
		resolveColumnSourceIndexMock.mockImplementation( ( _table, cell ) => cell.cellIndex );
		resolveMock = jest.fn( ( sourceColumnIndex: number ) => ( {
			status: 'resolved',
			target: { tableIdentity: 'table-a', sourceColumnIndex },
			initialConstraints: { columnCount: 3, blockedBoundaries: [] },
		} ) );
		createResolverMock.mockReturnValue( { resolve: resolveMock } );
	} );

	/**
	 * 開始可能な列では、DnD開始前に現在セルだけを操作可能として予告できることを確認する。
	 *
	 * 事前条件:
	 * - 2列目は開始可能と解決される。
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
	 * 結合範囲により開始拒否となる列では、現在セルだけを移動不可として予告できることを確認する。
	 *
	 * 事前条件:
	 * - 2列目は結合範囲により開始拒否と解決される。
	 *
	 * 操作:
	 * - 2列目のセルへポインターを移動する。
	 *
	 * 期待結果:
	 * - 現在セルだけに移動不可表示が付く。
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
	 * 現在列を安全に利用できない場合は、操作可否を推測して表示しないことを確認する。
	 *
	 * 事前条件:
	 * - Target Resolutionが現在列を通常の利用不能と解決する。
	 *
	 * 操作:
	 * - 2列目のセルへポインターを移動する。
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
	 * 同一セル内部の要素間移動では、同じ開始可否判定を繰り返さないことを確認する。
	 *
	 * 事前条件:
	 * - 2列目は開始可能と解決されている。
	 *
	 * 操作:
	 * - 2列目のセルから同じセル内の子要素へポインターを移動する。
	 *
	 * 期待結果:
	 * - セル→論理列解決と開始可否判定は1回だけ行われる。
	 */
	it( 'when the pointer moves inside the same cell, should not resolve the same preview again', () => {
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'mouse' } );
		fireEvent.pointerOver( getByTestId( 'column-1-child' ), { pointerType: 'mouse' } );

		expect( resolveColumnSourceIndexMock ).toHaveBeenCalledTimes( 1 );
		expect( resolveMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * マウスが現在セルを離れた場合に、開始前の予告表示を終了することを確認する。
	 *
	 * 事前条件:
	 * - 2列目のセルに操作可能表示が付いている。
	 *
	 * 操作:
	 * - マウスポインターを2列目から3列目へ移動する。
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
	 * タッチでは指を離しただけで開始前の予告表示を終了しないことを確認する。
	 *
	 * 事前条件:
	 * - 2列目のセルがタッチ操作対象として認識されている。
	 *
	 * 操作:
	 * - 2列目からタッチポインターが離れる。
	 *
	 * 期待結果:
	 * - 2列目の操作可能表示を維持する。
	 */
	it( 'when touch input ends on the current cell, should keep the cell preview', () => {
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );

		fireEvent.pointerOver( currentCell, { pointerType: 'touch' } );
		firePointerOut( currentCell, 'touch' );

		expect( currentCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
	} );

	/**
	 * タッチで別セルを操作対象として認識した場合に、予告表示が新しいセルへ移ることを確認する。
	 *
	 * 事前条件:
	 * - 2列目のセルに操作可能表示が付いている。
	 *
	 * 操作:
	 * - 3列目のセルへタッチ入力を移す。
	 *
	 * 期待結果:
	 * - 2列目の表示が解除され、3列目へ操作可能表示が付く。
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
	 * 列DnD開始時に開始前のセル予告表示を終了することを確認する。
	 *
	 * 事前条件:
	 * - 列DnD開始前に2列目へ操作可能表示が付いている。
	 *
	 * 操作:
	 * - Column DnD Lifecycleをactiveへ移行する。
	 *
	 * 期待結果:
	 * - 開始前のセル予告表示が解除される。
	 */
	it( 'when column DnD starts, should clear the pre-drag cell preview', () => {
		const { getByTestId, rerender } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );

		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );
		mockColumnDndPhase = 'active';
		rerender( <TestTable /> );

		expect( currentCell.className ).toBe( '' );
	} );

	/**
	 * モード終了と対象Table変更で開始前表示を持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aの2列目へ操作可能表示が付いている。
	 *
	 * 操作:
	 * - 列並び替えモードを終了する。
	 * - 再度有効化してTable IdentityをTable Bへ変更する。
	 *
	 * 期待結果:
	 * - 各Lifecycle変更で以前のセル予告表示を残さない。
	 * - Table Bでは新しいTarget Resolverを利用する。
	 */
	it( 'when the mode or target table changes, should not carry the previous cell preview forward', () => {
		const { getByTestId, rerender } = render( <TestTable tableIdentity="table-a" /> );
		const currentCell = getByTestId( 'column-1' );

		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );
		rerender( <TestTable enabled={ false } tableIdentity="table-a" /> );
		expect( currentCell.className ).toBe( '' );

		rerender( <TestTable tableIdentity="table-b" /> );
		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );

		expect( createResolverMock ).toHaveBeenCalledWith( 'table-b' );
	} );

	/**
	 * Presentation境界終了時に開始前表示を実Tableへ残さないことを確認する。
	 *
	 * 事前条件:
	 * - 2列目のセルに操作可能表示が付いている。
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
