/**
 * 確認付き大規模反映後の表示復帰が、現在のEditor DOM Contextと反映後最終位置に従うことを確認する。
 */

import { restoreMovedColumn, restoreMovedRow } from './restoration';

describe( 'WordPress Reorder Apply restoration', () => {
	/**
	 * 概要:
	 * - 行反映後に最終行を表示し、編集可能な先頭位置へフォーカスを戻すことを確認する。
	 *
	 * 事前条件:
	 * - 再mount後のTableに反映後最終行が存在する。
	 * - その行には編集可能なセル内容がある。
	 *
	 * 操作:
	 * - 反映後最終行への表示復帰を要求する。
	 *
	 * 期待結果:
	 * - 最終行の編集位置が利用者から確認できる位置へ表示される。
	 * - 同じ編集位置へスクロールを発生させずにフォーカスが戻る。
	 */
	it( 'when the moved row exists after remounting, should reveal and focus its first editable position', () => {
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
		if ( editable === null ) {
			throw new Error( 'Expected editable row position.' );
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
	} );

	/**
	 * 概要:
	 * - 列反映後の最終論理列が結合セル内にある場合、その結合セルを表示復帰先として扱うことを確認する。
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
	 */
	it( 'when the moved logical column is covered by a merged cell, should restore the merged cell that owns it', () => {
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
		if ( editable === null ) {
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
	} );
} );
