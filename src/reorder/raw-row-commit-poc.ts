/* eslint-disable no-console */
/**
 * #714で高速だったConsole実験をReorder Modeとは独立して再現するPoCを所有する。
 *
 * Core TableのRow `0 → 50`について、次の順序だけを実行する。
 * `nextBody`生成 → Table選択解除 → 2回の描画境界待機 → 属性更新 → event loop / 1st RAF / 2nd RAF計測。
 * Reorder Mode、DnD、編集抑止、commit後のTable再選択には依存しない。
 */

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

/** Console実験で対象としていたCore Table Block名。 */
const CORE_TABLE_BLOCK = 'core/table';

/** 固定PoCボタンのDOM id。 */
const RAW_ROW_BUTTON_ID = 'ytr-raw-row-commit-poc';

/** ログと計測結果へ表示するRaw Row PoCのリビジョン。 */
const RAW_ROW_POC_REVISION = 'r3';

/** Console実験と同じ移動元Row。 */
const RAW_ROW_FROM_INDEX = 0;

/** Console実験で代表計測に用いた移動先Row。 */
const RAW_ROW_TO_INDEX = 50;

/** Table RowのPoC向け最小表現。 */
type TableRow = Record< string, unknown > & {
	cells?: unknown[];
};

/** Core Table属性のPoC向け最小表現。 */
type CoreTableAttributes = Record< string, unknown > & {
	body?: TableRow[];
};

/** Block Editorから取得するBlockのPoC向け最小表現。 */
type BlockRecord = {
	attributes: CoreTableAttributes;
	clientId: string;
	name: string;
};

/** Raw Console再現で利用するBlock Editor selector。 */
type BlockEditorSelector = {
	getBlock: ( clientId: string ) => BlockRecord | null;
	getSelectedBlockClientId: () => string | null;
};

/** Raw Console再現で利用するBlock Editor action。 */
type BlockEditorDispatch = {
	clearSelectedBlock: () => void;
	updateBlockAttributes: ( clientId: string, attributes: Partial< CoreTableAttributes > ) => void;
};

/** Raw Console再現が利用するWordPress Data API。 */
type WordPressData = {
	dispatch: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorDispatch;
	select: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorSelector;
	subscribe: ( listener: () => void ) => () => void;
};

/** PoCが参照するEditor window。 */
type RawRowPoCWindow = Window &
	typeof globalThis & {
		wp?: {
			data?: WordPressData;
		};
	};

/** Raw Console再現の計測結果。 */
export type RawRowCommitPoCResult = {
	clientId: string;
	dispatchReturnMs: number;
	eventLoopReturnMs: number;
	firstAnimationFrameMs: number;
	fromIndex: number;
	pocRevision: string;
	rowCount: number;
	secondAnimationFrameMs: number;
	toIndex: number;
};

/** 一時的な非選択中もPoC対象を失わないため、最後に明示選択されたCore Tableを保持する。 */
let trackedCoreTableClientId: string | null = null;

/** 選択監視の重複登録を防ぐための解除関数。 */
let unsubscribeSelectionTracking: ( () => void ) | null = null;

/**
 * 現在のWordPress Data APIを取得する。
 *
 * @return Raw Console再現に必要なData API。
 */
const getWordPressData = (): WordPressData => {
	const editorWindow = window as RawRowPoCWindow;
	const data = editorWindow.wp?.data;

	if ( ! data ) {
		throw new Error( 'Raw Row commit PoC requires the WordPress Data API.' );
	}

	return data;
};

/**
 * WordPress Editorの明示的なBlock選択をRaw PoC対象へ反映する。
 *
 * Core Tableが選択された場合は対象を更新し、別Blockが選択された場合は対象を解除する。
 * 選択Blockがない状態はスクロールやfocus移動、PoC自身の選択解除でも発生するため、既存対象を維持する。
 */
const synchronizeTrackedCoreTable = (): void => {
	const data = getWordPressData();
	const selector = data.select( BLOCK_EDITOR_STORE );
	const selectedClientId = selector.getSelectedBlockClientId();

	if ( selectedClientId === null ) {
		return;
	}

	const selectedBlock = selector.getBlock( selectedClientId );
	const selectedCoreTable = selectedBlock?.name === CORE_TABLE_BLOCK;
	trackedCoreTableClientId = selectedCoreTable ? selectedClientId : null;
};

