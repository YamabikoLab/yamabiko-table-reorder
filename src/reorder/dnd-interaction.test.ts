/**
 * 行・列と入力方式に共通するReorder Sessionの開始、更新、確定、キャンセルLifecycleを確認する。
 */

import {
	cancelReorderSession,
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
} from './dnd-interaction';

describe( 'common Reorder Session', () => {
	/**
	 * 概要: 通常編集では並び替え操作を開始せず、編集操作とDnDを混在させないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは`edit`である。
	 * - 移動対象候補が指定されている。
	 *
	 * 操作:
	 * - startReorderSession()でSession開始を要求する。
	 *
	 * 期待結果:
	 * - Reorder Sessionは生成されず`null`が返される。
	 */
	it( 'when edit mode is active, should not start a reorder session', () => {
		expect( startReorderSession( 'edit', { index: 2 } ) ).toBeNull();
	} );

	/**
	 * 概要: 行と列が同じSession Contractを共有し、種別だけで操作対象を区別できることを確認する。
	 *
	 * 事前条件:
	 * - 行または列のReorder Modeが有効である。
	 * - 各操作のReorder Targetが指定されている。
	 *
	 * 操作:
	 * - rowとcolumnのそれぞれでstartReorderSession()を実行する。
	 *
	 * 期待結果:
	 * - 共通のSession形状が返され、kindだけが対応する種別になる。
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
	 * 概要: Drop Target Resolutionの結果が変化しても、進行中Sessionの対象identityを維持することを確認する。
	 *
	 * 事前条件:
	 * - 行のReorder Sessionが進行中である。
	 * - Session開始時点では有効な移動先がない。
	 *
	 * 操作:
	 * - updateReorderDestination()で現在の有効な移動先を設定する。
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
	 * 概要: 有効な移動先があるSessionだけをData Updateへ渡せる確定結果へ変換することを確認する。
	 *
	 * 事前条件:
	 * - 列のReorder Sessionが進行中である。
	 * - Drop Target Resolutionで有効な移動先が得られている。
	 *
	 * 操作:
	 * - completeReorderSession()でSessionを完了する。
	 *
	 * 期待結果:
	 * - kind、target、destinationを持つCommitted Reorderが返される。
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
	 * 概要: 有効な移動先が失われたSessionを確定せず、Data Updateの入力にしないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionが進行中である。
	 * - 現在のdestinationは`null`である。
	 *
	 * 操作:
	 * - completeReorderSession()でSessionを完了しようとする。
	 *
	 * 期待結果:
	 * - Committed Reorderは生成されず`null`が返される。
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
	 * 概要: キャンセルした操作を確定結果へ変換せず、Data Updateを発生させないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionをキャンセルする操作である。
	 *
	 * 操作:
	 * - cancelReorderSession()を実行する。
	 *
	 * 期待結果:
	 * - Committed Reorderは生成されず`null`が返される。
	 */
	it( 'when a reorder session is cancelled, should not create a committed reorder', () => {
		expect( cancelReorderSession() ).toBeNull();
	} );
} );
