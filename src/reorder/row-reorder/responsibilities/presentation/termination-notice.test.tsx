/**
 * 行DnD異常終了時の利用者向け通知表示を検証する。
 *
 * DnD Interactionの終了理由判定は重複して検証せず、通知イベントから表示開始、表示更新、表示終了、購読解除までのPresentationのライフサイクルに限定する。
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { rowDndInteraction } from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import {
	createRowReorderTestRow,
	createRowReorderTestTable,
	setRowReorderTestTables,
} from '@/reorder/row-reorder/responsibilities/table-integration.test-utils';
import { resolveRowReorderTarget } from '@/reorder/row-reorder/responsibilities/target-resolution';

import { RowTerminationNotice } from './termination-notice';

let snackbarRemove: ( () => void ) | undefined;

/* @wordpress/componentsの公開入口はJest変換対象外のESM-only uuidを読み込むため、Snackbarの表示・dismiss境界だけを代替する。 */
jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode; onRemove?: () => void } ) => {
		snackbarRemove = props.onRemove;
		return (
			<button type="button" aria-label="Dismiss this notice" onClick={ props.onRemove }>
				{ props.children }
			</button>
		);
	},
} ) );

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress Data・DnD Interaction・通知Presentationは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( '@/reorder/row-reorder/responsibilities/table-integration.test-utils' )
		.rowReorderTestBlockEditorStore,
} ) );

const message = 'Reordering could not continue, so the operation was ended.';

/** 現在Table消失により確定できなくなった行DnDからProduction異常終了通知を発行する。 */
const emitTerminationNotice = (): void => {
	setRowReorderTestTables( [
		createRowReorderTestTable( 'table-a', [
			createRowReorderTestRow( 'row-1' ),
			createRowReorderTestRow( 'row-2' ),
			createRowReorderTestRow( 'row-3' ),
		] ),
	] );
	const resolution = resolveRowReorderTarget( {
		tableIdentity: 'table-a',
		sourceRowIndex: 0,
	} );
	if ( resolution.status !== 'resolved' ) {
		throw new Error( 'Row termination notice test target must be resolved.' );
	}

	rowDndInteraction.start( resolution.target, resolution.initialConstraints );
	rowDndInteraction.updateDestination( 3 );
	setRowReorderTestTables( [] );
	rowDndInteraction.complete();
};

describe( 'RowTerminationNotice', () => {
	beforeEach( () => {
		snackbarRemove = undefined;
		act( () => {
			rowDndInteraction.cancel();
		} );
		setRowReorderTestTables( [] );
	} );

	afterEach( () => {
		act( () => {
			rowDndInteraction.cancel();
		} );
		setRowReorderTestTables( [] );
	} );

	/**
	 * 異常終了通知が発生した場合だけメッセージを表示することを確認する。
	 *
	 * 事前条件:
	 * - 行DnD異常終了通知はまだ発生していない。
	 *
	 * 操作:
	 * - Presentationを描画し、DnD Interactionから異常終了通知を発行する。
	 *
	 * 期待結果:
	 * - 通知前はメッセージを表示しない。
	 * - 通知後は利用者向け異常終了メッセージを表示する。
	 */
	it( 'when a termination notice is emitted, should show the termination message', () => {
		render( <RowTerminationNotice /> );

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
	 * - 異常終了通知によりメッセージが表示されている。
	 *
	 * 操作:
	 * - WordPressの一時通知部品から表示終了を通知する。
	 *
	 * 期待結果:
	 * - 異常終了メッセージが表示から除かれる。
	 */
	it( 'when the temporary notice is removed, should hide the termination message', () => {
		render( <RowTerminationNotice /> );

		act( () => {
			emitTerminationNotice();
		} );
		expect( screen.queryByText( message ) ).not.toBeNull();

		fireEvent.click( screen.getByRole( 'button', { name: 'Dismiss this notice' } ) );

		expect( screen.queryByText( message ) ).toBeNull();
	} );

	/**
	 * 表示中に新しい異常終了通知が発生した場合、先の通知の表示終了で新しい通知を消さないことを確認する。
	 *
	 * 事前条件:
	 * - 最初の異常終了通知によりメッセージが表示されている。
	 * - 最初の通知に対応する表示終了処理を保持している。
	 *
	 * 操作:
	 * - 続けて新しい異常終了通知を発行した後、先の通知に対応する表示終了処理を実行する。
	 *
	 * 期待結果:
	 * - 新しい異常終了メッセージは表示されたままになる。
	 */
	it( 'when a newer termination notice is shown before the previous notice is removed, should keep the newer notice visible', () => {
		render( <RowTerminationNotice /> );

		act( () => {
			emitTerminationNotice();
		} );
		const removePreviousNotice = snackbarRemove;

		act( () => {
			emitTerminationNotice();
		} );
		/* keyによるSnackbar置換後の古いonRemoveは公開操作から決定的に再現できないため、この競合入力だけ保持したコールバックで発生させる。 */
		act( () => removePreviousNotice?.() );

		expect( screen.queryByText( message ) ).not.toBeNull();
	} );

	/**
	 * Presentation終了時に異常終了通知の購読を解除することを確認する。
	 *
	 * 事前条件:
	 * - PresentationがDnD Interactionの異常終了通知を購読している。
	 *
	 * 操作:
	 * - Presentationをunmountする。
	 *
	 * 期待結果:
	 * - 異常終了通知の購読が残らない。
	 */
	it( 'when the presentation unmounts, should unsubscribe from termination notices', () => {
		const { unmount } = render( <RowTerminationNotice /> );

		unmount();
		act( () => {
			emitTerminationNotice();
		} );

		expect( screen.queryByText( message ) ).toBeNull();
	} );
} );
