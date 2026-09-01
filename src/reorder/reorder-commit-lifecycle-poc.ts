/**
 * #714の第2段階PoCとして、Reorder Modeを維持したままTable選択状態とcommit性能の関係を比較する。
 *
 * 正式なRow / Column Data UpdateやDnD状態は所有せず、実Editorで選択解除あり / なしのcommitを
 * 同じ計測境界で比較し、必要な場合だけ再選択する一時的な入口だけを提供する。
 */

import { reorderModeIntegration, type ReorderKind } from './reorder-mode';

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

/** Lifecycle PoCの計測結果とDevTools APIを識別するリビジョン。 */
const REORDER_COMMIT_POC_REVISION = 'lifecycle-r1';

/** PoCで直接更新対象とする対応Table Block名。 */
const SUPPORTED_TABLE_BLOCKS = new Set( [ 'core/table', 'flexible-table-block/table' ] );

/** Table CellのPoC向け最小表現。 */
type TableCell = Record< string, unknown >;

/** Table RowのPoC向け最小表現。 */
type TableRow = Record< string, unknown > & {
	cells: TableCell[];
};

/** Row / ColumnのPoC commitで参照するTable属性。 */
type TableAttributes = Record< string, unknown > & {
	body?: TableRow[];
	foot?: TableRow[];
	head?: TableRow[];
};

/** WordPress Block Editorから取得するBlockのPoC向け最小表現。 */
type BlockRecord = {
	attributes: TableAttributes;
	clientId: string;
	name: string;
};

/** Block選択とBlock取得に必要なWordPress selector。 */
type BlockEditorSelector = {
	getBlock: ( clientId: string ) => BlockRecord | null;
	getSelectedBlockClientId: () => string | null;
};

/** 一時選択解除、属性更新、再選択に必要なWordPress action。 */
type BlockEditorDispatch = {
	clearSelectedBlock: () => void;
	selectBlock: ( clientId: string, initialPosition?: number | null ) => void;
	updateBlockAttributes: ( clientId: string, attributes: Partial< TableAttributes > ) => void;
};

/** PoCが利用するWordPress Data APIの最小境界。 */
type WordPressData = {
	dispatch: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorDispatch;
	select: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorSelector;
};

/** A/B比較でcommit直前のTable選択をどう扱ったかを表す。 */
export type ReorderCommitSelectionStrategy = 'clear-before-commit' | 'keep-selected';

/** commit後の選択判定結果。 */
export type ReorderCommitSelectionOutcome =
	| 'reselected-table'
	| 'table-already-selected'
	| 'user-selection-preserved'
	| 'reorder-mode-ended';

/** 実Editorで性能と選択ライフサイクルを確認するためのPoC結果。 */
export type ReorderCommitPoCResult = {
	clientId: string;
	kind: ReorderKind;
	observationBoundaryMs: number;
	pocRevision: string;
	reselectionDispatchMs: number | null;
	selectionOutcome: ReorderCommitSelectionOutcome;
	selectionStrategy: ReorderCommitSelectionStrategy;
	updateDispatchMs: number;
};

/** DevToolsから第2段階PoCを実行するための一時API。 */
export type ReorderCommitPoCApi = {
	/** Lifecycle PoCのリビジョン。 */
	revision: string;
	/** 選択解除ありでRow commitを計測する。 */
	row: ( fromIndex: number, toIndex: number ) => Promise< ReorderCommitPoCResult >;
	/** clientIdを明示して選択解除ありのRow commitを計測する。 */
	rowByClientId: (
		clientId: string,
		fromIndex: number,
		toIndex: number
	) => Promise< ReorderCommitPoCResult >;
	/** 選択解除なしでRow commitを計測する。 */
	rowWithoutClear: ( fromIndex: number, toIndex: number ) => Promise< ReorderCommitPoCResult >;
	/** clientIdを明示して選択解除なしのRow commitを計測する。 */
	rowWithoutClearByClientId: (
		clientId: string,
		fromIndex: number,
		toIndex: number
	) => Promise< ReorderCommitPoCResult >;
	/** 選択解除ありでColumn commitを計測する。 */
	column: ( fromIndex: number, toIndex: number ) => Promise< ReorderCommitPoCResult >;
	/** 選択解除なしでColumn commitを計測する。 */
	columnWithoutClear: ( fromIndex: number, toIndex: number ) => Promise< ReorderCommitPoCResult >;
	/** 対象TableがPoCのcommit処理中か確認する。 */
	isCommitting: ( clientId: string ) => boolean;
};

/** PoC APIを追加したEditor window。 */
type ReorderCommitPoCWindow = Window &
	typeof globalThis & {
		wp?: {
			data?: WordPressData;
		};
		ytrReorderCommitPoC?: ReorderCommitPoCApi;
	};

