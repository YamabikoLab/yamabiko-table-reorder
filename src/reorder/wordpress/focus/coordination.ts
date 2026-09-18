/**
 * Focus Coordinationの共通DOM適用を所有する。
 *
 * 公開ユースケースから受けた意味上のfocus targetを、要求時点の現在Editor DOM Contextだけで解決する。
 * pending状態へDOM node、Document、Windowを保持せず、Table構造や確定後位置を別正本として所有しない。
 */

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

/** Focus Coordination内部だけで利用する意味上のfocus target。 */
export type FocusSemanticTarget =
	| {
			type: 'rf-control';
			control:
				| 'direction'
				| 'source'
				| 'destination'
				| 'relation'
				| 'submit'
				| 'cancel'
				| 'disclosure';
	  }
	| { type: 'rf-toolbar' }
	| { type: 'confirmation-continue' }
	| { type: 'applying-status' }
	| { type: 'result-cell'; kind: 'row' | 'column'; destinationIndex: number }
	| { type: 'table' };

/**
 * 対象Tableの現在Block要素を取得する。
 *
 * @param editorDocument 現在Editor DOM Contextのdocument。
 * @param tableIdentity  対象Table Identity。
 * @return 現在DOMに存在する対象Table Block。存在しなければnull。
 */
const resolveTableBlock = (
	editorDocument: Document,
	tableIdentity: string
): HTMLElement | null => {
	for ( const element of Array.from(
		editorDocument.querySelectorAll< HTMLElement >( '[data-block]' )
	) ) {
		if ( element.getAttribute( 'data-block' ) === tableIdentity ) {
			return element;
		}
	}
	return null;
};

/**
 * RF内の意味上の操作を現在PresentationのDOMへ解決する。
 *
 * @param editorDocument 現在Editor DOM Contextのdocument。
 * @param tableIdentity  対象Table Identity。
 * @param control        RF内の意味上の操作。
 * @return 現在DOMに存在する操作要素。存在しなければnull。
 */
const resolveReorderControl = (
	editorDocument: Document,
	tableIdentity: string,
	control: Extract< FocusSemanticTarget, { type: 'rf-control' } >[ 'control' ]
): HTMLElement | null => {
	const prefix = `yamabiko-table-reorder-rf-${ tableIdentity }`;
	if ( control === 'direction' ) {
		return (
			editorDocument.getElementById( `${ prefix }-kind-row` ) ??
			editorDocument.getElementById( `${ prefix }-kind-column` )
		);
	}
	if ( control === 'source' ) {
		return (
			editorDocument.getElementById( `${ prefix }-source-row` ) ??
			editorDocument.getElementById( `${ prefix }-source-column` )
		);
	}
	if ( control === 'destination' ) {
		return (
			editorDocument.getElementById( `${ prefix }-target-row` ) ??
			editorDocument.getElementById( `${ prefix }-target-column` )
		);
	}
	if ( control === 'relation' ) {
		return (
			editorDocument.getElementById( `${ prefix }-row-above` ) ??
			editorDocument.getElementById( `${ prefix }-row-below` ) ??
			editorDocument.getElementById( `${ prefix }-column-left` ) ??
			editorDocument.getElementById( `${ prefix }-column-right` )
		);
	}

	for ( const element of Array.from(
		editorDocument.querySelectorAll< HTMLElement >( '[data-ytr-focus-control]' )
	) ) {
		if (
			element.getAttribute( 'data-ytr-table-identity' ) === tableIdentity &&
			element.getAttribute( 'data-ytr-focus-control' ) === control
		) {
			return element;
		}
	}
	return null;
};

/**
 * Apply成功後の確定位置に対応する結果確認セルを現在Tableから解決する。
 *
 * @param tableBlock       対象Tableの現在Block要素。
 * @param kind             RowまたはColumn。
 * @param destinationIndex 既存Apply責務が確定した0-based最終位置。
 * @return 結果確認に利用するセル。成立しなければnull。
 */
