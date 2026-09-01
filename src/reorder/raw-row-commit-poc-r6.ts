/* eslint-disable no-console */
/**
 * Raw Row commitの性能計測で、WordPress Dataの常時購読を持たない比較用PoCを所有する。
 *
 * Core TableのRow `0 → 50`について、実行時に選択中Tableを1回だけ確定し、
 * `nextBody`生成 → Table選択解除 → 2回の描画境界待機 → 属性更新 → 各実行境界とLong Task計測を行う。
 * Reorder Mode、DnD、編集抑止、commit後のTable再選択、WordPress Dataの常時購読には依存しない。
 */

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

/** PoC対象のCore Table Block名。 */
const CORE_TABLE_BLOCK = 'core/table';

/** 固定PoCボタンのDOM id。 */
const RAW_ROW_BUTTON_ID = 'ytr-raw-row-commit-poc-r6';

/** ログと計測結果へ表示するRaw Row PoCのリビジョン。 */
const RAW_ROW_POC_REVISION = 'r6';

/** 比較計測に用いる移動元Row。 */
const RAW_ROW_FROM_INDEX = 0;

/** 比較計測に用いる移動先Row。 */
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

/** Raw Row PoCで利用するBlock Editor selector。 */
type BlockEditorSelector = {
	getBlock: ( clientId: string ) => BlockRecord | null;
	getSelectedBlockClientId: () => string | null;
};

/** Raw Row PoCで利用するBlock Editor action。 */
type BlockEditorDispatch = {
	clearSelectedBlock: () => void;
	updateBlockAttributes: ( clientId: string, attributes: Partial< CoreTableAttributes > ) => void;
};

/** Raw Row PoCが利用するWordPress Data API。 */
type WordPressData = {
	dispatch: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorDispatch;
	select: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorSelector;
};

/** PoCが参照するEditor window。 */
type RawRowPoCWindow = Window &
	typeof globalThis & {
		wp?: {
			data?: WordPressData;
		};
	};

/** commit計測区間と重なったLong Taskの記録。 */
type RawRowLongTask = {
	durationMs: number;
	endOffsetMs: number;
	name: string;
	startOffsetMs: number;
};

/** Long Task観測中の一時状態。 */
type LongTaskObservation = {
	entries: PerformanceEntry[];
	observer: PerformanceObserver | null;
	supported: boolean;
};

/** Raw Row r6の計測結果。 */
export type RawRowCommitPoCR6Result = {
	clientId: string;
	dispatchReturnMs: number;
	eventLoopReturnMs: number;
	firstAnimationFrameMs: number;
	fromIndex: number;
	longTaskMaxDurationMs: number;
	longTaskSupported: boolean;
	longTaskTotalDurationMs: number;
	longTasks: RawRowLongTask[];
	microtaskReturnMs: number;
	pocRevision: string;
	rowCount: number;
	secondAnimationFrameMs: number;
	toIndex: number;
};

/**
 * 現在のWordPress Data APIを取得する。
 *
 * @return Raw Row PoCに必要なData API。
 */
const getWordPressData = (): WordPressData => {
	const editorWindow = window as RawRowPoCWindow;
	const data = editorWindow.wp?.data;

	if ( ! data ) {
		throw new Error( 'Raw Row commit PoC r6 requires the WordPress Data API.' );
	}

	return data;
};

/**
 * PoC実行時に選択中のCore Tableを1回だけ確定する。
 *
 * 実行前の選択状態だけを対象決定に利用し、WordPress Dataの変更通知は購読しない。
 *
 * @return 現在選択中のCore Table。
 */
const getSelectedCoreTable = (): BlockRecord => {
	const data = getWordPressData();
	const selector = data.select( BLOCK_EDITOR_STORE );
	const selectedClientId = selector.getSelectedBlockClientId();

	if ( selectedClientId === null ) {
		throw new Error( 'Raw Row commit PoC r6 requires a selected Core Table.' );
	}

	const block = selector.getBlock( selectedClientId );

	if ( ! block || block.name !== CORE_TABLE_BLOCK ) {
		throw new Error( 'Raw Row commit PoC r6 requires a selected Core Table.' );
	}

	return block;
};

