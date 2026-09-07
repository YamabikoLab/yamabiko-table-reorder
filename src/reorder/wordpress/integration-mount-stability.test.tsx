/**
 * WordPress Editorの対応Tableで選択状態が変化しても、既存Block subtreeのReact identityを維持することを確認する。
 *
 * 大規模Tableでは選択状態によるBlock subtreeの再生成が大きな描画遅延につながるため、
 * Reorder Mode接続境界は対応Tableの生存期間中に安定して維持される必要がある。
 */

import { render } from '@testing-library/react';
import { useEffect } from '@wordpress/element';

import { withReorderModeBlockListBlock } from '@/reorder/wordpress/integration';

jest.mock( '@/reorder/row-reorder/integration/dnd', () => ( {
	RowDnd: ( {
		children,
	}: {
		children: ( handler: React.PointerEventHandler< Element > ) => React.ReactNode;
	} ) => children( () => undefined ),
} ) );

type BlockListBlockProps = {
	clientId: string;
	isSelected: boolean;
	name: string;
	wrapperProps?: React.HTMLAttributes< HTMLDivElement >;
};

describe( 'Reorder Mode WordPress integration mount stability', () => {
	/**
	 * 対応Tableの選択切替で既存Block subtreeが再生成されないことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが未選択状態で表示されている。
	 *
	 * 操作:
	 * - 同じTableを選択状態へ変更し、その後再び未選択状態へ戻す。
	 *
	 * 期待結果:
	 * - Tableの既存Block subtreeは一度だけ生成され、選択切替では破棄されない。
	 */
	it( 'when a supported table selection changes, should preserve the existing block subtree mount', () => {
		let mountCount = 0;
		let unmountCount = 0;
		const BlockListBlock = ( props: BlockListBlockProps ) => {
			useEffect( () => {
				mountCount++;

				return () => {
					unmountCount++;
				};
			}, [] );

			return (
				<div data-testid="block-wrapper" { ...props.wrapperProps }>
					Block
				</div>
			);
		};
		const WrappedBlockListBlock = withReorderModeBlockListBlock( BlockListBlock );
		const { rerender } = render(
			<WrappedBlockListBlock clientId="table-a" isSelected={ false } name="core/table" />
		);

		rerender( <WrappedBlockListBlock clientId="table-a" isSelected name="core/table" /> );
		rerender( <WrappedBlockListBlock clientId="table-a" isSelected={ false } name="core/table" /> );

		expect( mountCount ).toBe( 1 );
		expect( unmountCount ).toBe( 0 );
	} );
} );
