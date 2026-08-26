/**
 * Drop Target Resolutionが、通常セルと結合セルを含む行・列の候補からTable構造を保てる移動先だけを返すことを確認する。
 */

import { resolveDropTarget } from './drop-target-resolution';

const coreTableAttributes = {
	body: [
		{ cells: [ { content: 'A1' }, { content: 'A2' } ] },
		{ cells: [ { content: 'B1' }, { content: 'B2' } ] },
		{ cells: [ { content: 'C1' }, { content: 'C2' } ] },
	],
};

describe( 'Drop Target Resolution', () => {
	/**
	 * 概要: 結合セルのない行DnDでは、順序を変更できる行間をReorder Destinationとして利用できることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableのbodyに3行あり、rowspanは存在しない。
	 * - 1行目を末尾へ移動しようとしている。
	 *
	 * 操作:
	 * - body末尾の境界を候補としてresolveDropTarget()を実行する。
	 *
	 * 期待結果:
	 * - Table構造を保つ末尾境界がReorder Destinationとして返される。
	 */
	it( 'when a row boundary preserves the table structure, should return the row destination', () => {
		expect(
			resolveDropTarget( {
				attributes: coreTableAttributes,
				blockName: 'core/table',
				destinationIndex: 3,
				kind: 'row',
				target: { index: 0 },
			} )
		).toEqual( { index: 3 } );
	} );

	/**
	 * 概要: 並び順が変化しない境界をReorder Destinationとして公開しないことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableのbodyに3行ある。
	 * - 2行目をReorder Targetとしている。
	 *
	 * 操作:
	 * - 対象行の直前と直後の境界をそれぞれ候補として判定する。
	 *
	 * 期待結果:
	 * - どちらも実際の順序変更にならないため`null`が返される。
	 */
	it( 'when a row destination would keep the same order, should return no destination', () => {
		expect(
			resolveDropTarget( {
				attributes: coreTableAttributes,
				blockName: 'core/table',
				destinationIndex: 1,
				kind: 'row',
				target: { index: 1 },
			} )
		).toBeNull();
		expect(
			resolveDropTarget( {
				attributes: coreTableAttributes,
				blockName: 'core/table',
				destinationIndex: 2,
				kind: 'row',
				target: { index: 1 },
			} )
		).toBeNull();
	} );

	/**
	 * 概要: Core Tableのrowspanを上下へ分断する境界を行の移動先として許可しないことを確認する。
	 *
	 * 事前条件:
	 * - 1行目のcellが2行を占有するrowspanを持つ。
	 * - rowspan外の3行目をReorder Targetとしている。
	 *
	 * 操作:
	 * - rowspan内部の行間を候補として判定する。
	 *
	 * 期待結果:
	 * - 結合範囲の一体性を保てないため`null`が返される。
	 */
	it( 'when a Core Table row boundary splits a rowspan, should return no destination', () => {
		const attributes = {
			body: [
				{ cells: [ { content: 'A1', rowspan: 2 }, { content: 'A2' } ] },
				{ cells: [ { content: 'B2' } ] },
				{ cells: [ { content: 'C1' }, { content: 'C2' } ] },
			],
		};

		expect(
			resolveDropTarget( {
				attributes,
				blockName: 'core/table',
				destinationIndex: 1,
				kind: 'row',
				target: { index: 2 },
			} )
		).toBeNull();
	} );

	/**
	 * 概要: Flexible Table BlockのrowSpanに含まれる行を単独のReorder Targetにしないことを確認する。
	 *
	 * 事前条件:
	 * - 1行目のcellが2行を占有するrowSpanを持つ。
	 * - rowSpanに含まれる2行目をReorder Targetとしている。
	 *
	 * 操作:
	 * - rowSpan外の末尾境界を候補として判定する。
	 *
	 * 期待結果:
	 * - 結合範囲の一部だけを移動できないため`null`が返される。
	 */
	it( 'when a Flexible Table Block row belongs to a rowSpan, should return no destination', () => {
		const attributes = {
			body: [
				{ cells: [ { content: 'A1', rowSpan: 2 }, { content: 'A2' } ] },
				{ cells: [ { content: 'B2' } ] },
				{ cells: [ { content: 'C1' }, { content: 'C2' } ] },
			],
		};

		expect(
			resolveDropTarget( {
				attributes,
				blockName: 'flexible-table-block/table',
				destinationIndex: 3,
				kind: 'row',
				target: { index: 1 },
			} )
		).toBeNull();
	} );

	/**
	 * 概要: 結合セルのない列DnDでは、Table構造を保つ列間をReorder Destinationとして利用できることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableに2つのlogical columnがあり、colspanは存在しない。
	 * - 2列目を先頭へ移動しようとしている。
	 *
	 * 操作:
	 * - 先頭境界を候補としてresolveDropTarget()を実行する。
	 *
	 * 期待結果:
	 * - 先頭境界がReorder Destinationとして返される。
	 */
	it( 'when a column boundary preserves the table structure, should return the column destination', () => {
		expect(
			resolveDropTarget( {
				attributes: coreTableAttributes,
				blockName: 'core/table',
				destinationIndex: 0,
				kind: 'column',
				target: { index: 1 },
			} )
		).toEqual( { index: 0 } );
	} );

	/**
	 * 概要: Flexible Table BlockのcolSpanを左右へ分断する境界を列の移動先として許可しないことを確認する。
	 *
	 * 事前条件:
	 * - 先頭cellが2列を占有するcolSpanを持つ。
	 * - colSpan外の3列目をReorder Targetとしている。
	 *
	 * 操作:
	 * - colSpan内部の列間を候補として判定する。
	 *
	 * 期待結果:
	 * - 結合範囲の一体性を保てないため`null`が返される。
	 */
	it( 'when a Flexible Table Block column boundary splits a colSpan, should return no destination', () => {
		const attributes = {
			body: [
				{ cells: [ { content: 'A', colSpan: 2 }, { content: 'B' } ] },
				{ cells: [ { content: 'C1' }, { content: 'C2' }, { content: 'C3' } ] },
			],
		};

		expect(
			resolveDropTarget( {
				attributes,
				blockName: 'flexible-table-block/table',
				destinationIndex: 1,
				kind: 'column',
				target: { index: 2 },
			} )
		).toBeNull();
	} );

	/**
	 * 概要: colspanに含まれるlogical columnを結合セルから切り離して単独移動させないことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableの先頭cellが2列を占有するcolspanを持つ。
	 * - colspanに含まれるlogical columnをReorder Targetとしている。
	 *
	 * 操作:
	 * - colspan外の末尾境界を候補として判定する。
	 *
	 * 期待結果:
	 * - 結合セルの一部だけを移動できないため`null`が返される。
	 */
	it( 'when a Core Table column belongs to a colspan, should return no destination', () => {
		const attributes = {
			body: [
				{ cells: [ { content: 'A', colspan: 2 }, { content: 'B' } ] },
				{ cells: [ { content: 'C1' }, { content: 'C2' }, { content: 'C3' } ] },
			],
		};

		expect(
			resolveDropTarget( {
				attributes,
				blockName: 'core/table',
				destinationIndex: 3,
				kind: 'column',
				target: { index: 1 },
			} )
		).toBeNull();
	} );
} );
