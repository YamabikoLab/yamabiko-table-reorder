/**
 * Column ReorderのDnD終了時、現在の移動表示を結果に応じた最終位置へ滑らかに移動させる。
 *
 * 有効な移動先への通常ドロップでは最後の挿入空間へ着地させ、有効な移動先がない通常ドロップと取消では
 * 元列の現在位置へ戻す。DnD InteractionのSession終了やTable更新は待機させず、DnD中にPresentationが描画していた
 * 移動表示を一時的に複製して表示Lifecycleだけを継続する。確定不能による異常終了では一時表示を持ち越さない。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { useCallback, useEffect, useRef } from '@wordpress/element';

import {
	getColumnDndDestinationBoundaryIndex,
	getColumnDndPhase,
	subscribeColumnDndState,
	subscribeColumnDndTerminationNotice,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { resolveEditorDomContext, type EditorDomContext } from '@/reorder/editor-dom-context';

const MOVING_DISPLAY_SELECTOR = '.yamabiko-table-reorder-moving-column';
const INSERTION_GAP_SELECTOR = '.yamabiko-table-reorder-column-insertion-gap';
const DROP_ANIMATION_DURATION_MS = 350;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const RETURNING_SOURCE_OPACITY = '0.35';
const VIEWPORT_SCAN_STEP = 8;

/** 終了アニメーションで固定するeditor表示領域内の矩形。 */
type DropAnimationRectangle = {
	top: number;
	left: number;
	width: number;
	height: number;
};

/** 1回のColumn DnD開始時に確定し、元列への帰還位置解決で維持する元列表示。 */
type SourceColumnLayout = {
	sourceCell: HTMLTableCellElement;
	initialSourceTop: number;
	initialMovingTop: number;
	sourceCells: HTMLTableCellElement[];
};

/** 1回のColumn DnDについて、終了アニメーションへ引き継ぐ現在のPresentation表示。 */
type DropAnimationSnapshot = {
	destinationBoundaryIndex: number | null;
	editorDocument: Document;
	editorWindow: Window;
	movingDisplay: HTMLElement;
	movingRectangle: DropAnimationRectangle;
	insertionGap: HTMLElement | null;
	insertionGapRectangle: DropAnimationRectangle | null;
};

/** 終了アニメーションが移動表示を向かわせる最終位置と、一時的に維持する表示。 */
type DropAnimationTarget = {
	rectangle: DropAnimationRectangle;
	coverElement: HTMLElement | null;
	sourceCells: HTMLTableCellElement[];
};

/** 現在継続中の終了アニメーションと、このPresentationが追加または維持した一時表示。 */
type ActiveDropAnimation = {
	animation: Animation;
	movingDisplay: HTMLElement;
	coverElement: HTMLElement | null;
	previousSourceOpacities: Map< HTMLTableCellElement, string >;
};

/**
 * Presentation要素の現在位置を、後続のTable更新に影響されない表示矩形として取得する。
 *
 * @param element 現在のeditor表示領域に描画されているPresentation要素。
 * @return 正の表示寸法を持つ場合は現在矩形。それ以外はnull。
 */
const resolveDisplayRectangle = ( element: HTMLElement ): DropAnimationRectangle | null => {
	const rectangle = element.getBoundingClientRect();

	/* 終了表示の位置と大きさを確定できない要素は、推測した矩形でアニメーションを成立させない。 */
	if ( rectangle.width <= 0 || rectangle.height <= 0 ) {
		return null;
	}

	return {
		top: rectangle.top,
		left: rectangle.left,
		width: rectangle.width,
		height: rectangle.height,
	};
};

/**
 * 指定位置に実際に描画されている対象Tableのセルを取得する。
 *
 * @param editorDocument 現在のeditor contextに対応するdocument。
 * @param table          Column Reorder対象Table。
 * @param x              移動対象列内の横位置。
 * @param y              editor表示領域内の縦位置。
 * @return 指定位置にある対象Tableのセル。対象外の場合はnull。
 */
