/**
 * WordPress Reorder IntegrationからFocus Coordinationを利用するための公開境界を担当する。
 *
 * RFの開始・明示終了に必要なフォーカス要求だけを受け付ける。
 * 要求時点の現在Editor DOMで対象を解決し、対象が成立しない場合はフォーカスを移動せず終了する。
 */

import { applyFocusTarget, resolveFocusTarget, type FocusSemanticTarget } from './coordination';

/**
 * WordPress Reorder Integrationから要求できるRF Lifecycle上のフォーカス要求。
 *
 * Phase 4で実ユーザー操作として必要なRF open / explicit closeだけを扱う。
 * Apply Lifecycleのfocusはこの境界へ先行実装しない。
 */
export type ReorderFocusRequest =
	/** RFを開いた後、初期操作である「行 / 列」選択へフォーカスする。 */
	| {
			type: 'rf-open';
			/** RFを開いた対象TableのIdentity。 */
			tableIdentity: string;
	  }
	/** 利用者がRFを明示的に終了した後、対象TableのRF toolbar入口へ戻す。 */
	| {
			type: 'rf-explicit-close';
			/** RFを終了した対象TableのIdentity。 */
			tableIdentity: string;
	  };

/**
 * RF Lifecycle上の要求を、設計で定めた意味上のフォーカス先へ変換する。
 *
 * @param request WordPress Reorder Integrationから受けたフォーカス要求。
 * @return requestの意味に対応するフォーカス先。
 */
const getTarget = ( request: ReorderFocusRequest ): FocusSemanticTarget => {
	const focusTarget: FocusSemanticTarget =
		request.type === 'rf-open' ? { type: 'rf-control' } : { type: 'rf-toolbar' };

	return focusTarget;
};

/**
 * WordPress Reorder IntegrationからRF系のフォーカスを要求する。
 *
 * 要求時点の現在Editor DOMだけを利用する。対象が現在成立しない場合は保留せず終了し、
 * 後から成立した操作へ古い要求を適用しない。
 *
 * @param request          Phase 4で許可されたRFフォーカス要求。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 */
export function requestReorderFocus(
	request: ReorderFocusRequest,
	referenceElement: Element
): void {
	const target = getTarget( request );
	const resolvedTarget = resolveFocusTarget( target, request.tableIdentity, referenceElement );
	if ( resolvedTarget !== null ) {
		applyFocusTarget( resolvedTarget );
	}
}
