/**
 * WordPress Table ToolbarのRow / Column DnDとReorder Form（RF）入口が製品入口で排他的に切り替わることを確認する。
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ReorderModeToolbar } from './toolbar';

let mockSelectedKind: 'row' | 'column' | null = null;
let mockRfState: any = { status: 'closed' };
const mockSelectMode = jest.fn();
const mockOpenRf = jest.fn();
const mockCloseRf = jest.fn();

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: ( props: { children: ReactNode } ) => <div>{ props.children }</div>,
} ) );

jest.mock( '@wordpress/components', () => {
	const react = jest.requireActual( 'react' ) as typeof import('react');
	return {
		ToolbarGroup: ( props: { children: ReactNode } ) => <div>{ props.children }</div>,
		ToolbarButton: react.forwardRef<
			HTMLButtonElement,
			{
				className?: string;
				disabled?: boolean;
				isPressed: boolean;
				label: string;
				onClick: () => void;
			}
		>( ( { className, disabled, isPressed, label, onClick }, ref ) => (
			<button
				ref={ ref }
				aria-label={ label }
				aria-pressed={ isPressed }
				className={ className }
				disabled={ disabled }
				onClick={ onClick }
				type="button"
			/>
		) ),
	};
} );

jest.mock( '@/messages', () => ( {
	getColumnReorderName: () => 'Reorder columns',
	getRfReorderName: () => 'Reorder with form',
	getRowReorderName: () => 'Reorder rows',
} ) );

jest.mock( '@/reorder/reorder-mode-react', () => ( {
	useReorderMode: () => ( {
		selectedKind: mockSelectedKind,
		select: mockSelectMode,
	} ),
} ) );

jest.mock( '@/reorder/reorder-form/responsibilities/interaction-react', () => ( {
	useRfInteraction: () => mockRfState,
} ) );

jest.mock( '@/reorder/reorder-form/responsibilities/interaction', () => ( {
	rfInteraction: {
		open: ( tableIdentity: string ) => mockOpenRf( tableIdentity ),
		close: ( tableIdentity: string ) => mockCloseRf( tableIdentity ),
	},
} ) );

jest.mock( '@/reorder/wordpress/components/reorder-form', () => ( {
	ReorderFormPopover: () => null,
} ) );

jest.mock( '@/reorder/wordpress/components/guidance', () => ( {
	ReorderGuidance: () => null,
} ) );

jest.mock( '@/reorder/wordpress/hooks/use-reorder-guidance', () => ( {
	useReorderGuidance: () => ( {
		dismiss: jest.fn(),
		guidance: null,
	} ),
} ) );

describe( 'Reorder toolbar RF exclusivity', () => {
	beforeEach( () => {
		mockSelectedKind = null;
		mockRfState = { status: 'closed' };
		jest.clearAllMocks();
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
	 */
	it( 'when RF starts from a DnD mode, should return to edit mode before opening RF', () => {
		mockSelectedKind = 'row';
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		fireEvent.click( screen.getByRole( 'button', { name: 'Reorder with form' } ) );

		expect( mockSelectMode ).toHaveBeenCalledWith( 'row' );
		expect( mockOpenRf ).toHaveBeenCalledWith( 'table-a' );
		expect( mockSelectMode.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			mockOpenRf.mock.invocationCallOrder[ 0 ]
		);
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
		mockRfState = {
			status: 'open',
			kind: 'row',
			input: { sourceRowNumber: '', targetRowNumber: '', position: null },
			rowCount: 3,
			result: { status: 'not-ready' },
			canApply: false,
		};
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		fireEvent.click( screen.getByRole( 'button', { name: 'Reorder columns' } ) );

		expect( mockCloseRf ).toHaveBeenCalledWith( 'table-a' );
		expect( mockSelectMode ).toHaveBeenCalledWith( 'column' );
		expect( mockCloseRf.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			mockSelectMode.mock.invocationCallOrder[ 0 ]
		);
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
		mockRfState = { status: 'applying', kind: 'row' };
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		const rowButton = screen.getByRole( 'button', { name: 'Reorder rows' } ) as HTMLButtonElement;
		const columnButton = screen.getByRole( 'button', {
			name: 'Reorder columns',
		} ) as HTMLButtonElement;
		const rfButton = screen.getByRole( 'button', {
			name: 'Reorder with form',
		} ) as HTMLButtonElement;

		expect( rowButton.disabled ).toBe( true );
		expect( columnButton.disabled ).toBe( true );
		expect( rfButton.disabled ).toBe( true );
	} );
} );
