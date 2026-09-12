/**
 * 確認付き大規模反映後の表示復帰が、現在のEditor DOM Contextと反映後最終位置に従うことを確認する。
 */

import { restoreMovedColumn, restoreMovedRow } from './restoration';

const RESTORED_CELL_CLASS = 'yamabiko-table-reorder-restored-cell';

describe( 'WordPress Reorder Apply restoration', () => {
	/**
	 * 概要:
	 * - 行反映後に最終行を表示し、編集可能な先頭位置へフォーカスを戻して復帰先セルを強調することを確認する。
	 *
	 * 事前条件:
	 * - 再mount後のTableに反映後最終行が存在する。
	 * - その行には編集可能なセル内容がある。
	 *
	 * 操作:
	 * - 反映後最終行への表示復帰を要求する。
	 * - その後、フォーカスを復帰先セルの外へ移す。
	 *
	 * 期待結果:
	 * - 最終行の編集位置が利用者から確認できる位置へ表示される。
	 * - 同じ編集位置へスクロールを発生させずにフォーカスが戻る。
	 * - フォーカス中は復帰先セルが強調され、セル外へ移ると強調が終了する。
	 */
	it( 'when the moved row exists after remounting, should reveal, focus, and highlight its first editable cell until focus leaves', () => {
		const editorDocument = document.implementation.createHTMLDocument( 'editor' );
		editorDocument.body.innerHTML = `
			<div data-block="table-a">
				<table><tbody>
					<tr><td><span contenteditable="true">A</span></td></tr>
					<tr><td><span contenteditable="true">B</span></td></tr>
				</tbody></table>
			</div>
			<button type="button">Outside</button>
		`;
		const editable = editorDocument.querySelector< HTMLElement >(
			'tbody tr:nth-child(2) [contenteditable="true"]'
		);
		const cell = editable?.closest< HTMLElement >( 'td' ) ?? null;
		const outside = editorDocument.querySelector< HTMLButtonElement >( 'button' );
		if ( editable === null || cell === null || outside === null ) {
			throw new Error( 'Expected editable row cell and outside focus target.' );
		}
		const scrollIntoView = jest.fn();
		Object.defineProperty( editable, 'scrollIntoView', {
			configurable: true,
			value: scrollIntoView,
		} );
		const focus = jest.spyOn( editable, 'focus' );

		restoreMovedRow( editorDocument, 'table-a', 1 );

		expect( scrollIntoView ).toHaveBeenCalledWith( { block: 'center', inline: 'start' } );
		expect( focus ).toHaveBeenCalledWith( { preventScroll: true } );
		expect( cell.classList.contains( RESTORED_CELL_CLASS ) ).toBe( true );

		editable.dispatchEvent(
			new FocusEvent( 'focusout', { bubbles: true, relatedTarget: outside } )
		);
		expect( cell.classList.contains( RESTORED_CELL_CLASS ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - iframe editor内の復帰先セルでフォーカス位置が変わっても、同じセルを反映結果として強調し続けることを確認する。
	 *
	 * 事前条件:
	 * - iframe editor内の反映後最終行に複数のフォーカス可能位置がある。
	 * - 復帰先と移動先はglobalとは異なるDOM環境に属している。
	 *
	 * 操作:
	 * - 最終行へ表示復帰した後、同じセル内の別の位置へフォーカスを移す。
	 *
	 * 期待結果:
	 * - iframe / non-iframeのDOM環境差に影響されず、復帰先セルの強調は維持される。
	 */
	it( 'when focus moves within the restored cell in an editor iframe, should keep the restored cell highlighted', () => {
		const iframe = document.createElement( 'iframe' );
		document.body.append( iframe );
		const editorDocument = iframe.contentDocument;
		const editorWindow = iframe.contentWindow;
		if ( editorDocument === null || editorWindow === null ) {
			iframe.remove();
			throw new Error( 'Expected editor iframe browsing context.' );
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

		expect( inside ).toBeInstanceOf( editorWindow.Node );
		expect( inside ).not.toBeInstanceOf( Node );

		restoreMovedRow( editorDocument, 'table-a', 0 );
		editable.dispatchEvent(
			new editorWindow.FocusEvent( 'focusout', { bubbles: true, relatedTarget: inside } )
		);

		expect( cell.classList.contains( RESTORED_CELL_CLASS ) ).toBe( true );
		iframe.remove();
	} );

	/**
	 * 概要:
	 * - 列反映後の最終論理列が結合セル内にある場合、その結合セルを表示復帰先として扱って強調することを確認する。
	 *
	 * 事前条件:
	 * - 再mount後のTable先頭行で、1つのセルが複数の論理列を占有している。
	 * - 反映後最終論理列はその結合セルの占有範囲内にある。
	 *
	 * 操作:
	 * - 反映後最終論理列への表示復帰を要求する。
	 *
	 * 期待結果:
	 * - 最終論理列を占有する結合セルの編集位置が表示される。
	 * - 同じ編集位置へスクロールを発生させずにフォーカスが戻る。
	 * - フォーカスを戻した結合セルが反映結果として強調される。
	 */
	it( 'when the moved logical column is covered by a merged cell, should restore and highlight the merged cell that owns it', () => {
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
		const focus = jest.spyOn( editable, 'focus' );

		restoreMovedColumn( editorDocument, 'table-a', 1 );

		expect( scrollIntoView ).toHaveBeenCalledWith( { block: 'center', inline: 'center' } );
		expect( focus ).toHaveBeenCalledWith( { preventScroll: true } );
		expect( cell.classList.contains( RESTORED_CELL_CLASS ) ).toBe( true );
	} );
} );
