import type { CDPSession, Locator, Page } from '@playwright/test';
import type { Editor } from '@wordpress/e2e-test-utils-playwright';

import { getEditorContext } from './editor-context';

export const ROW_BUTTON = /^(Reorder rows|行を並び替え|行を並べ替え)$/;
export const GUIDANCE = /^(Reorder rows and columns\.|行と列を並び替えられます。)$/;
export const REJECTION =
	/^(Cannot move because cells are merged\.|セルが結合されているため、移動できません。)$/;

export type TableName = 'core/table' | 'flexible-table-block/table';
export type Point = { x: number; y: number };

/**
 * 各テストの初回案内とEditor表示設定を明示する。
 * @param page         管理画面。
 * @param acknowledged 初回案内を表示済みにするか。
 */
export async function setPreferences( page: Page, acknowledged = true ) {
	await page.evaluate( ( seen ) => {
		const preferences = window.wp.data.dispatch( 'core/preferences' );
		preferences.set( 'yamabiko-table-reorder', 'initialGuidanceAcknowledgedPc', seen );
		preferences.set( 'yamabiko-table-reorder', 'initialGuidanceAcknowledgedTouch', seen );
		preferences.set( 'core/edit-post', 'fixedToolbar', true );
	}, acknowledged );
}

/**
 * 行名を先頭セルへ置き、空セルも含めた再現可能なTableを作る。
 * @param rowCount    行数。
 * @param columnCount 列数。
 */
export function tableAttributes( rowCount = 4, columnCount = 3 ) {
	return {
		hasFixedLayout: true,
		body: Array.from( { length: rowCount }, ( _, row ) => ( {
			cells: Array.from( { length: columnCount }, ( __, column ) => ( {
				tag: 'td',
				content: column === 0 ? `Row ${ row + 1 }` : '',
			} ) ),
		} ) ),
	};
}

/**
 * WordPressの公開helperでTableを挿入し、現在の編集領域の実Tableを返す。
 * @param page       管理画面。
 * @param editor     WordPressの編集helper。
 * @param name       対応Table名。
 * @param attributes テストで必要な編集データ。
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
	const block = canvas.locator( `[data-block="${ identity }"]` );
	await editor.selectBlocks( block );
	return { canvas, block, rows: block.locator( 'tbody > tr' ) };
}

/**
 * 座標は常に外側Pageを基準にする。iframe内の入力もPlaywright/CDPで同じ位置を操作する。
 * @param locator  操作対象。
 * @param vertical 対象内の縦位置（上端0、下端1）。
 */
export async function pointIn( locator: Locator, vertical = 0.5 ): Promise< Point > {
	const box = await locator.boundingBox();
	if ( ! box ) {
		throw new Error( 'The gesture target is not visible.' );
	}
	return { x: box.x + box.width / 3, y: box.y + box.height * vertical };
}

export async function startMouseDrag( page: Page, source: Locator ) {
	const point = await pointIn( source );
	await page.mouse.move( point.x, point.y );
	await page.mouse.down();
	await page.mouse.move( point.x + 8, point.y, { steps: 3 } );
}

export async function moveMouse( page: Page, point: Point ) {
	await page.mouse.move( point.x, point.y, { steps: 12 } );
}

/**
 * Playwrightに長押し／スワイプAPIがないため、テスト支援境界だけで実タッチ入力を送る。
 * @param page 入力先の管理画面。
 */
export async function touchInput( page: Page ) {
	const session: CDPSession = await page.context().newCDPSession( page );
	return {
		start: ( point: Point ) =>
			session.send( 'Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [ { ...point, id: 1 } ],
			} ),
		move: ( point: Point ) =>
			session.send( 'Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [ { ...point, id: 1 } ],
			} ),
		end: () =>
			session.send( 'Input.dispatchTouchEvent', {
				type: 'touchEnd',
				touchPoints: [],
			} ),
		scroll: async ( point: Point ) => {
			await session.send( 'Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [ { ...point, id: 1 } ],
			} );
			for ( let step = 1; step <= 8; step++ ) {
				await session.send( 'Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: [ { x: point.x, y: point.y - step * 30, id: 1 } ],
				} );
			}
			await session.send( 'Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] } );
		},
		dispose: () => session.detach(),
	};
}

/**
 * 保存対象のBlock属性を比較し、DnD表示用DOMをデータ結果として扱わない。
 * @param editor WordPressの編集helper。
 */
export async function tableData( editor: Editor ) {
	const blocks = await editor.getBlocks();
	return blocks
		.filter( ( block ) => block.name.endsWith( '/table' ) )
		.map( ( block ) => block.attributes );
}

export async function rowOrder( rows: Locator ) {
	return rows.evaluateAll( ( elements ) =>
		elements.map( ( row ) => {
			const cell = row.firstElementChild;
			return ( cell?.querySelector( '[contenteditable]' ) ?? cell )?.textContent;
		} )
	);
}
