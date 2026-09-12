/**
 * WordPress Reorder Apply IntegrationのBoundaryが、対象Tableへ確認・反映中・復帰の表示構造を適切に接続することを確認する。
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ReorderApplyTableBoundary } from './boundary';

let mockRowState: any = { phase: 'idle', move: null, applied: false };
let mockColumnState: any = { phase: 'idle', move: null, applied: false };
let mockRowDestinationIndex: number | null = null;
let mockColumnDestinationIndex: number | null = null;
const mockCancelLargeRowReorderApply = jest.fn();
const mockCancelLargeColumnReorderApply = jest.fn();
const mockConfirmLargeRowReorderApply = jest.fn();
const mockConfirmLargeColumnReorderApply = jest.fn();

jest.mock( '@wordpress/components', () => ( {
	Button: ( props: { children: ReactNode; onClick?: () => void } ) => (
		<button type="button" onClick={ props.onClick }>
			{ props.children }
		</button>
	),
	Dashicon: ( props: { icon: string } ) => <span aria-hidden="true">{ props.icon }</span>,
	Modal: ( props: {
		children: ReactNode;
		title: string;
		isDismissible?: boolean;
		onRequestClose?: () => void;
	} ) => (
		<div role="dialog" aria-label={ props.title }>
			{ props.isDismissible !== false && (
				<button type="button" aria-label="Close" onClick={ props.onRequestClose }>
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
	cancelLargeRowReorderApply: () => mockCancelLargeRowReorderApply(),
	completeLargeRowReorderApply: jest.fn(),
	confirmLargeRowReorderApply: () => mockConfirmLargeRowReorderApply(),
	getLargeRowReorderApplyState: () => mockRowState,
	getLargeRowReorderDestinationRowIndex: () => mockRowDestinationIndex,
	subscribeLargeRowReorderApply: () => () => undefined,
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/reorder-apply', () => ( {
	applyLargeColumnReorder: jest.fn(),
	cancelLargeColumnReorderApply: () => mockCancelLargeColumnReorderApply(),
	completeLargeColumnReorderApply: jest.fn(),
	confirmLargeColumnReorderApply: () => mockConfirmLargeColumnReorderApply(),
	getLargeColumnReorderApplyState: () => mockColumnState,
	getLargeColumnReorderDestinationColumnIndex: () => mockColumnDestinationIndex,
	subscribeLargeColumnReorderApply: () => () => undefined,
} ) );

jest.mock( '@/reorder/reorder-form/responsibilities/apply-coordination', () => ( {
	applyRfReorder: jest.fn(),
	cancelRfApply: jest.fn(),
	completeRfApplyRestoration: jest.fn(),
	continueRfApply: jest.fn(),
	getRfApplyCoordinationSnapshot: () => ( { phase: 'idle' } ),
	getRfApplySummary: () => null,
	subscribeRfApplyCoordination: () => () => undefined,
} ) );

jest.mock( './lifecycle', () => ( {
	useReorderApplyLifecycle: () => ( {
		applyingReferenceElementRef: { current: null },
		restorationReferenceElementRef: { current: null },
	} ),
} ) );

describe( 'WordPress Reorder Apply Integration boundary', () => {
	beforeEach( () => {
		mockRowState = { phase: 'idle', move: null, applied: false };
		mockColumnState = { phase: 'idle', move: null, applied: false };
		mockRowDestinationIndex = null;
		mockColumnDestinationIndex = null;
		jest.clearAllMocks();
	} );

	/**
	 * 大規模な行移動では、確認対象を反映後の行番号で確認できることを確認する。
	 *
	 * 事前条件:
	 * - 1000行目を2行目へ移動する確認待ち状態である。
	 * - Row Apply Lifecycleが反映後最終位置として0-based位置1を提供する。
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
		mockRowDestinationIndex = 1;

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
	 * - 2列目を後方へ移動する確認待ち状態である。
	 * - Column Apply Lifecycleが反映後最終位置として0-based位置4を提供する。
	 *
	 * 操作:
	 * - 対象Tableの確認UIを表示する。
	 *
	 * 期待結果:
	 * - 確認Modalに反映後の移動先である「5列目」が表示される。
	 */
	it( 'when a large column move awaits confirmation, should show the final column position provided by its apply lifecycle', () => {
		mockColumnState = {
			phase: 'confirming',
			move: {
				tableIdentity: 'table-a',
				sourceColumnIndex: 1,
				destinationBoundaryIndex: 6,
			},
			applied: false,
		};
		mockColumnDestinationIndex = 4;

		render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);

		expect( screen.getByText( 'Column 2 → 5' ) ).not.toBeNull();
	} );

	/**
	 * 確認対象ではないTableには確認UIを表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 別Tableの行移動が確認待ちである。
	 *
	 * 操作:
	 * - 対象外TableのBoundaryを表示する。
	 *
	 * 期待結果:
	 * - 通常Tableだけが表示される。
	 * - 確認Modalは表示されない。
	 */
	it( 'when another table owns the pending reorder, should leave the current table unchanged', () => {
		mockRowState = {
			phase: 'confirming',
			move: {
				tableIdentity: 'table-b',
				sourceRowIndex: 2,
				destinationBoundaryIndex: 0,
			},
			applied: false,
		};
		mockRowDestinationIndex = 0;

		render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);

		expect( screen.getByText( 'Table content' ) ).not.toBeNull();
		expect( screen.queryByRole( 'dialog' ) ).toBeNull();
	} );

	/**
	 * 利用者が確認を取り消した場合は、方向固有Apply Lifecycleの取消操作へ接続されることを確認する。
	 *
	 * 事前条件:
	 * - 行移動が確認待ちである。
	 *
	 * 操作:
	 * - 確認ModalのCancelを選択する。
	 *
	 * 期待結果:
	 * - Row Apply Lifecycleの取消操作が1回呼ばれる。
	 */
	it( 'when the user cancels a row confirmation, should delegate cancellation to the row apply lifecycle', () => {
		mockRowState = {
			phase: 'confirming',
			move: {
				tableIdentity: 'table-a',
				sourceRowIndex: 2,
				destinationBoundaryIndex: 0,
			},
			applied: false,
		};
		mockRowDestinationIndex = 0;

		render(
			<ReorderApplyTableBoundary clientId="table-a">
				<div>Table content</div>
			</ReorderApplyTableBoundary>
		);
		fireEvent.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

		expect( mockCancelLargeRowReorderApply ).toHaveBeenCalledTimes( 1 );
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
