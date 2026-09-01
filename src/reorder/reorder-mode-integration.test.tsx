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
		reorderModeIntegration.notifyTableInactive( 'table-a' );
		reorderModeIntegration.notifyTableInactive( 'table-b' );
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => {
			reorderModeIntegration.notifyTableInactive( 'table-a' );
			reorderModeIntegration.notifyTableInactive( 'table-b' );
			root.unmount();
		} );
		container.remove();
	} );

	/**
	 * 概要:
	 * - Toolbar操作によるReorder Modeの変更がReactの意味のある状態購読だけで再描画へ反映され、BlockEditへ独自wrapperを追加しないことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、行・列の並び替えモードはいずれも未選択である。
	 *
	 * 操作:
	 * - 行を並び替えるToolbar入口を選択する。
	 *
	 * 期待結果:
	 * - 行の並び替えモードだけが選択状態になる。
	 * - 行・列のToolbar入口へ専用SVGアイコンが表示される。
	 * - BlockEditの親要素として独自wrapperが追加されない。
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
	 * 概要:
	 * - 並び替えモード中はGutenberg既存のBlock wrapperへ編集開始抑止を追加し、既存handlerを維持したまま通常編集だけを抑止することを確認する。
	 *
	 * 事前条件:
	 * - Core Tableで行の並び替えモードが選択されている。
	 * - Gutenberg既存のBlock wrapperにpointerdownのcapture handlerが設定されている。
	 *
	 * 操作:
	 * - Block wrapperへpointerdownを送出した後、対象Tableが操作対象から外れたことを通知して再度pointerdownを送出する。
	 *
	 * 期待結果:
	 * - 並び替えモード中も既存capture handlerが呼ばれる。
	 * - 並び替えモード中の入力だけ通常編集の開始が抑止される。
	 * - 通常編集へ戻ると編集開始抑止が解除される。
	 */
	it( 'when reorder mode is active, should guard editing through existing Block wrapper props', () => {
		const editProps = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;
		const existingPointerDownCapture = jest.fn();

		renderTable( root, Wrapped, editProps );
		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );

		act( () => {
			root.render(
				<WrappedBlockListBlock
					clientId="table-a"
					name="core/table"
					wrapperProps={ {
						onPointerDownCapture: existingPointerDownCapture,
						title: 'table',
					} }
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
		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 1 );
		expect( pointerDown.defaultPrevented ).toBe( true );

		act( () => {
			reorderModeIntegration.notifyTableInactive( 'table-a' );
		} );

		const editablePointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		blockWrapper.dispatchEvent( editablePointerDown );
		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 2 );
		expect( editablePointerDown.defaultPrevented ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 並び替えモード中のTableから別Blockへ操作対象を移すと、通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、行の並び替えモードが選択されている。
	 *
	 * 操作:
	 * - 対象Tableを非選択状態として再描画する。
	 *
	 * 期待結果:
	 * - Toolbar入口が表示されなくなる。
	 * - 行の並び替えモードが終了する。
	 * - 対象Tableの通常編集が再び許可される。
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
		expect( reorderModeIntegration.getSelectedKind( 'table-a' ) ).toBe( 'row' );

		renderTable( root, Wrapped, unselectedTable );

		expect( container.querySelector( '[data-testid="block-controls"]' ) ).toBeNull();
		expect( reorderModeIntegration.getSelectedKind( 'table-a' ) ).toBeNull();
		expect( reorderModeIntegration.isEditingAllowed( 'table-a' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - 非対応BlockListBlockはReorder Modeの状態変更による再描画対象にならないことを確認する。
	 *
	 * 事前条件:
	 * - 非対応BlockがBlockListBlock filterを通過する。
	 *
	 * 操作:
	 * - 非対応Blockを描画した後、Table AのReorder Mode状態を変更する。
	 *
	 * 期待結果:
	 * - 非対応Blockは初回描画だけで、Reorder Mode状態変更による再描画を行わない。
	 */
	it( 'when BlockListBlock is unsupported, should not subscribe to reorder mode changes', () => {
		const renderCount = jest.fn();
		const UnsupportedBlockListBlock = ( props: BlockListBlockProps ) => {
			renderCount();
			return <div { ...props.wrapperProps }>Paragraph</div>;
		};
		const WrappedUnsupportedBlockListBlock =
			withReorderModeBlockListBlock( UnsupportedBlockListBlock );

		act( () => {
			root.render(
				<WrappedUnsupportedBlockListBlock clientId="paragraph-a" name="core/paragraph" />
			);
		} );
		expect( renderCount ).toHaveBeenCalledTimes( 1 );

		act( () => {
			reorderModeIntegration.select( 'row', 'table-a' );
		} );

		expect( renderCount ).toHaveBeenCalledTimes( 1 );
	} );
} );
