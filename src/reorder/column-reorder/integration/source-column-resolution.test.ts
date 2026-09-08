/**
 * Column ReorderのDOM列解決境界が、結合セルを反映した論理列位置をInputとPresentationへ一貫して提供することを確認する。
 */

import {
	createColumnSourceIndexResolver,
	resolveColumnSourceIndex,
} from './source-column-resolution';

/**
 * 縦結合と横結合を含むTableを生成する。
 *
 * @return headとbodyで結合セル後の論理列解決を確認できるTableと対象セル。
 */
const createMergedTable = () => {
	const table = document.createElement( 'table' );
	table.innerHTML = `
		<thead>
			<tr>
				<th colspan="2">Head</th>
				<th data-testid="head-target">H3</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td rowspan="2">A</td>
				<td>B</td>
				<td>C</td>
			</tr>
			<tr>
				<td data-testid="body-target">D</td>
				<td data-testid="body-next">E</td>
			</tr>
		</tbody>
	`;

	const headTarget = table.querySelector( '[data-testid="head-target"]' );
	const bodyTarget = table.querySelector( '[data-testid="body-target"]' );
	const bodyNext = table.querySelector( '[data-testid="body-next"]' );

	/* テスト前提となる対象セルを構築できない場合は、列解決の期待結果を評価せずテスト設定の不備として扱う。 */
	if ( ! headTarget || ! bodyTarget || ! bodyNext ) {
		throw new Error( 'Column source resolution test table could not be created.' );
	}

	return {
		table,
		headTarget: headTarget as HTMLTableCellElement,
		bodyTarget: bodyTarget as HTMLTableCellElement,
		bodyNext: bodyNext as HTMLTableCellElement,
	};
};

describe( 'Column source resolution', () => {
	/**
	 * 結合セルによりDOM上のセル位置と論理列位置が異なる場合も、開始対象をTable全体の論理列へ解決できることを確認する。
	 *
	 * 事前条件:
	 * - headには2列を占有する横結合がある。
	 * - bodyには後続行まで1列を占有する縦結合がある。
	 *
	 * 操作:
	 * - 各結合の後ろにあるセルの論理列位置を要求する。
	 *
	 * 期待結果:
	 * - 横結合後のセルは論理列2として解決される。
	 * - 縦結合継続行のセルは論理列1と2として解決される。
	 */
	it( 'when merged cells shift physical cell positions, should resolve the table-wide logical source columns', () => {
		const { table, headTarget, bodyTarget, bodyNext } = createMergedTable();

		expect( resolveColumnSourceIndex( table, headTarget ) ).toBe( 2 );
		expect( resolveColumnSourceIndex( table, bodyTarget ) ).toBe( 1 );
		expect( resolveColumnSourceIndex( table, bodyNext ) ).toBe( 2 );
	} );

	/**
	 * Presentation向けResolverが生成時のセル対応を保持し、各ホバー判定でTable全体を解釈し直さないことを確認する。
	 *
	 * 事前条件:
	 * - 結合セルを含む現在Tableからセル→論理列Resolverを生成している。
	 *
	 * 操作:
	 * - Resolver生成後にTable DOMからsectionを外し、生成時に存在したセルの論理列位置を要求する。
	 *
	 * 期待結果:
	 * - Resolver生成時の論理列位置がそのまま返り、現在のTable DOM再解釈を必要としない。
	 */
	it( 'when a presentation resolver has been created, should reuse its source-column snapshot without rescanning the table', () => {
		const { table, bodyTarget } = createMergedTable();
		const resolver = createColumnSourceIndexResolver( table );

		table.replaceChildren();

		expect( resolver.resolve( bodyTarget ) ).toBe( 1 );
	} );

	/**
	 * 対象Tableに直接属さないセルを現在Tableの論理列として推測しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableとは別のTableにセルが存在する。
	 *
	 * 操作:
	 * - 別Tableのセルを現在Tableの開始対象として解決する。
	 *
	 * 期待結果:
	 * - 論理列位置は解決されない。
	 */
	it( 'when a cell does not belong directly to the target table, should not resolve a source column', () => {
		const { table } = createMergedTable();
		const otherTable = document.createElement( 'table' );
		otherTable.innerHTML = '<tbody><tr><td>Other</td></tr></tbody>';
		const otherCell = otherTable.querySelector( 'td' );

		/* 比較対象となる別Tableのセルを構築できない場合は、対象外判定ではなくテスト設定の不備として扱う。 */
		if ( ! otherCell ) {
			throw new Error( 'Other table cell could not be created.' );
		}

		expect( resolveColumnSourceIndex( table, otherCell ) ).toBeNull();
	} );
} );
