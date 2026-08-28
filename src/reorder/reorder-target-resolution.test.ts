import type { TableIntegration } from './table-integration';
import { createReorderTargetResolution } from './reorder-target-resolution';

const createIntegration = (
	structure: ReturnType< TableIntegration[ 'getStructure' ] >
): TableIntegration => ( {
	getStructure: jest.fn().mockReturnValue( structure ),
} );

describe( 'Reorder Target Resolution', () => {
	/**
	 * 共通Table structureを取得できない場合にDnDを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - Table Integrationが対象clientIdの共通Table structureを提供できない。
	 *
	 * 操作:
	 * - 行DnDの開始対象をresolve()する。
	 *
	 * 期待結果:
	 * - `table-structure-unavailable`を理由とするimmovable結果になる。
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
	 * 行DnDではbody section以外の開始対象を移動対象にしないことを確認する。
	 *
	 * 事前条件:
	 * - 共通Table structureは取得できる。
	 * - 開始対象はhead sectionの行である。
	 *
	 * 操作:
	 * - 行DnDの開始対象をresolve()する。
	 *
	 * 期待結果:
	 * - `target-out-of-scope`を理由とするimmovable結果になる。
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
	 * 行DnDの開始対象がbody sectionの縦結合範囲に含まれる場合にDnDを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - body sectionに`rowStart = 1`、`rowSpan = 3`の縦結合がある。
	 * - 開始対象はその範囲内のrow index 2である。
	 *
	 * 操作:
	 * - 行DnDの開始対象をresolve()する。
	 *
	 * 期待結果:
	 * - `merged-cell`を理由とするimmovable結果になる。
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
	 * 行DnDではbody sectionの縦結合だけを制約へ変換することを確認する。
	 *
	 * 事前条件:
	 * - body sectionに内部境界2,3を持つ縦結合がある。
	 * - body sectionに横結合だけのセルがある。
	 * - head sectionにも縦結合がある。
	 * - 開始対象はどの縦結合範囲にも含まれないbody rowである。
	 *
	 * 操作:
	 * - 行DnDの開始対象をresolve()する。
	 *
	 * 期待結果:
	 * - body rowがReorder Targetとして返る。
	 * - `blockedBoundaries`はbody sectionの縦結合から導出した`[ 2, 3 ]`だけになる。
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
	 * 列DnDの開始対象がいずれかのsectionの横結合範囲に含まれる場合にDnDを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - foot sectionに`columnStart = 1`、`columnSpan = 3`の横結合がある。
	 * - 開始対象はその範囲内のlogical column 2である。
	 *
	 * 操作:
	 * - 列DnDの開始対象をresolve()する。
	 *
	 * 期待結果:
	 * - `merged-cell`を理由とするimmovable結果になる。
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
	 * - head / body / footに横結合があり、一部の内部境界が重複している。
	 * - body sectionには縦結合だけのセルもある。
	 * - 開始対象の列はどの横結合範囲にも含まれない。
	 *
	 * 操作:
	 * - 列DnDの開始対象をresolve()する。
	 *
	 * 期待結果:
	 * - logical columnがReorder Targetとして返る。
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
	 * 負数や小数の開始indexをReorder Targetとして扱わないことを確認する。
	 *
	 * 事前条件:
	 * - 共通Table structureは取得できる。
	 * - 開始対象の論理indexが負数または小数である。
	 *
	 * 操作:
	 * - 行・列DnDの開始対象をresolve()する。
	 *
	 * 期待結果:
	 * - どちらも`target-out-of-scope`を理由とするimmovable結果になる。
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
