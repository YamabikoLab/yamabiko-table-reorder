/**
 * Reorder Mode中のTable Block wrapperに対するWordPress Editor接続契約を確認する。
 *
 * 行・列の並び替え中はTable Block自体のDnDを無効化し、通常編集へ戻った時は
 * Gutenberg本来のBlock DnD可否を復元することを検証する。
 */

import { render } from '@testing-library/react';
import type { PointerEventHandler, ReactNode } from 'react';

import {
	ReorderModeBlockListBlock,
	type ReorderModeBlockListBlockProps,
} from '@/reorder/wordpress/components/block-list-block';

let mockSelectedKind: 'row' | 'column' | null = null;

jest.mock( '@/reorder/reorder-mode-react', () => ( {
	useReorderMode: () => ( {
		selectedKind: mockSelectedKind,
		select: jest.fn(),
	} ),
} ) );

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

const BlockListBlock = ( props: ReorderModeBlockListBlockProps ) => {
	const draggable = props.wrapperProps?.draggable;
	const blockDraggable = typeof draggable === 'boolean' ? draggable : undefined;

	return (
		<div data-testid="block-wrapper" draggable={ blockDraggable }>
			Table
		</div>
	);
};

const renderBlockListBlock = () => (
	<ReorderModeBlockListBlock
		BlockListBlock={ BlockListBlock }
		blockProps={ {
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			wrapperProps: { draggable: true },
		} }
	/>
);

describe( 'Reorder Mode Block wrapper drag availability', () => {
	beforeEach( () => {
		mockSelectedKind = null;
	} );

	/**
	 * 行・列の並び替え中だけTable Block自体のDnDを無効化し、通常編集では既存設定を維持することを確認する。
	 *
	 * 事前条件:
	 * - Gutenberg側でTable Block自体のDnDが有効である。
	 * - Tableは通常編集状態である。
	 *
	 * 操作:
	 * - 通常編集から行並び替え、列並び替えへ順に切り替える。
	 * - 最後に通常編集へ戻す。
	 *
	 * 期待結果:
	 * - 通常編集ではTable Block自体のDnDが有効なまま維持される。
	 * - 行・列いずれの並び替え中もTable Block自体のDnDが無効になる。
	 * - 通常編集へ戻るとGutenberg本来のDnD可否へ復元される。
	 */
	it( 'when reorder mode changes between edit, row, and column, should disable only the Table Block drag while reordering', () => {
		const { getByTestId, rerender } = render( renderBlockListBlock() );
		const blockWrapper = getByTestId( 'block-wrapper' );

		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'true' );

		mockSelectedKind = 'row';
		rerender( renderBlockListBlock() );
		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'false' );

		mockSelectedKind = 'column';
		rerender( renderBlockListBlock() );
		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'false' );

		mockSelectedKind = null;
		rerender( renderBlockListBlock() );
		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'true' );
	} );
} );
