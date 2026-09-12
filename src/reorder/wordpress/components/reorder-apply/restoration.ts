/**
 * 確認付き大規模反映後の行・列表示復帰を担当する。
 *
 * Lifecycleから渡された現在のEditor DOM Contextのdocumentだけを利用し、反映後の最終位置へ表示位置とフォーカスを戻す。
 * フォーカスを戻したセルはフォーカス中だけ強調し、Editor DOM Contextの解決や保持、方向固有の移動先解釈は所有しない。
 */

import './restoration.scss';

/** 大規模反映後にフォーカスを戻したセルだけを識別する一時表示class。 */
const RESTORED_CELL_CLASS = 'yamabiko-table-reorder-restored-cell';

/**
 * 大規模反映後の復帰先セルをフォーカス中だけ強調する。
 *
 * セル内部でフォーカスが移動する間は強調を維持し、セル外へ移った時点で一時表示classと監視を破棄する。
 *
 * @param cell     反映後のフォーカス復帰先セル。
 * @param editable 実際にフォーカスを戻す編集位置。
 */
const focusRestoredCell = ( cell: HTMLElement, editable: HTMLElement ): void => {
	cell.classList.add( RESTORED_CELL_CLASS );
	const handleFocusOut = ( event: FocusEvent ): void => {
		const nextTarget = event.relatedTarget;
		if ( nextTarget instanceof Node && cell.contains( nextTarget ) ) {
			return;
		}
		cell.classList.remove( RESTORED_CELL_CLASS );
		cell.removeEventListener( 'focusout', handleFocusOut );
	};
	cell.addEventListener( 'focusout', handleFocusOut );
	editable.focus( { preventScroll: true } );
};

/**
 * 行反映後の最終行を利用者が確認できる位置へ表示し、編集可能な場合はその行の先頭編集位置へフォーカスを戻す。
 *
 * フォーカスを戻したセルは、利用者が別のセルやUIへ移るまで反映結果として強調する。
 *
 * @param editorDocument 対象Tableが存在する現在のEditor DOM Contextのdocument。
 * @param clientId       対象Table個体のclientId。
 * @param rowIndex       反映後のtbody内0-based最終行位置。
 */
export const restoreMovedRow = (
	editorDocument: Document,
	clientId: string,
	rowIndex: number
): void => {
	const table = editorDocument.querySelector( `[data-block="${ clientId }"] table` );
	const row = table?.querySelector( 'tbody' )?.querySelectorAll( 'tr' ).item( rowIndex ) ?? null;
	/* 再mount後に対象行を確認できない場合は、別の位置を推測して復帰しない。 */
	if ( ! row ) {
		return;
	}

	const editable = row.querySelector< HTMLElement >( '[contenteditable="true"]' );
	const firstCell = row.querySelector< HTMLElement >( 'th, td' );
	const displayTarget = editable ?? firstCell ?? ( row as HTMLElement );
	displayTarget.scrollIntoView( { block: 'center', inline: 'start' } );
	const focusCell = editable?.closest< HTMLElement >( 'th, td' ) ?? null;
	if ( editable !== null && focusCell !== null ) {
		focusRestoredCell( focusCell, editable );
	}
};

/**
 * 列反映後の最終論理列を利用者が確認できる位置へ表示し、編集可能な場合は対応セルへフォーカスを戻す。
 *
 * 結合セルが最終論理列を占有する場合は、その結合セルを表示復帰先として扱う。フォーカスを戻したセルは、
 * 利用者が別のセルやUIへ移るまで反映結果として強調する。
 *
 * @param editorDocument 対象Tableが存在する現在のEditor DOM Contextのdocument。
 * @param clientId       対象Table個体のclientId。
 * @param columnIndex    反映後の0-based最終論理列位置。
 */
export const restoreMovedColumn = (
	editorDocument: Document,
	clientId: string,
	columnIndex: number
): void => {
	const firstRow = editorDocument.querySelector< HTMLTableRowElement >(
		`[data-block="${ clientId }"] table tr`
	);
	/* 再mount後に対象Tableを確認できない場合は、別の位置を推測して復帰しない。 */
	if ( ! firstRow ) {
		return;
	}

	let logicalColumnStart = 0;
	let targetCell: HTMLTableCellElement | null = null;
	/* 先頭側の行を論理列として解釈し、結合セルを含めて反映後の最終論理列を占有する表示セルを特定する。 */
	for ( const cell of Array.from( firstRow.cells ) ) {
		const logicalColumnEnd = logicalColumnStart + cell.colSpan;
		if ( columnIndex >= logicalColumnStart && columnIndex < logicalColumnEnd ) {
			targetCell = cell;
			break;
		}
		logicalColumnStart = logicalColumnEnd;
	}
	/* 対応する表示セルを確認できない場合は、隣接セルを代替先として使用しない。 */
	if ( ! targetCell ) {
		return;
	}

	const editable = targetCell.querySelector< HTMLElement >( '[contenteditable="true"]' );
	const displayTarget = editable ?? targetCell;
	displayTarget.scrollIntoView( { block: 'center', inline: 'center' } );
	if ( editable !== null ) {
		focusRestoredCell( targetCell, editable );
	}
};
