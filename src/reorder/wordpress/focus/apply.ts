/**
 * WordPress Reorder Apply IntegrationからFocus Coordinationを利用するための公開境界を担当する。
 *
 * 確認開始と反映開始では設計上固定された位置へ即時にフォーカスし、
 * Apply成功後だけ更新後の表示再成立をまたいで最終的なフォーカス完了を待てるようにする。
 * 確定後位置は既存Apply責務から受け取り、この責務では再計算・補正・推測しない。
 */

import { applyFocusTarget, resolveFocusTarget, type FocusSemanticTarget } from './coordination';

/**
 * 確認開始またはApply開始時に、固定された位置へ即時フォーカスする要求。
 *
 * 表示復帰の完了条件として待つsettlementは持たない。
 */
export type ApplyImmediateFocusRequest =
	/** 大規模反映前の確認を開始し、「続行」操作へフォーカスする。 */
	| {
			type: 'confirmation-open';
			/** 確認対象TableのIdentity。 */
			tableIdentity: string;
	  }
	/** Tableへの反映を開始し、対象Tableの反映中状態へフォーカスする。 */
	| {
			type: 'apply-start';
			/** Apply対象TableのIdentity。 */
			tableIdentity: string;
	  };

/**
 * Apply成功後に、確定後位置の結果確認へフォーカスする要求。
 *
 * 更新後の表示再成立をまたぐ可能性があるため、最終settlementまで待機できる。
 */
export type ApplySuccessFocusRequest =
	/** 行並び替え成功後、確定した移動後行位置へフォーカスする。 */
	| {
			type: 'row-success';
			/** 成功対象TableのIdentity。 */
			tableIdentity: string;
			/** 既存Apply責務が確定した0-basedの移動後行位置。 */
			destinationIndex: number;
	  }
	/** 列並び替え成功後、確定した移動後列位置へフォーカスする。 */
	| {
			type: 'column-success';
			/** 成功対象TableのIdentity。 */
			tableIdentity: string;
			/** 既存Apply責務が確定した0-basedの移動後列位置。 */
			destinationIndex: number;
	  };

/**
 * WordPress Reorder Apply Integrationから要求できるフォーカス要求。
 *
 * 即時要求とsuccess要求では戻り値の契約が異なるため、型として区別する。
 */
export type ApplyFocusRequest = ApplyImmediateFocusRequest | ApplySuccessFocusRequest;

/**
 * Apply成功後の保留中フォーカス要求を、現在のediting surfaceで再評価するときの状態。
 */
export type ApplyFocusRestorationState =
	/** 更新後Tableのediting surfaceが再成立途中で、結果確認先の一時的不在を許容する。 */
	| 'restoring'
	/** 更新後Tableのediting surfaceが成立済みで、必要なら許可されたfallbackを確定する。 */
	| 'stable';

/**
 * Apply成功側フォーカス要求が最終的にsettleした結果。
 *
 * WordPress Reorder Apply Integrationはこの結果が確定した後にだけ、
 * focus settleを含む表示復帰完了をApply Lifecycleへ返せる。
 */
export type ApplyFocusSettlement =
	/** 設計で許可された位置へ実際にフォーカスして完了した。 */
	| {
			type: 'focused';
			/** 実際にフォーカスした位置。 */
			target: /** 確定後位置に対応する結果確認セル。 */
			| 'result'
				/** 結果確認セルが成立しない場合の対象Table自体。 */
				| 'table';
	  }
	/** stale防止または対象消失により、フォーカスせず要求を終了した。 */
	| {
			type: 'abandoned';
			/** フォーカスを適用しなかった理由。 */
			reason: /** 表示安定後も結果確認先と許可されたfallbackが成立しなかった。 */
			| 'target-unavailable'
				/** 対象TableがEditorから消失した。 */
				| 'table-removed'
				/** 利用者が別の操作位置へ移動した。 */
				| 'user-moved'
				/** Apply Lifecycleが終了または置換され、要求が古くなった。 */
				| 'lifecycle-replaced';
	  };

/**
 * Apply成功側の保留中フォーカス要求を、フォーカスせず終了させる理由。
 */
export type ApplyFocusAbandonReason =
	/** 対象TableがEditorから消失した。 */
	| 'table-removed'
	/** 利用者が別の操作位置へ移動した。 */
	| 'user-moved'
	/** Apply Lifecycleが終了または置換され、要求が古くなった。 */
	| 'lifecycle-replaced';

/**
 * success表示復帰中だけ保持するフォーカス要求。
 *
 * DOM要素やEditor DOM Contextは保持せず、対象Table、確定位置の意味、Promiseの完了通知だけを保持する。
 */
type PendingApplyFocus = {
	/** 保留中の要求が属する対象TableのIdentity。 */
	tableIdentity: string;
	/** 現在の表示で解決し直す確定後結果確認位置。 */
	target: Extract< FocusSemanticTarget, { type: 'result-cell' } >;
	/** 表示復帰barrierへ最終settlementを返す通知。 */
	resolve: ( settlement: ApplyFocusSettlement ) => void;
};

let pendingApplyFocus: PendingApplyFocus | null = null;

/**
 * 現在保留しているsuccess要求を、フォーカスせず終了する。
 *
 * @param reason フォーカスを適用しない理由。
 */
const settlePendingAsAbandoned = (
	reason: ApplyFocusAbandonReason | 'target-unavailable'
): void => {
	// 保留中のsuccess要求がない場合は、別Lifecycleのsettlementを生成しない。
	if ( pendingApplyFocus === null ) {
		return;
	}
	const { resolve } = pendingApplyFocus;
	pendingApplyFocus = null;
	resolve( { type: 'abandoned', reason } );
};

