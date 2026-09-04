/**
 * 行専用DnD InteractionをDnD Engineの物理Lifecycleへ接続する。
 *
 * 物理DnD開始前の開始可否判定、開始成立後のSession開始、現在行だけの移動先一時登録、
 * 物理的な移動先から行挿入境界への変換、および終了種別のDnD Interaction操作への変換を所有する。
 * 開始準備値と移動先登録は接続インスタンスの短命な一時状態としてだけ保持し、Row DnD SessionやDnD Engine dataへ複製しない。
 * DnD Engine callback内で発生した内部Errorは独自に記録・回復せず、接続インスタンス専用のoperation boundaryへ合流させる。
 */

import { Droppable } from '@dnd-kit/dom';
import type {
	BeforeDragStartEvent,
	DragDropManager,
	DragEndEvent,
	DragMoveEvent,
	DragOverEvent,
	DragStartEvent,
} from '@dnd-kit/dom';

import {
	createRowDndOperationBoundary,
	type RowDndFailureRecoveryContext,
	type RowDndOperation,
	type RowDndSource,
	type RowDndStartPreparation,
} from './dnd-interaction';

/** DnD Engine実装をこの接続境界の外側へ製品固有名で公開しないための内部型。 */
type RowDndEngineManager = DragDropManager;

/** DnD Engine上の開始対象・移動先からRow Reorderが必要とするdataだけを参照する内部境界。 */
type RowDndEngineEntity = Readonly< {
	data: unknown;
	element?: Element;
} >;

/** DnD Engineが現在の物理入力位置として提供する最小情報。 */
type RowDndEnginePosition = Readonly< {
	current: Readonly< {
		y: number;
	} >;
} >;

/** 行DnD中だけDnD Engineへ登録する移動先data。 */
type RowDndTargetData = Readonly< {
	tableIdentity: string;
	rowIndex: number;
} >;

/** 未検証値をキー参照可能なdataとして扱えるか判定する。 */
const isRecord = ( value: unknown ): value is Record< string, unknown > => {
	const record = value !== null && typeof value === 'object' && ! Array.isArray( value );
	return record;
};

/**
 * DnD Engineの開始対象dataを、Row DnD開始対象として解釈する。
 *
 * @param data DnD Engineの開始対象に関連付けられた未検証data。
 * @return Table Identityとtbody内行位置を安全に解釈できる場合は開始対象。それ以外はnull。
 */
const parseRowDndSource = ( data: unknown ): RowDndSource | null => {
	if ( ! isRecord( data ) ) {
		return null;
	}

	const tableIdentity = data.tableIdentity;
	const sourceRowIndex = data.sourceRowIndex;
	const validSource =
		typeof tableIdentity === 'string' &&
		tableIdentity.length > 0 &&
		typeof sourceRowIndex === 'number' &&
		Number.isInteger( sourceRowIndex ) &&
		sourceRowIndex >= 0;

	if ( ! validSource ) {
		return null;
	}

	return {
		tableIdentity,
		sourceRowIndex,
	};
};

/**
 * DnD Engine callbackが示す開始対象をRow DnD開始対象として要求する。
 *
 * Input Interactionが開始対象へ設定するdataは、この接続境界がRow Reorderの開始対象へ変換できることを内部仕様とする。
 *
 * @param entity DnD Engineが現在の開始対象として示すEntity。
 * @return Row DnD開始対象。
 */
const requireRowDndSource = ( entity: RowDndEngineEntity | null ): RowDndSource => {
	const source = parseRowDndSource( entity?.data );

	if ( source === null ) {
		throw new Error( 'Row DnD Engine source must identify a valid row reorder source.' );
	}

	return source;
};

/**
 * DnD Engineの移動先dataを、現在Tableの行位置として解釈する。
 *
 * @param data DnD Engineの移動先に関連付けられた未検証data。
 * @return Table Identityと0-based行位置を安全に解釈できる場合は移動先data。それ以外はnull。
 */
