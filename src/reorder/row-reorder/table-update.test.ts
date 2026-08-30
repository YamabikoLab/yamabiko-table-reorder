/**
 * 行並び替え固有のTableデータ更新規則が`body`だけを移動し、行データを保持することを確認する単体テスト。
 */
import { createTableUpdateIntegration } from '@/reorder/foundation/table-update';
import { resolveRowTableUpdateChanges } from './table-update';

describe( 'Row Table Update', () => {
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
			integration.updateReorder(
				{
					kind: 'row',
					clientId: 'table-client-id',
					sourceIndex: 0,
					destinationIndex: 2,
				},
				resolveRowTableUpdateChanges
			)
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
	 * DnD完了後に`body`の行数が変化し、確定済み行位置が成立しない場合は更新を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 現在のCore Tableは`body`に1行しか持たない。
	 * - 確定済み更新は行2を移動元として要求する。
	 *
	 * 操作:
	 * - 行更新を要求する。
	 *
	 * 期待結果:
	 * - 外部状態の変化として`unavailable`が返る。
	 * - Block属性更新は呼び出されない。
	 */
	it( 'when the current body no longer contains the requested row, should return unavailable without updating', () => {
		const updateBlockAttributes = jest.fn();
		const integration = createTableUpdateIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: { body: [ { cells: [ { content: 'A' } ] } ] },
			} ),
			updateBlockAttributes,
		} );

		expect(
			integration.updateReorder(
				{
					kind: 'row',
					clientId: 'table-client-id',
					sourceIndex: 2,
					destinationIndex: 0,
				},
				resolveRowTableUpdateChanges
			)
		).toEqual( { status: 'unavailable' } );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );
