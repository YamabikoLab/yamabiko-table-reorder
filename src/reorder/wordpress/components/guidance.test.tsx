/**
 * Reorder Guidanceの表示コンポーネントが、初回案内の利用者向け内容と終了操作を提供することを確認する。
 */

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { ReorderGuidance } from '@/reorder/wordpress/components/guidance';

jest.mock( '@/messages', () => ( {
	getCloseReorderGuidanceLabel: () => 'Close reorder guidance',
	getReorderGuidanceMessage: () => 'Reorder rows and columns.',
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
	Popover: ( { children }: { children: ReactNode } ) => <div>{ children }</div>,
} ) );

describe( 'Reorder Guidance presentation', () => {
	/**
	 * 概要:
	 * - 初回案内表示中に共通案内文と閉じる入口を利用できることを確認する。
	 *
	 * 事前条件:
	 * - 初回案内は表示対象であり、ツールバー上の配置基準を取得済みである。
	 *
	 * 操作:
	 * - 初回案内を描画し、閉じる入口を選択する。
	 *
	 * 期待結果:
	 * - 行・列共通の案内文が表示され、閉じる操作が通知される。
	 */
	it( 'when guidance is visible, should present the common message and allow dismissal', () => {
		const onDismiss = jest.fn();
		const anchor = document.createElement( 'button' );
		render( <ReorderGuidance anchor={ anchor } isVisible onDismiss={ onDismiss } /> );

		expect( screen.getByText( 'Reorder rows and columns.' ) ).not.toBeNull();

		fireEvent.click( screen.getByRole( 'button', { name: 'Close reorder guidance' } ) );

		expect( onDismiss ).toHaveBeenCalledTimes( 1 );
	} );
} );
