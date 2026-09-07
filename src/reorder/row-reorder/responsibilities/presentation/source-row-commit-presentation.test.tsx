/**
 * Row Reorderの有効drop後に、実Table上の移動元行を確定位置へ表示し、確定完了時に元の表示指定へ戻すことを確認する。
 */

import { act, render } from '@testing-library/react';

import { RowSourceCommitPresentation } from './source-row-commit-presentation';

let mockRowDndPhase: 'idle' | 'active' = 'active';
let mockDestinationBoundaryIndex: number | null = 2;
let mockDragDropMonitor: {
	onDragStart?: () => void;
	onDragEnd?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/row-reorder/integration/dnd-interaction-react', () => ( {
	useRowDndPhase: () => mockRowDndPhase,
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/dnd-interaction', () => ( {
	getRowDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

const rectangle = ( top: number, height = 40 ): DOMRect =>
	( {
		top,
		bottom: top + height,
		left: 0,
		right: 400,
		width: 400,
		height,
		x: 0,
		y: top,
		toJSON: () => ( {} ),
	} ) as DOMRect;

const createPresentation = () => {
	const table = document.createElement( 'table' );
	const tableBody = document.createElement( 'tbody' );
	const sourceRow = document.createElement( 'tr' );
	sourceRow.appendChild( document.createElement( 'td' ) );
	tableBody.appendChild( sourceRow );
	table.appendChild( tableBody );
	document.body.appendChild( table );
	jest.spyOn( sourceRow, 'getBoundingClientRect' ).mockReturnValue( rectangle( 100 ) );

	const insertionGap = document.createElement( 'div' );
	insertionGap.className = 'yamabiko-table-reorder-insertion-gap';
	jest.spyOn( insertionGap, 'getBoundingClientRect' ).mockReturnValue( rectangle( 300 ) );
	document.body.appendChild( insertionGap );
	return { sourceRow, insertionGap };
};

describe( 'Row source commit presentation', () => {
	beforeEach( () => {
		mockRowDndPhase = 'active';
		mockDestinationBoundaryIndex = 2;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
	} );

	/**
	 * 有効なdropでは移動元行をTable内に残したまま最終位置へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 移動元行と有効なInsertion Gapが同じTable表示上に存在する。
	 *
	 * 操作:
	 * - 有効な移動先へdropする。
	 *
	 * 期待結果:
	 * - 移動元行はDOM順を変えず、Insertion Gapまでの差分だけ表示位置を移動する。
	 * - 確定中の行は通常の不透明度で表示される。
	 */
	it( 'when a valid row drop starts committing, should move the source row visually to the final position', () => {
		const { sourceRow } = createPresentation();
		sourceRow.style.opacity = '0.35';
		render( <RowSourceCommitPresentation /> );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: false,
				operation: { source: { element: sourceRow } },
			} );
		} );

		expect( sourceRow.parentElement?.rows.item( 0 ) ).toBe( sourceRow );
		expect( sourceRow.style.transform ).toBe( 'translate3d(0, 200px, 0)' );
		expect( sourceRow.style.transition ).toBe( 'none' );
		expect( sourceRow.style.opacity ).toBe( '1' );
	} );

	/**
	 * 確定処理が完了したら、移動元行へ一時的に与えた表示指定を解除することを確認する。
	 *
	 * 事前条件:
	 * - 有効drop後の確定表示が成立している。
	 *
	 * 操作:
	 * - DnD Interactionをidleへ遷移させる。
	 *
	 * 期待結果:
	 * - drop前に行が持っていたinline表示指定へ戻る。
	 */
	it( 'when row commit finishes, should restore the source row presentation', () => {
		const { sourceRow } = createPresentation();
		sourceRow.style.transform = 'translateY(1px)';
		sourceRow.style.transition = 'transform 1s';
		sourceRow.style.opacity = '0.35';
		const { rerender } = render( <RowSourceCommitPresentation /> );
		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: false,
				operation: { source: { element: sourceRow } },
			} );
		} );

		mockRowDndPhase = 'idle';
		rerender( <RowSourceCommitPresentation /> );

		expect( sourceRow.style.transform ).toBe( 'translateY(1px)' );
		expect( sourceRow.style.transition ).toBe( 'transform 1s' );
		expect( sourceRow.style.opacity ).toBe( '0.35' );
	} );

	/**
	 * 取消または有効な移動先がない終了では、成立しなかった移動を確定済みとして表示しないことを確認する。
	 *
	 * 操作:
	 * - 取消終了と、有効な移動先がない通常終了を通知する。
	 *
	 * 期待結果:
	 * - 移動元行の表示位置を変更しない。
	 */
	it( 'when the drag is canceled or has no valid destination, should not move the source row', () => {
		const { sourceRow } = createPresentation();
		render( <RowSourceCommitPresentation /> );
		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: true,
				operation: { source: { element: sourceRow } },
			} );
		} );
		expect( sourceRow.style.transform ).toBe( '' );

		mockDestinationBoundaryIndex = null;
		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: false,
				operation: { source: { element: sourceRow } },
			} );
		} );
		expect( sourceRow.style.transform ).toBe( '' );
	} );
} );
