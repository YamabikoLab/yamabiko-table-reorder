/**
 * Reorder ModeとWordPress Editor接続境界のReact lifecycleを確認する。
 *
 * 内部hookやcomponentを直接公開せず、WordPress接続HOCから観測できるToolbar状態、編集開始抑止、
 * 操作対象変更時のLifecycleを通して振る舞いを検証する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { reorderModeIntegration } from '@/reorder/reorder-mode';
import {
	withReorderMode,
	withReorderModeBlockListBlock,
} from '@/reorder/wordpress/integration';

let mockSelectedBlockClientId: string | null = null;
const mockBlocks = new Map< string, { name: string } >();

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: ( { children }: { children: React.ReactNode } ) => (
		<div data-testid="block-controls">{ children }</div>
	),
	store: Symbol( 'block-editor-store' ),
} ) );

jest.mock( '@wordpress/data', () => ( {
	select: () => ( {
		getBlock: ( clientId: string ) => mockBlocks.get( clientId ) ?? null,
		getSelectedBlockClientId: () => mockSelectedBlockClientId,
	} ),
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

type ReactActGlobal = typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const setSelectedBlock = ( clientId: string | null, name?: string ) => {
	mockSelectedBlockClientId = clientId;
	mockBlocks.clear();

	if ( clientId && name ) {
		mockBlocks.set( clientId, { name } );
	}
};

const getToolbarButton = ( container: HTMLElement, label: string ) => {
	const button = container.querySelector< HTMLButtonElement >( `button[aria-label="${ label }"]` );

	if ( ! button ) {
		throw new Error( `Expected toolbar button was not rendered: ${ label }` );
	}

	return button;
};

describe( 'Reorder Mode WordPress integration', () => {
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
		reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	afterAll( () => {
		reactActGlobal.IS_REACT_ACT_ENVIRONMENT = previousReactActEnvironment;
	} );

	beforeEach( () => {
		setSelectedBlock( null );
		reorderModeIntegration.notifyTableInactive( 'table-a' );
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		setSelectedBlock( null );
		act( () => {
			reorderModeIntegration.notifyTableInactive( 'table-a' );
			root.unmount();
		} );
		container.remove();
	} );

	/**
	 * 概要:
	 * - Toolbar操作によるReorder Mode変更が描画へ反映され、BlockEditへ独自wrapperを追加しないことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、並び替えモードは未選択である。
	 *
	 * 操作:
	 * - 行を並び替えるToolbar入口を選択する。
	 *
	 * 期待結果:
	 * - 行のToolbar入口だけが選択状態になる。
	 * - BlockEditの親要素として独自wrapperが追加されない。
	 */
	it( 'when row toolbar entry is selected, should reflect row mode without adding a BlockEdit wrapper', () => {
		const props = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;
		setSelectedBlock( 'table-a', 'core/table' );

		act( () => {
			root.render( <Wrapped { ...props } /> );
		} );
		const rowButton = getToolbarButton( container, 'Reorder rows' );
		const columnButton = getToolbarButton( container, 'Reorder columns' );

		act( () => {
			rowButton.click();
		} );

		expect( rowButton.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( columnButton.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( container.querySelector( '[data-testid="table-edit"]' )?.parentElement ).toBe(
			container
		);
	} );

	/**
	 * 概要:
	 * - 並び替えモード中だけ、既存Block wrapper経由の通常編集開始が抑止されることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableで行の並び替えモードが選択されている。
	 *
	 * 操作:
	 * - Block wrapperへpointerdownを送出する。
	 *
	 * 期待結果:
	 * - Gutenberg既存handlerは呼ばれ、入力の既定動作だけが抑止される。
	 */
	it( 'when reorder mode is active, should guard editing through existing Block wrapper props', () => {
		const props = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;
		const existingPointerDownCapture = jest.fn();
		setSelectedBlock( 'table-a', 'core/table' );

		act( () => {
			root.render( <Wrapped { ...props } /> );
		} );
		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );
		act( () => {
			root.render(
				<WrappedBlockListBlock
					clientId="table-a"
					name="core/table"
					wrapperProps={ { onPointerDownCapture: existingPointerDownCapture } }
				/>
			);
		} );

		const blockWrapper = container.querySelector< HTMLDivElement >(
			'[data-testid="block-wrapper"]'
		);
		if ( ! blockWrapper ) {
			throw new Error( 'Expected Gutenberg Block wrapper was not rendered.' );
		}
		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		blockWrapper.dispatchEvent( pointerDown );

		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 1 );
		expect( pointerDown.defaultPrevented ).toBe( true );
	} );

	/**
	 * 概要:
	 * - 対象Tableが非選択状態を経由せず破棄された場合も、操作対象変更によって通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、行の並び替えモードが選択されている。
	 *
	 * 操作:
	 * - Editorの操作対象を非対応Blockへ移し、Table componentを直接unmountした後、同じTableを再表示する。
	 *
	 * 期待結果:
	 * - 再表示したTableのToolbar入口は未選択状態へ戻る。
	 */
	it( 'when the active reorder table unmounts after selection moves away, should return to edit mode', () => {
		const props = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;
		setSelectedBlock( 'table-a', 'core/table' );

		act( () => {
			root.render( <Wrapped { ...props } /> );
		} );
		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );
		setSelectedBlock( 'paragraph-a', 'core/paragraph' );
		act( () => {
			root.render( <div>Paragraph</div> );
		} );
		setSelectedBlock( 'table-a', 'core/table' );
		act( () => {
			root.render( <Wrapped { ...props } /> );
		} );

		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
	} );

	/**
	 * 概要:
	 * - 選択中Tableのcomponentだけが再生成された場合はReorder Modeを維持することを確認する。
	 *
	 * 事前条件:
	 * - Core TableがEditor上の操作対象のまま、行の並び替えモードが選択されている。
	 *
	 * 操作:
	 * - 同じTable Identityを選択したままcomponentを一度破棄し、再度描画する。
	 *
	 * 期待結果:
	 * - 再表示後も行のToolbar入口が選択状態を維持する。
	 */
	it( 'when the selected table component remounts, should preserve reorder mode', () => {
		const props = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;
		setSelectedBlock( 'table-a', 'core/table' );

		act( () => {
			root.render( <Wrapped { ...props } /> );
		} );
		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );
		act( () => {
			root.render( <div>Temporary</div> );
		} );
		act( () => {
			root.render( <Wrapped { ...props } /> );
		} );

		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'true'
		);
	} );
} );
