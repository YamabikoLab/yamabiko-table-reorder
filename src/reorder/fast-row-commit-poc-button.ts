/* eslint-disable no-console */
/**
 * #714の高速Row commitを実WordPress Editor上の一時ボタンから確認するPoC UIを所有する。
 *
 * 既存Lifecycle PoCの一括Row更新に加え、移動先への行挿入・データコピー・移動元削除を
 * 個別の属性更新として行う経路を比較し、大規模Tableで更新範囲が性能へ与える影響を確認する。
 */

import { runRowReorderCommitWithoutClearByClientIdPoC } from './reorder-commit-lifecycle-poc';

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

/** 同期開始する高速Row commit PoCボタンのDOM id。 */
const FAST_ROW_BUTTON_ID = 'ytr-fast-row-commit-poc';

/** 次taskから開始する高速Row commit PoCボタンのDOM id。 */
const FAST_ROW_NEXT_TASK_BUTTON_ID = 'ytr-fast-row-next-task-commit-poc';

/** 挿入・コピー・削除でRow移動を試すPoCボタンのDOM id。 */
const INSERT_COPY_DELETE_BUTTON_ID = 'ytr-insert-copy-delete-row-poc';

/** 高速Row commit PoCの移動距離入力のDOM id。 */
const FAST_ROW_DISTANCE_INPUT_ID = 'ytr-fast-row-commit-poc-distance';

/** 高速Row commit PoCで固定して移動する元Row。 */
const FAST_ROW_FROM_INDEX = 0;

/** 高速Row commit PoCの初期移動距離。 */
const FAST_ROW_DEFAULT_DISTANCE = 50;

/** Table CellのPoC向け最小表現。 */
type TableCell = Record< string, unknown > & {
	content?: unknown;
};

/** Table RowのPoC向け最小表現。 */
type TableRow = Record< string, unknown > & {
	cells: TableCell[];
};

/** PoCで参照するTable属性。 */
type TableAttributes = Record< string, unknown > & {
	body?: TableRow[];
};

/** WordPress Block Editorから取得するBlockのPoC向け最小表現。 */
type BlockRecord = {
	attributes: TableAttributes;
};

/** 現在選択中のBlockとTable属性を取得するためのWordPress selector。 */
type BlockEditorSelector = {
	getBlock: ( clientId: string ) => BlockRecord | null;
	getSelectedBlockClientId: () => string | null;
};

/** Row属性更新に必要なWordPress action。 */
type BlockEditorDispatch = {
	updateBlockAttributes: ( clientId: string, attributes: Partial< TableAttributes > ) => void;
};

/** 高速Row commit PoCボタンが利用するWordPress Data APIの最小境界。 */
type WordPressData = {
	dispatch: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorDispatch;
	select: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorSelector;
};

/** PoCボタンが参照するEditor window。 */
type FastRowCommitPoCWindow = Window &
	typeof globalThis & {
		wp?: {
			data?: WordPressData;
		};
	};

/** 挿入・コピー・削除の各更新で計測する時間。 */
type BodyUpdateMeasurement = {
	dispatchMs: number;
	observationBoundaryMs: number;
};

/**
 * 現在のWordPress Data APIを取得する。
 *
 * @return 対象Tableの選択状態と属性更新に利用するData API。
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
 * 描画境界を2回通過し、属性更新後のEditor処理を観測できる状態まで待つ。
 *
 * @return 2回目の描画境界を通過したときに解決するPromise。
 */
const waitForObservationBoundary = (): Promise< void > =>
	new Promise( ( resolve ) => {
		window.requestAnimationFrame( () => {
			window.requestAnimationFrame( () => resolve() );
		} );
	} );

/**
 * Table Rowを新しいRow / Cell参照として複製する。
 *
 * @param row 複製元Row。
 * @return Cellを含めて浅く複製したRow。
 */
const copyTableRow = ( row: TableRow ): TableRow => ( {
	...row,
	cells: row.cells.map( ( cell ) => ( { ...cell } ) ),
} );

/**
 * 挿入段階で使用する空Rowを移動元Rowと同じCell構造から生成する。
 *
 * @param row 複製元Row。
 * @return Cell内容だけを空にした新しいRow。
 */
const createBlankTableRow = ( row: TableRow ): TableRow => ( {
	...row,
	cells: row.cells.map( ( cell ) => ( { ...cell, content: '' } ) ),
} );

