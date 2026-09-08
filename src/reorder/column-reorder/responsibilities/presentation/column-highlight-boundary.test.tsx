/**
 * Column Reorderの列操作可否表示が、入力手段に応じた終了Lifecycleを持つことを確認する。
 */

import { createEvent, fireEvent, render } from '@testing-library/react';

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
 * ポインター終了入力の入力種別と移動先を明示して通知する。
 *
 * @param target        ポインターが離れる要素。
 * @param relatedTarget ポインターの移動先。
 * @param pointerType   入力手段を識別するPointer Eventsの種別。
 */
const firePointerOut = (
	target: Element,
	relatedTarget: EventTarget | null,
	pointerType: 'mouse' | 'touch'
): void => {
	const event = createEvent.pointerOut( target, { pointerType } );
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
	 * マウスポインターがBlock境界を離れた場合だけhover表示を終了することを確認する。
	 *
	 * 事前条件:
	 * - 列並び替えモード中に1列目へ操作可能表示が出ている。
	 *
	 * 操作:
	 * - マウスポインターをBlock内部の別セルへ移動する。
	 * - 続いてBlock外へ移動する。
	 *
	 * 期待結果:
	 * - Block内部の移動では現在列の表示を維持する。
	 * - Block外へ移動した時点でセル状態と列オーバーレイを解除する。
	 */
	it( 'when the mouse pointer leaves the block boundary, should clear the temporary column highlight', () => {
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

		fireEvent.pointerOver( firstCell, { pointerType: 'mouse' } );
		expect( firstCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();

		firePointerOut( firstCell, secondCell, 'mouse' );
		expect( firstCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();

		firePointerOut( wrapper, document.body, 'mouse' );
		expect( firstCell.className ).toBe( '' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
	} );

	/**
	 * タッチで認識した列は指を離しただけでは解除せず、次に操作した列へ表示を移すことを確認する。
	 *
	 * 事前条件:
	 * - 列並び替えモード中で、各列は移動可能と解決される。
	 *
	 * 操作:
	 * - 1列目へ触れてから指を離す。
	 * - タッチ入力の終了に伴ってBlock境界外への終了入力が発生する。
	 * - その後2列目へ触れる。
	 *
	 * 期待結果:
	 * - 指を離した後も1列目の操作可否表示を維持する。
	 * - 次に2列目へ触れた時点で表示を2列目へ移す。
	 */
	it( 'when touch input ends, should keep the current column highlight until another column is recognized', () => {
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

		fireEvent.pointerOver( firstCell, { pointerType: 'touch' } );
		fireEvent.pointerUp( firstCell, { pointerType: 'touch' } );
		firePointerOut( wrapper, document.body, 'touch' );

		expect( firstCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();

		fireEvent.pointerOver( secondCell, { pointerType: 'touch' } );

		expect( firstCell.className ).toBe( '' );
		expect( secondCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();
	} );
} );
