/**
 * 行並び替えに固有のReorder Target Resolution規則を確認する単体テスト。
 */
import { createReorderTargetResolution } from '@/reorder/core/reorder-target-resolution';
import type { TableIntegration, TableStructure } from '@/reorder/foundation/table-integration';

const createIntegration = ( structure: TableStructure ): TableIntegration => ( {
	getStructure: jest.fn().mockReturnValue( structure ),
} );

describe( 'Row Reorder Target Resolution', () => {
	/**
	 * 行DnDでは`body`区画以外の開始対象を並び替え対象にしないことを確認する。
	 *
	 * 事前条件:
	 * - 共通Table構造は取得できる。
	 * - 開始対象は`head`区画の行である。
	 *
	 * 操作:
	 * - 行DnDの開始対象を`resolve()`で判定する。
	 *
	 * 期待結果:
	 * - `target-out-of-scope`を理由とする`immovable`結果になる。
	 */
	it( 'when row reorder starts outside the body section, should return target-out-of-scope', () => {
		const resolution = createReorderTargetResolution( createIntegration( { mergedCells: [] } ) );

		expect(
			resolution.resolve( {
				kind: 'row',
				clientId: 'table-client-id',
				section: 'head',
				rowIndex: 0,
			} )
		).toEqual( {
			status: 'immovable',
			reason: 'target-out-of-scope',
		} );
	} );

	/**
	 * 行DnDの開始対象が`body`区画の縦結合範囲に含まれる場合にDnDを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - `body`区画に`rowStart = 1`、`rowSpan = 3`の縦結合がある。
	 * - 開始対象はその範囲内の行インデックス2である。
	 *
	 * 操作:
	 * - 行DnDの開始対象を`resolve()`で判定する。
	 *
	 * 期待結果:
	 * - `merged-cell`を理由とする`immovable`結果になる。
	 */
	it( 'when a row starts inside a body rowspan range, should return merged-cell', () => {
		const resolution = createReorderTargetResolution(
			createIntegration( {
				mergedCells: [
					{
						section: 'body',
						rowStart: 1,
						columnStart: 0,
						rowSpan: 3,
						columnSpan: 1,
					},
				],
			} )
		);

		expect(
			resolution.resolve( {
				kind: 'row',
				clientId: 'table-client-id',
				section: 'body',
				rowIndex: 2,
			} )
		).toEqual( {
			status: 'immovable',
			reason: 'merged-cell',
		} );
	} );

	/**
	 * 行DnDでは`body`区画の縦結合だけを並び替え制約へ変換することを確認する。
	 *
	 * 事前条件:
	 * - `body`区画に内部境界2、3を持つ縦結合がある。
	 * - `body`区画に横結合だけのセルがある。
	 * - `head`区画にも縦結合がある。
	 * - 開始対象はどの縦結合範囲にも含まれない`body`区画の行である。
	 *
	 * 操作:
	 * - 行DnDの開始対象を`resolve()`で判定する。
	 *
	 * 期待結果:
	 * - `body`区画の行がReorder Targetとして返る。
	 * - `blockedBoundaries`は`body`区画の縦結合から導出した`[ 2, 3 ]`だけになる。
	 */
	it( 'when a movable row is resolved, should derive only body rowspan boundaries', () => {
		const resolution = createReorderTargetResolution(
			createIntegration( {
				mergedCells: [
					{ section: 'body', rowStart: 1, columnStart: 0, rowSpan: 3, columnSpan: 1 },
					{ section: 'body', rowStart: 5, columnStart: 1, rowSpan: 1, columnSpan: 2 },
					{ section: 'head', rowStart: 0, columnStart: 0, rowSpan: 2, columnSpan: 1 },
				],
			} )
		);

		expect(
			resolution.resolve( {
				kind: 'row',
				clientId: 'table-client-id',
				section: 'body',
				rowIndex: 4,
			} )
		).toEqual( {
			status: 'movable',
			target: { kind: 'row', clientId: 'table-client-id', rowIndex: 4 },
			constraints: { blockedBoundaries: [ 2, 3 ] },
		} );
	} );
} );