const resolveResultCell = (
	tableBlock: HTMLElement,
	kind: 'row' | 'column',
	destinationIndex: number
): HTMLTableCellElement | null => {
	const table = tableBlock.querySelector< HTMLTableElement >( 'table' );
	if ( table === null || destinationIndex < 0 ) {
		return null;
	}

	if ( kind === 'row' ) {
		const row = table.tBodies.item( 0 )?.rows.item( destinationIndex ) ?? null;
		return row?.cells.item( 0 ) ?? null;
	}

	const firstRow = table.rows.item( 0 );
	if ( firstRow === null ) {
		return null;
	}

	let logicalColumnStart = 0;
	for ( const cell of Array.from( firstRow.cells ) ) {
		const logicalColumnEnd = logicalColumnStart + cell.colSpan;
		if ( destinationIndex >= logicalColumnStart && destinationIndex < logicalColumnEnd ) {
			return cell;
		}
		logicalColumnStart = logicalColumnEnd;
	}
	return null;
};

/**
 * 現在Editor DOM Contextから意味上のfocus targetを解決する。
 *
 * @param target           解決する意味上のfocus target。
 * @param tableIdentity    対象Table Identity。
 * @param referenceElement 現在Editor DOM Contextを特定する基準要素。
 * @return 現在DOMに存在するfocus対象。成立しなければnull。
 */
export const resolveFocusTarget = (
	target: FocusSemanticTarget,
	tableIdentity: string,
	referenceElement: Element
): HTMLElement | null => {
	const editorContext = resolveEditorDomContext( referenceElement );
	if ( editorContext === null ) {
		return null;
	}

	if ( target.type === 'rf-control' ) {
		return resolveReorderControl( editorContext.document, tableIdentity, target.control );
	}

	if ( target.type === 'rf-toolbar' ) {
		for ( const element of Array.from(
			editorContext.document.querySelectorAll< HTMLElement >(
				'[data-ytr-focus-target="rf-toolbar"]'
			)
		) ) {
			if ( element.getAttribute( 'data-ytr-table-identity' ) === tableIdentity ) {
				return element;
			}
		}
		return null;
	}

	if ( target.type === 'confirmation-continue' ) {
		return editorContext.document.querySelector< HTMLElement >(
			'[data-ytr-focus-target="confirmation-continue"]'
		);
	}

	if ( target.type === 'applying-status' ) {
		return referenceElement.querySelector< HTMLElement >( '[role="status"][aria-busy="true"]' );
	}

	const tableBlock = resolveTableBlock( editorContext.document, tableIdentity );
	if ( tableBlock === null ) {
		return null;
	}
	if ( target.type === 'table' ) {
		return tableBlock;
	}
	return resolveResultCell( tableBlock, target.kind, target.destinationIndex );
};

/**
 * 現在存在するtargetへfocusを適用する。
 *
 * nativeにfocusできない結果確認セルやTable Blockでは一時的なtabindexだけを利用し、
 * Focus Coordinationの状態としてDOM参照やPresentation状態を保持しない。
 *
 * @param target 現在DOMに存在するfocus対象。
 * @return focusが対象へ適用された場合はtrue。
 */
export const applyFocusTarget = ( target: HTMLElement ): boolean => {
	const previousTabIndex = target.getAttribute( 'tabindex' );
	const needsTemporaryTabIndex = target.tabIndex < 0;
	if ( needsTemporaryTabIndex ) {
		target.setAttribute( 'tabindex', '-1' );
	}
	target.focus( { preventScroll: true } );
	if ( needsTemporaryTabIndex ) {
		if ( previousTabIndex === null ) {
			target.removeAttribute( 'tabindex' );
		} else {
			target.setAttribute( 'tabindex', previousTabIndex );
		}
	}
	return target.ownerDocument.activeElement === target;
};
