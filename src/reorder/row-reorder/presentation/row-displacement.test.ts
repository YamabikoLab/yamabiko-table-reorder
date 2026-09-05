/**
 * Row Reorderの押しのけ表示が、移動先に応じて必要な行だけを移動し、DnD終了時に表示状態を解除することを確認する。
 */

import { createRowDisplacementPresentation } from './row-displacement';

const createRows = ( count: number, rowHeight = 40 ) => {
	const table = document.createElement( 'table' );
	const tableBody = document.createElement( 'tbody' );

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

describe( 'Row displacement presentation', () => {
	/**
	 * 概要:
	 * - 下方向への移動で、移動元と移動先の間にある行だけが上へ押しのけられることを確認する。
	 *
	 * 事前条件:
	 * - 5行のTableで2行目を移動対象とする。
	 *
	 * 操作:
	 * - 最後の要素の後ろを移動先として更新する。
	 *
	 * 期待結果:
	 * - 3〜5行目だけが移動元行の高さ分だけ上へ移動する。
	 */
	it( 'when the destination is below the source row, should move only the rows between them upward', () => {
		const tableBody = createRows( 5 );
		const presentation = createRowDisplacementPresentation();
		const sourceRow = tableBody.rows.item( 1 );

		if ( sourceRow === null ) {
			throw new Error( 'Source row was not created.' );
		}

		presentation.start( sourceRow );
		presentation.update( 5 );

		expect( tableBody.rows.item( 0 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '' );
		expect( tableBody.rows.item( 1 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '' );
		expect( tableBody.rows.item( 2 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '-40px' );
		expect( tableBody.rows.item( 3 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '-40px' );
		expect( tableBody.rows.item( 4 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '-40px' );
	} );

	/**
	 * 概要:
	 * - 上方向への移動で、移動先から移動元直前までの行だけが下へ押しのけられることを確認する。
	 *
	 * 事前条件:
	 * - 5行のTableで4行目を移動対象とする。
	 *
	 * 操作:
	 * - 2行目直前を移動先として更新する。
	 *
	 * 期待結果:
	 * - 2〜3行目だけが移動元行の高さ分だけ下へ移動する。
	 */
	it( 'when the destination is above the source row, should move only the rows between them downward', () => {
		const tableBody = createRows( 5 );
		const presentation = createRowDisplacementPresentation();
		const sourceRow = tableBody.rows.item( 3 );

		if ( sourceRow === null ) {
			throw new Error( 'Source row was not created.' );
		}

		presentation.start( sourceRow );
		presentation.update( 1 );

		expect( tableBody.rows.item( 0 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '' );
		expect( tableBody.rows.item( 1 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '40px' );
		expect( tableBody.rows.item( 2 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '40px' );
		expect( tableBody.rows.item( 3 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '' );
		expect( tableBody.rows.item( 4 )?.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - 移動先変更とDnD終了で、直前の押しのけ表示が残らないことを確認する。
	 *
	 * 事前条件:
	 * - 下方向への押しのけ表示が成立している。
	 *
	 * 操作:
	 * - 順序が変わらない移動元直後へ戻した後、DnDを終了する。
	 *
	 * 期待結果:
	 * - 押しのけた行は元位置へ戻り、終了後はclassと表示位置の指定が残らない。
	 */
	it( 'when the destination returns to the source position and the drag ends, should restore and clear the displacement state', () => {
		const tableBody = createRows( 4 );
		const presentation = createRowDisplacementPresentation();
		const sourceRow = tableBody.rows.item( 1 );
		const displacedRow = tableBody.rows.item( 2 );

		if ( sourceRow === null || displacedRow === null ) {
			throw new Error( 'Required rows were not created.' );
		}

		presentation.start( sourceRow );
		presentation.update( 4 );
		presentation.update( 2 );

		expect( displacedRow.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '0px' );
		expect( displacedRow.classList.contains( 'yamabiko-table-reorder-displaced-row' ) ).toBe( true );

		presentation.end();

		expect( displacedRow.style.getPropertyValue( '--yamabiko-table-reorder-row-displacement' ) ).toBe( '' );
		expect( displacedRow.classList.contains( 'yamabiko-table-reorder-displaced-row' ) ).toBe( false );
	} );
} );