/** commit処理中のTableをReorder Modeとは独立して保持するPoC状態。 */
let committingTableClientId: string | null = null;

/**
 * 現在のWordPress Data APIを取得する。
 *
 * @return Block Editorの選択と属性更新に利用するData API。
 */
const getWordPressData = (): WordPressData => {
	const editorWindow = window as ReorderCommitPoCWindow;
	const data = editorWindow.wp?.data;

	if ( ! data ) {
		throw new Error( 'Reorder commit PoC requires the WordPress Data API.' );
	}

	return data;
};

/**
 * 配列内の1要素を指定した最終位置へ移動する。
 *
 * @param items     並び順を変更する配列。
 * @param fromIndex 移動対象の0-based位置。
 * @param toIndex   移動後の0-based位置。
 * @return 元の要素参照を維持した新しい配列。
 */
const moveItem = < T >( items: T[], fromIndex: number, toIndex: number ): T[] => {
	const indicesAreValid =
		Number.isInteger( fromIndex ) &&
		Number.isInteger( toIndex ) &&
		fromIndex >= 0 &&
		toIndex >= 0 &&
		fromIndex < items.length &&
		toIndex < items.length;

	if ( ! indicesAreValid ) {
		throw new Error( 'Reorder commit PoC requires valid source and destination indices.' );
	}

	const nextItems = [ ...items ];
	const [ movedItem ] = nextItems.splice( fromIndex, 1 );

	if ( movedItem === undefined ) {
		throw new Error( 'Reorder commit PoC could not resolve the requested item.' );
	}

	nextItems.splice( toIndex, 0, movedItem );
	return nextItems;
};

/**
 * 行移動を1回のBlock属性更新へ渡せる形にする。
 *
 * @param attributes 現在のTable属性。
 * @param fromIndex  移動する行の0-based位置。
 * @param toIndex    移動後の行の0-based位置。
 * @return `tbody`の行順だけを変更する属性差分。
 */
const createRowUpdate = (
	attributes: TableAttributes,
	fromIndex: number,
	toIndex: number
): Partial< TableAttributes > => {
	if ( ! Array.isArray( attributes.body ) ) {
		throw new Error( 'Reorder commit PoC requires Table body rows.' );
	}

	return { body: moveItem( attributes.body, fromIndex, toIndex ) };
};

/**
 * 一つのTable sectionについて、全行の同じ列位置を移動する。
 *
 * @param rows      section内の現在行。
 * @param fromIndex 移動する列の0-based位置。
 * @param toIndex   移動後の列の0-based位置。
 * @return 各行のCell順だけを変更した新しい行配列。
 */
const moveColumnInRows = ( rows: TableRow[], fromIndex: number, toIndex: number ): TableRow[] =>
	rows.map( ( row ) => {
		if ( ! Array.isArray( row.cells ) ) {
			throw new Error( 'Reorder commit PoC requires Table row cells.' );
		}

		return { ...row, cells: moveItem( row.cells, fromIndex, toIndex ) };
	} );

/**
 * 列移動を1回のBlock属性更新へ渡せる形にする。
 *
 * @param attributes 現在のTable属性。
 * @param fromIndex  移動する列の0-based位置。
 * @param toIndex    移動後の列の0-based位置。
 * @return 存在するTable section全体で同じ列位置だけを変更する属性差分。
 */
const createColumnUpdate = (
	attributes: TableAttributes,
	fromIndex: number,
	toIndex: number
): Partial< TableAttributes > => {
	if ( ! Array.isArray( attributes.body ) || attributes.body.length === 0 ) {
		throw new Error( 'Reorder commit PoC requires Table body rows.' );
	}

	const update: Partial< TableAttributes > = {
		body: moveColumnInRows( attributes.body, fromIndex, toIndex ),
	};

	if ( Array.isArray( attributes.head ) ) {
		update.head = moveColumnInRows( attributes.head, fromIndex, toIndex );
	}

	if ( Array.isArray( attributes.foot ) ) {
		update.foot = moveColumnInRows( attributes.foot, fromIndex, toIndex );
	}

	return update;
};

/**
 * `updateBlockAttributes()`後の描画と、その間の利用者操作がEditor状態へ反映される機会を作る。
 *
 * 固定時間は設けず、ブラウザの描画境界を2回通過した後に現在のBlock選択とReorder Modeを再確認する。
 *
 * @return 再選択可否を判定できる次の観測境界まで待つPromise。
 */
const waitForObservationBoundary = (): Promise< void > =>
	new Promise( ( resolve ) => {
		window.requestAnimationFrame( () => {
			window.requestAnimationFrame( () => resolve() );
		} );
	} );

