/**
 * Row Reorderのドロップ成立時、現在の移動表示を表示中の挿入空間へ滑らかに移動させ、確定位置への着地を示す。
 *
 * DnD InteractionのSession終了やTable更新は待機させず、DnD中にPresentationが描画していた移動表示と挿入空間を
 * 一時的に複製して表示Lifecycleだけを継続する。確定不能による異常終了では着地表示を行わず、次の操作へ一時表示を持ち越さない。
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
const DROP_ANIMATION_DURATION_MS = 250;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** 着地アニメーションで固定するeditor表示領域内の矩形。 */
type DropAnimationRectangle = {
	top: number;
	left: number;
	width: number;
	height: number;
};

/** 1回の有効な移動先について、ドロップ直前に成立していたPresentation表示を保持する。 */
type DropAnimationSnapshot = {
	destinationBoundaryIndex: number;
	editorDocument: Document;
	editorWindow: Window;
	movingDisplay: HTMLElement;
	movingRectangle: DropAnimationRectangle;
	insertionGap: HTMLElement;
	insertionGapRectangle: DropAnimationRectangle;
};

/** 現在継続中の着地アニメーションと、このPresentationが追加した一時表示。 */
type ActiveDropAnimation = {
	animation: Animation;
	movingDisplay: HTMLElement;
	insertionGap: HTMLElement;
};

/**
 * Presentation要素の現在位置を、後続のTable更新に影響されない表示矩形として取得する。
 *
 * @param element 現在のeditor表示領域に描画されているPresentation要素。
 * @return 正の表示寸法を持つ場合は現在矩形。それ以外はnull。
 */
