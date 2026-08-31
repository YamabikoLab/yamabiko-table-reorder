/**
 * Reorder ModeとWordPress Editor接続境界のReact lifecycleを確認する。
 *
 * 実Editorの描画詳細には依存せず、実際のReact購読とEffectを通して、Toolbar入口、通常編集との排他、
 * および操作対象が別Blockへ移った場合のLifecycleが描画へ反映されることを検証する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { reorderModeIntegration } from './reorder-mode';
import { withReorderMode } from './reorder-mode-integration';

let mockBlockControlsPortalContainer: HTMLDivElement;

jest.mock( '@wordpress/block-editor', () => {
	const { createPortal } = jest.requireActual< typeof import( 'react-dom' ) >( 'react-dom' );

	return {
		BlockControls: ( { children }: { children: React.ReactNode } ) =>
			createPortal(
				<div data-testid="block-controls">{ children }</div>,
				mockBlockControlsPortalContainer
			),
	};
} );

jest.mock( '@wordpress/components', () => ( {
	ToolbarButton: ( {
		isPressed,
		label,
		onClick,
	}: {
		isPressed: boolean;
		label: string;
		onClick: () => void;
	} ) => (
		<button aria-label={ label } aria-pressed={ isPressed } onClick={ onClick } type="button">
			{ label }
		</button>
	),
	ToolbarGroup: ( { children }: { children: React.ReactNode } ) => (
		<div data-testid="toolbar-group">{ children }</div>
	),
} ) );

jest.mock( '@wordpress/icons', () => ( {
	tableColumnAfter: 'table-column-after',
	tableRowAfter: 'table-row-after',
} ) );

type TableBlockEditProps = BlockEditProps< Record< string, unknown > > & {
	name: string;
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
 * @param container ToolbarがPortal描画される先。
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
		mockBlockControlsPortalContainer = document.createElement( 'div' );
		document.body.appendChild( container );
		document.body.appendChild( mockBlockControlsPortalContainer );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => {
			reorderModeIntegration.exit();
			root.unmount();
		} );
		container.remove();
		mockBlockControlsPortalContainer.remove();
	} );

	/**
	 * Toolbar操作によるReorder Modeの変更が、Reactの購読通知だけで再描画へ反映されることを確認する。
	 *
	 * 事前条件:
	 * - 対応Tableが選択され、Reorder Modeは通常編集で開始している。
	 * - Reorder Mode接続境界は実際のReact rootへmountされている。
	 *
	 * 操作:
	 * - 行入口を選択する。
	 *
	 * 期待結果:
	 * - componentを手動で再実行しなくても行入口が選択状態へ更新される。
	 * - 列入口は非選択のまま維持される。
	 * - 対象Tableの編集開始入力が抑止される。
	 */
	it( 'when row toolbar entry is selected, should rerender from the Reorder Mode subscription', () => {
		const props = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;

		renderTable( root, Wrapped, props );

		const rowButton = getToolbarButton( mockBlockControlsPortalContainer, 'Reorder rows' );
		const columnButton = getToolbarButton( mockBlockControlsPortalContainer, 'Reorder columns' );
		expect( rowButton.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( columnButton.getAttribute( 'aria-pressed' ) ).toBe( 'false' );

		act( () => {
			rowButton.click();
		} );

		expect( rowButton.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( columnButton.getAttribute( 'aria-pressed' ) ).toBe( 'false' );

		const editWrapper = container.querySelector( '[data-testid="table-edit"]' )?.parentElement;
		if ( ! editWrapper ) {
			throw new Error( 'Expected Table edit wrapper was not rendered.' );
		}

		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		editWrapper.dispatchEvent( pointerDown );
		expect( pointerDown.defaultPrevented ).toBe( true );
	} );

	/**
	 * Portal上のWordPress標準Toolbar操作が、Table内容編集の抑止対象にならないことを確認する。
	 *
	 * 事前条件:
	 * - 対応Tableで行並び替えモードが選択されている。
	 * - ToolbarはTable編集wrapperの外側へPortal描画され、React上ではReorder Mode接続境界の子である。
	 *
	 * 操作:
	 * - Table編集領域内とPortal上のToolbar入口から`pointerdown` / `mousedown`を発生させる。
	 * - Portal上の列入口を選択する。
	 *
	 * 期待結果:
	 * - Table編集領域内の入力は引き続き抑止される。
	 * - Portal上のToolbar入力はReactのcapture経路を通っても抑止されない。
	 * - Toolbar操作が成立し、列並び替えモードへ切り替わる。
	 */
	it( 'when toolbar input comes from a Portal outside the Table edit region, should not prevent the Toolbar operation', () => {
		const props = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;

		renderTable( root, Wrapped, props );
		act( () => {
			getToolbarButton( mockBlockControlsPortalContainer, 'Reorder rows' ).click();
		} );

		const editWrapper = container.querySelector( '[data-testid="table-edit"]' )?.parentElement;
		if ( ! editWrapper ) {
			throw new Error( 'Expected Table edit wrapper was not rendered.' );
		}

		for ( const eventType of [ 'pointerdown', 'mousedown' ] ) {
			const editEvent = new Event( eventType, { bubbles: true, cancelable: true } );
			editWrapper.dispatchEvent( editEvent );
			expect( editEvent.defaultPrevented ).toBe( true );
		}

		const columnButton = getToolbarButton( mockBlockControlsPortalContainer, 'Reorder columns' );
		for ( const eventType of [ 'pointerdown', 'mousedown' ] ) {
			const toolbarEvent = new Event( eventType, { bubbles: true, cancelable: true } );
			columnButton.dispatchEvent( toolbarEvent );
			expect( toolbarEvent.defaultPrevented ).toBe( false );
		}

		act( () => {
			columnButton.click();
		} );

		expect( reorderModeIntegration.isSelected( 'column', 'table-a' ) ).toBe( true );
		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( false );
	} );

	/**
	 * 並び替えモード中のTableから別Blockへ操作対象を移すと、通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えモードが選択されている。
	 * - Table Aは選択中である。
	 *
	 * 操作:
	 * - Table Aを非選択状態へ更新する。
	 *
	 * 期待結果:
	 * - Reorder Modeは通常編集へ戻る。
	 * - Table Aへ戻る入力は抑止されず、WordPress Editor標準の再選択Lifecycleを利用できる。
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
			getToolbarButton( mockBlockControlsPortalContainer, 'Reorder rows' ).click();
		} );
		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( true );

		renderTable( root, Wrapped, unselectedTable );

		expect( mockBlockControlsPortalContainer.querySelector( '[data-testid="block-controls"]' ) ).toBeNull();
		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( false );
		expect( reorderModeIntegration.isEditingAllowed( 'table-a' ) ).toBe( true );

		const editWrapper = container.querySelector( '[data-testid="table-edit"]' )?.parentElement;
		if ( ! editWrapper ) {
			throw new Error( 'Expected Table edit wrapper was not rendered.' );
		}

		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		editWrapper.dispatchEvent( pointerDown );
		expect( pointerDown.defaultPrevented ).toBe( false );
	} );

	/**
	 * React Effectへ渡されたTable選択変更によって、別Tableへ移動したReorder Modeが通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えモードが選択されている。
	 * - Reorder Mode接続境界は実際のReact rootへmountされている。
	 *
	 * 操作:
	 * - 同じReact rootをTable Bの選択状態で更新する。
	 *
	 * 期待結果:
	 * - EffectからTable BがReorder Modeへ通知される。
	 * - Table Bでは行・列入口が非選択となり、通常編集を開始できる。
	 */
	it( 'when the selected table changes, should return to edit mode through the React effect lifecycle', () => {
		const tableA = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;
		const tableB = {
			...tableA,
			clientId: 'table-b',
		};

		renderTable( root, Wrapped, tableA );
		act( () => {
			getToolbarButton( mockBlockControlsPortalContainer, 'Reorder rows' ).click();
		} );
		expect(
			getToolbarButton( mockBlockControlsPortalContainer, 'Reorder rows' ).getAttribute(
				'aria-pressed'
			)
		).toBe( 'true' );

		renderTable( root, Wrapped, tableB );

		expect(
			getToolbarButton( mockBlockControlsPortalContainer, 'Reorder rows' ).getAttribute(
				'aria-pressed'
			)
		).toBe( 'false' );
		expect(
			getToolbarButton( mockBlockControlsPortalContainer, 'Reorder columns' ).getAttribute(
				'aria-pressed'
			)
		).toBe( 'false' );

		const editWrapper = container.querySelector( '[data-testid="table-edit"]' )?.parentElement;
		if ( ! editWrapper ) {
			throw new Error( 'Expected Table edit wrapper was not rendered.' );
		}

		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		editWrapper.dispatchEvent( pointerDown );
		expect( pointerDown.defaultPrevented ).toBe( false );
	} );
} );
