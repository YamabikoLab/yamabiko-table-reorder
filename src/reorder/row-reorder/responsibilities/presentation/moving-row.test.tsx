/**
 * Row Reorderの移動対象表示が、DnD Interactionの意味状態とDnD Engineの物理情報を責務どおり組み合わせることを確認する。
 *
 * DnD Interaction本体やDnD Engine本体の実装は重複して検証せず、active Session中だけの表示、元行の識別、
 * 元行寸法の維持、入力対象外であること、縦方向追従、Session終了および境界終了時の表示解除を検証する。
 */

import { act, render } from '@testing-library/react';

import { rowDndInteraction } from '@/reorder/row-reorder/responsibilities/dnd-interaction';

import { RowMovingDisplay } from './moving-row';

let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
} = {};

/* DnD Engineの物理monitorはJSDOMで実行できないため、その通知境界だけを決定的なTest Doubleとする。 */
jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとDnD Interactionは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( '@/reorder/row-reorder/responsibilities/table-integration.test-utils' )
		.rowReorderTestBlockEditorStore,
} ) );

/** Production DnD Interactionで行DnD Sessionを開始する。 */
const startRowDndSession = (): void => {
	act( () => {
		rowDndInteraction.start(
			{ tableIdentity: 'table-a', sourceRowIndex: 0 },
			{ rowCount: 2, blockedBoundaries: [] }
		);
	} );
};

/** テスト間でProduction DnD Sessionをidleへ戻す。 */
const resetRowDndSession = (): void => {
	act( () => {
		rowDndInteraction.cancel();
	} );
};

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

	return { table, row };
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
					initial: { x: 100, y: 100 },
					current: { x: 100, y: 100 },
				},
			},
		} );
	} );
};

