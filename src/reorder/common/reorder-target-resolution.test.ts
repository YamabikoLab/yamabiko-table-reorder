/**
 * Reorder Target Resolutionで行・列に共通する開始判定規則を確認する単体テスト。
 *
 * 共通Table構造を取得できない場合と、Reorder Targetとして成立しない論理インデックスについて、
 * 行・列の固有規則へ依存しない外部から観測可能な判定結果を検証する。
 */
import type { TableIntegration, TableStructure } from '@/reorder/table-integration';
import { createReorderTargetResolution } from './reorder-target-resolution';

const createIntegration = ( structure: TableStructure | null ): TableIntegration => ( {
	getStructure: jest.fn().mockReturnValue( structure ),
} );

describe( 'Reorder Target Resolution shared rules', () => {
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
	 * 行・列で共通する論理インデックス規則に反する開始位置をReorder Targetとして扱わないことを確認する。
	 *
	 * 事前条件:
	 * - 共通Table構造は取得できる。
	 * - 行の開始位置は負数、列の開始位置は小数である。
	 *
	 * 操作:
	 * - 行・列DnDの開始対象をそれぞれ`resolve()`で判定する。
	 *
	 * 期待結果:
	 * - どちらも`target-out-of-scope`を理由とする`immovable`結果になる。
	 */
	it( 'when a logical start index is invalid, should return target-out-of-scope for both reorder kinds', () => {
		const resolution = createReorderTargetResolution( createIntegration( { mergedCells: [] } ) );

		expect(
			resolution.resolve( {
				kind: 'row',
				clientId: 'table-client-id',
				section: 'body',
				rowIndex: -1,
			} )
		).toEqual( { status: 'immovable', reason: 'target-out-of-scope' } );

		expect(
			resolution.resolve( {
				kind: 'column',
				clientId: 'table-client-id',
				columnIndex: 1.5,
			} )
		).toEqual( { status: 'immovable', reason: 'target-out-of-scope' } );
	} );
} );
