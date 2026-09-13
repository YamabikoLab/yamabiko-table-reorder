/**
 * Reorder Form（RF）の列選択肢がColumn Table Integrationから受け取った見出しと列番号を利用者向け表示へ反映することを確認する。
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { RfInteractionReactState } from '@/reorder/reorder-form/responsibilities/interaction-react';

import { ReorderFormPopover } from './reorder-form';

jest.mock( '@wordpress/components', () => ( {
	Button: ( props: { children: ReactNode; disabled?: boolean; onClick?: () => void } ) => (
		<button disabled={ props.disabled } onClick={ props.onClick } type="button">
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
	getRfColumnMergedRangeMessage: () => '列結合',
	getRfColumnOptionLabel: ( columnNumber: number, heading: string | null ) => {
		const label =
			heading === null ? `${ columnNumber }列目` : `${ heading }（${ columnNumber }列目）`;
		return label;
	},
	getRfColumnTargetHelp: () => '対象列の左右へ移動',
	getRfColumnsLabel: () => '列',
	getRfKindLegend: () => '並び替え',
	getRfLeftLabel: () => '左',
	getRfNoOpMessage: () => '変更なし',
	getRfPositionLegend: () => '位置',
	getRfReorderName: () => 'フォームで並び替え',
	getRfRightLabel: () => '右',
	getRfRowMergedRangeMessage: () => '行結合',
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

describe( 'Reorder Form presentation', () => {
	/**
	 * Column Table Integrationから見出し付き列記述を受け取った場合、列番号と組み合わせた選択肢を表示することを確認する。
	 *
	 * 事前条件:
	 * - RFはColumn入力を表示している。
	 * - 現在列には見出し付きの1列目と、見出しなしの2列目がある。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - 移動元・移動先の両方で、1列目は「商品名（1列目）」と表示される。
	 * - 見出しのない2列目は列番号だけで表示される。
	 */
	it( 'when column descriptors include a heading, should show the heading together with the column number', () => {
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'column',
			input: {
				sourceColumnIndex: null,
				targetColumnIndex: null,
				position: null,
			},
			columns: [
				{ columnIndex: 0, columnNumber: 1, heading: '商品名' },
				{ columnIndex: 1, columnNumber: 2, heading: null },
			],
			result: { status: 'not-ready' },
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		expect( screen.getAllByRole( 'option', { name: '商品名（1列目）' } ) ).toHaveLength( 2 );
		expect( screen.getAllByRole( 'option', { name: '2列目' } ) ).toHaveLength( 2 );
	} );
} );
