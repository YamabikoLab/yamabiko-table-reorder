import {
	cancelReorderSession,
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
} from './dnd-interaction';

describe( 'common Reorder Session', () => {
	/**
	 * 通常編集状態ではDnDを開始できないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは`edit`である。
	 * - 移動対象が指定されている。
	 *
	 * 操作:
	 * - startReorderSession()を実行する。
	 *
	 * 期待結果:
	 * - Sessionは開始されず`null`が返される。
	 */
	it( 'when edit mode is active, should not start a reorder session', () => {
		expect( startReorderSession( 'edit', { index: 2 } ) ).toBeNull();
	} );

	/**
	 * 行と列で同じSession形状を使ってDnDを開始できることを確認する。
	 *
	 * 事前条件:
	 * - 行または列のReorder Modeが有効である。
	 * - 移動対象が指定されている。
	 *
	 * 操作:
	 * - 各方向でstartReorderSession()を実行する。
	 *
	 * 期待結果:
	 * - 方向だけが異なる共通Sessionが返される。
	 */
	it( 'when row or column mode is active, should start the same session contract', () => {
		expect( startReorderSession( 'row', { index: 1 } ) ).toEqual( {
			direction: 'row',
			target: { index: 1 },
			destination: null,
		} );
		expect( startReorderSession( 'column', { index: 3 } ) ).toEqual( {
			direction: 'column',
			target: { index: 3 },
			destination: null,
		} );
	} );

	/**
	 * 進行中Sessionが現在の有効な移動先だけを更新することを確認する。
	 *
	 * 事前条件:
	 * - 行のReorder Sessionが進行中である。
	 * - 開始時点では有効な移動先がない。
	 *
	 * 操作:
	 * - updateReorderDestination()で移動先を設定する。
	 *
	 * 期待結果:
	 * - 方向と移動対象を維持したまま移動先だけが更新される。
	 */
	it( 'when destination changes, should preserve the active session identity', () => {
		const session = startReorderSession( 'row', { index: 1 } );

		expect( session ).not.toBeNull();
		if ( session === null ) {
			return;
		}

		expect(
			updateReorderDestination( session, { index: 4 } )
		).toEqual( {
			direction: 'row',
			target: { index: 1 },
			destination: { index: 4 },
		} );
	} );

	/**
	 * 有効な移動先がある場合だけ確定結果を生成することを確認する。
	 *
	 * 事前条件:
	 * - 列のReorder Sessionが進行中である。
	 * - 現在の有効な移動先が設定されている。
	 *
	 * 操作:
	 * - completeReorderSession()を実行する。
	 *
	 * 期待結果:
	 * - Data Updateへ渡せる確定済み並び替えが返される。
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
			direction: 'column',
			target: { index: 1 },
			destination: { index: 5 },
		} );
	} );

	/**
	 * 有効な移動先がない完了では確定結果を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionが進行中である。
	 * - 現在の有効な移動先は`null`である。
	 *
	 * 操作:
	 * - completeReorderSession()を実行する。
	 *
	 * 期待結果:
	 * - 確定済み並び替えは生成されず`null`が返される。
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
	 * キャンセル時にData Updateへ渡す結果を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionが開始済みである。
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
