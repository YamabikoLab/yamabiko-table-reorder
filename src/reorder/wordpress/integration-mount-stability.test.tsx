/**
 * WordPress Editorの対応Tableで選択状態が変化しても、既存Block subtreeのReact identityを維持することを確認する。
 *
 * 大規模Tableでは選択状態によるBlock subtreeの再生成が大きな描画遅延につながるため、
 * Reorder Mode接続境界は対応Tableの生存期間中に安定して維持される必要がある。
 */

import { render } from '@testing-library/react';
import { useEffect } from 'react';

import { withReorderModeBlockListBlock } from '@/reorder/wordpress/integration';

/* @wordpress/componentsのuuid / theme ESM境界だけをJestで読める決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'reorder-mount-stability-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

/*
 * @wordpress/block-editorの公開入口はJest変換対象外のmarked ESMを経由するため、直接読み込めない。
 * Store境界だけを実@wordpress/dataへ登録した最小Storeとし、未描画のSlotFill配置境界をDOM化する。
 */
jest.mock( '@wordpress/block-editor', () => {
	const { createReduxStore, register } = jest.requireActual( '@wordpress/data' );
	const store = createReduxStore( 'test/yamabiko-table-reorder-mount-stability-block-editor', {
		reducer: ( state = {} ) => state,
		actions: {},
		selectors: {
			getBlock: () => null,
			getSelectedBlockClientId: () => null,
		},
	} );
	register( store );

	return {
		BlockControls: ( { children }: { children: React.ReactNode } ) => <div>{ children }</div>,
		store,
	};
} );

/* @wordpress/preferencesの公開入口もJest非対応のESMを経由するため、Store境界だけを最小化する。 */
jest.mock( '@wordpress/preferences', () => {
	const { createReduxStore, register } = jest.requireActual( '@wordpress/data' );
	const store = createReduxStore( 'test/yamabiko-table-reorder-mount-stability-preferences', {
		reducer: ( state = {} ) => state,
		actions: { set: () => ( { type: 'NOOP' } ) },
		selectors: { get: () => true },
	} );
	register( store );

	return { store };
} );

/* JSDOMにない物理DnDとcell geometryの表示境界だけを、子要素を保持する接続へ置き換える。 */
jest.mock( '@/reorder/row-reorder/integration/dnd', () => ( {
	RowDnd: ( {
		children,
	}: {
		children: ( handler: React.PointerEventHandler< Element > ) => React.ReactNode;
	} ) => children( () => undefined ),
} ) );
jest.mock( '@/reorder/column-reorder/integration/dnd', () => ( {
	ColumnDnd: ( {
		children,
	}: {
		children: ( handler: React.PointerEventHandler< Element > ) => React.ReactNode;
	} ) => children( () => undefined ),
} ) );
jest.mock( '@/reorder/row-reorder/responsibilities/presentation/row-highlight', () => ( {
	RowHighlight: ( {
		children,
	}: {
		children: ( handler: React.PointerEventHandler< Element > ) => React.ReactNode;
	} ) => children( () => undefined ),
} ) );
jest.mock( '@/reorder/column-reorder/responsibilities/presentation/column-highlight', () => ( {
	ColumnHighlight: ( {
		children,
	}: {
		children: (
			pointerOver: React.PointerEventHandler< Element >,
			pointerOut: React.PointerEventHandler< Element >
		) => React.ReactNode;
	} ) =>
		children(
			() => undefined,
			() => undefined
		),
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
				<div
					id={ `block-${ props.clientId }` }
					data-testid="block-wrapper"
					{ ...props.wrapperProps }
				>
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
