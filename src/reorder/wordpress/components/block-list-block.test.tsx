/**
 * Reorder Mode中のTable Block wrapperに対するWordPress Editor接続契約を確認する。
 *
 * Reorder Mode変更をGutenberg本来のBlockListBlock再renderへ伝播させず、YTR専用DOM状態と安定した入力境界だけを現在modeへ同期することを検証する。
 */

import { act, render, waitFor } from '@testing-library/react';
import type { DragEventHandler, MouseEventHandler, PointerEventHandler, ReactNode } from 'react';

import { reorderMode } from '@/reorder/reorder-mode';
import {
	ReorderModeBlockListBlock,
	type ReorderModeBlockListBlockProps,
} from '@/reorder/wordpress/components/block-list-block';
import { useState } from '@wordpress/element';

jest.mock( '@/reorder/row-reorder/responsibilities/presentation/row-highlight', () => ( {
	RowHighlight: ( {
		children,
	}: {
		children: ( handler: PointerEventHandler< Element > ) => ReactNode;
	} ) => children( () => undefined ),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/presentation/column-highlight', () => ( {
	ColumnHighlight: ( {
		children,
	}: {
		children: (
			overHandler: PointerEventHandler< Element >,
			outHandler: PointerEventHandler< Element >
		) => ReactNode;
	} ) =>
		children(
			() => undefined,
			() => undefined
		),
} ) );

jest.mock( '@/reorder/row-reorder/integration/dnd', () => ( {
	RowDnd: ( {
		children,
	}: {
		children: ( handler: PointerEventHandler< Element > ) => ReactNode;
	} ) => children( () => undefined ),
} ) );

jest.mock( '@/reorder/column-reorder/integration/dnd', () => ( {
	ColumnDnd: ( {
		children,
	}: {
		children: ( handler: PointerEventHandler< Element > ) => ReactNode;
	} ) => children( () => undefined ),
} ) );

let blockListBlockRenderCount = 0;

const BlockListBlock = ( props: ReorderModeBlockListBlockProps ) => {
	blockListBlockRenderCount += 1;
	const wrapperProps = props.wrapperProps ?? {};

	return (
		<div
			id={ `block-${ props.clientId }` }
			data-testid="block-wrapper"
			draggable={ wrapperProps.draggable as boolean | undefined }
			onMouseDownCapture={ wrapperProps.onMouseDownCapture as MouseEventHandler< HTMLDivElement > }
			onDragStartCapture={ wrapperProps.onDragStartCapture as DragEventHandler< HTMLDivElement > }
		>
			Table
		</div>
	);
};

const ReplacementBlockListBlock = ( props: ReorderModeBlockListBlockProps ) => {
	const wrapperProps = props.wrapperProps ?? {};

	return (
		<section
			id={ `block-${ props.clientId }` }
			data-testid="block-wrapper"
			draggable={ wrapperProps.draggable as boolean | undefined }
		>
			Table replacement
		</section>
	);
};

const StatefulBlockListBlock = ( props: ReorderModeBlockListBlockProps ) => {
	const [ replaced, setReplaced ] = useState( false );

	if ( replaced ) {
		return (
			<section id={ `block-${ props.clientId }` } data-testid="block-wrapper">
				Table replacement
			</section>
		);
	}

	return (
		<div id={ `block-${ props.clientId }` } data-testid="block-wrapper">
			<button type="button" onClick={ () => setReplaced( true ) }>
				Replace wrapper
			</button>
			Table
		</div>
	);
};

const renderBlockListBlock = (
	Component: typeof BlockListBlock | typeof ReplacementBlockListBlock = BlockListBlock
) => (
	<ReorderModeBlockListBlock
		BlockListBlock={ Component }
		blockProps={ {
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			wrapperProps: { draggable: true },
		} }
	/>
);