/**
 * 既存Row参照を維持したままRow順を変更する。
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
		throw new Error( 'Raw Row commit PoC r6 requires valid row indices.' );
	}

	const nextBody = [ ...body ];
	const [ movedRow ] = nextBody.splice( fromIndex, 1 );

	if ( ! movedRow ) {
		throw new Error( 'Raw Row commit PoC r6 could not resolve the requested row.' );
	}

	nextBody.splice( toIndex, 0, movedRow );
	return nextBody;
};

/**
 * Table選択解除による描画をr5と同じく2フレーム待つ。
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
 * PerformanceObserverの通知を受け取るため、次のevent loopまで待つ。
 *
 * @return 次のevent loopで解決するPromise。
 */
const waitOneEventLoopTurn = (): Promise< void > =>
	new Promise( ( resolve ) => {
		window.setTimeout( resolve, 0 );
	} );

/**
 * commitを含む処理がメインスレッドを長時間占有しているか観測する。
 *
 * @return Long Task観測状態。
 */
const startLongTaskObservation = (): LongTaskObservation => {
	const supported =
		typeof PerformanceObserver !== 'undefined' &&
		PerformanceObserver.supportedEntryTypes.includes( 'longtask' );

	if ( ! supported ) {
		return {
			entries: [],
			observer: null,
			supported: false,
		};
	}

	const entries: PerformanceEntry[] = [];
	const observer = new PerformanceObserver( ( list ) => {
		entries.push( ...list.getEntries() );
	} );
	observer.observe( { type: 'longtask', buffered: true } );

	return {
		entries,
		observer,
		supported: true,
	};
};

/**
 * Long Task観測を終了し、今回のcommit計測区間と重なるTaskを確定する。
 *
 * @param observation Long Task観測状態。
 * @param startedAt   `updateBlockAttributes()`直前の計測開始時刻。
 * @param endedAt     2回目の描画境界を通過した計測終了時刻。
 * @return 今回の計測区間と重なったLong Task。
 */
const finishLongTaskObservation = async (
	observation: LongTaskObservation,
	startedAt: number,
	endedAt: number
): Promise< RawRowLongTask[] > => {
	if ( ! observation.observer ) {
		return [];
	}

	await waitOneEventLoopTurn();
	observation.entries.push( ...observation.observer.takeRecords() );
	observation.observer.disconnect();

	const measuredEntries = observation.entries.filter( ( entry ) => {
		const entryEnd = entry.startTime + entry.duration;
		const overlapsMeasuredRange = entryEnd >= startedAt && entry.startTime <= endedAt;
		return entry.entryType === 'longtask' && overlapsMeasuredRange;
	} );

	return measuredEntries.map( ( entry ) => ( {
		durationMs: entry.duration,
		endOffsetMs: entry.startTime + entry.duration - startedAt,
		name: entry.name,
		startOffsetMs: entry.startTime - startedAt,
	} ) );
};

/**
 * 属性更新後のmicrotask / event loop / 1st RAF / 2nd RAF復帰を同じ起点から計測する。
 *
 * @param startedAt `updateBlockAttributes()`直前の計測開始時刻。
 * @return 各境界の経過時間。
 */
const measurePostCommitBoundaries = (
	startedAt: number
): Promise<
	Pick<
		RawRowCommitPoCR6Result,
		'microtaskReturnMs' | 'eventLoopReturnMs' | 'firstAnimationFrameMs' | 'secondAnimationFrameMs'
	>
