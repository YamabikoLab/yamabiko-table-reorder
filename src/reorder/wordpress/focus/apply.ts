/**
 * WordPress Reorder Apply IntegrationからFocus Coordinationを利用するための公開境界を担当する。
 *
 * Apply成功後に既存Apply責務が確定した最終位置を受け取り、
 * 呼び出し時点の現在Editor DOMへ結果確認focusを一回だけ適用する。
 * 表示再成立待ち、保留、再試行、Lifecycle状態は所有しない。
 */

import { applyFocusTarget, resolveFocusTarget, type FocusSemanticTarget } from './coordination';

/**
 * Apply成功後に、確定後位置の結果確認へfocusする要求。
 */
export type ApplySuccessFocusRequest =
	/** 行並び替え成功後、確定した移動後行位置へfocusする。 */
	| {
			type: 'row-success';
			/** 成功対象TableのIdentity。 */
			tableIdentity: string;
			/** 既存Apply責務が確定した0-basedの移動後行位置。 */
			destinationIndex: number;
	  }
	/** 列並び替え成功後、確定した移動後列位置へfocusする。 */
	| {
			type: 'column-success';
			/** 成功対象TableのIdentity。 */
			tableIdentity: string;
			/** 既存Apply責務が確定した0-basedの移動後列位置。 */
			destinationIndex: number;
	  };

/**
 * Apply成功後の結果確認focusを、呼び出し時点の現在Editor DOMへ一回適用する。
 *
 * 確定位置に対応する結果確認セルが成立すればそこへfocusする。
 * 成立しない場合は対象Table自体だけをfallbackとして試し、
 * どちらも成立しない場合はfocusを移動せず終了する。
 *
 * @param request          行または列のsuccess結果確認要求。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 */
export const requestApplyFocus = (
	request: ApplySuccessFocusRequest,
	referenceElement: Element
): void => {
	// success要求の種別は、確定後位置を解釈する方向だけを決定し、位置自体は再計算しない。
	const kind = request.type === 'row-success' ? 'row' : 'column';
	const resultTarget: Extract< FocusSemanticTarget, { type: 'result-cell' } > = {
		type: 'result-cell',
		kind,
		destinationIndex: request.destinationIndex,
	};
	const resolvedResult = resolveFocusTarget(
		resultTarget,
		request.tableIdentity,
		referenceElement
	);
	// 確定後位置が現在DOMに成立する場合は、その位置だけを結果確認先として使用する。
	if ( resolvedResult !== null && applyFocusTarget( resolvedResult ) ) {
		return;
	}

	const tableTarget = resolveFocusTarget(
		{ type: 'table' },
		request.tableIdentity,
		referenceElement
	);
	// 結果確認セルが成立しない場合だけ、対象Table自体への限定fallbackを許可する。
	if ( tableTarget !== null ) {
		applyFocusTarget( tableTarget );
	}
};
