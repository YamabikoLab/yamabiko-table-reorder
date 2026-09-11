/**
 * RF Input InterpretationがRow / Columnフォーム入力の成立性だけを判定し、成立した入力を方向固有Resolution向け内部指定へ変換するContractを確認する。
 */

import {
	interpretColumnRfInput,
	interpretRowRfInput,
} from './input-interpretation';

const columns = [ { columnIndex: 0 }, { columnIndex: 1 }, { columnIndex: 2 } ] as const;

describe( 'RF Input Interpretation', () => {
	describe( 'Row', () => {
		/**
		 * 必要入力が不足しているRowフォームをResolutionへ進めないことを確認する。
		 *
		 * 事前条件:
		 * - 現在Tableには10行存在する。
		 * - source、target、positionのいずれか、または複数が未入力である。
		 *
		 * 操作:
		 * - Row RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - 公開結果は一律に`not-ready`となる。
		 */
		it.each( [
			[ '', '5', 'below' as const ],
			[ '2', '', 'below' as const ],
			[ '2', '5', null ],
			[ '', '', null ],
		] )(
			'when required Row input is missing, should return not-ready',
			( sourceRowNumber, targetRowNumber, position ) => {
				expect(
					interpretRowRfInput(
						{ sourceRowNumber, targetRowNumber, position },
						10
					)
				).toEqual( { status: 'not-ready' } );
			}
		);

		/**
		 * 現在の行範囲へ安全に変換できないRow入力を内部指定として公開しないことを確認する。
		 *
		 * 事前条件:
		 * - 現在Tableには10行存在する。
		 * - sourceまたはtargetに非整数、1未満、現在行数超過の値が指定される。
		 *
		 * 操作:
		 * - Row RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - 公開結果は`not-ready`となり、入力エラー種別は公開されない。
		 */
		it.each( [
			[ 'abc', '5' ],
			[ '1.5', '5' ],
			[ '0', '5' ],
			[ '-1', '5' ],
			[ '11', '5' ],
			[ '2', 'abc' ],
			[ '2', '11' ],
		] )(
			'when a Row number cannot be interpreted inside the current range, should return not-ready',
			( sourceRowNumber, targetRowNumber ) => {
				expect(
					interpretRowRfInput(
						{ sourceRowNumber, targetRowNumber, position: 'below' },
						10
					)
				).toEqual( { status: 'not-ready' } );
			}
		);

		/**
		 * Row入力範囲の下限と上限を有効な内部指定へ変換できることを確認する。
		 *
		 * 事前条件:
		 * - 現在Tableには10行存在する。
		 * - sourceに1、targetに10を指定する。
		 *
		 * 操作:
		 * - Row RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - 1-based行番号が0-based indexへ変換された`ready`結果が返る。
		 */
		it(
			'when Row numbers are at the valid range boundaries, should return their zero-based indexes',
			() => {
				expect(
					interpretRowRfInput(
						{
							sourceRowNumber: '1',
							targetRowNumber: '10',
							position: 'above',
						},
						10
					)
				).toEqual( {
					status: 'ready',
					specification: {
						sourceRowIndex: 0,
						targetRowIndex: 9,
						position: 'above',
					},
				} );
			}
		);

		/**
		 * 入力段階ではsource / targetの位置関係からno-opを判定しないことを確認する。
		 *
		 * 事前条件:
		 * - sourceとtargetに同じ行、または移動しても並び順が変わらない隣接指定を与える。
		 *
		 * 操作:
		 * - Row RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - 入力自体が成立していれば`ready`となる。
		 */
		it.each( [
			[ '3', '3', 'above' as const ],
			[ '3', '4', 'above' as const ],
		] )(
			'when a Row specification may become a no-op later, should still return ready',
			( sourceRowNumber, targetRowNumber, position ) => {
				expect(
					interpretRowRfInput(
						{ sourceRowNumber, targetRowNumber, position },
						10
					).status
				).toBe( 'ready' );
			}
		);
	} );

	describe( 'Column', () => {
		/**
		 * 必要なColumn選択が不足している場合はResolutionへ進めないことを確認する。
		 *
		 * 事前条件:
		 * - 現在の列選択肢が存在する。
		 * - source、target、positionのいずれかが未選択である。
		 *
		 * 操作:
		 * - Column RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - 公開結果は`not-ready`となる。
		 */
		it.each( [
			[ null, 1, 'right' as const ],
			[ 0, null, 'right' as const ],
			[ 0, 1, null ],
		] )(
			'when required Column input is not selected, should return not-ready',
			( sourceColumnIndex, targetColumnIndex, position ) => {
				expect(
					interpretColumnRfInput(
						{ sourceColumnIndex, targetColumnIndex, position },
						columns
					)
				).toEqual( { status: 'not-ready' } );
			}
		);

		/**
		 * 現在の列選択肢から消えた論理列Identityを内部指定として公開しないことを確認する。
		 *
		 * 事前条件:
		 * - 現在の列選択肢には0〜2のIdentityだけが存在する。
		 * - sourceまたはtargetに存在しないIdentityを指定する。
		 *
		 * 操作:
		 * - Column RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - 公開結果は`not-ready`となる。
		 */
		it.each( [
			[ 3, 1 ],
			[ 0, 3 ],
		] )(
			'when a selected Column identity is absent from current choices, should return not-ready',
			( sourceColumnIndex, targetColumnIndex ) => {
				expect(
					interpretColumnRfInput(
						{ sourceColumnIndex, targetColumnIndex, position: 'right' },
						columns
					)
				).toEqual( { status: 'not-ready' } );
			}
		);

		/**
		 * 現在の列選択肢に存在するIdentityをそのまま内部指定として渡すことを確認する。
		 *
		 * 事前条件:
		 * - source / targetのIdentityが現在の列選択肢に存在する。
		 * - positionが選択済みである。
		 *
		 * 操作:
		 * - Column RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - 選択されたIdentityと位置を保持する`ready`結果が返る。
		 */
		it(
			'when current Column identities and position are selected, should return them as the specification',
			() => {
				expect(
					interpretColumnRfInput(
						{
							sourceColumnIndex: 0,
							targetColumnIndex: 2,
							position: 'left',
						},
						columns
					)
				).toEqual( {
					status: 'ready',
					specification: {
						sourceColumnIndex: 0,
						targetColumnIndex: 2,
						position: 'left',
					},
				} );
			}
		);

		/**
		 * Column入力段階では同一source / targetをno-opとして拒否しないことを確認する。
		 *
		 * 事前条件:
		 * - sourceとtargetに同じ現在Identityを指定する。
		 *
		 * 操作:
		 * - Column RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - 入力成立性は満たすため`ready`となる。
		 */
		it(
			'when source and target use the same current Column identity, should still return ready',
			() => {
				expect(
					interpretColumnRfInput(
						{
							sourceColumnIndex: 1,
							targetColumnIndex: 1,
							position: 'right',
						},
						columns
					).status
				).toBe( 'ready' );
			}
		);
	} );
} );
