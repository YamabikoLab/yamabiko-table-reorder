/**
 * Focus Coordinationが共通して利用する、現在のエディターDOMへのフォーカス適用を担当する。
 *
 * 呼び出し元から渡された意味上のフォーカス先を、要求時点のEditor DOM Contextで解決する。
 * 表示再生成をまたぐDOM参照やエディター環境は保持せず、Table構造や確定後位置もこの責務の状態として所有しない。
 */

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

/**
 * Focus Coordination内部で共通して扱う意味上のフォーカス先。
 *
 * 具体的なDOM要素ではなく、RF / Applyの設計上どの操作位置を必要としているかを表す。
 */
export type FocusSemanticTarget =
	/** RF内の操作役割へフォーカスする。 */
	| {
			type: 'rf-control';
			/** RF open後の初期操作である行 / 列選択。 */
			control: 'direction';
	  }
	/** 対象TableのRF toolbar入口へフォーカスする。 */
	| { type: 'rf-toolbar' }
	/** 大規模反映前の確認画面で「続行」操作へフォーカスする。 */
	| { type: 'confirmation-continue' }
	/** 対象Tableの反映中状態へフォーカスする。 */
	| { type: 'applying-status' }
	/** Apply責務が確定した移動後位置に対応する結果確認セルへフォーカスする。 */
	| {
			type: 'result-cell';
			/** 結果確認対象が行移動か列移動かを表す。 */
			kind: 'row' | 'column';
			/** Apply責務が確定した0-basedの移動後位置。 */
			destinationIndex: number;
	  }
	/** 結果確認セルが成立しない場合に、対象Table自体の安定した操作位置へフォーカスする。 */
	| { type: 'table' };

/**
 * 現在のエディター表示環境から対象TableのBlockを解決する。
 *
 * 対象Tableが現在の表示環境に存在しない場合は、別のTableや過去の表示環境を代用しない。
 *
 * @param editorDocument 現在Editor DOM Contextのdocument。
 * @param tableIdentity  対象TableのIdentity。
 * @return 現在の表示環境に存在する対象TableのBlock。存在しない場合はnull。
 */
const resolveTableBlock = (
	editorDocument: Document,
	tableIdentity: string
): HTMLElement | null => {
	/*
	 * 同じエディター内には複数のBlockが存在できるため、
	 * 対象Identityと一致するBlockだけを現在のTableとして採用する。
	 */
	for ( const element of Array.from(
		editorDocument.querySelectorAll< HTMLElement >( '[data-block]' )
	) ) {
		// 対象Tableとして扱えるのは、要求されたIdentityと一致するBlockだけとする。
		if ( element.getAttribute( 'data-block' ) === tableIdentity ) {
			return element;
		}
	}
	return null;
};

/**
 * RF open後の方向選択を、現在の表示に存在する操作へ解決する。
 *
 * @param editorDocument 現在Editor DOM Contextのdocument。
 * @param tableIdentity  対象TableのIdentity。
 * @return 現在選択されている行 / 列操作。成立しない場合はnull。
 */
const resolveReorderDirection = (
	editorDocument: Document,
	tableIdentity: string
): HTMLElement | null => {
	const prefix = `yamabiko-table-reorder-rf-${ tableIdentity }`;
	const rowDirection = editorDocument.getElementById(
		`${ prefix }-kind-row`
	) as HTMLInputElement | null;
	const columnDirection = editorDocument.getElementById(
		`${ prefix }-kind-column`
	) as HTMLInputElement | null;
	const selectedDirection =
		[ rowDirection, columnDirection ].find( ( element ) => element?.checked ) ?? null;
	return selectedDirection ?? rowDirection ?? columnDirection;
};

/**
 * Apply成功後の確定位置に対応する結果確認セルを現在Tableから解決する。
 *
 * 受け取った確定位置を補正したり隣接位置から推測したりせず、
 * 現在Table上でその位置を表すセルが成立する場合だけ結果確認先として返す。
 *
 * @param tableBlock       対象Tableの現在Block。
 * @param kind             行移動または列移動。
 * @param destinationIndex Apply責務が確定した0-basedの移動後位置。
 * @return 確定位置に対応する結果確認セル。成立しない場合はnull。
 */
const resolveResultCell = (
	tableBlock: HTMLElement,
	kind: 'row' | 'column',
	destinationIndex: number
): HTMLTableCellElement | null => {
	const table = tableBlock.querySelector< HTMLTableElement >( 'table' );
	// 現在Tableまたは確定後位置が成立しない場合は、結果確認セルを推測しない。
	if ( table === null || destinationIndex < 0 ) {
		return null;
	}

	// 行移動では、確定後行の先頭セルを結果確認位置とする。
	if ( kind === 'row' ) {
		const row = table.tBodies.item( 0 )?.rows.item( destinationIndex ) ?? null;
		const resultCell = row?.cells.item( 0 ) ?? null;
		return resultCell;
	}

	const firstRow = table.rows.item( 0 );
	// 列移動では論理列を判定できる行が存在しないTableを結果確認対象にしない。
	if ( firstRow === null ) {
		return null;
	}

	let logicalColumnStart = 0;
	/*
	 * colspanを持つセルではDOM上のセル位置と論理列位置が一致しないため、
	 * 各セルの占有範囲から確定列位置を含むセルだけを結果確認先として採用する。
	 */
	for ( const cell of Array.from( firstRow.cells ) ) {
		const logicalColumnEnd = logicalColumnStart + cell.colSpan;
		// 確定後の論理列を占有するセルだけを結果確認位置として採用する。
		if ( destinationIndex >= logicalColumnStart && destinationIndex < logicalColumnEnd ) {
			return cell;
		}
		logicalColumnStart = logicalColumnEnd;
	}
	return null;
};

