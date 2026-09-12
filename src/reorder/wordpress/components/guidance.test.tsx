/**
 * Reorder Guidanceの表示コンポーネントが、操作環境に応じた初回案内と終了条件を提供することを確認する。
 */

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { ReorderGuidance } from '@/reorder/wordpress/components/guidance';

jest.mock( '@/messages', () => ( {
	getCloseReorderGuidanceLabel: () => 'Close reorder guidance',
	getPcReorderGuidanceMessage: () => 'Reorder rows and columns.',
	getTouchReorderGuidanceMessage: () =>
		'Long press a cell, then drag to reorder rows and columns.',
} ) );

jest.mock( '@wordpress/components', () => ( {
	Button: ( {
		children,
		label,
		onClick,
	}: {
		children: ReactNode;
		label: string;
		onClick: () => void;
	} ) => (
		<button aria-label={ label } onClick={ onClick } type="button">
			{ children }
		</button>
	),
	Popover: ( {
		children,
		onClose,
		onFocusOutside,
	}: {
		children: ReactNode;
		onClose: () => void;
		onFocusOutside?: () => void;
	} ) => (
		<div>
			<button onClick={ onFocusOutside } type="button">
				Move focus outside
			</button>
			<button onClick={ onClose } type="button">
				Close popover
			</button>
			{ children }
		</div>
	),
} ) );

describe( 'Reorder Guidance presentation', () => {
	/**
	 * 概要:
	 * - PC環境の初回案内で通常の行・列案内と閉じる入口を利用できることを確認する。
	 *
	 * 事前条件:
	 * - PC環境の初回案内が表示対象であり、ツールバー上の配置基準を取得済みである。
	 *
	 * 操作:
	 * - 初回案内を描画し、閉じる入口を選択する。
	 *
	 * 期待結果:
	 * - PC向け案内文が表示され、閉じる操作が通知される。
	 */
	it( 'when PC guidance is rendered, should present the PC message and allow dismissal', () => {
		const onDismiss = jest.fn();
		const anchor = document.createElement( 'button' );
		render( <ReorderGuidance anchor={ anchor } environment="pc" onDismiss={ onDismiss } /> );

		expect( screen.getByText( 'Reorder rows and columns.' ) ).not.toBeNull();

		fireEvent.click( screen.getByRole( 'button', { name: 'Close reorder guidance' } ) );

		expect( onDismiss ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - タッチ環境の初回案内で長押し操作を案内することを確認する。
	 *
	 * 事前条件:
	 * - タッチ環境の初回案内が表示対象であり、ツールバー上の配置基準を取得済みである。
	 *
	 * 操作:
	 * - 初回案内を描画する。
	 *
	 * 期待結果:
	 * - 長押ししてからドラッグするタッチ向け案内文が表示される。
	 */
	it( 'when touch guidance is rendered, should present the long-press message', () => {
		const anchor = document.createElement( 'button' );
		render( <ReorderGuidance anchor={ anchor } environment="touch" onDismiss={ jest.fn() } /> );

		expect(
			screen.getByText( 'Long press a cell, then drag to reorder rows and columns.' )
		).not.toBeNull();
	} );

	/**
	 * 概要:
	 * - 通常のセル編集やTable内のfocus移動では初回案内を表示済みにしないことを確認する。
	 *
	 * 事前条件:
	 * - 初回案内が表示されている。
	 *
	 * 操作:
	 * - Popover外へfocusが移動した状態を通知する。
	 *
	 * 期待結果:
	 * - 初回案内を閉じる操作は通知されない。
	 */
	it( 'when focus moves outside the guidance, should keep the guidance active', () => {
		const onDismiss = jest.fn();
		const anchor = document.createElement( 'button' );
		render( <ReorderGuidance anchor={ anchor } environment="pc" onDismiss={ onDismiss } /> );

		fireEvent.click( screen.getByRole( 'button', { name: 'Move focus outside' } ) );

		expect( onDismiss ).not.toHaveBeenCalled();
	} );
} );