/**
 * 指定したclientIdの対応TableとReorder ModeをPoCのcommit開始条件として取得する。
 *
 * Block選択状態には依存せず、対象Tableが現在のReorder Mode対象であることだけを要求する。
 *
 * @param kind     実行する並び替え方向。
 * @param clientId commit対象TableのclientId。
 * @return commit対象Table。
 */
const getCommitTargetByClientId = ( kind: ReorderKind, clientId: string ): BlockRecord => {
	const data = getWordPressData();
	const selector = data.select( BLOCK_EDITOR_STORE );
	const block = selector.getBlock( clientId );
	const supportedTable = block !== null && SUPPORTED_TABLE_BLOCKS.has( block.name );

	if ( ! supportedTable || ! block ) {
		throw new Error( 'Reorder commit PoC requires a supported Table Block.' );
	}

	if ( ! reorderModeIntegration.isSelected( kind, clientId ) ) {
		throw new Error( 'Reorder commit PoC requires the matching Reorder Mode.' );
	}

	return block;
};

/**
 * 選択中の対応Tableと指定Reorder ModeをPoCのcommit開始条件として取得する。
 *
 * @param kind 実行する並び替え方向。
 * @return commit対象Table。
 */
const getCommitTarget = ( kind: ReorderKind ): BlockRecord => {
	const data = getWordPressData();
	const selector = data.select( BLOCK_EDITOR_STORE );
	const selectedClientId = selector.getSelectedBlockClientId();

	if ( ! selectedClientId ) {
		throw new Error( 'Reorder commit PoC requires a selected Table.' );
	}

	return getCommitTargetByClientId( kind, selectedClientId );
};

/**
 * #714で比較する属性更新と現在状態に応じた再選択を実行する。
 *
 * A/B差分はcommit直前にTable選択を解除するかどうかだけとする。属性更新と2回の描画境界、
 * その後のBlock選択 / Reorder Mode判定は同じ経路を通す。選択解除ありの場合でもReorder Mode自体は変更しない。
 *
 * @param kind              実行する並び替え方向。
 * @param attributes        `updateBlockAttributes()`へ1回だけ渡す属性差分。
 * @param clientId          commit対象TableのclientId。
 * @param selectionStrategy commit直前のTable選択を解除するかどうか。
 * @return commitと再選択判断の計測結果。
 */
const runCommitLifecycle = async (
	kind: ReorderKind,
	attributes: Partial< TableAttributes >,
	clientId: string,
	selectionStrategy: ReorderCommitSelectionStrategy
): Promise< ReorderCommitPoCResult > => {
	if ( committingTableClientId !== null ) {
		throw new Error( 'Reorder commit PoC does not allow another commit while one is active.' );
	}

	const data = getWordPressData();
	const selector = data.select( BLOCK_EDITOR_STORE );
	const actions = data.dispatch( BLOCK_EDITOR_STORE );
	committingTableClientId = clientId;

	try {
		if ( selectionStrategy === 'clear-before-commit' ) {
			actions.clearSelectedBlock();
		}

		const updateStartedAt = performance.now();
		actions.updateBlockAttributes( clientId, attributes );
		const updateDispatchMs = performance.now() - updateStartedAt;

		await waitForObservationBoundary();
		const observationBoundaryMs = performance.now() - updateStartedAt;
		const selectedClientId = selector.getSelectedBlockClientId();
		const sameReorderModeMaintained = reorderModeIntegration.isSelected( kind, clientId );
		let selectionOutcome: ReorderCommitSelectionOutcome;
		let reselectionDispatchMs: number | null = null;

		if ( ! sameReorderModeMaintained ) {
			selectionOutcome = 'reorder-mode-ended';
		} else if ( selectedClientId === null ) {
			const reselectionStartedAt = performance.now();
			actions.selectBlock( clientId, null );
			reselectionDispatchMs = performance.now() - reselectionStartedAt;
			selectionOutcome = 'reselected-table';
		} else if ( selectedClientId === clientId ) {
			selectionOutcome = 'table-already-selected';
		} else {
			selectionOutcome = 'user-selection-preserved';
		}

		return {
			clientId,
			kind,
			observationBoundaryMs,
			pocRevision: REORDER_COMMIT_POC_REVISION,
			reselectionDispatchMs,
			selectionOutcome,
			selectionStrategy,
			updateDispatchMs,
		};
	} finally {
		committingTableClientId = null;
	}
};

/**
 * 対象Tableが第2段階PoCのcommit処理中か確認する。
 *
 * この一時状態はReorder Modeには含めず、Data Update反映中に次の操作開始を抑止するための状態として分離する。
 *
 * @param clientId 確認するTable BlockのclientId。
 * @return 対象Tableがcommit処理中の場合はtrue。それ以外はfalse。
 */
export const isReorderCommitInProgressPoC = ( clientId: string ): boolean =>
	committingTableClientId === clientId;

