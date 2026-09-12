/**
 * 確認付き大規模反映後のRow / Column表示復帰を担当する。
 *
 * Lifecycleから渡された現在のEditor Documentだけを利用し、反映後の最終位置へscroll / focusを戻す。
 * Presentation anchorやEditor Contextの解決・保持、方向固有Move意味の計算は所有しない。
 */

/**
 * 行反映後の移動先行をEditor内で表示して、先頭の編集可能セルへfocusする。
 *
 * @param editorDocument 対象Tableが存在する現在のEditor Document。
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
	if ( ! row ) {
		return;
	}

	const editable = row.querySelector< HTMLElement >( '[contenteditable="true"]' );
	const firstCell = row.querySelector< HTMLElement >( 'th, td' );
	const displayTarget = editable ?? firstCell ?? ( row as HTMLElement );
	displayTarget.scrollIntoView( { block: 'center', inline: 'start' } );
	editable?.focus( { preventScroll: true } );
};

/**
 * 列反映後の移動先論理列を先頭側のTable行で解決し、該当セルへscroll / focusする。
 *
 * @param editorDocument 対象Tableが存在する現在のEditor Document。
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
	if ( ! firstRow ) {
		return;
	}

	let logicalColumnStart = 0;
	let targetCell: HTMLTableCellElement | null = null;
	/* 現在の先頭側行を論理列順に解釈し、結合セルを含めて反映後の移動列を覆う表示セルを特定する。 */
	for ( const cell of Array.from( firstRow.cells ) ) {
		const logicalColumnEnd = logicalColumnStart + cell.colSpan;
		if ( columnIndex >= logicalColumnStart && columnIndex < logicalColumnEnd ) {
			targetCell = cell;
			break;
		}
		logicalColumnStart = logicalColumnEnd;
	}
	if ( ! targetCell ) {
		return;
	}

	const editable = targetCell.querySelector< HTMLElement >( '[contenteditable="true"]' );
	const displayTarget = editable ?? targetCell;
	displayTarget.scrollIntoView( { block: 'center', inline: 'center' } );
	editable?.focus( { preventScroll: true } );
};
