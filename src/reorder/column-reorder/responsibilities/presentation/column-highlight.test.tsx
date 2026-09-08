/**
 * Column Reorderの列ホバー表示が、Reorder Target Resolutionの開始可否に従って操作可能・移動不可を表示することを確認する。
 */

import { fireEvent, render } from '@testing-library/react';

import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';

import { ColumnHighlight } from './column-highlight';

let mockColumnDndPhase: 'idle' | 'active' = 'idle';

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndPhase: () => mockColumnDndPhase,
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
 * 列表示の可視範囲を表す矩形を生成する。
 *
 * @param options        矩形の位置と大きさ。
 * @param options.left   editor左端からの横位置。
 * @param options.top    editor上端からの縦位置。
 * @param options.width  表示幅。
 * @param options.height 表示高。
 * @return 指定範囲を表す矩形。
 */
const createRectangle = ( options: {
	left: number;
	top: number;
	width: number;
	height: number;
} ): DOMRect =>
	( {
		left: options.left,
		top: options.top,
		width: options.width,
		height: options.height,
		right: options.left + options.width,
		bottom: options.top + options.height,
		x: options.left,
		y: options.top,
		toJSON: () => ( {} ),
	} ) as DOMRect;

/**
 * 列ホバー表示を確認するためのTableを描画する。
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
		{ ( onPointerOverCapture ) => (
			<div data-testid="wrapper" onPointerOverCapture={ onPointerOverCapture }>
				<table data-testid="table">
					<tbody>
						<tr>
							<td data-testid="row-0-column-0">A</td>
							<td data-testid="row-0-column-1">B</td>
							<td data-testid="row-0-column-2">C</td>
						</tr>
						<tr>
							<td data-testid="row-1-column-0">D</td>
							<td data-testid="row-1-column-1">E</td>
							<td data-testid="row-1-column-2">F</td>
						</tr>
					</tbody>
				</table>
			</div>
		) }
	</ColumnHighlight>
);

/**
 * Tableと対象セルへ、editor表示領域内の表示矩形を設定する。
 *
 * @param table Column Reorder対象Table。
 * @param cells 表示位置を持つTableセル。
 */
const setVisibleRectangles = ( table: HTMLElement, cells: HTMLElement[] ) => {
	jest
		.spyOn( table, 'getBoundingClientRect' )
		.mockReturnValue( createRectangle( { left: 10, top: 20, width: 300, height: 200 } ) );

	/* 各セルをTable上の論理列位置に対応する可視領域へ配置し、列表示の追従を確認できる状態にする。 */
	cells.forEach( ( cell, index ) => {
		const columnIndex = index % 3;
		const rowIndex = Math.floor( index / 3 );
		jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue(
			createRectangle( {
				left: 10 + columnIndex * 100,
				top: 20 + rowIndex * 40,
				width: 100,
				height: 40,
			} )
		);
	} );
};

