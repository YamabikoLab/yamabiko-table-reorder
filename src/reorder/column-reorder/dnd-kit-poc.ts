/**
 * dnd-kitを既存Table列へ適用し、実DOM順序を変更しない列DnDが成立するか検証するPoCを所有する。
 *
 * 列順の確定やTableデータ更新、結合セルの論理解決は行わず、既存セルを列DnDの入力・移動先として利用できること、
 * DnD Lifecycle、Auto Scroll、初期登録コスト、およびDnD中のTable子要素変更有無だけを観測する。
 */

import { Draggable, DragDropManager, Droppable, Feedback, PointerSensor } from '@dnd-kit/dom';

/** dnd-kit上でYTRの列PoCだけを相互に受け入れる識別種別。 */
const COLUMN_DND_TYPE = 'ytr-column-dnd-kit-poc';

/** activeなDnD中にPoCが観測する診断情報。 */
type ActiveDragObservation = {
	domOrderChanged: boolean;
	moveCount: number;
	observer: MutationObserver;
	startedAt: number;
};

/**
 * PoC対象Tableの現在Block wrapperをTable Identityから直接解決する。
 *
 * PoCでdnd-kitの成立性を確認するための暫定解決であり、正式なEditor DOM境界としては利用しない。
 *
 * @param tableIdentity PoC対象TableのIdentity。
 * @return 現在のBlock wrapper。解決できなければnull。
 */
const resolveCurrentBlockWrapper = ( tableIdentity: string ): HTMLElement | null => {
	const selector = `[data-block="${ CSS.escape( tableIdentity ) }"]`;
	const topDocument = window.document;
	const topMatch = topDocument.querySelector< HTMLElement >( selector );

	if ( topMatch ) {
		return topMatch;
	}

	for ( const frame of Array.from( topDocument.querySelectorAll( 'iframe' ) ) ) {
		const frameDocument = frame.contentDocument;
		const frameMatch = frameDocument?.querySelector< HTMLElement >( selector ) ?? null;

		if ( frameMatch ) {
			return frameMatch;
		}
	}

	return null;
};

/**
 * PoC対象Tableの通常セルを列DnD対象として取得する。
 *
 * 結合セルの論理列解決はColumn Reorder本実装の責務として扱い、このPoCでは`colSpan === 1`のセルだけを対象とする。
 *
 * @param table PoC対象Table。
 * @return 列DnDへ登録する通常セル。
 */
const getColumnCells = ( table: HTMLTableElement ) => {
	const cells = Array.from( table.rows ).flatMap( ( row ) => Array.from( row.cells ) );
	const columnCells = cells.filter( ( cell ) => cell.colSpan === 1 );

	return columnCells;
};

/**
 * dnd-kitによる列DnD PoCを現在のTableへ接続する。
 *
 * `Sortable`は使用せず、既存の各通常セルをDraggableとDroppableへ登録する。
 * Feedbackは無効化し、DnD中にTable DOMの列順を変更しない状態でLifecycle、Auto Scroll、初期登録コストを検証する。
 *
 * @param tableIdentity PoC対象TableのIdentity。
 * @return PoCを終了してdnd-kitの登録と監視を破棄する関数。現在DOMから検証対象を解決できなければnull。
 */
export const connectDndKitColumnPoc = ( tableIdentity: string ): ( () => void ) | null => {
	const referenceElement = resolveCurrentBlockWrapper( tableIdentity );

	if ( ! referenceElement ) {
		return null;
	}

	const editorWindow = referenceElement.ownerDocument.defaultView;
	const table = referenceElement.querySelector< HTMLTableElement >( 'table' );

	/* 現在のEditor DOM上でTableセルを安全に扱えない場合はPoCを開始しない。 */
	if ( ! editorWindow || ! referenceElement.isConnected || ! table ) {
		return null;
	}

	const cells = getColumnCells( table );

	/* 列間DnDを観測できるTableだけをPoC対象とする。 */
	if ( cells.length < 2 ) {
		return null;
	}

	const manager = new DragDropManager( {
		sensors: [
			PointerSensor.configure( {
				/* PoCではTableセル内部もドラッグ開始対象として扱い、interactive要素判定の影響を除外する。 */
				preventActivation: () => false,
			} ),
		],
	} );
	const registrationStartedAt = editorWindow.performance.now();

	/*
	 * 列を構成する既存セルをDnD対象として登録し、列表示用の代理DOMや並び替え用DOMを生成しない。
	 */
	cells.forEach( ( cell, registrationIndex ) => {
		const row = cell.parentElement as HTMLTableRowElement;
		const rowIndex = row.rowIndex;
		const columnIndex = cell.cellIndex;
		const data = { columnIndex, rowIndex, tableIdentity };

		new Draggable(
			{
				data,
				element: cell,
				id: `ytr-column-source:${ tableIdentity }:${ rowIndex }:${ columnIndex }:${ registrationIndex }`,
				plugins: [ Feedback.configure( { feedback: 'none' } ) ],
				type: COLUMN_DND_TYPE,
			},
			manager
		);
		new Droppable(
			{
				accept: COLUMN_DND_TYPE,
				data,
				element: cell,
				id: `ytr-column-target:${ tableIdentity }:${ rowIndex }:${ columnIndex }:${ registrationIndex }`,
			},
			manager
		);
	} );
	const registrationMs = editorWindow.performance.now() - registrationStartedAt;

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
		observer.observe( table, { childList: true, subtree: true } );

		editorWindow.console.info( '[YTR dnd-kit Column PoC] dragstart', {
			cellCount: cells.length,
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
		editorWindow.console.info( '[YTR dnd-kit Column PoC] dragover', {
			tableIdentity,
			targetId,
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

		editorWindow.console.info( '[YTR dnd-kit Column PoC] dragend', {
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

	editorWindow.console.info( '[YTR dnd-kit Column PoC] ready', {
		cellCount: cells.length,
		registrationMs,
		tableIdentity,
	} );

	return () => {
		activeObservation?.observer.disconnect();
		activeObservation = null;
		manager.destroy();
		editorWindow.console.info( '[YTR dnd-kit Column PoC] disposed', { tableIdentity } );
	};
};
