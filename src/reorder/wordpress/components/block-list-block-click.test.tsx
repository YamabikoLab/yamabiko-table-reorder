/**
 * Reorder Mode中のTable Block wrapperで、既存click処理を維持しつつTable内容へのclick伝播だけを抑止する契約を確認する。
 */

import { act, fireEvent, render } from '@testing-library/react';
import type { MouseEventHandler, PointerEventHandler, ReactNode } from 'react';

import { reorderMode } from '@/reorder/reorder-mode';
import {
	ReorderModeBlockListBlock,
	type ReorderModeBlockListBlockProps,
} from '@/reorder/wordpress/components/block-list-block';
import { clearColumnDndLayoutAvailabilitySnapshot } from '@/reorder/wordpress/column-dnd-layout-availability-state';

jest.mock( '@/reorder/column-reorder/responsibilities/layout-availability', () => ( {
	resolveColumnDndLayoutAvailability: () => 'available',
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

let blockListBlockRenderCount = 0;

const BlockListBlock = ( props: ReorderModeBlockListBlockProps ) => {
	blockListBlockRenderCount += 1;
	const wrapperProps = props.wrapperProps ?? {};

	return (
		<div
			id={ `block-${ props.clientId }` }
			data-testid="block-wrapper"
			onClickCapture={ wrapperProps.onClickCapture as MouseEventHandler< HTMLDivElement > }
		>
			<table>
				<tbody>
					<tr>
						<td data-testid="table-cell">Table</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
};

describe( 'Reorder Mode Block wrapper click integration', () => {
	beforeEach( () => {
		reorderMode.notifyTableInactive( 'table-a' );
		clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );
		blockListBlockRenderCount = 0;
	} );

	/**
	 * 既存Block wrapperのclick処理を維持したまま、Reorder Mode中だけTable内容へのclick伝播を停止できることを確認する。
	 *
	 * 事前条件:
	 * - Gutenbergまたは他のfilter由来の既存capture handlerが設定されている。
	 * - Table内容には通常編集用のclick handlerが存在する。
	 *
	 * 操作:
	 * - 通常編集、行並び替え、列並び替え、再度通常編集の順で同じTableセルをclickする。
	 *
	 * 期待結果:
	 * - 既存capture handlerは各clickで1回ずつ呼ばれる。
	 * - Row / Column Reorder Mode中はTable内容のclick handlerへ到達しない。
	 * - 通常編集へ戻すと、BlockListBlockを再描画せずTable内容へ再びclickが届く。
	 */
	it( 'when table cells are clicked across mode changes, should preserve the existing capture handler and suppress descendants only while reordering', () => {
		const existingClickCapture = jest.fn();
		const tableClick = jest.fn();
		const { container, getByTestId } = render(
			<ReorderModeBlockListBlock
				BlockListBlock={ BlockListBlock }
				blockProps={ {
					clientId: 'table-a',
					isSelected: true,
					name: 'core/table',
					wrapperProps: { onClickCapture: existingClickCapture },
				} }
			/>
		);
		container.addEventListener( 'click', tableClick );
		const tableCell = getByTestId( 'table-cell' );

		fireEvent.click( tableCell );
		expect( existingClickCapture ).toHaveBeenCalledTimes( 1 );
		expect( tableClick ).toHaveBeenCalledTimes( 1 );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		fireEvent.click( tableCell );
		expect( existingClickCapture ).toHaveBeenCalledTimes( 2 );
		expect( tableClick ).toHaveBeenCalledTimes( 1 );

		act( () => reorderMode.select( 'column', 'table-a' ) );
		fireEvent.click( tableCell );
		expect( existingClickCapture ).toHaveBeenCalledTimes( 3 );
		expect( tableClick ).toHaveBeenCalledTimes( 1 );

		act( () => reorderMode.select( 'column', 'table-a' ) );
		fireEvent.click( tableCell );
		expect( existingClickCapture ).toHaveBeenCalledTimes( 4 );
		expect( tableClick ).toHaveBeenCalledTimes( 2 );
		expect( blockListBlockRenderCount ).toBe( 1 );
	} );
} );
