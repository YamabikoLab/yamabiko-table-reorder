/**
 * 複数の対応Tableが存在する場合も、Production Reorder Presentationを現在の操作対象だけへ接続することを確認する。
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { reorderMode } from '@/reorder/reorder-mode';
import { rowDndInteraction } from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import {
	createRowReorderTestRow,
	createRowReorderTestTable,
	setRowReorderTestTables,
} from '@/reorder/row-reorder/responsibilities/table-integration.test-utils';
import { resolveRowReorderTarget } from '@/reorder/row-reorder/responsibilities/target-resolution';
import { RowDnd } from './dnd';

/* @wordpress/componentsが経由するJest非対応のuuid / theme ESM境界だけを決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'row-dnd-presentation-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: ReactNode } ) => children,
} ) );

/* 物理DnDを実行できないJSDOMでは、dnd-kitのEngine境界だけを決定的なTest Doubleにする。 */
jest.mock( '@dnd-kit/dom', () => ( {
	AutoScroller: { configure: jest.fn( () => ( { configured: true } ) ) },
	Cursor: {},
	PreventSelection: {},
	Feedback: {},
	Draggable: jest.fn(),
	PointerSensor: { configure: jest.fn() },
	PointerActivationConstraints: {
		Distance: jest.fn(),
		Delay: jest.fn(),
	},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	DragDropProvider: ( { children }: { children: ReactNode } ) => children,
	useDragDropManager: () => ( {
		dragOperation: { status: { idle: true } },
	} ),
	useDragDropMonitor: () => undefined,
} ) );

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとRow Reorder責務は実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( '@/reorder/row-reorder/responsibilities/table-integration.test-utils' )
		.rowReorderTestBlockEditorStore,
} ) );

/**
 * 現在Tableと対応する最小Table DOMを描画する。
 * @param props
 * @param props.label
 */
const Table = ( props: { label: string } ) => (
	<table aria-label={ props.label }>
		<tbody>
			<tr>
				<td>merged</td>
			</tr>
			<tr>
				<td>second</td>
			</tr>
		</tbody>
	</table>
);

describe( 'Row DnD presentation ownership', () => {
	beforeEach( () => {
		rowDndInteraction.cancel();
		reorderMode.observeTable( '__row-dnd-presentation-test-reset__' );
		setRowReorderTestTables( [
			createRowReorderTestTable( 'table-a', [
				{ cells: [ { content: 'merged', rowspan: 2 } ] },
				{ cells: [] },
			] ),
			createRowReorderTestTable( 'table-b', [
				createRowReorderTestRow( 'row-1', 1 ),
				createRowReorderTestRow( 'row-2', 1 ),
			] ),
		] );
	} );

	afterEach( () => {
		rowDndInteraction.cancel();
		reorderMode.observeTable( '__row-dnd-presentation-test-reset__' );
		setRowReorderTestTables( [] );
	} );

	/**
	 * 複数TableのDnD境界が存在しても、現在の操作対象だけがPresentationを所有することを確認する。
	 *
	 * 事前条件:
	 * - Table AとTable BのDnD境界が同時に存在する。
	 * - Table Aだけが現在の操作対象である。
	 *
	 * 操作:
	 * - 両Tableを描画し、Production DnD Interactionから異常終了通知を発生させる。
	 *
	 * 期待結果:
	 * - 両Tableの既存Block subtreeは描画される。
	 * - 異常終了通知はTable Aに対応する1つだけが表示される。
	 */
	it( 'when multiple table DnD boundaries are mounted, should connect presentation only for the current table', () => {
		render(
			<>
				<RowDnd presentationEnabled tableIdentity="table-a">
					{ () => <Table label="table-a" /> }
				</RowDnd>
				<RowDnd presentationEnabled={ false } tableIdentity="table-b">
					{ () => <Table label="table-b" /> }
				</RowDnd>
			</>
		);
		const resolution = resolveRowReorderTarget( {
			tableIdentity: 'table-b',
			sourceRowIndex: 0,
		} );
		if ( resolution.status !== 'resolved' ) {
			throw new Error( 'Row DnD presentation test target must be resolved.' );
		}

		act( () => {
			rowDndInteraction.start( resolution.target, resolution.initialConstraints );
			rowDndInteraction.updateDestination( 2 );
			setRowReorderTestTables( [] );
			rowDndInteraction.complete();
		} );

		expect( screen.queryByRole( 'table', { name: 'table-a' } ) ).not.toBeNull();
		expect( screen.queryByRole( 'table', { name: 'table-b' } ) ).not.toBeNull();
		expect( screen.getAllByRole( 'button', { name: 'Dismiss this notice' } ) ).toHaveLength( 1 );
		expect( screen.getByRole( 'button', { name: 'Dismiss this notice' } ).textContent ).toBe(
			'Reordering could not continue, so the operation was ended.'
		);
	} );

	/**
	 * 開始拒否通知がProduction Noticeだけを更新し、Table subtreeを再描画しないことを確認する。
	 *
	 * 事前条件:
	 * - 現在TableのDnD境界にProduction InputとPresentationが接続されている。
	 * - 先頭行は結合セル制約により開始できない。
	 *
	 * 操作:
	 * - 先頭行のセルから主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 結合セル範囲の開始拒否通知だけが表示される。
	 * - 既存Block subtreeの描画回数は増えない。
	 */
	it( 'when input reports a start rejection, should update only the notice without rerendering the table subtree', () => {
		reorderMode.select( 'row', 'table-a' );
		const childrenRender = jest.fn( ( onPointerDownCapture ) => (
			<div onPointerDownCapture={ onPointerDownCapture }>
				<Table label="table-a" />
			</div>
		) );
		render(
			<RowDnd presentationEnabled tableIdentity="table-a">
				{ childrenRender }
			</RowDnd>
		);
		const initialRenderCount = childrenRender.mock.calls.length;

		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		Object.defineProperties( pointerDown, {
			button: { value: 0 },
			isPrimary: { value: true },
			pointerType: { value: 'mouse' },
			clientX: { value: 10 },
			clientY: { value: 20 },
		} );
		fireEvent( screen.getByText( 'merged' ), pointerDown );

		expect( screen.getByRole( 'button', { name: 'Dismiss this notice' } ).textContent ).toBe(
			'A merged cell spanning rows 1–2 in column 1 prevents this move.'
		);
		expect( childrenRender ).toHaveBeenCalledTimes( initialRenderCount );
	} );
} );
