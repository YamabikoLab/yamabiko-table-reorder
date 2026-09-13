/**
 * Jest環境では、各test file固有の`@wordpress/data`部分mockより先にWordPress RichTextを初期化する。
 *
 * RichText自体はmockせず、package内部Storeの初期化だけを実物の`@wordpress/data`で完了させる。
 * これにより、後からtest fileが`select` / `dispatch`を部分mockしてもRichTextの初期化Contractを壊さない。
 */

import '@wordpress/rich-text';
