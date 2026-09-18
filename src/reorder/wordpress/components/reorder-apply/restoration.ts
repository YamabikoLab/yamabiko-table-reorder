/**
 * 確認付き大規模反映後の行・列表示復帰を担当する。
 *
 * Lifecycleから渡された現在のEditor DOM Contextのdocumentだけを利用し、
 * 反映後の最終位置を表示して結果確認セルを強調可能な状態へ戻す。
 * focus適用、Editor DOM Contextの解決や保持、方向固有の移動先解釈は所有しない。
 */

import './restoration.scss';

/** 大規模反映後の結果確認セルだけを識別する一時表示class。 */
const RESTORED_CELL_CLASS = 'yamabiko-table-reorder-restored-cell';

/**
 * 結果確認セルを強調対象として記録し、利用者がセル外へ移った後は一時表示classを破棄する。
 *
 * focus自体はFocus Coordinationが既存Apply Lifecycleの描画待ち後に一回だけ適用する。
 *
 * @param cell 反映後の結果確認セル。
 */
const markRestoredCell = ( cell: HTMLElement ): void => {
	cell.classList.add( RESTORED_CELL_CLASS );
	const handleFocusOut = ( event: FocusEvent ): void => {
		const nextTarget = event.relatedTarget;
		const editorNode = cell.ownerDocument.defaultView?.Node;
		// 同じ結果確認セル内で操作を続ける間は、結果位置の強調を維持する。
		if (
			editorNode !== undefined &&
			nextTarget instanceof editorNode &&
			cell.contains( nextTarget )
		) {
			return;
		}
		cell.classList.remove( RESTORED_CELL_CLASS );
		cell.removeEventListener( 'focusout', handleFocusOut );
	};
	cell.addEventListener( 'focusout', handleFocusOut );
};

/**
 * 行反映後の最終行を利用者が確認できる位置へ表示し、その行の先頭セルを結果強調対象とする。
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
	// 再mount後に対象行を確認できない場合は、別の位置を推測して復帰しない。
	if ( ! row ) {
		return;
	}

	const editable = row.querySelector< HTMLElement >( '[contenteditable="true"]' );
	const firstCell = row.querySelector< HTMLElement >( 'th, td' );
	// 表示位置は通常の編集位置を優先し、成立しない場合だけセル、行の順で安全な表示対象へfallbackする。
	const displayTarget = editable ?? firstCell ?? ( row as HTMLElement );
	displayTarget.scrollIntoView( { block: 'center', inline: 'start' } );
	// 結果確認セルが成立する場合だけ強調し、行自体を代替focus targetとして扱わない。
	if ( firstCell !== null ) {
		markRestoredCell( firstCell );
	}
};

/**
 * 列反映後の最終論理列を利用者が確認できる位置へ表示し、対応セルを結果強調対象とする。
 *
 * 結合セルが最終論理列を占有する場合は、その結合セルを表示復帰先として扱う。
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
	// 再mount後に対象Tableを確認できない場合は、別の位置を推測して復帰しない。
	if ( ! firstRow ) {
		return;
	}

	let logicalColumnStart = 0;
	let targetCell: HTMLTableCellElement | null = null;
	/*
	 * 先頭側の行を論理列として解釈し、結合セルを含めて反映後の最終論理列を占有する表示セルを特定する。
	 */
	for ( const cell of Array.from( firstRow.cells ) ) {
		const logicalColumnEnd = logicalColumnStart + cell.colSpan;
		// 確定後の論理列を占有するセルだけを表示復帰先として採用する。
		if ( columnIndex >= logicalColumnStart && columnIndex < logicalColumnEnd ) {
			targetCell = cell;
			break;
		}
		logicalColumnStart = logicalColumnEnd;
	}
	// 対応する表示セルを確認できない場合は、隣接セルを代替先として使用しない。
	if ( ! targetCell ) {
		return;
	}

	const editable = targetCell.querySelector< HTMLElement >( '[contenteditable="true"]' );
	// 列の表示位置は通常の編集位置を優先し、成立しない場合だけ確定論理列を占有するセルへfallbackする。
	const displayTarget = editable ?? targetCell;
	displayTarget.scrollIntoView( { block: 'center', inline: 'center' } );
	markRestoredCell( targetCell );
};
