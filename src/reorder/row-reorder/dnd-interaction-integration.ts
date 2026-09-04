/**
 * 行専用DnD InteractionとDnD Engineの接続境界を提供する。
 *
 * DnD Engineの物理的な開始・進行・終了通知を、Row Reorderが扱う開始可否判定、
 * Session開始、移動先境界更新、確定・取消へ変換する責務を持つ。
 * 開始準備値と移動先登録は接続ごとの一時状態として所有し、共有状態やDnD Engineの付随情報へ複製しない。
 * 接続処理内の内部Errorは独自に記録・回復せず、DnD Interactionの共通回復境界へ合流させる。
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

/** DnD Engine実装の製品固有型を接続境界の外部へ公開しないための内部型。 */
type RowDndEngineManager = DragDropManager;

/** DnD Engine上の開始対象・移動先候補からRow Reorderが参照する最小情報。 */
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

/** 行DnD中だけDnD Engineへ登録する移動先候補の付随情報。 */
type RowDndTargetData = Readonly< {
	tableIdentity: string;
	rowIndex: number;
} >;

/**
 * DnD Engineから受け取る未検証値が、必要な項目を安全に参照できる形式か判定する。
 *
 * @param value DnD Engineから受け取った未検証の付随情報。
 * @return 項目参照が可能なオブジェクト形式の場合はtrue。それ以外はfalse。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > => {
	const record = value !== null && typeof value === 'object' && ! Array.isArray( value );
	return record;
};

/**
 * DnD Engineの開始対象情報を、Row DnD開始可否判定で使用する開始対象へ変換する。
 *
 * @param data DnD Engineの開始対象に関連付けられた未検証の付随情報。
 * @return Table Identityとtbody内行位置を開始対象として解釈できる場合は開始対象。それ以外はnull。
 */
const parseRowDndSource = ( data: unknown ): RowDndSource | null => {
	/* 外部から受け取った形式不明の値は開始対象として扱わない。 */
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

	/* Table個体とtbody内行位置を一意に示せない値は開始対象として扱わない。 */
	if ( ! validSource ) {
		return null;
	}

	return {
		tableIdentity,
		sourceRowIndex,
	};
};

/**
 * DnD Engineが示す開始対象をRow DnD開始対象として要求する。
 *
 * Input Interactionが開始対象へ設定する付随情報は、この接続境界がRow Reorderの開始対象へ変換できることを内部仕様とする。
 *
 * @param entity DnD Engineが現在の開始対象として示すEntity。
 * @return Row DnD開始対象。
 */
const requireRowDndSource = ( entity: RowDndEngineEntity | null ): RowDndSource => {
	const source = parseRowDndSource( entity?.data );

	/* 物理DnD開始後にRow Reorderの開始対象を特定できない状態は接続内部仕様違反とする。 */
	if ( source === null ) {
		throw new Error( 'Row DnD Engine source must identify a valid row reorder source.' );
	}

	return source;
};

/**
 * DnD Engineの移動先候補情報を、現在Table内の行位置へ変換する。
 *
 * @param data DnD Engineの移動先候補に関連付けられた未検証の付随情報。
 * @return Table Identityと0-based行位置を解釈できる場合は移動先候補情報。それ以外はnull。
 */
const parseRowDndTargetData = ( data: unknown ): RowDndTargetData | null => {
	/* 外部から受け取った形式不明の値は移動先候補として扱わない。 */
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

	/* Table個体とtbody内行位置を一意に示せない値は移動先候補として扱わない。 */
	if ( ! validTarget ) {
		return null;
	}

	return {
		tableIdentity,
		rowIndex,
	};
};

/**
 * DnD開始成立時点の開始対象行から、そのSessionで移動先候補となる現在のtbody直下行を取得する。
 *
 * Editorがiframe内外のどちらに存在しても同じ判定になるよう、グローバルなDOM constructorには依存しない。
 *
 * @param sourceEntity DnD Engineが現在の開始対象として示すEntity。
 * @return 開始対象と同じtbody直下に現在存在する行。
 */
const resolveCurrentRows = ( sourceEntity: RowDndEngineEntity | null ): HTMLTableRowElement[] => {
	const sourceElement = sourceEntity?.element;

	/* 行DnDの開始対象はTable行のDOM要素でなければならない。 */
	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		throw new Error( 'Row DnD Engine source element must be a table row.' );
	}

	const tableBody = sourceElement.parentElement;

	/* Row Reorderが扱う開始対象行はtbody直下に属することを内部仕様とする。 */
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
 * DnD開始成立時点の開始対象が、開始可否判定で確定した対象と同一か判定する。
 *
 * @param currentSource DnD開始成立時点でDnD Engineが示す開始対象。
 * @param preparedSource 開始可否判定で確定した開始対象。
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
 * Session成立前の内部Errorでも対象Tableを特定できるよう、現在の開始対象から短命な回復情報を作る。
 *
 * @param entity DnD Engineが現在の開始対象として示すEntity。
 * @return Table Identityを解釈できた場合だけ対象Tableを含む回復情報。
 */
