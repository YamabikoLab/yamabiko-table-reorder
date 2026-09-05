/**
 * Row Reorderの移動対象表示が、DnD Interactionの意味状態とDnD Engineの物理情報を責務どおり組み合わせることを確認する。
 *
 * DnD Interaction本体やDnD Engine本体の実装は重複して検証せず、active Session中だけの表示、
 * 元行の半透明表示、移動表示の通常濃度、入力対象外であること、縦方向追従、表示領域への制限、Session終了および境界終了時の表示解除を検証する。
 */

import { act, render } from '@testing-library/react';

import { RowMovingDisplay } from './moving-row';

let mockRowDndPhase: 'idle' | 'active' = 'idle';
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
} = {};

jest.mock( '../dnd-interaction-react', () => ( {
	useRowDndPhase: () => mockRowDndPhase,
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/**
 * 移動表示の配置条件を必要な値だけで表せるDOM矩形を作成する。
 *
 * @param values テスト条件として上書きする表示寸法と位置。
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

/** 移動表示の成立条件を満たす2セルの対象Tableを用意する。 */
const createSourceTable = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const firstCell = document.createElement( 'td' );
	const secondCell = document.createElement( 'td' );
	firstCell.textContent = 'First';
	secondCell.textContent = '';
	row.append( firstCell, secondCell );
	tbody.appendChild( row );
	table.appendChild( tbody );
	document.body.appendChild( table );

	const tableRectangleMock = jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			left: 100,
			right: 500,
			width: 400,
		} )
	);
	jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: 80,
			bottom: 120,
			left: 100,
			right: 500,
			width: 400,
			height: 40,
		} )
	);
	jest.spyOn( firstCell, 'getBoundingClientRect' ).mockReturnValue( rectangle( { width: 220 } ) );
	jest.spyOn( secondCell, 'getBoundingClientRect' ).mockReturnValue( rectangle( { width: 180 } ) );

	return { table, row, tableRectangleMock };
};

/**
 * DnD Engineから対象行の物理DnD開始が通知された状態を作る。
 *
 * @param row 物理DnDの移動対象として通知する行。
 */
const startPhysicalDrag = ( row: HTMLTableRowElement ) => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: {
				source: { element: row },
				position: {
					initial: { y: 100 },
					current: { y: 100 },
				},
			},
		} );
	} );
};

