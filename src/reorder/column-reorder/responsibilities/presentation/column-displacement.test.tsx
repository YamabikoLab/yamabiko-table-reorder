/**
 * Column Reorderの押しのけ表示が、DnD Interactionの論理列状態と開始時Table配置から必要な周囲セルだけを移動することを確認する。
 */

import { act, render } from '@testing-library/react';

import { ColumnDisplacement } from './column-displacement';

let mockSourceColumnIndex: number | null = null;
let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragEnd?: () => void;
} = {};

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndSourceColumnIndex: () => mockSourceColumnIndex,
	useColumnDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

const DISPLACEMENT_PROPERTY = '--yamabiko-table-reorder-column-displacement';

/**
 * 通常列だけを持つ押しのけ表示用Tableを作成する。
 *
 * @param columnCount Tableの論理列数。
 * @param sourceIndex DnD開始セルとする論理列位置。
 * @param sourceWidth 移動対象列の表示幅。
 * @param direction   Tableの論理列方向。
 * @return Table、各列セル、DnD開始セル。
 */
const createSimpleTable = (
	columnCount: number,
	sourceIndex: number,
	sourceWidth = 40,
	direction: 'ltr' | 'rtl' = 'ltr'
) => {
	const table = document.createElement( 'table' );
	table.style.direction = direction;
	const tableBody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const cells: HTMLTableCellElement[] = [];

	/* 移動元と移動先の間に複数論理列を持つTableを構成する。 */
	for ( let index = 0; index < columnCount; index++ ) {
		const cell = document.createElement( 'td' );
		cell.textContent = `${ index }`;
		row.appendChild( cell );
		cells.push( cell );
	}

	tableBody.appendChild( row );
	table.appendChild( tableBody );
	document.body.appendChild( table );

	const sourceCell = cells[ sourceIndex ];
	if ( sourceCell === undefined ) {
		throw new Error( 'Source cell was not created.' );
	}

	jest.spyOn( sourceCell, 'getBoundingClientRect' ).mockReturnValue( {
		top: 0,
		bottom: 40,
		left: sourceIndex * sourceWidth,
		right: ( sourceIndex + 1 ) * sourceWidth,
		width: sourceWidth,
		height: 40,
		x: sourceIndex * sourceWidth,
		y: 0,
		toJSON: () => ( {} ),
	} );

	return { table, cells, sourceCell };
};

/**
 * DnD EngineからColumnの物理DnD開始が通知された状態を作る。
 *
 * @param sourceCell DnD開始対象として通知するTableセル。
 */
const startPhysicalDrag = ( sourceCell: HTMLTableCellElement ): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: { source: { element: sourceCell } },
		} );
	} );
};

