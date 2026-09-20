/**
 * 行専用DnD Interactionが、候補境界から実際に行順を変更できる移動先だけを公開状態として保持することを確認する。
 */

import { reorderMode } from '@/reorder/reorder-mode';

import {
	getRowDndDestinationBoundaryIndex,
	rowDndInteraction,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import {
	createRowReorderTestRow,
	createRowReorderTestTable,
	setRowReorderTestTables,
} from '@/reorder/row-reorder/responsibilities/table-integration.test-utils';
import { resolveRowReorderTarget } from '@/reorder/row-reorder/responsibilities/target-resolution';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとTable Integrationは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/row-reorder/responsibilities/table-integration.test-utils'
	).rowReorderTestBlockEditorStore,
} ) );

const target = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

/** 解決済みTargetからactiveな行DnD Sessionを開始する。 */
const startSession = (): void => {
	const resolution = resolveRowReorderTarget( target );
	if ( resolution.status !== 'resolved' ) {
		throw new Error( 'Row DnD test target must be resolved.' );
	}
	rowDndInteraction.start( resolution.target, resolution.initialConstraints );
};

describe( 'Row DnD destination validity', () => {
	beforeEach( () => {
		rowDndInteraction.cancel();
		reorderMode.observeTable( '__row-dnd-destination-test-reset__' );
		reorderMode.select( 'row', 'table-a' );
		setRowReorderTestTables( [
			createRowReorderTestTable(
				'table-a',
				Array.from( { length: 5 }, ( _value, rowIndex ) =>
					createRowReorderTestRow( `row-${ rowIndex + 1 }` )
				)
			),
		] );
	} );

	afterEach( () => {
		rowDndInteraction.cancel();
		reorderMode.observeTable( '__row-dnd-destination-test-reset__' );
		setRowReorderTestTables( [] );
	} );

	/**
	 * 概要:
	 * - 有効な移動先を保持した後に移動元の直前または直後へ戻った場合、現在の有効移動先が解除されることを確認する。
	 * 事前条件:
	 * - 2行目を移動対象とするactive Sessionが成立している。
	 * 操作:
	 * - 有効な境界4から移動元直前・直後の境界へ戻す。
	 * 期待結果:
	 * - 移動元直前・直後へ戻るたびに現在の有効移動先はnullとなる。
	 */
	it( 'when a valid destination returns to immediately before or after the source row, should clear the valid destination', () => {
		startSession();

		rowDndInteraction.updateDestination( 4 );
		expect( getRowDndDestinationBoundaryIndex() ).toBe( 4 );

		rowDndInteraction.updateDestination( 1 );
		expect( getRowDndDestinationBoundaryIndex() ).toBeNull();

		rowDndInteraction.updateDestination( 4 );
		rowDndInteraction.updateDestination( 2 );
		expect( getRowDndDestinationBoundaryIndex() ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 行順が変わる構造上有効な候補は現在の有効移動先として保持されることを確認する。
	 * 事前条件:
	 * - 2行目を移動対象とするactive Sessionが成立している。
	 * 操作:
	 * - 境界4を移動先候補として更新する。
	 * 期待結果:
	 * - 現在の有効移動先として境界4を取得できる。
	 */
	it( 'when the candidate changes the row order and preserves the table structure, should expose it as the valid destination', () => {
		startSession();

		rowDndInteraction.updateDestination( 4 );

		expect( getRowDndDestinationBoundaryIndex() ).toBe( 4 );
	} );
} );
