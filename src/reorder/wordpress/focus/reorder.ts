/**
 * WordPress Reorder IntegrationからFocus Coordinationを利用するための公開境界を担当する。
 *
 * RFの開始・終了・表示再生成・確認キャンセル後・反映失敗後に必要なフォーカス要求だけを受け付ける。
 * 通常はその場で完了し、RF表示の再生成中に操作位置が一時的に存在しない場合だけ、
 * 対象Tableに結び付いた最小の要求を保持する。
 */

import { applyFocusTarget, resolveFocusTarget, type FocusSemanticTarget } from './coordination';

/**
 * WordPress Reorder Integrationが、RF内の可変なフォーカス先として指定できる操作。
 *
 * 固定先が設計で決まっている遷移には使用せず、表示再生成や反映失敗後など、
 * 現在状態から呼び出し側が操作役割を選ぶ必要がある場合だけ指定する。
 */
export type ReorderFocusControl =
	/** RFで並び替える種類として「行 / 列」を選択する操作。 */
	| 'direction'
	/** 「移動する行」または「移動する列」を指定する操作。 */
	| 'source'
	/** 「移動先の行」または「移動先の列」を指定する操作。 */
	| 'destination'
	/** 行の「上 / 下」または列の「左 / 右」を指定する操作。 */
	| 'relation'
	/** 現在の指定で並び替えを開始する「並び替え」操作。 */
	| 'submit'
	/** Tableを変更せずRFを終了する「キャンセル」操作。 */
	| 'cancel'
	/** Narrow表示等でRFを折りたたむ、または展開する操作。 */
	| 'disclosure';

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
	/** RF表示が再生成された後、利用者が操作していた役割を現在表示へ維持する。 */
	| {
			type: 'presentation-regeneration';
			/** フォーカス要求が属する対象TableのIdentity。 */
			tableIdentity: string;
			/** 再生成前に利用者が操作していたRF内の操作役割。 */
			control: ReorderFocusControl;
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
 * RF側の保留中フォーカス要求を現在表示で再評価するときの状態。
 */
export type ReorderFocusPresentationState =
	/** RF表示がまだ再生成途中で、操作位置の一時的不在を許容する。 */
	| 'regenerating'
	/** RF表示が成立済みで、現在の表示から操作位置を解決できる状態。 */
	| 'stable';

/**
 * RF側の保留中フォーカス要求を、フォーカスを適用せず終了させる理由。
 */
export type ReorderFocusAbandonReason =
	/** 対象TableがEditorから消失し、復帰先が成立しなくなった。 */
	| 'table-removed'
	/** 利用者が別の操作位置へ移動し、古い要求を適用すべきでなくなった。 */
	| 'user-moved'
	/** RF Lifecycleが終了または置換され、保持中の要求が古くなった。 */
	| 'lifecycle-replaced';

/**
 * RF表示の再生成中だけ保持するフォーカス要求。
 *
 * DOM要素やEditor DOM Contextは保持せず、対象Tableと意味上の操作位置だけを保持する。
 */
type PendingReorderFocus = {
	/** 保留中の要求が属する対象TableのIdentity。 */
	tableIdentity: string;
	/** 再生成後の現在表示で解決し直す意味上のフォーカス先。 */
	target: FocusSemanticTarget;
};

let pendingReorderFocus: PendingReorderFocus | null = null;

/**
 * RF Lifecycle上の要求を、設計で定めた意味上のフォーカス先へ変換する。
 *
 * @param request WordPress Reorder Integrationから受けたフォーカス要求。
 * @return requestの意味に対応するフォーカス先。
 */
const getTarget = ( request: ReorderFocusRequest ): FocusSemanticTarget => {
	// RF openでは初期操作が設計で固定されているため、方向選択へ戻す。
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
	if ( request.type === 'apply-failure-restoration' ) {
		return { type: 'rf-control', control: request.control };
	}
	return { type: 'rf-control', control: request.control };
};

/**
 * WordPress Reorder IntegrationからRF系のフォーカスを要求する。
 *
 * 通常の要求は現在表示で即時に完了する。RF表示再生成中に操作位置が一時的に存在しない場合だけ、
 * 同じ対象Tableに結び付けて保留できる。新しい要求を受けた場合は以前の保留要求を次の操作へ持ち越さない。
 *
 * @param request          RF Lifecycleで許可されたフォーカス要求。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 */
export function requestReorderFocus(
	request: ReorderFocusRequest,
	referenceElement: Element
): void {
	/*
	 * Focus Coordination専用のLifecycle IDや待ち行列は持たず、
	 * 新しい利用者操作を優先して以前の保留要求を終了する。
	 */
	pendingReorderFocus = null;

	const target = getTarget( request );
	const resolvedTarget = resolveFocusTarget( target, request.tableIdentity, referenceElement );
	// 現在Presentationで要求先が成立してfocusできた場合は、その場で要求を完了する。
	if ( resolvedTarget !== null && applyFocusTarget( resolvedTarget ) ) {
		pendingReorderFocus = null;
		return;
	}

	// 即時適用できない要求のうち、表示再生成だけは操作位置の一時的不在を許容して保留する。
	if ( request.type === 'presentation-regeneration' ) {
		pendingReorderFocus = {
			tableIdentity: request.tableIdentity,
			target,
		};
	}
}

/**
 * RF側の保留中フォーカス要求を、現在のエディター表示で再評価する。
 *
 * 対象Tableが一致する要求だけを再評価する。表示再生成中は操作位置の一時的不在を許容し、
 * 表示が安定した後も成立しない要求は終了する。再評価のたびに現在の基準要素から表示環境を解決し直す。
 *
 * @param tableIdentity     再評価対象TableのIdentity。
 * @param referenceElement  現在Editor DOM Contextを特定する基準要素。
 * @param presentationState RF表示が再生成途中か、成立済みか。
 */
export function reconcileReorderFocus(
	tableIdentity: string,
	referenceElement: Element,
	presentationState: ReorderFocusPresentationState
): void {
	// 保留要求がない場合や対象Tableが異なる場合は、現在の操作位置へ干渉しない。
	if ( pendingReorderFocus === null || pendingReorderFocus.tableIdentity !== tableIdentity ) {
		return;
	}

	const resolvedTarget = resolveFocusTarget(
		pendingReorderFocus.target,
		tableIdentity,
		referenceElement
	);
	// 再生成後の現在Presentationで要求先が成立した時点で、保留要求を完了する。
	if ( resolvedTarget !== null && applyFocusTarget( resolvedTarget ) ) {
		pendingReorderFocus = null;
		return;
	}

	// Presentation成立後も要求先が存在しない場合は、後から古いfocusを適用しないよう保留を終了する。
	if ( presentationState === 'stable' ) {
		pendingReorderFocus = null;
	}
}

/**
 * RF側の保留中フォーカス要求を、フォーカスを適用せず終了する。
 *
 * Table消失、利用者の別操作への移動、RF Lifecycle置換など、
 * 後から適用すると現在の利用者操作を奪う場合に使用する。
 *
 * @param tableIdentity 破棄対象TableのIdentity。
 * @param reason        フォーカスを適用せず終了する理由。
 */
export function abandonReorderFocus(
	tableIdentity: string,
	reason: ReorderFocusAbandonReason
): void {
	void reason;
	// 破棄要求は同じ対象Tableに属する保留だけへ適用し、他TableのLifecycleには干渉しない。
	if ( pendingReorderFocus?.tableIdentity === tableIdentity ) {
		pendingReorderFocus = null;
	}
}