const parseRowDndTargetData = ( data: unknown ): RowDndTargetData | null => {
	if ( ! isRecord( data ) ) {
		return null;
	}

	const tableIdentity = data.tableIdentity;
	const rowIndex = data.rowIndex;
	const validTarget =
		typeof tableIdentity === 'string' &&
		tableIdentity.length > 0 &&
		typeof rowIndex === 'number' &&
		Number.isInteger( rowIndex ) &&
		rowIndex >= 0;

	if ( ! validTarget ) {
		return null;
	}

	return {
		tableIdentity,
		rowIndex,
	};
};

/**
 * dragStart時点の開始対象行から、現在のtbody直下行を移動先登録対象として解決する。
 *
 * iframe / non-iframeの差を跨いで扱えるよう、グローバルなDOM constructorによるinstanceof判定は使用しない。
 *
 * @param sourceEntity DnD Engineが現在の開始対象として示すEntity。
 * @return 現在の同一tbody直下に存在する行。
 */
const resolveCurrentRows = ( sourceEntity: RowDndEngineEntity | null ): HTMLTableRowElement[] => {
	const sourceElement = sourceEntity?.element;

	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		throw new Error( 'Row DnD Engine source element must be a table row.' );
	}

	const tableBody = sourceElement.parentElement;

	if ( ! tableBody || tableBody.tagName !== 'TBODY' ) {
		throw new Error( 'Row DnD Engine source row must belong directly to a tbody.' );
	}

	const typedTableBody = tableBody as HTMLTableSectionElement;
	const rows = Array.from( typedTableBody.rows ).filter(
		( row ) => row.parentElement === typedTableBody
	);
	return rows;
};

/**
 * DnD Engineが示す開始対象が、開始可否判定で準備した対象と同一か判定する。
 *
 * @param currentSource  dragStart時点でDnD Engineが示す開始対象。
 * @param preparedSource prepareStart時点で確定した開始対象。
 * @return Table Identityと行位置がともに一致する場合はtrue。
 */
const matchesPreparedSource = (
	currentSource: RowDndSource,
	preparedSource: RowDndSource
): boolean => {
	const matches =
		currentSource.tableIdentity === preparedSource.tableIdentity &&
		currentSource.sourceRowIndex === preparedSource.sourceRowIndex;
	return matches;
};

/**
 * callback failureでSessionからTable Identityを復元できない場合に、現在のDnD Engine開始対象から短命な回復情報を作る。
 *
 * @param entity DnD Engineが現在の開始対象として示すEntity。
 * @return Table Identityを解釈できた場合だけ含む回復情報。
 */
const createRecoveryContext = (
	entity: RowDndEngineEntity | null
): RowDndFailureRecoveryContext => {
	const source = parseRowDndSource( entity?.data );
	let context: RowDndFailureRecoveryContext = {};

	if ( source !== null ) {
		context = { tableIdentity: source.tableIdentity };
	}

	return context;
};

/**
 * DnD Engineの現在targetと物理入力位置を、Row Reorderの0-based移動先境界へ変換する。
 *
 * targetが存在しない状態は正常な「有効移動先なし」としてnullへ変換する。
 * targetが存在する場合は、その行の中央より前側を行直前、後側を行直後の挿入境界として扱う。
 *
 * @param source   現在のDnD Engine開始対象。
 * @param target   現在のDnD Engine移動先。候補がない場合はnull。
 * @param position DnD Engineが示す現在の物理入力位置。
 * @return 現在の0-based移動先境界。targetがない場合はnull。
 */
const resolveDestinationBoundaryIndex = (
	source: RowDndSource,
	target: RowDndEngineEntity | null,
	position: RowDndEnginePosition
): number | null => {
	if ( target === null ) {
		return null;
	}

	const targetData = parseRowDndTargetData( target.data );

	if ( targetData === null || targetData.tableIdentity !== source.tableIdentity ) {
		throw new Error( 'Row DnD Engine target must belong to the active row reorder table.' );
	}

	const targetElement = target.element;

	if ( ! targetElement || targetElement.tagName !== 'TR' ) {
		throw new Error( 'Row DnD Engine target element must be a table row.' );
	}

	const pointerY = position.current.y;

	if ( ! Number.isFinite( pointerY ) ) {
		throw new Error( 'Row DnD Engine position must provide a finite vertical coordinate.' );
	}

	const targetRectangle = targetElement.getBoundingClientRect();
	const targetMiddleY = targetRectangle.top + targetRectangle.height / 2;
	let destinationBoundaryIndex = targetData.rowIndex + 1;

	if ( pointerY < targetMiddleY ) {
		destinationBoundaryIndex = targetData.rowIndex;
	}

	return destinationBoundaryIndex;
};