describe( 'Column displacement presentation', () => {
	beforeEach( () => {
		mockSourceColumnIndex = null;
		mockDestinationBoundaryIndex = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
	} );

	/**
	 * 論理終了側への移動で、移動元と移動先の間だけが論理開始方向へ押しのけられることを確認する。
	 *
	 * 事前条件:
	 * - LTRの5列Tableで2列目を移動対象とする。
	 *
	 * 操作:
	 * - 最後の要素の後ろを有効な移動先として通知する。
	 *
	 * 期待結果:
	 * - 3〜5列目だけが移動対象列幅ぶん左へ移動する。
	 */
	it( 'when the destination is after the source column in LTR, should move only the columns between them toward logical start', () => {
		const { cells, sourceCell } = createSimpleTable( 5, 1 );
		const { rerender } = render( <ColumnDisplacement /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 1;
		mockDestinationBoundaryIndex = 5;
		rerender( <ColumnDisplacement /> );

		expect( cells[ 0 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '' );
		expect( cells[ 1 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '' );
		for ( let index = 2; index <= 4; index++ ) {
			expect( cells[ index ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '-40px' );
		}
	} );

	/**
	 * 論理開始側への移動で、移動先から移動元直前までだけが論理終了方向へ押しのけられることを確認する。
	 *
	 * 事前条件:
	 * - LTRの5列Tableで4列目を移動対象とする。
	 *
	 * 操作:
	 * - 2列目直前を有効な移動先として通知する。
	 *
	 * 期待結果:
	 * - 2〜3列目だけが移動対象列幅ぶん右へ移動する。
	 */
	it( 'when the destination is before the source column in LTR, should move only the columns between them toward logical end', () => {
		const { cells, sourceCell } = createSimpleTable( 5, 3 );
		const { rerender } = render( <ColumnDisplacement /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 3;
		mockDestinationBoundaryIndex = 1;
		rerender( <ColumnDisplacement /> );

		expect( cells[ 0 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '' );
		expect( cells[ 1 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '40px' );
		expect( cells[ 2 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '40px' );
		expect( cells[ 3 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '' );
		expect( cells[ 4 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '' );
	} );

	/**
	 * RTLでも物理左右ではなく論理列方向を基準に同じ列移動を表現することを確認する。
	 *
	 * 事前条件:
	 * - RTLの5列Tableで2列目を移動対象とする。
	 *
	 * 操作:
	 * - 最後の要素の後ろを有効な移動先として通知する。
	 *
	 * 期待結果:
	 * - 移動元より論理終了側の列が、RTLの論理開始方向である右へ移動する。
	 */
	it( 'when the table is RTL, should convert logical displacement to the corresponding physical direction', () => {
		const { cells, sourceCell } = createSimpleTable( 5, 1, 40, 'rtl' );
		const { rerender } = render( <ColumnDisplacement /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 1;
		mockDestinationBoundaryIndex = 5;
		rerender( <ColumnDisplacement /> );

		for ( let index = 2; index <= 4; index++ ) {
			expect( cells[ index ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '40px' );
		}
	} );

	/**
	 * 移動先が隣接境界へ変わる場合、継続して押しのける列を更新し直さないことを確認する。
	 *
	 * 事前条件:
	 * - 先頭列を移動対象とし、3列目直後までの押しのけ表示が成立している。
	 *
	 * 操作:
	 * - 移動先を1境界だけ論理終了側へ変更する。
	 *
	 * 期待結果:
	 * - 既存範囲のセルには再設定せず、新しく範囲へ入った列だけを押しのける。
	 */
	it( 'when the destination moves by one boundary, should update only the changed logical column', () => {
		const { cells, sourceCell } = createSimpleTable( 5, 0 );
		const { rerender } = render( <ColumnDisplacement /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 3;
		rerender( <ColumnDisplacement /> );

		const unchangedSetProperty = jest.spyOn( cells[ 1 ]!.style, 'setProperty' );
		const newSetProperty = jest.spyOn( cells[ 3 ]!.style, 'setProperty' );

		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnDisplacement /> );

		expect( unchangedSetProperty ).not.toHaveBeenCalled();
		expect( newSetProperty ).toHaveBeenCalledWith( DISPLACEMENT_PROPERTY, '-40px' );
	} );

	/**
	 * 移動先が移動元の反対側へ変わった場合、以前の押しのけ範囲を残さず新しい方向へ切り替えることを確認する。
	 *
	 * 事前条件:
	 * - LTRの5列Tableで3列目を移動対象とし、論理終了側への押しのけ表示が成立している。
	 *
	 * 操作:
	 * - 移動先を移動元より論理開始側へ変更する。
	 *
	 * 期待結果:
	 * - 以前の論理終了側は元位置へ戻り、現在の論理開始側だけが反対方向へ押しのけられる。
	 */
	it( 'when the destination crosses the source column, should replace the previous displacement with the opposite direction', () => {
		const { cells, sourceCell } = createSimpleTable( 5, 2 );
		const { rerender } = render( <ColumnDisplacement /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 2;
		mockDestinationBoundaryIndex = 5;
		rerender( <ColumnDisplacement /> );

		expect( cells[ 3 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '-40px' );
		expect( cells[ 4 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '-40px' );

		mockDestinationBoundaryIndex = 0;
		rerender( <ColumnDisplacement /> );

		expect( cells[ 0 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '40px' );
		expect( cells[ 1 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '40px' );
		expect( cells[ 3 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '0px' );
		expect( cells[ 4 ]?.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '0px' );
	} );

	/**
	 * Table全sectionと結合セルを論理列として扱い、同じ結合セルを重複して移動しないことを確認する。
	 *
	 * 事前条件:
	 * - thead / tbody / tfootとrowspan / colspanを含む4列Tableで先頭列を移動対象とする。
	 *
	 * 操作:
	 * - 最後の要素の後ろを有効な移動先として通知する。
	 *
	 * 期待結果:
	 * - 論理列2〜4を覆う各セルだけが移動対象列幅ぶん移動する。
	 * - 複数論理列を覆う結合セルにも移動量は1回だけ設定される。
	 */
	it( 'when all table sections contain merged cells, should displace each covering cell once and leave unrelated cells unchanged', () => {
		const table = document.createElement( 'table' );
		table.innerHTML = `
			<thead><tr><th data-cell="source">S</th><th data-cell="head-merged" colspan="2">HM</th><th>H4</th></tr></thead>
			<tbody>
				<tr><td data-cell="body-source-a">S1</td><td data-cell="body-rowspan" rowspan="2">R</td><td>B3</td><td>B4</td></tr>
				<tr><td data-cell="body-source-b">S2</td><td data-cell="body-merged" colspan="2">BM</td></tr>
			</tbody>
			<tfoot><tr><td data-cell="foot-source">FS</td><td>F2</td><td>F3</td><td>F4</td></tr></tfoot>
		`;
		document.body.appendChild( table );
		const sourceCell = table.querySelector( '[data-cell="source"]' ) as HTMLTableCellElement;
		const headMerged = table.querySelector( '[data-cell="head-merged"]' ) as HTMLTableCellElement;
		jest.spyOn( sourceCell, 'getBoundingClientRect' ).mockReturnValue( {
			top: 0,
			bottom: 40,
			left: 0,
			right: 60,
			width: 60,
			height: 40,
			x: 0,
			y: 0,
			toJSON: () => ( {} ),
		} );
		const headMergedSetProperty = jest.spyOn( headMerged.style, 'setProperty' );
		const { rerender } = render( <ColumnDisplacement /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnDisplacement /> );

		expect( headMerged.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '-60px' );
		expect( headMergedSetProperty ).toHaveBeenCalledTimes( 1 );
		expect(
			(
				table.querySelector( '[data-cell="body-rowspan"]' ) as HTMLTableCellElement
			 ).style.getPropertyValue( DISPLACEMENT_PROPERTY )
		).toBe( '-60px' );
		expect(
			(
				table.querySelector( '[data-cell="body-merged"]' ) as HTMLTableCellElement
			 ).style.getPropertyValue( DISPLACEMENT_PROPERTY )
		).toBe( '-60px' );
		for ( const selector of [
			'[data-cell="source"]',
			'[data-cell="body-source-a"]',
			'[data-cell="body-source-b"]',
			'[data-cell="foot-source"]',
		] ) {
			expect(
				( table.querySelector( selector ) as HTMLTableCellElement ).style.getPropertyValue(
					DISPLACEMENT_PROPERTY
				)
			).toBe( '' );
		}
	} );

	/**
	 * 有効な移動先がなくなった場合とDnD終了時に、一時的な押しのけ表示を残さないことを確認する。
	 *
	 * 事前条件:
	 * - 周囲列の押しのけ表示が成立している。
	 *
	 * 操作:
	 * - 有効な移動先を解除した後、物理DnDを終了する。
	 *
	 * 期待結果:
	 * - 対象セルは元位置へ戻り、DnD終了後は一時classと移動量指定が残らない。
	 */
	it( 'when the destination becomes unavailable and the drag ends, should restore and clear displacement state', () => {
		const { cells, sourceCell } = createSimpleTable( 4, 0 );
		const { rerender } = render( <ColumnDisplacement /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rerender( <ColumnDisplacement /> );
		const displacedCell = cells[ 1 ]!;

		mockDestinationBoundaryIndex = null;
		rerender( <ColumnDisplacement /> );
		expect( displacedCell.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '0px' );

		act( () => {
			mockDragDropMonitor.onDragEnd?.();
		} );

		expect( displacedCell.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '' );
		expect(
			displacedCell.classList.contains( 'yamabiko-table-reorder-displaced-column-cell' )
		).toBe( false );
	} );

	/**
	 * PresentationがDnD中に取り外された場合も、一時的な押しのけ表示を実Tableへ残さないことを確認する。
	 *
	 * 事前条件:
	 * - 周囲列の押しのけ表示が成立している。
	 *
	 * 操作:
	 * - DnD終了通知より先にColumn Displacementをunmountする。
	 *
	 * 期待結果:
	 * - このPresentationが適用した一時classと移動量指定がすべて解除される。
	 */
	it( 'when the presentation unmounts during an active drag, should clear all temporary displacement state', () => {
		const { cells, sourceCell } = createSimpleTable( 4, 0 );
		const rendered = render( <ColumnDisplacement /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 0;
		mockDestinationBoundaryIndex = 4;
		rendered.rerender( <ColumnDisplacement /> );
		const displacedCell = cells[ 1 ]!;

		expect( displacedCell.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '-40px' );

		rendered.unmount();

		expect( displacedCell.style.getPropertyValue( DISPLACEMENT_PROPERTY ) ).toBe( '' );
		expect(
			displacedCell.classList.contains( 'yamabiko-table-reorder-displaced-column-cell' )
		).toBe( false );
	} );
} );
