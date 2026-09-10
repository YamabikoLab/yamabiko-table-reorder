/**
 * 確認付き大規模反映UIが、実Tableを仮配置せずに移動元と反映後の移動先を確認Modalへ示すことを確認する。
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ReorderApplyTableBoundary } from './reorder-apply';

let mockRowState: any = { phase: 'idle', move: null, applied: false };
let mockColumnState: any = { phase: 'idle', move: null, applied: false };

jest.mock( '@wordpress/components', () => ( {
	Button: ( props: { children: ReactNode } ) => <button type="button">{ props.children }</button>,
	Modal: ( props: { children: ReactNode; title: string } ) => (
		<div role="dialog" aria-label={ props.title }>
			{ props.children }
		</div>
	),
} ) );

jest.mock( '@/messages', () => ( {
	getLargeColumnReorderMoveSummary: ( source: number, destination: number ) =>
		`Column ${ source } → ${ destination }`,
	getLargeReorderApplyConfirmBody: () => 'Applying this reorder may take some time.',
	getLargeReorderApplyConfirmTitle: () => 'Apply the new order?',
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

describe( 'Large reorder confirmation UI', () => {
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
} );
