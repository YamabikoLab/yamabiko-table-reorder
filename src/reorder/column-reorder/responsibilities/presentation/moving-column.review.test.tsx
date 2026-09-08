/**
 * Column Moving Overlayの可視列探索とTable背景snapshotが、DnD開始時の実表示を維持することを確認する。
 *
 * 横に部分表示された列とPortal内で再評価できないTable背景を対象に、利用者が開始時に見ていた列表示を欠落させないことを検証する。
 */

import { act, render } from '@testing-library/react';

import { ColumnMovingDisplay } from './moving-column';

let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndPhase: () => 'active',
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/**
 * 表示条件に必要な値だけを持つDOM矩形を作成する。
 *
 * @param values テスト条件として上書きする位置と寸法。
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

/**
 * DnD開始位置を指定してColumn Moving Overlayを開始する。
 *
 * @param sourceCell 移動対象として管理される開始セル。
 * @param x          利用者がDnDを開始した横位置。
 */
const startDrag = ( sourceCell: HTMLTableCellElement, x: number ): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: {
				source: { element: sourceCell },
				position: {
					initial: { x, y: 60 },
					current: { x, y: 60 },
				},
			},
		} );
	} );
};

describe( 'Column moving display snapshot', () => {
	beforeEach( () => {
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		jest.restoreAllMocks();
		Object.defineProperty( window, 'innerHeight', {
			configurable: true,
			value: 80,
		} );
	} );

	/**
	 * 列中央が表示領域外でも、利用者が見えている列端からDnDを開始した場合に可視セルを保持できることを確認する。
	 *
	 * 事前条件:
	 * - 移動対象列は左側の大部分が表示領域外にあり、セル中央も表示領域外である。
	 * - 列右端だけは表示されており、その可視部分からDnDを開始できる。
	 * - editor表示領域には同じ列の2セルが見えている。
	 *
	 * 操作:
	 * - 表示されている列端の横位置からDnDを開始する。
	 *
	 * 期待結果:
	 * - DnD開始位置を基準に可視2セルがsnapshotされ、開始セルだけの表示へ縮退しない。
	 */
	it( 'when the source cell center is outside the viewport but drag starts from its visible edge, should snapshot all visible cells in that column', () => {
		const table = document.createElement( 'table' );
		const tbody = document.createElement( 'tbody' );
		const cells = [ 0, 40 ].map( ( top, index ) => {
			const row = document.createElement( 'tr' );
			const cell = document.createElement( 'td' );
			cell.textContent = index === 1 ? 'Source' : 'Visible';
			row.appendChild( cell );
			tbody.appendChild( row );
			jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue(
				rectangle( {
					top,
					bottom: top + 40,
					left: -100,
					right: 20,
					width: 120,
					height: 40,
				} )
			);
			return cell;
		} );
		table.appendChild( tbody );
		document.body.appendChild( table );
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( {
				top: 0,
				bottom: 80,
				left: -100,
				right: 20,
				width: 120,
				height: 80,
			} )
		);
		Object.defineProperty( document, 'elementFromPoint', {
			configurable: true,
			value: jest.fn( ( x: number, y: number ) => {
				if ( x !== 10 ) {
					return null;
				}
				return y < 40 ? cells[ 0 ] : cells[ 1 ];
			} ),
		} );
		render( <ColumnMovingDisplay /> );

		startDrag( cells[ 1 ], 10 );

		const overlay = document.querySelector( '.yamabiko-table-reorder-moving-column' );
		expect( overlay?.querySelectorAll( 'table' ) ).toHaveLength( 2 );
		expect( document.elementFromPoint ).toHaveBeenCalledWith( 10, expect.any( Number ) );
	} );

	/**
	 * 元Tableの背景がインライン指定でも、Portal内の再構成Tableへ開始時背景を固定できることを確認する。
	 *
	 * 事前条件:
	 * - セルと行の背景は透明である。
	 * - 元Tableにはインライン指定の非透明な背景色がある。
	 *
	 * 操作:
	 * - 移動対象列のDnDを開始する。
	 *
	 * 期待結果:
	 * - 再構成したTableへ開始時のTable背景色が優先度付きで固定される。
	 * - 行とセルへ白fallbackは適用されない。
	 */
	it( 'when the source table background comes from inline style, should snapshot that background onto the reconstructed table', () => {
		const table = document.createElement( 'table' );
		const tbody = document.createElement( 'tbody' );
		const row = document.createElement( 'tr' );
		const sourceCell = document.createElement( 'td' );
		sourceCell.textContent = 'Source';
		row.appendChild( sourceCell );
		tbody.appendChild( row );
		table.appendChild( tbody );
		table.style.backgroundColor = 'rgb(12, 34, 56)';
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
		Object.defineProperty( document, 'elementFromPoint', {
			configurable: true,
			value: jest.fn( () => sourceCell ),
		} );
		render( <ColumnMovingDisplay /> );

		startDrag( sourceCell, 150 );

		const movingCell = document.querySelector(
			'.yamabiko-table-reorder-moving-column td'
		) as HTMLTableCellElement | null;
		const movingTable = movingCell?.closest( 'table' );
		expect( movingTable?.style.backgroundColor ).toBe( 'rgb(12, 34, 56)' );
		expect( movingTable?.style.getPropertyPriority( 'background-color' ) ).toBe( 'important' );
		expect( movingCell?.style.backgroundColor ).toBe( '' );
		expect( movingCell?.parentElement?.style.backgroundColor ).toBe( '' );
	} );
} );
