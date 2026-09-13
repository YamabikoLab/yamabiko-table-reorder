/**
 * Reorder Mode中のTable Block wrapperに対するWordPress Editor接続契約を確認する。
 *
 * Reorder Mode変更をGutenberg本来のBlockListBlock再renderへ伝播させず、YTR専用DOM状態と安定した入力境界だけを現在modeへ同期することを検証する。
 */

import { act, render } from '@testing-library/react';
import type {
	DragEventHandler,
	MouseEventHandler,
	PointerEventHandler,
	ReactNode,
	Ref,
} from 'react';

import { reorderMode } from '@/reorder/reorder-mode';
import {
	ReorderModeBlockListBlock,
	type ReorderModeBlockListBlockProps,
} from '@/reorder/wordpress/components/block-list-block';

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
			ref={ wrapperProps.ref as Ref< HTMLDivElement > | undefined }
			data-testid="block-wrapper"
			draggable={ wrapperProps.draggable as boolean | undefined }
			onMouseDownCapture={ wrapperProps.onMouseDownCapture as MouseEventHandler< HTMLDivElement > }
			onDragStartCapture={ wrapperProps.onDragStartCapture as DragEventHandler< HTMLDivElement > }
		>
			Table
		</div>
	);
};

const renderBlockListBlock = ( existingWrapperRef?: Ref< HTMLDivElement > ) => (
	<ReorderModeBlockListBlock
		BlockListBlock={ BlockListBlock }
		blockProps={ {
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			wrapperProps: {
				draggable: true,
				ref: existingWrapperRef,
			},
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
		expect( blockWrapper ).not.toHaveAttribute( 'data-yamabiko-table-reorder-mode' );
		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'true' );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( blockWrapper ).toHaveAttribute( 'data-yamabiko-table-reorder-mode', 'row' );
		expect( blockListBlockRenderCount ).toBe( 1 );
		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'true' );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( blockWrapper ).not.toHaveAttribute( 'data-yamabiko-table-reorder-mode' );
		expect( blockListBlockRenderCount ).toBe( 1 );

		act( () => reorderMode.select( 'column', 'table-a' ) );
		expect( blockWrapper ).toHaveAttribute( 'data-yamabiko-table-reorder-mode', 'column' );
		expect( blockListBlockRenderCount ).toBe( 1 );

		act( () => reorderMode.select( 'column', 'table-a' ) );
		expect( blockWrapper ).not.toHaveAttribute( 'data-yamabiko-table-reorder-mode' );
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
	 * Gutenbergがwrapper要素を再接続した場合も既存refを維持しながら現在modeを新しいwrapperへ同期できることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモードが有効である。
	 * - Gutenberg側の既存wrapper refが設定されている。
	 *
	 * 操作:
	 * - BlockListBlockを再描画してwrapperを再接続する。
	 *
	 * 期待結果:
	 * - 新しいwrapperにも現在のrow mode属性が同期される。
	 * - Gutenberg側の既存refも新しいwrapperを受け取る。
	 */
	it( 'when Gutenberg reconnects the wrapper, should resynchronize current mode and preserve the existing ref', () => {
		const existingRef = jest.fn();
		act( () => reorderMode.select( 'row', 'table-a' ) );
		const { getByTestId, rerender } = render( renderBlockListBlock( existingRef ) );

		expect( getByTestId( 'block-wrapper' ) ).toHaveAttribute(
			'data-yamabiko-table-reorder-mode',
			'row'
		);
		expect( existingRef ).toHaveBeenCalledWith( getByTestId( 'block-wrapper' ) );

		rerender( renderBlockListBlock( existingRef ) );

		expect( getByTestId( 'block-wrapper' ) ).toHaveAttribute(
			'data-yamabiko-table-reorder-mode',
			'row'
		);
		expect( existingRef ).toHaveBeenLastCalledWith( getByTestId( 'block-wrapper' ) );
	} );
} );
