/**
 * Row Reorderの行ホバー表示が、Table Integrationの現在制約に従って操作可能な行だけを表示対象にすることを確認する。
 */

import { fireEvent, render } from '@testing-library/react';

import { RowHighlight } from './row-highlight';

const mockGetConstraints = jest.fn();

jest.mock( '@/reorder/row-reorder/table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: ( tableIdentity: string ) => mockGetConstraints( tableIdentity ),
	},
} ) );

const TestTable = ( props: { enabled?: boolean } ) => (
	<RowHighlight enabled={ props.enabled ?? true } tableIdentity="table-a">
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
		mockGetConstraints.mockReset();
	} );

	/**
	 * 概要:
	 * - 縦結合の分断不可境界に接していない行だけが操作可能表示の対象になることを確認する。
	 *
	 * 事前条件:
	 * - 3行Tableで境界1が縦結合により分断不可である。
	 *
	 * 操作:
	 * - 縦結合に含まれない3行目へポインターを移動する。
	 *
	 * 期待結果:
	 * - 3行目だけがホバー表示とgrabカーソルの対象として識別される。
	 */
	it( 'when a hovered row is outside merged ranges, should mark only that row as highlightable', () => {
		mockGetConstraints.mockReturnValue( { rowCount: 3, blockedBoundaries: [ 1 ] } );
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-0' ).className ).toBe( '' );
		expect( getByTestId( 'row-1' ).className ).toBe( '' );
		expect( getByTestId( 'row-2' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );
	} );

	/**
	 * 概要:
	 * - 縦結合範囲に含まれる行へ移動した場合、操作可能表示を出さないことを確認する。
	 *
	 * 事前条件:
	 * - 3行Tableで境界1が縦結合により分断不可であり、3行目には操作可能表示が出ている。
	 *
	 * 操作:
	 * - 3行目から縦結合に含まれる2行目へポインターを移動する。
	 *
	 * 期待結果:
	 * - 以前の操作可能表示が解除され、2行目にも操作可能表示を付けない。
	 */
	it( 'when the pointer moves onto a row inside a merged range, should clear the highlightable row', () => {
		mockGetConstraints.mockReturnValue( { rowCount: 3, blockedBoundaries: [ 1 ] } );
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-1' ).className ).toBe( '' );
		expect( getByTestId( 'row-2' ).className ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - Table Integrationが制約を提供できない場合に操作可能と推測しないことを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableの制約情報を取得できない。
	 *
	 * 操作:
	 * - Table内の行へポインターを移動する。
	 *
	 * 期待結果:
	 * - どの行にも操作可能表示を付けない。
	 */
	it( 'when current table constraints are unavailable, should not mark a hovered row as highlightable', () => {
		mockGetConstraints.mockReturnValue( null );
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-2' ).className ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - 行並び替えモード終了時に既存の操作可能表示を残さず、その後の通常編集入力でも再表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモード中に移動可能な行へ操作可能表示が出ている。
	 *
	 * 操作:
	 * - 行並び替えを無効化し、その後に別の行へポインターを移動する。
	 *
	 * 期待結果:
	 * - 既存の操作可能表示が解除され、無効化後はどの行にも操作可能表示を付けない。
	 */
	it( 'when row reordering becomes disabled, should clear the current highlight and stop marking rows as highlightable', () => {
		mockGetConstraints.mockReturnValue( { rowCount: 3, blockedBoundaries: [] } );
		const { getByTestId, rerender } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-2' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( getByTestId( 'row-2' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );

		rerender( <TestTable enabled={ false } /> );
		expect( getByTestId( 'row-2' ).className ).toBe( '' );

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( getByTestId( 'row-0' ).className ).toBe( '' );
	} );
} );
