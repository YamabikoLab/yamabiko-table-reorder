import type { FrameLocator, Page } from '@playwright/test';

export type EditorContext = Page | FrameLocator;

/**
 * WordPressのiframe / non-iframe Editor差を吸収し、現在の編集領域を返す。
 *
 * @param page         WordPress管理画面のPage。
 * @param editorCanvas WordPress E2E helperが提供するEditor canvas。
 * @return 現在のEditor内容を操作するcontext。
 */
export async function getEditorContext(
	page: Page,
	editorCanvas: FrameLocator
): Promise< EditorContext > {
	if ( ( await page.locator( 'iframe[name="editor-canvas"]' ).count() ) > 0 ) {
		return editorCanvas;
	}

	return page;
}