describe( 'Row moving display', () => {
	beforeEach( () => {
		resetRowDndSession();
		mockDragDropMonitor = {};
		document.body.replaceChildren();
	} );

	afterEach( () => {
		resetRowDndSession();
	} );

	/**
	 * 物理DnD開始だけでは移動表示を成立させず、Row DnD Sessionがactiveになった場合だけ表示することを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineは移動対象行と物理位置を提供できる。
	 * - DnD Interactionはまだidleである。
	 *
	 * 操作:
	 * - 物理DnD開始を通知した後、Row DnD Sessionをactiveへ変更する。
	 *
	 * 期待結果:
	 * - idle中は表示しない。
	 * - active後は元行を識別表示し、移動表示は元行の寸法とセル幅を維持する。
	 */
	it( 'when physical drag information exists and the row DnD session becomes active, should show the moving row only for the active session', () => {
		const { row } = createSourceTable();
		row.id = 'source-row';
		row.cells.item( 0 )?.setAttribute( 'id', 'source-cell' );
		render( <RowMovingDisplay /> );

		startPhysicalDrag( row );
		expect( row.classList ).not.toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 1 );

		startRowDndSession();

		expect( row.classList ).toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 2 );
		const overlay = document.body.querySelector(
			'.yamabiko-table-reorder-moving-row'
		) as HTMLElement | null;
		const overlayTable = document.body.querySelector(
			'.yamabiko-table-reorder-moving-row-table'
		) as HTMLTableElement | null;
		const overlayRow = overlayTable?.querySelector( 'tr' );
		const overlayCells = overlayTable?.querySelectorAll( 'td' );
		expect( overlay?.style.left ).toBe( '100px' );
		expect( overlay?.style.top ).toBe( '80px' );
		expect( overlay?.style.width ).toBe( '400px' );
		expect( overlay?.style.height ).toBe( '40px' );
		expect( overlayRow?.classList ).not.toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( overlayRow?.hasAttribute( 'id' ) ).toBe( false );
		expect( overlayCells?.item( 0 ).hasAttribute( 'id' ) ).toBe( false );
		expect( overlayCells?.item( 0 ).style.width ).toBe( '220px' );
		expect( overlayCells?.item( 1 ).style.width ).toBe( '180px' );
	} );

	/**
	 * 元行に編集可能要素があっても、移動表示全体を入力・フォーカス対象外にすることを確認する。
	 *
	 * 事前条件:
	 * - Row DnD Sessionがactiveである。
	 * - 移動対象行にはcontenteditableな要素が含まれる。
	 *
	 * 操作:
	 * - 対象行の物理DnD開始を通知する。
	 *
	 * 期待結果:
	 * - 編集可能要素を含む複製は移動表示へ描画されるが、移動表示境界はinertかつaria-hiddenであり入力・フォーカス対象にならない。
	 */
	it( 'when the source row contains editable content, should keep the moving display outside input and focus targets', () => {
		const { row } = createSourceTable();
		const editable = document.createElement( 'div' );
		editable.setAttribute( 'contenteditable', 'true' );
		editable.textContent = 'Editable';
		row.cells.item( 0 )?.replaceChildren( editable );
		startRowDndSession();
		render( <RowMovingDisplay /> );

		startPhysicalDrag( row );

		const overlay = document.body.querySelector(
			'.yamabiko-table-reorder-moving-row'
		) as HTMLElement | null;
		const clonedEditable = overlay?.querySelector( '[contenteditable="true"]' );
		expect( clonedEditable ).not.toBeNull();
		expect( overlay?.hasAttribute( 'inert' ) ).toBe( true );
		expect( overlay?.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
	} );

	/**
	 * 移動表示がDnD Engineの縦方向の物理移動へ追従することを確認する。
	 *
	 * 事前条件:
	 * - Row DnD Sessionがactiveで、開始時の移動表示が成立している。
	 *
	 * 操作:
	 * - DnD Engineから開始位置より30px下の現在位置を通知する。
	 *
	 * 期待結果:
	 * - 移動表示の上端が30px下へ移動し、横位置は変化しない。
	 */
	it( 'when the physical drag moves vertically, should move the overlay by the same vertical distance', () => {
		const { row } = createSourceTable();
		startRowDndSession();
		render( <RowMovingDisplay /> );
		startPhysicalDrag( row );

		act( () => {
			mockDragDropMonitor.onDragMove?.( {
				operation: {
					position: {
						current: { x: 100, y: 130 },
					},
				},
			} );
		} );

		const overlay = document.body.querySelector(
			'.yamabiko-table-reorder-moving-row'
		) as HTMLElement | null;
		expect( overlay?.style.top ).toBe( '110px' );
		expect( overlay?.style.left ).toBe( '100px' );
	} );

	/**
	 * Row DnD Session終了を移動表示の終了条件として扱うことを確認する。
	 *
	 * 事前条件:
	 * - active Session中に元行の識別表示と移動表示が成立している。
	 *
	 * 操作:
	 * - DnD Interactionの意味状態をidleへ変更する。
	 *
	 * 期待結果:
	 * - 移動表示と元行の識別表示を解除する。
	 */
	it( 'when the row DnD session becomes idle, should remove the moving display and restore the source row', () => {
		const { row } = createSourceTable();
		startRowDndSession();
		render( <RowMovingDisplay /> );
		startPhysicalDrag( row );
		expect( row.classList ).toContain( 'yamabiko-table-reorder-moving-row-source' );

		resetRowDndSession();

		expect( row.classList ).not.toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 1 );
	} );

	/**
	 * active Session中にPresentation境界が終了しても、一時表示を実Tableへ残さないことを確認する。
	 *
	 * 事前条件:
	 * - active Session中に元行の識別表示と移動表示が成立している。
	 *
	 * 操作:
	 * - RowMovingDisplayをunmountする。
	 *
	 * 期待結果:
	 * - 元行の識別表示が解除され、独立した移動表示もDOMから除去される。
	 */
	it( 'when the moving display unmounts during an active row DnD session, should restore the source row and remove the temporary display', () => {
		const { row } = createSourceTable();
		startRowDndSession();
		const { unmount } = render( <RowMovingDisplay /> );
		startPhysicalDrag( row );
		expect( row.classList ).toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 2 );

		unmount();

		expect( row.classList ).not.toContain( 'yamabiko-table-reorder-moving-row-source' );
		expect( document.body.querySelectorAll( 'table' ) ).toHaveLength( 1 );
	} );
} );
