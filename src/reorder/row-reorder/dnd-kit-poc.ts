/* eslint-disable no-console */
/**
 * dnd-kitを既存Table行へ接続し、実DOM順序を変更しないDnDが成立するか検証するPoCを所有する。
 *
 * 行順の確定やTableデータ更新は行わず、pointerdownされた既存`tr`だけをDnD開始対象として利用できること、
 * DnD Lifecycle、Visual Feedback、Auto Scroll、遅延登録コスト、およびDnD中の`tbody`子要素変更有無だけを観測する。
 */

import { Draggable, DragDropManager, Droppable, Feedback, PointerSensor } from '@dnd-kit/dom';

/** dnd-kit上でYTRの行PoCだけを相互に受け入れる識別種別。 */
const ROW_DND_TYPE = 'ytr-row-dnd-kit-poc';

/** activeなDnD中にPoCが観測する診断情報。 */
type ActiveDragObservation = {
	domOrderChanged: boolean;
	moveCount: number;
	moveCountAtFirstScroll: number | null;
	observer: MutationObserver;
	scrollEventCount: number;
	sourceRegistrationMs: number;
	startedAt: number;
	targetChangeCount: number;
	targetChangeCountAtFirstScroll: number | null;
	targetCount: number;
	targetRegistrationMs: number;
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
 * 対象`tbody`が直接所有する行だけをDnD移動先として取得する。
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
 * pointer入力が開始された行をRow ReorderのPoC対象として解決する。
 *
 * 対象`tbody`直下の`tr`だけを受け入れ、入れ子Tableの行は対象に含めない。
 *
 * @param event     PoC対象`tbody`で発生したpointerdown。
 * @param tableBody PoC対象Tableの`tbody`。
 * @return 行DnD開始対象の行。対象外の場合はnull。
 */
const resolvePointerRow = (
	event: PointerEvent,
	tableBody: HTMLTableSectionElement
): HTMLTableRowElement | null => {
	const target = event.target as Element | null;
	const row = target?.closest?.( 'tr' ) as HTMLTableRowElement | null;
	const pointerRow = row?.parentElement === tableBody ? row : null;

	return pointerRow;
};

/**
 * dnd-kitによる行DnD PoCを現在のTableへ接続する。
 *
 * 行モード開始時にはDraggable / Droppableを登録せず、`tbody`のpointerdown captureだけを監視する。
 * pointerdownされた行だけをDraggableへ遅延登録し、DnD開始後に現在の全行をDroppableへ登録する。
 * Visual FeedbackはPoC設定に応じてdnd-kit標準表示または無表示を選択し、Table DOMの行順を変更しない状態で
 * Lifecycle、Auto Scroll、遅延登録コストを検証する。
 *
 * @param tableIdentity          PoC対象TableのIdentity。
 * @param visualFeedbackEnabled dnd-kit標準Visual Feedbackを使用する場合はtrue。
 * @return PoCを終了してdnd-kitの登録と監視を破棄する関数。現在DOMから検証対象を解決できなければnull。
 */
export const connectDndKitRowPoc = (
	tableIdentity: string,
	visualFeedbackEnabled: boolean
): ( () => void ) | null => {
	const referenceElement = resolveCurrentBlockWrapper( tableIdentity );

	console.info( '[YTR PoC debug] connect', {
		referenceElement,
		tableIdentity,
	} );

	if ( ! referenceElement ) {
		return null;
	}

	const editorDocument = referenceElement.ownerDocument;
	const editorWindow = editorDocument.defaultView;
	const tableBody = resolveTableBody( referenceElement );

	/* 現在のEditor DOM上でTable行を安全に扱えない場合はPoCを開始しない。 */
	if ( ! editorWindow || ! referenceElement.isConnected || ! tableBody ) {
		return null;
	}

	/* 行間DnDを観測できるTableだけをPoC対象とする。 */
	if ( tableBody.rows.length < 2 ) {
		return null;
	}

	const setupStartedAt = editorWindow.performance.now();
	const manager = new DragDropManager( {
		sensors: [
			PointerSensor.configure( {
				/* PoCではTableセル内部もドラッグ開始対象として扱い、interactive要素判定の影響を除外する。 */
				preventActivation: () => false,
			} ),
		],
	} );

	let activeDraggable: Draggable | null = null;
	let activeDroppables: Droppable[] = [];
	let activeObservation: ActiveDragObservation | null = null;
	let activeSourceRegistrationMs = 0;
	let lastTargetId: string | number | null = null;

	/** activeな入力だけが所有する行開始対象を破棄する。 */
	const destroyActiveDraggable = () => {
		activeDraggable?.destroy();
		activeDraggable = null;
		activeSourceRegistrationMs = 0;
	};

	/** activeなDnDだけが所有する行移動先を破棄する。 */
	const destroyActiveDroppables = () => {
		activeDroppables.forEach( ( droppable ) => droppable.destroy() );
		activeDroppables = [];
	};

	/** DnD中にEditor内で発生したスクロールと、その後もDnDが継続したかを観測する。 */
	const handleScroll = () => {
		if ( ! activeObservation ) {
			return;
		}

		if ( activeObservation.scrollEventCount === 0 ) {
			activeObservation.moveCountAtFirstScroll = activeObservation.moveCount;
			activeObservation.targetChangeCountAtFirstScroll = activeObservation.targetChangeCount;
		}

		activeObservation.scrollEventCount += 1;
	};

	/**
	 * pointerdownされた行だけを、同じpointer入力で開始できるDraggableとして準備する。
	 *
	 * `tbody`のcapture段階で登録することで、dnd-kitのPointerSensorが対象`tr`で同じpointerdownを受け取れる状態にする。
	 *
	 * @param event PoC対象`tbody`で発生したpointerdown。
	 */
	const preparePointerSource = ( event: PointerEvent ) => {
		if ( ! event.isPrimary || event.button !== 0 || ! manager.dragOperation.status.idle ) {
			return;
		}

		const row = resolvePointerRow( event, tableBody );

		if ( ! row ) {
			return;
		}

		destroyActiveDraggable();
		destroyActiveDroppables();

		const sourceRegistrationStartedAt = editorWindow.performance.now();
		const rowIndex = row.sectionRowIndex;
		const data = { rowIndex, tableIdentity };
		const feedback = visualFeedbackEnabled ? 'default' : 'none';

		activeDraggable = new Draggable(
			{
				data,
				element: row,
				id: `ytr-row-source:${ tableIdentity }:${ rowIndex }`,
				plugins: [ Feedback.configure( { feedback } ) ],
				type: ROW_DND_TYPE,
			},
			manager
		);
		activeSourceRegistrationMs = editorWindow.performance.now() - sourceRegistrationStartedAt;
	};

	manager.monitor.addEventListener( 'dragstart', ( event ) => {
		const observer = new editorWindow.MutationObserver( ( records ) => {
			const childListChanged = records.some( ( record ) => record.type === 'childList' );

			if ( activeObservation && childListChanged ) {
				activeObservation.domOrderChanged = true;
			}
		} );
		const targetRegistrationStartedAt = editorWindow.performance.now();
		const rows = getDirectRows( tableBody );

		destroyActiveDroppables();

		/*
		 * 行DnD開始後だけ現在の全行を移動先として登録し、行モード開始時にはTable行数に比例する登録を行わない。
		 */
		rows.forEach( ( row, rowIndex ) => {
			const data = { rowIndex, tableIdentity };

			activeDroppables.push(
				new Droppable(
					{
						accept: ROW_DND_TYPE,
						data,
						element: row,
						id: `ytr-row-target:${ tableIdentity }:${ rowIndex }`,
					},
					manager
				)
			);
		} );

		activeObservation = {
			domOrderChanged: false,
			moveCount: 0,
			moveCountAtFirstScroll: null,
			observer,
			scrollEventCount: 0,
			sourceRegistrationMs: activeSourceRegistrationMs,
			startedAt: editorWindow.performance.now(),
			targetChangeCount: 0,
			targetChangeCountAtFirstScroll: null,
			targetCount: activeDroppables.length,
			targetRegistrationMs: editorWindow.performance.now() - targetRegistrationStartedAt,
		};
		lastTargetId = null;
		observer.observe( tableBody, { childList: true } );
		editorDocument.addEventListener( 'scroll', handleScroll, true );

		editorWindow.console.info( '[YTR dnd-kit PoC] dragstart', {
			sourceId: event.operation.source?.id ?? null,
			sourceRegistrationMs: activeObservation.sourceRegistrationMs,
			tableIdentity,
			targetCount: activeObservation.targetCount,
			targetRegistrationMs: activeObservation.targetRegistrationMs,
			visualFeedbackEnabled,
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

		if ( activeObservation ) {
			activeObservation.targetChangeCount += 1;
		}

		editorWindow.console.info( '[YTR dnd-kit PoC] dragover', {
			targetId,
			tableIdentity,
		} );
	} );

	manager.monitor.addEventListener( 'dragend', ( event ) => {
		const observation = activeObservation;

		if ( ! observation ) {
			destroyActiveDroppables();
			destroyActiveDraggable();
			return;
		}

		const pendingRecords = observation.observer.takeRecords();
		const pendingChildListChange = pendingRecords.some( ( record ) => record.type === 'childList' );
		observation.domOrderChanged ||= pendingChildListChange;
		observation.observer.disconnect();
		editorDocument.removeEventListener( 'scroll', handleScroll, true );

		const dragMovesAfterScroll =
			observation.moveCountAtFirstScroll === null
				? 0
				: observation.moveCount - observation.moveCountAtFirstScroll;
		const targetChangesAfterScroll =
			observation.targetChangeCountAtFirstScroll === null
				? 0
				: observation.targetChangeCount - observation.targetChangeCountAtFirstScroll;

		editorWindow.console.info( '[YTR dnd-kit PoC] dragend', {
			autoScrollObserved: observation.scrollEventCount > 0,
			canceled: event.canceled,
			domOrderChanged: observation.domOrderChanged,
			dragMovesAfterScroll,
			durationMs: editorWindow.performance.now() - observation.startedAt,
			moveCount: observation.moveCount,
			scrollEventCount: observation.scrollEventCount,
			sourceId: event.operation.source?.id ?? null,
			sourceRegistrationMs: observation.sourceRegistrationMs,
			tableIdentity,
			targetChangesAfterScroll,
			targetCount: observation.targetCount,
			targetId: event.operation.target?.id ?? null,
			targetRegistrationMs: observation.targetRegistrationMs,
			visualFeedbackEnabled,
		} );

		destroyActiveDroppables();
		destroyActiveDraggable();
		activeObservation = null;
		lastTargetId = null;
	} );

	/*
	 * 行モード開始時にはTable全体を走査せず、pointerdownされた行だけを遅延登録する。
	 */
	tableBody.addEventListener( 'pointerdown', preparePointerSource, { capture: true } );

	/* DnDへ発展しなかったpointer入力では、PointerSensorの処理完了後に一時Draggableを破棄する。 */
	const cleanupInactivePointerSource = () => {
		editorWindow.queueMicrotask( () => {
			if ( manager.dragOperation.status.idle && ! activeObservation ) {
				destroyActiveDraggable();
			}
		} );
	};
	editorWindow.addEventListener( 'pointerup', cleanupInactivePointerSource, { capture: true } );

	editorWindow.console.info( '[YTR dnd-kit PoC] ready', {
		initialDraggableCount: 0,
		initialDroppableCount: 0,
		setupMs: editorWindow.performance.now() - setupStartedAt,
		tableIdentity,
		visualFeedbackEnabled,
	} );

	return () => {
		activeObservation?.observer.disconnect();
		activeObservation = null;
		editorDocument.removeEventListener( 'scroll', handleScroll, true );
		tableBody.removeEventListener( 'pointerdown', preparePointerSource, { capture: true } );
		editorWindow.removeEventListener( 'pointerup', cleanupInactivePointerSource, {
			capture: true,
		} );
		destroyActiveDroppables();
		destroyActiveDraggable();
		manager.destroy();
		editorWindow.console.info( '[YTR dnd-kit PoC] disposed', { tableIdentity } );
	};
};
