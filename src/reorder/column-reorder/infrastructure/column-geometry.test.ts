/**
 * Column Reorderが利用する列境界計測が、結合セルを含むTableでも論理列番号と描画位置の対応を保つことを確認する。
 *
 * Destination ResolutionやPresentationの意味判断は扱わず、現在のDOMから観測可能な列境界を取得する技術境界だけを検証する。
 */

import { measureTableColumnBoundaryGeometry } from '@/reorder/column-reorder/infrastructure/column-geometry';

/**
 * セルへ指定した横位置を設定する。
 *
 * @param cell  計測対象セル。
 * @param left  Table左端を基準とするセル左端位置。
 * @param right Table左端を基準とするセル右端位置。
 */
const setCellRectangle = ( cell: HTMLTableCellElement, left: number, right: number ): void => {
	jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue( {
		left,
		right,
		top: 0,
		bottom: 40,
		width: right - left,
		height: 40,
		x: left,
		y: 0,
		toJSON: () => ( {} ),
	} );
};

/**
 * Tableの計測基準を固定する。
 *
 * @param table 計測対象Table。
 * @param width Table全体の横幅。
 */
const setTableRectangle = ( table: HTMLTableElement, width: number ): void => {
	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( {
		left: 0,
		right: width,
		top: 0,
		bottom: 80,
		width,
		height: 80,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
	} );
};

describe( 'Column geometry measurement', () => {
	/**
	 * 概要:
	 * - 縦結合が次行の論理列位置を占有しても、残りのセルを正しい列位置として解釈できることを確認する。
	 * 事前条件:
	 * - 先頭列が2行に縦結合され、1行目と2行目の残りセルから列境界を観測できる。
	 * 操作:
	 * - Table全体の論理列境界を計測する。
	 * 期待結果:
	 * - 先頭から末尾直後まで境界0、1、2が描画位置0、100、220として返される。
	 */
	it( 'when a rowspan occupies a column in the following row, should keep logical column boundaries aligned', () => {
		const table = document.createElement( 'table' );
		const tbody = document.createElement( 'tbody' );
		const firstRow = document.createElement( 'tr' );
		const secondRow = document.createElement( 'tr' );
		const spanningCell = document.createElement( 'td' );
		const firstRowSecondCell = document.createElement( 'td' );
		const secondRowSecondCell = document.createElement( 'td' );
		spanningCell.rowSpan = 2;
		firstRow.append( spanningCell, firstRowSecondCell );
		secondRow.appendChild( secondRowSecondCell );
		tbody.append( firstRow, secondRow );
		table.appendChild( tbody );
		setTableRectangle( table, 220 );
		setCellRectangle( spanningCell, 0, 100 );
		setCellRectangle( firstRowSecondCell, 100, 220 );
		setCellRectangle( secondRowSecondCell, 100, 220 );

		expect( measureTableColumnBoundaryGeometry( table ) ).toEqual( [
			{ index: 0, offset: 0 },
			{ index: 1, offset: 100 },
			{ index: 2, offset: 220 },
		] );
	} );

	/**
	 * 概要:
	 * - 縦結合の占有状態を別のTable sectionへ持ち越さないことを確認する。
	 * 事前条件:
	 * - thead末尾セルにrowspanがあり、tbody先頭行は通常の2列として描画されている。
	 * 操作:
	 * - Table全体の論理列境界を計測する。
	 * 期待結果:
	 * - tbody先頭セルは論理列0として解釈され、境界0、1、2が正しい描画位置で返される。
	 */
	it( 'when table section changes, should not carry rowspan occupancy into the next section', () => {
		const table = document.createElement( 'table' );
		const thead = document.createElement( 'thead' );
		const tbody = document.createElement( 'tbody' );
		const headRow = document.createElement( 'tr' );
		const bodyRow = document.createElement( 'tr' );
		const headCell = document.createElement( 'th' );
		const bodyFirstCell = document.createElement( 'td' );
		const bodySecondCell = document.createElement( 'td' );
		headCell.rowSpan = 2;
		headCell.colSpan = 2;
		headRow.appendChild( headCell );
		bodyRow.append( bodyFirstCell, bodySecondCell );
		thead.appendChild( headRow );
		tbody.appendChild( bodyRow );
		table.append( thead, tbody );
		setTableRectangle( table, 200 );
		setCellRectangle( headCell, 0, 200 );
		setCellRectangle( bodyFirstCell, 0, 80 );
		setCellRectangle( bodySecondCell, 80, 200 );

		expect( measureTableColumnBoundaryGeometry( table ) ).toEqual( [
			{ index: 0, offset: 0 },
			{ index: 1, offset: 80 },
			{ index: 2, offset: 200 },
		] );
	} );

	/**
	 * 概要:
	 * - 横結合セルの内部境界を別行から観測できる場合、その実測位置を論理列境界として利用できることを確認する。
	 * 事前条件:
	 * - 1行目は2論理列を覆う横結合セルで、2行目は同じ2列を通常セルとして描画している。
	 * 操作:
	 * - Table全体の論理列境界を計測する。
	 * 期待結果:
	 * - 横結合セルだけでは見えない境界1が2行目の実測位置80として返される。
	 */
	it( 'when a merged cell hides a boundary that another row exposes, should use the observed boundary from that row', () => {
		const table = document.createElement( 'table' );
		const tbody = document.createElement( 'tbody' );
		const mergedRow = document.createElement( 'tr' );
		const normalRow = document.createElement( 'tr' );
		const mergedCell = document.createElement( 'td' );
		const firstCell = document.createElement( 'td' );
		const secondCell = document.createElement( 'td' );
		mergedCell.colSpan = 2;
		mergedRow.appendChild( mergedCell );
		normalRow.append( firstCell, secondCell );
		tbody.append( mergedRow, normalRow );
		table.appendChild( tbody );
		setTableRectangle( table, 200 );
		setCellRectangle( mergedCell, 0, 200 );
		setCellRectangle( firstCell, 0, 80 );
		setCellRectangle( secondCell, 80, 200 );

		expect( measureTableColumnBoundaryGeometry( table ) ).toEqual( [
			{ index: 0, offset: 0 },
			{ index: 1, offset: 80 },
			{ index: 2, offset: 200 },
		] );
	} );
} );