/**
 * 即時要求を、設計で固定された意味上のフォーカス先へ変換する。
 *
 * @param request 確認開始またはApply開始のフォーカス要求。
 * @return requestの意味に対応する固定フォーカス先。
 */
const getImmediateTarget = ( request: ApplyImmediateFocusRequest ): FocusSemanticTarget => {
	// 確認開始とApply開始は、それぞれ設計で固定された単一のfocus先へ対応付ける。
	const target: FocusSemanticTarget =
		request.type === 'confirmation-open'
			? { type: 'confirmation-continue' }
			: { type: 'applying-status' };
	return target;
};

/**
 * 確認開始またはApply開始時のフォーカスを要求する。
 *
 * これらは表示復帰barrierではないため、現在表示に対象が成立しなければ保留せず終了する。
 *
 * @param request          確認開始またはApply開始のフォーカス要求。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 */
export function requestApplyFocus(
	request: ApplyImmediateFocusRequest,
	referenceElement: Element
): void;

/**
 * Apply成功後の結果確認フォーカスを要求する。
 *
 * 結果確認先が現在存在すれば即時にsettleする。更新後表示の再成立途中で存在しない場合は、
 * 同じ対象Tableの現在表示で解決できるまで保留し、最終的な適用または破棄結果を返す。
 *
 * @param request          行または列のsuccess結果確認要求。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 * @return フォーカス適用または要求破棄による最終settlement。
 */
export function requestApplyFocus(
	request: ApplySuccessFocusRequest,
	referenceElement: Element
): Promise< ApplyFocusSettlement >;

export function requestApplyFocus(
	request: ApplyFocusRequest,
	referenceElement: Element
): void | Promise< ApplyFocusSettlement > {
	// 確認開始とApply開始は表示復帰barrierではないため、即時要求として処理する。
	if ( request.type === 'confirmation-open' || request.type === 'apply-start' ) {
		const target = resolveFocusTarget(
			getImmediateTarget( request ),
			request.tableIdentity,
			referenceElement
		);
		// 即時要求は現在Presentationに固定先が存在する場合だけfocusし、不在でも保留しない。
		if ( target !== null ) {
			applyFocusTarget( target );
		}
		return;
	}

	/*
	 * 新しいsuccess要求を開始するときは古い表示復帰要求を次のLifecycleへ持ち越さず、
	 * 待機中の呼び出し元へ置換されたことを返す。
	 */
	settlePendingAsAbandoned( 'lifecycle-replaced' );

	// success要求の種別に対応する移動方向を、そのまま結果確認位置の意味へ引き継ぐ。
	const kind = request.type === 'row-success' ? 'row' : 'column';
	const target: Extract< FocusSemanticTarget, { type: 'result-cell' } > = {
		type: 'result-cell',
		kind,
		destinationIndex: request.destinationIndex,
	};
	const resultTarget = resolveFocusTarget( target, request.tableIdentity, referenceElement );
	// 更新後の結果確認位置がすでに成立している場合は、表示復帰待ちを作らずsuccess要求を完了する。
	// 更新後の現在表示で確定位置が成立した時点で、結果確認focusとしてsuccess要求を完了する。
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
 * Apply成功後の保留中フォーカス要求を、現在のediting surfaceで再評価する。
 *
 * 再成立途中は結果確認先の一時的不在を許容する。表示が安定した後は確定位置を再解決し、
 * 成立しない場合だけ対象Table自体へfallbackする。隣接セルや別位置は推測しない。
 *
 * @param tableIdentity    再評価対象TableのIdentity。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 * @param restorationState 更新後editing surfaceが再成立途中か、成立済みか。
 */
export function reconcileApplyFocus(
	tableIdentity: string,
	referenceElement: Element,
	restorationState: ApplyFocusRestorationState
): void {
	// 保留要求がない場合や対象Tableが異なる場合は、現在の表示復帰へ干渉しない。
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

	// editing surface再成立中は結果確認位置の一時的不在を許容し、fallbackを確定しない。
	if ( restorationState === 'restoring' ) {
		return;
	}

	const tableTarget = resolveFocusTarget( { type: 'table' }, tableIdentity, referenceElement );
	// 表示安定後に結果確認位置が成立しない場合だけ、対象Table自体への限定fallbackを許可する。
	if ( tableTarget !== null && applyFocusTarget( tableTarget ) ) {
		const { resolve } = pendingApplyFocus;
		pendingApplyFocus = null;
		resolve( { type: 'focused', target: 'table' } );
		return;
	}

	settlePendingAsAbandoned( 'target-unavailable' );
}

/**
 * Apply成功側の保留中フォーカス要求を、フォーカスせずsettleさせる。
 *
 * Table消失、利用者の別操作への移動、Apply Lifecycle置換など、
 * 後から適用すると現在の利用者操作を奪う場合に使用する。
 *
 * @param tableIdentity 破棄対象TableのIdentity。
 * @param reason        フォーカスを適用せず終了する理由。
 */
export function abandonApplyFocus( tableIdentity: string, reason: ApplyFocusAbandonReason ): void {
	// 破棄要求は同じ対象Tableに属するsuccess要求だけをsettleし、他Tableの表示復帰には干渉しない。
	if ( pendingApplyFocus?.tableIdentity === tableIdentity ) {
		settlePendingAsAbandoned( reason );
	}
}