/**
 * Raw PoCの対象Core Tableを取得する。
 *
 * 現在の明示選択を先に反映し、一時的に選択Blockがない場合は最後に選択されたCore Tableを利用する。
 * 対象Blockが削除済みまたはCore Tableではなくなった場合は保持情報を破棄する。
 *
 * @return Raw commit対象のCore Table。
 */
const getTrackedCoreTable = (): BlockRecord => {
	synchronizeTrackedCoreTable();

	if ( trackedCoreTableClientId === null ) {
		throw new Error( 'Raw Row commit PoC requires a Core Table selected before running the PoC.' );
	}

	const data = getWordPressData();
	const selector = data.select( BLOCK_EDITOR_STORE );
	const block = selector.getBlock( trackedCoreTableClientId );

	if ( ! block || block.name !== CORE_TABLE_BLOCK ) {
		trackedCoreTableClientId = null;
		throw new Error( 'Raw Row commit PoC target Core Table is no longer available.' );
	}

	return block;
};

/**
 * Console実験と同じ方法で既存Row参照を保ったままRow順を変更する。
 *
 * @param body      現在の`body`配列。
 * @param fromIndex 移動元の0-based位置。
 * @param toIndex   移動先の0-based位置。
 * @return Row参照を維持した新しい`body`配列。
 */
const moveRow = ( body: TableRow[], fromIndex: number, toIndex: number ): TableRow[] => {
	const indicesAreValid =
		Number.isInteger( fromIndex ) &&
		Number.isInteger( toIndex ) &&
		fromIndex >= 0 &&
		toIndex >= 0 &&
		fromIndex < body.length &&
		toIndex < body.length;

	if ( ! indicesAreValid ) {
		throw new Error( 'Raw Row commit PoC requires valid row indices.' );
	}

	const nextBody = [ ...body ];
	const [ movedRow ] = nextBody.splice( fromIndex, 1 );

	if ( ! movedRow ) {
		throw new Error( 'Raw Row commit PoC could not resolve the requested row.' );
	}

	nextBody.splice( toIndex, 0, movedRow );
	return nextBody;
};

/**
 * Table選択解除による描画をConsole実験と同じく2フレーム待つ。
 *
 * @return 2回目の描画境界を通過した時点で解決するPromise。
 */
const waitTwoAnimationFrames = (): Promise< void > =>
	new Promise( ( resolve ) => {
		window.requestAnimationFrame( () => {
			window.requestAnimationFrame( () => resolve() );
		} );
	} );

/**
 * 属性更新後のevent loop / 1st RAF / 2nd RAF復帰をConsole実験と同じ起点から計測する。
 *
 * @param startedAt `updateBlockAttributes()`直前の計測開始時刻。
 * @return 各境界の経過時間。
 */
const measurePostCommitBoundaries = (
	startedAt: number
): Promise<
	Pick<
		RawRowCommitPoCResult,
		'eventLoopReturnMs' | 'firstAnimationFrameMs' | 'secondAnimationFrameMs'
	>
> =>
	new Promise( ( resolve ) => {
		let eventLoopReturnMs: number | null = null;
		let firstAnimationFrameMs: number | null = null;
		let secondAnimationFrameMs: number | null = null;

		const finishIfComplete = () => {
			if (
				eventLoopReturnMs !== null &&
				firstAnimationFrameMs !== null &&
				secondAnimationFrameMs !== null
			) {
				resolve( {
					eventLoopReturnMs,
					firstAnimationFrameMs,
					secondAnimationFrameMs,
				} );
			}
		};

		window.setTimeout( () => {
			eventLoopReturnMs = performance.now() - startedAt;
			finishIfComplete();
		}, 0 );

		window.requestAnimationFrame( () => {
			firstAnimationFrameMs = performance.now() - startedAt;

			window.requestAnimationFrame( () => {
				secondAnimationFrameMs = performance.now() - startedAt;
				finishIfComplete();
			} );
		} );
	} );

/**
 * #714で記録済みの高速Console実験を、その順序のまま実行する。
 *
 * `nextBody`は選択解除前に生成し、選択解除後は2回の描画境界を待ってから属性更新する。
 * commit後のTable再選択は行わない。
 *
 * @param fromIndex 移動元の0-based位置。
 * @param toIndex   移動先の0-based位置。
 * @return Console実験と同じ境界の計測結果。
 */
