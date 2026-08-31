/**
 * Reorder ModeとWordPress Editor接続境界のReact lifecycleを確認する。
 *
 * 実Editorの描画詳細には依存せず、実際のReact購読とEffectを通して、Toolbar入口、通常編集との排他、
 * および別Tableへ操作対象が移った場合のLifecycleが描画へ反映されることを検証する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { reorderModeIntegration } from './reorder-mode';
import { withReorderMode } from './reorder-mode-integration';

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: ( { children }: { children: React.ReactNode } ) => (
		<div data-testid="block-controls">{ children }</div>
	),
} ) );

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

		const rowButton = getToolbarButton( container, 'Reorder rows' );
		const columnButton = getToolbarButton( container, 'Reorder columns' );
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
	 * 並び替えモード中のTableへ戻る最初の入力でも、通常編集を開始せず同じTableを再選択できることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えモードが選択されている。
	 * - Table Aは一度非選択となっているが、Reorder ModeはTable Aに対して有効なままである。
	 *
	 * 操作:
	 * - 同じTable Aの内容へ戻る入力を行う。
	 * - WordPress Editor標準のfocusによるBlock再選択をReact描画へ反映する。
	 *
	 * 期待結果:
	 * - 戻る最初の入力ではTable内容編集の開始が抑止され、Table Aの接続境界だけへfocusが移る。
	 * - Table Aの再選択後も行並び替えモードが維持され、Toolbar入口が選択状態で再表示される。
	 */
	it( 'when returning to the active reorder table, should reselect the table without starting content editing', () => {
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

		renderTable( root, Wrapped, unselectedTable );
		expect( container.querySelector( '[data-testid="block-controls"]' ) ).toBeNull();
		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( true );

		const editWrapper = container.querySelector< HTMLElement >(
			'[data-testid="table-edit"]'
		)?.parentElement;
		if ( ! editWrapper ) {
			throw new Error( 'Expected Table edit wrapper was not rendered.' );
		}

		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		editWrapper.dispatchEvent( pointerDown );

		expect( pointerDown.defaultPrevented ).toBe( true );
		expect( document.activeElement ).toBe( editWrapper );
		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( true );

		renderTable( root, Wrapped, selectedTable );
		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'true'
		);
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
			getToolbarButton( container, 'Reorder rows' ).click();
		} );
		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'true'
		);

		renderTable( root, Wrapped, tableB );

		expect( getToolbarButton( container, 'Reorder rows' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);
		expect( getToolbarButton( container, 'Reorder columns' ).getAttribute( 'aria-pressed' ) ).toBe(
			'false'
		);

		const editWrapper = container.querySelector( '[data-testid="table-edit"]' )?.parentElement;
		if ( ! editWrapper ) {
			throw new Error( 'Expected Table edit wrapper was not rendered.' );
		}

		const pointerDown = new Event( 'pointerdown', { bubbles: true, cancelable: true } );
		editWrapper.dispatchEvent( pointerDown );
		expect( pointerDown.defaultPrevented ).toBe( false );
	} );
} );
