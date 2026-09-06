/**
 * Row Reorderの押しのけ表示が、DnD EngineとDnD Interactionへ直接接続し、移動先に応じて必要な行だけを移動することを確認する。
 */

import { act, render } from '@testing-library/react';

import { RowDisplacement } from './row-displacement';

let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragEnd?: () => void;
} = {};

jest.mock( '@/reorder/row-reorder/dnd-interaction-react', () => ( {
	useRowDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/**
 * 押しのけ表示の対象となる一定高さの行を持つTableを作成する。
 *
 * @param count     Tableに作成する行数。
 * @param rowHeight 各行の表示高さ。
 * @return 作成したtbody。
 */
const createRows = ( count: number, rowHeight = 40 ) => {
	const table = document.createElement( 'table' );
	const tableBody = document.createElement( 'tbody' );

	/* 移動元と移動先の間に複数行がある押しのけ範囲を検証できるTableを構成する。 */
	for ( let index = 0; index < count; index++ ) {
		const row = document.createElement( 'tr' );
		row.appendChild( document.createElement( 'td' ) );
		jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue( {
			top: index * rowHeight,
			bottom: ( index + 1 ) * rowHeight,
			left: 0,
			right: 100,
			width: 100,
			height: rowHeight,
			x: 0,
			y: index * rowHeight,
			toJSON: () => ( {} ),
		} );
		tableBody.appendChild( row );
	}

	table.appendChild( tableBody );
	return tableBody;
};

/**
 * DnD Engineから対象行の物理DnD開始が通知された状態を作る。
 *
 * @param row 物理DnDの移動対象として通知する行。
 */
const startPhysicalDrag = ( row: HTMLTableRowElement ) => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: { source: { element: row } },
		} );
	} );
};

