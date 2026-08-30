/**
 * Data Updateの共通位置正規化、方向固有Targetからの位置取得、方向固有更新規則、no-op、
 * Table Integration呼び出し回数を確認する単体テスト。
 */
import { getColumnReorderSourceIndex } from '@/reorder/column-reorder/reorder-target-resolution';
import { resolveColumnTableUpdateChanges } from '@/reorder/column-reorder/table-update';
import { getRowReorderSourceIndex } from '@/reorder/row-reorder/reorder-target-resolution';
import { resolveRowTableUpdateChanges } from '@/reorder/row-reorder/table-update';
import { createDataUpdate, getReorderDestinationIndex } from './data-update';

describe( 'Data Update', () => {
	/**
	 * 挿入境界が移動元より後ろの場合に、移動元を取り除く分だけ最終位置を補正することを確認する。
	 *
	 * 事前条件:
	 * - 移動元は位置1である。
	 * - 並び替え前Tableの境界4へ挿入する。
	 *
	 * 操作:
	 * - 最終位置へ正規化する。
	 *
	 * 期待結果:
	 * - 移動元削除後の位置3が返される。
	 */
	it( 'when insertion boundary is after the source, should normalize it to the final destination index', () => {
		expect( getReorderDestinationIndex( 1, 4 ) ).toBe( 3 );
	} );

	/**
	 * 行Targetから行責務の規則で共通位置を取得し、同じ行更新規則とともにTable Integrationへ1回だけ渡すことを確認する。
	 *
	 * 事前条件:
	 * - `body`内の行1を境界4へ移動する確定済みReorderがある。
	 * - Table Integrationは更新成立を返す。
	 *
	 * 操作:
	 * - 行の位置取得規則とTableデータ更新規則を指定してData Updateを実行する。
	 *
	 * 期待結果:
	 * - 行固有の`rowIndex`はData Updateで直接解釈されない。
	 * - `sourceIndex: 1`、`destinationIndex: 3`の行更新と行更新規則が1回だけ渡される。
	 */
	it( 'when a row reorder is committed, should keep the row update rules paired through Table Integration', () => {
		const updateReorder = jest.fn().mockReturnValue( { status: 'updated' } );
		const dataUpdate = createDataUpdate( {
			updateReorder: ( update, resolveChanges ) => updateReorder( update, resolveChanges ),
		} );

		const result = dataUpdate.update(
			{
				kind: 'row',
				target: { kind: 'row', clientId: 'table-client-id', rowIndex: 1 },
				destination: { kind: 'row', clientId: 'table-client-id', boundaryIndex: 4 },
			},
			{
				getSourceIndex: getRowReorderSourceIndex,
				resolveTableUpdateChanges: resolveRowTableUpdateChanges,
			}
		);

		expect( result ).toEqual( { status: 'updated' } );
		expect( updateReorder ).toHaveBeenCalledTimes( 1 );
		expect( updateReorder ).toHaveBeenCalledWith(
			{
				kind: 'row',
				clientId: 'table-client-id',
				sourceIndex: 1,
				destinationIndex: 3,
			},
			resolveRowTableUpdateChanges
		);
	} );

	/**
	 * 列Targetから列責務の規則で共通位置を取得し、同じ列更新規則とともにTable Integrationへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - 列3を境界1へ移動する確定済みReorderがある。
	 * - Table Integrationは更新成立を返す。
	 *
	 * 操作:
	 * - 列の位置取得規則とTableデータ更新規則を指定してData Updateを実行する。
	 *
	 * 期待結果:
	 * - 列固有の`columnIndex`はData Updateで直接解釈されない。
	 * - `sourceIndex: 3`、`destinationIndex: 1`の列更新と列更新規則が1回だけ渡される。
	 */
	it( 'when a column reorder is committed, should keep the column update rules paired through Table Integration', () => {
		const updateReorder = jest.fn().mockReturnValue( { status: 'updated' } );
		const dataUpdate = createDataUpdate( {
			updateReorder: ( update, resolveChanges ) => updateReorder( update, resolveChanges ),
		} );

		const result = dataUpdate.update(
			{
				kind: 'column',
				target: { kind: 'column', clientId: 'table-client-id', columnIndex: 3 },
				destination: { kind: 'column', clientId: 'table-client-id', boundaryIndex: 1 },
			},
			{
				getSourceIndex: getColumnReorderSourceIndex,
				resolveTableUpdateChanges: resolveColumnTableUpdateChanges,
			}
		);

		expect( result ).toEqual( { status: 'updated' } );
		expect( updateReorder ).toHaveBeenCalledTimes( 1 );
		expect( updateReorder ).toHaveBeenCalledWith(
			{
				kind: 'column',
				clientId: 'table-client-id',
				sourceIndex: 3,
				destinationIndex: 1,
			},
			resolveColumnTableUpdateChanges
		);
	} );

	/**
	 * 移動元の直前または直後の境界が最終的に同じ位置となる場合にTable更新を発生させないことを確認する。
	 *
	 * 事前条件:
	 * - 行1について境界1または境界2が確定済みDestinationとなる。
	 *
	 * 操作:
	 * - それぞれData Updateを実行する。
	 *
	 * 期待結果:
	 * - どちらも`unchanged`となる。
	 * - Table Integrationは1回も呼び出されない。
	 */
	it( 'when a committed destination normalizes to the source position, should not call Table Integration', () => {
		const updateReorder = jest.fn().mockReturnValue( { status: 'updated' } );
		const dataUpdate = createDataUpdate( {
			updateReorder: ( update, resolveChanges ) => updateReorder( update, resolveChanges ),
		} );
		const target = { kind: 'row' as const, clientId: 'table-client-id', rowIndex: 1 };
		const adapter = {
			getSourceIndex: getRowReorderSourceIndex,
			resolveTableUpdateChanges: resolveRowTableUpdateChanges,
		};

		expect(
			dataUpdate.update(
				{
					kind: 'row',
					target,
					destination: { kind: 'row', clientId: 'table-client-id', boundaryIndex: 1 },
				},
				adapter
			)
		).toEqual( { status: 'unchanged' } );
		expect(
			dataUpdate.update(
				{
					kind: 'row',
					target,
					destination: { kind: 'row', clientId: 'table-client-id', boundaryIndex: 2 },
				},
				adapter
			)
		).toEqual( { status: 'unchanged' } );
		expect( updateReorder ).not.toHaveBeenCalled();
	} );
} );
