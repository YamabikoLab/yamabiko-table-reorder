/**
 * 列並び替え固有のTableデータ更新規則がTable全体の論理列を移動し、結合セルを分断しないことを確認する単体テスト。
 */
import { createTableUpdateIntegration } from '@/reorder/foundation/table-update';
import { resolveColumnTableUpdateChanges } from './table-update';

describe( 'Column Table Update', () => {
	/**
	 * Flexible Table Blockの列更新では横結合セルを保持したままTable全区画の論理列順を変更できることを確認する。
	 *
	 * 事前条件:
	 * - `body`の各行は論理4列で、中央2列を占有する横結合セルを含む。
	 * - 列0は単独セルで、横結合範囲の外側から最終列へ移動できる。
	 * - 更新後のBlock取得では要求した属性が反映済みで返る。
	 *
	 * 操作:
	 * - 列0を最終位置3へ移動する更新を要求する。
	 *
	 * 期待結果:
	 * - 横結合セルの`colSpan`やセル内容を変更せず、各行の物理セル順だけが論理列順に合わせて更新される。
	 * - Table全体の変更が1回のBlock属性更新となり、`updated`が返る。
	 */
	it( 'when a Flexible Table Block column update is valid, should preserve merged cells and update all rows once', () => {
		let currentBlock = {
			name: 'flexible-table-block/table',
			attributes: {
				body: [
					{
						cells: [
							{ content: 'A' },
							{ content: 'B-C', colSpan: 2, style: { bold: true } },
							{ content: 'D' },
						],
					},
					{
						cells: [ { content: 'E' }, { content: 'F-G', colSpan: 2 }, { content: 'H' } ],
					},
				],
			},
		};
		const updateBlockAttributes = jest.fn( ( clientId, attributes ) => {
			void clientId;
			currentBlock = {
				...currentBlock,
				attributes: { ...currentBlock.attributes, ...attributes },
			};
		} );
		const integration = createTableUpdateIntegration( {
			getBlock: jest.fn( () => currentBlock ),
			updateBlockAttributes,
		} );

		expect(
			integration.updateReorder(
				{
					kind: 'column',
					clientId: 'table-client-id',
					sourceIndex: 0,
					destinationIndex: 3,
				},
				resolveColumnTableUpdateChanges
			)
		).toEqual( { status: 'updated' } );
		expect( updateBlockAttributes ).toHaveBeenCalledTimes( 1 );
		expect( updateBlockAttributes ).toHaveBeenCalledWith( 'table-client-id', {
			body: [
				{
					cells: [
						{ content: 'B-C', colSpan: 2, style: { bold: true } },
						{ content: 'D' },
						{ content: 'A' },
					],
				},
				{
					cells: [ { content: 'F-G', colSpan: 2 }, { content: 'H' }, { content: 'E' } ],
				},
			],
		} );
	} );

	/**
	 * 左方向の列移動では、移動先から移動元直前までの列を右へずらして順序を成立させることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableの`body`は結合のない4列を持つ。
	 * - 更新後のBlock取得では要求した属性が反映済みで返る。
	 *
	 * 操作:
	 * - 列3を最終位置0へ移動する。
	 *
	 * 期待結果:
	 * - 列3が先頭へ移動し、元の列0から2は順序を保ったまま1列ずつ後ろへ移る。
	 */
	it( 'when a column moves left, should shift the intervening columns right without changing cell data', () => {
		let currentBlock = {
			name: 'core/table',
			attributes: {
				body: [
					{
						cells: [
							{ content: 'A' },
							{ content: 'B' },
							{ content: 'C' },
							{ content: 'D' },
						],
					},
				],
			},
		};
		const updateBlockAttributes = jest.fn( ( clientId, attributes ) => {
			void clientId;
			currentBlock = {
				...currentBlock,
				attributes: { ...currentBlock.attributes, ...attributes },
			};
		} );
		const integration = createTableUpdateIntegration( {
			getBlock: jest.fn( () => currentBlock ),
			updateBlockAttributes,
		} );

		expect(
			integration.updateReorder(
				{
					kind: 'column',
					clientId: 'table-client-id',
					sourceIndex: 3,
					destinationIndex: 0,
				},
				resolveColumnTableUpdateChanges
			)
		).toEqual( { status: 'updated' } );
		expect( updateBlockAttributes ).toHaveBeenCalledWith( 'table-client-id', {
			body: [ { cells: [ { content: 'D' }, { content: 'A' }, { content: 'B' }, { content: 'C' } ] } ],
		} );
	} );

	/**
	 * 移動元列が現在の横結合セルに含まれる場合は、セルを列単位へ分解する更新を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - Flexible Table Blockの論理列1と2は1つの横結合セルである。
	 * - 移動元は論理列1である。
	 *
	 * 操作:
	 * - 列1を最終位置0へ移動する更新を要求する。
	 *
	 * 期待結果:
	 * - `unavailable`が返り、Block属性更新は呼び出されない。
	 */
	it( 'when the source column belongs to a merged cell, should return unavailable without splitting the cell', () => {
		const updateBlockAttributes = jest.fn();
		const integration = createTableUpdateIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'flexible-table-block/table',
				attributes: {
n					body: [
						{
							cells: [
								{ content: 'A' },
								{ content: 'B-C', colSpan: 2 },
								{ content: 'D' },
							],
						},
					],
				},
			} ),
			updateBlockAttributes,
		} );

		expect(
			integration.updateReorder(
				{
					kind: 'column',
					clientId: 'table-client-id',
					sourceIndex: 1,
					destinationIndex: 0,
				},
				resolveColumnTableUpdateChanges
			)
		).toEqual( { status: 'unavailable' } );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );

	/**
	 * 移動先境界が横結合セルの内部に入る場合は、結合範囲を分断する更新を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - Flexible Table Blockの論理列1と2は1つの横結合セルである。
	 * - 移動元は結合範囲外の論理列3である。
	 *
	 * 操作:
	 * - 列3を最終位置2へ移動する更新を要求する。
	 *
	 * 期待結果:
	 * - 移動先境界が横結合内部となるため`unavailable`が返る。
	 * - Block属性更新は呼び出されない。
	 */
	it( 'when the destination boundary splits a merged cell, should return unavailable without updating', () => {
		const updateBlockAttributes = jest.fn();
		const integration = createTableUpdateIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'flexible-table-block/table',
				attributes: {
					body: [
						{
							cells: [
								{ content: 'A' },
								{ content: 'B-C', colSpan: 2 },
								{ content: 'D' },
							],
						},
					],
				},
			} ),
			updateBlockAttributes,
		} );

		expect(
			integration.updateReorder(
				{
					kind: 'column',
					clientId: 'table-client-id',
					sourceIndex: 3,
					destinationIndex: 2,
				},
				resolveColumnTableUpdateChanges
			)
		).toEqual( { status: 'unavailable' } );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );
