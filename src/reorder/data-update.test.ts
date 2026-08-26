/**
 * 確定済みの行・列並び替えを、テーブル内容を失わず1回のWordPress更新として反映できることを確認する。
 */

import { applyCommittedReorder, commitReorderData } from './data-update';
import { resolveDropTarget } from './drop-target-resolution';
import {
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
} from './dnd-interaction';

/**
 * テストで指定した候補を実際の判定経路へ通し、データ更新へ渡せる確定済みの並び替えを生成する。
 *
 * 移動先判定と並び替え操作の確定を省略せず通すことで、実際の更新処理と同じ前提を満たす入力を作る。
 *
 * @param blockName テスト対象のGutenbergブロック名。
 * @param attributes 判定と更新の基準となるテーブル属性。
 * @param kind テストする行または列の並び替え種別。
 * @param targetIndex 元の順序で移動対象を表す位置。
 * @param destinationIndex 元の順序に対する候補境界の位置。
 * @return 有効な候補から生成した確定済みの並び替え。確定できない場合は`null`。
 */
const commitFromResolvedDestination = (
	blockName: string,
	attributes: Readonly< Record< string, unknown > >,
	kind: 'row' | 'column',
	targetIndex: number,
	destinationIndex: number
) => {
	const session = startReorderSession( kind, { index: targetIndex } );
	if ( session === null ) {
		return null;
	}

	const destination = resolveDropTarget( {
		attributes,
		blockName,
		destinationIndex,
		kind,
		target: session.target,
	} );
	const committedReorder = completeReorderSession(
		updateReorderDestination( session, destination )
	);
	return committedReorder;
};

