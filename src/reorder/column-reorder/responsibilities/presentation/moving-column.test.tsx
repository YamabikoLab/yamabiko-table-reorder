/**
 * Column Reorderの移動対象表示が、意味上のDnD Sessionと物理DnD情報を責務どおり組み合わせることを確認する。
 *
 * active Session中だけの表示、可視範囲への限定、元Tableの表示寸法維持、結合セル、DOM識別子、縦横追従、入力対象外、元Table非変更、終了時解除を検証する。
 */

import { act, render } from '@testing-library/react';

import { ColumnMovingDisplay } from './moving-column';

let mockColumnDndPhase: 'idle' | 'active' = 'active';
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndPhase: () => mockColumnDndPhase,
} ) );

jest.mock( '@dnd-kit/dom/utilities', () => ( {
	getFrameTransform: () => ( {
		x: 0,
		y: 0,
		scaleX: 1,
		scaleY: 1,
	} ),
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

/** 可視2行と、その上下に表示範囲外の行を持つTableを用意する。 */
const createSourceTable = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const cells: HTMLTableCellElement[] = [];
	const tops = [ -40, 0, 40, 80, 120 ];

	tops.forEach( ( top, index ) => {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.textContent = index === 2 ? 'Source' : `Cell ${ index }`;
		row.appendChild( cell );
		tbody.appendChild( row );
		cells.push( cell );
		jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( {
				top,
				bottom: top + 40,
				left: 100,
				right: 200,
				width: 100,
				height: 40,
			} )
		);
	} );

	table.appendChild( tbody );
	document.body.appendChild( table );
	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: -40,
			bottom: 160,
			left: 100,
			right: 200,
			width: 100,
			height: 200,
		} )
	);

	Object.defineProperty( window, 'innerHeight', {
		configurable: true,
		value: 80,
	} );
	Object.defineProperty( document, 'elementFromPoint', {
		configurable: true,
		value: jest.fn( ( _x: number, y: number ) => {
			if ( y >= 0 && y < 40 ) {
				return cells[ 1 ];
			}
			if ( y >= 40 && y < 80 ) {
				return cells[ 2 ];
			}
			return null;
		} ),
	} );

	return { cells, sourceCell: cells[ 2 ] };
};

/**
 * DnD Engineから移動対象列の物理DnD開始を通知する。
 *
 * @param sourceCell DnD Engineが移動対象として管理する開始セル。
 */
const startPhysicalDrag = ( sourceCell: HTMLTableCellElement ): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: {
				source: { element: sourceCell },
				position: {
					initial: { x: 150, y: 100 },
					current: { x: 150, y: 100 },
				},
			},
		} );
	} );
};

/** 移動表示内のDnD開始セルを取得する。 */
const getMovingSourceCell = (): HTMLTableCellElement | undefined =>
	Array.from( document.querySelectorAll( '.yamabiko-table-reorder-moving-column td' ) ).find(
		( cell ) => cell.textContent?.startsWith( 'Source' ) === true
	) as HTMLTableCellElement | undefined;

