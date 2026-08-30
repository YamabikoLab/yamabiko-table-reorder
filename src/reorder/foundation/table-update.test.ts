/**
 * Table Integration更新境界が現在Blockの取得、方向固有更新規則の適用、1回の属性更新、成立確認を担当することを検証する。
 */
import { createTableUpdateIntegration } from './table-update';

describe( 'Table Integration update', () => {
	/**
	 * DnD完了後の現在Tableに対して方向固有更新規則を成立させられない場合は属性更新を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 対応するCore Tableは現在取得できる。
	 * - 選択済みの方向固有更新規則は現在状態を更新不可と判定する。
	 *
	 * 操作:
	 * - Table Integrationへ確定済み更新を要求する。
	 *
	 * 期待結果:
	 * - 外部状態の変化として`unavailable`が返る。
	 * - Block属性更新は呼び出されない。
	 */
	it( 'when the selected direction rules cannot update the current Table, should return unavailable without updating', () => {
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
					sourceIndex: 0,
					destinationIndex: 1,
				},
				() => null
			)
		).toEqual( { status: 'unavailable' } );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );

	/**
	 * 属性更新APIを呼び出した後に期待したTable状態を確認できない場合は成功とみなさないことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableの現在データは安全に共通更新用データへ変換できる。
	 * - 方向固有更新規則は`body`の行順変更を返す。
	 * - 属性更新API呼び出し後も`getBlock()`は更新前の状態を返す。
	 *
	 * 操作:
	 * - Table Integration更新を要求する。
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
			integration.updateReorder(
				{
					kind: 'row',
					clientId: 'table-client-id',
					sourceIndex: 0,
					destinationIndex: 1,
				},
				( table ) => ( { body: [ ...table.body.rows ].reverse() } )
			)
		).toEqual( { status: 'unconfirmed' } );
		expect( updateBlockAttributes ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * DnD完了後に対象Table自体が存在しなくなった場合は過去の属性を利用して更新しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象clientIdのBlockを現在取得できない。
	 *
	 * 操作:
	 * - Table Integration更新を要求する。
	 *
	 * 期待結果:
	 * - `unavailable`が返り、方向固有更新規則とBlock属性更新はどちらも実行されない。
	 */
	it( 'when the target Table no longer exists, should return unavailable before resolving update changes', () => {
		const resolveChanges = jest.fn();
		const updateBlockAttributes = jest.fn();
		const integration = createTableUpdateIntegration( {
			getBlock: jest.fn().mockReturnValue( null ),
			updateBlockAttributes,
		} );

		expect(
			integration.updateReorder(
				{
					kind: 'column',
					clientId: 'table-client-id',
					sourceIndex: 0,
					destinationIndex: 1,
				},
				resolveChanges
			)
		).toEqual( { status: 'unavailable' } );
		expect( resolveChanges ).not.toHaveBeenCalled();
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );
