/**
 * WordPress Reorder Integration向けFocus Coordinationの即時フォーカス契約を検証する。
 *
 * RF Lifecycleの要求は現在のエディター表示だけで解決し、対象が存在しない場合は保留しないことを確認する。
 */

import { requestReorderFocus } from './reorder';

const TABLE_IDENTITY = 'table-a';

/**
 * 対象TableのRF操作に割り当てるIDを生成する。
 *
 * @param suffix RF内で対象操作を識別する末尾文字列。
 * @return 対象Tableと操作を組み合わせたID。
 */
const getRfControlId = ( suffix: string ): string =>
	`yamabiko-table-reorder-rf-${ TABLE_IDENTITY }-${ suffix }`;

/** テストごとに現在Editor DOMを初期状態へ戻す。 */
beforeEach( () => {
	document.body.innerHTML = '';
} );

describe( 'WordPress Reorder Integration focus coordination', () => {
	/**
	 * RF open時にDesignで固定された方向選択へ即時focusすることを確認する。
	 *
	 * 事前条件:
	 * - 現在Presentationに行方向の選択操作が存在する。
	 *
	 * 操作:
	 * - RF open後のfocusを要求する。
	 *
	 * 期待結果:
	 * - 現在の方向選択へfocusする。
	 */
	it( 'when RF opens with its direction control present, should focus the direction control immediately', () => {
		const referenceElement = document.createElement( 'div' );
		const direction = document.createElement( 'input' );
		direction.id = getRfControlId( 'kind-row' );
		direction.setAttribute( 'type', 'radio' );
		direction.checked = true;
		document.body.append( referenceElement, direction );

		requestReorderFocus( { type: 'rf-open', tableIdentity: TABLE_IDENTITY }, referenceElement );

		expect( referenceElement.ownerDocument.activeElement ).toBe( direction );
	} );

	/**
	 * RF open時に方向操作が存在しても現在選択がない場合は、別方向を推測しないことを確認する。
	 *
	 * 事前条件:
	 * - 行・列の方向操作は存在する。
	 * - どちらも選択されていない。
	 * - 利用者は別の操作位置にfocusしている。
	 *
	 * 操作:
	 * - RF open後のfocusを要求する。
	 *
	 * 期待結果:
	 * - 現在focusを維持し、行または列へ推測focusしない。
	 */
	it( 'when RF directions exist without a current selection, should not guess a direction target', () => {
		const referenceElement = document.createElement( 'div' );
		const currentFocus = document.createElement( 'button' );
		const rowDirection = document.createElement( 'input' );
		const columnDirection = document.createElement( 'input' );
		rowDirection.id = getRfControlId( 'kind-row' );
		columnDirection.id = getRfControlId( 'kind-column' );
		rowDirection.setAttribute( 'type', 'radio' );
		columnDirection.setAttribute( 'type', 'radio' );
		document.body.append( referenceElement, currentFocus, rowDirection, columnDirection );
		currentFocus.focus();

		requestReorderFocus( { type: 'rf-open', tableIdentity: TABLE_IDENTITY }, referenceElement );

		expect( referenceElement.ownerDocument.activeElement ).toBe( currentFocus );
	} );

	/**
	 * RF明示終了時に固定されたtoolbar入口へ即時focusすることを確認する。
	 *
	 * 事前条件:
	 * - 呼び出し元が現在のRF toolbar入口をanchorとして保持している。
	 *
	 * 操作:
	 * - rf-explicit-close focusを要求する。
	 *
	 * 期待結果:
	 * - DOM再検索を行わず、渡された現在のRF toolbar入口へfocusする。
	 */
	it( 'when RF closes explicitly, should focus the current reorder form toolbar anchor directly', () => {
		const toolbarEntry = document.createElement( 'button' );
		document.body.append( toolbarEntry );

		requestReorderFocus( { type: 'rf-explicit-close' }, toolbarEntry );

		expect( toolbarEntry.ownerDocument.activeElement ).toBe( toolbarEntry );
	} );

	/**
	 * 現在DOMに要求先が存在しない場合はfocus要求を保留しないことを確認する。
	 *
	 * 事前条件:
	 * - rf-open要求時には方向選択が存在しない。
	 * - 利用者は別の操作位置にfocusしている。
	 *
	 * 操作:
	 * - rf-openを要求した後で方向選択を追加する。
	 *
	 * 期待結果:
	 * - 要求時点のfocusを維持する。
	 * - 後から成立した方向選択へ古い要求を適用しない。
	 */
	it( 'when an RF target is absent, should leave focus unchanged and not apply the request later', () => {
		const referenceElement = document.createElement( 'div' );
		const currentFocus = document.createElement( 'button' );
		document.body.append( referenceElement, currentFocus );
		currentFocus.focus();

		requestReorderFocus( { type: 'rf-open', tableIdentity: TABLE_IDENTITY }, referenceElement );

		const lateDirection = document.createElement( 'input' );
		lateDirection.id = getRfControlId( 'kind-row' );
		document.body.append( lateDirection );

		expect( referenceElement.ownerDocument.activeElement ).toBe( currentFocus );
	} );
} );
