/**
 * Reorder Sessionが1回のDnD中に保持する状態と確定条件を確認する単体テスト。
 *
 * 行・列それぞれで並び替え対象と並び替え制約を保持し、有効な移動先だけを確定済み並び替えへ変換し、
 * Sessionと異なる種別またはTableの移動先を内部Invariant違反として拒否することを検証する。
 */
import {
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
} from './reorder-session';

describe( 'Reorder Session', () => {
	/**
	 * 行DnD開始時に必要な状態だけを保持することを確認する。
	 *
	 * 事前条件:
	 * - 行1がReorder Targetとして成立している。
	 * - 開始時の並び替え制約に境界2が含まれている。
	 *
	 * 操作:
	 * - `startReorderSession()`を実行する。
	 *
	 * 期待結果:
	 * - 行1と同じ並び替え制約を保持し、移動先は`null`で開始する。
	 */
	it( 'when a row Session starts, should retain its target and constraints with no destination', () => {
		const constraints = { blockedBoundaries: [ 2 ] };
		const session = startReorderSession(
			{
				kind: 'row',
				clientId: 'table-client-id',
				rowIndex: 1,
			},
			constraints
		);

		expect( session ).toEqual( {
			kind: 'row',
			target: {
				kind: 'row',
				clientId: 'table-client-id',
				rowIndex: 1,
			},
			constraints: { blockedBoundaries: [ 2 ] },
			destination: null,
		} );
		expect( session.constraints ).toBe( constraints );
	} );

	/**
	 * 列DnDの有効な移動先からCommitted Reorderを生成できることを確認する。
	 *
	 * 事前条件:
	 * - 列1のReorder Sessionがactiveである。
	 * - 同じTableの境界3が有効な移動先として判定されている。
	 *
	 * 操作:
	 * - 移動先を更新して`completeReorderSession()`を実行する。
	 *
	 * 期待結果:
	 * - 列1と境界3を持つCommitted Reorderが返される。
	 */
	it( 'when a column Session has a valid destination, should create a column Committed Reorder', () => {
		const session = startReorderSession(
			{
				kind: 'column',
				clientId: 'table-client-id',
				columnIndex: 1,
			},
			{ blockedBoundaries: [] }
		);
		const progressedSession = updateReorderDestination( session, {
			kind: 'column',
			clientId: 'table-client-id',
			boundaryIndex: 3,
		} );

		expect( completeReorderSession( progressedSession ) ).toEqual( {
			kind: 'column',
			target: {
				kind: 'column',
				clientId: 'table-client-id',
				columnIndex: 1,
			},
			destination: {
				kind: 'column',
				clientId: 'table-client-id',
				boundaryIndex: 3,
			},
		} );
	} );

	/**
	 * 有効な移動先が消えた場合に確定済み並び替えを生成しないことを確認する。
	 *
	 * 事前条件:
	 * - 行DnDで一度は有効な移動先が成立している。
	 *
	 * 操作:
	 * - 現在の移動先を`null`へ更新してからSessionを完了する。
	 *
	 * 期待結果:
	 * - Committed Reorderは生成されない。
	 */
	it( 'when the current destination becomes unavailable, should complete without a Committed Reorder', () => {
		const session = startReorderSession(
			{
				kind: 'row',
				clientId: 'table-client-id',
				rowIndex: 0,
			},
			{ blockedBoundaries: [] }
		);
		const withDestination = updateReorderDestination( session, {
			kind: 'row',
			clientId: 'table-client-id',
			boundaryIndex: 1,
		} );
		const withoutDestination = updateReorderDestination( withDestination, null );

		expect( completeReorderSession( withoutDestination ) ).toBeNull();
	} );

	/**
	 * Reorder Sessionと異なる並び替え種別の移動先を受け入れないことを確認する。
	 *
	 * 事前条件:
	 * - 行Reorder Sessionがactiveである。
	 *
	 * 操作:
	 * - 列のReorder Destinationで移動先を更新する。
	 *
	 * 期待結果:
	 * - Reorder SessionのInvariant違反としてErrorが送出される。
	 */
	it( 'when a destination kind differs from the Session kind, should throw an invariant error', () => {
		const session = startReorderSession(
			{
				kind: 'row',
				clientId: 'table-client-id',
				rowIndex: 0,
			},
			{ blockedBoundaries: [] }
		);

		expect( () =>
			updateReorderDestination( session, {
				kind: 'column',
				clientId: 'table-client-id',
				boundaryIndex: 1,
			} )
		).toThrow( 'Reorder Session invariant violated: reorder kind must match destination kind.' );
	} );

	/**
	 * Reorder Sessionと異なるTableの移動先を受け入れないことを確認する。
	 *
	 * 事前条件:
	 * - 行Reorder Sessionが`table-client-id`でactiveである。
	 *
	 * 操作:
	 * - 別Tableの行Reorder Destinationで移動先を更新する。
	 *
	 * 期待結果:
	 * - Reorder SessionのInvariant違反としてErrorが送出される。
	 */
	it( 'when a destination belongs to another Table, should throw an invariant error', () => {
		const session = startReorderSession(
			{
				kind: 'row',
				clientId: 'table-client-id',
				rowIndex: 0,
			},
			{ blockedBoundaries: [] }
		);

		expect( () =>
			updateReorderDestination( session, {
				kind: 'row',
				clientId: 'another-table-client-id',
				boundaryIndex: 1,
			} )
		).toThrow( 'Reorder Session invariant violated: target and destination must belong to the same Table.' );
	} );
} );
