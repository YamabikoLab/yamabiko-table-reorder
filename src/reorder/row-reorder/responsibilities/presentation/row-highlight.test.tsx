/**
 * Row Reorderの行ホバー表示が、Reorder ModeとReorder Target Resolutionの開始可否に従って操作可能・移動不可を表示することを確認する。
 */

import { act, fireEvent, render } from '@testing-library/react';

import { reorderMode } from '@/reorder/reorder-mode';
import { resolveRowReorderTarget } from '@/reorder/row-reorder/responsibilities/target-resolution';

import { RowHighlight } from './row-highlight';

jest.mock( '@/reorder/row-reorder/responsibilities/dnd-interaction', () => ( {
	getRowDndPhase: () => 'idle',
	subscribeRowDndState: () => () => {},
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/target-resolution', () => ( {
	resolveRowReorderTarget: jest.fn(),
} ) );

const resolveRowReorderTargetMock = resolveRowReorderTarget as jest.MockedFunction<
	typeof resolveRowReorderTarget
>;

const resetReorderMode = () => {
	act( () => {
		reorderMode.observeTable( '__row-highlight-test-reset__' );
	} );
};

const TestTable = () => (
	<RowHighlight tableIdentity="table-a">
		{ ( onPointerOverCapture ) => (
			<div data-testid="wrapper" onPointerOverCapture={ onPointerOverCapture }>
				<table>
					<tbody>
						<tr data-testid="row-0">
							<td>First</td>
						</tr>
						<tr data-testid="row-1">
							<td>Second</td>
						</tr>
						<tr data-testid="row-2">
							<td>Third</td>
						</tr>
					</tbody>
				</table>
			</div>
		) }
	</RowHighlight>
);

describe( 'Row highlight', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		resetReorderMode();
		act( () => {
			reorderMode.select( 'row', 'table-a' );
		} );
		resolveRowReorderTargetMock.mockImplementation( ( target ) => ( {
			status: 'resolved',
			target,
			initialConstraints: { rowCount: 3, blockedBoundaries: [] },
		} ) );
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * 概要:
	 * - Target Resolutionが開始可能とした行だけが操作可能表示の対象になることを確認する。
	 *
	 * 事前条件:
	 * - Row Reorder Mode中で、現在Tableの各行は行単位で移動可能と解決される。
	 *
	 * 操作:
	 * - 3行目へポインターを移動する。
	 *
	 * 期待結果:
	 * - 3行目だけが操作可能表示の対象として識別される。
	 */
	it( 'when target resolution resolves the hovered row, should mark only that row as highlightable', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-0' ).className ).toBe( '' );
		expect( getByTestId( 'row-1' ).className ).toBe( '' );
		expect( getByTestId( 'row-2' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );
	} );

	/**
	 * 概要:
	 * - 結合範囲により開始拒否となる行を移動不可表示として識別できることを確認する。
	 *
	 * 事前条件:
	 * - Row Reorder Mode中で、2行目は結合範囲により開始拒否、3行目は開始可能と解決される。
	 *
	 * 操作:
	 * - 3行目から2行目へポインターを移動する。
	 *
	 * 期待結果:
	 * - 3行目の操作可能表示が解除され、2行目に移動不可表示が付く。
	 */
	it( 'when target resolution rejects the hovered row, should show the row as unavailable', () => {
		resolveRowReorderTargetMock.mockImplementation( ( target ) =>
			target.sourceRowIndex === 1
				? {
						status: 'rejected',
						blockingMergedRange: {
							rowStart: 0,
							rowEnd: 1,
							columnStart: 0,
							columnEnd: 0,
						},
				  }
				: {
						status: 'resolved',
						target,
						initialConstraints: { rowCount: 3, blockedBoundaries: [ 1 ] },
				  }
		);
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-2' ).className ).toBe( '' );
		expect( getByTestId( 'row-1' ).className ).toBe( 'yamabiko-table-reorder-row-unavailable' );
	} );

	/**
	 * 概要:
	 * - 現在の移動対象を安全に解決できない場合に操作可能または移動不可と推測しないことを確認する。
	 *
	 * 事前条件:
	 * - Row Reorder Mode中で、Target Resolutionが現在行を通常の利用不能と解決する。
	 *
	 * 操作:
	 * - Table内の行へポインターを移動する。
	 *
	 * 期待結果:
	 * - 行に操作可能表示も移動不可表示も付けない。
	 */
	it( 'when target resolution returns unavailable, should not mark the hovered row with an availability state', () => {
		resolveRowReorderTargetMock.mockReturnValue( { status: 'unavailable' } );
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-2' ).className ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - Row Reorder Mode離脱時に既存の操作可否表示を残さず、その後の通常編集入力でも再表示しないことを確認する。
	 *
	 * 事前条件:
	 * - Row Reorder Mode中に移動可能な行へ操作可能表示が出ている。
	 *
	 * 操作:
	 * - 同じToolbar入口を再選択して通常編集へ戻し、その後に別行へポインターを移動する。
	 *
	 * 期待結果:
	 * - 既存の操作可能表示が解除され、通常編集では新しい操作可否表示も付かない。
	 */
	it( 'when row reorder mode ends, should clear the current row state and stop marking rows', () => {
		const { getByTestId } = render( <TestTable /> );
		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( getByTestId( 'row-2' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );

		act( () => {
			reorderMode.select( 'row', 'table-a' );
		} );
		expect( getByTestId( 'row-2' ).className ).toBe( '' );

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( getByTestId( 'row-0' ).className ).toBe( '' );
	} );
} );