describe( 'Data Update', () => {
	/**
	 * 概要: Core Tableの行移動では行の位置だけが変わり、行・セル・その他の属性が保持されることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableのbodyに3行あり、セルと行は内容や追加属性を持つ。
	 * - 1行目から末尾への有効な並び替えが確定している。
	 *
	 * 操作:
	 * - applyCommittedReorder()で確定済みの行並び替えを属性へ反映する。
	 *
	 * 期待結果:
	 * - bodyの行順だけが変わり、元の行・セルとbody以外の属性は保持される。
	 */
	it( 'when a Core Table row reorder is committed, should move only the row position', () => {
		const firstCell = { content: 'A1', tag: 'th' };
		const firstRow = { cells: [ firstCell, { content: 'A2' } ], custom: 'row-a' };
		const secondRow = { cells: [ { content: 'B1' }, { content: 'B2' } ] };
		const thirdRow = { cells: [ { content: 'C1' }, { content: 'C2' } ] };
		const attributes = {
			body: [ firstRow, secondRow, thirdRow ],
			caption: 'caption',
		};
		const committedReorder = commitFromResolvedDestination( 'core/table', attributes, 'row', 0, 3 );

		expect( committedReorder ).not.toBeNull();
		if ( committedReorder === null ) {
			return;
		}

		const nextAttributes = applyCommittedReorder( 'core/table', attributes, committedReorder );

		expect( nextAttributes ).not.toBeNull();
		if ( nextAttributes === null ) {
			return;
		}
		expect( nextAttributes.caption ).toBe( 'caption' );
		expect( nextAttributes.body ).toEqual( [ secondRow, thirdRow, firstRow ] );
		expect( ( nextAttributes.body as typeof attributes.body )[ 2 ] ).toBe( firstRow );
		expect( ( nextAttributes.body as typeof attributes.body )[ 2 ].cells[ 0 ] ).toBe( firstCell );
		expect( attributes.body ).toEqual( [ firstRow, secondRow, thirdRow ] );
	} );

	/**
	 * 概要: Flexible Table Blockでも同じ行並び替え規則が働き、ブロック固有の情報を失わないことを確認する。
	 *
	 * 事前条件:
	 * - Flexible Table Blockのbodyに3行あり、テーブル以外の追加属性も存在する。
	 * - 3行目から先頭への有効な並び替えが確定している。
	 *
	 * 操作:
	 * - applyCommittedReorder()で確定済みの行並び替えを属性へ反映する。
	 *
	 * 期待結果:
	 * - bodyの行順だけが変わり、Flexible Table Block固有の追加属性は保持される。
	 */
	it( 'when a Flexible Table Block row reorder is committed, should preserve block-specific data', () => {
		const firstRow = { cells: [ { content: 'A1' }, { content: 'A2' } ] };
		const secondRow = { cells: [ { content: 'B1' }, { content: 'B2' } ] };
		const thirdRow = { cells: [ { content: 'C1' }, { content: 'C2' } ] };
		const attributes = {
			body: [ firstRow, secondRow, thirdRow ],
			customOption: { enabled: true },
		};
		const committedReorder = commitFromResolvedDestination(
			'flexible-table-block/table',
			attributes,
			'row',
			2,
			0
		);

		expect( committedReorder ).not.toBeNull();
		if ( committedReorder === null ) {
			return;
		}

		expect(
			applyCommittedReorder( 'flexible-table-block/table', attributes, committedReorder )
		).toEqual( {
			...attributes,
			body: [ thirdRow, firstRow, secondRow ],
		} );
	} );

	/**
	 * 概要: 列並び替えでは、見出し・本体・フッターへ同じ列移動が適用されることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableのhead、body、footが同じ3列を持つ。
	 * - 3列目から先頭への有効な並び替えが確定している。
	 *
	 * 操作:
	 * - applyCommittedReorder()で確定済みの列並び替えを属性へ反映する。
	 *
	 * 期待結果:
	 * - すべてのセクションで同じ列が先頭へ移動し、元のセルは保持される。
	 */
	it( 'when a Core Table column reorder is committed, should move the logical column in every section', () => {
		const headCells = [ { content: 'H1' }, { content: 'H2' }, { content: 'H3' } ];
		const bodyCells = [ { content: 'B1' }, { content: 'B2' }, { content: 'B3' } ];
		const footCells = [ { content: 'F1' }, { content: 'F2' }, { content: 'F3' } ];
		const attributes = {
			head: [ { cells: headCells } ],
			body: [ { cells: bodyCells } ],
			foot: [ { cells: footCells } ],
		};
		const committedReorder = commitFromResolvedDestination(
			'core/table',
			attributes,
			'column',
			2,
			0
		);

		expect( committedReorder ).not.toBeNull();
		if ( committedReorder === null ) {
			return;
		}

		const nextAttributes = applyCommittedReorder( 'core/table', attributes, committedReorder );

		expect( nextAttributes ).not.toBeNull();
		if ( nextAttributes === null ) {
			return;
		}
		expect( nextAttributes.head ).toEqual( [
			{ cells: [ headCells[ 2 ], headCells[ 0 ], headCells[ 1 ] ] },
		] );
		expect( nextAttributes.body ).toEqual( [
			{ cells: [ bodyCells[ 2 ], bodyCells[ 0 ], bodyCells[ 1 ] ] },
		] );
		expect( nextAttributes.foot ).toEqual( [
			{ cells: [ footCells[ 2 ], footCells[ 0 ], footCells[ 1 ] ] },
		] );
		expect( ( nextAttributes.body as Array< { cells: unknown[] } > )[ 0 ].cells[ 0 ] ).toBe(
			bodyCells[ 2 ]
		);
	} );

	/**
	 * 概要: 結合範囲を壊さない列移動では、Flexible Table BlockのcolSpanセルを一体のまま保持することを確認する。
	 *
	 * 事前条件:
	 * - 先頭2列を占有するcolSpanセルと、その後ろの3列目セルが存在する。
	 * - 3列目から先頭への有効な並び替えが確定している。
	 *
	 * 操作:
	 * - applyCommittedReorder()で確定済みの列並び替えを属性へ反映する。
	 *
	 * 期待結果:
	 * - 3列目のセルが結合セルの前へ移動し、colSpan・style・contentを持つ元のセルは保持される。
	 */
	it( 'when a Flexible Table Block column moves around a colSpan, should preserve the merged cell', () => {
		const mergedCell = { content: 'Merged', colSpan: 2, style: { color: 'red' } };
		const trailingCell = { content: 'Tail' };
		const attributes = {
			body: [
				{ cells: [ mergedCell, trailingCell ] },
				{ cells: [ { content: 'A' }, { content: 'B' }, { content: 'C' } ] },
			],
		};
		const committedReorder = commitFromResolvedDestination(
			'flexible-table-block/table',
			attributes,
			'column',
			2,
			0
		);

		expect( committedReorder ).not.toBeNull();
		if ( committedReorder === null ) {
			return;
		}

		const nextAttributes = applyCommittedReorder(
			'flexible-table-block/table',
			attributes,
			committedReorder
		);

		expect( nextAttributes ).not.toBeNull();
		if ( nextAttributes === null ) {
			return;
		}
		const reorderedRows = nextAttributes.body as Array< { cells: unknown[] } >;
		expect( reorderedRows[ 0 ].cells ).toEqual( [ trailingCell, mergedCell ] );
		expect( reorderedRows[ 0 ].cells[ 1 ] ).toBe( mergedCell );
	} );

	/**
	 * 概要: 1回の確定済み並び替えが、WordPress側でも1回の更新になることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableに有効な確定済み行並び替えがある。
	 * - setAttributesの呼び出しを記録できる。
	 *
	 * 操作:
	 * - commitReorderData()を1回実行する。
	 *
	 * 期待結果:
	 * - setAttributesが1回だけ呼ばれ、確定した並び替え結果が渡される。
	 */
	it( 'when a committed reorder is applied, should update WordPress data exactly once', () => {
		const attributes = {
			body: [ { cells: [ { content: 'A' } ] }, { cells: [ { content: 'B' } ] } ],
		};
		const committedReorder = commitFromResolvedDestination( 'core/table', attributes, 'row', 0, 2 );

		expect( committedReorder ).not.toBeNull();
		if ( committedReorder === null ) {
			return;
		}

		const setAttributes = jest.fn();
		expect(
			commitReorderData( {
				attributes,
				blockName: 'core/table',
				committedReorder,
				setAttributes,
			} )
		).toBe( true );
		expect( setAttributes ).toHaveBeenCalledTimes( 1 );
		expect( setAttributes ).toHaveBeenCalledWith( {
			body: [ attributes.body[ 1 ], attributes.body[ 0 ] ],
		} );
	} );

	/**
	 * 概要: 更新結果を安全に確定できない場合は、WordPress側へ部分的な変更を渡さないことを確認する。
	 *
	 * 事前条件:
	 * - 正式v1の対象外となるブロック名と、確定済みの並び替えが渡される。
	 * - setAttributesの呼び出しを記録できる。
	 *
	 * 操作:
	 * - commitReorderData()で更新を要求する。
	 *
	 * 期待結果:
	 * - 更新は失敗として返り、setAttributesは一度も呼ばれない。
	 */
	it( 'when committed data cannot be transformed, should not update WordPress data', () => {
		const setAttributes = jest.fn();

		expect(
			commitReorderData( {
				attributes: {
					body: [ { cells: [ { content: 'A' } ] }, { cells: [ { content: 'B' } ] } ],
				},
				blockName: 'unknown/table',
				committedReorder: {
					kind: 'column',
					target: { index: 0 },
					destination: { index: 2 },
				},
				setAttributes,
			} )
		).toBe( false );
		expect( setAttributes ).not.toHaveBeenCalled();
	} );
} );
