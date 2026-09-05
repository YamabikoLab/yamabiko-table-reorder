/**
 * Row ReorderのDnD終了時、現在の移動表示を結果に応じた最終位置へ滑らかに移動させる。
 *
 * 有効な移動先へのドロップでは最後の挿入空間へ着地させ、有効な移動先がない通常ドロップでは元行の現在位置へ戻す。
 * DnD InteractionのSession終了やTable更新は待機させず、DnD中にPresentationが描画していた移動表示を一時的に複製して
 * 表示Lifecycleだけを継続する。取消または確定不能による異常終了では終了アニメーションを行わず、一時表示を持ち越さない。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { useCallback, useEffect, useRef } from '@wordpress/element';

import { resolveEditorDomContext, type EditorDomContext } from '@/reorder/editor-dom-context';
import {
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	subscribeRowDndState,
	subscribeRowDndTerminationNotice,
} from '@/reorder/row-reorder/dnd-interaction';

const MOVING_DISPLAY_SELECTOR = '.yamabiko-table-reorder-moving-row';
const INSERTION_GAP_SELECTOR = '.yamabiko-table-reorder-insertion-gap';
const DROP_MOVING_DISPLAY_CLASS = 'yamabiko-table-reorder-drop-animation-moving-row';
const DROP_INSERTION_GAP_CLASS = 'yamabiko-table-reorder-drop-animation-gap';
const DROP_ANIMATION_DURATION_MS = 500;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const RETURNING_SOURCE_OPACITY = '0.35';

/** 終了アニメーションで固定するeditor表示領域内の矩形。 */
type DropAnimationRectangle = {
	top: number;
	left: number;
	width: number;
	height: number;
};

/** 1回のRow DnDについて、終了アニメーションへ引き継ぐ現在のPresentation表示。 */
type DropAnimationSnapshot = {
	destinationBoundaryIndex: number | null;
	editorDocument: Document;
	editorWindow: Window;
	sourceRow: HTMLTableRowElement;
	movingDisplay: HTMLElement;
	movingRectangle: DropAnimationRectangle;
	insertionGap: HTMLElement | null;
	insertionGapRectangle: DropAnimationRectangle | null;
};

/** 終了アニメーションが移動表示を向かわせる最終位置と、一時的に維持する表示。 */
type DropAnimationTarget = {
	rectangle: DropAnimationRectangle;
	coverElement: HTMLElement | null;
	sourceRow: HTMLTableRowElement | null;
};

