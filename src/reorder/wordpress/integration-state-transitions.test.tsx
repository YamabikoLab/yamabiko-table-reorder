/**
 * Reorder ModeとWordPress Editor接続境界の主要な状態遷移を確認する。
 *
 * 非公開hookやcomponentをテスト都合で公開せず、WordPress接続HOCから観測できるToolbar状態、
 * 編集開始抑止、操作対象変更時のLifecycleを通して主要な分岐を検証する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { reorderMode } from '@/reorder/reorder-mode';
import { withReorderMode, withReorderModeBlockListBlock } from '@/reorder/wordpress/integration';

let mockSelectedBlockClientId: string | null = null;
const mockBlocks = new Map< string, { name: string } >();

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: ( { children }: { children: React.ReactNode } ) => (
		<div data-testid="block-controls">{ children }</div>
	),
	store: Symbol( 'block-editor-store' ),
} ) );

jest.mock( '@wordpress/preferences', () => ( {
	store: 'preferences-store',
} ) );

jest.mock( '@wordpress/data', () => ( {
	select: ( store: unknown ) => {
		if ( store === 'preferences-store' ) {
			return {
				get: () => true,
			};
		}
		return {
			getBlock: ( clientId: string ) => mockBlocks.get( clientId ) ?? null,
			getSelectedBlockClientId: () => mockSelectedBlockClientId,
		};
	},
	dispatch: () => ( {
		set: jest.fn(),
	} ),
} ) );

jest.mock( '@wordpress/components', () => {
	const react = jest.requireActual( 'react' ) as typeof import('react');
	return {
		ToolbarButton: react.forwardRef<
			HTMLButtonElement,
			{
				icon: React.ReactNode;
				isPressed: boolean;
				label: string;
				onClick: () => void;
			}
		>( ( { icon, isPressed, label, onClick }, ref ) => (
			<button
				ref={ ref }
				aria-label={ label }
				aria-pressed={ isPressed }
				onClick={ onClick }
				type="button"
			>
				{ icon }
				{ label }
			</button>
		) ),
		ToolbarGroup: ( { children }: { children: React.ReactNode } ) => (
			<div data-testid="toolbar-group">{ children }</div>
		),
	};
} );

jest.mock( '@/reorder/row-reorder/dnd', () => ( {
	RowDnd: ( {
		children,
	}: {
		children: ( handler: React.PointerEventHandler< Element > ) => React.ReactNode;
	} ) => children( () => undefined ),
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

const RESET_TABLE_IDENTITY = '__reorder-mode-test-reset__';

const resetReorderMode = () => {
	reorderMode.observeTable( RESET_TABLE_IDENTITY );
	reorderMode.notifyTableInactive( RESET_TABLE_IDENTITY );
};

const setSelectedBlock = ( clientId: string | null, name?: string ) => {
	mockSelectedBlockClientId = clientId;
	mockBlocks.clear();

	if ( clientId && name ) {
		mockBlocks.set( clientId, { name } );
	}
};

const createBlockEditProps = (
	clientId: string,
	isSelected: boolean,
	name = 'core/table'
): TableBlockEditProps =>
	( {
		attributes: {},
		clientId,
		isSelected,
		name,
		setAttributes: jest.fn(),
	} ) as unknown as TableBlockEditProps;

const getToolbarButton = ( container: HTMLElement, label: string ) => {
	const button = container.querySelector< HTMLButtonElement >( `button[aria-label="${ label }"]` );

	if ( ! button ) {
		throw new Error( `Expected toolbar button was not rendered: ${ label }` );
	}

	return button;
};

const getBlockWrapper = ( container: HTMLElement ) => {
	const blockWrapper = container.querySelector< HTMLDivElement >( '[data-testid="block-wrapper"]' );

	if ( ! blockWrapper ) {
		throw new Error( 'Expected Gutenberg Block wrapper was not rendered.' );
	}

	return blockWrapper;
};

describe( 'Reorder Mode WordPress integration state transitions', () => {
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
		resetReorderMode();
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		setSelectedBlock( null );
		act( () => {
			resetReorderMode();
			root.unmount();
		} );
		container.remove();
	} );

	/**
	 * 概要:
	 * - 行・列Toolbar入口が排他的に切り替わり、選択中の入口を再選択すると通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、並び替えモードは未選択である。
	 *
	 * 操作:
	 * - 列、行、列の順に入口を切り替え、最後に選択中の列入口を再選択する。
	 *
	 * 期待結果:
	 * - 常に選択した方向だけが選択状態になる。
	 * - 選択中の列入口を再選択すると行・列とも未選択になる。
	 */
	it( 'when toolbar entries are selected, switched, and reselected, should keep modes exclusive and return to edit mode', () => {
		const props = createBlockEditProps( 'table-a', true );
		setSelectedBlock( 'table-a', 'core/table' );

		act( () => {
			root.render( <Wrapped { ...props } /> );
		} );

		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
		expect( getToolbarButton( container, 'Reorder columns' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);

		act( () => {
			getToolbarButton( container, 'Reorder columns' ).click();
		} );
		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
		expect( getToolbarButton( container, 'Reorder columns' ).getAttribute( 'aria-pressed' ) ).toBe(
			'true'
		);

		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );
		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'true'
		);
		expect( getToolbarButton( container, 'Reorder columns' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);

		act( () => {
			getToolbarButton( container, 'Reorder columns' ).click();
		} );
		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
		expect( getToolbarButton( container, 'Reorder columns' ).getAttribute( 'aria-pressed' ) ).toBe(
			'true'
		);

		act( () => {
			getToolbarButton( container, 'Reorder columns' ).click();
		} );
		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
		expect( getToolbarButton( container, 'Reorder columns' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
	} );

	/**
	 * 概要:
	 * - 選択中Tableの通常編集と並び替えモードの切替に合わせて、pointer入力と通常編集開始の扱いが切り替わることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、通常編集状態である。
	 * - Block wrapperにはGutenberg既存のpointerdown handlerが存在する。
	 *
	 * 操作:
	 * - 通常編集、行並び替え、通常編集の各状態でBlock wrapperへpointerdownを送出する。
	 * - 行並び替え中には、DnDが開始されない通常のmousedownも送出する。
	 *
	 * 期待結果:
	 * - pointerdownは各状態で既存handlerへ渡され、既定動作を抑止しない。
	 * - 行並び替え中のmousedownだけは通常編集開始につながる既定動作を抑止する。
	 */
	it( 'when selected table switches between edit and reorder mode, should keep pointer input available and guard normal editing only in reorder mode', () => {
		const props = createBlockEditProps( 'table-a', true );
		const existingPointerDownCapture = jest.fn();
		setSelectedBlock( 'table-a', 'core/table' );

		act( () => {
			root.render(
				<>
					<Wrapped { ...props } />
					<WrappedBlockListBlock
						clientId="table-a"
						isSelected={ true }
						name="core/table"
						wrapperProps={ { onPointerDownCapture: existingPointerDownCapture } }
					/>
				</>
			);
		} );

		const editPointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		getBlockWrapper( container ).dispatchEvent( editPointerDown );
		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 1 );
		expect( editPointerDown.defaultPrevented ).toBe( false );

		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );
		const reorderPointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		getBlockWrapper( container ).dispatchEvent( reorderPointerDown );
		const reorderMouseDown = new Event( 'mousedown', { bubbles: true, cancelable: true } );
		getBlockWrapper( container ).dispatchEvent( reorderMouseDown );
		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 2 );
		expect( reorderPointerDown.defaultPrevented ).toBe( false );
		expect( reorderMouseDown.defaultPrevented ).toBe( true );

		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );
		const restoredEditPointerDown = new Event( 'pointerdown', {
			bubbles: true,
			cancelable: true,
		} );
		getBlockWrapper( container ).dispatchEvent( restoredEditPointerDown );
		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 3 );
		expect( restoredEditPointerDown.defaultPrevented ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 同じTable componentを維持したまま非選択へ変化した場合に、Reorder Modeが通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、行並び替えモードが有効である。
	 *
	 * 操作:
	 * - componentを破棄せず`isSelected=false`で再描画し、その後同じTableを再選択する。
	 *
	 * 期待結果:
	 * - 非選択中はToolbarが消え、Block wrapperの通常編集開始は抑止されない。
	 * - 再選択時は通常編集状態から開始する。
	 */
	it( 'when selected table becomes unselected without unmounting, should return to edit mode and restore normal editing', () => {
		const selectedProps = createBlockEditProps( 'table-a', true );
		const unselectedProps = createBlockEditProps( 'table-a', false );
		const existingPointerDownCapture = jest.fn();
		setSelectedBlock( 'table-a', 'core/table' );

		act( () => {
			root.render(
				<>
					<Wrapped { ...selectedProps } />
					<WrappedBlockListBlock
						clientId="table-a"
						isSelected={ true }
						name="core/table"
						wrapperProps={ { onPointerDownCapture: existingPointerDownCapture } }
					/>
				</>
			);
		} );
		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );

		setSelectedBlock( null );
		act( () => {
			root.render(
				<>
					<Wrapped { ...unselectedProps } />
					<WrappedBlockListBlock
						clientId="table-a"
						isSelected={ false }
						name="core/table"
						wrapperProps={ { onPointerDownCapture: existingPointerDownCapture } }
					/>
				</>
			);
		} );

		expect( container.querySelector( 'button[aria-label="Reorder rows"]' ) ).toBeNull();
		expect( container.querySelector( 'button[aria-label="Reorder columns"]' ) ).toBeNull();
		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		getBlockWrapper( container ).dispatchEvent( pointerDown );
		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 1 );
		expect( pointerDown.defaultPrevented ).toBe( false );

		setSelectedBlock( 'table-a', 'core/table' );
		act( () => {
			root.render(
				<>
					<Wrapped { ...selectedProps } />
					<WrappedBlockListBlock
						clientId="table-a"
						isSelected={ true }
						name="core/table"
						wrapperProps={ { onPointerDownCapture: existingPointerDownCapture } }
					/>
				</>
			);
		} );
		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
		expect( getToolbarButton( container, 'Reorder columns' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
	} );

	/**
	 * 概要:
	 * - 操作対象が別の対応Tableへ移った場合に、前のTableのReorder Modeを引き継がないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えモードが有効である。
	 *
	 * 操作:
	 * - Editor上の操作対象をTable Bへ変更し、Table Bを選択状態で描画する。
	 *
	 * 期待結果:
	 * - Table AのReorder Modeは終了する。
	 * - Table Bは通常編集状態から開始し、行・列入口とも未選択である。
	 */
	it( 'when selection moves to another supported table, should end the previous reorder mode and start the new table in edit mode', () => {
		const tableAProps = createBlockEditProps( 'table-a', true );
		const tableBProps = createBlockEditProps( 'table-b', true );
		setSelectedBlock( 'table-a', 'core/table' );

		act( () => {
			root.render( <Wrapped { ...tableAProps } /> );
		} );
		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );

		setSelectedBlock( 'table-b', 'core/table' );
		act( () => {
			root.render( <Wrapped { ...tableBProps } /> );
		} );

		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
		expect( getToolbarButton( container, 'Reorder columns' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
	} );

	/**
	 * 概要:
	 * - 並び替え対象TableがEditorから直接削除された場合に、Reorder Modeが通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、行並び替えモードが有効である。
	 *
	 * 操作:
	 * - Editor上の選択対象をなくした状態でTable componentを破棄し、その後同じTableを再表示する。
	 *
	 * 期待結果:
	 * - 再表示したTableは通常編集状態から開始する。
	 */
	it( 'when active table is removed with no editor selection remaining, should return to edit mode', () => {
		const props = createBlockEditProps( 'table-a', true );
		setSelectedBlock( 'table-a', 'core/table' );

		act( () => {
			root.render( <Wrapped { ...props } /> );
		} );
		act( () => {
			getToolbarButton( container, 'Reorder rows' ).click();
		} );

		setSelectedBlock( null );
		act( () => {
			root.render( <div data-testid="empty-editor">Empty</div> );
		} );

		setSelectedBlock( 'table-a', 'core/table' );
		act( () => {
			root.render( <Wrapped { ...props } /> );
		} );
		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
		expect( getToolbarButton( container, 'Reorder columns' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
	} );

	/**
	 * 概要:
	 * - 非対応BlockがReorder ModeのToolbar接続と編集開始抑止の外にあることを確認する。
	 *
	 * 事前条件:
	 * - 別Tableでは行並び替えモードが有効である。
	 * - 現在表示するBlockは非対応Blockである。
	 *
	 * 操作:
	 * - 非対応BlockをBlockEdit HOCとBlockListBlock HOCの両方から描画し、Block wrapperへpointerdownを送出する。
	 *
	 * 期待結果:
	 * - Reorder Mode Toolbarは追加されない。
	 * - Gutenberg既存handlerは維持され、Reorder Modeによる既定動作の抑止は追加されない。
	 */
	it( 'when block is unsupported, should keep toolbar and editing guard outside the WordPress integration boundary', () => {
		const props = createBlockEditProps( 'paragraph-a', true, 'core/paragraph' );
		const existingPointerDownCapture = jest.fn();
		reorderMode.select( 'row', 'table-a' );
		setSelectedBlock( 'paragraph-a', 'core/paragraph' );

		act( () => {
			root.render(
				<>
					<Wrapped { ...props } />
					<WrappedBlockListBlock
						clientId="paragraph-a"
						isSelected={ true }
						name="core/paragraph"
						wrapperProps={ { onPointerDownCapture: existingPointerDownCapture } }
					/>
				</>
			);
		} );

		expect( container.querySelector( '[data-testid="block-controls"]' ) ).toBeNull();
		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		getBlockWrapper( container ).dispatchEvent( pointerDown );
		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 1 );
		expect( pointerDown.defaultPrevented ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 並び替えモード中もpointerdownを既存handlerへ渡し、DnD開始入力として利用可能なことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableで行並び替えモードが有効である。
	 * - Block wrapperにはGutenberg既存のpointerdown handlerが存在する。
	 *
	 * 操作:
	 * - pointerdownをBlock wrapperへ送出する。
	 *
	 * 期待結果:
	 * - 既存handlerが呼ばれる。
	 * - Reorder Modeはpointerdownの既定動作を抑止しない。
	 */
	it( 'when pointerdown occurs in reorder mode, should preserve the existing handler without preventing pointer input', () => {
		const existingPointerDownCapture = jest.fn();
		reorderMode.select( 'row', 'table-a' );

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

		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		getBlockWrapper( container ).dispatchEvent( pointerDown );
		expect( existingPointerDownCapture ).toHaveBeenCalledTimes( 1 );
		expect( pointerDown.defaultPrevented ).toBe( false );
	} );

	/**
	 * 概要:
	 * - 並び替えモード中の通常編集開始抑止が、通常編集につながる入力で既存handlerを維持することを確認する。
	 *
	 * 事前条件:
	 * - Core Tableで行並び替えモードが有効である。
	 * - 各入力に対応するGutenberg既存handlerが存在する。
	 *
	 * 操作:
	 * - mousedown、dblclickをそれぞれBlock wrapperへ送出する。
	 *
	 * 期待結果:
	 * - 各既存handlerが呼ばれたうえで、通常編集開始につながる既定動作が抑止される。
	 */
	it.each( [
		[ 'mousedown', 'onMouseDownCapture' ],
		[ 'dblclick', 'onDoubleClickCapture' ],
	] as const )(
		'when %s editing input occurs in reorder mode, should preserve the existing handler and prevent editing start',
		( eventName, handlerName ) => {
			const existingHandler = jest.fn();
			const wrapperProps = {
				[ handlerName ]: existingHandler,
			};
			reorderMode.select( 'row', 'table-a' );

			act( () => {
				root.render(
					<WrappedBlockListBlock
						clientId="table-a"
						isSelected={ true }
						name="core/table"
						wrapperProps={ wrapperProps }
					/>
				);
			} );

			const editingStart = new Event( eventName, { bubbles: true, cancelable: true } );
			getBlockWrapper( container ).dispatchEvent( editingStart );
			expect( existingHandler ).toHaveBeenCalledTimes( 1 );
			expect( editingStart.defaultPrevented ).toBe( true );
		}
	);

	/**
	 * 概要:
	 * - 既存handlerがないBlock wrapperでも、並び替えモード中の通常編集開始を安全に抑止できることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableで行並び替えモードが有効である。
	 * - Block wrapperには既存の編集開始handlerがない。
	 *
	 * 操作:
	 * - DnDが開始されない通常のmousedownをBlock wrapperへ送出する。
	 *
	 * 期待結果:
	 * - 例外を発生させず、通常編集開始につながる既定動作が抑止される。
	 */
	it( 'when no existing editing handler is present in reorder mode, should still prevent normal editing start', () => {
		reorderMode.select( 'row', 'table-a' );

		act( () => {
			root.render(
				<WrappedBlockListBlock clientId="table-a" isSelected={ true } name="core/table" />
			);
		} );

		const mouseDown = new Event( 'mousedown', { bubbles: true, cancelable: true } );
		getBlockWrapper( container ).dispatchEvent( mouseDown );
		expect( mouseDown.defaultPrevented ).toBe( true );
	} );
} );
