/**
 * Drop Target Resolutionの行・列に共通する移動先判定を確認する単体テスト。
 *
 * DnD Interactionから渡された現在位置とReorder Constraintsだけを利用し、有効な挿入境界、
 * 結合セルを分断する禁止境界、移動先へ対応しない現在位置を判定できることを検証する。
 */
import { createDropTargetResolution } from './drop-target-resolution';

describe( 'Drop Target Resolution', () => {
	/**
	 * 行DnDで構造保持条件を満たす行間を有効な移動先として返すことを確認する。
	 *
	 * 事前条件:
	 * - 行2を並び替え対象としてDnDが開始済みである。
	 * - 境界3は`blockedBoundaries`に含まれていない。
	 *
	 * 操作:
	 * - 現在位置が境界3へ対応する状態で`resolve()`を実行する。
	 *
	 * 期待結果:
	 * - `body`区画内の境界3を表す行のReorder Destinationが返される。
	 */
	it( 'when a row boundary is not blocked, should return the row destination', () => {
		const resolution = createDropTargetResolution();

		expect(
			resolution.resolve( {
				kind: 'row',
				target: {
					kind: 'row',
					clientId: 'table-client-id',
					rowIndex: 2,
				},
				constraints: { blockedBoundaries: [ 1 ] },
				currentPosition: { boundaryIndex: 3 },
			} )
		).toEqual( {
			status: 'valid',
			destination: {
				kind: 'row',
				clientId: 'table-client-id',
				boundaryIndex: 3,
			},
		} );
	} );

	/**
	 * 列DnDで構造保持条件を満たす列間を有効な移動先として返すことを確認する。
	 *
	 * 事前条件:
	 * - 列1を並び替え対象としてDnDが開始済みである。
	 * - 境界4は`blockedBoundaries`に含まれていない。
	 *
	 * 操作:
	 * - 現在位置が境界4へ対応する状態で`resolve()`を実行する。
	 *
	 * 期待結果:
	 * - Table全体の境界4を表す列のReorder Destinationが返される。
	 */
	it( 'when a column boundary is not blocked, should return the column destination', () => {
		const resolution = createDropTargetResolution();

		expect(
			resolution.resolve( {
				kind: 'column',
				target: {
					kind: 'column',
					clientId: 'table-client-id',
					columnIndex: 1,
				},
				constraints: { blockedBoundaries: [ 2, 3 ] },
				currentPosition: { boundaryIndex: 4 },
			} )
		).toEqual( {
			status: 'valid',
			destination: {
				kind: 'column',
				clientId: 'table-client-id',
				boundaryIndex: 4,
			},
		} );
	} );

	/**
	 * 対象方向の結合セルを分断する境界を有効な移動先にしないことを確認する。
	 *
	 * 事前条件:
	 * - 行DnDと列DnDのReorder Constraintsに境界2が禁止境界として含まれている。
	 *
	 * 操作:
	 * - 行・列それぞれで現在位置が境界2へ対応する状態を判定する。
	 *
	 * 期待結果:
	 * - どちらも有効な移動先なしを表す`none`になる。
	 */
	it( 'when the current boundary is blocked, should return none for both reorder kinds', () => {
		const resolution = createDropTargetResolution();

		expect(
			resolution.resolve( {
				kind: 'row',
				target: {
					kind: 'row',
					clientId: 'table-client-id',
					rowIndex: 0,
				},
				constraints: { blockedBoundaries: [ 2 ] },
				currentPosition: { boundaryIndex: 2 },
			} )
		).toEqual( { status: 'none' } );

		expect(
			resolution.resolve( {
				kind: 'column',
				target: {
					kind: 'column',
					clientId: 'table-client-id',
					columnIndex: 0,
				},
				constraints: { blockedBoundaries: [ 2 ] },
				currentPosition: { boundaryIndex: 2 },
			} )
		).toEqual( { status: 'none' } );
	} );

	/**
	 * 現在位置が並び替え対象範囲内の挿入境界へ対応しない場合に移動先を返さないことを確認する。
	 *
	 * 事前条件:
	 * - 行DnDは開始済みである。
	 * - 現在位置は対象範囲内の行間へ対応していない。
	 *
	 * 操作:
	 * - `currentPosition`を`null`として`resolve()`を実行する。
	 *
	 * 期待結果:
	 * - 有効な移動先なしを表す`none`になる。
	 */
	it( 'when the current position does not resolve to a boundary, should return none', () => {
		const resolution = createDropTargetResolution();

		expect(
			resolution.resolve( {
				kind: 'row',
				target: {
					kind: 'row',
					clientId: 'table-client-id',
					rowIndex: 0,
				},
				constraints: { blockedBoundaries: [] },
				currentPosition: null,
			} )
		).toEqual( { status: 'none' } );
	} );

	/**
	 * 挿入境界として成立しない論理インデックスを移動先にしないことを確認する。
	 *
	 * 事前条件:
	 * - 行DnDと列DnDは開始済みである。
	 * - 行の境界は負数、列の境界は小数である。
	 *
	 * 操作:
	 * - それぞれの現在位置を`resolve()`で判定する。
	 *
	 * 期待結果:
	 * - どちらも有効な移動先なしを表す`none`になる。
	 */
	it( 'when a boundary index is invalid, should return none for both reorder kinds', () => {
		const resolution = createDropTargetResolution();

		expect(
			resolution.resolve( {
				kind: 'row',
				target: {
					kind: 'row',
					clientId: 'table-client-id',
					rowIndex: 0,
				},
				constraints: { blockedBoundaries: [] },
				currentPosition: { boundaryIndex: -1 },
			} )
		).toEqual( { status: 'none' } );

		expect(
			resolution.resolve( {
				kind: 'column',
				target: {
					kind: 'column',
					clientId: 'table-client-id',
					columnIndex: 0,
				},
				constraints: { blockedBoundaries: [] },
				currentPosition: { boundaryIndex: 1.5 },
			} )
		).toEqual( { status: 'none' } );
	} );
} );
