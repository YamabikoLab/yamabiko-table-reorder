/**
 * 列並び替えに固有のReorder Target Resolution規則を確認する単体テスト。
 */
import { createReorderTargetResolution } from '@/reorder/reorder-target-resolution';
import type { TableIntegration, TableStructure } from '@/reorder/table-integration';

const createIntegration = ( structure: TableStructure ): TableIntegration => ( {
	getStructure: jest.fn().mockReturnValue( structure ),
} );

describe( 'Column Reorder Target Resolution', () => {
	/**
	 * 列DnDの開始対象がいずれかのTable区画の横結合範囲に含まれる場合にDnDを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - `foot`区画に`columnStart = 1`、`columnSpan = 3`の横結合がある。
	 * - 開始対象はその範囲内の論理列2である。
	 *
	 * 操作:
	 * - 列DnDの開始対象を`resolve()`で判定する。
	 *
	 * 期待結果:
	 * - `merged-cell`を理由とする`immovable`結果になる。
	 */
	it( 'when a column starts inside any colspan range, should return merged-cell', () => {
		const resolution = createReorderTargetResolution(
			createIntegration( {
				mergedCells: [
					{
						section: 'foot',
						rowStart: 0,
						columnStart: 1,
						rowSpan: 1,
						columnSpan: 3,
					},
				],
			} )
		);

		expect(
			resolution.resolve( {
				kind: 'column',
				clientId: 'table-client-id',
				columnIndex: 2,
			} )
		).toEqual( {
			status: 'immovable',
			reason: 'merged-cell',
		} );
	} );

	/**
	 * 列DnDではTable全体の横結合から内部境界を重複なし・昇順で導出することを確認する。
	 *
	 * 事前条件:
	 * - `head`、`body`、`foot`に横結合があり、一部の内部境界が重複している。
	 * - `body`区画には縦結合だけのセルもある。
	 * - 開始対象の列はどの横結合範囲にも含まれない。
	 *
	 * 操作:
	 * - 列DnDの開始対象を`resolve()`で判定する。
	 *
	 * 期待結果:
	 * - 論理列がReorder Targetとして返る。
	 * - 横結合の内部境界だけが重複なし・昇順の`[ 1, 2, 3 ]`として返る。
	 */
	it( 'when a movable column is resolved, should derive unique sorted colspan boundaries from the whole table', () => {
		const resolution = createReorderTargetResolution(
			createIntegration( {
				mergedCells: [
					{ section: 'head', rowStart: 0, columnStart: 0, rowSpan: 1, columnSpan: 3 },
					{ section: 'body', rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 3 },
					{ section: 'foot', rowStart: 0, columnStart: 0, rowSpan: 1, columnSpan: 2 },
					{ section: 'body', rowStart: 3, columnStart: 5, rowSpan: 2, columnSpan: 1 },
				],
			} )
		);

		expect(
			resolution.resolve( {
				kind: 'column',
				clientId: 'table-client-id',
				columnIndex: 4,
			} )
		).toEqual( {
			status: 'movable',
			target: { kind: 'column', clientId: 'table-client-id', columnIndex: 4 },
			constraints: { blockedBoundaries: [ 1, 2, 3 ] },
		} );
	} );
} );
