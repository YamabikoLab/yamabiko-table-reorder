import type { Locator, Page } from '@playwright/test';
import type { Editor } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext } from '../editor-context';

export const RF_BUTTON = /^(Reorder with form|フォームで並び替え)$/;
export const ROW_BUTTON = /^(Reorder rows|行を並び替え|行を並べ替え)$/;
export const COLUMN_BUTTON = /^(Reorder columns|列を並び替え|列を並べ替え)$/;
export const ROWS = /^(Rows|行)$/;
export const COLUMNS = /^(Columns|列)$/;
export const SOURCE_ROW = /^(Row to move|移動する行)$/;
export const TARGET_ROW = /^(Target row|移動先の行)$/;
export const SOURCE_COLUMN = /^(Column to move|移動する列)$/;
export const TARGET_COLUMN = /^(Target column|移動先の列)$/;
export const ABOVE = /^(Above|上)$/;
export const BELOW = /^(Below|下)$/;
const LEFT = /^(Left|左)$/;
export const RIGHT = /^(Right|右)$/;
export const APPLY = /^(Reorder|並び替え)$/;
export const CANCEL = /^(Cancel|キャンセル)$/;
export const NO_OP =
	/^(This selection won't change the order\.|この指定では並び順は変わりません。)$/;
export const COMPLETION = /^(Reordering complete\.|並び替えが完了しました。)$/;
export const LARGE_CONFIRMATION = /^(Apply the new order\?|並び替えを反映しますか？)$/;
export const CONTINUE = /^(Continue|続行)$/;
export const COLLAPSE = /^(Collapse reorder form|並び替えフォームを折りたたむ)$/;
export const EXPAND = /^(Expand reorder form|並び替えフォームを展開する)$/;
export const ROW_SUCCESS =
	/^(Moved row \d+ to position \d+\.|\d+行目を\d+行目の位置へ移動しました。)$/;
export const COLUMN_SUCCESS =
	/^(Moved column \d+ to position \d+\.|\d+列目を\d+列目の位置へ移動しました。)$/;

export type TableName = 'core/table' | 'flexible-table-block/table';

/**
 * 各テストの初回案内とEditor表示設定を明示する。
 *
 * @param page 管理画面。
 */
export async function setPreferences( page: Page ) {
	await page.evaluate( () => {
		const preferences = window.wp.data.dispatch( 'core/preferences' );
		preferences.set( 'yamabiko-table-reorder', 'initialGuidanceAcknowledgedPc', true );
		preferences.set( 'yamabiko-table-reorder', 'initialGuidanceAcknowledgedTouch', true );
		preferences.set( 'core/edit-post', 'fixedToolbar', true );
	} );
}

/**
 * 行列位置をセル内容へ置き、RF結果を確認できる再現可能なTableを作る。
 *
 * @param rowCount    行数。
 * @param columnCount 列数。
 * @return RFのSupported Table Blockへ渡す編集属性。
 */
export function tableAttributes( rowCount = 4, columnCount = 4 ) {
	return {
		hasFixedLayout: true,
		body: Array.from( { length: rowCount }, ( _, row ) => ( {
			cells: Array.from( { length: columnCount }, ( __, column ) => ( {
				tag: 'td',
				content: `R${ row + 1 }C${ column + 1 }`,
			} ) ),
		} ) ),
	};
}

/**
 * WordPressの公開操作でTableを挿入し、現在の編集領域にある対象Tableを返す。
 *
 * @param page       管理画面。
 * @param editor     WordPressの編集操作。
 * @param name       対応Table Block名。
 * @param attributes テストで必要な編集データ。
 * @return 挿入したTableの編集領域、Block、Table、本文行。
 */
export async function insertTable(
	page: Page,
	editor: Editor,
	name: TableName = 'core/table',
	attributes: Record< string, unknown > = tableAttributes()
) {
	await editor.insertBlock( { name, attributes } );
	const canvas = await getEditorContext( page, editor.canvas );
	const identity = await canvas
		.locator( `[data-type="${ name }"][data-block]` )
		.last()
		.getAttribute( 'data-block' );
	if ( identity === null ) {
		throw new Error( 'The inserted Table identity is unavailable.' );
	}
	const block = canvas.locator( `[data-block="${ identity }"]` );
	await editor.selectBlocks( block );
	return {
		canvas,
		identity,
		block,
		table: block.locator( 'table' ).first(),
		rows: block.locator( 'tbody > tr' ),
	};
}

/**
 * RF入力画面を利用者向けタイトルから取得する。
 *
 * @param page 管理画面。
 * @return 現在表示されているRF入力画面。
 */
export function reorderForm( page: Page ): Locator {
	return page.locator( '.yamabiko-table-reorder-rf' ).filter( {
		has: page.getByRole( 'heading', { name: RF_BUTTON } ),
	} );
}

/**
 * ToolbarからRFを開始し、現在のRF入力画面を返す。
 *
 * @param page 管理画面。
 * @return 開始したRF入力画面。
 */
export async function openReorderForm( page: Page ): Promise< Locator > {
	await page.getByRole( 'button', { name: RF_BUTTON } ).click();
	return reorderForm( page );
}

/**
 * RFへ行の移動元、移動先、上下関係を入力する。
 *
 * @param form      RF入力画面。
 * @param sourceRow 移動する行の1-based位置。
 * @param targetRow 移動先行の1-based位置。
 * @param position  移動先行との位置関係。
 */
export async function fillRowReorder(
	form: Locator,
	sourceRow: number,
	targetRow: number,
	position: 'above' | 'below'
) {
	await form.getByRole( 'spinbutton', { name: SOURCE_ROW } ).fill( String( sourceRow ) );
	await form.getByRole( 'spinbutton', { name: TARGET_ROW } ).fill( String( targetRow ) );
	await form.getByRole( 'radio', { name: position === 'above' ? ABOVE : BELOW } ).click();
}

/**
 * RFへ列の移動元、移動先、左右関係を入力する。
 *
 * @param form         RF入力画面。
 * @param sourceColumn 移動する列の1-based位置。
 * @param targetColumn 移動先列の1-based位置。
 * @param position     移動先列との位置関係。
 */
export async function fillColumnReorder(
	form: Locator,
	sourceColumn: number,
	targetColumn: number,
	position: 'left' | 'right'
) {
	await form
		.getByRole( 'combobox', { name: SOURCE_COLUMN } )
		.selectOption( { index: sourceColumn } );
	await form
		.getByRole( 'combobox', { name: TARGET_COLUMN } )
		.selectOption( { index: targetColumn } );
	await form.getByRole( 'radio', { name: position === 'left' ? LEFT : RIGHT } ).click();
}

/**
 * 保存対象のBlock属性を比較し、RF表示用DOMをデータ結果として扱わない。
 *
 * @param editor WordPressの編集操作。
 * @return 現在EditorにあるTable Blockの属性。
 */
export async function tableData( editor: Editor ) {
	const blocks = await editor.getBlocks();
	return blocks
		.filter( ( block ) => block.name.endsWith( '/table' ) )
		.map( ( block ) => block.attributes );
}

/**
 * Table本文の現在行順を先頭セルの表示内容として取得する。
 *
 * @param rows Table本文行。
 * @return 利用者が確認できる現在行順。
 */
export async function rowOrder( rows: Locator ) {
	return rows.evaluateAll( ( elements ) =>
		elements.map( ( row ) => {
			const cell = row.firstElementChild;
			return ( cell?.querySelector( '[contenteditable]' ) ?? cell )?.textContent?.trim() ?? '';
		} )
	);
}

/**
 * 指定行の現在列順をセルの表示内容として取得する。
 *
 * @param row Table行。
 * @return 利用者が確認できる現在列順。
 */
export async function columnOrder( row: Locator ) {
	return row
		.locator( ':scope > th, :scope > td' )
		.evaluateAll( ( cells ) =>
			cells.map(
				( cell ) => ( cell.querySelector( '[contenteditable]' ) ?? cell ).textContent?.trim() ?? ''
			)
		);
}

/**
 * 通常セルだけで構成されるTable属性に対し、列移動後の期待値を作る。
 *
 * @param attributes               移動前のTable属性。
 * @param sourceColumnIndex        移動元列。
 * @param destinationBoundaryIndex 移動先境界。
 * @return 列だけを移動したTable属性。
 */
export function moveRegularColumn(
	attributes: Record< string, unknown >,
	sourceColumnIndex: number,
	destinationBoundaryIndex: number
) {
	const moved = structuredClone( attributes );
	for ( const sectionName of [ 'head', 'body', 'foot' ] ) {
		const section = moved[ sectionName ];
		if ( ! Array.isArray( section ) ) {
			continue;
		}

		/* Tableの全sectionで同じ論理列だけを移動し、保持対象データを変更しない。 */
		for ( const row of section as { cells: unknown[] }[] ) {
			const [ source ] = row.cells.splice( sourceColumnIndex, 1 );
			const insertionIndex =
				destinationBoundaryIndex > sourceColumnIndex
					? destinationBoundaryIndex - 1
					: destinationBoundaryIndex;
			row.cells.splice( insertionIndex, 0, source );
		}
	}
	return moved;
}