/**
 * 意味上のフォーカス先を、現在のEditor DOM Contextに存在する要素へ解決する。
 *
 * 要求時点の基準要素が属する表示環境だけを使用し、globalのdocumentや過去の表示環境へ切り替えない。
 *
 * @param target           設計上の意味で指定されたフォーカス先。
 * @param tableIdentity    対象TableのIdentity。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 * @return 現在の表示環境で成立するフォーカス先。成立しない場合はnull。
 */
export const resolveFocusTarget = (
	target: FocusSemanticTarget,
	tableIdentity: string,
	referenceElement: Element
): HTMLElement | null => {
	const editorContext = resolveEditorDomContext( referenceElement );
	// 現在のエディター表示環境を解決できない場合は、globalや過去の表示環境で代用しない。
	if ( editorContext === null ) {
		return null;
	}

	// RF内操作の要求は、対象Tableの現在Presentationに存在する同じ操作役割へ解決する。
	if ( target.type === 'rf-control' ) {
		return resolveReorderDirection( editorContext.document, tableIdentity );
	}

	// RF明示終了後の要求は、対象Table自身のtoolbar入口だけへ戻す。
	if ( target.type === 'rf-toolbar' ) {
		/*
		 * 複数Tableのtoolbarが同じEditor文書に存在できるため、
		 * 対象Identityと一致するRF入口だけを復帰先として採用する。
		 */
		for ( const element of Array.from(
			editorContext.document.querySelectorAll< HTMLElement >(
				'[data-ytr-focus-target="rf-toolbar"]'
			)
		) ) {
			// 複数Tableのtoolbarが存在しても、要求元Tableの入口だけを復帰先とする。
			if ( element.getAttribute( 'data-ytr-table-identity' ) === tableIdentity ) {
				return element;
			}
		}
		return null;
	}

	// 確認開始後の要求は、設計で固定された「続行」操作へ解決する。
	if ( target.type === 'confirmation-continue' ) {
		const confirmationTarget = editorContext.document.querySelector< HTMLElement >(
			'[data-ytr-focus-target="confirmation-continue"]'
		);
		return confirmationTarget;
	}

	// Apply開始後の要求は、対象Presentation内の反映中状態へ解決する。
	if ( target.type === 'applying-status' ) {
		const applyingTarget = referenceElement.querySelector< HTMLElement >(
			'[role="status"][aria-busy="true"]'
		);
		return applyingTarget;
	}

	const tableBlock = resolveTableBlock( editorContext.document, tableIdentity );
	// 結果確認またはTable fallbackは、対象Tableが現在表示に存在する場合だけ許可する。
	if ( tableBlock === null ) {
		return null;
	}
	// fallback要求では、結果位置を推測せず対象Table自体を安定した復帰先とする。
	if ( target.type === 'table' ) {
		return tableBlock;
	}

	return resolveResultCell( tableBlock, target.kind, target.destinationIndex );
};

/**
 * 現在成立している要素へフォーカスを適用する。
 *
 * 結果確認セルやTable Blockが通常のKeyboard操作対象でない場合も結果確認位置としてフォーカスできるようにするが、
 * そのための一時的な属性変更を要素の通常状態として残さない。
 *
 * @param target 現在の表示環境に存在するフォーカス先。
 * @return 指定した要素が現在のフォーカス位置になった場合はtrue。
 */
export const applyFocusTarget = ( target: HTMLElement ): boolean => {
	const previousTabIndex = target.getAttribute( 'tabindex' );
	// 通常のTab移動対象でない結果確認位置には、今回のfocus適用中だけ一時的なtabindexを付与する。
	const needsTemporaryTabIndex = target.tabIndex < 0;
	if ( needsTemporaryTabIndex ) {
		target.setAttribute( 'tabindex', '-1' );
	}

	target.focus( { preventScroll: true } );

	// Focus Coordinationが追加した一時属性は、focus要求の適用後に通常状態へ戻す。
	if ( needsTemporaryTabIndex ) {
		// 元のtabindexが存在しなかった要素には、追加した属性を残さない。
		if ( previousTabIndex === null ) {
			target.removeAttribute( 'tabindex' );
		} else {
			// 元からtabindexを持つ要素には、Focus Coordination適用前の値を復元する。
			target.setAttribute( 'tabindex', previousTabIndex );
		}
	}

	const focused = target.ownerDocument.activeElement === target;
	return focused;
};
