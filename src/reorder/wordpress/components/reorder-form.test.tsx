/**
 * Reorder Form（RF）が行番号の入力範囲、列選択肢、表示領域に応じたPresentationを利用者へ正しく公開することを確認する。
 */

import { act, fireEvent, render, screen } from '@testing-library/react';

import {
	rfInteraction,
	rfInteractionStore,
} from '@/reorder/reorder-form/responsibilities/interaction';
import type { RfInteractionReactState } from '@/reorder/reorder-form/responsibilities/interaction-react';
import {
	createTestTableBlock,
	createTestTableRow,
	resetRfInteractionTestState,
	setTestTableBlocks,
} from '@/reorder/reorder-form/responsibilities/interaction.test-utils';
import { reorderFormCollapse } from '@/reorder/wordpress/components/reorder-form-collapse';
import { reorderFormPosition } from '@/reorder/wordpress/components/reorder-form-position';

import { ReorderFormPopover } from './reorder-form';

/* @wordpress/componentsのuuid / theme ESM境界だけをJestで読める決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'reorder-form-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

/* JSDOMに実layoutがないため、Popoverの配置計算境界だけを固定座標で代替する。 */
jest.mock( '@floating-ui/react-dom', () => {
	const actual = jest.requireActual( '@floating-ui/react-dom' );
	const React = jest.requireActual( 'react' ) as typeof import('react');

	return {
		...actual,
		useFloating: ( { placement = 'bottom' }: { placement?: string } ) => {
			const reference = React.useRef< Element | null >( null );
			const floating = React.useRef< HTMLElement | null >( null );
			const setReference = React.useCallback( ( element: Element | null ) => {
				reference.current = element;
			}, [] );
			const setFloating = React.useCallback( ( element: HTMLElement | null ) => {
				floating.current = element;
			}, [] );
			const update = React.useCallback( () => undefined, [] );
			const refs = React.useMemo(
				() => ( { reference, floating, setReference, setFloating } ),
				[ setFloating, setReference ]
			);

			return {
				x: 0,
				y: 0,
				refs,
				strategy: 'absolute',
				update,
				placement,
				middlewareData: { arrow: {} },
			};
		},
	};
} );

/* Jestで読み込めないBlock Editor Storeの環境境界だけを代替し、WordPress Dataは実Storeへ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/reorder-form/responsibilities/block-editor-store.test-utils'
	).testBlockEditorStore,
} ) );

/** Row RFを表示する標準状態を作成する。 */
const createRowState = (): Extract<
	RfInteractionReactState,
	{ status: 'open'; kind: 'row' }
> => ( {
	status: 'open',
	kind: 'row',
	input: {
		sourceRowNumber: '2',
		targetRowNumber: '5',
		position: 'above',
	},
	rowCount: 20,
	result: { status: 'not-ready', inputProblems: [] },
	canApply: false,
} );

/**
 * RF Presentationが参照する表示環境の幅を指定する。
 *
 * @param view  RF anchorと同じ表示環境のwindow。
 * @param width 利用可能な表示幅。
 */
const setViewportWidth = ( view: Window, width: number ): void => {
	Object.defineProperty( view, 'visualViewport', {
		configurable: true,
		value: undefined,
	} );
	Object.defineProperty( view, 'innerWidth', {
		configurable: true,
		value: width,
	} );
};

/**
 * RF Presentationへ現在表示領域の変更を通知する。
 *
 * @param view RF anchorと同じ表示環境のwindow。
 */
const notifyViewportResize = ( view: Window ): void => {
	act( () => {
		const EventConstructor = ( view as Window & typeof globalThis ).Event;
		view.dispatchEvent( new EventConstructor( 'resize' ) );
	} );
};

