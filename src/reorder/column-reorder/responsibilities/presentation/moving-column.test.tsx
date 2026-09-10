/**
 * Column Reorderの移動対象表示が、意味上のDnD Sessionと物理DnD情報を責務どおり組み合わせることを確認する。
 *
 * active Session中だけの表示、可視範囲への限定、元Tableの表示寸法維持、縦横追従、背景表示、横罫線、入力対象外、終了時解除を検証する。
 */

import { act, render } from '@testing-library/react';

import { ColumnMovingDisplay } from './moving-column';

let mockColumnDndPhase: 'idle' | 'active' = 'active';
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
} = {};
let pendingAnimationFrame: FrameRequestCallback | null = null;

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndPhase: () => mockColumnDndPhase,
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
	const rows: HTMLTableRowElement[] = [];
	const cells: HTMLTableCellElement[] = [];
	const tops = [ -40, 0, 40, 80, 120 ];

	tops.forEach( ( top, index ) => {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.textContent = index === 2 ? 'Source' : `Cell ${ index }`;
		row.appendChild( cell );
		tbody.appendChild( row );
		rows.push( row );
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

	return { table, rows, cells, sourceCell: cells[ 2 ] };
};

/**
 * DnD Engineから移動対象列の物理DnD開始を通知する。
 *
 * @param sourceCell DnD Engineが移動対象として管理する開始セル。
 */
const startPhysicalDrag = ( sourceCell: HTMLTableCellElement ) => {
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

/** DnD Engineから最初の物理移動を通知する。 */
const movePhysicalDrag = () => {
	act( () => {
		mockDragDropMonitor.onDragMove?.( {
			operation: {
				position: {
					current: { x: 170, y: 140 },
				},
			},
		} );
	} );
};

/** 最初の物理移動後に予約された表示フレームを実行する。 */
const flushAnimationFrame = () => {
	const callback = pendingAnimationFrame;
	pendingAnimationFrame = null;
	if ( callback !== null ) {
		act( () => callback( 0 ) );
	}
};

/** 移動表示内のDnD開始セルを取得する。 */
const getMovingSourceCell = (): HTMLTableCellElement | undefined =>
	Array.from( document.querySelectorAll( '.yamabiko-table-reorder-moving-column td' ) ).find(
		( cell ) => cell.textContent === 'Source'
	) as HTMLTableCellElement | undefined;

describe( 'Column moving display', () => {
	beforeEach( () => {
		mockColumnDndPhase = 'active';
		mockDragDropMonitor = {};
		pendingAnimationFrame = null;
		document.body.replaceChildren();
		jest.restoreAllMocks();
		jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation( ( callback ) => {
			pendingAnimationFrame = callback;
			return 1;
		} );
		jest.spyOn( window, 'cancelAnimationFrame' ).mockImplementation( () => undefined );
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
	 * - 最初の物理移動と次の描画フレームを進める。
	 *
	 * 期待結果:
	 * - idle中は移動表示も元列の半透明表示も開始しない。
	 * - activeになった時点で移動表示は開始するが、元列はまだ通常表示を維持する。
	 * - 最初の物理移動後の描画フレームで元列の半透明表示を開始する。
	 */
	it( 'when physical drag information exists before the column session becomes active, should defer source appearance until after the first movement', () => {
		mockColumnDndPhase = 'idle';
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		expect( document.querySelector( '.yamabiko-table-reorder-moving-column' ) ).toBeNull();
		expect( sourceCell.classList ).not.toContain( 'yamabiko-table-reorder-moving-column-source' );

		mockColumnDndPhase = 'active';
		rerender( <ColumnMovingDisplay /> );

		expect( document.querySelector( '.yamabiko-table-reorder-moving-column' ) ).not.toBeNull();
		expect( sourceCell.classList ).not.toContain( 'yamabiko-table-reorder-moving-column-source' );

		movePhysicalDrag();
		expect( sourceCell.classList ).not.toContain( 'yamabiko-table-reorder-moving-column-source' );

		flushAnimationFrame();
		expect( sourceCell.classList ).toContain( 'yamabiko-table-reorder-moving-column-source' );
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
		expect( cells[ 1 ].getBoundingClientRect ).toHaveBeenCalled();
	} );

	/**
	 * Core Tableのセル自身に表示されている背景色を移動表示へ維持することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象セル自身に非透明な背景色がある。
	 * - 元行にも別の背景色がある。
	 *
	 * 操作:
	 * - 移動対象列のDnDを開始する。
	 *
	 * 期待結果:
	 * - セル自身の計算済み背景色が元行背景より優先される。
	 * - 1セルTableへ再構成された行とセルの両方で同じ背景色が維持される。
	 */
	it( 'when a Core Table cell has its own background, should preserve the cell background across the reconstructed table layers', () => {
		const { rows, sourceCell } = createSourceTable();
		rows[ 2 ].style.backgroundColor = 'rgb(90, 91, 92)';
		sourceCell.style.backgroundColor = 'rgb(12, 34, 56)';
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const movingSource = getMovingSourceCell();
		expect( movingSource?.style.backgroundColor ).toBe( 'rgb(12, 34, 56)' );
		expect( movingSource?.parentElement?.style.backgroundColor ).toBe( 'rgb(12, 34, 56)' );
		expect( movingSource?.style.getPropertyPriority( 'background-color' ) ).toBe( 'important' );
	} );

	/**
	 * FTB相当のセルインライン背景色を、元DOMの実際の表示から取得して移動表示へ維持することを確認する。
	 *
	 * 事前条件:
	 * - FTBと同様に、移動対象セルのインラインstyleへ背景色が設定されている。
	 *
	 * 操作:
	 * - 移動対象列のDnDを開始する。
	 *
	 * 期待結果:
	 * - セルの計算済み背景色がsnapshotされ、移動表示の行とセルへ同じ色が固定される。
	 */
	it( 'when an FTB-style cell has an inline background color, should preserve its computed background in the moving display', () => {
		const { sourceCell } = createSourceTable();
		sourceCell.style.backgroundColor = 'rgb(21, 43, 65)';
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const movingSource = getMovingSourceCell();
		expect( movingSource?.style.backgroundColor ).toBe( 'rgb(21, 43, 65)' );
		expect( movingSource?.parentElement?.style.backgroundColor ).toBe( 'rgb(21, 43, 65)' );
	} );

	/**
	 * セル自身が透明で元行に背景色がある場合、元Tableで見えていた行背景を移動表示へ維持することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象セル自身の背景は透明である。
	 * - 元行には非透明な背景色が設定されている。
	 *
	 * 操作:
	 * - 移動対象列のDnDを開始する。
	 *
	 * 期待結果:
	 * - 移動表示の行とセルには元行の計算済み背景色が固定される。
	 */
	it( 'when a source cell is transparent and its row has a background, should preserve the row background in the moving cell', () => {
		const { rows, sourceCell } = createSourceTable();
		rows[ 2 ].style.backgroundColor = 'rgb(34, 56, 78)';
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const movingSource = getMovingSourceCell();
		expect( movingSource?.style.backgroundColor ).toBe( 'rgb(34, 56, 78)' );
		expect( movingSource?.parentElement?.style.backgroundColor ).toBe( 'rgb(34, 56, 78)' );
	} );

	/**
	 * セルと元行が透明でも、元Table自身に背景色がある場合はTable背景レイヤーを移動表示へ維持することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象セルと元行の背景は透明である。
	 * - 元Tableにはクラス経由の非透明な背景色がある。
	 *
	 * 操作:
	 * - 移動対象列のDnDを開始する。
	 *
	 * 期待結果:
	 * - 再構成した行とセルへ白背景を固定しない。
	 * - 複製Tableでは元Tableと同じ背景色が計算済み背景として維持される。
	 */
	it( 'when a source table has a background and its row and cell are transparent, should preserve the table background layer', () => {
		const { table, sourceCell } = createSourceTable();
		const style = document.createElement( 'style' );
		style.textContent = '.ytr-test-table-background { background-color: rgb(255, 238, 88); }';
		document.head.appendChild( style );
		table.classList.add( 'ytr-test-table-background' );
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const movingSource = getMovingSourceCell();
		const movingTable = movingSource?.closest( 'table' );
		expect( movingSource?.style.backgroundColor ).toBe( '' );
		expect( movingSource?.parentElement?.style.backgroundColor ).toBe( '' );
		expect( movingTable ? window.getComputedStyle( movingTable ).backgroundColor : '' ).toBe(
			'rgb(255, 238, 88)'
		);
		style.remove();
	} );

	/**
	 * セル、元行、元Tableのすべてが透明な場合、Overlayの白背景をセル単位のfallbackとして維持することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象セル、元行、元Tableの背景がすべて透明である。
	 *
	 * 操作:
	 * - 移動対象列のDnDを開始する。
	 *
	 * 期待結果:
	 * - 再構成した行とセルの背景は白となり、背後のTable内容を透過しない。
	 */
	it( 'when the source cell, row, and table backgrounds are transparent, should use white as the moving cell fallback', () => {
		const { sourceCell } = createSourceTable();
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const movingSource = getMovingSourceCell();
		expect( movingSource?.style.backgroundColor ).toBe( 'rgb(255, 255, 255)' );
		expect( movingSource?.parentElement?.style.backgroundColor ).toBe( 'rgb(255, 255, 255)' );
	} );

	/**
	 * 見出し区切りがsectionの太い罫線として設定されている場合も、移動表示へ同じ横罫線を維持することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象はtheadの唯一の見出し行にある。
	 * - 見出しsectionの下辺に通常セルより太い罫線が設定されている。
	 *
	 * 操作:
	 * - 見出し列のDnDを開始する。
	 *
	 * 期待結果:
	 * - 移動表示の見出しセル下辺には元sectionの太い罫線が固定される。
	 */
	it( 'when a header section has a thick bottom border, should preserve that horizontal border in the moving header cell', () => {
		const table = document.createElement( 'table' );
		const thead = document.createElement( 'thead' );
		const row = document.createElement( 'tr' );
		const sourceCell = document.createElement( 'th' );
		sourceCell.textContent = 'Header';
		thead.style.borderBottom = '4px solid rgb(10, 20, 30)';
		sourceCell.style.borderBottom = '1px solid rgb(100, 100, 100)';
		row.appendChild( sourceCell );
		thead.appendChild( row );
		table.appendChild( thead );
		document.body.appendChild( table );
		jest.spyOn( sourceCell, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( {
				top: 0,
				bottom: 40,
				left: 100,
				right: 200,
				width: 100,
				height: 40,
			} )
		);
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( {
				top: 0,
				bottom: 40,
				left: 100,
				right: 200,
				width: 100,
				height: 40,
			} )
		);
		Object.defineProperty( window, 'innerHeight', {
			configurable: true,
			value: 80,
		} );
		Object.defineProperty( document, 'elementFromPoint', {
			configurable: true,
			value: jest.fn( () => sourceCell ),
		} );
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const movingHeader = document.querySelector(
			'.yamabiko-table-reorder-moving-column th'
		) as HTMLTableCellElement | null;
		expect( movingHeader?.style.borderBottom ).toContain( '4px' );
		expect( movingHeader?.style.borderBottom ).toContain( 'rgb(10, 20, 30)' );
		expect( movingHeader?.style.getPropertyPriority( 'border-bottom' ) ).toBe( 'important' );
	} );

	/**
	 * 通常行の横罫線を背景対応後も維持することを確認する。
	 *
	 * 事前条件:
	 * - 移動対象セル下辺に通常の横罫線が設定されている。
	 * - 移動対象セルには背景色も設定されている。
	 *
	 * 操作:
	 * - 移動対象列のDnDを開始する。
	 *
	 * 期待結果:
	 * - 背景色と横罫線の両方が移動表示へ維持される。
	 */
	it( 'when a moving cell has a background and a horizontal border, should preserve both appearances', () => {
		const { sourceCell } = createSourceTable();
		sourceCell.style.backgroundColor = 'rgb(70, 80, 90)';
		sourceCell.style.borderBottom = '2px solid rgb(40, 50, 60)';
		render( <ColumnMovingDisplay /> );

		startPhysicalDrag( sourceCell );

		const movingSource = getMovingSourceCell();
		expect( movingSource?.style.backgroundColor ).toBe( 'rgb(70, 80, 90)' );
		expect( movingSource?.style.borderBottom ).toContain( '2px' );
		expect( movingSource?.style.borderBottom ).toContain( 'rgb(40, 50, 60)' );
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

		movePhysicalDrag();

		const overlay = document.querySelector(
			'.yamabiko-table-reorder-moving-column'
		) as HTMLElement | null;
		expect( overlay?.style.left ).toBe( '120px' );
		expect( overlay?.style.top ).toBe( '40px' );
	} );

	/**
	 * Column DnD Session終了時に移動表示と元セルの一時表示を残さないことを確認する。
	 *
	 * 事前条件:
	 * - active Session中に最初の物理移動まで完了し、元列の半透明表示が成立している。
	 *
	 * 操作:
	 * - DnD Interactionの状態をidleへ戻す。
	 *
	 * 期待結果:
	 * - 移動表示が消え、元セルの半透明表示も解除される。
	 */
	it( 'when the column DnD session returns to idle, should remove the moving display and restore source cells', () => {
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnMovingDisplay /> );
		startPhysicalDrag( sourceCell );
		movePhysicalDrag();
		flushAnimationFrame();
		expect( sourceCell.classList ).toContain( 'yamabiko-table-reorder-moving-column-source' );

		mockColumnDndPhase = 'idle';
		rerender( <ColumnMovingDisplay /> );

		expect( document.querySelector( '.yamabiko-table-reorder-moving-column' ) ).toBeNull();
		expect( sourceCell.classList ).not.toContain( 'yamabiko-table-reorder-moving-column-source' );
	} );
} );