const resolveTableCellAtPoint = (
	editorDocument: Document,
	table: HTMLTableElement,
	x: number,
	y: number
): HTMLTableCellElement | null => {
	const element = editorDocument.elementFromPoint?.( x, y ) ?? null;
	const cell = element?.closest( 'th, td' ) as HTMLTableCellElement | null;
	const sourceCell = cell?.closest( 'table' ) === table ? cell : null;
	return sourceCell;
};

/**
 * DnD開始時に現在見えている移動対象列セルと、Moving Columnの開始上端を取得する。
 *
 * 元列へ戻す表示はDnD開始時に見えていたMoving Columnと同じ縦配置を維持する必要があるため、
 * Table全行ではなく現在のeditor表示領域に描画されているセルだけを開始時配置として固定する。
 *
 * @param sourceCell    DnD Engineが移動対象として管理する開始セル。
 * @param initialX      DnD開始時に利用者が指した移動対象列内の横位置。
 * @param editorContext 現在のColumn DnDと同じeditor DOM環境。
 * @return 元列への帰還位置解決に必要な開始時配置。安全に確定できない場合はnull。
 */
const resolveSourceColumnLayout = (
	sourceCell: HTMLTableCellElement,
	initialX: number,
	editorContext: EditorDomContext
): SourceColumnLayout | null => {
	const table = sourceCell.closest( 'table' ) as HTMLTableElement | null;
	/* Column Reorder対象Tableを確認できない要素から、元列の帰還配置を推測しない。 */
	if ( table === null ) {
		return null;
	}

	const sourceRectangle = sourceCell.getBoundingClientRect();
	const tableRectangle = table.getBoundingClientRect();
	/* 元列とTableの表示寸法を開始時に確定できない場合は、別の寸法で帰還表示を成立させない。 */
	if ( sourceRectangle.width <= 0 || sourceRectangle.height <= 0 || tableRectangle.height <= 0 ) {
		return null;
	}

	const visibleTop = Math.max( tableRectangle.top, 0 );
	const visibleBottom = Math.min( tableRectangle.bottom, editorContext.window.innerHeight );
	const visibleCells: HTMLTableCellElement[] = [];
	const seenCells = new Set< HTMLTableCellElement >();
	let y = visibleTop + 0.5;

	/* Moving Columnと同じ表示範囲を基準に、開始時に画面上へ存在する移動対象列セルだけを帰還表示用に保持する。 */
	while ( y < visibleBottom ) {
		const cell = resolveTableCellAtPoint( editorContext.document, table, initialX, y );
		if ( cell === null ) {
			y += VIEWPORT_SCAN_STEP;
			continue;
		}

		const rectangle = cell.getBoundingClientRect();
		if (
			! seenCells.has( cell ) &&
			rectangle.bottom > visibleTop &&
			rectangle.top < visibleBottom
		) {
			seenCells.add( cell );
			visibleCells.push( cell );
		}

		/* 同じセル内を繰り返し確認せず、現在セルの下端から次の表示セル探索へ進む。 */
		y = rectangle.bottom > y ? rectangle.bottom + 0.5 : y + VIEWPORT_SCAN_STEP;
	}

	/* 表示領域端の判定差があっても、実際のDnD開始セルだけは帰還対象列から失わない。 */
	if ( ! seenCells.has( sourceCell ) ) {
		visibleCells.push( sourceCell );
	}

	const initialMovingTop = Math.min(
		...visibleCells.map( ( cell ) => cell.getBoundingClientRect().top )
	);

	return {
		sourceCell,
		initialSourceTop: sourceRectangle.top,
		initialMovingTop,
		sourceCells: visibleCells,
	};
};

/**
 * 元列の現在位置から、独立したMoving Columnが戻るeditor表示領域内の位置を取得する。
 *
 * DnD開始時に固定したMoving Columnと開始セルの縦位置関係を、現在の開始セル位置へ移して帰還先を決定する。
 * これによりDnD中にeditorがスクロールしても開始時の絶対座標へ戻さない。
 *
 * @param sourceLayout    DnD開始時に固定した元列表示配置。
 * @param movingRectangle 現在のMoving Columnの表示寸法。
 * @return 現在の元列へ戻るための表示矩形。元列位置を確定できない場合はnull。
 */
