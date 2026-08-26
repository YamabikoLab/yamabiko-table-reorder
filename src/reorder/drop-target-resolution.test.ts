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
	 * 概要: 行DnDで有効な行間を移動先として解決できることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableに3行あり、結合セルは存在しない。
	 * - 1行目を末尾へ移動しようとしている。
	 *
	 * 操作:
	 * - 末尾の行間indexを指定してresolveDropTarget()を実行する。
	 *
	 * 期待結果:
	 * - 末尾の行間がReorder Destinationとして返される。
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
	 * 概要: 同じ位置へ戻る行間を有効な移動先として扱わないことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableに3行ある。
	 * - 2行目を並び替え対象としている。
	 *
	 * 操作:
	 * - 並び替え対象の直前または直後の行間を指定する。
	 *
	 * 期待結果:
	 * - どちらも並び順が変わらないため`null`が返される。
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
	 * 概要: Core Tableのrowspanを分断する行間を拒否することを確認する。
	 *
	 * 事前条件:
	 * - 1行目のセルが2行分のrowspanを持つCore Tableである。
	 * - rowspan外の3行目を並び替え対象としている。
	 *
	 * 操作:
	 * - rowspan内部の行間を移動先候補として判定する。
	 *
	 * 期待結果:
	 * - Table構造を保てないため`null`が返される。
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
	 * 概要: Flexible Table BlockのrowSpanに含まれる行を並び替え対象にしないことを確認する。
	 *
	 * 事前条件:
	 * - 1行目のセルが2行分のrowSpanを持つFlexible Table Blockである。
	 * - rowSpanに含まれる2行目を並び替え対象としている。
	 *
	 * 操作:
	 * - rowSpan外の末尾を移動先候補として判定する。
	 *
	 * 期待結果:
	 * - 結合範囲そのものを分離できないため`null`が返される。
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
	 * 概要: 列DnDで有効な列間を移動先として解決できることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableに2列あり、結合セルは存在しない。
	 * - 2列目を先頭へ移動しようとしている。
	 *
	 * 操作:
	 * - 先頭の列間indexを指定してresolveDropTarget()を実行する。
	 *
	 * 期待結果:
	 * - 先頭の列間がReorder Destinationとして返される。
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
	 * 概要: Flexible Table BlockのcolSpanを分断する列間を拒否することを確認する。
	 *
	 * 事前条件:
	 * - 先頭セルが2列分のcolSpanを持つFlexible Table Blockである。
	 * - colSpan外の3列目を並び替え対象としている。
	 *
	 * 操作:
	 * - colSpan内部の列間を移動先候補として判定する。
	 *
	 * 期待結果:
	 * - Table構造を保てないため`null`が返される。
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
	 * 概要: colspanに含まれるlogical columnを単独の並び替え対象にしないことを確認する。
	 *
	 * 事前条件:
	 * - 先頭セルが2列分のcolspanを持つCore Tableである。
	 * - colspanに含まれるlogical columnを並び替え対象としている。
	 *
	 * 操作:
	 * - colspan外の末尾を移動先候補として判定する。
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
