/**
 * Chat Reorder CommandがTable更新を直接行わず、既存RF Interaction入力へだけ接続されることを確認する。
 */

import { submitChatCommandToRf } from './rf-input-adapter';

const mockOpen = jest.fn();
const mockSelectKind = jest.fn();
const mockUpdateRowInput = jest.fn();
const mockUpdateColumnInput = jest.fn();
const mockRequestApply = jest.fn();
let mockColumns: Array< { columnIndex: number; columnNumber: number; heading: string | null } > | null =
	null;

jest.mock( '@/reorder/reorder-form/responsibilities/interaction', () => ( {
	rfInteraction: {
		open: ( tableIdentity: string ) => mockOpen( tableIdentity ),
		selectKind: ( tableIdentity: string, kind: 'row' | 'column' ) =>
			mockSelectKind( tableIdentity, kind ),
		updateRowInput: ( tableIdentity: string, input: unknown ) =>
			mockUpdateRowInput( tableIdentity, input ),
		updateColumnInput: ( tableIdentity: string, input: unknown ) =>
			mockUpdateColumnInput( tableIdentity, input ),
		requestApply: ( tableIdentity: string ) => mockRequestApply( tableIdentity ),
	},
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/table-integration', () => ( {
	columnTableIntegration: {
		getColumnInputDescriptors: () => mockColumns,
	},
} ) );

describe( 'Chat Reorder RF input adapter', () => {
	beforeEach( () => {
		mockColumns = null;
		jest.clearAllMocks();
	} );

	/**
	 * Row Commandが既存RF InteractionのRow入力として反映要求まで接続されることを確認する。
	 *
	 * 操作:
	 * - 2行目を5行目の前へ移動するCommandを入力する。
	 *
	 * 期待結果:
	 * - RF SessionでRowを選択し、1-based番号とbeforeを既存Row入力へ変換する。
	 * - 反映はRFのrequestApplyへ委ねる。
	 */
	it( 'when a row command is submitted, should route the request through the existing RF interaction', () => {
		const result = submitChatCommandToRf(
			{ kind: 'row', sourceRowNumber: 2, position: 'before', targetRowNumber: 5 },
			'table-a'
		);

		expect( result ).toEqual( { status: 'submitted' } );
		expect( mockOpen ).toHaveBeenCalledWith( 'table-a' );
		expect( mockSelectKind ).toHaveBeenCalledWith( 'table-a', 'row' );
		expect( mockUpdateRowInput ).toHaveBeenCalledWith( 'table-a', {
			sourceRowNumber: '2',
			targetRowNumber: '5',
			position: 'above',
		} );
		expect( mockRequestApply ).toHaveBeenCalledWith( 'table-a' );
	} );

	/**
	 * Column labelが現在Tableで一意に解決できる場合だけRF Column入力へ接続されることを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableには商品名・価格・在庫の3列が存在する。
	 *
	 * 操作:
	 * - 価格列を1列目の後へ移動するCommandを入力する。
	 *
	 * 期待結果:
	 * - labelと列番号を現在descriptorへ照合し、既存Column入力へ0-based Identityを渡す。
	 */
	it( 'when column selectors resolve uniquely, should route the resolved identities through RF', () => {
		mockColumns = [
			{ columnIndex: 0, columnNumber: 1, heading: '商品名' },
			{ columnIndex: 1, columnNumber: 2, heading: '価格' },
			{ columnIndex: 2, columnNumber: 3, heading: '在庫' },
		];

		const result = submitChatCommandToRf(
			{
				kind: 'column',
				source: { kind: 'label', label: '価格' },
				position: 'after',
				target: { kind: 'number', columnNumber: 1 },
			},
			'table-a'
		);

		expect( result ).toEqual( { status: 'submitted' } );
		expect( mockUpdateColumnInput ).toHaveBeenCalledWith( 'table-a', {
			sourceColumnIndex: 1,
			targetColumnIndex: 0,
			position: 'right',
		} );
		expect( mockRequestApply ).toHaveBeenCalledWith( 'table-a' );
	} );

	/**
	 * Column labelを現在Tableへ一意に照合できない場合に反映へ進まないことを確認する。
	 *
	 * 事前条件:
	 * - 同じ見出しを持つ列が複数存在する。
	 *
	 * 操作:
	 * - 重複labelを移動元にしたColumn Commandを入力する。
	 *
	 * 期待結果:
	 * - selector解決不能を返し、RF SessionやApplyを開始しない。
	 */
	it( 'when a column label is ambiguous, should reject it before starting RF apply', () => {
		mockColumns = [
			{ columnIndex: 0, columnNumber: 1, heading: '価格' },
			{ columnIndex: 1, columnNumber: 2, heading: '価格' },
		];

		const result = submitChatCommandToRf(
			{
				kind: 'column',
				source: { kind: 'label', label: '価格' },
				position: 'before',
				target: { kind: 'number', columnNumber: 1 },
			},
			'table-a'
		);

		expect( result ).toEqual( { status: 'unresolved-column' } );
		expect( mockOpen ).not.toHaveBeenCalled();
		expect( mockRequestApply ).not.toHaveBeenCalled();
	} );
} );
