/**
 * Row HighlightがTable解析を入力時まで遅延し、各対象を現在Tableから直接解決しながらDnD LifecycleをReact再描画から分離することを確認する。
 */

import { act, fireEvent, render } from '@testing-library/react';

import { reorderMode } from '@/reorder/reorder-mode';
import {
	getRowDndPhase,
	rowDndInteraction,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import {
	createRowReorderTestRow,
	createRowReorderTestTable,
	setRowReorderTestTables,
} from '@/reorder/row-reorder/responsibilities/table-integration.test-utils';
import * as targetResolution from '@/reorder/row-reorder/responsibilities/target-resolution';

import { RowHighlight } from './row-highlight';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとRow Reorder責務は実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( '@/reorder/row-reorder/responsibilities/table-integration.test-utils' )
		.rowReorderTestBlockEditorStore,
} ) );

/** 結合セル制約のない2行の現在Tableを登録する。 */
const setMovableTable = (): void => {
	setRowReorderTestTables( [
		createRowReorderTestTable( 'table-a', [
			createRowReorderTestRow( 'row-1' ),
			createRowReorderTestRow( 'row-2' ),
		] ),
	] );
};

/** 2行目を含む結合セルにより、その行の移動を開始できない現在Tableを登録する。 */
const setBlockedTable = (): void => {
	setRowReorderTestTables( [
		createRowReorderTestTable( 'table-a', [
			{ cells: [ {}, {}, { rowspan: 2, colspan: 2 } ] },
			{ cells: [ {}, {} ] },
		] ),
	] );
};

/** Production Target Resolutionの解決結果から行DnD Sessionを開始する。 */
const startRowDnd = (): void => {
	const resolution = targetResolution.resolveRowReorderTarget( {
		tableIdentity: 'table-a',
		sourceRowIndex: 0,
	} );
	if ( resolution.status !== 'resolved' ) {
		throw new Error( 'Row highlight lifecycle test target must be resolved.' );
	}

	rowDndInteraction.start( resolution.target, resolution.initialConstraints );
};

/**
 * Row HighlightのLifecycleだけを確認するTableを描画する。
 * @param props
 * @param props.childrenRender
 */
const TestTable = ( props: { childrenRender?: () => void } ) => (
	<RowHighlight tableIdentity="table-a">
		{ ( onPointerOverCapture ) => {
			props.childrenRender?.();
			return (
				<div data-testid="wrapper" onPointerOverCapture={ onPointerOverCapture }>
					<table>
						<tbody>
							<tr data-testid="row-0">
								<td>First</td>
							</tr>
							<tr data-testid="row-1">
								<td>Second</td>
							</tr>
						</tbody>
					</table>
				</div>
			);
		} }
	</RowHighlight>
);

const activateRowMode = (): void => {
	act( () => {
		reorderMode.observeTable( 'table-a' );
		reorderMode.select( 'row', 'table-a' );
	} );
};

const resetReorderMode = (): void => {
	act( () => {
		reorderMode.observeTable( '__row-highlight-lifecycle-reset__' );
	} );
};

