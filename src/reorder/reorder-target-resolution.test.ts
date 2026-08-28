/**
 * Reorder Target Resolutionの主要な開始判定規則を確認する単体テスト。
 *
 * 共通Table構造を取得できない場合、行・列の対象範囲、結合セルによる開始制約、
 * DnD中に利用する挿入境界制約について、外部から観測できる判定結果を検証する。
 */
import type { TableIntegration, TableStructure } from './table-integration';
import { createReorderTargetResolution } from './reorder-target-resolution';

const createIntegration = ( structure: TableStructure | null ): TableIntegration => ( {
	getStructure: jest.fn().mockReturnValue( structure ),
} );

describe( 'Reorder Target Resolution', () => {
	/**
	 * 共通Table構造を取得できない場合にDnDを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - Table Integrationが対象`clientId`の共通Table構造を提供できない。
	 *
	 * 操作:
	 * - 行DnDの開始対象を`resolve()`で判定する。
	 *
	 * 期待結果:
	 * - `table-structure-unavailable`を理由とする`immovable`結果になる。
	 */
	it( 'when the current table structure is unavailable, should return table-structure-unavailable', () => {
		const integration = createIntegration( null );
		const resolution = createReorderTargetResolution( integration );

		expect(
			resolution.resolve( {
				kind: 'row',
				clientId: 'table-client-id',
				section: 'body',
				rowIndex: 0,
			} )
		).toEqual( {
			status: 'immovable',
			reason: 'table-structure-unavailable',
		} );
		expect( integration.getStructure ).toHaveBeenCalledWith( 'table-client-id' );
	} );

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
					{
						section: 'body',
						rowStart: 1,
						columnStart: 0,
						rowSpan: 3,
						columnSpan: 1,
					},
					{
						section: 'body',
						rowStart: 5,
						columnStart: 1,
						rowSpan: 1,
						columnSpan: 2,
					},
					{
						section: 'head',
						rowStart: 0,
						columnStart: 0,
						rowSpan: 2,
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
				rowIndex: 4,
			} )
		).toEqual( {
			status: 'movable',
			target: {
				kind: 'row',
				clientId: 'table-client-id',
				rowIndex: 4,
			},
			constraints: {
				blockedBoundaries: [ 2, 3 ],
			},
		} );
	} );

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
					{
						section: 'head',
						rowStart: 0,
						columnStart: 0,
						rowSpan: 1,
						columnSpan: 3,
					},
					{
						section: 'body',
						rowStart: 1,
						columnStart: 1,
						rowSpan: 1,
						columnSpan: 3,
					},
					{
						section: 'foot',
						rowStart: 0,
						columnStart: 0,
						rowSpan: 1,
						columnSpan: 2,
					},
					{
						section: 'body',
						rowStart: 3,
						columnStart: 5,
						rowSpan: 2,
						columnSpan: 1,
					},
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
			target: {
				kind: 'column',
				clientId: 'table-client-id',
				columnIndex: 4,
			},
			constraints: {
				blockedBoundaries: [ 1, 2, 3 ],
			},
		} );
	} );

	/**
	 * 負数や小数の開始位置をReorder Targetとして扱わないことを確認する。
	 *
	 * 事前条件:
	 * - 共通Table構造は取得できる。
	 * - 開始対象の論理インデックスが負数または小数である。
	 *
	 * 操作:
	 * - 行・列DnDの開始対象を`resolve()`で判定する。
	 *
	 * 期待結果:
	 * - どちらも`target-out-of-scope`を理由とする`immovable`結果になる。
	 */
	it( 'when a logical start index is invalid, should return target-out-of-scope', () => {
		const resolution = createReorderTargetResolution( createIntegration( { mergedCells: [] } ) );

		expect(
			resolution.resolve( {
				kind: 'row',
				clientId: 'table-client-id',
				section: 'body',
				rowIndex: -1,
			} )
		).toEqual( {
			status: 'immovable',
			reason: 'target-out-of-scope',
		} );

		expect(
			resolution.resolve( {
				kind: 'column',
				clientId: 'table-client-id',
				columnIndex: 1.5,
			} )
		).toEqual( {
			status: 'immovable',
			reason: 'target-out-of-scope',
		} );
	} );
} );