/** 現在継続中の終了アニメーションと、このPresentationが追加または維持した一時表示。 */
type ActiveDropAnimation = {
	animation: Animation;
	movingDisplay: HTMLElement;
	coverElement: HTMLElement | null;
	sourceRow: HTMLTableRowElement | null;
	previousSourceOpacity: string | null;
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
 * 元行の現在位置から、独立した移動表示が戻るeditor表示領域内の位置を取得する。
 *
 * 横方向はMoving Rowと同じくeditor左端より外側へ表示枠を置かず、縦方向はドロップ時点の元行位置をそのまま利用する。
 *
 * @param sourceRow        Row DnD開始時から実Table上に残している元行。
 * @param movingRectangle 現在の移動表示の表示寸法。
 * @return 現在の元行へ戻るための表示矩形。元行の位置を確定できない場合はnull。
 */
const resolveSourceReturnRectangle = (
	sourceRow: HTMLTableRowElement,
	movingRectangle: DropAnimationRectangle
): DropAnimationRectangle | null => {
	const sourceRectangle = sourceRow.getBoundingClientRect();

	/* 元行の現在位置を確定できない場合は、DnD開始時の古い位置へ戻さない。 */
	if ( sourceRectangle.width <= 0 || sourceRectangle.height <= 0 ) {
		return null;
	}

	return {
		top: sourceRectangle.top,
		left: Math.max( sourceRectangle.left, 0 ),
		width: movingRectangle.width,
		height: movingRectangle.height,
	};
};

/**
 * 現在表示中の移動表示と、必要な場合は挿入空間から、DnD終了後の表示情報を取得する。
 *
 * 有効な移動先がある場合は挿入空間まで揃った状態だけを着地表示として取得し、有効な移動先がない場合は
 * 元行へ戻すため移動表示だけを取得する。
 *
 * @param editorContext            現在のRow DnDと同じeditor DOM環境。
 * @param sourceRow                Row DnD開始時から実Table上に残している元行。
 * @param destinationBoundaryIndex DnD Interactionが現在有効としている0-based移動先境界。有効な移動先がない場合はnull。
 * @return 終了アニメーションへ引き継げる現在表示。必要な表示を確定できない場合はnull。
 */
const resolveDropAnimationSnapshot = (
	editorContext: EditorDomContext,
	sourceRow: HTMLTableRowElement,
	destinationBoundaryIndex: number | null
): DropAnimationSnapshot | null => {
	const movingDisplay =
		editorContext.document.querySelector< HTMLElement >( MOVING_DISPLAY_SELECTOR );

	if ( movingDisplay === null ) {
		return null;
	}

	const movingRectangle = resolveDisplayRectangle( movingDisplay );
	if ( movingRectangle === null ) {
		return null;
	}

	/* 有効な移動先がない場合は、挿入空間を要求せず元行への帰還に必要な現在表示だけを保持する。 */
	if ( destinationBoundaryIndex === null ) {
		return {
			destinationBoundaryIndex,
			editorDocument: editorContext.document,
			editorWindow: editorContext.window,
			sourceRow,
			movingDisplay,
			movingRectangle,
			insertionGap: null,
			insertionGapRectangle: null,
		};
	}

	const insertionGap =
		editorContext.document.querySelector< HTMLElement >( INSERTION_GAP_SELECTOR );
	if ( insertionGap === null ) {
		return null;
	}

	const insertionGapRectangle = resolveDisplayRectangle( insertionGap );
	if ( insertionGapRectangle === null ) {
		return null;
	}

	return {
		destinationBoundaryIndex,
		editorDocument: editorContext.document,
		editorWindow: editorContext.window,
		sourceRow,
		movingDisplay,
		movingRectangle,
		insertionGap,
		insertionGapRectangle,
	};
};

/**
 * Row DnD終了後に、ドラッグ中の移動表示を結果に応じた最終表示位置へ移動させるPresentationを接続する。
 *
 * DnD中は現在の移動表示と必要な挿入空間を描画周期ごとに記録し、正常な終了時だけその複製を短時間維持する。
 * 有効な移動先では挿入空間へ着地し、有効な移動先がない通常ドロップではドロップ時点の元行位置へ戻る。
 * `prefers-reduced-motion`では終了アニメーションを生成せず、実Tableの結果を直ちに表示する。
 *
 * @return DOM要素をReact描画へ追加せず、一時的な終了表示だけをeditor DOMへ適用するためnull。
 */
export const RowDropAnimation = () => {
	const editorContext = useRef< EditorDomContext | null >( null );
	const sourceRow = useRef< HTMLTableRowElement | null >( null );
	const destinationBoundaryIndex = useRef< number | null >( null );
	const snapshot = useRef< DropAnimationSnapshot | null >( null );
	const captureFrame = useRef< { editorWindow: Window; requestId: number } | null >( null );
	const activeAnimation = useRef< ActiveDropAnimation | null >( null );
	const terminated = useRef( false );

	const cancelScheduledCapture = useCallback( (): void => {
		const currentFrame = captureFrame.current;
		captureFrame.current = null;

		if ( currentFrame !== null ) {
			currentFrame.editorWindow.cancelAnimationFrame( currentFrame.requestId );
		}
	}, [] );

	const clearActiveAnimation = useCallback( (): void => {
		const currentAnimation = activeAnimation.current;
		activeAnimation.current = null;

		if ( currentAnimation === null ) {
			return;
		}

		currentAnimation.animation.onfinish = null;
		currentAnimation.animation.oncancel = null;
		currentAnimation.animation.cancel();
		currentAnimation.movingDisplay.remove();
		currentAnimation.coverElement?.remove();

		/* 元行への帰還中だけ維持した半透明表示は、帰還終了または中断時に元のinline指定へ戻す。 */
		if (
			currentAnimation.sourceRow !== null &&
			currentAnimation.previousSourceOpacity !== null
		) {
			currentAnimation.sourceRow.style.opacity = currentAnimation.previousSourceOpacity;
		}
	}, [] );

	const captureCurrentPresentation = useCallback( (): void => {
		const currentContext = editorContext.current;
		const currentSourceRow = sourceRow.current;

		if ( currentContext === null || currentSourceRow === null ) {
			snapshot.current = null;
			return;
		}

		snapshot.current = resolveDropAnimationSnapshot(
			currentContext,
			currentSourceRow,
			destinationBoundaryIndex.current
		);
	}, [] );

	const scheduleCapture = useCallback( (): void => {
		const currentContext = editorContext.current;
		if ( currentContext === null ) {
			return;
		}

		cancelScheduledCapture();
		/* 挿入空間は移動先変更後の表示同期で再配置されるため、その同期後の描画位置を次の描画周期で取得する。 */
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

			/* 移動表示が既に最終位置へ重なっている場合は、静止表示を時間だけ延長しない。 */
			if ( Math.abs( horizontalMovement ) < 0.5 && Math.abs( verticalMovement ) < 0.5 ) {
				return;
			}

			clearActiveAnimation();
			const movingDisplay = currentSnapshot.movingDisplay.cloneNode( true ) as HTMLElement;
			const coverElement = target.coverElement?.cloneNode( true ) as HTMLElement | undefined;
			movingDisplay.classList.add( DROP_MOVING_DISPLAY_CLASS );
			movingDisplay.style.top = `${ currentSnapshot.movingRectangle.top }px`;
			movingDisplay.style.left = `${ currentSnapshot.movingRectangle.left }px`;
			movingDisplay.style.width = `${ currentSnapshot.movingRectangle.width }px`;
			movingDisplay.style.height = `${ currentSnapshot.movingRectangle.height }px`;

			if ( coverElement !== undefined ) {
				coverElement.classList.add( DROP_INSERTION_GAP_CLASS );
				coverElement.style.top = `${ target.rectangle.top }px`;
				coverElement.style.left = `${ target.rectangle.left }px`;
				coverElement.style.width = `${ target.rectangle.width }px`;
				coverElement.style.height = `${ target.rectangle.height }px`;
				currentSnapshot.editorDocument.body.append( coverElement );
			}
			currentSnapshot.editorDocument.body.append( movingDisplay );

			let previousSourceOpacity: string | null = null;
			if ( target.sourceRow !== null ) {
				previousSourceOpacity = target.sourceRow.style.opacity;
				/* Moving Rowが元位置へ到着するまで、実Table上の元行を移動元として識別できる半透明表示に維持する。 */
				target.sourceRow.style.opacity = RETURNING_SOURCE_OPACITY;
			}

			/* Web Animations APIを利用できない表示環境では、一時表示を残さず実Tableをそのまま表示する。 */
			if ( typeof movingDisplay.animate !== 'function' ) {
				movingDisplay.remove();
				coverElement?.remove();
				if ( target.sourceRow !== null && previousSourceOpacity !== null ) {
					target.sourceRow.style.opacity = previousSourceOpacity;
				}
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

			const finish = (): void => {
				const currentAnimation = activeAnimation.current;
				if ( currentAnimation === null || currentAnimation.animation !== animation ) {
					return;
				}

				activeAnimation.current = null;
				movingDisplay.remove();
				coverElement?.remove();
				if ( target.sourceRow !== null && previousSourceOpacity !== null ) {
					target.sourceRow.style.opacity = previousSourceOpacity;
				}
			};

			animation.onfinish = finish;
			animation.oncancel = finish;
			activeAnimation.current = {
				animation,
				movingDisplay,
				coverElement: coverElement ?? null,
				sourceRow: target.sourceRow,
				previousSourceOpacity,
			};
		},
		[ clearActiveAnimation ]
	);

	useEffect( () => {
		const synchronizeDestination = (): void => {
			/* idleへの遷移では最後の移動先状態を保持し、物理DnD終了通知が届くまで終了表示の判定に利用する。 */
			if ( getRowDndPhase() !== 'active' ) {
				return;
			}

			destinationBoundaryIndex.current = getRowDndDestinationBoundaryIndex();
			scheduleCapture();
		};

		synchronizeDestination();
		return subscribeRowDndState( synchronizeDestination );
	}, [ scheduleCapture ] );

	useEffect( () => {
		return subscribeRowDndTerminationNotice( () => {
			terminated.current = true;
			clearActiveAnimation();
		} );
	}, [ clearActiveAnimation ] );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			cancelScheduledCapture();
			clearActiveAnimation();
			terminated.current = false;
			snapshot.current = null;
			destinationBoundaryIndex.current = null;
			sourceRow.current = null;

			const sourceElement = event.operation.source?.element;
			/* Row Reorderの移動対象としてtbody直下行を確認できない場合は、終了アニメーションを成立させない。 */
			if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
				editorContext.current = null;
				return;
			}

			const candidate = sourceElement as HTMLTableRowElement;
			if ( candidate.parentElement?.tagName !== 'TBODY' ) {
				editorContext.current = null;
				return;
			}

			sourceRow.current = candidate;
			editorContext.current = resolveEditorDomContext( candidate );
		},
		onDragMove: () => {
			scheduleCapture();
		},
		onDragEnd: ( event ) => {
			cancelScheduledCapture();
			const currentContext = editorContext.current;
			const currentSourceRow = sourceRow.current;
			const currentDestinationBoundaryIndex = destinationBoundaryIndex.current;

			/* 取消または異常終了では、成立しなかった操作を最終位置へ移動する表示を行わない。 */
			if ( event.canceled || terminated.current || currentContext === null || currentSourceRow === null ) {
				editorContext.current = null;
				sourceRow.current = null;
				destinationBoundaryIndex.current = null;
				snapshot.current = null;
				return;
			}

			/* ドロップ直前のDOM表示がまだ存在する場合は、最後の描画周期より新しい現在位置を優先する。 */
			const currentSnapshot =
				resolveDropAnimationSnapshot(
					currentContext,
					currentSourceRow,
					currentDestinationBoundaryIndex
				) ?? snapshot.current;

			/* 最後に記録した表示が現在の移動先状態と一致しない場合は、古い着地点や帰還状態を流用しない。 */
			if (
				currentSnapshot === null ||
				currentSnapshot.destinationBoundaryIndex !== currentDestinationBoundaryIndex
			) {
				editorContext.current = null;
				sourceRow.current = null;
				destinationBoundaryIndex.current = null;
				snapshot.current = null;
				return;
			}

			if ( currentDestinationBoundaryIndex === null ) {
				const sourceRectangle = resolveSourceReturnRectangle(
					currentSourceRow,
					currentSnapshot.movingRectangle
				);

				/* 有効な移動先がない通常ドロップでは、元行の現在位置を確認できる場合だけMoving Rowを元へ戻す。 */
				if ( sourceRectangle !== null ) {
					startDropAnimation( currentSnapshot, {
						rectangle: sourceRectangle,
						coverElement: null,
						sourceRow: currentSourceRow,
					} );
				}
			} else if (
				currentSnapshot.insertionGap !== null &&
				currentSnapshot.insertionGapRectangle !== null
			) {
				startDropAnimation( currentSnapshot, {
					rectangle: currentSnapshot.insertionGapRectangle,
					coverElement: currentSnapshot.insertionGap,
					sourceRow: null,
				} );
			}

			editorContext.current = null;
			sourceRow.current = null;
			destinationBoundaryIndex.current = null;
			snapshot.current = null;
		},
	} );

	useEffect( () => {
		return () => {
			cancelScheduledCapture();
			clearActiveAnimation();
			editorContext.current = null;
			sourceRow.current = null;
			destinationBoundaryIndex.current = null;
			snapshot.current = null;
		};
	}, [ cancelScheduledCapture, clearActiveAnimation ] );

	return null;
};
