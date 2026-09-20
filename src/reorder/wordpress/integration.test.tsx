/**
 * Reorder ModeとWordPress Editor接続境界のReact lifecycleを確認する。
 *
 * 内部hookやcomponentを直接公開せず、WordPress接続HOCから観測できるToolbar状態、編集開始抑止、
 * 操作対象変更時のLifecycleを通して振る舞いを検証する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { reorderMode } from '@/reorder/reorder-mode';
import {
	clearColumnDndLayoutAvailabilitySnapshot,
	updateColumnDndLayoutAvailabilitySnapshot,
} from '@/reorder/wordpress/column-dnd-layout-availability-state';
import { withReorderMode, withReorderModeBlockListBlock } from '@/reorder/wordpress/integration';

const mockColumnDndPointerDown = jest.fn();
type MockBlock = {
	attributes: Record< string, unknown >;
	clientId: string;
	innerBlocks: MockBlock[];
	isValid: boolean;
	name: string;
	originalContent: string;
};
type MockBlockEditorState = {
	blocks: Record< string, MockBlock >;
	selectedBlockClientId: string | null;
};

/* @wordpress/componentsのuuid / theme ESM境界だけをJestで読める決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'reorder-integration-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

/*
 * @wordpress/block-editorの公開入口はJest変換対象外のmarked ESMを経由するため、直接読み込めない。
 * Block Editor Store境界だけを必要な選択契約へ絞り、実@wordpress/dataへ登録して選択・更新経路を通す。
 * GutenbergのSlotFill配置先もJest DOMに存在しないため、BlockControlsの配置境界だけをDOM化する。
 */
jest.mock( '@wordpress/block-editor', () => {
	const { createReduxStore, register } = jest.requireActual( '@wordpress/data' );
	const store = createReduxStore( 'test/yamabiko-table-reorder-integration-block-editor', {
		reducer: (
			state: MockBlockEditorState = { blocks: {}, selectedBlockClientId: null },
			action:
				| { type: 'RESET_BLOCKS'; blocks: MockBlock[] }
				| { type: 'SELECT_BLOCK'; clientId: string | null }
		) => {
			if ( action.type === 'RESET_BLOCKS' ) {
				return {
					...state,
					blocks: Object.fromEntries( action.blocks.map( ( block ) => [ block.clientId, block ] ) ),
				};
			}

			if ( action.type === 'SELECT_BLOCK' ) {
				return { ...state, selectedBlockClientId: action.clientId };
			}

			return state;
		},
		actions: {
			clearSelectedBlock: () => ( { type: 'SELECT_BLOCK', clientId: null } ),
			resetBlocks: ( blocks: MockBlock[] ) => ( { type: 'RESET_BLOCKS', blocks } ),
			selectBlock: ( clientId: string ) => ( { type: 'SELECT_BLOCK', clientId } ),
		},
		selectors: {
			getBlock: ( state: MockBlockEditorState, clientId: string ) =>
				state.blocks[ clientId ] ?? null,
			getSelectedBlockClientId: ( state: MockBlockEditorState ) => state.selectedBlockClientId,
		},
	} );
	register( store );

	return {
		BlockControls: ( { children }: { children: React.ReactNode } ) => (
			<div data-testid="block-controls">{ children }</div>
		),
		store,
	};
} );

/* @wordpress/preferencesの公開入口がJest非対応のESMを経由するため、Store境界だけを最小化する。 */
jest.mock( '@wordpress/preferences', () => {
	const { createReduxStore, register } = jest.requireActual( '@wordpress/data' );
	const store = createReduxStore( 'test/yamabiko-table-reorder-integration-preferences', {
		reducer: (
			state: Record< string, Record< string, unknown > > = {},
			action: { type: string; scope?: string; key?: string; value?: unknown }
		) => {
			if ( action.type !== 'SET_PREFERENCE_VALUE' || ! action.scope || ! action.key ) {
				return state;
			}

			return {
				...state,
				[ action.scope ]: { ...state[ action.scope ], [ action.key ]: action.value },
			};
		},
		actions: {
			set: ( scope: string, key: string, value: unknown ) => ( {
				type: 'SET_PREFERENCE_VALUE',
				scope,
				key,
				value,
			} ),
		},
		selectors: {
			get: ( state: Record< string, Record< string, unknown > >, scope: string, key: string ) =>
				state[ scope ]?.[ key ],
		},
	} );
	register( store );

	return { store };
} );

/*
 * JSDOMには物理DnDとlayoutがないため、その入力境界だけを固定する。
 * Reorder Mode、WordPress Store、Toolbar、messages、guidanceは実実装を通す。
 */