describe( 'Row moving display', () => {
	beforeEach( () => {
		mockRowDndPhase = 'idle';
		mockDragDropMonitor = {};
		document.body.replaceChildren();
	} );

	/**
	 * 概要:
	 * - 物理DnD開始だけでは移動表示を成立させず、Row DnD Sessionがactiveになった場合だけ表示することを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineは移動対象行と物理位置を提供できる。
	 * - DnD Interactionはまだidleである。
	 *
	 * 操作:
	 * - 物理DnD開始を通知した後、Row DnD Sessionをactiveへ変更する。
	 *
	 * 期待結果:
	 * - idle中は表示せず、active後に元行を半透明として残し、移動表示には半透明状態を持ち込まず表示する。
	 */
	it( 'when physical drag information exists and the row DnD session becomes active, should show the moving row only for the active session', () => {
		const { table, row } = createSourceTable();
		const { rerender } = render( <RowMovingDisplay /> );

		startPhysicalDrag( row );
		expect( row.classList ).not.toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 1 );

		mockRowDndPhase = 'active';
		rerender( <RowMovingDisplay /> );

		expect( row.classList ).toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( table.getBoundingClientRect().width ).toBe( 400 );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 2 );
		const overlayTable = document.body.querySelectorAll( 'table' ).item( 1 );
		const overlayRow = overlayTable.querySelector( 'tr' );
		const overlayCells = overlayTable.querySelectorAll( 'td' );
		expect( overlayRow?.classList ).not.toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( overlayCells.item( 0 ).style.width ).toBe( '220px' );
		expect( overlayCells.item( 1 ).style.width ).toBe( '180px' );
		expect( overlayTable.classList ).toContain( 'yamabiko-table-reorder-moving-row-table' );
	} );

	/**
	 * 概要:
	 * - 元行に編集可能要素があっても、移動表示全体を入力・フォーカス対象外にすることを確認する。
	 *
	 * 事前条件:
	 * - Row DnD Sessionがactiveである。
	 * - 移動対象行にはcontenteditableな要素が含まれる。
	 *
	 * 操作:
	 * - 対象行の物理DnD開始を通知する。
	 *
	 * 期待結果:
	 * - 編集可能要素を含む複製は移動表示へ描画されるが、移動表示境界はinertであり入力・フォーカス対象にならない。
	 */
	it( 'when the source row contains editable content, should keep the moving display outside input and focus targets', () => {
		const { row } = createSourceTable();
		const editable = document.createElement( 'div' );
		editable.contentEditable = 'true';
		editable.textContent = 'Editable';
		row.cells.item( 0 )?.replaceChildren( editable );
		mockRowDndPhase = 'active';
		render( <RowMovingDisplay /> );

		startPhysicalDrag( row );

		const overlayViewport = document.body.querySelector(
			'.yamabiko-table-reorder-moving-row'
		) as HTMLElement | null;
		const clonedEditable = overlayViewport?.querySelector( '[contenteditable="true"]' );
		expect( clonedEditable ).not.toBeNull();
		expect( overlayViewport?.hasAttribute( 'inert' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - 移動表示がDnD Engineの物理位置から縦方向だけ現在位置へ追従することを確認する。
	 *
	 * 事前条件:
	 * - Row DnD Sessionがactiveで、開始時の移動表示が成立している。
	 *
	 * 操作:
	 * - DnD Engineから開始位置より30px下の現在位置を通知する。
	 *
	 * 期待結果:
	 * - 移動表示の上端だけが30px下へ移動し、横方向の開始位置は対象Tableの表示位置を維持する。
	 */
	it( 'when the physical drag moves vertically, should follow only the vertical position while keeping the table-aligned horizontal position', () => {
		const { row } = createSourceTable();
		mockRowDndPhase = 'active';
		render( <RowMovingDisplay /> );
		startPhysicalDrag( row );

		act( () => {
			mockDragDropMonitor.onDragMove?.( {
				operation: {
					position: {
						current: { y: 130 },
					},
				},
			} );
		} );

		const overlayViewport = document.body.querySelector(
			'.yamabiko-table-reorder-moving-row'
		) as HTMLElement | null;
		expect( overlayViewport?.style.top ).toBe( '110px' );
		expect( overlayViewport?.style.left ).toBe( '100px' );
	} );

	/**
	 * 概要:
	 * - 対象Tableがeditor表示領域の左右へはみ出す場合も、移動表示を現在見えている範囲へ制限することを確認する。
	 *
	 * 事前条件:
	 * - Row DnD Sessionがactiveである。
	 * - 対象Tableはeditor表示領域より左右へ50pxずつはみ出している。
	 *
	 * 操作:
	 * - 対象行の物理DnD開始を通知する。
	 *
	 * 期待結果:
	 * - 移動表示の表示枠はeditor表示領域の横幅に収まり、Table自体の横位置と幅は元の配置を維持する。
	 */
	it( 'when the source table extends beyond both sides of the editor viewport, should clip the moving display to the visible horizontal range', () => {
		const { row, tableRectangleMock } = createSourceTable();
		const viewportWidth = window.innerWidth;
		tableRectangleMock.mockReturnValue(
			rectangle( {
				left: -50,
				right: viewportWidth + 50,
				width: viewportWidth + 100,
			} )
		);
		mockRowDndPhase = 'active';
		render( <RowMovingDisplay /> );

		startPhysicalDrag( row );

		const overlayViewport = document.body.querySelector(
			'.yamabiko-table-reorder-moving-row'
		) as HTMLElement | null;
		const overlayTable = document.body.querySelector(
			'.yamabiko-table-reorder-moving-row-table'
		) as HTMLTableElement | null;
		expect( overlayViewport?.style.left ).toBe( '0px' );
		expect( overlayViewport?.style.width ).toBe( `${ viewportWidth }px` );
		expect( overlayTable?.style.left ).toBe( '-50px' );
		expect( overlayTable?.style.width ).toBe( `${ viewportWidth + 100 }px` );
	} );

	/**
	 * 概要:
	 * - Row DnD Session終了を移動表示の終了条件として扱うことを確認する。
	 *
	 * 事前条件:
	 * - active Session中に元行の半透明表示と移動表示が成立している。
	 *
	 * 操作:
	 * - DnD Interactionの意味状態をidleへ変更する。
	 *
	 * 期待結果:
	 * - 移動表示と元行の半透明表示を解除する。
	 */
	it( 'when the row DnD session becomes idle, should remove the moving display and restore the source row', () => {
		const { row } = createSourceTable();
		mockRowDndPhase = 'active';
		const { rerender } = render( <RowMovingDisplay /> );
		startPhysicalDrag( row );
		expect( row.classList ).toContain( 'yamabiko-table-reorder-moving-row-source' );

		mockRowDndPhase = 'idle';
		rerender( <RowMovingDisplay /> );

		expect( row.classList ).not.toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 1 );
	} );

	/**
	 * 概要:
	 * - active Session中にPresentation境界が終了しても、一時表示を実Tableへ残さないことを確認する。
	 *
	 * 事前条件:
	 * - active Session中に元行の半透明表示と移動表示が成立している。
	 *
	 * 操作:
	 * - RowMovingDisplayをunmountする。
	 *
	 * 期待結果:
	 * - 元行の半透明表示が解除され、独立した移動表示もDOMから除去される。
	 */
	it( 'when the moving display unmounts during an active row DnD session, should restore the source row and remove the temporary display', () => {
		const { row } = createSourceTable();
		mockRowDndPhase = 'active';
		const { unmount } = render( <RowMovingDisplay /> );
		startPhysicalDrag( row );
		expect( row.classList ).toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 2 );

		unmount();

		expect( row.classList ).not.toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 1 );
	} );
} );