describe( 'Reorder Form presentation', () => {
	beforeEach( () => {
		resetRfInteractionTestState();
		setTestTableBlocks( [
			createTestTableBlock(
				'table-a',
				Array.from( { length: 20 }, ( _value, rowIndex ) =>
					createTestTableRow( `row-${ rowIndex + 1 }`, 3 )
				),
				[ { cells: [ { content: '商品名' }, { content: '' }, { content: '' } ] } ]
			),
		] );
		rfInteraction.open( 'table-a' );
		setViewportWidth( window, 1024 );
		reorderFormCollapse.beginSession( 'table-a' );
		reorderFormPosition.beginSession( 'table-a' );
	} );

	afterEach( () => {
		resetRfInteractionTestState();
		document.querySelectorAll( 'iframe' ).forEach( ( iframe ) => iframe.remove() );
		jest.restoreAllMocks();
	} );

	/**
	 * RFが開いた後に初期操作である方向選択へフォーカスすることを確認する。
	 *
	 * 事前条件:
	 * - RF InteractionはRow RFをopenとして公開している。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - 現在選択されている「行」方向へフォーカスする。
	 */
	it( 'when the Reorder Form opens, should focus the current direction control', () => {
		const anchor = document.createElement( 'button' );

		render(
			<ReorderFormPopover anchor={ anchor } state={ createRowState() } tableIdentity="table-a" />
		);

		const direction = screen.getByRole( 'radio', { name: 'Rows' } );
		expect( direction.ownerDocument.activeElement ).toBe( direction );
	} );

	/**
	 * 明示的Cancel後に対象TableのRF toolbar入口へフォーカスを戻すことを確認する。
	 *
	 * 事前条件:
	 * - RFがopenである。
	 * - 現在Editor DOMに対象TableのRF toolbar入口が存在する。
	 *
	 * 操作:
	 * - RFの「キャンセル」を実行する。
	 *
	 * 期待結果:
	 * - RF Interactionへcloseを通知する。
	 * - 現在のRF toolbar入口へフォーカスを戻す。
	 */
	it( 'when the Reorder Form is cancelled explicitly, should close and focus its toolbar entry', () => {
		const anchor = document.createElement( 'button' );
		anchor.dataset.ytrFocusTarget = 'rf-toolbar';
		anchor.dataset.ytrTableIdentity = 'table-a';
		document.body.appendChild( anchor );

		render(
			<ReorderFormPopover anchor={ anchor } state={ createRowState() } tableIdentity="table-a" />
		);
		fireEvent.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

		expect( rfInteractionStore.getState().session ).toEqual( { status: 'closed' } );
		expect( anchor.ownerDocument.activeElement ).toBe( anchor );
	} );

	/**
	 * Row RFの行番号入力が現在Tableの有効範囲をHTML標準制約として公開することを確認する。
	 *
	 * 事前条件:
	 * - RFはRow入力を表示している。
	 * - 現在Tableは20行である。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - 移動元・移動先の両方が1から20までを1刻みで入力可能な数値入力として公開される。
	 */
	it( 'when row input is shown for a table with a known row count, should expose the valid row range on both number inputs', () => {
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'row',
			input: {
				sourceRowNumber: '',
				targetRowNumber: '',
				position: null,
			},
			rowCount: 20,
			result: { status: 'not-ready', inputProblems: [] },
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		const sourceInput = screen.getByRole( 'spinbutton', { name: 'Row to move' } );
		const targetInput = screen.getByRole( 'spinbutton', { name: 'Target row' } );

		expect( sourceInput.getAttribute( 'min' ) ).toBe( '1' );
		expect( sourceInput.getAttribute( 'max' ) ).toBe( '20' );
		expect( sourceInput.getAttribute( 'step' ) ).toBe( '1' );
		expect( sourceInput.getAttribute( 'aria-invalid' ) ).toBeNull();
		expect( targetInput.getAttribute( 'min' ) ).toBe( '1' );
		expect( targetInput.getAttribute( 'max' ) ).toBe( '20' );
		expect( targetInput.getAttribute( 'step' ) ).toBe( '1' );
		expect( targetInput.getAttribute( 'aria-invalid' ) ).toBeNull();
	} );

	/**
	 * Row RFの入力問題がある入力だけを無効状態として公開し、既存の入力範囲を修正情報として関連付けることを確認する。
	 *
	 * 事前条件:
	 * - RFはRow入力を表示している。
	 * - 移動元だけが現在Tableの行番号範囲外である。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - 移動元だけが入力問題ありとして公開される。
	 * - 移動元・移動先の両方から現在の入力範囲を確認できる。
	 */
	it( 'when only the source row has an input problem, should mark only that input invalid and associate the row range', () => {
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'row',
			input: {
				sourceRowNumber: '21',
				targetRowNumber: '5',
				position: 'above',
			},
			rowCount: 20,
			result: {
				status: 'not-ready',
				inputProblems: [
					{
						target: 'source',
						correction: { kind: 'row-number-range', min: 1, max: 20 },
					},
				],
			},
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		const sourceInput = screen.getByRole( 'spinbutton', { name: 'Row to move' } );
		const targetInput = screen.getByRole( 'spinbutton', { name: 'Target row' } );
		const range = screen.getByText( 'Enter an integer from 1 to 20.' );

		expect( sourceInput.getAttribute( 'aria-invalid' ) ).toBe( 'true' );
		expect( targetInput.getAttribute( 'aria-invalid' ) ).toBeNull();
		expect( sourceInput.getAttribute( 'aria-describedby' ) ).toBe( range.id );
		expect( targetInput.getAttribute( 'aria-describedby' ) ).toBe( range.id );
	} );

	/**
	 * Column Table Integrationから見出し付き列記述を受け取った場合、列番号と組み合わせた選択肢を表示することを確認する。
	 *
	 * 事前条件:
	 * - RFはColumn入力を表示している。
	 * - 現在列には見出し付きの1列目と、見出しなしの2列目がある。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - 移動元・移動先の両方で、1列目は「商品名（1列目）」と表示される。
	 * - 見出しのない2列目は列番号だけで表示される。
	 */
	it( 'when column descriptors include a heading, should show the heading together with the column number', () => {
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'column',
			input: {
				sourceColumnIndex: null,
				targetColumnIndex: null,
				position: null,
			},
			columns: [
				{ columnIndex: 0, columnNumber: 1, heading: '商品名' },
				{ columnIndex: 1, columnNumber: 2, heading: null },
			],
			result: { status: 'not-ready', inputProblems: [] },
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		expect( screen.getAllByRole( 'option', { name: '商品名 (Column 1)' } ) ).toHaveLength( 2 );
		expect( screen.getAllByRole( 'option', { name: 'Column 2' } ) ).toHaveLength( 2 );
		expect(
			screen.getByRole( 'combobox', { name: 'Column to move' } ).getAttribute( 'aria-invalid' )
		).toBeNull();
		expect(
			screen.getByRole( 'combobox', { name: 'Target column' } ).getAttribute( 'aria-invalid' )
		).toBeNull();
	} );

	/**
	 * Column RFで現在の列選択肢から消えた入力だけに再選択情報を関連付けることを確認する。
	 *
	 * 事前条件:
	 * - RFはColumn入力を表示している。
	 * - 移動先だけが現在の列選択肢から消えている。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - 移動先だけが入力問題ありとして公開される。
	 * - 移動先から既存の再選択メッセージを確認できる。
	 */
	it( 'when only the target column is no longer available, should associate the reselection message only with that select', () => {
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'column',
			input: {
				sourceColumnIndex: 0,
				targetColumnIndex: 9,
				position: 'right',
			},
			columns: [
				{ columnIndex: 0, columnNumber: 1, heading: '商品名' },
				{ columnIndex: 1, columnNumber: 2, heading: null },
			],
			result: {
				status: 'not-ready',
				inputProblems: [ { target: 'target', correction: { kind: 'select-current-column' } } ],
			},
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		const sourceSelect = screen.getByRole( 'combobox', { name: 'Column to move' } );
		const targetSelect = screen.getByRole( 'combobox', { name: 'Target column' } );
		const problem = screen.getByText(
			'The selected column is no longer available. Select a column again.'
		);

		expect( sourceSelect.getAttribute( 'aria-invalid' ) ).toBeNull();
		expect( sourceSelect.getAttribute( 'aria-describedby' ) ).toBeNull();
		expect( targetSelect.getAttribute( 'aria-invalid' ) ).toBe( 'true' );
		expect( targetSelect.getAttribute( 'aria-describedby' ) ).toBe( problem.id );
	} );

	/**
	 * Row RFの結合セル拒否結果を表示するとき、Table Integrationの0-based位置を利用者向け1-based位置へ変換することを確認する。
	 *
	 * 事前条件:
	 * - Row RFは0〜1行・2〜3列を占有する結合セルを原因として拒否されている。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - 行結合メッセージ境界へ1〜2行・3〜4列として渡される。
	 */
	it( 'when a row merged-cell rejection is shown, should pass user-facing 1-based positions to the message boundary', () => {
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'row',
			input: {
				sourceRowNumber: '1',
				targetRowNumber: '3',
				position: 'below',
			},
			rowCount: 4,
			result: {
				status: 'rejected',
				blockingMergedRange: {
					rowStart: 0,
					rowEnd: 1,
					columnStart: 2,
					columnEnd: 3,
				},
			},
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		expect(
			screen.getByText( 'A merged cell spanning rows 1–2 and columns 3–4 prevents this move.' )
		).toBeTruthy();
		expect(
			screen.getByRole( 'spinbutton', { name: 'Row to move' } ).getAttribute( 'aria-invalid' )
		).toBeNull();
		expect(
			screen.getByRole( 'spinbutton', { name: 'Target row' } ).getAttribute( 'aria-invalid' )
		).toBeNull();
	} );

	/**
	 * 利用不能結果は現在指定全体の状態として提示し、個別入力のvalidationへ変換しないことを確認する。
	 *
	 * 事前条件:
	 * - Row RFの入力値は入力済みである。
	 * - 現在Tableを安全に利用できず、RF Interactionが利用不能を公開している。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - 利用不能メッセージが現在指定全体の状態として表示される。
	 * - 移動元・移動先は入力問題ありとして公開されない。
	 */
	it( 'when the current row selection is unavailable, should keep input validation separate from the overall result', () => {
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'row',
			input: {
				sourceRowNumber: '2',
				targetRowNumber: '5',
				position: 'above',
			},
			rowCount: null,
			result: { status: 'unavailable' },
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		expect(
			screen.getByText(
				"This reorder can't continue with the current table. Check the table and try again."
			)
		).toBeTruthy();
		expect(
			screen.getByRole( 'spinbutton', { name: 'Row to move' } ).getAttribute( 'aria-invalid' )
		).toBeNull();
		expect(
			screen.getByRole( 'spinbutton', { name: 'Target row' } ).getAttribute( 'aria-invalid' )
		).toBeNull();
	} );

	/**
	 * no-opは現在指定全体の状態として提示し、個別入力のvalidationへ変換しないことを確認する。
	 *
	 * 事前条件:
	 * - Row RFの入力自体は成立している。
	 * - 現在指定は並び順を変更しないno-opである。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - no-opメッセージが現在指定全体の状態として表示される。
	 * - 移動元・移動先は入力問題ありとして公開されない。
	 * - 並び替え操作は実行できない。
	 */
	it( 'when the current row selection is a no-op, should keep input validation valid and disable apply from the interaction contract', () => {
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'row',
			input: {
				sourceRowNumber: '2',
				targetRowNumber: '2',
				position: 'above',
			},
			rowCount: 20,
			result: { status: 'no-op' },
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		const noOpMessage = screen.getByText( "This selection won't change the order." );
		expect( noOpMessage ).toBeTruthy();
		expect( noOpMessage.getAttribute( 'role' ) ).toBeNull();
		expect( screen.getByRole( 'status' ) ).toBeTruthy();
		expect(
			screen.getByRole( 'spinbutton', { name: 'Row to move' } ).getAttribute( 'aria-invalid' )
		).toBeNull();
		expect(
			screen.getByRole( 'spinbutton', { name: 'Target row' } ).getAttribute( 'aria-invalid' )
		).toBeNull();
		expect( screen.getByRole( 'button', { name: 'Reorder' } ).hasAttribute( 'disabled' ) ).toBe(
			true
		);
	} );

	/**
	 * Column RFの結合セル拒否結果を表示するとき、sectionを保ったまま内部位置を利用者向け1-based位置へ変換することを確認する。
	 *
	 * 事前条件:
	 * - Column RFはfootの1〜2行・3〜4列を占有する結合セルを原因として拒否されている。
	 *
	 * 操作:
	 * - RF入力Popoverを表示する。
	 *
	 * 期待結果:
	 * - 列結合メッセージ境界へfoot・2〜3行・4〜5列として渡される。
	 */
	it( 'when a column merged-cell rejection is shown, should preserve the section and pass user-facing 1-based positions to the message boundary', () => {
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'column',
			input: {
				sourceColumnIndex: 0,
				targetColumnIndex: 2,
				position: 'right',
			},
			columns: [
				{ columnIndex: 0, columnNumber: 1, heading: null },
				{ columnIndex: 1, columnNumber: 2, heading: null },
				{ columnIndex: 2, columnNumber: 3, heading: null },
			],
			result: {
				status: 'rejected',
				blockingMergedRange: {
					section: 'foot',
					rowStart: 1,
					rowEnd: 2,
					columnStart: 3,
					columnEnd: 4,
				},
			},
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		expect(
			screen.getByText(
				'A merged cell spanning footer rows 2–3 and columns 4–5 prevents this move.'
			)
		).toBeTruthy();
	} );

	/**
	 * RFの方向選択をRF Interactionの現在Sessionへ通知することを確認する。
	 *
	 * 事前条件:
	 * - Row RFがopenである。
	 *
	 * 操作:
	 * - Column方向を選択する。
	 *
	 * 期待結果:
	 * - 現在TableのRF Sessionに対してColumn方向の選択が通知される。
	 */
	it( 'when the column direction is selected, should delegate the direction change to RF Interaction', () => {
		const anchor = document.createElement( 'button' );

		render(
			<ReorderFormPopover anchor={ anchor } state={ createRowState() } tableIdentity="table-a" />
		);
		fireEvent.click( screen.getByRole( 'radio', { name: 'Columns' } ) );

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
			kind: 'column',
		} );
	} );

	/**
	 * 並び替え操作の実行可否をRF InteractionのcanApplyだけから提示することを確認する。
	 *
	 * 事前条件:
	 * - RF Interactionは成立済み結果を公開している。
	 *
	 * 操作:
	 * - canApplyがfalseの状態とtrueの状態を順に表示する。
	 *
	 * 期待結果:
	 * - falseでは並び替え操作が無効になる。
	 * - trueでは並び替え操作が有効になる。
	 */
	it( 'when canApply changes, should expose the apply state from the interaction contract', () => {
		const anchor = document.createElement( 'button' );
		const disabledState: RfInteractionReactState = {
			...createRowState(),
			result: { status: 'resolved' },
			canApply: false,
		};
		const rendered = render(
			<ReorderFormPopover anchor={ anchor } state={ disabledState } tableIdentity="table-a" />
		);

		expect( screen.getByRole( 'button', { name: 'Reorder' } ).hasAttribute( 'disabled' ) ).toBe(
			true
		);

		const enabledState: RfInteractionReactState = {
			...disabledState,
			canApply: true,
		};
		rendered.rerender(
			<ReorderFormPopover anchor={ anchor } state={ enabledState } tableIdentity="table-a" />
		);

		expect( screen.getByRole( 'button', { name: 'Reorder' } ).hasAttribute( 'disabled' ) ).toBe(
			false
		);
	} );

	/**
	 * 狭い表示領域ではRFを折りたたんでTable確認へ退避できることを確認する。
	 *
	 * 事前条件:
	 * - RF Sessionがopenである。
	 * - RF anchorが属する表示環境はnarrow表示である。
	 *
	 * 操作:
	 * - RFを折りたたむ。
	 *
	 * 期待結果:
	 * - 入力欄が隠れる。
	 * - 現在の移動元、移動先、位置関係の要約が表示される。
	 * - RFを再展開できる操作が残る。
	 */
	it( 'when the editor viewport is narrow and the form is collapsed, should leave a summary and an expand control', () => {
		setViewportWidth( window, 640 );
		const anchor = document.createElement( 'button' );

		render(
			<ReorderFormPopover anchor={ anchor } state={ createRowState() } tableIdentity="table-a" />
		);

		const collapseButton = screen.getByRole( 'button', { name: 'Collapse reorder form' } );
		const controlledId = collapseButton.getAttribute( 'aria-controls' );
		expect( collapseButton.getAttribute( 'aria-expanded' ) ).toBe( 'true' );
		expect( controlledId ).not.toBeNull();
		if ( controlledId === null ) {
			return;
		}
		const controlledContent = document.getElementById( controlledId );
		expect( controlledContent ).not.toBeNull();

		fireEvent.click( collapseButton );

		expect( screen.queryByRole( 'spinbutton', { name: 'Row to move' } ) ).toBeNull();
		expect( controlledContent?.hasAttribute( 'hidden' ) ).toBe( true );
		expect( screen.getByText( '2 → 5 · Above' ) ).toBeTruthy();
		const expandButton = screen.getByRole( 'button', { name: 'Expand reorder form' } );
		expect( expandButton.getAttribute( 'aria-controls' ) ).toBe( controlledId );
		expect( expandButton.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
	} );

	/**
	 * narrow表示でRFを折りたたんでも結果announcementが折りたたみ領域の外に残ることを確認する。
	 *
	 * 事前条件:
	 * - narrow表示のRow RFでno-op結果が成立している。
	 *
	 * 操作:
	 * - RFを折りたたむ。
	 *
	 * 期待結果:
	 * - 入力画面はhiddenになる。
	 * - no-opのAnnouncement live regionはhidden領域の外に残る。
	 */
	it( 'when a narrow form with a result is collapsed, should keep its announcement outside the hidden form content', () => {
		setViewportWidth( window, 640 );
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'row',
			input: {
				sourceRowNumber: '1',
				targetRowNumber: '2',
				position: 'above',
			},
			rowCount: 20,
			result: { status: 'no-op' },
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );

		const collapseButton = screen.getByRole( 'button', { name: 'Collapse reorder form' } );
		const controlledId = collapseButton.getAttribute( 'aria-controls' );
		expect( controlledId ).not.toBeNull();
		if ( controlledId === null ) {
			return;
		}
		const controlledContent = document.getElementById( controlledId );
		expect( controlledContent ).not.toBeNull();

		fireEvent.click( collapseButton );

		const announcement = screen.getByRole( 'status' );
		expect( controlledContent?.hasAttribute( 'hidden' ) ).toBe( true );
		expect( controlledContent?.contains( announcement ) ).toBe( false );
	} );

	/**
	 * 折りたたみ時に未指定の位置関係を選択済みとして表示しないことを確認する。
	 *
	 * 事前条件:
	 * - narrow表示のRow RFで移動元、移動先、位置関係が未指定である。
	 *
	 * 操作:
	 * - RFを折りたたむ。
	 *
	 * 期待結果:
	 * - 未指定の各値が「–」として要約表示される。
	 */
	it( 'when an incomplete row input is collapsed, should show the unselected position as unspecified', () => {
		setViewportWidth( window, 640 );
		const state: RfInteractionReactState = {
			status: 'open',
			kind: 'row',
			input: {
				sourceRowNumber: '',
				targetRowNumber: '',
				position: null,
			},
			rowCount: 20,
			result: { status: 'not-ready', inputProblems: [] },
			canApply: false,
		};
		const anchor = document.createElement( 'button' );

		render( <ReorderFormPopover anchor={ anchor } state={ state } tableIdentity="table-a" /> );
		fireEvent.click( screen.getByRole( 'button', { name: 'Collapse reorder form' } ) );

		expect( screen.getByText( '– → – · –' ) ).toBeTruthy();
	} );

	/**
	 * 同じRF Session中にwideとnarrowを往復してもnarrowの折りたたみ状態を維持することを確認する。
	 *
	 * 事前条件:
	 * - narrow表示のRFを利用者が折りたたんでいる。
	 *
	 * 操作:
	 * - 表示領域をwideへ広げる。
	 * - その後、同じRF Sessionのままnarrowへ戻す。
	 *
	 * 期待結果:
	 * - wide表示では通常の入力画面が表示される。
	 * - narrowへ戻ると折りたたみ状態が復元される。
	 */
	it( 'when a collapsed narrow form switches to wide and back during the same session, should restore the collapsed narrow state', () => {
		setViewportWidth( window, 640 );
		const anchor = document.createElement( 'button' );

		render(
			<ReorderFormPopover anchor={ anchor } state={ createRowState() } tableIdentity="table-a" />
		);
		fireEvent.click( screen.getByRole( 'button', { name: 'Collapse reorder form' } ) );

		setViewportWidth( window, 1024 );
		notifyViewportResize( window );
		expect( screen.queryByRole( 'button', { name: 'Expand reorder form' } ) ).toBeNull();
		expect( screen.getByRole( 'spinbutton', { name: 'Row to move' } ) ).toBeTruthy();

		setViewportWidth( window, 640 );
		notifyViewportResize( window );
		expect( screen.getByRole( 'button', { name: 'Expand reorder form' } ) ).toBeTruthy();
		expect( screen.queryByRole( 'spinbutton', { name: 'Row to move' } ) ).toBeNull();
	} );

	/**
	 * RFのnarrow判定がglobal windowではなく現在のEditor表示環境を基準にすることを確認する。
	 *
	 * 事前条件:
	 * - 外側の表示環境はwideである。
	 * - RF anchorは幅の狭いiframe内のEditor表示環境に属している。
	 *
	 * 操作:
	 * - iframe内のanchorを基準にRFを表示する。
	 *
	 * 期待結果:
	 * - iframe側の表示幅に従ってnarrow表示の折りたたみ操作が提供される。
	 */
	it( 'when the RF anchor belongs to a narrow iframe editor, should use that editor viewport instead of the global window', () => {
		setViewportWidth( window, 1200 );
		const iframe = document.createElement( 'iframe' );
		document.body.appendChild( iframe );
		const iframeDocument = iframe.contentDocument;
		const iframeWindow = iframe.contentWindow;
		expect( iframeDocument ).not.toBeNull();
		expect( iframeWindow ).not.toBeNull();
		if ( iframeDocument === null || iframeWindow === null ) {
			return;
		}
		setViewportWidth( iframeWindow, 640 );
		const anchor = iframeDocument.createElement( 'button' );

		const rendered = render(
			<ReorderFormPopover anchor={ anchor } state={ createRowState() } tableIdentity="table-a" />
		);

		expect( screen.getByRole( 'button', { name: 'Collapse reorder form' } ) ).toBeTruthy();

		rendered.unmount();
		iframe.remove();
	} );
} );
