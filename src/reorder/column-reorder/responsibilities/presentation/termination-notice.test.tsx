/**
 * 列DnDを安全に継続できず終了した場合の利用者向け通知表示を検証する。
 *
 * DnD Interactionの終了理由判定は重複して検証せず、通知イベントから表示開始、表示終了、購読解除までのPresentation Lifecycleに限定する。
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import * as dndInteraction from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import {
	createColumnReorderTestRow,
	createColumnReorderTestTable,
	setColumnReorderTestTables,
} from '@/reorder/column-reorder/responsibilities/table-integration.test-utils';
import { resolveColumnReorderTarget } from '@/reorder/column-reorder/responsibilities/target-resolution';

import { ColumnTerminationNotice } from './termination-notice';

const subscribeColumnDndTerminationNotice = dndInteraction.subscribeColumnDndTerminationNotice;

/* @wordpress/componentsの公開入口はJest変換対象外のESM-only uuidを読み込むため、Snackbarの表示・dismiss境界だけを代替する。 */
jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode; onRemove?: () => void } ) => (
		<button type="button" aria-label="Dismiss this notice" onClick={ props.onRemove }>
			{ props.children }
		</button>
	),
} ) );

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress Data・DnD Interaction・通知Presentationは実経路へ接続する。 */
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
		throw new Error( 'Column termination notice test target must be resolved.' );
	}

	dndInteraction.columnDndInteraction.start( resolution.target, resolution.initialConstraints );
	dndInteraction.columnDndInteraction.updateDestination( 3 );
	setColumnReorderTestTables( [] );
	dndInteraction.columnDndInteraction.complete();
};

describe( 'ColumnTerminationNotice', () => {
	beforeEach( () => {
		act( () => {
			dndInteraction.columnDndInteraction.cancel();
		} );
		setColumnReorderTestTables( [] );
	} );

	afterEach( () => {
		act( () => {
			dndInteraction.columnDndInteraction.cancel();
		} );
		setColumnReorderTestTables( [] );
		jest.restoreAllMocks();
	} );

	/**
	 * DnD Interactionが通知対象と判断した終了だけを利用者向け表示へ接続することを確認する。
	 *
	 * 事前条件:
	 * - 列DnD終了通知はまだ発生していない。
	 *
	 * 操作:
	 * - Presentationを描画し、DnD Interactionから終了通知を発行する。
	 *
	 * 期待結果:
	 * - 通知前はメッセージを表示しない。
	 * - 通知後は利用者向け終了メッセージを表示する。
	 */
	it( 'when a termination notice is emitted, should show the termination message', () => {
		render( <ColumnTerminationNotice /> );

		expect( screen.queryByText( message ) ).toBeNull();

		act( () => {
			emitTerminationNotice();
		} );

		expect( screen.queryByText( message ) ).not.toBeNull();
	} );

	/**
	 * 一時通知の表示終了後にメッセージを残さないことを確認する。
	 *
	 * 事前条件:
	 * - 終了通知によりメッセージが表示されている。
	 *
	 * 操作:
	 * - WordPressの一時通知部品から表示終了を通知する。
	 *
	 * 期待結果:
	 * - 終了メッセージが表示から除かれる。
	 */
	it( 'when the temporary notice is removed, should hide the termination message', () => {
		render( <ColumnTerminationNotice /> );

		act( () => {
			emitTerminationNotice();
		} );
		expect( screen.queryByText( message ) ).not.toBeNull();

		fireEvent.click( screen.getByRole( 'button', { name: 'Dismiss this notice' } ) );

		expect( screen.queryByText( message ) ).toBeNull();
	} );

	/**
	 * Presentation終了時にDnD Interactionの終了通知購読を解除することを確認する。
	 *
	 * 事前条件:
	 * - Presentationが終了通知を購読している。
	 *
	 * 操作:
	 * - Presentationをunmountする。
	 *
	 * 期待結果:
	 * - 終了通知の購読が残らない。
	 */
	it( 'when the presentation unmounts, should unsubscribe from termination notices', () => {
		let unsubscribeObserver: jest.Mock | undefined;
		/* 購読解除は公開UIから決定的に観測できないため、この1ケースだけ解除関数を記録し、実Production購読と解除へそのまま委譲する。 */
		jest
			.spyOn( dndInteraction, 'subscribeColumnDndTerminationNotice' )
			.mockImplementation( ( listener ) => {
				const unsubscribe = subscribeColumnDndTerminationNotice( listener );
				unsubscribeObserver = jest.fn( unsubscribe );
				return unsubscribeObserver;
			} );
		const { unmount } = render( <ColumnTerminationNotice /> );

		unmount();

		expect( unsubscribeObserver ).toHaveBeenCalledTimes( 1 );
	} );
} );
