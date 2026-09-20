/**
 * WordPress Reorder Apply IntegrationのBoundaryが、Production Apply Lifecycleを対象Tableの確認・反映中・復帰表示へ接続することを確認する。
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';

import {
	applyLargeColumnReorder,
	cancelLargeColumnReorderApply,
	completeLargeColumnReorderApply,
	getLargeColumnReorderApplyState,
	requestLargeColumnReorderApply,
} from '@/reorder/column-reorder/responsibilities/reorder-apply';
import { resetRfInteractionTestState } from '@/reorder/reorder-form/responsibilities/interaction.test-utils';
import {
	applyLargeRowReorder,
	cancelLargeRowReorderApply,
	completeLargeRowReorderApply,
	confirmLargeRowReorderApply,
	getLargeRowReorderApplyState,
	requestLargeRowReorderApply,
} from '@/reorder/row-reorder/responsibilities/reorder-apply';

import { ReorderApplyTableBoundary } from './boundary';

/* @wordpress/componentsのuuid / theme ESM境界だけをJestで読める決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'reorder-apply-boundary-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

/*
 * @wordpress/block-editorの公開入口はJest変換対象外のmarked ESMを経由するため直接読み込めない。
 * Table Integrationが必要とするStore境界だけを既存Test Storeへ置き換え、実@wordpress/data経路を利用する。
 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/reorder-form/responsibilities/block-editor-store.test-utils'
	).testBlockEditorStore,
} ) );

/** Row / Column Apply Lifecycleを公開操作だけで通常状態へ戻す。 */
const restoreApplyLifecycles = (): void => {
	const rowState = getLargeRowReorderApplyState();
	if ( rowState.phase === 'confirming' ) {
		cancelLargeRowReorderApply();
	} else if ( rowState.phase === 'applying' ) {
		applyLargeRowReorder();
		completeLargeRowReorderApply();
	} else if ( rowState.phase === 'remounting' ) {
		completeLargeRowReorderApply();
	}

	const columnState = getLargeColumnReorderApplyState();
	if ( columnState.phase === 'confirming' ) {
		cancelLargeColumnReorderApply();
	} else if ( columnState.phase === 'applying' ) {
		applyLargeColumnReorder();
		completeLargeColumnReorderApply();
	} else if ( columnState.phase === 'remounting' ) {
		completeLargeColumnReorderApply();
	}
};

