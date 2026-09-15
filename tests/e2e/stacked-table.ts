/**
 * Stacked / Reflow Table相当の表示を、対応Tableの論理構造を変えずにE2Eへ提供する。
 */

import type { Locator } from '@playwright/test';

/**
 * 対象Tableのセルを縦積みにし、横方向の物理列配置だけを失わせる。
 *
 * @param table 対応Tableの編集画面上のTable要素。
 */
export async function applyStackedTableLayout( table: Locator ): Promise< void > {
	await table.evaluate( ( tableElement ) => {
		const stackedElements = [
			tableElement,
			...tableElement.querySelectorAll( 'thead, tbody, tfoot, tr, th, td' ),
		];

		for ( const element of stackedElements ) {
			( element as HTMLElement ).style.setProperty( 'display', 'block', 'important' );
			( element as HTMLElement ).style.setProperty( 'width', '100%', 'important' );
		}
	} );
}
