/**
 * Reorder ModeとWordPress Editor接続境界のfocused integrationを確認する。
 *
 * 実Editorの描画詳細には依存せず、対応TableへのToolbar入口、排他選択、通常編集との排他、
 * および別Tableへ操作対象が移った場合のLifecycleだけを検証する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import type { ReactElement } from '@wordpress/element';

import { withReorderMode } from './reorder-mode-integration';

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: 'block-controls',
} ) );

jest.mock( '@wordpress/components', () => ( {
	ToolbarButton: 'toolbar-button',
	ToolbarGroup: 'toolbar-group',
} ) );

jest.mock( '@wordpress/element', () => ( {
	useEffect: ( effect: () => void ) => effect(),
	useSyncExternalStore: ( _subscribe: unknown, getSnapshot: () => number ) => getSnapshot(),
} ) );

jest.mock( '@wordpress/icons', () => ( {
	tableColumnAfter: 'table-column-after',
	tableRowAfter: 'table-row-after',
} ) );

type TableBlockEditProps = BlockEditProps< Record< string, unknown > > & {
	name: string;
};

type ElementWithProps = ReactElement< {
	children?: ReactElement | ReactElement[];
	isPressed?: boolean;
	onClick?: () => void;
	onClickCapture?: unknown;
	onDoubleClickCapture?: unknown;
	onMouseDownCapture?: unknown;
	onPointerDownCapture?: unknown;
} >;

/**
 * HOCが返した対応Table専用componentを実行し、現在のReorder Mode表示を取得する。
 *
 * @param Wrapped Reorder Modeへ接続済みのBlockEdit component。
 * @param props Gutenbergから渡されるTable Block props。
 * @return 現在状態を反映したReorder Mode接続境界の要素。
 */
const renderIntegration = (
	Wrapped: ReturnType< typeof withReorderMode >,
	props: TableBlockEditProps
): ElementWithProps => {
	const integrationElement = Wrapped( props ) as ReactElement;
	const IntegrationComponent = integrationElement.type as (
		componentProps: unknown
	) => ReactElement;

	return IntegrationComponent( integrationElement.props ) as ElementWithProps;
};

/**
 * Reorder Mode接続境界から行・列ToolbarButtonを取得する。
 *
 * @param rendered Reorder Mode接続境界の描画結果。
 * @return 行入口と列入口のToolbarButton。
 */
const getToolbarButtons = ( rendered: ElementWithProps ) => {
	const children = rendered.props.children as ReactElement[];
	const blockControls = children[ 1 ] as ElementWithProps;
	const toolbarGroup = blockControls.props.children as ElementWithProps;
	const buttons = toolbarGroup.props.children as ElementWithProps[];

	return {
		rowButton: buttons[ 0 ],
		columnButton: buttons[ 1 ],
	};
};

describe( 'Reorder Mode integration', () => {
	const BlockEdit = () => <div>Table</div>;
	const Wrapped = withReorderMode( BlockEdit );

	/**
	 * 行入口と列入口が同じTableで排他的に選択され、選択中だけ通常編集を抑止することを確認する。
	 *
	 * 事前条件:
	 * - 対応Tableが選択され、Reorder Modeは通常編集で開始している。
	 *
	 * 操作:
	 * - 行入口、列入口、選択中の列入口の順に選択する。
	 *
	 * 期待結果:
	 * - 行と列は同時に選択状態にならない。
	 * - 並び替えモード中だけTable内容への編集開始が抑止される。
	 * - 選択中の入口を再選択すると通常編集へ戻る。
	 */
	it( 'when row and column toolbar entries are selected, should keep them exclusive and allow editing only in edit mode', () => {
		const props = {
			attributes: {},
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			setAttributes: jest.fn(),
		} as unknown as TableBlockEditProps;

		let rendered = renderIntegration( Wrapped, props );
		let { rowButton, columnButton } = getToolbarButtons( rendered );
		const editWrapper = ( rendered.props.children as ReactElement[] )[ 0 ] as ElementWithProps;

		expect( rowButton.props.isPressed ).toBe( false );
		expect( columnButton.props.isPressed ).toBe( false );
		expect( editWrapper.props.onPointerDownCapture ).toBeUndefined();

		rowButton.props.onClick?.();
		rendered = renderIntegration( Wrapped, props );
		( { rowButton, columnButton } = getToolbarButtons( rendered ) );
		expect( rowButton.props.isPressed ).toBe( true );
		expect( columnButton.props.isPressed ).toBe( false );
		expect( ( rendered.props.children as ReactElement[] )[ 0 ].props.onPointerDownCapture ).toEqual(
			expect.any( Function )
		);

		columnButton.props.onClick?.();
		rendered = renderIntegration( Wrapped, props );
		( { rowButton, columnButton } = getToolbarButtons( rendered ) );
		expect( rowButton.props.isPressed ).toBe( false );
		expect( columnButton.props.isPressed ).toBe( true );

		columnButton.props.onClick?.();
		rendered = renderIntegration( Wrapped, props );
		( { rowButton, columnButton } = getToolbarButtons( rendered ) );
		expect( rowButton.props.isPressed ).toBe( false );
		expect( columnButton.props.isPressed ).toBe( false );
		expect(
			( rendered.props.children as ReactElement[] )[ 0 ].props.onPointerDownCapture
		).toBeUndefined();
	} );

	/**
	 * 別Tableへ操作対象が移った場合に、前のTableで選択していた並び替えモードを終了することを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えモードが選択されている。
	 *
	 * 操作:
	 * - Table Bを選択状態としてReorder Mode接続境界へ通知する。
	 *
	 * 期待結果:
	 * - Table Bは通常編集で開始し、Table Aの行並び替え選択は維持されない。
	 */
	it( 'when the selected table changes, should return reorder mode to edit for the new table', () => {
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

		let rendered = renderIntegration( Wrapped, tableA );
		getToolbarButtons( rendered ).rowButton.props.onClick?.();
		rendered = renderIntegration( Wrapped, tableA );
		expect( getToolbarButtons( rendered ).rowButton.props.isPressed ).toBe( true );

		rendered = renderIntegration( Wrapped, tableB );
		const { rowButton, columnButton } = getToolbarButtons( rendered );

		expect( rowButton.props.isPressed ).toBe( false );
		expect( columnButton.props.isPressed ).toBe( false );
		expect(
			( rendered.props.children as ReactElement[] )[ 0 ].props.onPointerDownCapture
		).toBeUndefined();
	} );
} );
