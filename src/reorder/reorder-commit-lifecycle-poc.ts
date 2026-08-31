/**
 * #714の第2段階PoCとして、Reorder Modeを維持したままTable選択解除、属性更新、必要時だけの再選択を行う。
 *
 * 正式なRow / Column Data UpdateやDnD状態は所有せず、実Editorでcommit前後のBlock選択ライフサイクルと
 * Reorder Modeの分離を検証するための一時的な入口だけを提供する。
 */

import { reorderModeIntegration, type ReorderKind } from './reorder-mode';

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

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
	reselectionDispatchMs: number | null;
	selectionOutcome: ReorderCommitSelectionOutcome;
	updateDispatchMs: number;
};

/** DevToolsから第2段階PoCを実行するための一時API。 */
export type ReorderCommitPoCApi = {
	/**
	 * 選択中Tableの行を移動し、#714のcommitライフサイクルを実行する。
	 *
	 * @param fromIndex 移動する行の0-based位置。
	 * @param toIndex   移動後の行の0-based位置。
	 * @return commitと再選択判断の計測結果。
	 */
	row: ( fromIndex: number, toIndex: number ) => Promise< ReorderCommitPoCResult >;
	/**
	 * 選択中Tableの列を移動し、#714のcommitライフサイクルを実行する。
	 *
	 * @param fromIndex 移動する列の0-based位置。
	 * @param toIndex   移動後の列の0-based位置。
	 * @return commitと再選択判断の計測結果。
	 */
	column: ( fromIndex: number, toIndex: number ) => Promise< ReorderCommitPoCResult >;
	/**
	 * 対象TableがPoCのcommit処理中か確認する。
	 *
	 * @param clientId 確認するTable BlockのclientId。
	 * @return commit処理中の場合はtrue。それ以外はfalse。
	 */
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

	const body = moveItem( attributes.body, fromIndex, toIndex );
	return { body };
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

		const cells = moveItem( row.cells, fromIndex, toIndex );
		return { ...row, cells };
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

	const block = selector.getBlock( selectedClientId );
	const supportedTableSelected = block !== null && SUPPORTED_TABLE_BLOCKS.has( block.name );

	if ( ! supportedTableSelected || ! block ) {
		throw new Error( 'Reorder commit PoC requires a supported Table Block.' );
	}

	if ( ! reorderModeIntegration.isSelected( kind, selectedClientId ) ) {
		throw new Error( 'Reorder commit PoC requires the matching Reorder Mode.' );
	}

	return block;
};

/**
 * #714で検証する一時選択解除、属性更新、現在状態に応じた再選択を実行する。
 *
 * commit処理中は同じTableのPoC commitを重ねて開始させず、Reorder Mode自体は変更しない。
 * 更新後は現在のBlock選択と開始時と同じReorder Modeが維持されているかを確認し、
 * 選択Blockがない場合だけ対象Tableを再選択する。
 *
 * @param kind       実行する並び替え方向。
 * @param attributes `updateBlockAttributes()`へ1回だけ渡す属性差分。
 * @param clientId   commit対象TableのclientId。
 * @return commitと再選択判断の計測結果。
 */
const runCommitLifecycle = async (
	kind: ReorderKind,
	attributes: Partial< TableAttributes >,
	clientId: string
): Promise< ReorderCommitPoCResult > => {
	if ( committingTableClientId !== null ) {
		throw new Error( 'Reorder commit PoC does not allow another commit while one is active.' );
	}

	const data = getWordPressData();
	const selector = data.select( BLOCK_EDITOR_STORE );
	const actions = data.dispatch( BLOCK_EDITOR_STORE );
	committingTableClientId = clientId;

	try {
		actions.clearSelectedBlock();

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
			reselectionDispatchMs,
			selectionOutcome,
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
export const isReorderCommitInProgressPoC = ( clientId: string ): boolean => {
	const inProgress = committingTableClientId === clientId;
	return inProgress;
};

/**
 * 選択中Tableの行移動で第2段階PoCを実行する。
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
	const result = await runCommitLifecycle( 'row', update, block.clientId );
	return result;
};

/**
 * 選択中Tableの列移動で第2段階PoCを実行する。
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
	const result = await runCommitLifecycle( 'column', update, block.clientId );
	return result;
};

/**
 * 実WordPress EditorのDevToolsから第2段階PoCを実行できる一時APIを登録する。
 */
export const registerReorderCommitLifecyclePoC = (): void => {
	const editorWindow = window as ReorderCommitPoCWindow;

	editorWindow.ytrReorderCommitPoC = {
		row: runRowReorderCommitPoC,
		column: runColumnReorderCommitPoC,
		isCommitting: isReorderCommitInProgressPoC,
	};
};
