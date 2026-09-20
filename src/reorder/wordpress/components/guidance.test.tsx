/**
 * Reorder Guidanceの表示コンポーネントが、操作環境に応じた初回案内と終了条件を提供することを確認する。
 */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ReorderGuidance } from '@/reorder/wordpress/components/guidance';

/*
 * @wordpress/componentsが依存するuuidのESM配布物は現在のJest変換対象外である。
 * UUID生成だけを決定値へ置き換え、WordPress ComponentsとYTR messagesは実実装を描画する。
 */
jest.mock( 'uuid', () => ( { v4: () => 'reorder-guidance-test-uuid' } ) );

/* @wordpress/themeもESM専用配布のため、Componentsが要求するProvider境界だけをJest用DOMへ接続する。 */
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

describe( 'Reorder Guidance presentation', () => {
	/**
	 * 概要:
	 * - PC環境の初回案内でドラッグとフォームの並び替え方法、および閉じる入口を利用できることを確認する。
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
	it( 'when PC guidance is rendered, should present the PC message and allow dismissal', async () => {
		const onDismiss = jest.fn();
		const anchor = document.createElement( 'button' );
		render( <ReorderGuidance anchor={ anchor } environment="pc" onDismiss={ onDismiss } /> );
		await act( async () => undefined );

		expect(
			screen.getByText( 'Reorder rows and columns by dragging or using the form.' )
		).not.toBeNull();

		fireEvent.click( screen.getByRole( 'button', { name: 'Close reorder guidance' } ) );

		expect( onDismiss ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - タッチ環境の初回案内で長押しDnDとフォームの並び替え方法を案内することを確認する。
	 *
	 * 事前条件:
	 * - タッチ環境の初回案内が表示対象であり、ツールバー上の配置基準を取得済みである。
	 *
	 * 操作:
	 * - 初回案内を描画する。
	 *
	 * 期待結果:
	 * - 長押ししてからドラッグする方法とフォームを利用する方法を含むタッチ向け案内文が表示される。
	 */
	it( 'when touch guidance is rendered, should present the long-press message', async () => {
		const anchor = document.createElement( 'button' );
		render( <ReorderGuidance anchor={ anchor } environment="touch" onDismiss={ jest.fn() } /> );
		await act( async () => undefined );

		expect(
			screen.getByText(
				'Long press a cell, then drag, or use the form to reorder rows and columns.'
			)
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
	it( 'when focus moves outside the guidance, should keep the guidance active', async () => {
		const onDismiss = jest.fn();
		const anchor = document.createElement( 'button' );
		const outside = document.createElement( 'button' );
		document.body.appendChild( outside );
		render( <ReorderGuidance anchor={ anchor } environment="pc" onDismiss={ onDismiss } /> );
		await act( async () => undefined );

		fireEvent.focus( outside );

		expect( onDismiss ).not.toHaveBeenCalled();
		outside.remove();
	} );
} );