/**
 * 選択解除ありでRow commitを実行する。
 *
 * @param fromIndex 移動する行の0-based位置。
 * @param toIndex   移動後の行の0-based位置。
 * @return commitと再選択判断の計測結果。
 */
export const runRowReorderCommitPoC = async (
	fromIndex: number,
	toIndex: number
): Promise< ReorderCommitPoCResult > => {
	const block = getCommitTarget( 'row' );
	const update = createRowUpdate( block.attributes, fromIndex, toIndex );
	return runCommitLifecycle( 'row', update, block.clientId, 'clear-before-commit' );
};

/**
 * clientIdを明示して、選択解除ありでRow commitを実行する。
 *
 * DevToolsへfocusが移ってBlock選択が失われても、Reorder Mode対象Tableを直接指定して同じLifecycleを計測する。
 *
 * @param clientId  commit対象TableのclientId。
 * @param fromIndex 移動する行の0-based位置。
 * @param toIndex   移動後の行の0-based位置。
 * @return commitと再選択判断の計測結果。
 */
export const runRowReorderCommitByClientIdPoC = async (
	clientId: string,
	fromIndex: number,
	toIndex: number
): Promise< ReorderCommitPoCResult > => {
	const block = getCommitTargetByClientId( 'row', clientId );
	const update = createRowUpdate( block.attributes, fromIndex, toIndex );
	return runCommitLifecycle( 'row', update, block.clientId, 'clear-before-commit' );
};

/**
 * 選択解除なしでRow commitを実行する比較経路。
 *
 * @param fromIndex 移動する行の0-based位置。
 * @param toIndex   移動後の行の0-based位置。
 * @return commitと現在選択の判定結果。
 */
export const runRowReorderCommitWithoutClearPoC = async (
	fromIndex: number,
	toIndex: number
): Promise< ReorderCommitPoCResult > => {
	const block = getCommitTarget( 'row' );
	const update = createRowUpdate( block.attributes, fromIndex, toIndex );
	return runCommitLifecycle( 'row', update, block.clientId, 'keep-selected' );
};

/**
 * clientIdを明示して、選択解除なしでRow commitを実行する比較経路。
 *
 * @param clientId  commit対象TableのclientId。
 * @param fromIndex 移動する行の0-based位置。
 * @param toIndex   移動後の行の0-based位置。
 * @return commitと現在選択の判定結果。
 */
export const runRowReorderCommitWithoutClearByClientIdPoC = async (
	clientId: string,
	fromIndex: number,
	toIndex: number
): Promise< ReorderCommitPoCResult > => {
	const block = getCommitTargetByClientId( 'row', clientId );
	const update = createRowUpdate( block.attributes, fromIndex, toIndex );
	return runCommitLifecycle( 'row', update, block.clientId, 'keep-selected' );
};

/**
 * 選択解除ありでColumn commitを実行する。
 *
 * @param fromIndex 移動する列の0-based位置。
 * @param toIndex   移動後の列の0-based位置。
 * @return commitと再選択判断の計測結果。
 */
export const runColumnReorderCommitPoC = async (
	fromIndex: number,
	toIndex: number
): Promise< ReorderCommitPoCResult > => {
	const block = getCommitTarget( 'column' );
	const update = createColumnUpdate( block.attributes, fromIndex, toIndex );
	return runCommitLifecycle( 'column', update, block.clientId, 'clear-before-commit' );
};

/**
 * 選択解除なしでColumn commitを実行する比較経路。
 *
 * @param fromIndex 移動する列の0-based位置。
 * @param toIndex   移動後の列の0-based位置。
 * @return commitと現在選択の判定結果。
 */
export const runColumnReorderCommitWithoutClearPoC = async (
	fromIndex: number,
	toIndex: number
): Promise< ReorderCommitPoCResult > => {
	const block = getCommitTarget( 'column' );
	const update = createColumnUpdate( block.attributes, fromIndex, toIndex );
	return runCommitLifecycle( 'column', update, block.clientId, 'keep-selected' );
};

/**
 * 実WordPress EditorのDevToolsから第2段階PoCとA/B比較経路を実行できる一時APIを登録する。
 */
export const registerReorderCommitLifecyclePoC = (): void => {
	const editorWindow = window as ReorderCommitPoCWindow;

	editorWindow.ytrReorderCommitPoC = {
		revision: REORDER_COMMIT_POC_REVISION,
		row: runRowReorderCommitPoC,
		rowByClientId: runRowReorderCommitByClientIdPoC,
		rowWithoutClear: runRowReorderCommitWithoutClearPoC,
		rowWithoutClearByClientId: runRowReorderCommitWithoutClearByClientIdPoC,
		column: runColumnReorderCommitPoC,
		columnWithoutClear: runColumnReorderCommitWithoutClearPoC,
		isCommitting: isReorderCommitInProgressPoC,
	};
};