describe( 'WordPress Reorder Apply Integration boundary', () => {
	beforeEach( () => {
		restoreApplyLifecycles();
		resetRfInteractionTestState();
	} );

	afterEach( () => {
		act( () => {
			restoreApplyLifecycles();
			resetRfInteractionTestState();
		} );
	} );

	/**
	 * 大規模な行移動では、確認対象を反映後の行番号で確認できることを確認する。
	 *
	 * 事前条件:
	 * - Production Row Apply Lifecycleで1000行目を2行目へ移動する確認待ち状態である。
	 *
	 * 操作:
	 * - 対象Tableの確認UIを表示する。
	 *
	 * 期待結果:
	 * - Table本体は元の表示のまま残る。
	 * - 確認Modalに「1000行目から2行目」の移動内容が表示される。
	 */
	it( 'when a large row move awaits confirmation, should show its final row positions without replacing the table', () => {
		requestLargeRowReorderApply( {
			tableIdentity: 'table-a',
			sourceRowIndex: 999,
			destinationBoundaryIndex: 1,
		} );

		render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);

		expect( screen.getByText( 'Table content' ) ).not.toBeNull();
		expect( screen.getByText( 'Row 1000 → 2' ) ).not.toBeNull();
		expect( screen.getByRole( 'dialog', { name: 'Apply the new order?' } ) ).not.toBeNull();
	} );

	/**
	 * 後方への大規模な列移動では、Column Apply Lifecycleが提供する反映後最終位置を確認表示に利用することを確認する。
	 *
	 * 事前条件:
	 * - Production Column Apply Lifecycleで2列目を6番目の境界へ移動する確認待ち状態である。
	 *
	 * 操作:
	 * - 対象Tableの確認UIを表示する。
	 *
	 * 期待結果:
	 * - 確認Modalに反映後の移動先である「6列目」が表示される。
	 */
	it( 'when a large column move awaits confirmation, should show the final column position provided by its apply lifecycle', () => {
		requestLargeColumnReorderApply( {
			tableIdentity: 'table-a',
			sourceColumnIndex: 1,
			destinationBoundaryIndex: 6,
		} );

		render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);

		expect( screen.getByText( 'Column 2 → 6' ) ).not.toBeNull();
	} );

	/**
	 * 確認対象ではないTableには確認UIを表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 別Tableの行移動がProduction Lifecycleで確認待ちである。
	 *
	 * 操作:
	 * - 対象外TableのBoundaryを表示する。
	 *
	 * 期待結果:
	 * - 通常Tableだけが表示される。
	 * - 確認Modalは表示されない。
	 */
	it( 'when another table owns the pending reorder, should leave the current table unchanged', () => {
		requestLargeRowReorderApply( {
			tableIdentity: 'table-b',
			sourceRowIndex: 2,
			destinationBoundaryIndex: 0,
		} );

		render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);

		expect( screen.getByText( 'Table content' ) ).not.toBeNull();
		expect( screen.queryByRole( 'dialog' ) ).toBeNull();
	} );

	/**
	 * 利用者が確認を取り消した場合は、Production Row Apply Lifecycleの取消操作へ接続されることを確認する。
	 *
	 * 事前条件:
	 * - 行移動が確認待ちである。
	 *
	 * 操作:
	 * - 確認ModalのCancelを選択する。
	 *
	 * 期待結果:
	 * - Row Apply Lifecycleがidleへ戻り、確認Modalが閉じる。
	 */
	it( 'when the user cancels a row confirmation, should delegate cancellation to the row apply lifecycle', () => {
		requestLargeRowReorderApply( {
			tableIdentity: 'table-a',
			sourceRowIndex: 2,
			destinationBoundaryIndex: 0,
		} );
		render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);

		fireEvent.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

		expect( getLargeRowReorderApplyState().phase ).toBe( 'idle' );
		expect( screen.queryByRole( 'dialog' ) ).toBeNull();
	} );

	/**
	 * 大規模な並び替えの反映中は、利用者が処理継続中であることと待機が必要なことを確認できることを確認する。
	 *
	 * 事前条件:
	 * - 対象TableのProduction Row Apply Lifecycleが反映開始状態である。
	 * - JSDOMに実paintがないため描画待ちは保留されている。
	 *
	 * 操作:
	 * - 対象Tableの反映中UIを表示する。
	 *
	 * 期待結果:
	 * - Table本体は一時退避される。
	 * - 閉じられない反映中Modalに主文と待機案内が表示される。
	 */
	it( 'when a large reorder is applying, should show a non-dismissible status modal while the table is unavailable', () => {
		requestLargeRowReorderApply( {
			tableIdentity: 'table-a',
			sourceRowIndex: 999,
			destinationBoundaryIndex: 1,
		} );
		confirmLargeRowReorderApply();
		/*
		 * JSDOMにはpaintがないため、Lifecycleが利用するAnimation Frame予約だけを保留し、
		 * Production Apply LifecycleとUIはそのまま接続する。
		 */
		const requestFrame = jest
			.spyOn( window, 'requestAnimationFrame' )
			.mockImplementation( () => 1 );
		const cancelFrame = jest
			.spyOn( window, 'cancelAnimationFrame' )
			.mockImplementation( () => undefined );

		const view = render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);

		expect( screen.queryByText( 'Table content' ) ).toBeNull();
		const dialog = screen.getByRole( 'dialog', { name: 'Applying the new order…' } );
		expect( screen.getByText( 'Please wait until the update is complete.' ) ).not.toBeNull();
		expect( screen.getByRole( 'status' ).getAttribute( 'aria-busy' ) ).toBe( 'true' );
		expect( within( dialog ).queryByRole( 'button' ) ).toBeNull();

		view.unmount();
		requestFrame.mockRestore();
		cancelFrame.mockRestore();
	} );
} );
