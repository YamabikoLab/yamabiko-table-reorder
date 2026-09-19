/**
 * WordPress Reorder Apply Integration向けFocus Coordinationの一回focus契約を検証する。
 *
 * Apply success時の確定位置、Table fallback、target不成立時の無介入を公開境界から確認する。
 */

import { requestApplyFocus } from './apply';

const TABLE_IDENTITY = 'table-a';

/**
 * 現在のエディター表示に、結果確認対象となるTableを作成する。
 *
 * @return 対象TableのBlock要素。
 */
const createTable = (): HTMLDivElement => {
	const block = document.createElement( 'div' );
	block.setAttribute( 'data-block', TABLE_IDENTITY );
	block.innerHTML =
		'<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>';
	document.body.append( block );
	return block;
};

/** テストごとに現在Editor DOMを初期状態へ戻す。 */
beforeEach( () => {
	document.body.innerHTML = '';
} );

describe( 'WordPress Reorder Apply Integration focus coordination', () => {
	/**
	 * Apply成功後の結果セルが通常のTab移動対象でなくても、結果確認focusを維持できることを確認する。
	 *
	 * 事前条件:
	 * - 確定後の行位置に通常はfocus対象でない結果セルが存在する。
	 *
	 * 操作:
	 * - 結果セルへのfocusを要求した後、利用者が別の操作位置へ移動する。
	 *
	 * 期待結果:
	 * - 結果セルへfocusしている間だけ一時的にfocus可能な状態を維持する。
	 * - 別の操作位置へ移動した後は、一時的なfocus属性を残さない。
	 */
	it( 'when a row success cell is not normally focusable, should keep focusability only while the result cell is focused', () => {
		const referenceElement = document.createElement( 'div' );
		const nextControl = document.createElement( 'button' );
		const table = createTable();
		document.body.append( referenceElement, nextControl );
		const expectedCell =
			table.querySelectorAll< HTMLTableRowElement >( 'tbody tr' )[ 1 ].cells[ 0 ];

		const result = requestApplyFocus(
			{ type: 'row-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 1 },
			referenceElement
		);

		expect( result ).toBeUndefined();
		expect( referenceElement.ownerDocument.activeElement ).toBe( expectedCell );
		expect( expectedCell ).toHaveAttribute( 'tabindex', '-1' );

		nextControl.focus();

		expect( expectedCell ).not.toHaveAttribute( 'tabindex' );
	} );

	it( 'when the moved logical column is covered by a merged cell, should focus the merged result cell', () => {
		const referenceElement = document.createElement( 'div' );
		const block = document.createElement( 'div' );
		block.setAttribute( 'data-block', TABLE_IDENTITY );
		block.innerHTML =
			'<table><tbody><tr><td colspan="2">Merged</td><td>C</td></tr></tbody></table>';
		document.body.append( referenceElement, block );
		const mergedCell = block.querySelector< HTMLTableCellElement >( 'td[colspan="2"]' );

		requestApplyFocus(
			{ type: 'column-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 1 },
			referenceElement
		);

		expect( referenceElement.ownerDocument.activeElement ).toBe( mergedCell );
	} );

	it( 'when the result cell is unavailable, should fall back only to the target table', () => {
		const referenceElement = document.createElement( 'div' );
		const table = createTable();
		document.body.append( referenceElement );

		requestApplyFocus(
			{ type: 'row-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 99 },
			referenceElement
		);

		expect( referenceElement.ownerDocument.activeElement ).toBe( table );
	} );

	it( 'when neither the result target nor table fallback exists, should leave the current focus unchanged', () => {
		const referenceElement = document.createElement( 'div' );
		const retainedFocus = document.createElement( 'button' );
		document.body.append( referenceElement, retainedFocus );
		retainedFocus.focus();

		requestApplyFocus(
			{ type: 'row-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 0 },
			referenceElement
		);

		expect( referenceElement.ownerDocument.activeElement ).toBe( retainedFocus );
	} );
} );