describe( 'Reorder Mode Block wrapper integration', () => {
	beforeEach( () => {
		reorderMode.notifyTableInactive( 'table-a' );
		blockListBlockRenderCount = 0;
	} );

	/**
	 * Reorder Mode変更がGutenberg本来のBlockListBlock描画へ伝播せず、YTR専用DOM状態だけを同期することを確認する。
	 *
	 * 事前条件:
	 * - Tableは通常編集状態で描画されている。
	 *
	 * 操作:
	 * - 行並び替えへ切り替え、通常編集へ戻す。
	 * - 列並び替えへ切り替え、通常編集へ戻す。
	 *
	 * 期待結果:
	 * - BlockListBlockのrender回数は増えない。
	 * - YTR専用mode属性だけがrow / columnへ同期され、通常編集では削除される。
	 * - Gutenberg由来のdraggable設定は書き換えられない。
	 */
	it( 'when reorder mode changes, should synchronize only YTR DOM state without rerendering BlockListBlock', () => {
		const { getByTestId } = render( renderBlockListBlock() );
		const blockWrapper = getByTestId( 'block-wrapper' );

		expect( blockListBlockRenderCount ).toBe( 1 );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBeNull();
		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'true' );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBe( 'row' );
		expect( blockListBlockRenderCount ).toBe( 1 );
		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'true' );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBeNull();
		expect( blockListBlockRenderCount ).toBe( 1 );

		act( () => reorderMode.select( 'column', 'table-a' ) );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBe( 'column' );
		expect( blockListBlockRenderCount ).toBe( 1 );

		act( () => reorderMode.select( 'column', 'table-a' ) );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBeNull();
		expect( blockListBlockRenderCount ).toBe( 1 );
	} );

	/**
	 * 安定したwrapper入力handlerが入力時点のReorder Modeを参照し、通常編集へ戻した後も同じReact描画のまま抑止状態を切り替えられることを確認する。
	 *
	 * 事前条件:
	 * - Gutenberg由来のTable Block DnD設定は有効である。
	 *
	 * 操作:
	 * - 通常編集、行並び替え、再度通常編集の順でmouse downとnative drag開始を発生させる。
	 *
	 * 期待結果:
	 * - 通常編集では入力の既定動作を妨げない。
	 * - 行並び替え中は通常編集開始とTable Block DnD開始を抑止する。
	 * - 通常編集へ戻すと再び既定動作を妨げない。
	 */
	it( 'when wrapper input is received across mode changes, should suppress editing and Block drag only while reordering', () => {
		const { getByTestId } = render( renderBlockListBlock() );
		const blockWrapper = getByTestId( 'block-wrapper' );
		const dispatchCancelable = ( type: string ) => {
			const event = new Event( type, { bubbles: true, cancelable: true } );
			blockWrapper.dispatchEvent( event );
			return event.defaultPrevented;
		};

		expect( dispatchCancelable( 'mousedown' ) ).toBe( false );
		expect( dispatchCancelable( 'dragstart' ) ).toBe( false );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( dispatchCancelable( 'mousedown' ) ).toBe( true );
		expect( dispatchCancelable( 'dragstart' ) ).toBe( true );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( dispatchCancelable( 'mousedown' ) ).toBe( false );
		expect( dispatchCancelable( 'dragstart' ) ).toBe( false );
	} );

	/**
	 * Gutenberg側の通常rerenderでwrapper DOMが置き換わった場合も、現在のReorder Modeを新しいwrapperへ同期できることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモードが有効である。
	 *
	 * 操作:
	 * - BlockListBlock実装を差し替えてwrapper DOMを再接続する。
	 *
	 * 期待結果:
	 * - 置き換え後のwrapperにも現在のrow mode属性が同期される。
	 */
	it( 'when Gutenberg reconnects the wrapper, should resynchronize the current mode to the new wrapper', () => {
		act( () => reorderMode.select( 'row', 'table-a' ) );
		const { getByTestId, rerender } = render( renderBlockListBlock() );

		expect(
			getByTestId( 'block-wrapper' ).getAttribute( 'data-yamabiko-table-reorder-mode' )
		).toBe( 'row' );

		rerender( renderBlockListBlock( ReplacementBlockListBlock ) );

		expect( getByTestId( 'block-wrapper' ).tagName ).toBe( 'SECTION' );
		expect(
			getByTestId( 'block-wrapper' ).getAttribute( 'data-yamabiko-table-reorder-mode' )
		).toBe( 'row' );
	} );

	/**
	 * BlockListBlock自身の更新だけでwrapper DOMが置き換わった場合も、現在のReorder Modeを新しいwrapperへ同期できることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモードが有効である。
	 * - ReorderModeBlockListBlockは再renderされない。
	 *
	 * 操作:
	 * - BlockListBlock自身のstate更新によってroot wrapper DOMを置き換える。
	 *
	 * 期待結果:
	 * - 置き換え後のwrapperにも現在のrow mode属性が同期される。
	 */
	it( 'when BlockListBlock replaces its wrapper without rerendering ReorderModeBlockListBlock, should resynchronize the current mode to the new wrapper', async () => {
		act( () => reorderMode.select( 'row', 'table-a' ) );

		const { getByTestId, getByRole } = render(
			<ReorderModeBlockListBlock
				BlockListBlock={ StatefulBlockListBlock }
				blockProps={ {
					clientId: 'table-a',
					isSelected: true,
					name: 'core/table',
					wrapperProps: { draggable: true },
				} }
			/>
		);

		const originalWrapper = getByTestId( 'block-wrapper' );

		expect( originalWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBe( 'row' );

		act( () => {
			getByRole( 'button', { name: 'Replace wrapper' } ).click();
		} );

		const replacedWrapper = getByTestId( 'block-wrapper' );

		expect( replacedWrapper ).not.toBe( originalWrapper );
		expect( replacedWrapper.tagName ).toBe( 'SECTION' );
		await waitFor( () => {
			expect( replacedWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBe( 'row' );
		} );
	} );
} );