describe( 'Row displacement presentation', () => {
	beforeEach( () => {
		mockDestinationBoundaryIndex = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
	} );

	/**
	 * 概要:
	 * - 下方向への移動で、移動元と移動先の間にある行だけが上へ押しのけられることを確認する。
	 *
	 * 事前条件:
	 * - 5行のTableで2行目を移動対象とする。
	 *
	 * 操作:
	 * - 物理DnDを開始し、最後の要素の後ろを有効な移動先として通知する。
	 *
	 * 期待結果:
	 * - 3〜5行目だけが移動元行の高さ分だけ上へ移動する。
	 */
	it( 'when the destination is below the source row, should move only the rows between them upward', () => {
		const tableBody = createRows( 5 );
		const sourceRow = tableBody.rows.item( 1 );

		if ( sourceRow === null ) {
			throw new Error( 'Source row was not created.' );
		}

		const { rerender } = render( <RowDisplacement /> );
		startPhysicalDrag( sourceRow );
		mockDestinationBoundaryIndex = 5;
		rerender( <RowDisplacement /> );

		expect(
			tableBody.rows
				.item( 0 )
				?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
		).toBe( '' );
		expect(
			tableBody.rows
				.item( 1 )
				?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
		).toBe( '' );

		/* 移動元より後ろから移動先直前までの行だけが、移動元行1行分だけ上へ移動する。 */
		for ( let index = 2; index <= 4; index++ ) {
			expect(
				tableBody.rows
					.item( index )
					?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
			).toBe( '-40px' );
		}
	} );

	/**
	 * 概要:
	 * - 上方向への移動で、移動先から移動元直前までの行だけが下へ押しのけられることを確認する。
	 *
	 * 事前条件:
	 * - 5行のTableで4行目を移動対象とする。
	 *
	 * 操作:
	 * - 物理DnDを開始し、2行目直前を有効な移動先として通知する。
	 *
	 * 期待結果:
	 * - 2〜3行目だけが移動元行の高さ分だけ下へ移動する。
	 */
	it( 'when the destination is above the source row, should move only the rows between them downward', () => {
		const tableBody = createRows( 5 );
		const sourceRow = tableBody.rows.item( 3 );

		if ( sourceRow === null ) {
			throw new Error( 'Source row was not created.' );
		}

		const { rerender } = render( <RowDisplacement /> );
		startPhysicalDrag( sourceRow );
		mockDestinationBoundaryIndex = 1;
		rerender( <RowDisplacement /> );

		expect(
			tableBody.rows
				.item( 0 )
				?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
		).toBe( '' );
		expect(
			tableBody.rows
				.item( 1 )
				?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
		).toBe( '40px' );
		expect(
			tableBody.rows
				.item( 2 )
				?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
		).toBe( '40px' );
		expect(
			tableBody.rows
				.item( 3 )
				?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
		).toBe( '' );
		expect(
			tableBody.rows
				.item( 4 )
				?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
		).toBe( '' );
	} );

	/**
	 * 概要:
	 * - 移動先が隣接境界へ変わる場合、既に同じ位置へ押しのけ済みの行を更新し直さないことを確認する。
	 *
	 * 事前条件:
	 * - 下方向への押しのけ表示が複数行に成立している。
	 *
	 * 操作:
	 * - 移動先を1境界だけ下へ変更する。
	 *
	 * 期待結果:
	 * - 既存の押しのけ行には表示位置の再設定が発生せず、新しく範囲へ入った1行だけが追加で押しのけられる。
	 */
	it( 'when the destination moves by one boundary, should update only the changed displacement row', () => {
		const tableBody = createRows( 6 );
		const sourceRow = tableBody.rows.item( 0 );
		const unchangedRow = tableBody.rows.item( 2 );
		const newlyDisplacedRow = tableBody.rows.item( 4 );

		if ( sourceRow === null || unchangedRow === null || newlyDisplacedRow === null ) {
			throw new Error( 'Required rows were not created.' );
		}

		const { rerender } = render( <RowDisplacement /> );
		startPhysicalDrag( sourceRow );
		mockDestinationBoundaryIndex = 4;
		rerender( <RowDisplacement /> );

		const unchangedSetProperty = jest.spyOn( unchangedRow.style, 'setProperty' );
		const newlyDisplacedSetProperty = jest.spyOn( newlyDisplacedRow.style, 'setProperty' );

		mockDestinationBoundaryIndex = 5;
		rerender( <RowDisplacement /> );

		expect( unchangedSetProperty ).not.toHaveBeenCalled();
		expect( newlyDisplacedSetProperty ).toHaveBeenCalledWith(
			'--yamabiko-table-reorder-row-displacement',
			'-40px'
		);
	} );

	/**
	 * 概要:
	 * - DnD Interactionから有効な移動先がなくなった場合とDnD終了時に、直前の押しのけ表示が残らないことを確認する。
	 *
	 * 事前条件:
	 * - 下方向への押しのけ表示が成立している。
	 *
	 * 操作:
	 * - 有効な移動先をnullへ変更した後、物理DnDを終了する。
	 *
	 * 期待結果:
	 * - 押しのけた行は元位置へ戻り、終了後はclassと表示位置の指定が残らない。
	 */
	it( 'when there is no valid destination and the drag ends, should restore and clear the displacement state', () => {
		const tableBody = createRows( 4 );
		const sourceRow = tableBody.rows.item( 1 );
		const displacedRow = tableBody.rows.item( 2 );

		if ( sourceRow === null || displacedRow === null ) {
			throw new Error( 'Required rows were not created.' );
		}

		const { rerender } = render( <RowDisplacement /> );
		startPhysicalDrag( sourceRow );
		mockDestinationBoundaryIndex = 4;
		rerender( <RowDisplacement /> );
		mockDestinationBoundaryIndex = null;
		rerender( <RowDisplacement /> );

		expect(
			displacedRow.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
		).toBe( '0px' );
		expect( displacedRow.classList.contains( 'yamabiko-table-reorder-displaced-row' ) ).toBe(
			true
		);

		act( () => {
			mockDragDropMonitor.onDragEnd?.();
		} );

		expect(
			displacedRow.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' )
		).toBe( '' );
		expect( displacedRow.classList.contains( 'yamabiko-table-reorder-displaced-row' ) ).toBe(
			false
		);
	} );
} );