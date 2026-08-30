/**
 * Table Integration更新境界が対応Table固有の属性構造へ行・列更新を適用し、更新成立を確認することを検証する。
 */
import { createTableUpdateIntegration } from './table-update';

describe( 'Table Integration update', () => {
	/**
	 * Core Tableの行更新では`body`の行だけを移動し、行が保持するセル内容と属性をそのまま維持することを確認する。
	 *
	 * 事前条件:
	 * - Core Tableの`body`に3行があり、各行は異なるセル内容と属性を持つ。
	 * - 更新後のBlock取得では要求した`body`が反映済みで返る。
	 *
	 * 操作:
	 * - 行0を最終位置2へ移動する更新を要求する。
	 *
	 * 期待結果:
	 * - `body`だけを含むBlock属性更新が1回実行される。
	 * - 行全体の内容と属性を保持したまま順序だけが変わり、`updated`が返る。
	 */
	it( 'when a Core Table row update is confirmed, should move only the body row and preserve its data', () => {
		const initialBlock = {
			name: 'core/table',
			attributes: {
				head: [ { cells: [ { content: 'head' } ] } ],
				body: [
					{ cells: [ { content: 'A', tag: 'th' } ], custom: 'row-a' },
					{ cells: [ { content: 'B' } ], custom: 'row-b' },
					{ cells: [ { content: 'C' } ], custom: 'row-c' },
				],
			},
		};
		let currentBlock = initialBlock;
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
			integration.updateReorder( {
				kind: 'row',
				clientId: 'table-client-id',
				sourceIndex: 0,
				destinationIndex: 2,
			} )
		).toEqual( { status: 'updated' } );
		expect( updateBlockAttributes ).toHaveBeenCalledTimes( 1 );
		expect( updateBlockAttributes ).toHaveBeenCalledWith( 'table-client-id', {
			body: [
				{ cells: [ { content: 'B' } ], custom: 'row-b' },
				{ cells: [ { content: 'C' } ], custom: 'row-c' },
				{ cells: [ { content: 'A', tag: 'th' } ], custom: 'row-a' },
			],
		} );
	} );

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
			integration.updateReorder( {
				kind: 'column',
				clientId: 'table-client-id',
				sourceIndex: 0,
				destinationIndex: 3,
			} )
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
	 * DnD完了後に対象Tableが変化し、要求位置で安全に更新できない場合は属性更新を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 現在のCore Tableは`body`に1行しか持たない。
	 * - 確定済み更新は行2を移動元として要求する。
	 *
	 * 操作:
	 * - Table Integration更新を要求する。
	 *
	 * 期待結果:
	 * - 外部状態の変化として`unavailable`が返る。
	 * - Block属性更新は呼び出されない。
	 */
	it( 'when current Table data no longer contains the requested position, should return unavailable without updating', () => {
		const updateBlockAttributes = jest.fn();
		const integration = createTableUpdateIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: { body: [ { cells: [ { content: 'A' } ] } ] },
			} ),
			updateBlockAttributes,
		} );

		expect(
			integration.updateReorder( {
				kind: 'row',
				clientId: 'table-client-id',
				sourceIndex: 2,
				destinationIndex: 0,
			} )
		).toEqual( { status: 'unavailable' } );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );

	/**
	 * 属性更新APIを呼び出した後に期待したTable状態を確認できない場合は成功とみなさないことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableの行更新自体は開始可能である。
	 * - 属性更新API呼び出し後も`getBlock()`は更新前の状態を返す。
	 *
	 * 操作:
	 * - 行更新を要求する。
	 *
	 * 期待結果:
	 * - 属性更新APIは1回だけ呼び出される。
	 * - API呼び出しだけを成功根拠にせず`unconfirmed`が返る。
	 */
	it( 'when the requested block update cannot be confirmed, should return unconfirmed without retrying', () => {
		const block = {
			name: 'core/table',
			attributes: {
				body: [ { cells: [ { content: 'A' } ] }, { cells: [ { content: 'B' } ] } ],
			},
		};
		const updateBlockAttributes = jest.fn();
		const integration = createTableUpdateIntegration( {
			getBlock: jest.fn( () => block ),
			updateBlockAttributes,
		} );

		expect(
			integration.updateReorder( {
				kind: 'row',
				clientId: 'table-client-id',
				sourceIndex: 0,
				destinationIndex: 1,
			} )
		).toEqual( { status: 'unconfirmed' } );
		expect( updateBlockAttributes ).toHaveBeenCalledTimes( 1 );
	} );
} );
