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
	/** 利用者がRFを明示的に終了した後、現在のRF toolbar入口へ戻す。 */
	| { type: 'rf-explicit-close' };

/**
 * RF Lifecycle上の要求を、設計で定めた意味上のフォーカス先へ変換する。
 *
 * @param request WordPress Reorder Integrationから受けたフォーカス要求。
 * @return requestの意味に対応するフォーカス先。
 */
const getTarget = (
	request: Extract< ReorderFocusRequest, { type: 'rf-open' } >
): FocusSemanticTarget => {
	const focusTarget: FocusSemanticTarget = { type: 'rf-control' };
	return focusTarget;
};

/**
 * WordPress Reorder IntegrationからRF系のフォーカスを要求する。
 *
 * 要求時点の現在Editor DOMだけを利用する。対象が現在成立しない場合は保留せず終了し、
 * 後から成立した操作へ古い要求を適用しない。
 *
 * @param request Phase 4で許可されたRFフォーカス要求。
 * @param anchor  現在のRF toolbar入口。RF openではEditor DOM Contextの基準、明示終了では復帰先として利用する。
 */
export function requestReorderFocus( request: ReorderFocusRequest, anchor: HTMLElement ): void {
	// 明示終了では呼び出し元が現在のRF入口を保持しているため、DOMから同じ入口を再探索しない。
	if ( request.type === 'rf-explicit-close' ) {
		applyFocusTarget( anchor );
		return;
	}

	const target = getTarget( request );
	const resolvedTarget = resolveFocusTarget( target, request.tableIdentity, anchor );
	// RF open時は現在Presentationに方向選択が成立する場合だけfocusする。
	if ( resolvedTarget !== null ) {
		applyFocusTarget( resolvedTarget );
	}
}
