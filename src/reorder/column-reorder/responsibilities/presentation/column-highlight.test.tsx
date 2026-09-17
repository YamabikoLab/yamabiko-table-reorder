/**
 * Column Reorderの開始前予告表示が、Reorder ModeとReorder Target Resolutionの開始可否に従ってYTR所有DOMへ反映されることを確認する。
 */

import { act, createEvent, fireEvent, render } from '@testing-library/react';

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
	resolveColumnReorderTarget: jest.fn(),
} ) );

const resolveColumnSourceIndexMock = resolveColumnSourceIndex as jest.MockedFunction<
	typeof resolveColumnSourceIndex
>;
const resolveColumnReorderTargetMock = resolveColumnReorderTarget as jest.MockedFunction<
	typeof resolveColumnReorderTarget
>;

/**
 * ポインター終了入力を明示して通知する。
 *
 * @param target        終了入力を通知する要素。
 * @param pointerType   入力種別。
 * @param relatedTarget 移動先要素。
 */
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

/**
 * Highlightの配置確認に使用するDOM矩形を作成する。
 *
 * @param values テスト条件として上書きする位置と寸法。
 * @return 指定値以外を0としたDOM矩形。
 */
const rectangle = ( values: Partial< DOMRect > ): DOMRect =>
	( {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		width: 0,
		height: 0,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
		...values,
	} ) as DOMRect;

const resetReorderMode = (): void => {
	act( () => {
		reorderMode.observeTable( '__column-highlight-test-reset__' );
	} );
};

