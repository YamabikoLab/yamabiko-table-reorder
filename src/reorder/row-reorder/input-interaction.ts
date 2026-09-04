/**
 * 行専用Input Interactionとして、PCのpointer入力を行DnD開始候補へ変換する。
 *
 * Row Reorder Modeが対象Tableで有効な間だけ、primary pointerの主ボタンによるPC入力を受理する。
 * pointerdownのcapture段階で開始候補行だけをDnD Engineへ一時登録し、入力終了、DnD終了、次の開始入力、
 * または接続解除でInput Interaction所有のDraggableと入力一時状態を破棄する。
 * 構造制約による開始可否、DnD Session、移動先、確定・取消、および通常編集抑止は所有しない。
 */

import { Draggable, PointerSensor } from '@dnd-kit/dom';
import type { DragDropManager } from '@dnd-kit/dom';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { rowReorderMode } from '@/reorder/reorder-mode';

/** DnD Engine実装の製品固有型をInput Interaction境界の外部へ公開しないための内部型。 */
type RowDndEngineManager = DragDropManager;

/** DnD Interactionが開始対象として解釈する、Input Interaction所有の付随情報。 */
type RowDndSourceData = Readonly< {
	tableIdentity: string;
	sourceRowIndex: number;
} >;

/**
 * pointer入力がPhase 4のPC開始入力として受理できるか判定する。
 *
 * TouchはPhase 5だけが開始候補として扱うため、primary pointerと主ボタンの条件を満たしても受理しない。
 *
 * @param event 開始候補として確認するpointer入力。
 * @return PC行DnDの開始入力として受理できる場合はtrue。
 */
const isPcPointerStart = ( event: PointerEvent ): boolean => {
	const acceptedPointer = event.isPrimary && event.button === 0 && event.pointerType !== 'touch';
	return acceptedPointer;
};

/**
 * pointerdownの発生位置から、対象tbodyが直接所有する開始候補行だけを解決する。
 *
 * 入れ子Tableの行は別のtbodyに属するため開始候補へ含めない。
 *
 * @param event     対象Tableで発生したpointerdown。
 * @param tableBody Row Reorder対象Tableのtbody。
 * @return 対象tbody直下の開始候補行。対象外の場合はnull。
 */
const resolvePointerRow = (
	event: PointerEvent,
	tableBody: HTMLTableSectionElement
): HTMLTableRowElement | null => {
	const target = event.target as Element | null;
	const canResolveClosest = target !== null && typeof target.closest === 'function';

	/* Elementとして行所属を解決できない入力位置は開始候補として扱わない。 */
	if ( ! canResolveClosest ) {
		return null;
	}

	const row = target.closest( 'tr' ) as HTMLTableRowElement | null;
	const directRow = row !== null && row.parentElement === tableBody ? row : null;
	return directRow;
};

/**
 * Row PC Input Interactionを現在TableのtbodyとDnD Engineへ接続する。
 *
 * 接続時には行数に比例するDraggable登録を行わず、受理したpointerdownの開始候補行だけを同じ入力中に一時登録する。
 * DnD Engine managerは外側から受け取り、この責務では生成・破棄しない。
 * Editor DOM Contextは入力開始時の現在targetから解決し、入力終了監視に必要なwindowをその入力中だけ利用する。
 *
 * @param tableBody     Row Reorder対象Tableの現在tbody。
 * @param tableIdentity 対象Table個体を識別するTable Identity。
 * @param manager       Product composition側が所有するDnD Engine manager。
 * @return Input Interactionの監視と一時状態を破棄する接続解除関数。
 */
export const connectRowPcInputInteraction = (
	tableBody: HTMLTableSectionElement,
	tableIdentity: string,
	manager: RowDndEngineManager
): ( () => void ) => {
	let activeDraggable: Draggable< RowDndSourceData > | null = null;
	let discardPointerEndMonitoring: ( () => void ) | null = null;

	/** Input Interactionが現在の開始入力について所有するDraggableと入力終了監視を破棄する。 */
	const discardActiveInput = (): void => {
		const draggable = activeDraggable;
		activeDraggable = null;
		draggable?.destroy();

		const discardMonitoring = discardPointerEndMonitoring;
		discardPointerEndMonitoring = null;
		discardMonitoring?.();
	};

	/**
	 * DnDへ発展しなかったpointer入力の終了後に、一時Draggableを破棄する。
	 *
	 * DnD Engineのpointer終了処理を先に完了させ、物理DnDがidleへ戻った場合だけInput Interaction所有物を破棄する。
	 */
	const discardAfterPointerEnd = (): void => {
		const editorWindow = tableBody.ownerDocument.defaultView;

		/* 接続中のtbodyに対応するwindowを利用できない場合は、入力一時状態を残さない。 */
		if ( editorWindow === null ) {
			discardActiveInput();
			return;
		}

		editorWindow.queueMicrotask( () => {
			/* activeな物理DnDへ発展した入力はdragendまでDraggableを維持する。 */
			if ( manager.dragOperation.status.idle ) {
				discardActiveInput();
			}
		} );
	};

	/**
	 * 受理したPC pointer入力について、その入力で開始候補となる行だけをDnD Engineへ登録する。
	 *
	 * @param event 対象tbodyでcaptureされたpointerdown。
	 */
	const handlePointerDown = ( event: PointerEvent ): void => {
		/* PC開始条件、Reorder Mode、またはDnD Engineの排他条件を満たさない入力は受理しない。 */
		if (
			! isPcPointerStart( event ) ||
			! rowReorderMode.isActive( tableIdentity ) ||
			! manager.dragOperation.status.idle
		) {
			return;
		}

		const row = resolvePointerRow( event, tableBody );

		/* 対象tbody直下の行以外からはRow DnD開始候補を作らない。 */
		if ( row === null ) {
			return;
		}

		const target = event.target as Element;
		const editorContext = resolveEditorDomContext( target );

		/* 現在入力が属するEditor DOM Contextを解決できない場合は開始候補を登録しない。 */
		if ( editorContext === null ) {
			return;
		}

		discardActiveInput();

		const sourceRowIndex = row.sectionRowIndex;
		const data: RowDndSourceData = {
			tableIdentity,
			sourceRowIndex,
		};

		activeDraggable = new Draggable< RowDndSourceData >(
			{
				data,
				element: row,
				id: `row-dnd-source:${ tableIdentity }:${ sourceRowIndex }`,
				sensors: [
					PointerSensor.configure( {
						/* 一時登録が次の入力まで残っても、TouchをPhase 4の開始経路へ入れない。 */
						preventActivation: ( sensorEvent ) => ! isPcPointerStart( sensorEvent ),
					} ),
				],
			},
			manager
		);

		const handlePointerEnd = (): void => {
			discardAfterPointerEnd();
		};
		editorContext.window.addEventListener( 'pointerup', handlePointerEnd, { capture: true } );
		editorContext.window.addEventListener( 'pointercancel', handlePointerEnd, { capture: true } );
		discardPointerEndMonitoring = (): void => {
			editorContext.window.removeEventListener( 'pointerup', handlePointerEnd, {
				capture: true,
			} );
			editorContext.window.removeEventListener( 'pointercancel', handlePointerEnd, {
				capture: true,
			} );
		};
	};

	const unsubscribeDragEnd = manager.monitor.addEventListener( 'dragend', discardActiveInput );
	tableBody.addEventListener( 'pointerdown', handlePointerDown, { capture: true } );

	return (): void => {
		tableBody.removeEventListener( 'pointerdown', handlePointerDown, { capture: true } );
		unsubscribeDragEnd();
		discardActiveInput();
	};
};
