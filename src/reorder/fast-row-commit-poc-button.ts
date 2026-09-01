/* eslint-disable no-console */
/**
 * #714の高速Row commitを実WordPress Editor上の一時ボタンから確認するPoC UIを所有する。
 *
 * commit処理自体は所有せず、既存Lifecycle PoCの「Table選択を維持したままRow属性を更新する」経路だけを呼び出す。
 * 移動距離を切り替えて、リロード直後の初回commit性能と移動範囲の関係を比較できるようにする。
 */

import { runRowReorderCommitWithoutClearByClientIdPoC } from './reorder-commit-lifecycle-poc';

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

/** 高速Row commit PoCボタンのDOM id。 */
const FAST_ROW_BUTTON_ID = 'ytr-fast-row-commit-poc';

/** 高速Row commit PoCの移動距離入力のDOM id。 */
const FAST_ROW_DISTANCE_INPUT_ID = 'ytr-fast-row-commit-poc-distance';

/** 高速Row commit PoCで固定して移動する元Row。 */
const FAST_ROW_FROM_INDEX = 0;

/** 高速Row commit PoCの初期移動距離。 */
const FAST_ROW_DEFAULT_DISTANCE = 50;

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
 * 入力された移動距離をRow 0の移動先として取得する。
 *
 * @param input 移動距離を入力する数値欄。
 * @return Row 0の移動先となる0-based位置。
 */
const getFastRowToIndex = ( input: HTMLInputElement ): number => {
	const toIndex = Number.parseInt( input.value, 10 );

	if ( ! Number.isInteger( toIndex ) || toIndex < 0 ) {
		throw new Error( 'Fast Row commit PoC requires a non-negative integer distance.' );
	}

	return toIndex;
};

/**
 * Table選択を維持した高速Row commitを実Editor上から実行する一時ボタンを登録する。
 *
 * Row Reorder ModeがONの対象Tableを選択した状態で、入力した移動距離だけRow 0を移動し、
 * 既存Lifecycle PoCと同じ計測結果をConsoleへ出力する。
 */
export const registerFastRowCommitPoCButton = (): void => {
	if ( document.getElementById( FAST_ROW_BUTTON_ID ) ) {
		return;
	}

	let pendingClientId: string | null = null;
	const distanceInput = document.createElement( 'input' );
	distanceInput.id = FAST_ROW_DISTANCE_INPUT_ID;
	distanceInput.type = 'number';
	distanceInput.min = '0';
	distanceInput.step = '1';
	distanceInput.value = String( FAST_ROW_DEFAULT_DISTANCE );
	distanceInput.setAttribute( 'aria-label', 'Fast Row PoC move distance' );
	distanceInput.title = 'Row 0 move distance';
	distanceInput.style.position = 'fixed';
	distanceInput.style.right = '190px';
	distanceInput.style.bottom = '56px';
	distanceInput.style.zIndex = '100000';
	distanceInput.style.width = '72px';
	distanceInput.style.padding = '8px';
	distanceInput.style.border = '1px solid currentColor';
	distanceInput.style.borderRadius = '4px';
	distanceInput.style.background = 'Canvas';
	distanceInput.style.color = 'CanvasText';

	const button = document.createElement( 'button' );
	button.id = FAST_ROW_BUTTON_ID;
	button.type = 'button';
	button.textContent = `PoC: Fast Row 0→${ FAST_ROW_DEFAULT_DISTANCE }`;
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

	distanceInput.addEventListener( 'input', () => {
		button.textContent = `PoC: Fast Row 0→${ distanceInput.value }`;
	} );

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

		let toIndex: number;
		try {
			toIndex = getFastRowToIndex( distanceInput );
		} catch ( error: unknown ) {
			console.error( '❌ Fast Row commit PoC failed', error );
			return;
		}

		button.disabled = true;
		distanceInput.disabled = true;
		runRowReorderCommitWithoutClearByClientIdPoC( clientId, FAST_ROW_FROM_INDEX, toIndex )
			.then( ( result ) => {
				console.log( '✅ Fast Row commit PoC result', result );
			} )
			.catch( ( error: unknown ) => {
				console.error( '❌ Fast Row commit PoC failed', error );
			} )
			.finally( () => {
				button.disabled = false;
				distanceInput.disabled = false;
			} );
	} );

	document.body.appendChild( distanceInput );
	document.body.appendChild( button );
	console.log( '🧪 Fast Row commit PoC button registered' );
};
