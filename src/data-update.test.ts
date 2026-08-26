import { applyCommittedReorder, commitReorderData } from './data-update';
import { resolveDropTarget } from './drop-target-resolution';
import {
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
} from './dnd-interaction';

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
	 * 概要: Core Tableの確定済み行並び替えでbodyの行位置だけを変更することを確認する。
	 *
	 * 事前条件:
	 * - Core Tableに3行あり、各cellは内容と属性を持つ。
	 * - 1行目から末尾への有効なCommitted Reorderがある。
	 *
	 * 操作:
	 * - applyCommittedReorder()で確定済み並び替えをattributesへ反映する。
	 *
	 * 期待結果:
	 * - 行順だけが変更され、移動前のrowとcell objectがそのまま保持される。
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
	 * 概要: Flexible Table Blockでも確定済み行並び替えを同じContractで反映できることを確認する。
	 *
	 * 事前条件:
	 * - Flexible Table Blockに3行ある。
	 * - 3行目から先頭への有効なCommitted Reorderがある。
	 *
	 * 操作:
	 * - applyCommittedReorder()で確定済み並び替えをattributesへ反映する。
	 *
	 * 期待結果:
	 * - Flexible Table Block固有の追加属性を保持したままbodyの行順だけが変更される。
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
	 * 概要: Core Tableの列並び替えをhead、body、footへ同じlogical column移動として反映することを確認する。
	 *
	 * 事前条件:
	 * - Core Tableの各sectionに3列ある。
	 * - 3列目から先頭への有効なCommitted Reorderがある。
	 *
	 * 操作:
	 * - applyCommittedReorder()で列並び替えをattributesへ反映する。
	 *
	 * 期待結果:
	 * - 各sectionで3列目のcellが先頭へ移動し、cell object自体は保持される。
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
	 * 概要: 結合セルを分断しない列移動でFlexible Table BlockのcolSpanを保持することを確認する。
	 *
	 * 事前条件:
	 * - 先頭2列を占有するcolSpan cellと3列目のcellを持つFlexible Table Blockである。
	 * - 3列目から先頭への有効なCommitted Reorderがある。
	 *
	 * 操作:
	 * - applyCommittedReorder()で列並び替えをattributesへ反映する。
	 *
	 * 期待結果:
	 * - 3列目のcellがcolSpan cellの前へ移動し、colSpan値とcell内容は保持される。
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
	 * 概要: 1回のCommitted ReorderをWordPress側へ1回の更新として渡すことを確認する。
	 *
	 * 事前条件:
	 * - Core Tableに有効な確定済み行並び替えがある。
	 * - setAttributesの呼び出し回数を記録できる。
	 *
	 * 操作:
	 * - commitReorderData()を1回実行する。
	 *
	 * 期待結果:
	 * - setAttributesが1回だけ呼ばれ、更新結果が渡される。
	 */
	it( 'when a committed reorder is applied, should update WordPress data exactly once', () => {
		const attributes = {
			body: [ { cells: [ { content: 'A' } ] }, { cells: [ { content: 'B' } ] } ],
		};
		const committedReorder = commitFromResolvedDestination( 'core/table', attributes, 'row', 0, 2 );
		const setAttributes = jest.fn();

		expect( committedReorder ).not.toBeNull();
		if ( committedReorder === null ) {
			return;
		}

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
	 * 概要: Data Updateで変換できない入力ではWordPress側のデータを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - 非対応block名のattributesとCommitted Reorderが渡される。
	 * - setAttributesの呼び出し回数を記録できる。
	 *
	 * 操作:
	 * - commitReorderData()を実行する。
	 *
	 * 期待結果:
	 * - 更新は成立せず、setAttributesは呼ばれない。
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