/**
 * DnD Interactionを指定されたDnD Engine Lifecycleへ接続する。
 *
 * 接続インスタンスごとにoperation boundary、開始準備値、移動先一時登録を独立して所有する。
 * Input Interactionが所有するDraggableや入力一時状態には触れず、開始成立後に現在tbodyの行だけをDroppableとして登録する。
 *
 * @param manager 行DnDの物理Lifecycleを提供するDnD Engine manager。
 * @return Lifecycle購読とDnD Interaction所有の一時状態を破棄する接続解除関数。
 */
export const connectRowDndInteraction = ( manager: RowDndEngineManager ): ( () => void ) => {
	let preparedStart: RowDndStartPreparation | null = null;
	let activeDroppables: Droppable[] = [];

	/** DnD開始成立前に保持している一回限りの開始準備値を破棄する。 */
	const discardPreparedStart = (): void => {
		preparedStart = null;
	};

	/**
	 * DnD Interactionが現在のSession用に登録した移動先をすべて破棄する。
	 *
	 * 一部の破棄でErrorが発生しても残りの一時登録のcleanupを継続し、最初のErrorだけを呼び出し側へ伝える。
	 */
	const discardTemporaryDndState = (): void => {
		const droppables = activeDroppables;
		activeDroppables = [];
		let cleanupFailed = false;
		let cleanupError: unknown;

		/* 1つの移動先破棄失敗によって他の移動先を残さないため、現在Session分を最後までcleanupする。 */
		for ( const droppable of droppables ) {
			try {
				droppable.destroy();
			} catch ( error ) {
				if ( ! cleanupFailed ) {
					cleanupFailed = true;
					cleanupError = error;
				}
			}
		}

		if ( cleanupFailed ) {
			throw cleanupError;
		}
	};

	/** 共通failure recoveryからactiveな物理DnDだけをcancelする。 */
	const cancelActiveDnd = (): void => {
		if ( ! manager.dragOperation.status.idle ) {
			manager.actions.stop( { canceled: true } );
		}
	};

	const boundary = createRowDndOperationBoundary( {
		discardPreparedStart,
		cancelActiveDnd,
		discardTemporaryDndState,
	} );

	/**
	 * Session開始後に現在tbodyの全行だけを移動先としてDnD Engineへ一時登録する。
	 *
	 * @param sourceEntity dragStart時点でDnD Engineが示す開始対象Entity。
	 * @param source       開始可否判定済みのRow DnD開始対象。
	 */
	const registerCurrentRowDroppables = (
		sourceEntity: RowDndEngineEntity | null,
		source: RowDndSource
	): void => {
		discardTemporaryDndState();
		const rows = resolveCurrentRows( sourceEntity );

		/* active Sessionで現在存在するtbody行だけを移動先候補へ対応付け、Session終了後に全件破棄できるよう保持する。 */
		rows.forEach( ( row, rowIndex ) => {
			const targetData: RowDndTargetData = {
				tableIdentity: source.tableIdentity,
				rowIndex,
			};
			const droppable = new Droppable(
				{
					accept: ( candidate ) => {
						const candidateSource = parseRowDndSource( candidate.data );
						let acceptsCurrentTable = false;

						if ( candidateSource !== null ) {
							acceptsCurrentTable = candidateSource.tableIdentity === source.tableIdentity;
						}

						return acceptsCurrentTable;
					},
					data: targetData,
					element: row,
					id: `row-dnd-target:${ source.tableIdentity }:${ rowIndex }`,
				},
				manager
			);
			activeDroppables.push( droppable );
		} );
	};

	/** 物理DnD開始前に開始可否を判定し、成立した準備値だけをこの接続インスタンスへ保持する。 */
	const handleBeforeDragStart = ( event: BeforeDragStartEvent ): void => {
		discardPreparedStart();

		try {
			const source = requireRowDndSource( event.operation.source );
			const preparation = boundary.prepareStart( source );

			/* 開始不能結果では物理DnDを成立させず、次回開始試行へ準備値を持ち越さない。 */
			if ( preparation === null ) {
				event.preventDefault();
				return;
			}

			preparedStart = preparation;
		} catch ( error ) {
			event.preventDefault();
			boundary.recoverFailure( 'prepareStart', error, createRecoveryContext( event.operation.source ) );
		}
	};

	/** 物理DnD開始成立後に一回限りの開始準備値を消費し、Sessionと移動先登録を開始する。 */
	const handleDragStart = ( event: DragStartEvent ): void => {
		/* failure recoveryによる物理DnD cancelから再入したcallbackでは通常Lifecycleを進めない。 */
		if ( boundary.isRecovering() ) {
			return;
		}

		const preparation = preparedStart;
		discardPreparedStart();

		if ( preparation === null ) {
			const context = createRecoveryContext( event.operation.source );
			boundary.recoverFailure(
				'start',
				new Error( 'Row DnD start requires a prepared start value.' ),
				context
			);
			return;
		}

		try {
			const currentSource = requireRowDndSource( event.operation.source );

			if ( ! matchesPreparedSource( currentSource, preparation.source ) ) {
				throw new Error( 'Row DnD Engine source changed after start preparation.' );
			}

			const started = boundary.start( preparation );

			/* start operationがfailure recoveryへ入った場合は、移動先登録へ進まない。 */
			if ( ! started ) {
				return;
			}

			registerCurrentRowDroppables( event.operation.source, preparation.source );
		} catch ( error ) {
			boundary.recoverFailure( 'start', error, {
				tableIdentity: preparation.source.tableIdentity,
			} );
		}
	};

	/**
	 * DnD Engine callbackの現在target / positionをRow Reorderの移動先更新へ変換する。
	 *
	 * @param event dragMoveまたはdragOverで受け取った現在の物理DnD状態。
	 */
	const handleProgress = ( event: DragMoveEvent | DragOverEvent ): void => {
		if ( boundary.isRecovering() ) {
			return;
		}

		try {
			const source = requireRowDndSource( event.operation.source );
			const destinationBoundaryIndex = resolveDestinationBoundaryIndex(
				source,
				event.operation.target,
				event.operation.position
			);
			boundary.updateDestination( destinationBoundaryIndex );
		} catch ( error ) {
			const context = createRecoveryContext( event.operation.source );
			boundary.recoverFailure( 'updateDestination', error, context );
		}
	};

	/**
	 * DnD Engine終了種別をcomplete / cancelへ変換し、通常終了用の接続一時状態を先に破棄する。
	 *
	 * operation boundary内でfailure recoveryへ入った後に通常cleanupを重ねないため、接続一時状態の通常cleanupはoperation実行前に完了させる。
	 *
	 * @param event DnD Engineが示す終了状態。
	 */
	const handleDragEnd = ( event: DragEndEvent ): void => {
		/* failure recoveryから同期的に発生した終了callbackは、通常終了と二重cleanupへ進ませない。 */
		if ( boundary.isRecovering() ) {
			return;
		}

		let operation: RowDndOperation = 'complete';

		if ( event.canceled ) {
			operation = 'cancel';
		}

		try {
			discardPreparedStart();
			discardTemporaryDndState();

			if ( operation === 'cancel' ) {
				boundary.cancel();
			} else {
				boundary.complete();
			}
		} catch ( error ) {
			const context = createRecoveryContext( event.operation.source );
			boundary.recoverFailure( operation, error, context );
		}
	};

	const unsubscribeBeforeDragStart = manager.monitor.addEventListener(
		'beforedragstart',
		handleBeforeDragStart
	);
	const unsubscribeDragStart = manager.monitor.addEventListener( 'dragstart', handleDragStart );
	const unsubscribeDragMove = manager.monitor.addEventListener( 'dragmove', handleProgress );
	const unsubscribeDragOver = manager.monitor.addEventListener( 'dragover', handleProgress );
	const unsubscribeDragEnd = manager.monitor.addEventListener( 'dragend', handleDragEnd );

	return (): void => {
		unsubscribeBeforeDragStart();
		unsubscribeDragStart();
		unsubscribeDragMove();
		unsubscribeDragOver();
		unsubscribeDragEnd();
		discardPreparedStart();
		discardTemporaryDndState();
	};
};