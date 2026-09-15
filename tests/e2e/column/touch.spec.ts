import type { Locator } from '@playwright/test';
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { applyStackedTableLayout } from '../stacked-table';

import {
	COLUMN_BUTTON,
	COLUMN_LAYOUT_UNAVAILABLE,
	columnOrder,
	insertTable,
	pointIn,
	setPreferences,
	tableAttributes,
	tableData,
	touchInput,
} from './column-reorder';

test.use( { hasTouch: true, isMobile: true, viewport: { width: 1024, height: 768 } } );

test.beforeEach( async ( { admin, page } ) => {
	await admin.createNewPost();
	await setPreferences( page );
} );

const EDITABLE_FOCUS_HISTORY_ATTRIBUTE = 'data-ytr-test-editable-focus-history';

/** 横方向へ通常スクロールできるCore Table属性を生成する。 */
function wideTableAttributes() {
	const attributes = tableAttributes( 4, 12 );
	attributes.hasFixedLayout = false;
	for ( const row of attributes.body ) {
		for ( const cell of row.cells ) {
			cell.content = `${ cell.content }-${ 'Wide'.repeat( 12 ) }`;
		}
	}
	return attributes;
}

/**
 * 対象Tableで編集可能要素へfocusが移った履歴を記録する。
 *
 * DnD開始によって編集可能要素がDOMから外れた後でも、長押し開始からDnD開始までに通常編集へ遷移したかを確認できるようにする。
 *
 * @param block 対象TableのBlock wrapper。
 */
async function observeEditableFocusHistory( block: Locator ) {
	await block.evaluate( ( element, attributeName ) => {
		element.setAttribute( attributeName, 'false' );
		element.addEventListener( 'focusin', ( event ) => {
			const target = event.target;
			if ( target instanceof Element && target.closest( '[contenteditable="true"]' ) ) {
				element.setAttribute( attributeName, 'true' );
			}
		} );
	}, EDITABLE_FOCUS_HISTORY_ATTRIBUTE );
}

/**
 * Stacked / Reflow表示で利用不可のColumn DnD入口をtouchして理由を確認できることを確認する。
 *
 * 事前条件:
 * - タッチ入力を利用でき、Core Tableの各セルが縦積みで表示されている。
 *
 * 操作:
 * - 利用不可のColumn DnD入口をtouchする。
 *
 * 期待結果:
 * - Column Reorder Modeは開始されない。
 * - 現在表示で利用できないことと列RFを代替利用できることが表示される。
 */
