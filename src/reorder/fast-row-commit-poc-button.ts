/**
 * #714の高速Row commitを実WordPress Editor上の一時ボタンから確認するPoC UIを所有する。
 *
 * commit処理自体は所有せず、既存Lifecycle PoCの「Table選択を維持したままRow属性を更新する」経路だけを呼び出す。
 * ボタン操作によって対象Tableの選択が失われないよう、操作開始時の選択を維持して同じ条件で性能を確認できるようにする。
 */

import { runRowReorderCommitWithoutClearByClientIdPoC } from './reorder-commit-lifecycle-poc';

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

/** 高速Row commit PoCボタンのDOM id。 */
const FAST_ROW_BUTTON_ID = 'ytr-fast-row-commit-poc';

/** 高速Row commit PoCで固定して移動する元Row。 */
const FAST_ROW_FROM_INDEX = 0;

/** 高速Row commit PoCで固定して移動する先Row。 */
const FAST_ROW_TO_INDEX = 50;

/** 現在選択中のBlockを取得するためのWordPress selector。 */
type BlockEditorSelector = {
	getSelectedBlockClientId: () => string | null;
};

/** 高速Row commit PoCボタンが利用するWordPress Data APIの最小境界。 */
type WordPressData = {
	select: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorSelector;
};

/** PoCボタンが参照するEditor window。 */
type FastRowCommitPoCWindow = Window &
	typeof globalThis & {
		wp?: {
			data?: WordPressData;
		};
	};

/**
 * 現在のWordPress Data APIを取得する。
 *
 * @return 対象Tableの選択状態を取得するためのData API。
 */
const getWordPressData = (): WordPressData => {
	const editorWindow = window as FastRowCommitPoCWindow;
	const data = editorWindow.wp?.data;

	if ( ! data ) {
		throw new Error( 'Fast Row commit PoC requires the WordPress Data API.' );
	}

	return data;
};

/**
 * Table選択を維持した高速Row commitを実Editor上から実行する一時ボタンを登録する。
 *
 * Row Reorder ModeがONの対象Tableを選択した状態で押すと、Row 0をRow 50へ移動し、
 * 既存Lifecycle PoCと同じ計測結果をConsoleへ出力する。
 */
export const registerFastRowCommitPoCButton = (): void => {
	if ( document.getElementById( FAST_ROW_BUTTON_ID ) ) {
		return;
	}

	let pendingClientId: string | null = null;
	const button = document.createElement( 'button' );
	button.id = FAST_ROW_BUTTON_ID;
	button.type = 'button';
	button.textContent = 'PoC: Fast Row 0→50';
	button.style.position = 'fixed';
	button.style.right = '16px';
	button.style.bottom = '56px';
	button.style.zIndex = '100000';
	button.style.padding = '8px 12px';
	button.style.border = '1px solid currentColor';
	button.style.borderRadius = '4px';
	button.style.background = 'Canvas';
	button.style.color = 'CanvasText';
	button.style.cursor = 'pointer';

	button.addEventListener( 'pointerdown', ( event ) => {
		event.preventDefault();
		event.stopPropagation();
		pendingClientId = getWordPressData().select( BLOCK_EDITOR_STORE ).getSelectedBlockClientId();
	} );

	button.addEventListener( 'click', ( event ) => {
		event.preventDefault();
		event.stopPropagation();

		const clientId = pendingClientId;
		pendingClientId = null;

		if ( clientId === null ) {
			console.error(
				'❌ Fast Row commit PoC failed',
				new Error( 'Fast Row commit PoC requires a selected Table.' )
			);
			return;
		}

		button.disabled = true;
		runRowReorderCommitWithoutClearByClientIdPoC(
			clientId,
			FAST_ROW_FROM_INDEX,
			FAST_ROW_TO_INDEX
		)
			.then( ( result ) => {
				console.log( '✅ Fast Row commit PoC result', result );
			} )
			.catch( ( error: unknown ) => {
				console.error( '❌ Fast Row commit PoC failed', error );
			} )
			.finally( () => {
				button.disabled = false;
			} );
	} );

	document.body.appendChild( button );
	console.log( '🧪 Fast Row commit PoC button registered' );
};
