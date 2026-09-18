/**
 * WordPress Reorder Integration向けFocus Coordination公開境界を所有する。
 *
 * RF Lifecycleで許可されたrequestをDesign上の意味targetへ変換し、現在Editor DOM Contextへ適用する。
 * RF Presentation再生成でtargetが一時的に存在しない場合だけpendingを保持する。
 */

import { applyFocusTarget, resolveFocusTarget, type FocusSemanticTarget } from './coordination';

/** WordPress Reorder IntegrationがRF内で指定できる意味上の操作。 */
export type ReorderFocusControl =
	| 'direction'
	| 'source'
	| 'destination'
	| 'relation'
	| 'submit'
	| 'cancel'
	| 'disclosure';

/** Apply failure後に復帰先として指定できるRF操作。 */
export type ReorderFailureFocusControl = 'submit' | 'source' | 'destination' | 'relation';

/** WordPress Reorder Integrationから要求できるRF Lifecycle上のfocus request。 */
export type ReorderFocusRequest =
	| { type: 'rf-open'; tableIdentity: string }
	| { type: 'rf-explicit-close'; tableIdentity: string }
	| {
			type: 'presentation-regeneration';
			tableIdentity: string;
			control: ReorderFocusControl;
	  }
	| { type: 'confirmation-cancel-restoration'; tableIdentity: string }
	| {
			type: 'apply-failure-restoration';
			tableIdentity: string;
			control: ReorderFailureFocusControl;
	  };

/** RF側pending requestを再評価するときのPresentation状態。 */
export type ReorderFocusPresentationState = 'regenerating' | 'stable';

/** RF側pending requestをfocus適用せず終了する理由。 */
export type ReorderFocusAbandonReason = 'table-removed' | 'user-moved' | 'lifecycle-replaced';

/** RF Presentation再生成中だけ保持する意味上のpending intent。 */
type PendingReorderFocus = {
	tableIdentity: string;
	target: FocusSemanticTarget;
};

let pendingReorderFocus: PendingReorderFocus | null = null;

/**
 * RF Lifecycle requestをDesign上の意味targetへ変換する。
 *
 * @param request RF Lifecycleで許可されたfocus request。
 * @return requestに対応する意味上のfocus target。
 */
const getTarget = ( request: ReorderFocusRequest ): FocusSemanticTarget => {
	if ( request.type === 'rf-open' ) {
		return { type: 'rf-control', control: 'direction' };
	}
	if ( request.type === 'rf-explicit-close' ) {
		return { type: 'rf-toolbar' };
	}
	if ( request.type === 'confirmation-cancel-restoration' ) {
		return { type: 'rf-control', control: 'submit' };
	}
	if ( request.type === 'apply-failure-restoration' ) {
		return { type: 'rf-control', control: request.control };
	}
	return { type: 'rf-control', control: request.control };
};

/**
 * WordPress Reorder IntegrationからRF系focusを要求する。
 *
 * 固定targetはrequest typeから決定し、可変targetはDesignで許可されたcontrolだけを利用する。
 * 即時適用できない通常requestは状態を残さず終了し、Presentation再生成requestだけをpendingにできる。
 *
 * @param request RF Lifecycleで許可されたfocus request。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 */
export function requestReorderFocus(
	request: ReorderFocusRequest,
	referenceElement: Element
): void {
	const target = getTarget( request );
	const resolvedTarget = resolveFocusTarget( target, request.tableIdentity, referenceElement );
	if ( resolvedTarget !== null && applyFocusTarget( resolvedTarget ) ) {
		pendingReorderFocus = null;
		return;
	}

	if ( request.type === 'presentation-regeneration' ) {
		pendingReorderFocus = {
			tableIdentity: request.tableIdentity,
			target,
		};
	}
}

/**
 * RF側pending requestを現在Editor DOMで再評価する。
 *
 * regenerating中はtarget一時不在を許容し、stableで成立しなければpendingを終了する。
 * 呼び出しごとに現在のreferenceElementからEditor DOM Contextを解決し直す。
 *
 * @param tableIdentity 再評価対象Table Identity。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 * @param presentationState RF Presentationの再生成状態。
 */
export function reconcileReorderFocus(
	tableIdentity: string,
	referenceElement: Element,
	presentationState: ReorderFocusPresentationState
): void {
	if ( pendingReorderFocus === null || pendingReorderFocus.tableIdentity !== tableIdentity ) {
		return;
	}

	const resolvedTarget = resolveFocusTarget(
		pendingReorderFocus.target,
		tableIdentity,
		referenceElement
	);
	if ( resolvedTarget !== null && applyFocusTarget( resolvedTarget ) ) {
		pendingReorderFocus = null;
		return;
	}

	if ( presentationState === 'stable' ) {
		pendingReorderFocus = null;
	}
}

/**
 * RF側pending requestをfocus適用せず終了する。
 *
 * @param tableIdentity 破棄対象Table Identity。
 * @param reason focusを適用せず終了する理由。呼び出し側Lifecycleの記録用途。
 */
export function abandonReorderFocus(
	tableIdentity: string,
	reason: ReorderFocusAbandonReason
): void {
	void reason;
	if ( pendingReorderFocus?.tableIdentity === tableIdentity ) {
		pendingReorderFocus = null;
	}
}
