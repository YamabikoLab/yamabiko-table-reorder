/**
 * Reorder ModeとWordPress Block選択のライフサイクル分離をPoCとして確認する。
 *
 * 対象Tableの一時的な非選択はReorder Modeを維持し、別Blockが実際に選択された場合だけ
 * Reorder Modeを終了することを、React接続境界を通して確認する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { reorderModeIntegration } from './reorder-mode';
import { withReorderMode } from './reorder-mode-integration';

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: ( { children }: { children: React.ReactNode } ) => <>{ children }</>,
} ) );

jest.mock( '@wordpress/components', () => ( {
	ToolbarButton: ( {
		label,
		onClick,
	}: {
		label: string;
		onClick: () => void;
	} ) => (
		<button aria-label={ label } onClick={ onClick } type="button">
			{ label }
		</button>
	),
	ToolbarGroup: ( { children }: { children: React.ReactNode } ) => <>{ children }</>,
} ) );

type BlockProps = BlockEditProps< Record< string, unknown > > & {
	name: string;
};

/** Reactの`act()`対象としてJest環境を明示できるglobal設定を表す。 */
type ReactActGlobal = typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * React rootへReorder Mode接続済みBlockを描画する。
 *
 * @param root    テストで利用するReact root。
 * @param Wrapped Reorder Modeへ接続済みBlockEdit component。
 * @param props   Gutenbergから渡されるBlock props。
 */
const renderBlock = ( root: Root, Wrapped: ReturnType< typeof withReorderMode >, props: BlockProps ) => {
	act( () => {
		root.render( <Wrapped { ...props } /> );
	} );
};

describe( 'Reorder Mode selection lifecycle PoC', () => {
	const BlockEdit = () => <div>Block</div>;
	const Wrapped = withReorderMode( BlockEdit );
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
	 * 概要:
	 * - 対象Tableが選択されている状態から選択Blockなしへ遷移してもReorder Modeを維持することを確認する。
	 *
	 * 事前条件:
	 * - Core Tableが選択され、行並び替えモードが有効である。
	 *
	 * 操作:
	 * - 同じTableを非選択状態として再描画する。
	 *
	 * 期待結果:
	 * - 対象Tableの行並び替えモードが維持される。
	 */
	it( 'when no block is selected, should keep reorder mode for the active table', () => {
		const selectedTable = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as BlockProps;

		renderBlock( root, Wrapped, selectedTable );
		act( () => {
			reorderModeIntegration.select( 'row', 'table-a' );
		} );

		renderBlock( root, Wrapped, { ...selectedTable, isSelected: false } );

		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - 対象Tableとは別のBlockが実際に選択された場合はReorder Modeを終了することを確認する。
	 *
	 * 事前条件:
	 * - Core Table Aで行並び替えモードが有効である。
	 * - Table Aはすでに非選択状態である。
	 *
	 * 操作:
	 * - Paragraph Blockを選択状態として描画する。
	 *
	 * 期待結果:
	 * - Table AのReorder Modeが終了する。
	 * - Table Aで通常編集を開始できる状態へ戻る。
	 */
	it( 'when another block is selected, should exit reorder mode', () => {
		const table = {
			attributes: {},
			clientId: 'table-a',
			isSelected: false,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as BlockProps;
		const paragraph = {
			...table,
			clientId: 'paragraph-a',
			isSelected: true,
			name: 'core/paragraph',
		} as unknown as BlockProps;

		act( () => {
			reorderModeIntegration.select( 'row', 'table-a' );
		} );
		renderBlock( root, Wrapped, table );
		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( true );

		renderBlock( root, Wrapped, paragraph );

		expect( reorderModeIntegration.isSelected( 'row', 'table-a' ) ).toBe( false );
		expect( reorderModeIntegration.isEditingAllowed( 'table-a' ) ).toBe( true );
	} );
} );