const resolveDisplayRectangle = ( element: HTMLElement ): DropAnimationRectangle | null => {
	const rectangle = element.getBoundingClientRect();

	/* 着地表示の位置と大きさを確定できない要素は、推測した矩形でアニメーションを成立させない。 */
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
 * 現在表示中の移動表示と挿入空間から、同じ有効移動先へ着地させるための表示情報を取得する。
 *
 * @param editorContext            現在のRow DnDと同じeditor DOM環境。
 * @param destinationBoundaryIndex DnD Interactionが現在有効としている0-based移動先境界。
 * @return 両方のPresentation表示が成立している場合は着地表示情報。それ以外はnull。
 */
const resolveDropAnimationSnapshot = (
	editorContext: EditorDomContext,
	destinationBoundaryIndex: number
): DropAnimationSnapshot | null => {
	const movingDisplay =
		editorContext.document.querySelector< HTMLElement >( MOVING_DISPLAY_SELECTOR );
	const insertionGap =
		editorContext.document.querySelector< HTMLElement >( INSERTION_GAP_SELECTOR );

	/* 移動表示と挿入空間の両方が同時に成立している状態だけを、着地アニメーションへ引き継ぐ。 */
	if ( movingDisplay === null || insertionGap === null ) {
		return null;
	}

	const movingRectangle = resolveDisplayRectangle( movingDisplay );
	const insertionGapRectangle = resolveDisplayRectangle( insertionGap );

	/* どちらかの表示矩形を確定できない場合は、表示上の着地点を推測しない。 */
	if ( movingRectangle === null || insertionGapRectangle === null ) {
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
 * Row DnD確定後に、ドラッグ中の移動表示を最後に示していた挿入空間へ移動させるPresentationを接続する。
 *
 * DnD中は現在の移動表示と挿入空間を1描画周期に1回だけ記録し、正常なドロップ時だけその複製をTable更新後も短時間維持する。
 * 着地先では挿入空間の複製が確定済み行を一時的に覆い、移動表示が到着した時点で両方を除去して実Table表示へ切り替える。
 * `prefers-reduced-motion`では着地アニメーションを生成せず、確定済みTableを直ちに表示する。
 *
 * @return DOM要素をReact描画へ追加せず、一時的な着地表示だけをeditor DOMへ適用するためnull。
 */
export const RowDropAnimation = () => {
	const editorContext = useRef< EditorDomContext | null >( null );
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
		currentAnimation.insertionGap.remove();
	}, [] );

	const captureCurrentPresentation = useCallback( (): void => {
		const currentContext = editorContext.current;
		const currentDestinationBoundaryIndex = destinationBoundaryIndex.current;

		/* activeな有効移動先を表示できない期間は、以前の着地点を次のドロップへ流用しない。 */
		if ( currentContext === null || currentDestinationBoundaryIndex === null ) {
			snapshot.current = null;
			return;
		}

		snapshot.current = resolveDropAnimationSnapshot(
			currentContext,
			currentDestinationBoundaryIndex
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
		( currentSnapshot: DropAnimationSnapshot ): void => {
			const reduceMotion =
				typeof currentSnapshot.editorWindow.matchMedia === 'function' &&
				currentSnapshot.editorWindow.matchMedia( REDUCED_MOTION_QUERY ).matches;

			/* 動きを抑制する利用者設定では、一時的な着地表示を追加せず確定済みTableへ直接切り替える。 */
			if ( reduceMotion ) {
				return;
			}

			const horizontalMovement =
				currentSnapshot.insertionGapRectangle.left - currentSnapshot.movingRectangle.left;
			const verticalMovement =
				currentSnapshot.insertionGapRectangle.top - currentSnapshot.movingRectangle.top;

			/* 移動表示が既に着地点へ重なっている場合は、静止表示を時間だけ延長しない。 */
			if ( Math.abs( horizontalMovement ) < 0.5 && Math.abs( verticalMovement ) < 0.5 ) {
				return;
			}

			clearActiveAnimation();
			const movingDisplay = currentSnapshot.movingDisplay.cloneNode( true ) as HTMLElement;
			const insertionGap = currentSnapshot.insertionGap.cloneNode( true ) as HTMLElement;
			movingDisplay.classList.add( DROP_MOVING_DISPLAY_CLASS );
			insertionGap.classList.add( DROP_INSERTION_GAP_CLASS );
			movingDisplay.style.top = `${ currentSnapshot.movingRectangle.top }px`;
			movingDisplay.style.left = `${ currentSnapshot.movingRectangle.left }px`;
			movingDisplay.style.width = `${ currentSnapshot.movingRectangle.width }px`;
			movingDisplay.style.height = `${ currentSnapshot.movingRectangle.height }px`;
			insertionGap.style.top = `${ currentSnapshot.insertionGapRectangle.top }px`;
			insertionGap.style.left = `${ currentSnapshot.insertionGapRectangle.left }px`;
			insertionGap.style.width = `${ currentSnapshot.insertionGapRectangle.width }px`;
			insertionGap.style.height = `${ currentSnapshot.insertionGapRectangle.height }px`;
			currentSnapshot.editorDocument.body.append( insertionGap, movingDisplay );

			/* Web Animations APIを利用できない表示環境では、一時表示を残さず確定済みTableをそのまま表示する。 */
			if ( typeof movingDisplay.animate !== 'function' ) {
				movingDisplay.remove();
				insertionGap.remove();
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
				insertionGap.remove();
			};

			animation.onfinish = finish;
			animation.oncancel = finish;
			activeAnimation.current = {
				animation,
				movingDisplay,
				insertionGap,
			};
		},
		[ clearActiveAnimation ]
	);

	useEffect( () => {
		const synchronizeDestination = (): void => {
			/* idleへの遷移では最後の有効移動先を保持し、ドロップ通知が届くまでPresentationの着地点として利用する。 */
			if ( getRowDndPhase() !== 'active' ) {
				return;
			}

			destinationBoundaryIndex.current = getRowDndDestinationBoundaryIndex();
			if ( destinationBoundaryIndex.current === null ) {
				snapshot.current = null;
				return;
			}

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

			const sourceElement = event.operation.source?.element;
			/* Row DnDの基準要素から現在のeditor DOM環境を解決できない場合は、別環境へ着地表示を生成しない。 */
			if ( sourceElement === undefined ) {
				editorContext.current = null;
				return;
			}

			editorContext.current = resolveEditorDomContext( sourceElement );
		},
		onDragMove: () => {
			scheduleCapture();
		},
		onDragEnd: ( event ) => {
			cancelScheduledCapture();
			const currentDestinationBoundaryIndex = destinationBoundaryIndex.current;
			const currentSnapshot = snapshot.current;

			/* 取消、異常終了、有効移動先なし、または現在の移動先と一致する表示を取得できないドロップでは着地表示を行わない。 */
			if (
				event.canceled ||
				terminated.current ||
				currentDestinationBoundaryIndex === null ||
				currentSnapshot === null ||
				currentSnapshot.destinationBoundaryIndex !== currentDestinationBoundaryIndex
			) {
				editorContext.current = null;
				destinationBoundaryIndex.current = null;
				snapshot.current = null;
				return;
			}

			const currentMovingDisplay =
				currentSnapshot.editorDocument.querySelector< HTMLElement >( MOVING_DISPLAY_SELECTOR );
			const currentMovingRectangle =
				currentMovingDisplay === null ? null : resolveDisplayRectangle( currentMovingDisplay );

			/* ドロップ直前の移動表示がまだ存在する場合は、最後の描画周期より新しい現在位置から着地を開始する。 */
			if ( currentMovingDisplay !== null && currentMovingRectangle !== null ) {
				currentSnapshot.movingDisplay = currentMovingDisplay;
				currentSnapshot.movingRectangle = currentMovingRectangle;
			}

			startDropAnimation( currentSnapshot );
			editorContext.current = null;
			destinationBoundaryIndex.current = null;
			snapshot.current = null;
		},
	} );

	useEffect( () => {
		return () => {
			cancelScheduledCapture();
			clearActiveAnimation();
			editorContext.current = null;
			destinationBoundaryIndex.current = null;
			snapshot.current = null;
		};
	}, [ cancelScheduledCapture, clearActiveAnimation ] );

	return null;
};