describe( 'Column highlight', () => {
	let resolveMock: jest.Mock;

	beforeEach( () => {
		jest.clearAllMocks();
		mockColumnDndPhase = 'idle';
		resolveMock = jest.fn( ( sourceColumnIndex: number ) => ( {
			status: 'resolved',
			target: { tableIdentity: 'table-a', sourceColumnIndex },
			initialConstraints: { columnCount: 3, blockedBoundaries: [] },
		} ) );
		createResolverMock.mockReturnValue( {
			resolve: resolveMock,
		} );
	} );

	/**
	 * Target Resolutionが開始可能とした列だけが操作可能表示の対象になることを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableの各列は列単位で移動可能と解決される。
	 *
	 * 操作:
	 * - 2列目へポインターを移動する。
	 *
	 * 期待結果:
	 * - ポインター下のセルが掴める状態として識別される。
	 * - editor表示領域内の2列目へ操作可能表示が重なる。
	 */
	it( 'when target resolution resolves the hovered column, should show the column as highlightable', () => {
		const { getByTestId } = render( <TestTable /> );
		const table = getByTestId( 'table' );
		const cells = Array.from( table.querySelectorAll( 'td' ) );
		setVisibleRectangles( table, cells );

		fireEvent.pointerOver( getByTestId( 'row-0-column-1' ) );

		expect( getByTestId( 'row-0-column-1' ).className ).toBe(
			'yamabiko-table-reorder-column-highlightable-cell'
		);
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-highlight--highlightable' )
		).not.toBeNull();
	} );

	/**
	 * 結合範囲により開始拒否となる列を移動不可表示として識別できることを確認する。
	 *
	 * 事前条件:
	 * - 2列目は結合範囲により開始拒否と解決される。
	 *
	 * 操作:
	 * - 2列目へポインターを移動する。
	 *
	 * 期待結果:
	 * - ポインター下のセルが移動不可として識別される。
	 * - editor表示領域内の2列目へ移動不可表示が重なる。
	 */
	it( 'when target resolution rejects the hovered column, should show the column as unavailable', () => {
		resolveMock.mockReturnValue( { status: 'rejected', reason: 'merged-range' } );
		const { getByTestId } = render( <TestTable /> );
		const table = getByTestId( 'table' );
		const cells = Array.from( table.querySelectorAll( 'td' ) );
		setVisibleRectangles( table, cells );

		fireEvent.pointerOver( getByTestId( 'row-0-column-1' ) );

		expect( getByTestId( 'row-0-column-1' ).className ).toBe(
			'yamabiko-table-reorder-column-unavailable-cell'
		);
		expect(
			document.querySelector( '.yamabiko-table-reorder-column-highlight--unavailable' )
		).not.toBeNull();
	} );

	/**
	 * 現在の移動対象を安全に解決できない場合に操作可能または移動不可と推測しないことを確認する。
	 *
	 * 事前条件:
	 * - Target Resolutionが現在列を通常の利用不能と解決する。
	 *
	 * 操作:
	 * - Table内の列へポインターを移動する。
	 *
	 * 期待結果:
	 * - セルに操作可否の表示状態を付けない。
	 * - editor上に列強調表示を生成しない。
	 */
	it( 'when target resolution returns unavailable, should not show an availability state', () => {
		resolveMock.mockReturnValue( { status: 'unavailable' } );
		const { getByTestId } = render( <TestTable /> );
		const table = getByTestId( 'table' );
		const cells = Array.from( table.querySelectorAll( 'td' ) );
		setVisibleRectangles( table, cells );

		fireEvent.pointerOver( getByTestId( 'row-0-column-1' ) );

		expect( getByTestId( 'row-0-column-1' ).className ).toBe( '' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
	} );

	/**
	 * 同じ論理列内を縦方向へ移動しても開始可否を繰り返し解決しないことを確認する。
	 *
	 * 事前条件:
	 * - 2列目は開始可能と解決される。
	 *
	 * 操作:
	 * - 1行目の2列目から2行目の2列目へポインターを移動する。
	 *
	 * 期待結果:
	 * - Target Resolutionによる開始可否判定は2列目について1回だけ行われる。
	 * - 操作可能表示は現在ポインター下のセルへ追従する。
	 */
	it( 'when the pointer moves within the same logical column, should reuse the column resolution and move only the visual state', () => {
		const { getByTestId } = render( <TestTable /> );
		const table = getByTestId( 'table' );
		const cells = Array.from( table.querySelectorAll( 'td' ) );
		setVisibleRectangles( table, cells );

		fireEvent.pointerOver( getByTestId( 'row-0-column-1' ) );
		fireEvent.pointerOver( getByTestId( 'row-1-column-1' ) );

		expect( createResolverMock ).toHaveBeenCalledTimes( 1 );
		expect( resolveMock ).toHaveBeenCalledTimes( 1 );
		expect( resolveMock ).toHaveBeenCalledWith( 1 );
		expect( getByTestId( 'row-0-column-1' ).className ).toBe( '' );
		expect( getByTestId( 'row-1-column-1' ).className ).toBe(
			'yamabiko-table-reorder-column-highlightable-cell'
		);
	} );

	/**
	 * 列DnD終了後も同じTableで並び替えを続ける場合、更新前の開始可否判断を持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - 列DnD開始前に現在Tableの開始可否表示が解決されている。
	 * - 列DnDによって同じTableの列構造が変化し得る。
	 *
	 * 操作:
	 * - 列DnDを開始して終了し、同じTable Identityの列へ再度ポインターを移動する。
	 *
	 * 期待結果:
	 * - DnD中は開始可否表示を残さない。
	 * - DnD終了後は現在Tableを基準に開始可否を新しく解決する。
	 */
	it( 'when column DnD ends on the same table, should resolve highlight availability from the current table again', () => {
		const refreshedResolveMock = jest.fn( () => ( {
			status: 'rejected' as const,
			reason: 'merged-range' as const,
		} ) );
		createResolverMock
			.mockReturnValueOnce( { resolve: resolveMock } )
			.mockReturnValueOnce( { resolve: refreshedResolveMock } );
		const { getByTestId, rerender } = render( <TestTable /> );
		const table = getByTestId( 'table' );
		const cells = Array.from( table.querySelectorAll( 'td' ) );
		setVisibleRectangles( table, cells );
		const targetCell = getByTestId( 'row-0-column-1' );

		fireEvent.pointerOver( targetCell );
		expect( targetCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );

		mockColumnDndPhase = 'active';
		rerender( <TestTable /> );

		expect( targetCell.className ).toBe( '' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();

		mockColumnDndPhase = 'idle';
		rerender( <TestTable /> );
		fireEvent.pointerOver( targetCell );

		expect( createResolverMock ).toHaveBeenCalledTimes( 2 );
		expect( refreshedResolveMock ).toHaveBeenCalledWith( 1 );
		expect( targetCell.className ).toBe( 'yamabiko-table-reorder-column-unavailable-cell' );
	} );

	/**
	 * 列並び替えモード終了時に既存の操作可否表示を残さず、その後の通常編集入力でも再表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 列並び替えモード中に移動可能な列へ操作可能表示が出ている。
	 *
	 * 操作:
	 * - 列並び替えを無効化し、その後に別の列へポインターを移動する。
	 *
	 * 期待結果:
	 * - 既存の操作可能表示と列強調表示が解除される。
	 * - 無効化後はどの列にも操作可否表示を付けない。
	 */
	it( 'when column reordering becomes disabled, should clear the current column state and stop showing highlights', () => {
		const { getByTestId, rerender } = render( <TestTable /> );
		const table = getByTestId( 'table' );
		const cells = Array.from( table.querySelectorAll( 'td' ) );
		setVisibleRectangles( table, cells );

		fireEvent.pointerOver( getByTestId( 'row-0-column-1' ) );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();

		rerender( <TestTable enabled={ false } /> );

		expect( getByTestId( 'row-0-column-1' ).className ).toBe( '' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();

		fireEvent.pointerOver( getByTestId( 'row-0-column-2' ) );
		expect( getByTestId( 'row-0-column-2' ).className ).toBe( '' );
	} );

	/**
	 * 操作対象Tableが変わった場合、前のTableを基準にした表示と開始可否判断を引き継がないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aの2列目へ操作可能表示が出ている。
	 *
	 * 操作:
	 * - Presentationへ渡すTable IdentityをTable Bへ切り替え、2列目へ再度ポインターを移動する。
	 *
	 * 期待結果:
	 * - Table Aの一時表示は切替時に解除される。
	 * - Table Bの識別値を基準に新しいTarget Resolverが生成される。
	 */
	it( 'when the target table identity changes, should clear the previous state and resolve against the new table', () => {
		const { getByTestId, rerender } = render( <TestTable tableIdentity="table-a" /> );
		const table = getByTestId( 'table' );
		const cells = Array.from( table.querySelectorAll( 'td' ) );
		setVisibleRectangles( table, cells );

		fireEvent.pointerOver( getByTestId( 'row-0-column-1' ) );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();

		rerender( <TestTable tableIdentity="table-b" /> );

		expect( getByTestId( 'row-0-column-1' ).className ).toBe( '' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();

		fireEvent.pointerOver( getByTestId( 'row-0-column-1' ) );

		expect( createResolverMock ).toHaveBeenNthCalledWith( 1, 'table-a' );
		expect( createResolverMock ).toHaveBeenNthCalledWith( 2, 'table-b' );
	} );

	/**
	 * Presentation境界が終了した場合、editorへ追加した一時表示を残さないことを確認する。
	 *
	 * 事前条件:
	 * - 移動可能な列へ操作可能表示が出ている。
	 *
	 * 操作:
	 * - Column Highlightをunmountする。
	 *
	 * 期待結果:
	 * - 対象セルの操作可能状態が解除される。
	 * - editor上の列強調表示が除去される。
	 */
	it( 'when the presentation boundary unmounts, should remove the temporary column state', () => {
		const { getByTestId, unmount } = render( <TestTable /> );
		const table = getByTestId( 'table' );
		const cells = Array.from( table.querySelectorAll( 'td' ) );
		setVisibleRectangles( table, cells );
		const targetCell = getByTestId( 'row-0-column-1' );

		fireEvent.pointerOver( targetCell );
		expect( targetCell.className ).toBe( 'yamabiko-table-reorder-column-highlightable-cell' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).not.toBeNull();

		unmount();

		expect( targetCell.className ).toBe( '' );
		expect( document.querySelector( '.yamabiko-table-reorder-column-highlight' ) ).toBeNull();
	} );
} );
