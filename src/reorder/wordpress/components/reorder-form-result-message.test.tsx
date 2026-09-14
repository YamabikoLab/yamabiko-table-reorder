/**
 * Reorder Form（RF）がTable Integration由来の0-based結合セル位置を、利用者向け1-based位置へ変換して表示文言境界へ渡すことを確認する。
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { RfInteractionReactState } from '@/reorder/reorder-form/responsibilities/interaction-react';
import { reorderFormCollapse } from '@/reorder/wordpress/components/reorder-form-collapse';

import { ReorderFormPopover } from './reorder-form';

type MockButtonProps = {
	children: ReactNode;
	disabled?: boolean;
	onClick?: () => void;
	label?: string;
	'aria-expanded'?: boolean;
};

jest.mock( '@wordpress/components', () => ( {
	Button: ( props: MockButtonProps ) => (
		<button
			aria-expanded={ props[ 'aria-expanded' ] }
			aria-label={ props.label }
			disabled={ props.disabled }
			onClick={ props.onClick }
			type="button"
		>
			{ props.children }
		</button>
	),
	Popover: ( props: { children: ReactNode } ) => <div>{ props.children }</div>,
} ) );

jest.mock( '@/messages', () => ( {
	getRfAboveLabel: () => '上',
	getRfApplyLabel: () => '並び替え',
	getRfBelowLabel: () => '下',
	getRfCancelLabel: () => 'キャンセル',
	getRfColumnMergedRangeMessage: (
		section: string,
		rowStart: number,
		rowEnd: number,
		columnStart: number,
		columnEnd: number
	) => `column:${ section }:${ rowStart }-${ rowEnd }:${ columnStart }-${ columnEnd }`,
	getRfColumnOptionLabel: ( columnNumber: number, heading: string | null ) =>
		heading === null ? `${ columnNumber }列目` : `${ heading }（${ columnNumber }列目）`,
	getRfColumnTargetHelp: () => '対象列の左右へ移動',
	getRfColumnsLabel: () => '列',
	getRfKindLegend: () => '並び替え',
	getRfLeftLabel: () => '左',
	getRfNoOpMessage: () => '変更なし',
	getRfPositionLegend: () => '位置',
	getRfReorderName: () => 'フォームで並び替え',
	getRfRightLabel: () => '右',
	getRfRowMergedRangeMessage: (
		rowStart: number,
		rowEnd: number,
		columnStart: number,
		columnEnd: number
	) => `row:${ rowStart }-${ rowEnd }:${ columnStart }-${ columnEnd }`,
	getRfRowRangeMessage: () => '行範囲',
	getRfRowsLabel: () => '行',
	getRfRowTargetHelp: () => '対象行の上下へ移動',
	getRfSelectColumnLabel: () => '列を選択',
	getRfSourceColumnLabel: () => '移動する列',
	getRfSourceRowLabel: () => '移動する行',
	getRfTargetColumnLabel: () => '移動先の列',
	getRfTargetRowLabel: () => '移動先の行',
	getRfUnavailableMessage: () => '利用不可',
} ) );

jest.mock( '@/reorder/reorder-form/responsibilities/interaction', () => ( {
	rfInteraction: {
		close: jest.fn(),
		requestApply: jest.fn(),
		selectKind: jest.fn(),
		updateColumnInput: jest.fn(),
		updateRowInput: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/wordpress/components/reorder-form-position', () => ( {
	clampReorderFormPosition: jest.fn(),
	useReorderFormPosition: () => ( {
		position: null,
		setPosition: jest.fn(),
	} ),
} ) );

describe( 'Reorder Form merged-cell result message', () => {
	beforeEach( () => {
		Object.defineProperty( window, 'visualViewport', {
			configurable: true,
			value: undefined,
		} );
		Object.defineProperty( window, 'innerWidth', {
			configurable: true,
			value: 1024,
		} );
		reorderFormCollapse.beginSession( 'table-a' );
	} );

	/**
	 * Row / Column RFの構造拒否結果を表示するとき、内部の0-based位置だけをPresentationで1-basedへ変換することを確認する。
	 *
	 * 事前条件:
	 * - Row結果は0〜1行・2〜3列、Column結果はfootの1〜2行・3〜4列を原因セルとして公開している。
	 * - どちらもRF Interaction上では`rejected`である。
	 *
	 * 操作:
	 * - 各状態でRF入力画面を表示する。
	 *
	 * 期待結果:
	 * - Row文言境界には1〜2行・3〜4列が渡される。
	 * - Column文言境界にはfootを保持したまま2〜3行・4〜5列が渡される。
	 */
	it.each( [
		[
			'row',
			{
				status: 'open',
				kind: 'row',
				input: {
					sourceRowNumber: '1',
					targetRowNumber: '3',
					position: 'below',
				},
				rowCount: 4,
				result: {
					status: 'rejected',
					blockingMergedRange: {
						rowStart: 0,
						rowEnd: 1,
						columnStart: 2,
						columnEnd: 3,
					},
				},
				canApply: false,
			} as RfInteractionReactState,
			'row:1-2:3-4',
		],
		[
			'column',
			{
				status: 'open',
				kind: 'column',
				input: {
					sourceColumnIndex: 0,
					targetColumnIndex: 2,
					position: 'right',
				},
				columns: [
					{ columnIndex: 0, columnNumber: 1, heading: null },
					{ columnIndex: 1, columnNumber: 2, heading: null },
					{ columnIndex: 2, columnNumber: 3, heading: null },
				],
				result: {
					status: 'rejected',
					blockingMergedRange: {
						section: 'foot',
						rowStart: 1,
						rowEnd: 2,
						columnStart: 3,
						columnEnd: 4,
					},
				},
				canApply: false,
			} as RfInteractionReactState,
			'column:foot:2-3:4-5',
		],
	] )(
		'when a %s merged-cell rejection is shown, should pass user-facing 1-based positions to the message boundary',
		( _kind, state, expectedMessage ) => {
			const anchor = document.createElement( 'button' );

			const rendered = render(
				<ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" />
			);

			expect( screen.getByText( expectedMessage ) ).toBeTruthy();
			rendered.unmount();
		}
	);
} );