/**
 * 1回のbody属性更新と、その後の描画境界までの時間を計測する。
 *
 * @param stage    計測ログで識別する更新段階。
 * @param clientId 対象TableのclientId。
 * @param body     更新後のbody。
 * @return dispatch復帰時間と2回目の描画境界までの時間。
 */
const updateBodyAndObserve = async (
	stage: 'INSERT' | 'COPY' | 'DELETE',
	clientId: string,
	body: TableRow[]
): Promise< BodyUpdateMeasurement > => {
	const actions = getWordPressData().dispatch( BLOCK_EDITOR_STORE );
	const startedAt = performance.now();
	console.log( `🧪 Insert/Copy/Delete ${ stage } dispatch start`, { rows: body.length } );
	actions.updateBlockAttributes( clientId, { body } );
	const dispatchMs = performance.now() - startedAt;
	console.log( `🧪 Insert/Copy/Delete ${ stage } dispatch returned`, { dispatchMs } );

	await waitForObservationBoundary();
	const observationBoundaryMs = performance.now() - startedAt;
	console.log( `🧪 Insert/Copy/Delete ${ stage } observation boundary`, {
		dispatchMs,
		observationBoundaryMs,
	} );

	return { dispatchMs, observationBoundaryMs };
};

/**
 * Row 0を完成済み配列の並べ替えではなく、挿入・コピー・元Row削除の3段階で移動する。
 *
 * 移動元Rowを残した状態で目的位置の直後へ空Rowを挿入し、そこへ元Rowのデータをコピーしてから
 * Row 0を削除する。削除によって複製Rowが1つ前へ詰まり、最終的に指定した0-based位置へ到達する。
 *
 * @param clientId 対象TableのclientId。
 * @param toIndex  Row 0の最終移動先。
 * @return 各段階と全体の計測結果。
 */
const runInsertCopyDeleteRowPoC = async ( clientId: string, toIndex: number ) => {
	const data = getWordPressData();
	const block = data.select( BLOCK_EDITOR_STORE ).getBlock( clientId );
	const body = block?.attributes.body;

	if ( ! Array.isArray( body ) || body.length === 0 ) {
		throw new Error( 'Insert/copy/delete Row PoC requires Table body rows.' );
	}

	if ( toIndex <= FAST_ROW_FROM_INDEX || toIndex >= body.length ) {
		throw new Error( 'Insert/copy/delete Row PoC requires a destination after Row 0.' );
	}

	const sourceRow = body[ FAST_ROW_FROM_INDEX ];
	if ( ! sourceRow || ! Array.isArray( sourceRow.cells ) ) {
		throw new Error( 'Insert/copy/delete Row PoC could not resolve Row 0.' );
	}

	console.log( '🧪 Insert/Copy/Delete START', {
		clientId,
		fromIndex: FAST_ROW_FROM_INDEX,
		toIndex,
		rows: body.length,
	} );

	const totalStartedAt = performance.now();
	const insertionIndex = toIndex + 1;
	const insertedBody = [ ...body ];
	insertedBody.splice( insertionIndex, 0, createBlankTableRow( sourceRow ) );
	const insert = await updateBodyAndObserve( 'INSERT', clientId, insertedBody );

	const copiedBody = [ ...insertedBody ];
	copiedBody[ insertionIndex ] = copyTableRow( sourceRow );
	const copy = await updateBodyAndObserve( 'COPY', clientId, copiedBody );

	const deletedSourceBody = [ ...copiedBody ];
	deletedSourceBody.splice( FAST_ROW_FROM_INDEX, 1 );
	const removeSource = await updateBodyAndObserve( 'DELETE', clientId, deletedSourceBody );

	return {
		clientId,
		fromIndex: FAST_ROW_FROM_INDEX,
		toIndex,
		insert,
		copy,
		removeSource,
		totalMs: performance.now() - totalStartedAt,
	};
};

/**
 * PoC用buttonへ共通の固定表示を適用する。
 *
 * @param button 表示対象button。
 * @param bottom 画面下端からの距離。
 */
const stylePoCButton = ( button: HTMLButtonElement, bottom: number ): void => {
	button.style.position = 'fixed';
	button.style.right = '16px';
	button.style.bottom = `${ bottom }px`;
	button.style.zIndex = '100000';
	button.style.padding = '8px 12px';
	button.style.border = '1px solid currentColor';
	button.style.borderRadius = '4px';
	button.style.background = 'Canvas';
	button.style.color = 'CanvasText';
	button.style.cursor = 'pointer';
};

/**
 * Table選択を維持した高速Row commitを実Editor上から実行する一時ボタンを登録する。
 *
 * 一括更新、次task開始、挿入・コピー・削除の3経路を同じ移動距離で比較する。
 */