export const runRawRowCommitPoC = async (
	fromIndex = RAW_ROW_FROM_INDEX,
	toIndex = RAW_ROW_TO_INDEX
): Promise< RawRowCommitPoCResult > => {
	const block = getTrackedCoreTable();
	const body = block.attributes.body;

	if ( ! Array.isArray( body ) ) {
		throw new Error( 'Raw Row commit PoC requires Core Table body rows.' );
	}

	const nextBody = moveRow( body, fromIndex, toIndex );
	const data = getWordPressData();
	const actions = data.dispatch( BLOCK_EDITOR_STORE );

	console.log( `🧪 Raw Row commit PoC ${ RAW_ROW_POC_REVISION }` );
	console.log( `行数: ${ body.length }` );
	console.log( `🚀 Raw選択解除後 commit: ${ fromIndex } → ${ toIndex }` );

	actions.clearSelectedBlock();
	await waitTwoAnimationFrames();

	const startedAt = performance.now();
	actions.updateBlockAttributes( block.clientId, { body: nextBody } );
	const dispatchReturnMs = performance.now() - startedAt;
	console.log( `① dispatch復帰: ${ dispatchReturnMs.toFixed( 1 ) } ms` );

	const boundaries = await measurePostCommitBoundaries( startedAt );
	console.log( `② event loop復帰: ${ boundaries.eventLoopReturnMs.toFixed( 1 ) } ms` );
	console.log( `③ 1st RAF: ${ boundaries.firstAnimationFrameMs.toFixed( 1 ) } ms` );
	console.log( `④ 2nd RAF: ${ boundaries.secondAnimationFrameMs.toFixed( 1 ) } ms` );

	return {
		clientId: block.clientId,
		dispatchReturnMs,
		eventLoopReturnMs: boundaries.eventLoopReturnMs,
		firstAnimationFrameMs: boundaries.firstAnimationFrameMs,
		fromIndex,
		pocRevision: RAW_ROW_POC_REVISION,
		rowCount: body.length,
		secondAnimationFrameMs: boundaries.secondAnimationFrameMs,
		toIndex,
	};
};

/**
 * 実Editor画面にRaw Console再現専用の固定ボタンを追加する。
 *
 * ButtonはReorder ModeのToolbarやReact接続境界には所属せず、最後に明示選択されたCore Tableを対象にする。
 * 一時的な非選択では対象を失わず、別Blockを明示選択した場合は対象を解除する。
 */
export const registerRawRowCommitPoCButton = (): void => {
	if ( document.getElementById( RAW_ROW_BUTTON_ID ) ) {
		return;
	}

	const data = getWordPressData();
	synchronizeTrackedCoreTable();

	if ( unsubscribeSelectionTracking === null ) {
		unsubscribeSelectionTracking = data.subscribe( synchronizeTrackedCoreTable );
	}

	const button = document.createElement( 'button' );
	button.id = RAW_ROW_BUTTON_ID;
	button.type = 'button';
	button.textContent = `PoC ${ RAW_ROW_POC_REVISION }: Raw Row 0→50`;
	button.style.position = 'fixed';
	button.style.right = '16px';
	button.style.bottom = '16px';
	button.style.zIndex = '100000';
	button.style.padding = '8px 12px';
	button.style.border = '1px solid currentColor';
	button.style.borderRadius = '4px';
	button.style.background = 'Canvas';
	button.style.color = 'CanvasText';
	button.style.cursor = 'pointer';

	/*
	 * 固定PoCボタンへfocusを移さず、クリック直前までWordPress側の選択状態を変化させない。
	 * Raw commit開始後のclearSelectedBlock()だけを意図した選択解除として扱う。
	 */
	button.addEventListener( 'pointerdown', ( event ) => {
		event.preventDefault();
	} );

	button.addEventListener( 'click', () => {
		button.disabled = true;

		runRawRowCommitPoC()
			.then( ( result ) => {
				console.log( `✅ Raw Row commit PoC ${ RAW_ROW_POC_REVISION } result`, result );
			} )
			.catch( ( error: unknown ) => {
				console.error( `❌ Raw Row commit PoC ${ RAW_ROW_POC_REVISION } failed`, error );
			} )
			.finally( () => {
				button.disabled = false;
			} );
	} );

	document.body.appendChild( button );
	console.log( `🧪 Raw Row commit PoC ${ RAW_ROW_POC_REVISION } registered` );
};
