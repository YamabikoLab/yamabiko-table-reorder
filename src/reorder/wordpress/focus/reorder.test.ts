/**
 * WordPress Reorder Integration向けFocus CoordinationのLifecycle契約を検証する。
 *
 * 現在Editor DOMだけを利用する即時focus、Presentation再生成中のpending、
 * stale intentの破棄を公開IFから確認する。
 */

import { abandonReorderFocus, reconcileReorderFocus, requestReorderFocus } from './reorder';

const TABLE_IDENTITY = 'table-a';

/**
 * RF control IDを生成する。
 * @param suffix
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
	 * RF Presentation再生成中だけtarget不在をpendingとして維持できることを確認する。
	 *
	 * 事前条件:
	 * - 再生成要求時には移動元controlが存在しない。
	 * - 同じTableの再生成後Presentationには新しい移動元controlが存在する。
	 *
	 * 操作:
	 * - Presentation再生成focusを要求し、再生成中として再評価する。
	 *
	 * 期待結果:
	 * - 新しく成立した現在controlへfocusし、古いDOM参照を必要としない。
	 */
	it( 'when a regenerated RF control is temporarily absent, should focus the current control after it reappears', () => {
		const referenceElement = document.createElement( 'div' );
		document.body.append( referenceElement );

		requestReorderFocus(
			{
				type: 'presentation-regeneration',
				tableIdentity: TABLE_IDENTITY,
				control: 'source',
			},
			referenceElement
		);

		const currentSource = document.createElement( 'input' );
		currentSource.id = getRfControlId( 'source-row' );
		document.body.append( currentSource );

		reconcileReorderFocus( TABLE_IDENTITY, referenceElement, 'regenerating' );

		expect( referenceElement.ownerDocument.activeElement ).toBe( currentSource );
	} );

	/**
	 * RF明示終了時に固定されたtoolbar入口へfocusを戻すことを確認する。
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
	 * confirmation cancel後に固定された再実行操作へfocusを戻すことを確認する。
	 *
	 * 事前条件:
	 * - 入力を保持したRFに「並び替え」操作が再成立している。
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
	 * Presentationが安定した後もtargetが成立しないrequestを終了することを確認する。
	 *
	 * 事前条件:
	 * - Presentation再生成requestがpendingである。
	 * - stable時点にも対象controlが存在しない。
	 *
	 * 操作:
	 * - stableとして再評価した後に対象controlを追加し、もう一度再評価する。
	 *
	 * 期待結果:
	 * - settle済みrequestは後から成立したcontrolへfocusしない。
	 */
	it( 'when a pending RF target remains unavailable after presentation becomes stable, should not apply it later', () => {
		const referenceElement = document.createElement( 'div' );
		const retainedFocus = document.createElement( 'button' );
		document.body.append( referenceElement, retainedFocus );
		retainedFocus.focus();

		requestReorderFocus(
			{
				type: 'presentation-regeneration',
				tableIdentity: TABLE_IDENTITY,
				control: 'destination',
			},
			referenceElement
		);
		reconcileReorderFocus( TABLE_IDENTITY, referenceElement, 'stable' );

		const lateDestination = document.createElement( 'input' );
		lateDestination.id = getRfControlId( 'target-row' );
		document.body.append( lateDestination );
		reconcileReorderFocus( TABLE_IDENTITY, referenceElement, 'stable' );

		expect( referenceElement.ownerDocument.activeElement ).toBe( retainedFocus );
	} );

	/**
	 * 利用者移動として破棄されたpending requestがfocusを奪わないことを確認する。
	 *
	 * 事前条件:
	 * - Presentation再生成requestがpendingである。
	 * - 利用者は別の操作位置へ移動している。
	 *
	 * 操作:
	 * - user-movedでrequestを破棄し、その後targetを再成立させる。
	 *
	 * 期待結果:
	 * - stale requestは新しい利用者focusを変更しない。
	 */
	it( 'when the user moves before a pending RF target returns, should abandon the stale focus request', () => {
		const referenceElement = document.createElement( 'div' );
		const userTarget = document.createElement( 'button' );
		document.body.append( referenceElement, userTarget );

		requestReorderFocus(
			{
				type: 'presentation-regeneration',
				tableIdentity: TABLE_IDENTITY,
				control: 'relation',
			},
			referenceElement
		);
		userTarget.focus();
		abandonReorderFocus( TABLE_IDENTITY, 'user-moved' );

		const relation = document.createElement( 'input' );
		relation.id = getRfControlId( 'row-above' );
		document.body.append( relation );
		reconcileReorderFocus( TABLE_IDENTITY, referenceElement, 'stable' );

		expect( referenceElement.ownerDocument.activeElement ).toBe( userTarget );
	} );

	/**
	 * 新しいLifecycle requestが古いpending requestを置換することを確認する。
	 *
	 * 事前条件:
	 * - 同じTableで以前のPresentation再生成requestがpendingである。
	 * - 新しいRF open requestの方向選択が現在DOMに成立している。
	 *
	 * 操作:
	 * - 新しいrequestを発行した後、古いtargetを再成立させる。
	 *
	 * 期待結果:
	 * - 新しい方向選択へfocusし、古いrequestを再適用しない。
	 */
	it( 'when a new RF lifecycle request arrives, should replace an older pending request', () => {
		const referenceElement = document.createElement( 'div' );
		document.body.append( referenceElement );
		requestReorderFocus(
			{
				type: 'presentation-regeneration',
				tableIdentity: TABLE_IDENTITY,
				control: 'source',
			},
			referenceElement
		);

		const direction = document.createElement( 'input' );
		direction.id = getRfControlId( 'kind-row' );
		document.body.append( direction );
		requestReorderFocus( { type: 'rf-open', tableIdentity: TABLE_IDENTITY }, referenceElement );

		const oldSource = document.createElement( 'input' );
		oldSource.id = getRfControlId( 'source-row' );
		document.body.append( oldSource );
		reconcileReorderFocus( TABLE_IDENTITY, referenceElement, 'stable' );

		expect( referenceElement.ownerDocument.activeElement ).toBe( direction );
	} );
} );