const createRecoveryContext = (
	entity: RowDndEngineEntity | null
): RowDndFailureRecoveryContext => {
	const source = parseRowDndSource( entity?.data );
	let context: RowDndFailureRecoveryContext = {};

	/* 開始対象を解釈できる場合だけ、回復後のReorder Mode判断へ対象Tableを引き継ぐ。 */
	if ( source !== null ) {
		context = { tableIdentity: source.tableIdentity };
	}

	return context;
};

/**
 * DnD Engineが示す現在の移動先候補と物理入力位置を、Row Reorderの0-based移動先境界へ変換する。
 *
 * 移動先候補が存在しない状態は正常な「有効移動先なし」としてnullへ変換する。
 * 移動先候補が存在する場合は、その行の中央より前側を行直前、後側を行直後の挿入境界として扱う。
 *
 * @param source 現在のDnD Engine開始対象。
 * @param target 現在のDnD Engine移動先候補。候補がない場合はnull。
 * @param position DnD Engineが示す現在の物理入力位置。
 * @return 現在の0-based移動先境界。移動先候補がない場合はnull。
 */
const resolveDestinationBoundaryIndex = (
	source: RowDndSource,
	target: RowDndEngineEntity | null,
	position: RowDndEnginePosition
): number | null => {
	/* 移動先候補を失った状態では、以前の有効移動先を残さない。 */
	if ( target === null ) {
		return null;
	}

	const targetData = parseRowDndTargetData( target.data );

	/* activeなRow DnDと異なるTableや不正な候補は、接続内部仕様違反として共通回復処理へ渡す。 */
	if ( targetData === null || targetData.tableIdentity !== source.tableIdentity ) {
		throw new Error( 'Row DnD Engine target must belong to the active row reorder table.' );
	}

	const targetElement = target.element;

	/* 行境界を決定する移動先候補はTable行のDOM要素でなければならない。 */
	if ( ! targetElement || targetElement.tagName !== 'TR' ) {
		throw new Error( 'Row DnD Engine target element must be a table row.' );
	}

	const pointerY = position.current.y;

	/* 行の前後関係を決定できない物理入力位置は、接続内部仕様違反として扱う。 */
	if ( ! Number.isFinite( pointerY ) ) {
		throw new Error( 'Row DnD Engine position must provide a finite vertical coordinate.' );
	}

	const targetRectangle = targetElement.getBoundingClientRect();
	const targetMiddleY = targetRectangle.top + targetRectangle.height / 2;
	let destinationBoundaryIndex = targetData.rowIndex + 1;

	/* 行中央より前側では、その行の直前境界を移動先とする。 */
	if ( pointerY < targetMiddleY ) {
		destinationBoundaryIndex = targetData.rowIndex;
	}

	return destinationBoundaryIndex;
};

/**
 * DnD Interactionを指定されたDnD Engineのライフサイクルへ接続する。
 *
 * 接続ごとにRowDndOperationBoundary、開始準備値、移動先一時登録を独立して所有する。
 * Input Interactionが所有するDraggableや入力一時状態には触れず、Session開始成立後に現在tbodyの行だけをDroppableとして登録する。
 * 接続解除時は購読とDnD Interaction所有の一時状態だけを破棄する。
 *
 * @param manager 行DnDの物理的なライフサイクルを提供するDnD Engine manager。
 * @return ライフサイクル購読とDnD Interaction所有の一時状態を破棄する接続解除関数。
 */
