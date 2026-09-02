/**
 * dnd-kitを既存Table行へ接続し、実DOM順序を変更しないDnDが成立するか検証するPoCを所有する。
 *
 * 行順の確定やTableデータ更新は行わず、既存の`tr`をDnD対象として利用できること、
 * DnD Lifecycle、Auto Scroll、およびDnD中の`tbody`子要素変更有無だけを観測する。
 */

import { Draggable, DragDropManager, Droppable, Feedback } from '@dnd-kit/dom';

/** dnd-kit上でYTRの行PoCだけを相互に受け入れる識別種別。 */
const ROW_DND_TYPE = 'ytr-row-dnd-kit-poc';

/** activeなDnD中にPoCが観測する診断情報。 */
type ActiveDragObservation = {
	domOrderChanged: boolean;
	moveCount: number;
	observer: MutationObserver;
	startedAt: number;
};

/**
 * 基準要素が所有する現在Tableの`tbody`を解決する。
 *
 * @param referenceElement 対応Table Blockの現在の基準要素。
 * @return 現在Tableの`tbody`。Tableまたは`tbody`が存在しなければnull。
 */
const resolveTableBody = ( referenceElement: HTMLElement ) => {
	const table = referenceElement.querySelector( 'table' );
	const tableBody = table?.tBodies.item( 0 ) ?? null;

	return tableBody;
};

/**
 * 対象`tbody`が直接所有する行だけをDnD対象として取得する。
 *
 * @param tableBody 現在Tableの`tbody`。
 * @return 対象`tbody`直下の行。
 */
const getDirectRows = ( tableBody: HTMLTableSectionElement ) => {
	const directRows = Array.from( tableBody.rows ).filter(
		( row ) => row.parentElement === tableBody
	);

	return directRows;
};

/**
 * dnd-kitによる行DnD PoCを現在のTableへ接続する。
 *
 * `Sortable`は使用せず、既存の各`tr`をDraggableとDroppableへ登録する。
 * Feedbackは無効化し、DnD中にTable DOMの行順を変更しない状態でLifecycleとAuto Scrollを検証する。
 *
 * @param tableIdentity    PoC対象TableのIdentity。
 * @param referenceElement PoC対象Tableを所有する現在のBlock wrapper。
 * @return PoCを終了してdnd-kitの登録と監視を破棄する関数。現在DOMから検証対象を解決できなければnull。
 */
export const connectDndKitRowPoc = (
	tableIdentity: string,
	referenceElement: HTMLElement
): ( () => void ) | null => {
	const editorWindow = referenceElement.ownerDocument.defaultView;

	console.info( '[YTR PoC debug] connect', {
		referenceElement,
		tableIdentity,
	} );

	const tableBody = resolveTableBody( referenceElement );

	/* 現在のEditor DOM上でTable行を安全に扱えない場合はPoCを開始しない。 */
	if ( ! editorWindow || ! referenceElement.isConnected || ! tableBody ) {
		return null;
	}

	const rows = getDirectRows( tableBody );

	/* 行間DnDを観測できるTableだけをPoC対象とする。 */
	if ( rows.length < 2 ) {
		return null;
	}

	const manager = new DragDropManager();

	/*
	 * 実Tableの行をそのままDnD対象として登録し、別の表示用DOMや並び替え用DOMを生成しない。
	 */
	rows.forEach( ( row, rowIndex ) => {
		const data = { rowIndex, tableIdentity };

		new Draggable(
			{
				data,
				element: row,
				id: `ytr-row-source:${ tableIdentity }:${ rowIndex }`,
				plugins: [ Feedback.configure( { feedback: 'none' } ) ],
				type: ROW_DND_TYPE,
			},
			manager
		);
		new Droppable(
			{
				accept: ROW_DND_TYPE,
				data,
				element: row,
				id: `ytr-row-target:${ tableIdentity }:${ rowIndex }`,
			},
			manager
		);
	} );

	let activeObservation: ActiveDragObservation | null = null;
	let lastTargetId: string | number | null = null;

	manager.monitor.addEventListener( 'dragstart', ( event ) => {
		const observer = new editorWindow.MutationObserver( ( records ) => {
			const childListChanged = records.some( ( record ) => record.type === 'childList' );

			if ( activeObservation && childListChanged ) {
				activeObservation.domOrderChanged = true;
			}
		} );

		activeObservation = {
			domOrderChanged: false,
			moveCount: 0,
			observer,
			startedAt: editorWindow.performance.now(),
		};
		lastTargetId = null;
		observer.observe( tableBody, { childList: true } );

		editorWindow.console.info( '[YTR dnd-kit PoC] dragstart', {
			rowCount: rows.length,
			sourceId: event.operation.source?.id ?? null,
			tableIdentity,
		} );
	} );

	manager.monitor.addEventListener( 'dragmove', () => {
		if ( activeObservation ) {
			activeObservation.moveCount += 1;
		}
	} );

	manager.monitor.addEventListener( 'dragover', ( event ) => {
		const targetId = event.operation.target?.id ?? null;

		/* 同じ移動先への連続通知は記録せず、移動先が変化したことだけを観測する。 */
		if ( targetId === lastTargetId ) {
			return;
		}

		lastTargetId = targetId;
		editorWindow.console.info( '[YTR dnd-kit PoC] dragover', {
			targetId,
			tableIdentity,
		} );
	} );

	manager.monitor.addEventListener( 'dragend', ( event ) => {
		const observation = activeObservation;

		if ( ! observation ) {
			return;
		}

		const pendingRecords = observation.observer.takeRecords();
		const pendingChildListChange = pendingRecords.some( ( record ) => record.type === 'childList' );
		observation.domOrderChanged ||= pendingChildListChange;
		observation.observer.disconnect();

		editorWindow.console.info( '[YTR dnd-kit PoC] dragend', {
			canceled: event.canceled,
			domOrderChanged: observation.domOrderChanged,
			durationMs: editorWindow.performance.now() - observation.startedAt,
			moveCount: observation.moveCount,
			sourceId: event.operation.source?.id ?? null,
			tableIdentity,
			targetId: event.operation.target?.id ?? null,
		} );

		activeObservation = null;
		lastTargetId = null;
	} );

	editorWindow.console.info( '[YTR dnd-kit PoC] ready', {
		rowCount: rows.length,
		tableIdentity,
	} );

	return () => {
		activeObservation?.observer.disconnect();
		activeObservation = null;
		manager.destroy();
		editorWindow.console.info( '[YTR dnd-kit PoC] disposed', { tableIdentity } );
	};
};
