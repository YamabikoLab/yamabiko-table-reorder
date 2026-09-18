/**
 * WordPress Reorder Apply Integration向けFocus CoordinationのLifecycle契約を検証する。
 *
 * 即時focusとsuccess表示復帰barrierを分離し、結果確認target、
 * Table fallback、stale破棄によるsettlementを公開IFから確認する。
 */

import { abandonApplyFocus, reconcileApplyFocus, requestApplyFocus } from './apply';

const TABLE_IDENTITY = 'table-a';

/** 現在Editor DOMへ対象Tableを作成する。 */
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
	 * confirmation開始時に固定された続行操作へ即時focusすることを確認する。
	 *
	 * 事前条件:
	 * - 現在Presentationに確認の続行操作が存在する。
	 *
	 * 操作:
	 * - confirmation-open focusを要求する。
	 *
	 * 期待結果:
	 * - 続行操作へfocusし、Promise settlementを必要としない。
	 */
	it( 'when confirmation opens, should focus its continue action immediately', () => {
		const referenceElement = document.createElement( 'div' );
		const continueButton = document.createElement( 'button' );
		continueButton.dataset.ytrFocusTarget = 'confirmation-continue';
		document.body.append( referenceElement, continueButton );

		const result = requestApplyFocus(
			{ type: 'confirmation-open', tableIdentity: TABLE_IDENTITY },
			referenceElement
		);

		expect( result ).toBeUndefined();
		expect( referenceElement.ownerDocument.activeElement ).toBe( continueButton );
	} );

	/**
	 * Apply開始時に反映中状態へ即時focusすることを確認する。
	 *
	 * 事前条件:
	 * - 現在のApply Presentation内にfocus可能な反映中状態が存在する。
	 *
	 * 操作:
	 * - apply-start focusを要求する。
	 *
	 * 期待結果:
	 * - 反映中状態へfocusする。
	 */
	it( 'when apply starts with its status present, should focus the applying status immediately', () => {
		const referenceElement = document.createElement( 'div' );
		referenceElement.innerHTML = '<div role="status" aria-busy="true" tabindex="0"></div>';
		document.body.append( referenceElement );
		const status = referenceElement.querySelector< HTMLElement >( '[role="status"]' );

		requestApplyFocus( { type: 'apply-start', tableIdentity: TABLE_IDENTITY }, referenceElement );

		expect( referenceElement.ownerDocument.activeElement ).toBe( status );
	} );

	/**
	 * success結果確認セルが現在成立している場合に即時settleすることを確認する。
	 *
	 * 事前条件:
	 * - 更新後Tableの確定Row位置に結果確認セルが存在する。
	 *
	 * 操作:
	 * - row-success focusを要求する。
	 *
	 * 期待結果:
	 * - 確定位置のセルへfocusし、focused/resultでsettleする。
	 */
	it( 'when a success result cell already exists, should focus it and settle immediately', async () => {
		const referenceElement = document.createElement( 'div' );
		const table = createTable();
		document.body.append( referenceElement );
		const expectedCell =
			table.querySelectorAll< HTMLTableRowElement >( 'tbody tr' )[ 1 ].cells[ 0 ];

		const settlement = await requestApplyFocus(
			{ type: 'row-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 1 },
			referenceElement
		);

		expect( referenceElement.ownerDocument.activeElement ).toBe( expectedCell );
		expect( settlement ).toEqual( { type: 'focused', target: 'result' } );
	} );

	/**
	 * editing surface再成立中はsuccess targetの一時不在をpendingとして維持できることを確認する。
	 *
	 * 事前条件:
	 * - success request時には更新後Tableがまだ存在しない。
	 *
	 * 操作:
	 * - restoringで再評価した後、現在Tableを成立させて再評価する。
	 *
	 * 期待結果:
	 * - 現在Tableの結果確認セルへfocusし、Promiseがfocused/resultでsettleする。
	 */
	it( 'when a success target appears during restoration, should resolve it from the current editor DOM', async () => {
		const referenceElement = document.createElement( 'div' );
		document.body.append( referenceElement );
		const settlementPromise = requestApplyFocus(
			{ type: 'column-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 1 },
			referenceElement
		);

		reconcileApplyFocus( TABLE_IDENTITY, referenceElement, 'restoring' );
		const table = createTable();
		const expectedCell = table.querySelector< HTMLTableCellElement >( 'tr td:nth-child(2)' );
		reconcileApplyFocus( TABLE_IDENTITY, referenceElement, 'restoring' );

		await expect( settlementPromise ).resolves.toEqual( { type: 'focused', target: 'result' } );
		expect( referenceElement.ownerDocument.activeElement ).toBe( expectedCell );
	} );

	/**
	 * editing surface安定後に結果確認セルが成立しない場合の限定fallbackを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは存在するが、確定位置に対応する結果確認セルは存在しない。
	 *
	 * 操作:
	 * - success requestをstableとして再評価する。
	 *
	 * 期待結果:
	 * - 隣接セルを推測せず対象Table自体へfocusし、focused/tableでsettleする。
	 */
	it( 'when the result cell is unavailable after restoration stabilizes, should fall back only to the target table', async () => {
		const referenceElement = document.createElement( 'div' );
		document.body.append( referenceElement );
		const table = createTable();
		const settlementPromise = requestApplyFocus(
			{ type: 'row-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 99 },
			referenceElement
		);

		reconcileApplyFocus( TABLE_IDENTITY, referenceElement, 'stable' );

		await expect( settlementPromise ).resolves.toEqual( { type: 'focused', target: 'table' } );
		expect( referenceElement.ownerDocument.activeElement ).toBe( table );
	} );

	/**
	 * 安定後に結果確認先もTable fallbackも存在しない場合のsettlementを確認する。
	 *
	 * 事前条件:
	 * - success request時から対象Tableが現在DOMに存在しない。
	 *
	 * 操作:
	 * - stableとして再評価する。
	 *
	 * 期待結果:
	 * - target-unavailableとしてfocusを適用せずsettleする。
	 */
	it( 'when neither the result target nor table fallback exists after restoration stabilizes, should abandon as target unavailable', async () => {
		const referenceElement = document.createElement( 'div' );
		document.body.append( referenceElement );
		const settlementPromise = requestApplyFocus(
			{ type: 'row-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 0 },
			referenceElement
		);

		reconcileApplyFocus( TABLE_IDENTITY, referenceElement, 'stable' );

		await expect( settlementPromise ).resolves.toEqual( {
			type: 'abandoned',
			reason: 'target-unavailable',
		} );
	} );

	/**
	 * 利用者移動後にpending success requestを適用しないことを確認する。
	 *
	 * 事前条件:
	 * - success focusがpendingである。
	 * - 利用者は別操作位置へ移動している。
	 *
	 * 操作:
	 * - user-movedでpending requestを破棄する。
	 *
	 * 期待結果:
	 * - Promiseはuser-movedでsettleし、利用者の現在focusを変更しない。
	 */
	it( 'when the user moves while success focus is pending, should settle without stealing focus', async () => {
		const referenceElement = document.createElement( 'div' );
		const userTarget = document.createElement( 'button' );
		document.body.append( referenceElement, userTarget );
		const settlementPromise = requestApplyFocus(
			{ type: 'row-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 0 },
			referenceElement
		);
		userTarget.focus();

		abandonApplyFocus( TABLE_IDENTITY, 'user-moved' );

		await expect( settlementPromise ).resolves.toEqual( {
			type: 'abandoned',
			reason: 'user-moved',
		} );
		expect( referenceElement.ownerDocument.activeElement ).toBe( userTarget );
	} );

	/**
	 * 新しいsuccess requestが以前のpending requestを次Lifecycleへ持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - 以前のsuccess requestがpendingである。
	 *
	 * 操作:
	 * - 同じTableへ新しいsuccess requestを発行する。
	 *
	 * 期待結果:
	 * - 以前のrequestはlifecycle-replacedでsettleする。
	 */
	it( 'when a new success request replaces a pending one, should settle the older request as lifecycle replaced', async () => {
		const referenceElement = document.createElement( 'div' );
		document.body.append( referenceElement );
		const oldSettlement = requestApplyFocus(
			{ type: 'row-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 0 },
			referenceElement
		);

		const newSettlement = requestApplyFocus(
			{ type: 'column-success', tableIdentity: TABLE_IDENTITY, destinationIndex: 0 },
			referenceElement
		);
		abandonApplyFocus( TABLE_IDENTITY, 'lifecycle-replaced' );

		await expect( oldSettlement ).resolves.toEqual( {
			type: 'abandoned',
			reason: 'lifecycle-replaced',
		} );
		await expect( newSettlement ).resolves.toEqual( {
			type: 'abandoned',
			reason: 'lifecycle-replaced',
		} );
	} );
} );
