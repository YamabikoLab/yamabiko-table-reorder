/**
 * Reorder ModeとWordPress Editor接続境界のReact lifecycleを確認する。
 *
 * 実Editorの描画詳細には依存せず、実際のReact購読とEffectを通して、Toolbar入口、通常編集との排他、
 * Block DOM構造、および操作対象が別Blockへ移った場合のLifecycleが描画へ反映されることを検証する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { reorderModeIntegration } from './reorder-mode';
import { withReorderMode, withReorderModeBlockListBlock } from './reorder-mode-integration';

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: ( { children }: { children: React.ReactNode } ) => (
		<div data-testid="block-controls">{ children }</div>
	),
} ) );

jest.mock( '@wordpress/components', () => ( {
	ToolbarButton: ( {
		icon,
		isPressed,
		label,
		onClick,
	}: {
		icon: React.ReactNode;
		isPressed: boolean;
		label: string;
		onClick: () => void;
	} ) => (
		<button aria-label={ label } aria-pressed={ isPressed } onClick={ onClick } type="button">
			{ icon }
			{ label }
		</button>
	),
	ToolbarGroup: ( { children }: { children: React.ReactNode } ) => (
		<div data-testid="toolbar-group">{ children }</div>
	),
} ) );

type TableBlockEditProps = BlockEditProps< Record< string, unknown > > & {
	name: string;
};

type BlockListBlockProps = {
	clientId: string;
	name: string;
	wrapperProps?: React.HTMLAttributes< HTMLDivElement >;
};

/** Reactの`act()`対象としてJest環境を明示できるglobal設定を表す。 */
type ReactActGlobal = typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * React rootへReorder Mode接続済みTableを描画する。
 *
 * @param root    テストで利用するReact root。
 * @param Wrapped Reorder Modeへ接続済みのBlockEdit component。
 * @param props   Gutenbergから渡されるTable Block props。
 */
const renderTable = (
	root: Root,
	Wrapped: ReturnType< typeof withReorderMode >,
	props: TableBlockEditProps
) => {
	act( () => {
		root.render( <Wrapped { ...props } /> );
	} );
};

/**
 * 指定されたToolbar入口を取得する。
 *
 * @param container React rootの描画先。
 * @param label     取得するToolbar入口の利用者向け名称。
 * @return 指定されたToolbar入口。
 */
const getToolbarButton = ( container: HTMLElement, label: string ) => {
	const button = container.querySelector< HTMLButtonElement >( `button[aria-label="${ label }"]` );

	if ( ! button ) {
		throw new Error( `Expected toolbar button was not rendered: ${ label }` );
	}

	return button;
};

describe( 'Reorder Mode integration', () => {
	const BlockEdit = () => <div data-testid="table-edit">Table</div>;
	const Wrapped = withReorderMode( BlockEdit );
	const BlockListBlock = ( props: BlockListBlockProps ) => (
		<div data-testid="block-wrapper" { ...props.wrapperProps }>
			Block
		</div>
	);
	const WrappedBlockListBlock = withReorderModeBlockListBlock( BlockListBlock );
	const reactActGlobal = globalThis as ReactActGlobal;
	const previousReactActEnvironment = reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
	let container: HTMLDivElement;
	let root: Root;

	beforeAll( () => {
		/*
		 * 実React lifecycleを検証するテストとして、`act()`による更新管理を有効にする。
		 */
		reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	afterAll( () => {
		reactActGlobal.IS_REACT_ACT_ENVIRONMENT = previousReactActEnvironment;
	} );

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => {
			reorderModeIntegration.exit();
			root.unmount();
		} );
		container.remove();
	} );

	/**
	 * Toolbar操作によるReorder Modeの変更がReactの購読通知だけで再描画へ反映され、BlockEditへ独自wrapperを追加しないことを確認する。
	 */
	it( 'when row toolbar entry is selected, should rerender without adding a BlockEdit wrapper', () => {
		const props = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;

		renderTable( root, Wrapped, props );

		const rowButton = getToolbarButton( container, 'Reorder rows' );
		const columnButton = getToolbarButton( container, 'Reorder columns' );
		expect( rowButton.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( columnButton.getAttribute( 'aria-pressed' ) ).toBe( 'false' );

		act( () => {
			rowButton.click();
		} );

		expect( rowButton.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( columnButton.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( rowButton.querySelector( 'svg' ) ).not.toBeNull();
		expect( columnButton.querySelector( 'svg' ) ).not.toBeNull();
		expect( container.querySelector( '[data-testid="table-edit"]' )?.parentElement ).toBe(
			container
		);
	} );

	/**
	 * 並び替えモード中はGutenberg既存のBlock wrapperへだけ編集開始抑止を追加し、通常編集へ戻ると解除することを確認する。
	 */
	it( 'when reorder mode is active, should guard editing through existing Block wrapper props', () => {
		const editProps = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;

		renderTable( root, Wrapped, editProps );
		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );

		act( () => {
			root.render(
				<WrappedBlockListBlock
					clientId="table-a"
					name="core/table"
					wrapperProps={ { title: 'table' } }
				/>
			);
		} );

		const blockWrapper = container.querySelector< HTMLDivElement >(
			'[data-testid="block-wrapper"]'
		);
		if ( ! blockWrapper ) {
			throw new Error( 'Expected Gutenberg Block wrapper was not rendered.' );
		}

		expect( blockWrapper.getAttribute( 'title' ) ).toBe( 'table' );
		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		blockWrapper.dispatchEvent( pointerDown );
		expect( pointerDown.defaultPrevented ).toBe( true );

		act( () => {
			reorderModeIntegration.exit();
		} );

		const editablePointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		blockWrapper.dispatchEvent( editablePointerDown );
		expect( editablePointerDown.defaultPrevented ).toBe( false );
	} );

	/**
	 * 並び替えモード中のTableから別Blockへ操作対象を移すと、通常編集へ戻ることを確認する。
	 */
	it( 'when the active reorder table loses selection, should return to edit mode', () => {
		const selectedTable = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;
		const unselectedTable = {
			...selectedTable,
			isSelected: false,
		};

		renderTable( root, Wrapped, selectedTable );
		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );
		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( true );

		renderTable( root, Wrapped, unselectedTable );

		expect( container.querySelector( '[data-testid="block-controls"]' ) ).toBeNull();
		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( false );
		expect( reorderModeIntegration.isEditingAllowed( 'table-a' ) ).toBe( true );
	} );
} );