/**
 * 開始前のセル予告表示を確認するためのTableを描画する。
 *
 * @param props               描画条件。
 * @param props.tableIdentity 対象Table Identity。
 * @return Column Highlightへ接続されたTable。
 */
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
	beforeEach( () => {
		jest.clearAllMocks();
		resetReorderMode();
		act( () => {
			reorderMode.select( 'column', 'table-a' );
		} );
		mockColumnDndPhase = 'idle';
		mockColumnDndStateListener = null;
		resolveColumnSourceIndexMock.mockImplementation( ( _table, cell ) => cell.cellIndex );
		resolveColumnReorderTargetMock.mockImplementation( ( target ) => ( {
			status: 'resolved',
			target,
			initialConstraints: { columnCount: 3, blockedBoundaries: [] },
		} ) );
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * 開始可能な列では現在セル位置だけを操作可能として予告することを確認する。
	 *
	 * 操作:
	 * - 2列目のセルへポインターを移動する。
	 *
	 * 期待結果:
	 * - 対象セル自身のclassは変更されない。
	 * - 対象セルの現在位置と寸法を持つYTR所有Highlightが生成される。
	 * - Editor Documentは掴めるcursor状態になる。
	 */
	it( 'when target resolution resolves the current column, should show a YTR-owned resolved highlight without changing the cell class', () => {
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		jest
			.spyOn( currentCell, 'getBoundingClientRect' )
			.mockReturnValue( rectangle( { top: 20, left: 40, width: 120, height: 48 } ) );

		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );

		const highlight = document.querySelector( '.yamabiko-table-reorder-column-highlight' );
		expect( currentCell.className ).toBe( '' );
		expect(
			highlight?.classList.contains( 'yamabiko-table-reorder-column-highlight-resolved' )
		).toBe( true );
		expect( ( highlight as HTMLElement | null )?.style.top ).toBe( '20px' );
		expect( ( highlight as HTMLElement | null )?.style.left ).toBe( '40px' );
		expect( ( highlight as HTMLElement | null )?.style.width ).toBe( '120px' );
		expect( ( highlight as HTMLElement | null )?.style.height ).toBe( '48px' );
		expect(
			document.body.classList.contains( 'yamabiko-table-reorder-column-highlight-cursor-grab' )
		).toBe( true );
	} );

	/**
	 * 開始拒否となる列では現在セル位置を移動不可として予告することを確認する。
	 *
	 * 期待結果:
	 * - 対象セル自身のclassは変更されない。
	 * - YTR所有Highlightは移動不可状態になる。
	 * - Editor Documentは通常cursor状態になる。
	 */
	it( 'when target resolution rejects the current column, should show a YTR-owned rejected highlight without changing the cell class', () => {
		resolveColumnReorderTargetMock.mockReturnValue( {
			status: 'rejected',
			blockingMergedRange: {
				section: 'body',
				rowStart: 0,
				rowEnd: 0,
				columnStart: 0,
				columnEnd: 1,
			},
		} );
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );

		const highlight = document.querySelector( '.yamabiko-table-reorder-column-highlight' );
		expect( currentCell.className ).toBe( '' );
		expect(
			highlight?.classList.contains( 'yamabiko-table-reorder-column-highlight-rejected' )
		).toBe( true );
		expect(
			document.body.classList.contains( 'yamabiko-table-reorder-column-highlight-cursor-default' )
		).toBe( true );
	} );

	/**
	 * 利用不能な列では操作可否を推測して表示しないことを確認する。
	 *
	 * 期待結果:
	 * - YTR所有Highlightも開始前cursor状態も生成されない。
	 */
	it( 'when target resolution returns unavailable, should not show a highlight or cursor state', () => {
		resolveColumnReorderTargetMock.mockReturnValue( { status: 'unavailable' } );
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'mouse' } );

		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
		expect( document.body.className ).not.toContain(
			'yamabiko-table-reorder-column-highlight-cursor-'
		);
	} );

	/**
	 * 外部Blockが対象セルのclassを書き戻してもHighlightが失われないことを確認する。
	 *
	 * 事前条件:
	 * - 開始可能なセルへHighlightが成立している。
	 *
	 * 操作:
	 * - 外部Blockの再描画相当として対象セルのclassNameを書き換える。
	 *
	 * 期待結果:
	 * - 対象セルは外部Blockのclassだけを持つ。
	 * - YTR所有Highlightは維持される。
	 */
	it( 'when the block rewrites the highlighted cell class, should keep the independent highlight', () => {
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		fireEvent.pointerOver( currentCell, { pointerType: 'touch' } );
		const highlight = document.querySelector( '.yamabiko-table-reorder-column-highlight' );

		currentCell.className = 'is-selected';

		expect( currentCell.className ).toBe( 'is-selected' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBe(
			highlight
		);
	} );

	/**
	 * 同一セル内部の移動では同じ開始可否判定を繰り返さないことを確認する。
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
		expect( resolveColumnReorderTargetMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * マウスが現在セルを離れた場合は予告表示を終了することを確認する。
	 *
	 * 操作:
	 * - 2列目から3列目へマウスポインターを移動する。
	 *
	 * 期待結果:
	 * - Highlightと開始前cursor状態が解除される。
	 */
	it( 'when the mouse leaves the current cell, should clear the highlight and cursor state', () => {
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		const nextCell = getByTestId( 'column-2' );
		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );
		firePointerOut( currentCell, 'mouse', nextCell );

		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
		expect( document.body.className ).not.toContain(
			'yamabiko-table-reorder-column-highlight-cursor-'
		);
	} );

	/**
	 * タッチではpointeroutだけで予告表示を終了しないことを確認する。
	 *
	 * 期待結果:
	 * - 現在セル位置のHighlightを維持する。
	 */
	it( 'when touch input ends on the current cell, should keep the highlight', () => {
		const { getByTestId } = render( <TestTable /> );
		const currentCell = getByTestId( 'column-1' );
		fireEvent.pointerOver( currentCell, { pointerType: 'touch' } );
		firePointerOut( currentCell, 'touch' );

		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();
	} );

	/**
	 * 実際のscroll発生時に開始前予告を終了することを確認する。
	 *
	 * 事前条件:
	 * - タッチ入力でHighlightが成立している。
	 *
	 * 操作:
	 * - 現在のEditor Documentでscrollを発生させる。
	 *
	 * 期待結果:
	 * - Highlightと開始前cursor状態が解除される。
	 * - scroll後にHighlightは自動復元されない。
	 */
	it( 'when scrolling occurs in the editor document, should clear the highlight without restoring it', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'touch' } );

		document.dispatchEvent( new Event( 'scroll' ) );

		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
		expect( document.body.className ).not.toContain(
			'yamabiko-table-reorder-column-highlight-cursor-'
		);
	} );

	/**
	 * 別セルが操作対象になった場合は予告表示を新しいセル位置へ移すことを確認する。
	 *
	 * 期待結果:
	 * - 以前のHighlightが解除され、新しいセル位置へ1つだけHighlightが生成される。
	 */
	it( 'when touch input recognizes another cell, should replace the highlight with the new cell snapshot', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'touch' } );
		const previousHighlight = document.querySelector( '.yamabiko-table-reorder-column-highlight' );
		fireEvent.pointerOver( getByTestId( 'column-2' ), { pointerType: 'touch' } );
		const nextHighlight = document.querySelector( '.yamabiko-table-reorder-column-highlight' );

		expect( previousHighlight?.isConnected ).toBe( false );
		expect( nextHighlight ).not.toBe( previousHighlight );
		expect( document.querySelectorAll( '.yamabiko-table-reorder-column-highlight' ) ).toHaveLength(
			1
		);
	} );

	/**
	 * Column DnD開始時に開始前予告を破棄することを確認する。
	 *
	 * 操作:
	 * - Column DnD Lifecycleをactiveへ移行する。
	 *
	 * 期待結果:
	 * - Highlightと開始前cursor状態が解除される。
	 */
	it( 'when column DnD starts, should clear the pre-drag highlight and cursor state', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'mouse' } );
		mockColumnDndPhase = 'active';
		mockColumnDndStateListener?.();

		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
		expect( document.body.className ).not.toContain(
			'yamabiko-table-reorder-column-highlight-cursor-'
		);
		expect( getColumnDndPhase() ).toBe( 'active' );
		expect( subscribeColumnDndState ).toHaveBeenCalled();
	} );

	/**
	 * Table Identity変更時に前Tableの予告表示を持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aのセル位置にHighlightが成立している。
	 *
	 * 操作:
	 * - Table IdentityをTable Bへ変更し、Table Bのセルへ再びポインターを移動する。
	 *
	 * 期待結果:
	 * - Table AのHighlightが解除され、Table Bの現在対象がTarget Resolutionへ渡される。
	 */
	it( 'when the target table changes, should clear the previous highlight and resolve the new table target', () => {
		const { getByTestId, rerender } = render( <TestTable tableIdentity="table-a" /> );
		const currentCell = getByTestId( 'column-1' );
		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );

		act( () => {
			reorderMode.observeTable( 'table-b' );
			reorderMode.select( 'column', 'table-b' );
		} );
		rerender( <TestTable tableIdentity="table-b" /> );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();

		fireEvent.pointerOver( currentCell, { pointerType: 'mouse' } );
		expect( resolveColumnReorderTargetMock ).toHaveBeenLastCalledWith( {
			tableIdentity: 'table-b',
			sourceColumnIndex: 1,
		} );
	} );

	/**
	 * Column Reorder Mode離脱時に表示を即時破棄し、通常編集では再表示しないことを確認する。
	 *
	 * 操作:
	 * - 表示成立後に同じToolbar入口を再選択して通常編集へ戻し、別セルへポインターを移動する。
	 *
	 * 期待結果:
	 * - 既存Highlightが解除され、通常編集では新しいHighlightも生成されない。
	 */
	it( 'when column reorder mode ends, should clear the highlight and stop showing new highlights', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'mouse' } );
		act( () => {
			reorderMode.select( 'column', 'table-a' );
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();

		fireEvent.pointerOver( getByTestId( 'column-2' ), { pointerType: 'mouse' } );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
	} );

	/**
	 * Presentation境界終了時に開始前表示をEditor Documentへ残さないことを確認する。
	 *
	 * 事前条件:
	 * - Highlightと開始前cursor状態が成立している。
	 *
	 * 操作:
	 * - Column Highlightをunmountする。
	 *
	 * 期待結果:
	 * - YTR所有Highlightと開始前cursor状態が解除される。
	 */
	it( 'when the presentation boundary unmounts, should remove the temporary highlight and cursor state', () => {
		const { getByTestId, unmount } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'column-1' ), { pointerType: 'mouse' } );
		unmount();

		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
		expect( document.body.className ).not.toContain(
			'yamabiko-table-reorder-column-highlight-cursor-'
		);
	} );
} );
