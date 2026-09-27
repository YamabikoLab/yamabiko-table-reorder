/**
 * WordPress Table ToolbarのRow / Column DnD、Reorder Form（RF）、Chat入口が製品入口で排他的に切り替わることを確認する。
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { dispatch } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

import {
	rfInteraction,
	rfInteractionStore,
} from '@/reorder/reorder-form/responsibilities/interaction';
import { reorderMode } from '@/reorder/reorder-mode';
import {
	reorderFormHeight,
	useReorderFormNarrowHeight,
} from '@/reorder/wordpress/components/reorder-form-height';
import {
	reorderFormPosition,
	useReorderFormPosition,
} from '@/reorder/wordpress/components/reorder-form-position';
import {
	clearColumnDndLayoutAvailabilitySnapshot,
	updateColumnDndLayoutAvailabilitySnapshot,
} from '@/reorder/wordpress/column-dnd-layout-availability-state';
import type { ReorderChatEntry } from './reorder-chat';
import { ReorderModeToolbar } from './toolbar';

let mockChatActive = false;
const mockChatOpen = jest.fn();
const mockChatClose = jest.fn();
const mockChatToggle = jest.fn();
const mockSetChatAnchor = jest.fn();

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

jest.mock( '@/messages', () => ( {
	getChatReorderName: () => 'Reorder with chat',
	getColumnDndLayoutUnavailableMessage: () =>
		'Column drag reordering is unavailable in the current view. You can reorder columns using the form.',
	getColumnReorderName: () => 'Reorder columns',
	getRfReorderName: () => 'Reorder with form',
	getRowReorderName: () => 'Reorder rows',
} ) );

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

const narrowHeightProperty = '--yamabiko-table-reorder-rf-narrow-height';

const createNarrowHeightFixture = () => {
	const fixture = document.createElement( 'div' );
	const anchor = document.createElement( 'button' );
	const popover = document.createElement( 'div' );
	const content = document.createElement( 'div' );
	const header = document.createElement( 'div' );
	const collapse = document.createElement( 'button' );
	fixture.dataset.reorderToolbarHeightFixture = 'true';
	popover.className = 'yamabiko-table-reorder-rf-popover is-narrow';
	content.className = 'components-popover__content';
	header.className = 'yamabiko-table-reorder-rf__header';
	collapse.className = 'yamabiko-table-reorder-rf__collapse';
	collapse.setAttribute( 'aria-expanded', 'true' );
	fixture.append( anchor, popover );
	popover.append( content );
	content.append( header );
	header.append( collapse );
	document.body.append( fixture );

	header.getBoundingClientRect = () => ( { top: 100 } ) as DOMRect;
	content.getBoundingClientRect = () => ( { height: 300 } ) as DOMRect;
	Object.assign( header, {
		hasPointerCapture: () => false,
		releasePointerCapture: jest.fn(),
		setPointerCapture: jest.fn(),
	} );

	return { anchor, fixture, header };
};

const dispatchHeightPointer = (
	type: 'pointerdown' | 'pointermove' | 'pointerup',
	target: Element,
	clientY: number
): void => {
	const event = new Event( type, { bubbles: true, cancelable: true } );
	Object.defineProperties( event, {
		button: { value: 0 },
		clientY: { value: clientY },
		isPrimary: { value: true },
		pointerId: { value: 1 },
	} );
	target.dispatchEvent( event );
};

const createChatEntry = (): ReorderChatEntry => ( {
	active: mockChatActive,
	setAnchor: mockSetChatAnchor,
	open: mockChatOpen,
	close: mockChatClose,
	toggle: mockChatToggle,
} );

const renderToolbar = () =>
	render( <ReorderModeToolbar chat={ createChatEntry() } tableIdentity="table-a" /> );

describe( 'Reorder toolbar exclusivity', () => {
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
		mockChatActive = false;
		jest.clearAllMocks();
	} );

	afterEach( () => {
		act( () => {
			reorderMode.observeTable( '__reorder-toolbar-test-reset__' );
			rfInteractionStore.setState( rfInteractionStore.getInitialState(), true );
			clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );
		} );
		document.documentElement.style.removeProperty( narrowHeightProperty );
		document
			.querySelectorAll( '[data-reorder-toolbar-height-fixture="true"]' )
			.forEach( ( fixture ) => fixture.remove() );
	} );

	it( 'when the table toolbar is rendered, should show the four reorder entries', () => {
		renderToolbar();

		const buttons = screen.getAllByRole( 'button' );
		expect( buttons.map( ( button ) => button.getAttribute( 'aria-label' ) ) ).toEqual( [
			'Reorder rows',
			'Reorder columns',
			'Reorder with form',
			'Reorder with chat',
		] );
	} );

	it( 'when guidance is visible, should highlight only the reorder entry group until guidance ends', async () => {
		dispatch( preferencesStore ).set(
			'yamabiko-table-reorder',
			'initialGuidanceAcknowledgedPc',
			undefined
		);
		const { container } = renderToolbar();

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

	it( 'when RF starts from a DnD mode, should return to edit mode and reset presentation state before opening RF', () => {
		reorderMode.select( 'row', 'table-a' );
		reorderFormPosition.beginSession( 'table-a' );
		const positionHook = renderHook( () => useReorderFormPosition( 'table-a' ) );
		act( () => {
			positionHook.result.current.setPosition( { x: 80, y: 120 } );
		} );

		reorderFormHeight.beginSession( 'table-a' );
		const { anchor, fixture, header } = createNarrowHeightFixture();
		const heightHook = renderHook( () => useReorderFormNarrowHeight( 'table-a', anchor, true ) );
		act( () => {
			dispatchHeightPointer( 'pointerdown', header, 108 );
			dispatchHeightPointer( 'pointermove', header, 68 );
			dispatchHeightPointer( 'pointerup', header, 68 );
		} );

		let modeWhenRfOpened: ReturnType< typeof reorderMode.getMode > | null = null;
		const unsubscribe = rfInteractionStore.subscribe( ( state ) => {
			if ( state.session.status === 'open' && state.session.tableIdentity === 'table-a' ) {
				modeWhenRfOpened = reorderMode.getMode( 'table-a' );
			}
		} );
		renderToolbar();

		fireEvent.click( screen.getByRole( 'button', { name: 'Reorder with form' } ) );

		expect( mockChatClose ).toHaveBeenCalled();
		expect( modeWhenRfOpened ).toBe( 'edit' );
		expect( positionHook.result.current.position ).toBeNull();
		expect( document.documentElement.style.getPropertyValue( narrowHeightProperty ) ).toBe( '' );
		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
		} );

		unsubscribe();
		heightHook.unmount();
		positionHook.unmount();
		fixture.remove();
	} );

	it( 'when a DnD entry is selected from RF, should close other reorder inputs before selecting the DnD mode', () => {
		rfInteraction.open( 'table-a' );
		let modeWhenRfClosed: ReturnType< typeof reorderMode.getMode > | null = null;
		const unsubscribe = rfInteractionStore.subscribe( ( state ) => {
			if ( state.session.status === 'closed' ) {
				modeWhenRfClosed = reorderMode.getMode( 'table-a' );
			}
		} );
		renderToolbar();

		fireEvent.click( screen.getByRole( 'button', { name: 'Reorder columns' } ) );

		expect( mockChatClose ).toHaveBeenCalled();
		expect( modeWhenRfClosed ).toBe( 'edit' );
		expect(
			screen.getByRole( 'button', { name: 'Reorder columns' } ).getAttribute( 'aria-pressed' )
		).toBe( 'true' );
		expect( rfInteractionStore.getState().session.status ).toBe( 'closed' );
		unsubscribe();
	} );

	it( 'when chat starts from RF, should close RF before opening chat', () => {
		rfInteraction.open( 'table-a' );
		let rfStatusWhenChatOpened: string | null = null;
		mockChatOpen.mockImplementationOnce( () => {
			rfStatusWhenChatOpened = rfInteractionStore.getState().session.status;
		} );
		renderToolbar();

		fireEvent.click( screen.getByRole( 'button', { name: 'Reorder with chat' } ) );

		expect( rfStatusWhenChatOpened ).toBe( 'closed' );
		expect( rfInteractionStore.getState().session.status ).toBe( 'closed' );
		expect( mockChatOpen ).toHaveBeenCalled();
	} );

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
		renderToolbar();

		for ( const name of [
			'Reorder rows',
			'Reorder columns',
			'Reorder with form',
			'Reorder with chat',
		] ) {
			const button = screen.getByRole( 'button', { name } ) as HTMLButtonElement;
			expect( button.getAttribute( 'aria-disabled' ) ).toBe( 'true' );
			fireEvent.click( button );
		}

		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
		expect( rfInteractionStore.getState().session.status ).toBe( 'applying' );
		expect( mockChatOpen ).not.toHaveBeenCalled();
	} );

	it( 'when column DnD layout is unavailable, should expose the reason without selecting column mode', async () => {
		updateColumnDndLayoutAvailabilitySnapshot( 'table-a', 'unavailable' );
		renderToolbar();

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
