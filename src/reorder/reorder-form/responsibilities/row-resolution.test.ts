/**
 * Row RF Resolutionが解釈済み指定を要求時点の現在tbodyへ照合し、移動候補、no-op、構造拒否、利用不能を方向固有結果として解決するContractを確認する。
 */

import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import { rowRfResolution } from './row-resolution';

jest.mock( '@/reorder/row-reorder/responsibilities/table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		getBlockingMergedRange: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.MockedFunction<
	typeof rowTableIntegration.getConstraints
>;
const getBlockingMergedRangeMock =
	rowTableIntegration.getBlockingMergedRange as jest.MockedFunction<
		typeof rowTableIntegration.getBlockingMergedRange
	>;

const currentConstraints = {
	rowCount: 6,
	blockedBoundaries: [],
} as const;

describe( 'Row RF Resolution', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReturnValue( currentConstraints );
		getBlockingMergedRangeMock.mockReturnValue( null );
	} );

	/**
	 * 移動前Table上のtargetと上下指定を、現在tbody基準の移動先境界へ変換できることを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableには6行存在し、結合セル制約はない。
	 * - sourceとtargetは現在範囲内に存在する。
	 *
	 * 操作:
	 * - targetの上または下へのRow RF指定を解決する。
	 *
	 * 期待結果:
	 * - 移動前Table基準の正しいdestination boundaryを持つ`resolved`候補が返る。
	 */
	it.each( [
		[ 'above' as const, 4 ],
		[ 'below' as const, 5 ],
	] )(
		'when a current Row target is resolved %s, should return the pre-move destination boundary',
		( position, destinationBoundaryIndex ) => {
			expect(
				rowRfResolution.resolve( 'table-a', {
					sourceRowIndex: 1,
					targetRowIndex: 4,
					position,
				} )
			).toEqual( {
				status: 'resolved',
				candidate: {
					clientId: 'table-a',
					sourceRowIndex: 1,
					destinationBoundaryIndex,
				},
			} );
		}
	);

	/**
	 * 並び順が変わらないRow指定では結合セル制約よりno-opを優先することを確認する。
	 *
	 * 事前条件:
	 * - sourceの直前または直後を移動先境界とする指定が成立している。
	 *
	 * 操作:
	 * - Row RF指定を解決する。
	 *
	 * 期待結果:
	 * - `no-op`が返る。
	 * - 結合セル診断は要求されない。
	 */
	it.each( [
		[ 2, 'above' as const ],
		[ 1, 'below' as const ],
	] )(
		'when a Row move would keep the current order, should return no-op before structural rejection',
		( targetRowIndex, position ) => {
			expect(
				rowRfResolution.resolve( 'table-a', {
					sourceRowIndex: 2,
					targetRowIndex,
					position,
				} )
			).toEqual( { status: 'no-op' } );
			expect( getBlockingMergedRangeMock ).not.toHaveBeenCalled();
		}
	);

	/**
	 * 現在Tableを利用できない場合や、入力成立後にsource / targetが現在範囲外になった場合を候補成立と区別することを確認する。
	 *
	 * 操作:
	 * - 利用不能なTable、または現在範囲へ照合できないRow指定を解決する。
	 *
	 * 期待結果:
	 * - `unavailable`が返り、候補は推測されない。
	 */
	it( 'when the current Row table or selected positions cannot be resolved, should return unavailable', () => {
		getConstraintsMock.mockReturnValueOnce( null );
		expect(
			rowRfResolution.resolve( 'table-a', {
				sourceRowIndex: 1,
				targetRowIndex: 4,
				position: 'above',
			} )
		).toEqual( { status: 'unavailable' } );

		getConstraintsMock.mockReturnValueOnce( { rowCount: 3, blockedBoundaries: [] } );
		expect(
			rowRfResolution.resolve( 'table-a', {
				sourceRowIndex: 1,
				targetRowIndex: 4,
				position: 'above',
			} )
		).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 実際に並び順が変わる候補が縦結合制約に抵触した場合、Table Integrationの方向固有診断をそのまま公開することを確認する。
	 *
	 * 事前条件:
	 * - source / target / destinationは現在Tableに存在する。
	 * - 候補を妨げる縦結合範囲が存在する。
	 *
	 * 操作:
	 * - Row RF指定を解決する。
	 *
	 * 期待結果:
	 * - `rejected`と最初の`RowBlockingMergedRange`が返る。
	 */
	it( 'when a changing Row move is blocked by a merged range, should return rejected with the blocking range', () => {
		getBlockingMergedRangeMock.mockReturnValue( { rowStart: 2, rowEnd: 4 } );

		expect(
			rowRfResolution.resolve( 'table-a', {
				sourceRowIndex: 0,
				targetRowIndex: 4,
				position: 'below',
			} )
		).toEqual( {
			status: 'rejected',
			blockingMergedRange: { rowStart: 2, rowEnd: 4 },
		} );
	} );
} );
