/**
 * JestではRichText Storeの登録副作用を読み込まず、Table Integrationが利用する表示文字列変換だけを提供する。
 */

const create = ( { html } ) => ( { html } );

const getTextContent = ( value ) => {
	const container = document.createElement( 'div' );
	container.innerHTML = value.html;
	return container.textContent ?? '';
};

module.exports = { create, getTextContent };