const resolveSourceReturnRectangle = (
	sourceLayout: SourceColumnLayout,
	movingRectangle: DropAnimationRectangle
): DropAnimationRectangle | null => {
	const sourceRectangle = sourceLayout.sourceCell.getBoundingClientRect();
	/* Drop時点の元列位置を確定できない場合は、DnD開始時の絶対座標へ戻さない。 */
	if ( sourceRectangle.width <= 0 || sourceRectangle.height <= 0 ) {
		return null;
	}

	const sourceTopMovement = sourceRectangle.top - sourceLayout.initialSourceTop;
	return {
		top: sourceLayout.initialMovingTop + sourceTopMovement,
		left: sourceRectangle.left,
		width: movingRectangle.width,
		height: movingRectangle.height,
	};
};

/**
 * 現在表示中のMoving Columnと、必要な場合はColumn Insertion Gapから、DnD終了後の表示情報を取得する。
 *
 * @param editorContext            現在のColumn DnDと同じeditor DOM環境。
 * @param destinationBoundaryIndex DnD Interactionが現在有効としている0-based移動先境界。有効な移動先がない場合はnull。
 * @return 終了アニメーションへ引き継げる現在表示。必要な表示を確定できない場合はnull。
 */
const resolveDropAnimationSnapshot = (
	editorContext: EditorDomContext,
	destinationBoundaryIndex: number | null
): DropAnimationSnapshot | null => {
	const movingDisplay =
		editorContext.document.querySelector< HTMLElement >( MOVING_DISPLAY_SELECTOR );
	/* 現在のMoving Columnが既に破棄されている場合は、DOMから新しいsnapshotを生成しない。 */
	if ( movingDisplay === null ) {
		return null;
	}

	const movingRectangle = resolveDisplayRectangle( movingDisplay );
	/* 現在のMoving Column位置を確定できない場合は、不完全なsnapshotを終了表示へ引き継がない。 */
	if ( movingRectangle === null ) {
		return null;
	}

	/* 有効な移動先がない場合は、元列への帰還に挿入空間を要求しない。 */
	if ( destinationBoundaryIndex === null ) {
		return {
			destinationBoundaryIndex,
			editorDocument: editorContext.document,
			editorWindow: editorContext.window,
			movingDisplay,
			movingRectangle,
			insertionGap: null,
			insertionGapRectangle: null,
		};
	}

	const insertionGap =
		editorContext.document.querySelector< HTMLElement >( INSERTION_GAP_SELECTOR );
	/* 有効移動先に対応するInsertion Gapが存在しない表示周期は、成功着地用snapshotとして採用しない。 */
	if ( insertionGap === null ) {
		return null;
	}

	const insertionGapRectangle = resolveDisplayRectangle( insertionGap );
	/* Insertion Gapの表示位置を確定できない場合は、推測した着地点を終了表示へ利用しない。 */
	if ( insertionGapRectangle === null ) {
		return null;
	}

	return {
		destinationBoundaryIndex,
		editorDocument: editorContext.document,
		editorWindow: editorContext.window,
		movingDisplay,
		movingRectangle,
		insertionGap,
		insertionGapRectangle,
	};
};

/**
 * Column DnD終了後に、ドラッグ中のMoving Columnを結果に応じた最終表示位置へ移動させるPresentationを接続する。
 *
 * active Session中だけ最後の移動先と現在表示を保持し、idle遷移で移動先をnullへ上書きしない。
 * 通常ドロップの有効移動先ではInsertion Gapへ着地し、移動先なしまたは取消では元列の現在位置へ戻る。
 * `prefers-reduced-motion`では終了アニメーションを生成せず、実Tableの結果を直ちに表示する。
 *
 * @return DOM要素をReact描画へ追加せず、一時的な終了表示だけをeditor DOMへ適用するためnull。
 */
