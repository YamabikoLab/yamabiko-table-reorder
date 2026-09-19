/**
 * RF Input InterpretationがRow / Columnフォーム入力の成立性と修正対象を判定し、成立した入力を方向固有Resolution向け内部指定へ変換するContractを確認する。
 */

import { interpretColumnRfInput, interpretRowRfInput } from './input-interpretation';

const columns = [ { columnIndex: 0 }, { columnIndex: 1 }, { columnIndex: 2 } ] as const;

describe( 'RF Input Interpretation', () => {
	describe( 'Row', () => {
		/**
		 * 必要入力が不足しているRowフォームを問題扱いせずResolutionへ進めないことを確認する。
		 *
		 * 事前条件:
		 * - 現在Tableには10行存在する。
		 * - source、target、positionのいずれか、または複数が未入力である。
		 *
		 * 操作:
		 * - Row RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - 公開結果は`not-ready`となる。
		 * - 未入力は`inputProblems`へ含まれない。
		 */
		it.each( [
			[ '', '5', 'below' as const ],
			[ '2', '', 'below' as const ],
			[ '2', '5', null ],
			[ '', '', null ],
		] )(
			'when required Row input is missing, should return not-ready without input problems',
			( sourceRowNumber, targetRowNumber, position ) => {
				expect( interpretRowRfInput( { sourceRowNumber, targetRowNumber, position }, 10 ) ).toEqual(
					{
						status: 'not-ready',
						inputProblems: [],
					}
				);
			}
		);

		/**
		 * 現在の行範囲へ安全に変換できないRow入力を対象入力と修正範囲付きで公開することを確認する。
		 *
		 * 事前条件:
		 * - 現在Tableには10行存在する。
		 * - sourceまたはtargetに非整数、1未満、現在行数超過の値が指定される。
		 *
		 * 操作:
		 * - Row RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - `not-ready`となり、不正な入力だけが1〜10の修正範囲とともに公開される。
		 */
		it.each( [
			[ 'abc', '5', 'source' as const ],
			[ '1.5', '5', 'source' as const ],
			[ '0', '5', 'source' as const ],
			[ '-1', '5', 'source' as const ],
			[ '11', '5', 'source' as const ],
			[ '2', 'abc', 'target' as const ],
			[ '2', '11', 'target' as const ],
		] )(
			'when a Row number is invalid, should expose the affected input and current range',
			( sourceRowNumber, targetRowNumber, target ) => {
				expect(
					interpretRowRfInput( { sourceRowNumber, targetRowNumber, position: 'below' }, 10 )
				).toEqual( {
					status: 'not-ready',
					inputProblems: [
						{
							target,
							correction: { kind: 'row-number-range', min: 1, max: 10 },
						},
					],
				} );
			}
		);

		/**
		 * positionが未選択でも入力済みRow番号の問題を独立して公開できることを確認する。
		 *
		 * 事前条件:
		 * - 現在Tableには10行存在する。
		 * - sourceは不正値、targetは有効値である。
		 * - positionは未選択である。
		 *
		 * 操作:
		 * - Row RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - sourceだけが1〜10の修正範囲を持つ入力問題として公開される。
		 * - position未選択によってsourceの問題情報が失われない。
		 */
		it( 'when Row position is missing and only source is invalid, should expose only the source input problem', () => {
			expect(
				interpretRowRfInput( { sourceRowNumber: 'abc', targetRowNumber: '5', position: null }, 10 )
			).toEqual( {
				status: 'not-ready',
				inputProblems: [
					{
						target: 'source',
						correction: { kind: 'row-number-range', min: 1, max: 10 },
					},
				],
			} );
		} );

		/**
		 * source / targetの両方が不正な場合に両方の問題を同時に保持できることを確認する。
		 *
		 * 期待結果:
		 * - source / targetそれぞれについて最大1件の入力問題が返る。
		 */
		it( 'when both Row numbers are invalid, should expose both input problems', () => {
			expect(
				interpretRowRfInput( { sourceRowNumber: 'abc', targetRowNumber: '0', position: null }, 10 )
			).toEqual( {
				status: 'not-ready',
				inputProblems: [
					{
						target: 'source',
						correction: { kind: 'row-number-range', min: 1, max: 10 },
					},
					{
						target: 'target',
						correction: { kind: 'row-number-range', min: 1, max: 10 },
					},
				],
			} );
		} );

		/**
		 * Row入力範囲の下限と上限を有効な内部指定へ変換できることを確認する。
		 */
		it( 'when Row numbers are at the valid range boundaries, should return their zero-based indexes', () => {
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
		} );

		/**
		 * 入力段階ではsource / targetの位置関係からno-opを判定しないことを確認する。
		 */
		it.each( [
			[ '3', '3', 'above' as const ],
			[ '3', '4', 'above' as const ],
		] )(
			'when a Row specification may become a no-op later, should still return ready',
			( sourceRowNumber, targetRowNumber, position ) => {
				expect(
					interpretRowRfInput( { sourceRowNumber, targetRowNumber, position }, 10 ).status
				).toBe( 'ready' );
			}
		);
	} );

	describe( 'Column', () => {
		/**
		 * 必要なColumn選択が不足している場合は問題扱いせずResolutionへ進めないことを確認する。
		 */
		it.each( [
			[ null, 1, 'right' as const ],
			[ 0, null, 'right' as const ],
			[ 0, 1, null ],
		] )(
			'when required Column input is not selected, should return not-ready without input problems',
			( sourceColumnIndex, targetColumnIndex, position ) => {
				expect(
					interpretColumnRfInput( { sourceColumnIndex, targetColumnIndex, position }, columns )
				).toEqual( { status: 'not-ready', inputProblems: [] } );
			}
		);

		/**
		 * 現在の列選択肢から消えた論理列Identityを対象入力と再選択条件付きで公開することを確認する。
		 */
		it.each( [
			[ 3, 1, 'source' as const ],
			[ 0, 3, 'target' as const ],
		] )(
			'when a selected Column identity is absent, should expose the affected input',
			( sourceColumnIndex, targetColumnIndex, target ) => {
				expect(
					interpretColumnRfInput(
						{ sourceColumnIndex, targetColumnIndex, position: 'right' },
						columns
					)
				).toEqual( {
					status: 'not-ready',
					inputProblems: [ { target, correction: { kind: 'select-current-column' } } ],
				} );
			}
		);

		/**
		 * sourceが未選択でも入力済みtargetの消失問題を独立して公開できることを確認する。
		 *
		 * 事前条件:
		 * - sourceは未選択である。
		 * - targetは選択済みだが現在の列選択肢から消失している。
		 *
		 * 操作:
		 * - Column RF入力の解釈を要求する。
		 *
		 * 期待結果:
		 * - targetだけが現在列からの再選択を要する入力問題として公開される。
		 * - source未選択は入力問題として扱われず、targetの問題情報も失われない。
		 */
		it( 'when Column source is missing and target is absent, should expose only the target input problem', () => {
			expect(
				interpretColumnRfInput(
					{ sourceColumnIndex: null, targetColumnIndex: 3, position: 'right' },
					columns
				)
			).toEqual( {
				status: 'not-ready',
				inputProblems: [ { target: 'target', correction: { kind: 'select-current-column' } } ],
			} );
		} );

		/**
		 * source / targetの両方が現在の列選択肢から消えた場合に両方の問題を保持できることを確認する。
		 */
		it( 'when both selected Columns are absent, should expose both input problems', () => {
			expect(
				interpretColumnRfInput(
					{ sourceColumnIndex: 3, targetColumnIndex: 4, position: null },
					columns
				)
			).toEqual( {
				status: 'not-ready',
				inputProblems: [
					{ target: 'source', correction: { kind: 'select-current-column' } },
					{ target: 'target', correction: { kind: 'select-current-column' } },
				],
			} );
		} );

		/**
		 * 現在の列選択肢に存在するIdentityをそのまま内部指定として渡すことを確認する。
		 */
		it( 'when current Column identities and position are selected, should return them as the specification', () => {
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
		} );

		/**
		 * Column入力段階では同一source / targetをno-opとして拒否しないことを確認する。
		 */
		it( 'when source and target use the same current Column identity, should still return ready', () => {
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
		} );
	} );
} );