> =>
	new Promise( ( resolve ) => {
		let microtaskReturnMs: number | null = null;
		let eventLoopReturnMs: number | null = null;
		let firstAnimationFrameMs: number | null = null;
		let secondAnimationFrameMs: number | null = null;

		const finishIfComplete = () => {
			if (
				microtaskReturnMs !== null &&
				eventLoopReturnMs !== null &&
				firstAnimationFrameMs !== null &&
				secondAnimationFrameMs !== null
			) {
				resolve( {
					microtaskReturnMs,
					eventLoopReturnMs,
					firstAnimationFrameMs,
					secondAnimationFrameMs,
				} );
			}
		};

		window.queueMicrotask( () => {
			microtaskReturnMs = performance.now() - startedAt;
			finishIfComplete();
		} );

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
 * WordPress Dataの常時購読を持たず、r5と同じcommit計測を実行する。
 *
 * @param fromIndex 移動元の0-based位置。
 * @param toIndex   移動先の0-based位置。
 * @return 各実行境界とLong Taskの計測結果。
 */
export const runRawRowCommitPoCR6 = async (
	fromIndex = RAW_ROW_FROM_INDEX,
	toIndex = RAW_ROW_TO_INDEX
): Promise< RawRowCommitPoCR6Result > => {
	const block = getSelectedCoreTable();
	const body = block.attributes.body;

	if ( ! Array.isArray( body ) ) {
		throw new Error( 'Raw Row commit PoC r6 requires Core Table body rows.' );
	}

	const nextBody = moveRow( body, fromIndex, toIndex );
	const data = getWordPressData();
	const actions = data.dispatch( BLOCK_EDITOR_STORE );

	console.log( `🧪 Raw Row commit PoC ${ RAW_ROW_POC_REVISION }` );
	console.log( `行数: ${ body.length }` );
	console.log( `🚀 Raw選択解除後 commit: ${ fromIndex } → ${ toIndex }` );
	console.log( '📌 WordPress Data常時購読: なし' );

	actions.clearSelectedBlock();
	await waitTwoAnimationFrames();

	const longTaskObservation = startLongTaskObservation();
	const startedAt = performance.now();
	actions.updateBlockAttributes( block.clientId, { body: nextBody } );
	const dispatchReturnMs = performance.now() - startedAt;
	const boundariesPromise = measurePostCommitBoundaries( startedAt );
	console.log( `① dispatch復帰: ${ dispatchReturnMs.toFixed( 1 ) } ms` );

	const boundaries = await boundariesPromise;
	const observationEndedAt = performance.now();
	const longTasks = await finishLongTaskObservation(
		longTaskObservation,
		startedAt,
		observationEndedAt
	);
	const longTaskTotalDurationMs = longTasks.reduce( ( total, task ) => total + task.durationMs, 0 );
	const longTaskMaxDurationMs = longTasks.reduce(
		( maximum, task ) => Math.max( maximum, task.durationMs ),
		0
	);

	console.log( `② microtask復帰: ${ boundaries.microtaskReturnMs.toFixed( 1 ) } ms` );
	console.log( `③ event loop復帰: ${ boundaries.eventLoopReturnMs.toFixed( 1 ) } ms` );
	console.log( `④ 1st RAF: ${ boundaries.firstAnimationFrameMs.toFixed( 1 ) } ms` );
	console.log( `⑤ 2nd RAF: ${ boundaries.secondAnimationFrameMs.toFixed( 1 ) } ms` );

	if ( longTaskObservation.supported ) {
		console.log(
			`⑥ Long Task: ${ longTasks.length }件 / total ${ longTaskTotalDurationMs.toFixed(
				1
			) } ms / max ${ longTaskMaxDurationMs.toFixed( 1 ) } ms`,
			longTasks
		);
	} else {
		console.log( '⑥ Long Task: unsupported' );
	}

	return {
		clientId: block.clientId,
		dispatchReturnMs,
		eventLoopReturnMs: boundaries.eventLoopReturnMs,
		firstAnimationFrameMs: boundaries.firstAnimationFrameMs,
		fromIndex,
		longTaskMaxDurationMs,
		longTaskSupported: longTaskObservation.supported,
		longTaskTotalDurationMs,
		longTasks,
		microtaskReturnMs: boundaries.microtaskReturnMs,
		pocRevision: RAW_ROW_POC_REVISION,
		rowCount: body.length,
		secondAnimationFrameMs: boundaries.secondAnimationFrameMs,
		toIndex,
	};
};

/**
 * 実Editor画面にr6の固定ボタンを追加する。
 *
 * ButtonはWordPress Dataを常時購読せず、クリック時に選択中のCore Tableだけを対象にする。
 */
export const registerRawRowCommitPoCR6Button = (): void => {
	if ( document.getElementById( RAW_ROW_BUTTON_ID ) ) {
		return;
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
	 * 固定PoCボタンへfocusを移さず、クリック時までWordPress側のTable選択を維持する。
	 * r6では選択追跡を購読しないため、実行対象はクリック時の選択だけで確定する。
	 */
	button.addEventListener( 'pointerdown', ( event ) => {
		event.preventDefault();
	} );

	button.addEventListener( 'click', () => {
		button.disabled = true;

		runRawRowCommitPoCR6()
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