describe( 'Row highlight resolution lifecycle', () => {
	beforeEach( () => {
		act( () => {
			rowDndInteraction.cancel();
		} );
		setRowReorderTestTables( [] );
		resetReorderMode();
	} );

	afterEach( () => {
		act( () => {
			rowDndInteraction.cancel();
		} );
		setRowReorderTestTables( [] );
		resetReorderMode();
		jest.restoreAllMocks();
	} );

	/**
	 * Row Highlightを接続しただけではTable全体解析を開始しないことを確認する。
	 *
	 * 操作:
	 * - Row Highlightを描画する。
	 * - その後に現在Tableを登録し、行へポインターを移動する。
	 *
	 * 期待結果:
	 * - 描画だけではTarget Resolutionを実行しない。
	 * - 描画時点には存在しなかった現在Tableを入力時に解決し、操作可能表示を付ける。
	 */
	it( 'when row highlight is rendered, should defer target resolution until a valid highlight request', () => {
		const resolveTarget = jest.spyOn( targetResolution, 'resolveRowReorderTarget' );
		const { getByTestId } = render( <TestTable /> );

		expect( resolveTarget ).not.toHaveBeenCalled();

		setMovableTable();
		activateRowMode();

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( resolveTarget ).toHaveBeenCalledTimes( 1 );
		expect( getByTestId( 'row-0' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );
	} );

	/**
	 * hover対象が変わるたびに要求時点のTableから直接解決することを確認する。
	 *
	 * 事前条件:
	 * - Row Reorder Modeが有効で、Row DnDはidleである。
	 *
	 * 操作:
	 * - 1行目、2行目の順にポインターを移動する。
	 *
	 * 期待結果:
	 * - 各行がそれぞれ現在Tableに対するTargetとして解決される。
	 */
	it( 'when multiple rows are highlighted before DnD, should resolve each target directly', () => {
		setMovableTable();
		activateRowMode();
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( getByTestId( 'row-0' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );

		setBlockedTable();
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );

		expect( getByTestId( 'row-0' ).className ).toBe( '' );
		expect( getByTestId( 'row-1' ).className ).toBe( 'yamabiko-table-reorder-row-unavailable' );
	} );

	/**
	 * DnD開始後は表示を破棄し、active中にはTarget Resolutionを実行しないことを確認する。
	 *
	 * 事前条件:
	 * - Row Reorder Modeが有効で、idle中に操作可否を解決済みである。
	 *
	 * 操作:
	 * - Row DnDをactiveへ移行し、別行へポインターを移動する。
	 * - その後idleへ戻して再び行へポインターを移動する。
	 *
	 * 期待結果:
	 * - active中はTarget Resolutionを実行しない。
	 * - idle復帰後の最初の有効な判定で現在対象を直接解決する。
	 */
	it( 'when row DnD becomes active, should resolve another target only after returning to idle', () => {
		setMovableTable();
		activateRowMode();
		const resolveTarget = jest.spyOn( targetResolution, 'resolveRowReorderTarget' );
		const { getByTestId } = render( <TestTable /> );

		fireEvent.pointerOver( getByTestId( 'row-0' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( getByTestId( 'row-0' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );

		act( () => {
			startRowDnd();
		} );
		resolveTarget.mockClear();
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( resolveTarget ).not.toHaveBeenCalled();
		expect( getByTestId( 'row-0' ).className ).toBe( '' );
		expect( getByTestId( 'row-1' ).className ).toBe( '' );

		act( () => {
			rowDndInteraction.cancel();
		} );
		fireEvent.pointerOver( getByTestId( 'row-1' ).querySelector( 'td' ) as HTMLTableCellElement );
		expect( resolveTarget ).toHaveBeenCalledTimes( 1 );
		expect( getByTestId( 'row-1' ).className ).toBe( 'yamabiko-table-reorder-row-highlightable' );
	} );

	/**
	 * DnD Lifecycle通知がTable subtreeのReact再描画を発生させないことを確認する。
	 *
	 * 事前条件:
	 * - Row HighlightがDnD状態変更をReact非依存境界で購読している。
	 *
	 * 操作:
	 * - idleからactive、activeからidleへの通知を発生させる。
	 *
	 * 期待結果:
	 * - children描画処理の実行回数は増えない。
	 */
	it( 'when row DnD phase changes, should not rerender the table subtree', () => {
		setMovableTable();
		const childrenRender = jest.fn();
		render( <TestTable childrenRender={ childrenRender } /> );
		const initialRenderCount = childrenRender.mock.calls.length;

		act( () => {
			startRowDnd();
			rowDndInteraction.cancel();
		} );

		expect( childrenRender.mock.calls.length ).toBe( initialRenderCount );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );
} );
