/**
 * Column ReorderのPresentation集約境界が、各実表示責務とProduction通知経路を同じDnD境界へ接続することを確認する。
 */

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { columnDndInteraction } from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import {
	createColumnReorderTestRow,
	createColumnReorderTestTable,
	setColumnReorderTestTables,
} from '@/reorder/column-reorder/responsibilities/table-integration.test-utils';
import { resolveColumnReorderTarget } from '@/reorder/column-reorder/responsibilities/target-resolution';

import { ColumnPresentation } from './column-presentation';

/* DnD Engineのframe transformはJSDOMで再現できず、依存先もJest変換対象外のESMであるため、この未使用時の読込境界だけを代替する。 */
jest.mock( '@dnd-kit/dom/utilities', () => ( {
	getFrameTransform: () => ( { x: 0, y: 0, scaleX: 1, scaleY: 1 } ),
} ) );

/* DnD Engineの物理monitorはJSDOMで実行できないため、その接続境界だけを代替し、各Presentationと意味状態は実経路へ接続する。 */
jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: () => undefined,
} ) );

/* @wordpress/componentsの公開入口はJest変換対象外のESM-only uuidを読み込むため、Snackbarの表示境界だけを代替する。 */
jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode } ) => <div>{ props.children }</div>,
} ) );

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとColumn Reorder責務は実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/column-reorder/responsibilities/table-integration.test-utils'
	).columnReorderTestBlockEditorStore,
} ) );

const message = 'Reordering could not continue, so the operation was ended.';

/** 現在Table消失により確定できなくなった列DnDからProduction異常終了通知を発行する。 */
const emitTerminationNotice = (): void => {
	setColumnReorderTestTables( [
		createColumnReorderTestTable( 'table-a', [
			createColumnReorderTestRow( 'row-1', 3 ),
			createColumnReorderTestRow( 'row-2', 3 ),
		] ),
	] );
	const resolution = resolveColumnReorderTarget( {
		tableIdentity: 'table-a',
		sourceColumnIndex: 0,
	} );
	if ( resolution.status !== 'resolved' ) {
		throw new Error( 'Column presentation test target must be resolved.' );
	}

	columnDndInteraction.start( resolution.target, resolution.initialConstraints );
	columnDndInteraction.updateDestination( 3 );
	setColumnReorderTestTables( [] );
	columnDndInteraction.complete();
};

describe( 'ColumnPresentation', () => {
	beforeEach( () => {
		act( () => {
			columnDndInteraction.cancel();
		} );
		setColumnReorderTestTables( [] );
	} );

	afterEach( () => {
		act( () => {
			columnDndInteraction.cancel();
		} );
		setColumnReorderTestTables( [] );
	} );

	/**
	 * 集約境界が実終了通知PresentationをDnD Interactionへ接続することを確認する。
	 *
	 * 事前条件:
	 * - Column Presentation配下の通知はまだ発生していない。
	 *
	 * 操作:
	 * - 集約境界を描画し、DnD Interactionから異常終了通知を発行する。
	 *
	 * 期待結果:
	 * - 通知前は終了メッセージを表示しない。
	 * - 通知後は実通知Presentationから利用者向けメッセージを表示する。
	 */
	it( 'when a column DnD termination is emitted, should connect the termination notice presentation', () => {
		render( <ColumnPresentation startRejectionNoticeRef={ null } /> );

		expect( screen.queryByText( message ) ).toBeNull();

		act( () => {
			emitTerminationNotice();
		} );

		expect( screen.queryByText( message ) ).not.toBeNull();
	} );
} );