export const registerFastRowCommitPoCButton = (): void => {
	if ( document.getElementById( FAST_ROW_BUTTON_ID ) ) {
		return;
	}

	let pendingClientId: string | null = null;
	let pendingNextTaskClientId: string | null = null;
	let pendingInsertCopyDeleteClientId: string | null = null;
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
	stylePoCButton( button, 56 );

	const nextTaskButton = document.createElement( 'button' );
	nextTaskButton.id = FAST_ROW_NEXT_TASK_BUTTON_ID;
	nextTaskButton.type = 'button';
	nextTaskButton.textContent = `PoC: Next Task 0→${ FAST_ROW_DEFAULT_DISTANCE }`;
	stylePoCButton( nextTaskButton, 16 );

	const insertCopyDeleteButton = document.createElement( 'button' );
	insertCopyDeleteButton.id = INSERT_COPY_DELETE_BUTTON_ID;
	insertCopyDeleteButton.type = 'button';
	insertCopyDeleteButton.textContent = `PoC: Insert/Copy/Delete 0→${ FAST_ROW_DEFAULT_DISTANCE }`;
	stylePoCButton( insertCopyDeleteButton, 136 );

	distanceInput.addEventListener( 'input', () => {
		button.textContent = `PoC: Fast Row 0→${ distanceInput.value }`;
		nextTaskButton.textContent = `PoC: Next Task 0→${ distanceInput.value }`;
		insertCopyDeleteButton.textContent = `PoC: Insert/Copy/Delete 0→${ distanceInput.value }`;
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

	insertCopyDeleteButton.addEventListener( 'pointerdown', ( event ) => {
		event.preventDefault();
		event.stopPropagation();
		pendingInsertCopyDeleteClientId = getWordPressData()
			.select( BLOCK_EDITOR_STORE )
			.getSelectedBlockClientId();
	} );

	button.addEventListener( 'click', ( event ) => {
		event.preventDefault();
		event.stopPropagation();

		const clientId = pendingClientId;
		pendingClientId = null;
		if ( clientId === null ) {
			console.error( '❌ Fast Row commit PoC failed', new Error( 'Fast Row commit PoC requires a selected Table.' ) );
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
		runFastRowCommit( clientId, toIndex, () => {
			button.disabled = false;
		} );
	} );

	nextTaskButton.addEventListener( 'click', ( event ) => {
		event.preventDefault();
		event.stopPropagation();

		const clientId = pendingNextTaskClientId;
		pendingNextTaskClientId = null;
		if ( clientId === null ) {
			console.error( '❌ Fast Row commit PoC failed', new Error( 'Fast Row commit PoC requires a selected Table.' ) );
			return;
		}

		let toIndex: number;
		try {
			toIndex = getFastRowToIndex( distanceInput );
		} catch ( error: unknown ) {
			console.error( '❌ Fast Row commit PoC failed', error );
			return;
		}

		nextTaskButton.disabled = true;
		setTimeout( () => {
			runFastRowCommit( clientId, toIndex, () => {
				nextTaskButton.disabled = false;
			} );
		}, 0 );
	} );

	insertCopyDeleteButton.addEventListener( 'click', ( event ) => {
		event.preventDefault();
		event.stopPropagation();

		const clientId = pendingInsertCopyDeleteClientId;
		pendingInsertCopyDeleteClientId = null;
		if ( clientId === null ) {
			console.error(
				'❌ Insert/copy/delete Row PoC failed',
				new Error( 'Insert/copy/delete Row PoC requires a selected Table.' )
			);
			return;
		}

		let toIndex: number;
		try {
			toIndex = getFastRowToIndex( distanceInput );
		} catch ( error: unknown ) {
			console.error( '❌ Insert/copy/delete Row PoC failed', error );
			return;
		}

		insertCopyDeleteButton.disabled = true;
		runInsertCopyDeleteRowPoC( clientId, toIndex )
			.then( ( result ) => {
				console.log( '✅ Insert/copy/delete Row PoC result', result );
			} )
			.catch( ( error: unknown ) => {
				console.error( '❌ Insert/copy/delete Row PoC failed', error );
			} )
			.finally( () => {
				insertCopyDeleteButton.disabled = false;
			} );
	} );

	document.body.appendChild( distanceInput );
	document.body.appendChild( button );
	document.body.appendChild( nextTaskButton );
	document.body.appendChild( insertCopyDeleteButton );
	console.log( '🧪 Fast Row commit PoC buttons registered' );
};
