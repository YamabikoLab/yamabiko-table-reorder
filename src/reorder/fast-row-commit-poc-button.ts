/* eslint-disable no-console */
/**
 * #714の高速Row commitを実WordPress Editor上の一時ボタンから確認するPoC UIを所有する。
 *
 * commit処理自体は所有せず、既存Lifecycle PoCの「Table選択を維持したままRow属性を更新する」経路だけを呼び出す。
 * 移動距離とcommit開始taskを切り替え、リロード直後の初回commit性能を比較できるようにする。
 */

import { runRowReorderCommitWithoutClearByClientIdPoC } from './reorder-commit-lifecycle-poc';

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

/** 同期開始する高速Row commit PoCボタンのDOM id。 */
const FAST_ROW_BUTTON_ID = 'ytr-fast-row-commit-poc';

/** 次taskから開始する高速Row commit PoCボタンのDOM id。 */
const FAST_ROW_NEXT_TASK_BUTTON_ID = 'ytr-fast-row-next-task-commit-poc';

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
 * Table選択を維持したRow commitを実行し、PoC計測結果を出力する。
 *
 * @param clientId   対象TableのclientId。
 * @param toIndex    Row 0の移動先。
 * @param onComplete commit完了後にPoC UIを復帰する処理。
 */
const runFastRowCommit = ( clientId: string, toIndex: number, onComplete: () => void ): void => {
	runRowReorderCommitWithoutClearByClientIdPoC( clientId, FAST_ROW_FROM_INDEX, toIndex )
		.then( ( result ) => {
			console.log( '✅ Fast Row commit PoC result', result );
		} )
		.catch( ( error: unknown ) => {
			console.error( '❌ Fast Row commit PoC failed', error );
		} )
		.finally( onComplete );
};

/**
 * Table選択を維持した高速Row commitを実Editor上から実行する一時ボタンを登録する。
 *
 * 同期開始と次task開始の2経路を同じ移動距離で比較し、入力イベントtaskとattribute commitを
 * 分離した場合にリロード直後の初回遅延が変化するかを確認する。
 */
export const registerFastRowCommitPoCButton = (): void => {
	if ( document.getElementById( FAST_ROW_BUTTON_ID ) ) {
		return;
	}

	let pendingClientId: string | null = null;
	let pendingNextTaskClientId: string | null = null;
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

	const nextTaskButton = document.createElement( 'button' );
	nextTaskButton.id = FAST_ROW_NEXT_TASK_BUTTON_ID;
	nextTaskButton.type = 'button';
	nextTaskButton.textContent = `PoC: Next Task 0→${ FAST_ROW_DEFAULT_DISTANCE }`;
	nextTaskButton.style.position = 'fixed';
	nextTaskButton.style.right = '16px';
	nextTaskButton.style.bottom = '16px';
	nextTaskButton.style.zIndex = '100000';
	nextTaskButton.style.padding = '8px 12px';
	nextTaskButton.style.border = '1px solid currentColor';
	nextTaskButton.style.borderRadius = '4px';
	nextTaskButton.style.background = 'Canvas';
	nextTaskButton.style.color = 'CanvasText';
	nextTaskButton.style.cursor = 'pointer';

	distanceInput.addEventListener( 'input', () => {
		button.textContent = `PoC: Fast Row 0→${ distanceInput.value }`;
		nextTaskButton.textContent = `PoC: Next Task 0→${ distanceInput.value }`;
	} );

	button.addEventListener( 'pointerdown', ( event ) => {
		event.preventDefault();
		event.stopPropagation();
		pendingClientId = getWordPressData().select( BLOCK_EDITOR_STORE ).getSelectedBlockClientId();
	} );

	nextTaskButton.addEventListener( 'pointerdown', ( event ) => {
		event.preventDefault();
		event.stopPropagation();
		pendingNextTaskClientId = getWordPressData()
			.select( BLOCK_EDITOR_STORE )
			.getSelectedBlockClientId();
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
		nextTaskButton.disabled = true;
		distanceInput.disabled = true;
		runFastRowCommit( clientId, toIndex, () => {
			button.disabled = false;
			nextTaskButton.disabled = false;
			distanceInput.disabled = false;
		} );
	} );

	nextTaskButton.addEventListener( 'click', ( event ) => {
		event.preventDefault();
		event.stopPropagation();

		const clientId = pendingNextTaskClientId;
		pendingNextTaskClientId = null;

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
		nextTaskButton.disabled = true;
		distanceInput.disabled = true;

		setTimeout( () => {
			runFastRowCommit( clientId, toIndex, () => {
				button.disabled = false;
				nextTaskButton.disabled = false;
				distanceInput.disabled = false;
			} );
		}, 0 );
	} );

	document.body.appendChild( distanceInput );
	document.body.appendChild( button );
	document.body.appendChild( nextTaskButton );
	console.log( '🧪 Fast Row commit PoC buttons registered' );
};
