/**
 * WordPress Reorder Apply Integration向けFocus Coordination公開境界を所有する。
 *
 * confirmation / Apply開始の即時focusと、success後の表示復帰barrierを分離する。
 * successだけがpendingとsettlementを持ち、確定後位置は既存Apply責務から受け取った値をそのまま利用する。
 */

import { applyFocusTarget, resolveFocusTarget, type FocusSemanticTarget } from './coordination';

/** confirmation開始 / Apply開始時に即時focusを要求するrequest。 */
export type ApplyImmediateFocusRequest =
	| { type: 'confirmation-open'; tableIdentity: string }
	| { type: 'apply-start'; tableIdentity: string };

/** Apply成功後の結果確認focusを要求するrequest。 */
export type ApplySuccessFocusRequest =
	| { type: 'row-success'; tableIdentity: string; destinationIndex: number }
	| { type: 'column-success'; tableIdentity: string; destinationIndex: number };

/** WordPress Reorder Apply Integrationから要求できるfocus request。 */
export type ApplyFocusRequest = ApplyImmediateFocusRequest | ApplySuccessFocusRequest;

/** Apply success後のpending requestを再評価するときのediting surface状態。 */
export type ApplyFocusRestorationState = 'restoring' | 'stable';

/** Apply success側focus requestの最終settlement。 */
export type ApplyFocusSettlement =
	| { type: 'focused'; target: 'result' | 'table' }
	| {
			type: 'abandoned';
			reason: 'target-unavailable' | 'table-removed' | 'user-moved' | 'lifecycle-replaced';
	  };

/** Apply success側pending requestをfocus適用せず終了する理由。 */
export type ApplyFocusAbandonReason = 'table-removed' | 'user-moved' | 'lifecycle-replaced';

/** success表示復帰中だけ保持する意味上のpending intent。 */
type PendingApplyFocus = {
	tableIdentity: string;
	target: Extract< FocusSemanticTarget, { type: 'result-cell' } >;
	resolve: ( settlement: ApplyFocusSettlement ) => void;
};

let pendingApplyFocus: PendingApplyFocus | null = null;

/**
 * 既存pending successをstaleとして終了する。
 *
 * @param reason focusを適用せず終了する理由。
 */
const settlePendingAsAbandoned = (
	reason: ApplyFocusAbandonReason | 'target-unavailable'
): void => {
	if ( pendingApplyFocus === null ) {
		return;
	}
	const { resolve } = pendingApplyFocus;
	pendingApplyFocus = null;
	resolve( { type: 'abandoned', reason } );
};

/**
 * 即時requestをDesign上の意味targetへ変換する。
 *
 * @param request confirmation-open / apply-start request。
 * @return requestに対応する意味上のfocus target。
 */
const getImmediateTarget = ( request: ApplyImmediateFocusRequest ): FocusSemanticTarget => {
	const target: FocusSemanticTarget =
		request.type === 'confirmation-open'
			? { type: 'confirmation-continue' }
			: { type: 'applying-status' };
	return target;
};

/**
 * confirmation開始 / Apply開始時のfocusを要求する。
 *
 * これらは表示復帰barrierではないため、targetが現在成立しなければpendingを作らず終了する。
 *
 * @param request          confirmation-open / apply-start request。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 */
export function requestApplyFocus(
	request: ApplyImmediateFocusRequest,
	referenceElement: Element
): void;

/**
 * Apply success後の結果確認focusを要求する。
 *
 * 結果確認targetが現在存在すれば即時settleし、一時的に存在しなければediting surface restoration中の
 * pending intentとして保持する。
 *
 * @param request          row-success / column-success request。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 * @return focus適用またはintent破棄による最終settlement。
 */
export function requestApplyFocus(
	request: ApplySuccessFocusRequest,
	referenceElement: Element
): Promise< ApplyFocusSettlement >;

export function requestApplyFocus(
	request: ApplyFocusRequest,
	referenceElement: Element
): void | Promise< ApplyFocusSettlement > {
	if ( request.type === 'confirmation-open' || request.type === 'apply-start' ) {
		const target = resolveFocusTarget(
			getImmediateTarget( request ),
			request.tableIdentity,
			referenceElement
		);
		if ( target !== null ) {
			applyFocusTarget( target );
		}
		return;
	}

	settlePendingAsAbandoned( 'lifecycle-replaced' );
	const kind = request.type === 'row-success' ? 'row' : 'column';
	const target: Extract< FocusSemanticTarget, { type: 'result-cell' } > = {
		type: 'result-cell',
		kind,
		destinationIndex: request.destinationIndex,
	};
	const resultTarget = resolveFocusTarget( target, request.tableIdentity, referenceElement );
	if ( resultTarget !== null && applyFocusTarget( resultTarget ) ) {
		return Promise.resolve( { type: 'focused', target: 'result' } );
	}

	return new Promise< ApplyFocusSettlement >( ( resolve ) => {
		pendingApplyFocus = {
			tableIdentity: request.tableIdentity,
			target,
			resolve,
		};
	} );
}

/**
 * Apply success後のpending requestを現在Editor DOMで再評価する。
 *
 * restoring中は結果確認targetの一時不在を許容する。stableでは結果確認targetを再解決し、
 * 成立しない場合にだけ対象Table自体の安定した位置へfallbackする。
 *
 * @param tableIdentity    再評価対象Table Identity。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 * @param restorationState 更新後editing surfaceの再成立状態。
 */
export function reconcileApplyFocus(
	tableIdentity: string,
	referenceElement: Element,
	restorationState: ApplyFocusRestorationState
): void {
	if ( pendingApplyFocus === null || pendingApplyFocus.tableIdentity !== tableIdentity ) {
		return;
	}

	const resultTarget = resolveFocusTarget(
		pendingApplyFocus.target,
		tableIdentity,
		referenceElement
	);
	if ( resultTarget !== null && applyFocusTarget( resultTarget ) ) {
		const { resolve } = pendingApplyFocus;
		pendingApplyFocus = null;
		resolve( { type: 'focused', target: 'result' } );
		return;
	}

	if ( restorationState === 'restoring' ) {
		return;
	}

	const tableTarget = resolveFocusTarget( { type: 'table' }, tableIdentity, referenceElement );
	if ( tableTarget !== null && applyFocusTarget( tableTarget ) ) {
		const { resolve } = pendingApplyFocus;
		pendingApplyFocus = null;
		resolve( { type: 'focused', target: 'table' } );
		return;
	}

	settlePendingAsAbandoned( 'target-unavailable' );
}

/**
 * Apply success側pending requestをfocus適用せずsettleさせる。
 *
 * @param tableIdentity 破棄対象Table Identity。
 * @param reason        focusを適用せず終了する理由。
 */
export function abandonApplyFocus( tableIdentity: string, reason: ApplyFocusAbandonReason ): void {
	if ( pendingApplyFocus?.tableIdentity === tableIdentity ) {
		settlePendingAsAbandoned( reason );
	}
}
