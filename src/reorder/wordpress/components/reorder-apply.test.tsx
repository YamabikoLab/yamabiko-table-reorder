/**
 * 確認付き大規模反映UIが、確認対象と反映中の処理状況をWordPressのModalで適切に伝えることを確認する。
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ReorderApplyTableBoundary } from './reorder-apply';

let mockRowState: any = { phase: 'idle', move: null, applied: false };
let mockColumnState: any = { phase: 'idle', move: null, applied: false };

jest.mock( '@wordpress/components', () => ( {
	Button: ( props: { children: ReactNode } ) => <button type="button">{ props.children }</button>,
	Dashicon: ( props: { icon: string } ) => <span aria-hidden="true">{ props.icon }</span>,
	Modal: ( props: { children: ReactNode; title: string; isDismissible?: boolean } ) => (
		<div role="dialog" aria-label={ props.title }>
			{ props.isDismissible !== false && (
				<button type="button" aria-label="Close">
					Close
				</button>
			) }
			{ props.children }
		</div>
	),
} ) );

jest.mock( '@/messages', () => ( {
	getLargeColumnReorderMoveSummary: ( source: number, destination: number ) =>
		`Column ${ source } → ${ destination }`,
	getLargeReorderApplyConfirmBody: () => 'Applying this reorder may take some time.',
	getLargeReorderApplyConfirmTitle: () => 'Apply the new order?',
	getLargeReorderApplyingDetail: () => 'Please wait until the update is complete.',
	getLargeReorderApplyingMessage: () => 'Applying the new order…',
	getLargeReorderCancelLabel: () => 'Cancel',
	getLargeReorderContinueLabel: () => 'Continue',
	getLargeRowReorderMoveSummary: ( source: number, destination: number ) =>
		`Row ${ source } → ${ destination }`,
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/reorder-apply', () => ( {
	applyLargeRowReorder: jest.fn(),
	cancelLargeRowReorderApply: jest.fn(),
	completeLargeRowReorderApply: jest.fn(),
	confirmLargeRowReorderApply: jest.fn(),
	getLargeRowReorderApplyState: () => mockRowState,
	subscribeLargeRowReorderApply: () => () => undefined,
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/reorder-apply', () => ( {
	applyLargeColumnReorder: jest.fn(),
	cancelLargeColumnReorderApply: jest.fn(),
	completeLargeColumnReorderApply: jest.fn(),
	confirmLargeColumnReorderApply: jest.fn(),
	getLargeColumnReorderApplyState: () => mockColumnState,
	subscribeLargeColumnReorderApply: () => () => undefined,
} ) );

describe( 'Large reorder apply UI', () => {
	beforeEach( () => {
		mockRowState = { phase: 'idle', move: null, applied: false };
		mockColumnState = { phase: 'idle', move: null, applied: false };
	} );

	/**
	 * 大規模な行移動では、確認対象を反映後の行番号で確認できることを確認する。
	 *
	 * 事前条件:
	 * - 1000行目を2行目へ移動する確認待ち状態である。
	 *
	 * 操作:
	 * - 対象Tableの確認UIを表示する。
	 *
	 * 期待結果:
	 * - Table本体は元の表示のまま残る。
	 * - 確認Modalに「1000行目から2行目」の移動内容が表示される。
	 */
	it( 'when a large row move awaits confirmation, should show its final row positions without replacing the table', () => {
		mockRowState = {
			phase: 'confirming',
			move: {
				tableIdentity: 'table-a',
				sourceRowIndex: 999,
				destinationBoundaryIndex: 1,
			},
			applied: false,
		};

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
	 * 後方への大規模な列移動では、移動元を取り除いた後の最終列番号で確認できることを確認する。
	 *
	 * 事前条件:
	 * - 2列目を、移動前Tableの6番目の境界へ移動する確認待ち状態である。
	 *
	 * 操作:
	 * - 対象Tableの確認UIを表示する。
	 *
	 * 期待結果:
	 * - 確認Modalに反映後の移動先である「5列目」が表示される。
	 */
	it( 'when a large column move goes forward, should show the final column position after source removal', () => {
		mockColumnState = {
			phase: 'confirming',
			move: {
				tableIdentity: 'table-a',
				sourceColumnIndex: 1,
				destinationBoundaryIndex: 5,
			},
			applied: false,
		};

		render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);

		expect( screen.getByText( 'Column 2 → 5' ) ).not.toBeNull();
	} );

	/**
	 * 大規模な並び替えの反映中は、利用者が処理継続中であることと待機が必要なことを確認できることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの大規模な行並び替えを反映中である。
	 *
	 * 操作:
	 * - 対象Tableの反映中UIを表示する。
	 *
	 * 期待結果:
	 * - Table本体は一時退避される。
	 * - 閉じられない反映中Modalに主文と待機案内が表示される。
	 */
	it( 'when a large reorder is applying, should show a non-dismissible status modal while the table is unavailable', () => {
		mockRowState = {
			phase: 'applying',
			move: {
				tableIdentity: 'table-a',
				sourceRowIndex: 999,
				destinationBoundaryIndex: 1,
			},
			applied: false,
		};

		render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);

		expect( screen.queryByText( 'Table content' ) ).toBeNull();
		expect( screen.getByRole( 'dialog', { name: 'Applying the new order…' } ) ).not.toBeNull();
		expect( screen.getByText( 'Please wait until the update is complete.' ) ).not.toBeNull();
		expect( screen.getByRole( 'status' ).getAttribute( 'aria-busy' ) ).toBe( 'true' );
		expect( screen.queryByRole( 'button', { name: 'Close' } ) ).toBeNull();
	} );
} );
