/**
 * Jest環境でWordPress RichTextの文字列正規化境界だけを再現する。
 *
 * 一部テストは`@wordpress/data`を責務境界として部分mockするため、RichText package内部Storeの初期化に依存せず、
 * YTRが利用する`create()`と`getTextContent()`だけをDOMで再現する。
 */

jest.mock( '@wordpress/rich-text', () => ( {
	create: ( { html = '', text = '' } = {} ) => {
		if ( html !== '' ) {
			const container = document.createElement( 'div' );
			container.innerHTML = html;
			return { text: container.textContent ?? '' };
		}

		return { text };
	},
	getTextContent: ( value ) => value.text,
} ) );