export const ColumnDropAnimation = () => {
	const editorContext = useRef< EditorDomContext | null >( null );
	const sourceLayout = useRef< SourceColumnLayout | null >( null );
	const destinationBoundaryIndex = useRef< number | null >( null );
	const snapshot = useRef< DropAnimationSnapshot | null >( null );
	const captureFrame = useRef< { editorWindow: Window; requestId: number } | null >( null );
	const activeAnimation = useRef< ActiveDropAnimation | null >( null );
	const terminated = useRef( false );

	/** 物理DnD終了後に次のSessionへ持ち越せないeditor DOM参照、移動先、snapshotを破棄する。 */
	const clearSessionReferences = useCallback( (): void => {
		editorContext.current = null;
		sourceLayout.current = null;
		destinationBoundaryIndex.current = null;
		snapshot.current = null;
	}, [] );

	/** 予約済みのsnapshot取得を取消し、DnD終了後に古い表示状態を記録しない。 */
	const cancelScheduledCapture = useCallback( (): void => {
		const currentFrame = captureFrame.current;
		captureFrame.current = null;
		if ( currentFrame !== null ) {
			currentFrame.editorWindow.cancelAnimationFrame( currentFrame.requestId );
		}
	}, [] );

	/** 進行中の終了アニメーションと、このPresentationが追加または維持した一時表示をすべて解除する。 */
	const clearActiveAnimation = useCallback( (): void => {
		const currentAnimation = activeAnimation.current;
		activeAnimation.current = null;
		/* 進行中の終了表示がない場合は、他のPresentationのDOMへ変更を加えない。 */
		if ( currentAnimation === null ) {
			return;
		}

		currentAnimation.animation.onfinish = null;
		currentAnimation.animation.oncancel = null;
		currentAnimation.animation.cancel();
		currentAnimation.movingDisplay.remove();
		currentAnimation.coverElement?.remove();
		currentAnimation.previousSourceOpacities.forEach( ( opacity, cell ) => {
			cell.style.opacity = opacity;
		} );
	}, [] );

	/** active Session中の現在移動先と同じPresentation表示を、物理DnD終了後へ引き継げるsnapshotとして記録する。 */
	const captureCurrentPresentation = useCallback( (): void => {
		const currentContext = editorContext.current;
		/* 対象editor DOMが既に失われた場合は、以前のsnapshotを現在表示として残さない。 */
		if ( currentContext === null ) {
			snapshot.current = null;
			return;
		}

		snapshot.current = resolveDropAnimationSnapshot(
			currentContext,
			destinationBoundaryIndex.current
		);
	}, [] );

	/** Insertion Gapの表示同期後に現在Presentationを取得できるよう、次の描画周期へsnapshot取得を予約する。 */
	const scheduleCapture = useCallback( (): void => {
		const currentContext = editorContext.current;
		/* DnD開始時のeditor DOMを確定できていない操作では、別contextへsnapshot取得を予約しない。 */
		if ( currentContext === null ) {
			return;
		}

		cancelScheduledCapture();
		/* Insertion Gapは移動先変更後の表示同期で再配置されるため、その同期後の位置を描画周期を跨いで取得する。 */
		const firstRequestId = currentContext.window.requestAnimationFrame( () => {
			const secondRequestId = currentContext.window.requestAnimationFrame( () => {
				captureFrame.current = null;
				captureCurrentPresentation();
			} );
			captureFrame.current = {
				editorWindow: currentContext.window,
				requestId: secondRequestId,
			};
		} );
		captureFrame.current = {
			editorWindow: currentContext.window,
			requestId: firstRequestId,
		};
	}, [ cancelScheduledCapture, captureCurrentPresentation ] );

	/**
	 * DnD中のMoving Column複製を、確定した最終表示位置へ短時間だけ引き継ぐ。
	 *
	 * 成功着地ではInsertion GapをTable更新中の覆いとして複製し、元列へ戻る場合だけ元列セルの半透明表示を維持する。
	 * animation終了、取消、Presentation境界終了のいずれでも追加した一時表示を解除できる状態として所有する。
	 *
	 * @param currentSnapshot 物理DnD終了直前に利用するMoving Columnと必要なInsertion Gapの表示snapshot。
	 * @param target          終了アニメーションの最終矩形と、終了まで維持する一時表示。
	 */
	const startDropAnimation = useCallback(
		( currentSnapshot: DropAnimationSnapshot, target: DropAnimationTarget ): void => {
			const reduceMotion =
				typeof currentSnapshot.editorWindow.matchMedia === 'function' &&
				currentSnapshot.editorWindow.matchMedia( REDUCED_MOTION_QUERY ).matches;
			/* 動きを抑制する利用者設定では、一時的な終了表示を追加せず実Tableへ直接切り替える。 */
			if ( reduceMotion ) {
				return;
			}

			const horizontalMovement = target.rectangle.left - currentSnapshot.movingRectangle.left;
			const verticalMovement = target.rectangle.top - currentSnapshot.movingRectangle.top;
			/* Moving Columnが既に最終位置へ重なっている場合は、静止した複製表示を時間だけ延長しない。 */
			if ( Math.abs( horizontalMovement ) < 0.5 && Math.abs( verticalMovement ) < 0.5 ) {
				return;
			}

			clearActiveAnimation();
			const movingDisplay = currentSnapshot.movingDisplay.cloneNode( true ) as HTMLElement;
			const coverElement = target.coverElement?.cloneNode( true ) as HTMLElement | undefined;
			movingDisplay.style.top = `${ currentSnapshot.movingRectangle.top }px`;
			movingDisplay.style.left = `${ currentSnapshot.movingRectangle.left }px`;
			movingDisplay.style.width = `${ currentSnapshot.movingRectangle.width }px`;
			movingDisplay.style.height = `${ currentSnapshot.movingRectangle.height }px`;

			/* 成功着地ではTable更新後の表示が先に現れないよう、最後のInsertion Gap表示も同じ最終位置へ短時間維持する。 */
			if ( coverElement !== undefined ) {
				coverElement.style.top = `${ target.rectangle.top }px`;
				coverElement.style.left = `${ target.rectangle.left }px`;
				coverElement.style.width = `${ target.rectangle.width }px`;
				coverElement.style.height = `${ target.rectangle.height }px`;
				currentSnapshot.editorDocument.body.append( coverElement );
			}
			currentSnapshot.editorDocument.body.append( movingDisplay );

			const previousSourceOpacities = new Map< HTMLTableCellElement, string >();
			/* 元列への帰還中だけ、Moving Columnの到着先となる実セルを移動元として識別できる表示に維持する。 */
			target.sourceCells.forEach( ( cell ) => {
				previousSourceOpacities.set( cell, cell.style.opacity );
				cell.style.opacity = RETURNING_SOURCE_OPACITY;
			} );

			/* Web Animations APIを利用できない表示環境では、一時表示を残さず実Tableをそのまま表示する。 */
			if ( typeof movingDisplay.animate !== 'function' ) {
				movingDisplay.remove();
				coverElement?.remove();
				previousSourceOpacities.forEach( ( opacity, cell ) => {
					cell.style.opacity = opacity;
				} );
				return;
			}

			const animation = movingDisplay.animate(
				[
					{ transform: 'translate3d(0, 0, 0)' },
					{
						transform: `translate3d(${ horizontalMovement }px, ${ verticalMovement }px, 0)`,
					},
				],
				{
					duration: DROP_ANIMATION_DURATION_MS,
					easing: 'ease-out',
					fill: 'forwards',
				}
			);

			/** animationの完了または取消時に、そのanimationが所有する一時表示だけを終了する。 */
			const finish = (): void => {
				const currentAnimation = activeAnimation.current;
				/* 新しい終了アニメーションへ切り替わった後の古いcallbackでは、現在表示を破棄しない。 */
				if ( currentAnimation === null || currentAnimation.animation !== animation ) {
					return;
				}

				activeAnimation.current = null;
				movingDisplay.remove();
				coverElement?.remove();
				previousSourceOpacities.forEach( ( opacity, cell ) => {
					cell.style.opacity = opacity;
				} );
			};

			animation.onfinish = finish;
			animation.oncancel = finish;
			activeAnimation.current = {
				animation,
				movingDisplay,
				coverElement: coverElement ?? null,
				previousSourceOpacities,
			};
		},
		[ clearActiveAnimation ]
	);

	useEffect( () => {
		/** active Session中の移動先だけを終了表示用に同期し、idle遷移では最後の意味状態を維持する。 */
		const synchronizeDestination = (): void => {
			/* idleへの遷移では最後のactive Sessionの移動先を保持し、物理DnD終了通知まで終了表示の判定に利用する。 */
			if ( getColumnDndPhase() !== 'active' ) {
				return;
			}

			destinationBoundaryIndex.current = getColumnDndDestinationBoundaryIndex();
			scheduleCapture();
		};

		synchronizeDestination();
		return subscribeColumnDndState( synchronizeDestination );
	}, [ scheduleCapture ] );

	useEffect( () => {
		return subscribeColumnDndTerminationNotice( () => {
			terminated.current = true;
			clearActiveAnimation();
		} );
	}, [ clearActiveAnimation ] );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			cancelScheduledCapture();
			clearActiveAnimation();
			terminated.current = false;
			clearSessionReferences();

			const sourceElement = event.operation.source?.element;
			/* Column Reorderの開始セルとして確認できない物理DnDでは、終了アニメーション用のSession参照を作らない。 */
			if ( ! sourceElement || ! [ 'TD', 'TH' ].includes( sourceElement.tagName ) ) {
				return;
			}

			const sourceCell = sourceElement as HTMLTableCellElement;
			const currentContext = resolveEditorDomContext( sourceCell );
			/* 現在のeditor DOM環境を解決できない場合は、別contextへ終了表示を生成しない。 */
			if ( currentContext === null ) {
				return;
			}

			const sourceRectangle = sourceCell.getBoundingClientRect();
			const initialX =
				event.operation.position?.initial.x ?? sourceRectangle.left + sourceRectangle.width / 2;
			const currentSourceLayout = resolveSourceColumnLayout( sourceCell, initialX, currentContext );
			/* 元列の帰還配置を開始時に確定できない操作では、推測した終了アニメーションを生成しない。 */
			if ( currentSourceLayout === null ) {
				return;
			}

			editorContext.current = currentContext;
			sourceLayout.current = currentSourceLayout;
		},
		onDragMove: () => {
			scheduleCapture();
		},
		onDragEnd: ( event ) => {
			cancelScheduledCapture();
			const currentContext = editorContext.current;
			const currentSourceLayout = sourceLayout.current;
			const currentDestinationBoundaryIndex = destinationBoundaryIndex.current;

			/* 異常終了または開始時表示を確定できなかった操作では、成功した終了表示を生成しない。 */
			if ( terminated.current || currentContext === null || currentSourceLayout === null ) {
				clearSessionReferences();
				return;
			}

			/* DnD終了直前のDOM表示がまだ存在する場合は最後の描画周期より新しい現在位置を優先し、失われていればsnapshotへ戻る。 */
			const currentSnapshot =
				resolveDropAnimationSnapshot( currentContext, currentDestinationBoundaryIndex ) ??
				snapshot.current;

			/* idleでgetterがnullになったことは移動先変更とみなさず、active Session中に最後に保持した移動先との不一致だけを失効条件にする。 */
			if (
				currentSnapshot === null ||
				currentSnapshot.destinationBoundaryIndex !== currentDestinationBoundaryIndex
			) {
				clearSessionReferences();
				return;
			}

			const shouldReturnToSource = event.canceled || currentDestinationBoundaryIndex === null;
			/* 取消または有効移動先なしの通常Dropでは、Insertion Gapを着地点に使わず元列の現在位置へ戻す。 */
			if ( shouldReturnToSource ) {
				const sourceRectangle = resolveSourceReturnRectangle(
					currentSourceLayout,
					currentSnapshot.movingRectangle
				);
				if ( sourceRectangle !== null ) {
					startDropAnimation( currentSnapshot, {
						rectangle: sourceRectangle,
						coverElement: null,
						sourceCells: currentSourceLayout.sourceCells,
					} );
				}
				/* 有効移動先への通常Dropでは、最後のInsertion Gapを成功着地の最終表示位置として利用する。 */
			} else if (
				currentSnapshot.insertionGap !== null &&
				currentSnapshot.insertionGapRectangle !== null
			) {
				startDropAnimation( currentSnapshot, {
					rectangle: currentSnapshot.insertionGapRectangle,
					coverElement: currentSnapshot.insertionGap,
					sourceCells: [],
				} );
			}

			clearSessionReferences();
		},
	} );

	useEffect( () => {
		return () => {
			cancelScheduledCapture();
			clearActiveAnimation();
			clearSessionReferences();
		};
	}, [ cancelScheduledCapture, clearActiveAnimation, clearSessionReferences ] );

	return null;
};
