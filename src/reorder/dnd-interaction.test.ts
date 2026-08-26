/**
 * 行・列と入力方式に共通する、1回の並び替え操作の開始・更新・確定・キャンセルを確認する。
 */

import {
	cancelReorderSession,
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
} from './dnd-interaction';

describe( 'common Reorder Session', () => {
	/**
	 * 概要: 通常編集では並び替え操作を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 操作状態は`edit`である。
	 * - 移動対象候補が指定されている。
	 *
	 * 操作:
	 * - startReorderSession()で並び替え開始を要求する。
	 *
	 * 期待結果:
	 * - 並び替え操作は生成されず`null`が返される。
	 */
	it( 'when edit mode is active, should not start a reorder session', () => {
		expect( startReorderSession( 'edit', { index: 2 } ) ).toBeNull();
	} );

	/**
	 * 概要: 行と列が同じ操作状態の形式を共有し、種別だけで対象を区別できることを確認する。
	 *
	 * 事前条件:
	 * - 行または列の並び替えが有効である。
	 * - 各操作の移動対象が指定されている。
	 *
	 * 操作:
	 * - 行と列のそれぞれでstartReorderSession()を実行する。
	 *
	 * 期待結果:
	 * - 同じ形式の操作状態が返され、kindだけが対応する種別になる。
	 */
	it( 'when row or column mode is active, should start the same session contract', () => {
		expect( startReorderSession( 'row', { index: 1 } ) ).toEqual( {
			kind: 'row',
			target: { index: 1 },
			destination: null,
		} );
		expect( startReorderSession( 'column', { index: 3 } ) ).toEqual( {
			kind: 'column',
			target: { index: 3 },
			destination: null,
		} );
	} );

	/**
	 * 概要: 移動先が変化しても、進行中の操作が同じ移動対象を維持することを確認する。
	 *
	 * 事前条件:
	 * - 行の並び替え操作が進行中である。
	 * - 開始時点では有効な移動先がない。
	 *
	 * 操作:
	 * - updateReorderDestination()で現在有効な移動先を設定する。
	 *
	 * 期待結果:
	 * - kindとtargetは変わらず、destinationだけが更新される。
	 */
	it( 'when destination changes, should preserve the active session identity', () => {
		const session = startReorderSession( 'row', { index: 1 } );

		expect( session ).not.toBeNull();
		if ( session === null ) {
			return;
		}

		expect( updateReorderDestination( session, { index: 4 } ) ).toEqual( {
			kind: 'row',
			target: { index: 1 },
			destination: { index: 4 },
		} );
	} );

	/**
	 * 概要: 有効な移動先がある操作だけを、データ更新へ渡せる確定結果にできることを確認する。
	 *
	 * 事前条件:
	 * - 列の並び替え操作が進行中である。
	 * - 有効な移動先が得られている。
	 *
	 * 操作:
	 * - completeReorderSession()で操作を完了する。
	 *
	 * 期待結果:
	 * - kind、target、destinationを持つ確定結果が返される。
	 */
	it( 'when a valid destination exists, should create a committed reorder', () => {
		const session = startReorderSession( 'column', { index: 1 } );

		expect( session ).not.toBeNull();
		if ( session === null ) {
			return;
		}

		const withDestination = updateReorderDestination( session, {
			index: 5,
		} );

		expect( completeReorderSession( withDestination ) ).toEqual( {
			kind: 'column',
			target: { index: 1 },
			destination: { index: 5 },
		} );
	} );

	/**
	 * 概要: 有効な移動先がない操作を確定結果にしないことを確認する。
	 *
	 * 事前条件:
	 * - 並び替え操作が進行中である。
	 * - 現在のdestinationは`null`である。
	 *
	 * 操作:
	 * - completeReorderSession()で操作を完了しようとする。
	 *
	 * 期待結果:
	 * - 確定結果は生成されず`null`が返される。
	 */
	it( 'when no valid destination exists, should not create a committed reorder', () => {
		const session = startReorderSession( 'row', { index: 2 } );

		expect( session ).not.toBeNull();
		if ( session === null ) {
			return;
		}

		expect( completeReorderSession( session ) ).toBeNull();
	} );

	/**
	 * 概要: キャンセルした操作から確定結果を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - 並び替え操作をキャンセルする。
	 *
	 * 操作:
	 * - cancelReorderSession()を実行する。
	 *
	 * 期待結果:
	 * - 確定結果は生成されず`null`が返される。
	 */
	it( 'when a reorder session is cancelled, should not create a committed reorder', () => {
		expect( cancelReorderSession() ).toBeNull();
	} );
} );
