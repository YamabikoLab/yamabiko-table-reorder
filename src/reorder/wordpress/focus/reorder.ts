/**
 * WordPress Reorder IntegrationからFocus Coordinationを利用するための公開境界を担当する。
 *
 * RFの開始・明示終了・確認キャンセル後・反映失敗後に必要なフォーカス要求だけを受け付ける。
 * 要求時点の現在Editor DOMで対象を解決し、対象が成立しない場合はフォーカスを移動せず終了する。
 */

import { applyFocusTarget, resolveFocusTarget, type FocusSemanticTarget } from './coordination';

/**
 * Apply failure後に復帰先として指定できるRF操作。
 *
 * failure時の設計で許可される「再実行」または「入力修正」だけに限定する。
 */
export type ReorderFailureFocusControl =
	/** 現在の指定をそのまま再実行できる場合の「並び替え」操作。 */
	| 'submit'
	/** 移動元を修正する「移動する行 / 列」操作。 */
	| 'source'
	/** 移動先を修正する「移動先の行 / 列」操作。 */
	| 'destination'
	/** 移動先との位置関係を修正する「上 / 下」「左 / 右」操作。 */
	| 'relation';

/**
 * WordPress Reorder Integrationから要求できるRF Lifecycle上のフォーカス要求。
 *
 * 固定されたフォーカス先はtype自体から決まり、任意のtargetは受け取らない。
 * Apply専用の確認・反映中・成功後結果確認はこの境界には含めない。
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
	  }
	/** 確認をキャンセルしてRFへ戻った後、「並び替え」操作へ戻す。 */
	| {
			type: 'confirmation-cancel-restoration';
			/** 復帰対象TableのIdentity。 */
			tableIdentity: string;
	  }
	/** Apply failure後にRFへ戻った後、現在評価に応じた再実行または修正位置へ戻す。 */
	| {
			type: 'apply-failure-restoration';
			/** 復帰対象TableのIdentity。 */
			tableIdentity: string;
			/** 設計上許可された再実行位置または修正対象。 */
			control: ReorderFailureFocusControl;
	  };

/**
 * RF Lifecycle上の要求を、設計で定めた意味上のフォーカス先へ変換する。
 *
 * @param request WordPress Reorder Integrationから受けたフォーカス要求。
 * @return requestの意味に対応するフォーカス先。
 */
const getTarget = ( request: ReorderFocusRequest ): FocusSemanticTarget => {
	// RF openでは初期操作が設計で固定されているため、方向選択へ移動する。
	if ( request.type === 'rf-open' ) {
		return { type: 'rf-control', control: 'direction' };
	}
	// RF明示終了では、対象Tableを再び操作できるtoolbar入口へ戻す。
	if ( request.type === 'rf-explicit-close' ) {
		return { type: 'rf-toolbar' };
	}
	// 確認キャンセル後は入力を保持したRFから再実行できる「並び替え」操作へ戻す。
	if ( request.type === 'confirmation-cancel-restoration' ) {
		return { type: 'rf-control', control: 'submit' };
	}
	// Apply failure後は現在評価が選んだ再実行または修正操作だけを復帰先として採用する。
	return { type: 'rf-control', control: request.control };
};

/**
 * WordPress Reorder IntegrationからRF系のフォーカスを要求する。
 *
 * 要求時点の現在Editor DOMだけを利用する。対象が現在成立しない場合は保留せず終了し、
 * 後から成立した操作へ古い要求を適用しない。
 *
 * @param request          RF Lifecycleで許可されたフォーカス要求。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 */
export function requestReorderFocus(
	request: ReorderFocusRequest,
	referenceElement: Element
): void {
	const target = getTarget( request );
	const resolvedTarget = resolveFocusTarget( target, request.tableIdentity, referenceElement );
	// 現在表示で要求先が成立する場合だけ、その操作位置へフォーカスを適用する。
	if ( resolvedTarget !== null ) {
		applyFocusTarget( resolvedTarget );
	}
}