jest.mock( '@/reorder/column-reorder/responsibilities/layout-availability', () => ( {
	resolveColumnDndLayoutAvailability: () => 'available',
} ) );

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
	} ) => children( mockColumnDndPointerDown ),
} ) );

type TableBlockEditProps = BlockEditProps< Record< string, unknown > > & {
	name: string;
};

type BlockListBlockProps = {
	clientId: string;
	isSelected: boolean;
	name: string;
	wrapperProps?: React.HTMLAttributes< HTMLDivElement >;
};

type ReactActGlobal = typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const setSelectedBlock = ( clientId: string | null, name?: string ) => {
	const blockEditor = dispatch( blockEditorStore );
	blockEditor.resetBlocks(
		clientId && name
			? [ { attributes: {}, clientId, innerBlocks: [], isValid: true, name, originalContent: '' } ]
			: []
	);

	if ( clientId ) {
		blockEditor.selectBlock( clientId );
	} else {
		blockEditor.clearSelectedBlock();
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
		updateColumnDndLayoutAvailabilitySnapshot( 'table-a', 'available' );
		dispatch( preferencesStore ).set(
			'yamabiko-table-reorder',
			'initialGuidanceAcknowledgedPc',
			true
		);
		mockColumnDndPointerDown.mockClear();
		reorderMode.notifyTableInactive( 'table-a' );
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => {
			reorderMode.notifyTableInactive( 'table-a' );
			root.unmount();
			clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );
		} );
		setSelectedBlock( null );
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
	 * - 並び替えモード中もDnD開始に必要なpointer入力を阻害せず、通常編集開始だけを抑止することを確認する。
	 *
	 * 事前条件:
	 * - Core Tableで行の並び替えモードが選択されている。
	 * - Block wrapperにはGutenberg既存のpointerdown handlerが存在する。
	 *
	 * 操作:
	 * - 選択中TableのBlock wrapperへpointerdownを送出した後、DnDが開始されない通常のmousedownを送出する。
	 *
	 * 期待結果:
	 * - pointerdownは既存handlerへ渡され、既定動作を抑止しない。
	 * - mousedownでは通常編集開始につながる既定動作を抑止する。
	 */
	it( 'when reorder mode is active, should allow pointer input while preventing normal editing start', () => {
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
					isSelected={ true }
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
		const mouseDown = new Event( 'mousedown', { bubbles: true, cancelable: true } );
		blockWrapper.dispatchEvent( mouseDown );

		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 1 );
		expect( pointerDown.defaultPrevented ).toBe( false );
		expect( mouseDown.defaultPrevented ).toBe( true );
	} );

	/**
	 * 概要:
	 * - 列のToolbar入口からColumn DnD開始入力までWordPress製品経路が接続されることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、並び替えモードは未選択である。
	 *
	 * 操作:
	 * - 列を並び替えるToolbar入口を選択し、選択中Tableへpointerdownを送出する。
	 *
	 * 期待結果:
	 * - Block wrapperからColumn DnD境界へ開始入力が通知される。
	 */
	it( 'when column toolbar entry is selected, should route pointer input to Column DnD', () => {
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
			getToolbarButton( container, 'Reorder columns' ).click();
		} );
		act( () => {
			root.render(
				<WrappedBlockListBlock clientId="table-a" isSelected={ true } name="core/table" />
			);
		} );

		const blockWrapper = container.querySelector< HTMLDivElement >(
			'[data-testid="block-wrapper"]'
		);
		if ( ! blockWrapper ) {
			throw new Error( 'Expected Gutenberg Block wrapper was not rendered.' );
		}
		blockWrapper.dispatchEvent( new Event( 'pointerdown', { bubbles: true, cancelable: true } ) );

		expect( mockColumnDndPointerDown ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - 非選択TableにはReorder Modeの編集抑止を接続しないことを確認する。
	 *
	 * 事前条件:
	 * - 別のCore Tableで行の並び替えモードが選択されている。
	 * - 表示対象のCore Tableは選択されていない。
	 *
	 * 操作:
	 * - 非選択TableのBlock wrapperへpointerdownを送出する。
	 *
	 * 期待結果:
	 * - Gutenberg既存handlerは呼ばれるが、Reorder Modeによる既定動作の抑止は追加されない。
	 */
	it( 'when a supported table is not selected, should leave its Block wrapper outside reorder editing guard', () => {
		const existingPointerDownCapture = jest.fn();
		reorderMode.select( 'row', 'table-a' );

		act( () => {
			root.render(
				<WrappedBlockListBlock
					clientId="table-b"
					isSelected={ false }
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
		expect( pointerDown.defaultPrevented ).toBe( false );
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
