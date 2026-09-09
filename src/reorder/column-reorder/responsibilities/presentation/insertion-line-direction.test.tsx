/**
 * Column Reorderの挿入線が、DnD Interactionの移動元と有効な移動先、および物理横移動方向から挿入空間の正しい端を表示することを確認する。
 *
 * 既存の挿入線テストで検証しているscroll追従、終了Lifecycle、方向反転は重複せず、
 * 移動元不在時の非表示、論理開始側への移動、RTLでの物理方向と論理方向の分離だけを検証する。
 */

import { act, render } from '@testing-library/react';

import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { ColumnInsertionLine } from './insertion-line';

let mockSourceColumnIndex: number | null = null;
let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
	onDragEnd?: () => void;
} = {};

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndSourceColumnIndex: () => mockSourceColumnIndex,
	useColumnDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@/reorder/column-reorder/infrastructure/column-geometry', () => ( {
	measureTableColumnBoundaryGeometry: jest.fn(),
	resolveTableColumnInlineDirection: jest.fn(),
} ) );

jest.mock( '@/reorder/editor-dom-context', () => ( {
	resolveEditorDomContext: jest.fn(),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

const measureTableColumnBoundaryGeometryMock =
	measureTableColumnBoundaryGeometry as jest.MockedFunction<
		typeof measureTableColumnBoundaryGeometry
	>;
const resolveTableColumnInlineDirectionMock =
	resolveTableColumnInlineDirection as jest.MockedFunction<
		typeof resolveTableColumnInlineDirection
	>;
const resolveEditorDomContextMock = resolveEditorDomContext as jest.MockedFunction<
	typeof resolveEditorDomContext
>;

/**
 * 挿入線の表示条件を必要な値だけで表せるDOM矩形を作成する。
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

/**
 * 開始時の論理列境界を持つColumn Reorder対象Tableを作成する。
 *
 * @return 対象TableとDnD開始セル。
 */
const createSourceTable = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const sourceCell = document.createElement( 'td' );
	row.appendChild( sourceCell );
	tbody.appendChild( row );
	table.appendChild( tbody );
	document.body.appendChild( table );

	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: 100,
			bottom: 500,
			left: 40,
			right: 440,
			width: 400,
			height: 400,
		} )
	);
	jest
		.spyOn( sourceCell, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { width: 80 } ) );

	return { sourceCell };
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

/**
 * DnD Engineから1回の横移動が通知された状態を作る。
 *
 * @param currentX 今回移動する直前のオーバーレイX座標。
 * @param nextX    今回移動しようとしているオーバーレイX座標。
 */
const movePhysicalDrag = ( currentX: number, nextX: number ): void => {
	act( () => {
		mockDragDropMonitor.onDragMove?.( {
			to: { x: nextX },
			operation: { position: { current: { x: currentX } } },
		} );
	} );
};

describe( 'Column insertion line direction', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockSourceColumnIndex = null;
		mockDestinationBoundaryIndex = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		measureTableColumnBoundaryGeometryMock.mockReturnValue( [
			{ index: 0, offset: 0 },
			{ index: 1, offset: 80 },
			{ index: 2, offset: 200 },
			{ index: 3, offset: 260 },
			{ index: 4, offset: 400 },
		] );
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'ltr' );
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: {
				innerWidth: 500,
				innerHeight: 600,
				requestAnimationFrame: () => 1,
				cancelAnimationFrame: () => undefined,
			} as unknown as Window,
		} );
	} );

	/**
	 * DnD Interactionに移動元論理列がない場合は、Presentation側で移動元を補完しないことを確認する。
	 *
	 * 事前条件:
	 * - 物理DnDの開始対象と有効な移動先境界は存在する。
	 * - DnD Interactionには移動元論理列が存在しない。
	 *
	 * 操作:
	 * - 有効な移動先境界を挿入線表示へ反映する。
	 *
	 * 期待結果:
	 * - 移動元をDOMから推測せず、挿入線を表示しない。
	 */
	it( 'when DnD Interaction has no source column, should not infer an insertion line from the source DOM', () => {
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockDestinationBoundaryIndex = 1;
		rerender( <ColumnInsertionLine /> );

		expect( document.querySelector( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeNull();
	} );

	/**
	 * 論理開始側へ移動中は、挿入空間の物理左端へ挿入線を表示することを確認する。
	 *
	 * 事前条件:
	 * - LTR Tableで3列目を移動対象とし、境界1が有効な移動先である。
	 *
	 * 操作:
	 * - 左方向の物理移動を通知する。
	 *
	 * 期待結果:
	 * - 境界1から論理終了方向へ確保される挿入空間の物理左端へ挿入線を表示する。
	 */
	it( 'when moving toward logical start in LTR, should show the line at the insertion gap left edge', () => {
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 2;
		mockDestinationBoundaryIndex = 1;
		rerender( <ColumnInsertionLine /> );
		movePhysicalDrag( 200, 190 );

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '120px' );
	} );

	/**
	 * RTLでも物理横移動方向を論理方向へ読み替えず、画面上の左移動では挿入空間の物理左端を選ぶことを確認する。
	 *
	 * 事前条件:
	 * - RTL Tableで3列目を移動対象とし、境界1が有効な移動先である。
	 *
	 * 操作:
	 * - 左方向の物理移動を通知する。
	 *
	 * 期待結果:
	 * - RTLの論理配置を物理座標へ変換した後の挿入空間左端へ挿入線を表示する。
	 */
	it( 'when moving leftward in RTL, should choose the physical left edge independently of logical direction', () => {
		resolveTableColumnInlineDirectionMock.mockReturnValue( 'rtl' );
		const { sourceCell } = createSourceTable();
		const { rerender } = render( <ColumnInsertionLine /> );
		startPhysicalDrag( sourceCell );
		mockSourceColumnIndex = 2;
		mockDestinationBoundaryIndex = 1;
		rerender( <ColumnInsertionLine /> );
		movePhysicalDrag( 200, 190 );

		const line = document.querySelector(
			'.yamabiko-table-reorder-column-insertion-line'
		) as HTMLElement | null;
		expect( line?.style.left ).toBe( '280px' );
	} );
} );