describe( 'Column moving display', () => {
	beforeEach( () => {
		mockColumnDndPhase = 'active';
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		jest.restoreAllMocks();
	} );

	/**
	 * 物理DnD情報だけでは移動表示を開始せず、Column DnD Sessionの意味状態を表示Lifecycleの正本とすることを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineから移動対象セルと開始位置を取得できる。
	 * - Column DnD Sessionはまだidleである。
	 *
	 * 操作:
	 * - 物理DnD開始を通知する。
	 * - その後Column DnD Sessionをactiveへ遷移させる。
	 *
	 * 期待結果:
	 * - idle中は移動表示を開始しない。
	 * - activeになった時点で、同じ物理DnDの移動表示を開始する。
	 */
	it( 'when physical drag information exists before the column session becomes active, should show the moving column only after the session is active', () => {
		mockColumnDndPhase = 'idle';
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );
		expect( document.querySelector( '.yamabiko-table-reorder-moving-column' ) ).toBeNull();

		mockColumnDndPhase = 'active';
		rerender( <ColumnMovingDisplay /> );
		expect( document.querySelector( '.yamabiko-table-reorder-moving-column' ) ).not.toBeNull();
	} );

	/**
	 * editor表示領域に見えているセルだけを移動表示へ保持し、上下の表示範囲外へ描画対象を広げないことを確認する。
	 *
	 * 事前条件:
	 * - editor表示領域には移動対象列の2セルが見えている。
	 * - 表示領域の直前・直後にも同じ列位置のセルが存在する。
	 *
	 * 操作:
	 * - activeなColumn DnDで移動表示を開始する。
	 *
	 * 期待結果:
	 * - 可視2セルだけが移動表示へ含まれる。
	 * - 表示領域外の前後セルは移動表示のために計測されない。
	 * - 移動表示は入力・フォーカス対象にならない。
	 */
	it( 'when a large table extends beyond the editor viewport, should snapshot only cells visible in the editor viewport', () => {
		const { cells, sourceCell } = createSourceTable();
		const previousOutsideMeasurement = cells[ 0 ].getBoundingClientRect as jest.Mock;
		const nextOutsideMeasurement = cells[ 3 ].getBoundingClientRect as jest.Mock;
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const overlay = document.querySelector( '.yamabiko-table-reorder-moving-column' );
		expect( overlay ).not.toBeNull();
		expect( overlay?.querySelectorAll( 'table' ) ).toHaveLength( 2 );
		expect( previousOutsideMeasurement ).not.toHaveBeenCalled();
		expect( nextOutsideMeasurement ).not.toHaveBeenCalled();
		expect( overlay?.hasAttribute( 'inert' ) ).toBe( true );
		expect( overlay?.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
	} );

	/**
	 * 結合セルを含む列でも、Table構造を再解釈せず元DOMの表示寸法を移動表示へ維持することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象セルは2行分のrowspanを持つ。
	 * - 元DOMでは移動対象列幅が100px、結合セル高が80pxとして表示されている。
	 *
	 * 操作:
	 * - activeなColumn DnDで移動表示を開始する。
	 *
	 * 期待結果:
	 * - 移動表示の列幅は元列と同じ100pxである。
	 * - 結合セルは元DOMと同じ80pxの高さを維持する。
	 */
	it( 'when a moving column contains a rowspan cell, should preserve the source column width and the merged cell display height', () => {
		const { cells, sourceCell } = createSourceTable();
		sourceCell.rowSpan = 2;
		( sourceCell.getBoundingClientRect as jest.Mock ).mockReturnValue(
			rectangle( {
				top: 40,
				bottom: 120,
				left: 100,
				right: 200,
				width: 100,
				height: 80,
			} )
		);
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const overlay = document.querySelector(
			'.yamabiko-table-reorder-moving-column'
		) as HTMLElement | null;
		const movingSource = getMovingSourceCell();
		expect( overlay?.style.width ).toBe( '100px' );
		expect( movingSource?.style.width ).toBe( '100px' );
		expect( movingSource?.style.height ).toBe( '80px' );
		expect( movingSource?.rowSpan ).toBe( 2 );
		expect( cells[ 1 ].getBoundingClientRect ).toHaveBeenCalled();
	} );

	/**
	 * 元セルDOMを複製する場合でも、元Tableと移動表示でDOM識別子を重複させないことを確認する。
	 *
	 * 事前条件:
	 * - 移動対象セル自身とその子要素にidが設定されている。
	 *
	 * 操作:
	 * - activeなColumn DnDで移動表示を開始する。
	 *
	 * 期待結果:
	 * - 元セルと子要素のidは維持される。
	 * - 移動表示内の複製セルと子要素からidが除去される。
	 */
	it( 'when source cell content contains DOM ids, should remove the ids only from the moving clone', () => {
		const { sourceCell } = createSourceTable();
		sourceCell.id = 'source-cell-id';
		const child = document.createElement( 'span' );
		child.id = 'source-child-id';
		child.textContent = 'Nested';
		sourceCell.appendChild( child );
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const movingSource = getMovingSourceCell();
		expect( movingSource ).toBeDefined();
		expect( sourceCell.id ).toBe( 'source-cell-id' );
		expect( child.id ).toBe( 'source-child-id' );
		expect( movingSource?.hasAttribute( 'id' ) ).toBe( false );
		expect( movingSource?.querySelector( '[id]' ) ).toBeNull();
	} );

	/**
	 * Column Moving Displayのために実Tableの移動元セルへclassやstyleを追加しないことを確認する。
	 *
	 * 事前条件:
	 * - 移動対象列の可視セルに既存classとstyleがある。
	 *
	 * 操作:
	 * - activeなColumn DnDで移動表示を開始する。
	 *
	 * 期待結果:
	 * - 可視セルのclass属性とstyle属性はDnD開始前から変化しない。
	 */
	it( 'when the moving display is active, should not mutate source cell classes or styles', () => {
		const { cells, sourceCell } = createSourceTable();
		cells[ 1 ].className = 'existing-cell';
		cells[ 1 ].style.textAlign = 'right';
		sourceCell.className = 'source-existing-cell';
		sourceCell.style.verticalAlign = 'middle';
		const before = cells.map( ( cell ) => ( {
			className: cell.className,
			style: cell.getAttribute( 'style' ),
		} ) );
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		cells.forEach( ( cell, index ) => {
			expect( cell.className ).toBe( before[ index ].className );
			expect( cell.getAttribute( 'style' ) ).toBe( before[ index ].style );
		} );
	} );

	/**
	 * 移動表示が物理DnDの横方向・縦方向の両方へ追従することを確認する。
	 *
	 * 事前条件:
	 * - Column DnD Sessionがactiveで移動表示が成立している。
	 *
	 * 操作:
	 * - 開始位置から右へ20px、下へ40pxの物理移動を通知する。
	 *
	 * 期待結果:
	 * - 移動表示全体が同じ距離だけ横方向・縦方向へ移動する。
	 */
	it( 'when the physical drag moves horizontally and vertically, should move the column overlay by the same distances', () => {
		const { sourceCell } = createSourceTable();
		render( <ColumnMovingDisplay /> );
		startPhysicalDrag( sourceCell );

		act( () => {
			mockDragDropMonitor.onDragMove?.( {
				operation: {
					position: {
						current: { x: 170, y: 140 },
					},
				},
			} );
		} );

		const overlay = document.querySelector(
			'.yamabiko-table-reorder-moving-column'
		) as HTMLElement | null;
		expect( overlay?.style.left ).toBe( '120px' );
		expect( overlay?.style.top ).toBe( '40px' );
	} );

	/**
	 * Column DnD Session終了時に移動表示とeditor全体の一時表示を残さないことを確認する。
	 *
	 * 事前条件:
	 * - active Session中に移動表示が成立している。
	 *
	 * 操作:
	 * - DnD Interactionの状態をidleへ戻す。
	 *
	 * 期待結果:
	 * - 移動表示が消える。
	 * - 掴んでいるポインター状態の一時classがeditorから除去される。
	 */
	it( 'when the column DnD session returns to idle, should remove the moving display and temporary editor state', () => {
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnMovingDisplay /> );
		startPhysicalDrag( sourceCell );
		expect( document.body.classList ).toContain( 'yamabiko-table-reorder-column-dragging' );

		mockColumnDndPhase = 'idle';
		rerender( <ColumnMovingDisplay /> );

		expect( document.querySelector( '.yamabiko-table-reorder-moving-column' ) ).toBeNull();
		expect( document.body.classList ).not.toContain( 'yamabiko-table-reorder-column-dragging' );
	} );
} );
