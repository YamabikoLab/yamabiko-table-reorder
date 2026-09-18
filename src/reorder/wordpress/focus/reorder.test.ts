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
		document.body.append( referenceElement, direction );

		requestReorderFocus( { type: 'rf-open', tableIdentity: TABLE_IDENTITY }, referenceElement );

		expect( referenceElement.ownerDocument.activeElement ).toBe( direction );
	} );

	/**
	 * RF明示終了時に固定されたtoolbar入口へ即時focusすることを確認する。
	 *
	 * 事前条件:
	 * - 現在Presentationに対象TableのRF toolbar入口が存在する。
	 *
	 * 操作:
	 * - rf-explicit-close focusを要求する。
	 *
	 * 期待結果:
	 * - 対象TableのRF toolbar入口へfocusする。
	 */
	it( 'when RF closes explicitly, should focus the fixed reorder form toolbar entry', () => {
		const referenceElement = document.createElement( 'div' );
		const toolbarEntry = document.createElement( 'button' );
		toolbarEntry.dataset.ytrFocusTarget = 'rf-toolbar';
		toolbarEntry.dataset.ytrTableIdentity = TABLE_IDENTITY;
		document.body.append( referenceElement, toolbarEntry );

		requestReorderFocus(
			{ type: 'rf-explicit-close', tableIdentity: TABLE_IDENTITY },
			referenceElement
		);

		expect( referenceElement.ownerDocument.activeElement ).toBe( toolbarEntry );
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

	/**
	 * confirmation cancel後に固定された再実行操作へfocusを戻すことを確認する。
	 *
	 * 事前条件:
	 * - 入力を保持したRFに「並び替え」操作が成立している。
	 *
	 * 操作:
	 * - confirmation-cancel-restoration focusを要求する。
	 *
	 * 期待結果:
	 * - 「並び替え」操作へfocusする。
	 */
	it( 'when confirmation cancellation restores RF, should focus the fixed submit control', () => {
		const referenceElement = document.createElement( 'div' );
		const submit = document.createElement( 'button' );
		submit.dataset.ytrFocusControl = 'submit';
		submit.dataset.ytrTableIdentity = TABLE_IDENTITY;
		document.body.append( referenceElement, submit );

		requestReorderFocus(
			{ type: 'confirmation-cancel-restoration', tableIdentity: TABLE_IDENTITY },
			referenceElement
		);

		expect( referenceElement.ownerDocument.activeElement ).toBe( submit );
	} );

	/**
	 * Apply failure後はDesignで許可された入力修正位置へfocusできることを確認する。
	 *
	 * 事前条件:
	 * - RFに現在の移動先入力が成立している。
	 *
	 * 操作:
	 * - 移動先を修正位置とするapply-failure-restorationを要求する。
	 *
	 * 期待結果:
	 * - 現在の移動先入力へfocusする。
	 */
	it( 'when apply failure selects a correction control, should focus that current RF control', () => {
		const referenceElement = document.createElement( 'div' );
		const destination = document.createElement( 'input' );
		destination.id = getRfControlId( 'target-row' );
		document.body.append( referenceElement, destination );

		requestReorderFocus(
			{
				type: 'apply-failure-restoration',
				tableIdentity: TABLE_IDENTITY,
				control: 'destination',
			},
			referenceElement
		);

		expect( referenceElement.ownerDocument.activeElement ).toBe( destination );
	} );
} );
