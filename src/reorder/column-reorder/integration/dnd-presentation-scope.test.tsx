/**
 * 複数の対応Tableが存在する場合も、Production Column Reorder Presentationを現在の操作対象だけへ接続することを確認する。
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { reorderMode } from '@/reorder/reorder-mode';
import { columnDndInteraction } from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import {
	createColumnReorderTestRow,
	createColumnReorderTestTable,
	setColumnReorderTestTables,
} from '@/reorder/column-reorder/responsibilities/table-integration.test-utils';
import { resolveColumnReorderTarget } from '@/reorder/column-reorder/responsibilities/target-resolution';
import { ColumnDnd } from './dnd';

jest.mock( 'uuid', () => ( { v4: () => 'column-dnd-presentation-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: ReactNode } ) => children,
} ) );

/* 物理DnDを実行できないJSDOMでは、dnd-kitのEngine境界だけを決定的なTest Doubleにする。 */
jest.mock( '@dnd-kit/dom', () => ( {
	AutoScroller: {},
	Cursor: {},
	PreventSelection: {},
	Feedback: {},
	Draggable: jest.fn(),
	PointerSensor: { configure: jest.fn() },
	PointerActivationConstraints: { Distance: jest.fn(), Delay: jest.fn() },
} ) );
jest.mock( '@dnd-kit/dom/utilities', () => ( { getFrameTransform: jest.fn() } ) );
jest.mock( '@dnd-kit/react', () => ( {
	DragDropProvider: ( { children }: { children: ReactNode } ) => children,
	useDragDropManager: () => ( { dragOperation: { status: { idle: true } } } ),
	useDragDropMonitor: () => undefined,
} ) );

/* JSDOMにないscroll・RAF境界だけを停止可能なSessionとして代替する。 */
jest.mock( './horizontal-auto-scroll', () => ( {
	createColumnHorizontalAutoScroll: () => ( {
		start: jest.fn(),
		updatePointer: jest.fn(),
		stop: jest.fn(),
	} ),
} ) );

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとColumn Reorder責務は実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/column-reorder/responsibilities/table-integration.test-utils'
	).columnReorderTestBlockEditorStore,
} ) );

/**
 * 現在Tableと対応する最小Table DOMを描画する。
 *
 * @param props        Table描画条件。
 * @param props.label  Tableの識別名。
 * @param props.merged 横結合セルを描画する場合はtrue。
 */
const Table = ( props: { label: string; merged?: boolean } ) => (
	<table aria-label={ props.label }>
		<tbody>
			<tr>
				{ props.merged ? (
					<td colSpan={ 2 }>merged</td>
				) : (
					<>
						<td>first</td>
						<td>second</td>
					</>
				) }
			</tr>
		</tbody>
	</table>
);

describe( 'Column DnD presentation ownership', () => {
	beforeEach( () => {
		columnDndInteraction.cancel();
		reorderMode.observeTable( '__column-dnd-presentation-test-reset__' );
		setColumnReorderTestTables( [
			createColumnReorderTestTable( 'table-a', [
				{ cells: [ { content: 'merged', colspan: 2 } ] },
			] ),
			createColumnReorderTestTable( 'table-b', [ createColumnReorderTestRow( 'row-1', 2 ) ] ),
		] );
	} );

	afterEach( () => {
		columnDndInteraction.cancel();
		reorderMode.observeTable( '__column-dnd-presentation-test-reset__' );
		setColumnReorderTestTables( [] );
	} );

	/**
	 * 複数TableのDnD境界が存在しても、現在の操作対象だけがPresentationを所有することを確認する。
	 *
	 * 操作:
	 * - 両Tableを描画し、Production DnD Interactionから異常終了通知を発生させる。
	 *
	 * 期待結果:
	 * - 両Tableの既存Block subtreeは描画され、異常終了通知は1つだけ表示される。
	 */
	it( 'when multiple column DnD boundaries are mounted, should connect presentation only for the current table', () => {
		render(
			<>
				<ColumnDnd presentationEnabled tableIdentity="table-a">
					{ () => <Table label="table-a" merged /> }
				</ColumnDnd>
				<ColumnDnd presentationEnabled={ false } tableIdentity="table-b">
					{ () => <Table label="table-b" /> }
				</ColumnDnd>
			</>
		);
		const resolution = resolveColumnReorderTarget( {
			tableIdentity: 'table-b',
			sourceColumnIndex: 0,
		} );
		if ( resolution.status !== 'resolved' ) {
			throw new Error( 'Column DnD presentation test target must be resolved.' );
		}

		act( () => {
			columnDndInteraction.start( resolution.target, resolution.initialConstraints );
			columnDndInteraction.updateDestination( 2 );
			setColumnReorderTestTables( [] );
			columnDndInteraction.complete();
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
	 * 期待結果:
	 * - 横結合範囲の開始拒否通知だけが表示され、既存Block subtreeの描画回数は増えない。
	 */
	it( 'when input reports a start rejection, should update only the notice without rerendering the table subtree', () => {
		reorderMode.select( 'column', 'table-a' );
		const childrenRender = jest.fn( ( onPointerDownCapture ) => (
			<div onPointerDownCapture={ onPointerDownCapture }>
				<Table label="table-a" merged />
			</div>
		) );
		render(
			<ColumnDnd presentationEnabled tableIdentity="table-a">
				{ childrenRender }
			</ColumnDnd>
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
			'A merged cell in row 1 spanning columns 1–2 prevents this move.'
		);
		expect( childrenRender ).toHaveBeenCalledTimes( initialRenderCount );
	} );
} );