export const connectRowDndInteraction = ( manager: RowDndEngineManager ): ( () => void ) => {
	let preparedStart: RowDndStartPreparation | null = null;
	let activeDroppables: Droppable[] = [];

	/** DnD開始成立前に保持している一回限りの開始準備値を破棄する。 */
	const discardPreparedStart = (): void => {
		preparedStart = null;
	};

	/**
	 * DnD Interactionが現在のSession用に登録した移動先候補をすべて破棄する。
	 *
	 * 一部の破棄でErrorが発生しても他の登録を残さず、最初に発生したErrorだけを共通回復境界へ伝える。
	 */
	const discardTemporaryDndState = (): void => {
		const droppables = activeDroppables;
		activeDroppables = [];
		let cleanupFailed = false;
		let cleanupError: unknown;

		/* 1件の破棄失敗によって同じSessionの他の移動先登録を残さないため、全件の破棄を試行する。 */
		for ( const droppable of droppables ) {
			try {
				droppable.destroy();
			} catch ( error ) {
				/* 最初の破棄失敗を保持しつつ、残りの移動先登録の破棄を継続する。 */
				if ( ! cleanupFailed ) {
					cleanupFailed = true;
					cleanupError = error;
				}
			}
		}

		/* 一時登録を残さず破棄した後、最初の失敗だけを共通回復境界へ伝える。 */
		if ( cleanupFailed ) {
			throw cleanupError;
		}
	};

	/** 共通回復処理から、進行中の物理DnDだけをcancelする。 */
	const cancelActiveDnd = (): void => {
		/* 物理DnDが既にidleの場合は、不要な終了通知をDnD Engineへ発生させない。 */
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
	 * Session開始成立後に、開始対象と同じtbodyの現在行だけを移動先候補として一時登録する。
	 *
	 * 登録は現在Sessionだけに有効とし、Session終了または共通回復処理で全件を破棄する。
	 *
	 * @param sourceEntity DnD開始成立時点でDnD Engineが示す開始対象Entity。
	 * @param source 開始可否判定済みのRow DnD開始対象。
	 */
	const registerCurrentRowDroppables = (
		sourceEntity: RowDndEngineEntity | null,
		source: RowDndSource
	): void => {
		discardTemporaryDndState();
		const rows = resolveCurrentRows( sourceEntity );

		/* 現在tbodyに存在する各行へ、そのSessionでのみ有効な同一Tableの移動先境界候補を対応付ける。 */
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

						/* 同じTableの行DnD開始対象だけを、このSessionの移動先候補として受け入れる。 */
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

	/**
	 * 物理DnD開始前に現在の開始対象で開始可否を判定し、成立した準備値だけを一回限り保持する。
	 *
	 * 前回の開始準備値は新しい開始試行の先頭で必ず破棄し、開始不能結果を次回へ持ち越さない。
	 *
	 * @param event DnD Engineが通知する開始前イベント。
	 */
	const handleBeforeDragStart = ( event: BeforeDragStartEvent ): void => {
		discardPreparedStart();

		try {
			const source = requireRowDndSource( event.operation.source );
			const preparation = boundary.prepareStart( source );

			/* 開始不能結果では物理DnDを成立させず、開始準備値も保持しない。 */
			if ( preparation === null ) {
				event.preventDefault();
				return;
			}

			preparedStart = preparation;
		} catch ( error ) {
			event.preventDefault();
			boundary.recoverFailure(
				'prepareStart',
				error,
				createRecoveryContext( event.operation.source )
			);
		}
	};

	/**
	 * 物理DnD開始成立後に一回限りの開始準備値を消費し、同じ開始対象のSessionと移動先登録を開始する。
	 *
	 * @param event DnD Engineが通知する開始成立イベント。
	 */
	const handleDragStart = ( event: DragStartEvent ): void => {
		/* 共通回復処理による物理DnD取消から再入した通知では通常の開始処理を進めない。 */
		if ( boundary.isRecovering() ) {
			return;
		}

		const preparation = preparedStart;
		discardPreparedStart();

		/* 開始前判定を経ずに成立した物理DnDは内部仕様違反として共通回復処理へ渡す。 */
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

			/* 開始可否判定後に開始対象が変化した場合は、別対象へ準備値を適用しない。 */
			if ( ! matchesPreparedSource( currentSource, preparation.source ) ) {
				throw new Error( 'Row DnD Engine source changed after start preparation.' );
			}

			const started = boundary.start( preparation );

			/* Session開始が共通回復処理で終了した場合は、移動先登録へ進まない。 */
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
	 * DnD Engineが通知する現在の移動先候補と物理入力位置を、Row Reorderの移動先境界更新へ変換する。
	 *
	 * @param event dragMoveまたはdragOverで通知された現在の物理DnD状態。
	 */
	const handleProgress = ( event: DragMoveEvent | DragOverEvent ): void => {
		/* 共通回復処理中は、終了中のSessionへ新しい移動先を反映しない。 */
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
	 * DnD Engineの終了種別を確定または取消へ変換し、通常終了用の一時状態を先に破棄する。
	 *
	 * 操作境界内で共通回復処理へ入った後に通常終了の破棄を重ねないため、接続一時状態の通常破棄は操作実行前に完了させる。
	 *
	 * @param event DnD Engineが通知する終了イベント。
	 */
	const handleDragEnd = ( event: DragEndEvent ): void => {
		/* 共通回復処理から同期的に再入した終了通知は、通常終了と二重破棄へ進ませない。 */
		if ( boundary.isRecovering() ) {
			return;
		}

		let operation: RowDndOperation = 'complete';

		/* DnD Engineが取消終了を示した場合だけ、Tableを更新しないcancel操作へ接続する。 */
		if ( event.canceled ) {
			operation = 'cancel';
		}

		try {
			discardPreparedStart();
			discardTemporaryDndState();

			/* 物理DnDの終了理由に応じて、確定と取消を排他的に実行する。 */
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
