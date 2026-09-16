/**
 * WordPress Table ToolbarのRow / Column DnDとReorder Form（RF）入口が製品入口で排他的に切り替わることを確認する。
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ReorderModeToolbar } from './toolbar';

let mockSelectedKind: 'row' | 'column' | null = null;
let mockRfState: any = { status: 'closed' };
let mockColumnDndLayoutAvailability: 'available' | 'unavailable' = 'available';
let mockGuidance: { environment: 'pc' | 'touch' } | null = null;
const mockSelectMode = jest.fn();
const mockOpenRf = jest.fn();
const mockCloseRf = jest.fn();
const mockBeginRfPositionSession = jest.fn();
const mockBeginRfHeightSession = jest.fn();

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: ( props: { children: ReactNode } ) => <div>{ props.children }</div>,
} ) );

jest.mock( '@wordpress/components', () => {
	const react = jest.requireActual( 'react' ) as typeof import('react');
	return {
		ToolbarGroup: ( props: { children: ReactNode; className?: string } ) => (
			<div className={ props.className } role="group">
				{ props.children }
			</div>
		),
		ToolbarButton: react.forwardRef<
			HTMLButtonElement,
			{
				'aria-disabled'?: boolean;
				'aria-describedby'?: string;
				className?: string;
				disabled?: boolean;
				isPressed: boolean;
				label: string;
				onBlur?: () => void;
				onClick: () => void;
				onFocus?: () => void;
				onMouseEnter?: () => void;
				onMouseLeave?: () => void;
				onTouchStart?: () => void;
			}
		>(
			(
				{
					'aria-disabled': ariaDisabled,
					'aria-describedby': ariaDescribedBy,
					className,
					disabled,
					isPressed,
					label,
					onBlur,
					onClick,
					onFocus,
					onMouseEnter,
					onMouseLeave,
					onTouchStart,
				},
				ref
			) => (
				<button
					ref={ ref }
					aria-describedby={ ariaDescribedBy }
					aria-disabled={ ariaDisabled }
					aria-label={ label }
					aria-pressed={ isPressed }
					className={ className }
					disabled={ disabled }
					onBlur={ onBlur }
					onClick={ onClick }
					onFocus={ onFocus }
					onMouseEnter={ onMouseEnter }
					onMouseLeave={ onMouseLeave }
					onTouchStart={ onTouchStart }
					type="button"
				/>
			)
		),
		Popover: ( props: { children: ReactNode } ) => <div>{ props.children }</div>,
	};
} );

jest.mock( '@/messages', () => ( {
	getColumnDndLayoutUnavailableMessage: () =>
		'Column drag reordering is unavailable in the current view. You can reorder columns using the form.',
	getColumnReorderName: () => 'Reorder columns',
	getRfReorderName: () => 'Reorder with form',
	getRowReorderName: () => 'Reorder rows',
} ) );

jest.mock( '@/reorder/wordpress/column-dnd-layout-availability-state', () => ( {
	useColumnDndLayoutAvailabilitySnapshot: () => mockColumnDndLayoutAvailability,
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

jest.mock( '@/reorder/wordpress/components/reorder-form-height', () => ( {
	reorderFormHeight: {
		beginSession: ( tableIdentity: string ) => mockBeginRfHeightSession( tableIdentity ),
	},
	useReorderFormNarrowHeight: jest.fn(),
} ) );

jest.mock( '@/reorder/wordpress/components/reorder-form-position', () => ( {
	reorderFormPosition: {
		beginSession: ( tableIdentity: string ) => mockBeginRfPositionSession( tableIdentity ),
	},
} ) );

jest.mock( '@/reorder/wordpress/components/guidance', () => ( {
	ReorderGuidance: () => null,
} ) );

jest.mock( '@/reorder/wordpress/hooks/use-reorder-guidance', () => ( {
	useReorderGuidance: () => ( {
		dismiss: jest.fn(),
		guidance: mockGuidance,
	} ),
} ) );

describe( 'Reorder toolbar RF exclusivity', () => {
	beforeEach( () => {
		mockSelectedKind = null;
		mockRfState = { status: 'closed' };
		mockColumnDndLayoutAvailability = 'available';
		mockGuidance = null;
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
	it( 'when guidance is visible, should highlight only the reorder entry group until guidance ends', () => {
		mockGuidance = { environment: 'pc' };
		const { rerender } = render( <ReorderModeToolbar tableIdentity="table-a" /> );

		const group = screen.getByRole( 'group' );
		expect( group.classList.contains( 'yamabiko-table-reorder-guidance-target' ) ).toBe( true );
		expect(
			screen
				.getAllByRole( 'button' )
				.some( ( button ) => button.classList.contains( 'yamabiko-table-reorder-guidance-target' ) )
		).toBe( false );

		mockGuidance = null;
		rerender( <ReorderModeToolbar tableIdentity="table-a" /> );

		expect( screen.getByRole( 'group' ).className ).toBe( '' );
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
		mockSelectedKind = 'row';
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		fireEvent.click( screen.getByRole( 'button', { name: 'Reorder with form' } ) );

		expect( mockSelectMode ).toHaveBeenCalledWith( 'row' );
		expect( mockBeginRfPositionSession ).toHaveBeenCalledWith( 'table-a' );
		expect( mockBeginRfHeightSession ).toHaveBeenCalledWith( 'table-a' );
		expect( mockOpenRf ).toHaveBeenCalledWith( 'table-a' );
		expect( mockSelectMode.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			mockBeginRfPositionSession.mock.invocationCallOrder[ 0 ]
		);
		expect( mockBeginRfPositionSession.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			mockBeginRfHeightSession.mock.invocationCallOrder[ 0 ]
		);
		expect( mockBeginRfHeightSession.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
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
	it( 'when column DnD layout is unavailable, should expose the reason without selecting column mode', () => {
		mockColumnDndLayoutAvailability = 'unavailable';
		render( <ReorderModeToolbar tableIdentity="table-a" /> );

		const columnButton = screen.getByRole( 'button', {
			name: 'Reorder columns',
		} ) as HTMLButtonElement;

		expect( columnButton.disabled ).toBe( false );
		expect( columnButton.getAttribute( 'aria-disabled' ) ).toBe( 'true' );
		fireEvent.focus( columnButton );
		expect( screen.getByRole( 'tooltip' ).textContent ).toBe(
			'Column drag reordering is unavailable in the current view. You can reorder columns using the form.'
		);

		fireEvent.click( columnButton );

		expect( mockSelectMode ).not.toHaveBeenCalled();
	} );
} );
