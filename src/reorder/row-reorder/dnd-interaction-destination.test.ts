/**
 * 行専用DnD Interactionが、候補境界から実際に行順を変更できる移動先だけを公開状態として保持することを確認する。
 */

import { rowReorderMode } from '@/reorder/reorder-mode';

import { getRowDndDestinationBoundaryIndex, rowDndInteraction } from './dnd-interaction';
import { rowTableIntegration } from './table-integration';
import type { RowReorderConstraints } from './table-integration';

jest.mock( '@/reorder/reorder-mode', () => ( {
	rowReorderMode: {
		resolveAfterDnd: jest.fn(),
	},
} ) );

jest.mock( './table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		applyRowMove: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.MockedFunction<
	typeof rowTableIntegration.getConstraints
>;
const applyRowMoveMock = rowTableIntegration.applyRowMove as jest.MockedFunction<
	typeof rowTableIntegration.applyRowMove
>;
const resolveAfterDndMock = rowReorderMode.resolveAfterDnd as jest.MockedFunction<
	typeof rowReorderMode.resolveAfterDnd
>;

const constraints: RowReorderConstraints = {
	rowCount: 5,
	blockedBoundaries: [],
};

const source = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

/** activeな行DnD Sessionを開始する。 */
const startSession = (): void => {
	const checkedConstraints = rowDndInteraction.prepareStart( source );

	if ( checkedConstraints === null ) {
		throw new Error( 'Test precondition failed: expected row DnD to be startable.' );
	}

	rowDndInteraction.start( source, checkedConstraints );
};

describe( 'Row DnD destination validity', () => {
	beforeEach( () => {
		rowDndInteraction.cancel();
		jest.clearAllMocks();
		getConstraintsMock.mockReset();
		applyRowMoveMock.mockReset();
		resolveAfterDndMock.mockReset();
		getConstraintsMock.mockReturnValue( constraints );
		applyRowMoveMock.mockReturnValue( true );
	} );

	afterEach( () => {
		rowDndInteraction.cancel();
	} );

	/**
	 * 概要:
	 * - 移動元の直前と直後は候補境界として受け取っても、有効な移動先として保持しないことを確認する。
	 *
	 * 事前条件:
	 * - 2行目を移動対象とするactive Sessionが成立している。
	 * - Table構造上は全境界が利用可能である。
	 *
	 * 操作:
	 * - 移動元直前の境界1、直後の境界2を順に移動先候補として更新する。
	 *
	 * 期待結果:
	 * - どちらも現在の有効移動先はnullとなる。
	 */
	it( 'when the candidate is immediately before or after the source row, should expose no valid destination', () => {
		startSession();

		rowDndInteraction.updateDestination( 1 );
		expect( getRowDndDestinationBoundaryIndex() ).toBeNull();

		rowDndInteraction.updateDestination( 2 );
		expect( getRowDndDestinationBoundaryIndex() ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 行順が変わる構造上有効な候補は、現在の有効移動先として保持されることを確認する。
	 *
	 * 事前条件:
	 * - 2行目を移動対象とするactive Sessionが成立している。
	 * - 境界4はTable構造上利用可能であり、移動元直前・直後ではない。
	 *
	 * 操作:
	 * - 境界4を移動先候補として更新する。
	 *
	 * 期待結果:
	 * - 現在の有効移動先として境界4を取得できる。
	 */
	it( 'when the candidate changes the row order and preserves the table structure, should expose it as the valid destination', () => {
		startSession();

		rowDndInteraction.updateDestination( 4 );

		expect( getRowDndDestinationBoundaryIndex() ).toBe( 4 );
	} );
} );
