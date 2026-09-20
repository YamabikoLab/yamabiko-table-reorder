/**
 * WordPress Table ToolbarのRow / Column DnDとReorder Form（RF）入口が製品入口で排他的に切り替わることを確認する。
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { dispatch } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

import {
	rfInteraction,
	rfInteractionStore,
} from '@/reorder/reorder-form/responsibilities/interaction';
import { reorderMode } from '@/reorder/reorder-mode';
import {
	clearColumnDndLayoutAvailabilitySnapshot,
	updateColumnDndLayoutAvailabilitySnapshot,
} from '@/reorder/wordpress/column-dnd-layout-availability-state';
import { ReorderModeToolbar } from './toolbar';

/* @wordpress/componentsのuuid / theme ESM境界だけをJestで読める決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'reorder-toolbar-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

/*
 * @wordpress/block-editorの公開入口はJest変換対象外のmarked ESMを経由するため、直接読み込めない。
 * RFが参照するStore境界だけを実@wordpress/dataへ登録し、SlotFill配置境界をJest DOMへ接続する。
 */
jest.mock( '@wordpress/block-editor', () => {
	const { createReduxStore, register } = jest.requireActual( '@wordpress/data' );
	const store = createReduxStore( 'test/yamabiko-table-reorder-toolbar-block-editor', {
		reducer: ( state = {} ) => state,
		actions: {},
		selectors: { getBlock: () => null },
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
	const store = createReduxStore( 'test/yamabiko-table-reorder-toolbar-preferences', {
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

describe( 'Reorder toolbar RF exclusivity', () => {
	beforeEach( () => {
		reorderMode.observeTable( '__reorder-toolbar-test-reset__' );
		rfInteractionStore.setState( rfInteractionStore.getInitialState(), true );
		updateColumnDndLayoutAvailabilitySnapshot( 'table-a', 'available' );
		dispatch( preferencesStore ).set(
			'yamabiko-table-reorder',
			'initialGuidanceAcknowledgedPc',
			true
		);
		dispatch( preferencesStore ).set(
			'yamabiko-table-reorder',
			'initialGuidanceAcknowledgedTouch',
			true
		);
	} );

	afterEach( () => {
		act( () => {
			reorderMode.observeTable( '__reorder-toolbar-test-reset__' );
			rfInteractionStore.setState( rfInteractionStore.getInitialState(), true );
			clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );
		} );
	} );

	/**
	 * 概要:
	 * - RF入口が既存Row / Column入口と同じToolbarGroupでColumnの隣に表示されることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは通常編集状態である。
	 *
	 * 操作:
	 * - Toolbarを表示する。
	 *
	 * 期待結果:
	 * - Row、Column、RFの順で3つの入口が表示される。
	 */
	it( 'when the table toolbar is rendered, should place RF next to the column entry', () => {
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		const buttons = screen.getAllByRole( 'button' );
		expect( buttons.map( ( button ) => button.getAttribute( 'aria-label' ) ) ).toEqual( [
			'Reorder rows',
			'Reorder columns',
			'Reorder with form',
		] );
	} );

	/**
	 * 概要:
	 * - 初回案内中は3つの並び替え入口を個別ではなく1つの機能群として強調することを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableで初回案内が表示されている。
	 *
	 * 操作:
	 * - Toolbarを表示した後、初回案内を終了した状態へ更新する。
	 *
	 * 期待結果:
	 * - 案内中はToolbarGroupだけに強調classが付与され、各入口には付与されない。
	 * - 案内終了後はToolbarGroupから強調classが外れる。
	 */
	it( 'when guidance is visible, should highlight only the reorder entry group until guidance ends', async () => {
		dispatch( preferencesStore ).set(
			'yamabiko-table-reorder',
			'initialGuidanceAcknowledgedPc',
			undefined
		);
		const { container } = render( <ReorderModeToolbar tableIdentity="table-a" /> );

		await waitFor( () => {
			expect( container.querySelector( '.yamabiko-table-reorder-guidance-target' ) ).not.toBeNull();
		} );
		expect(
			screen
				.getAllByRole( 'button' )
				.some( ( button ) => button.classList.contains( 'yamabiko-table-reorder-guidance-target' ) )
		).toBe( false );

		fireEvent.click( screen.getByRole( 'button', { name: 'Close reorder guidance' } ) );

		await waitFor( () => {
			expect( container.querySelector( '.yamabiko-table-reorder-guidance-target' ) ).toBeNull();
		} );
	} );

	/**
	 * 概要:
	 * - DnDモード中にRFを開始すると、既存モードをeditへ戻してからRFを開くことを確認する。
	 *
	 * 事前条件:
	 * - 同じTableでRow Reorder Modeが有効である。
	 *
	 * 操作:
	 * - RF入口を選択する。
	 *
	 * 期待結果:
	 * - Rowモードの再選択によるedit遷移がRF openより先に要求される。
	 * - 新しいRF SessionのPopover位置とnarrow表示高さが初期化されてからRFが開く。
	 */
	it( 'when RF starts from a DnD mode, should return to edit mode and reset presentation state before opening RF', () => {
		reorderMode.select( 'row', 'table-a' );
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		fireEvent.click( screen.getByRole( 'button', { name: 'Reorder with form' } ) );

		expect(
			screen.getByRole( 'button', { name: 'Reorder rows' } ).getAttribute( 'aria-pressed' )
		).toBe( 'false' );
		expect(
			screen.getByRole( 'button', { name: 'Reorder with form' } ).getAttribute( 'aria-pressed' )
		).toBe( 'true' );
		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
		} );
	} );

	/**
	 * 概要:
	 * - RF open中にDnD入口を選択すると、RFを終了してからDnDモードへ進むことを確認する。
	 *
	 * 事前条件:
	 * - 同じTableでRFがopenである。
	 *
	 * 操作:
	 * - Column入口を選択する。
	 *
	 * 期待結果:
	 * - RF closeがColumnモード選択より先に要求される。
	 */
	it( 'when a DnD entry is selected from RF, should close RF before selecting the DnD mode', () => {
		rfInteraction.open( 'table-a' );
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		fireEvent.click( screen.getByRole( 'button', { name: 'Reorder columns' } ) );

		expect(
			screen.getByRole( 'button', { name: 'Reorder columns' } ).getAttribute( 'aria-pressed' )
		).toBe( 'true' );
		expect( rfInteractionStore.getState().session.status ).toBe( 'closed' );
	} );

	/**
	 * 概要:
	 * - RF反映中は新しい並び替え入口を開始できないことを確認する。
	 *
	 * 事前条件:
	 * - 対象TableのRF Interactionがapplyingである。
	 *
	 * 操作:
	 * - Toolbarを表示する。
	 *
	 * 期待結果:
	 * - Row / Column / RFの3入口がすべてdisabledになる。
	 */
	it( 'when RF is applying, should disable every reorder entry', () => {
		rfInteractionStore.setState( {
			session: {
				status: 'applying',
				tableIdentity: 'table-a',
				kind: 'row',
				rowInput: { sourceRowNumber: '', targetRowNumber: '', position: null },
				columnInput: { sourceColumnIndex: null, targetColumnIndex: null, position: null },
			},
		} );
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		const rowButton = screen.getByRole( 'button', { name: 'Reorder rows' } ) as HTMLButtonElement;
		const columnButton = screen.getByRole( 'button', {
			name: 'Reorder columns',
		} ) as HTMLButtonElement;
		const rfButton = screen.getByRole( 'button', {
			name: 'Reorder with form',
		} ) as HTMLButtonElement;

		fireEvent.click( rowButton );
		fireEvent.click( columnButton );
		fireEvent.click( rfButton );

		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
		expect( rfInteractionStore.getState().session.status ).toBe( 'applying' );
	} );

	/**
	 * 概要:
	 * - 現在表示で物理列配置が成立しない場合に、Column DnD入口を選択不可にしながら理由を取得できることを確認する。
	 *
	 * 事前条件:
	 * - 対象TableのToolbar表示用availability snapshotはunavailableである。
	 *
	 * 操作:
	 * - Column DnD入口を表示して選択する。
	 *
	 * 期待結果:
	 * - 入口はfocus可能なままaria-disabledとして表現される。
	 * - 現在表示で利用できないこととRFによる代替操作を示すPopoverが接続される。
	 * - Column Reorder Modeは開始されない。
	 */
	it( 'when column DnD layout is unavailable, should expose the reason without selecting column mode', async () => {
		updateColumnDndLayoutAvailabilitySnapshot( 'table-a', 'unavailable' );
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		const columnButton = screen.getByRole( 'button', {
			name: 'Reorder columns',
		} ) as HTMLButtonElement;

		expect( columnButton.disabled ).toBe( false );
		expect( columnButton.getAttribute( 'aria-disabled' ) ).toBe( 'true' );
		fireEvent.focus( columnButton );
		await waitFor( () => {
			expect( screen.getByRole( 'tooltip' ).textContent ).toBe(
				'Column drag reordering is unavailable in the current view. You can reorder columns using the form.'
			);
		} );

		fireEvent.click( columnButton );

		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
	} );
} );
