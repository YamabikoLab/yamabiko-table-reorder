/**
 * 確認付き大規模反映後の表示復帰が、現在のEditor DOM Contextと反映後最終位置に従うことを確認する。
 *
 * 表示位置と結果強調だけを担当し、focus適用はFocus Coordinationへ委ねることを検証する。
 */

import { restoreMovedColumn, restoreMovedRow } from './restoration';

const RESTORED_CELL_CLASS = 'yamabiko-table-reorder-restored-cell';

describe( 'WordPress Reorder Apply restoration', () => {
	/** 行反映後は最終行を表示して結果セルを強調対象にするが、focus自体は適用しない。 */
	it( 'when the moved row exists after remounting, should reveal and mark its first cell without focusing it', () => {
		const editorDocument = document.implementation.createHTMLDocument( 'editor' );
		editorDocument.body.innerHTML = `
			<div data-block="table-a">
				<table><tbody>
					<tr><td><span contenteditable="true">A</span></td></tr>
					<tr><td><span contenteditable="true">B</span></td></tr>
				</tbody></table>
			</div>
		`;
		const editable = editorDocument.querySelector< HTMLElement >(
			'tbody tr:nth-child(2) [contenteditable="true"]'
		);
		const cell = editable?.closest< HTMLElement >( 'td' ) ?? null;
		if ( editable === null || cell === null ) {
			throw new Error( 'Expected editable row cell.' );
		}
		const scrollIntoView = jest.fn();
		Object.defineProperty( editable, 'scrollIntoView', {
			configurable: true,
			value: scrollIntoView,
		} );
		const cellFocus = jest.spyOn( cell, 'focus' );

		restoreMovedRow( editorDocument, 'table-a', 1 );

		expect( scrollIntoView ).toHaveBeenCalledWith( { block: 'center', inline: 'start' } );
		expect( cellFocus ).not.toHaveBeenCalled();
		expect( cell.classList.contains( RESTORED_CELL_CLASS ) ).toBe( true );
		expect( cell.hasAttribute( 'tabindex' ) ).toBe( false );
	} );

	/** 結果確認セルから外へfocusが移った場合は、一時的な結果強調を終了する。 */
	it( 'when focus later leaves the restored cell, should remove its result highlight', () => {
		const editorDocument = document.implementation.createHTMLDocument( 'editor' );
		editorDocument.body.innerHTML = `
			<div data-block="table-a">
				<table><tbody><tr><td><span contenteditable="true">A</span></td></tr></tbody></table>
			</div>
			<button type="button">Outside</button>
		`;
		const editable = editorDocument.querySelector< HTMLElement >( '[contenteditable="true"]' );
		const cell = editable?.closest< HTMLElement >( 'td' ) ?? null;
		const outside = editorDocument.querySelector< HTMLButtonElement >( 'button' );
		if ( editable === null || cell === null || outside === null ) {
			throw new Error( 'Expected restored cell and outside target.' );
		}
		Object.defineProperty( editable, 'scrollIntoView', {
			configurable: true,
			value: jest.fn(),
		} );

		restoreMovedRow( editorDocument, 'table-a', 0 );
		cell.dispatchEvent( new FocusEvent( 'focusout', { bubbles: true, relatedTarget: outside } ) );

		expect( cell.classList.contains( RESTORED_CELL_CLASS ) ).toBe( false );
	} );

	/** iframe editor内で同じセル内部へfocusが移る場合は、結果強調を維持する。 */
	it( 'when focus moves within the restored cell in an editor iframe, should keep the restored cell highlighted', () => {
		const iframe = document.createElement( 'iframe' );
		document.body.append( iframe );
		const editorDocument = iframe.contentDocument;
		if ( editorDocument === null ) {
			iframe.remove();
			throw new Error( 'Expected editor iframe browsing context.' );
		}
		const editorWindow = editorDocument.defaultView;
		if ( editorWindow === null ) {
			iframe.remove();
			throw new Error( 'Expected editor iframe window.' );
		}
		editorDocument.body.innerHTML = `
			<div data-block="table-a">
				<table><tbody><tr><td>
					<span contenteditable="true">A</span>
					<button type="button">Inside</button>
				</td></tr></tbody></table>
			</div>
		`;
		const editable = editorDocument.querySelector< HTMLElement >( '[contenteditable="true"]' );
		const cell = editable?.closest< HTMLElement >( 'td' ) ?? null;
		const inside = cell?.querySelector< HTMLButtonElement >( 'button' ) ?? null;
		if ( editable === null || cell === null || inside === null ) {
			iframe.remove();
			throw new Error( 'Expected restored cell with another focus target.' );
		}
		Object.defineProperty( editable, 'scrollIntoView', {
			configurable: true,
			value: jest.fn(),
		} );

		restoreMovedRow( editorDocument, 'table-a', 0 );
		cell.dispatchEvent(
			new editorWindow.FocusEvent( 'focusout', { bubbles: true, relatedTarget: inside } )
		);

		expect( cell.classList.contains( RESTORED_CELL_CLASS ) ).toBe( true );
		iframe.remove();
	} );

	/** 列反映後の確定論理列が結合セル内なら、その結合セルを表示・強調対象にする。 */
	it( 'when the moved logical column is covered by a merged cell, should reveal and mark the merged cell', () => {
		const editorDocument = document.implementation.createHTMLDocument( 'editor' );
		editorDocument.body.innerHTML = `
			<div data-block="table-a">
				<table><tbody><tr>
					<td colspan="2"><span contenteditable="true">Merged</span></td>
					<td><span contenteditable="true">C</span></td>
				</tr></tbody></table>
			</div>
		`;
		const editable = editorDocument.querySelector< HTMLElement >(
			'td[colspan="2"] [contenteditable="true"]'
		);
		const cell = editable?.closest< HTMLElement >( 'td' ) ?? null;
		if ( editable === null || cell === null ) {
			throw new Error( 'Expected editable merged-cell position.' );
		}
		const scrollIntoView = jest.fn();
		Object.defineProperty( editable, 'scrollIntoView', {
			configurable: true,
			value: scrollIntoView,
		} );
		const cellFocus = jest.spyOn( cell, 'focus' );

		restoreMovedColumn( editorDocument, 'table-a', 1 );

		expect( scrollIntoView ).toHaveBeenCalledWith( { block: 'center', inline: 'center' } );
		expect( cellFocus ).not.toHaveBeenCalled();
		expect( cell.classList.contains( RESTORED_CELL_CLASS ) ).toBe( true );
	} );
} );