test( 'when the unavailable column entry is touched for a stacked Table, should show the form alternative without starting column mode', async ( {
	page,
	editor,
} ) => {
	const { table } = await insertTable( page, editor );
	await applyStackedTableLayout( table );
	const columnEntry = page.getByRole( 'button', { name: COLUMN_BUTTON } );
	await expect( columnEntry ).toHaveAttribute( 'aria-disabled', 'true' );
	const touch = await touchInput( page );
	try {
		await touch.start( await pointIn( columnEntry ) );
		await touch.end();

		await expect( columnEntry ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( page.getByRole( 'tooltip' ) ).toHaveText( COLUMN_LAYOUT_UNAVAILABLE );
	} finally {
		await touch.dispose();
	}
} );

/**
 * セル内容の長押しで列のDnDを開始し、表示された移動先へ確定できることを確認する。
 *
 * 事前条件:
 * - タッチ入力を利用できる環境でTableが表示されている。
 * - 列の並び替えモードを利用できる。
 *
 * 操作:
 * - 列の並び替えモードを有効にする。
 * - 先頭列の編集可能なセル内容を長押ししてDnDを開始し、末尾の移動先へ移動する。
 * - 指を離して移動を確定する。
 *
 * 期待結果:
 * - セル内容の通常編集へ遷移せず、長押し後に移動中の列と移動先が表示される。
 * - 先頭列が末尾へ移動する。
 * - 確定後はDnD中だけの表示が終了する。
 */
test( 'when editable cell content is long-pressed and dragged by touch, should start column DnD without entering edit mode and move the column', async ( {
	page,
	editor,
} ) => {
	const { canvas, block, rows } = await insertTable( page, editor );
	const cells = rows.first().locator( ':scope > td' );
	const editable = cells.first().locator( '[contenteditable="true"]' ).first();
	await expect( editable ).toBeVisible();
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).tap();
	await observeEditableFocusHistory( block );
	const touch = await touchInput( page );
	try {
		await touch.start( await pointIn( editable ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeVisible();
		await expect( block ).toHaveAttribute( EDITABLE_FOCUS_HISTORY_ATTRIBUTE, 'false' );
		await touch.move( await pointIn( cells.last(), 0.8 ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeVisible();
		await touch.end();
		await expect
			.poll( () => columnOrder( rows.first() ) )
			.toEqual( [ 'R1C2', 'R1C3', 'R1C4', 'R1C1' ] );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
		await expect( canvas.locator( '.yamabiko-table-reorder-column-insertion-line' ) ).toBeHidden();
	} finally {
		await touch.dispose();
	}
} );

/**
 * 見出しセル内容の長押しでも通常編集と競合せず列DnDを開始できることを確認する。
 *
 * 事前条件:
 * - タッチ入力を利用できる環境で、見出しを持つCore Tableが表示されている。
 * - 列の並び替えモードを利用できる。
 *
 * 操作:
 * - 列の並び替えモードを有効にする。
 * - 見出しセルの編集可能な内容を長押しする。
 *
 * 期待結果:
 * - 見出しセルの通常編集へ遷移しない。
 * - 見出しセルを移動元として列DnDが開始される。
 */
test( 'when editable header content is long-pressed by touch, should start column DnD without entering edit mode', async ( {
	page,
	editor,
} ) => {
	const attributes = {
		...tableAttributes(),
		head: [
			{
				cells: [ 'H1', 'H2', 'H3', 'H4' ].map( ( content ) => ( {
					tag: 'th',
					content,
				} ) ),
			},
		],
	};
	const { canvas, block } = await insertTable( page, editor, 'core/table', attributes );
	const headerCell = block.locator( 'thead > tr > th' ).first();
	const editable = headerCell.locator( '[contenteditable="true"]' ).first();
	await expect( editable ).toBeVisible();
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).tap();
	await observeEditableFocusHistory( block );
	const touch = await touchInput( page );
	try {
		await touch.start( await pointIn( editable ) );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeVisible();
		await expect( block ).toHaveAttribute( EDITABLE_FOCUS_HISTORY_ATTRIBUTE, 'false' );
		await touch.end();
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
	} finally {
		await touch.dispose();
	}
} );

/**
 * 列の並び替えモード中でもDnD開始前の通常タッチスクロールを利用できることを確認する。
 *
 * 事前条件:
 * - タッチ入力を利用できる環境で、横方向に画面内へ収まらないTableが表示されている。
 * - 列の並び替えモードが有効である。
 *
 * 操作:
 * - DnDを開始せずTable上を通常のタッチ操作で横スクロールする。
 *
 * 期待結果:
 * - Tableを横方向へスクロールできる。
 * - 列のDnDは開始されない。
 * - Tableの編集データは変更されない。
 * - 列の並び替えモードは維持される。
 */
test( 'when the user scrolls horizontally by touch before drag starts, should scroll normally without changing the Table or leaving column mode', async ( {
	page,
	editor,
} ) => {
	const { canvas, block } = await insertTable( page, editor, 'core/table', wideTableAttributes() );
	const tableFigure = block
		.and( canvas.locator( 'figure.wp-block-table' ) )
		.or( block.locator( 'figure.wp-block-table' ) );
	await expect
		.poll( () => tableFigure.evaluate( ( element ) => element.scrollWidth - element.clientWidth ) )
		.toBeGreaterThan( 100 );
	await page.getByRole( 'button', { name: COLUMN_BUTTON } ).tap();
	const before = await tableData( editor );
	const figureBox = ( await tableFigure.boundingBox() )!;
	const touch = await touchInput( page );
	try {
		await touch.scrollHorizontally( {
			x: figureBox.x + figureBox.width - 40,
			y: figureBox.y + figureBox.height / 2,
		} );
		await expect
			.poll( () => tableFigure.evaluate( ( element ) => element.scrollLeft ) )
			.toBeGreaterThan( 100 );
		await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
		expect( await tableData( editor ) ).toEqual( before );
		await expect( page.getByRole( 'button', { name: COLUMN_BUTTON } ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	} finally {
		await touch.dispose();
	}
} );
