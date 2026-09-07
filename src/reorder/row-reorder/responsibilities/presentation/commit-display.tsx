/**
 * Row Reorderの有効drop後、Table更新が完了するまで移動完了位置を静止表示として維持する。
 *
 * DnD中のMoving RowとInsertion Gapからdrop時点の最終表示を引き継ぎ、Core Tableの確定処理へ入る前に
 * 移動行を最終位置へ固定する。確定中はアニメーション途中の表示を残さず、利用者には移動済みの配置だけを示す。
 * Core Tableが所有する実DOM順は変更せず、DnD Interactionがidleへ戻った時点で一時表示を解除する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { useCallback, useEffect, useRef } from '@wordpress/element';

import { useRowDndPhase } from '@/reorder/row-reorder/integration/dnd-interaction-react';
import { getRowDndDestinationBoundaryIndex } from '@/reorder/row-reorder/responsibilities/dnd-interaction';

const MOVING_DISPLAY_SELECTOR = '.yamabiko-table-reorder-moving-row';
const INSERTION_GAP_SELECTOR = '.yamabiko-table-reorder-insertion-gap';
const SOURCE_ROW_SELECTOR = '.yamabiko-table-reorder-moving-row-source';
const COMMIT_DISPLAY_CLASS = 'yamabiko-table-reorder-row-commit-display';

/** 確定中の静止表示と、表示を切り替えるため一時的に変更した既存Presentationを保持する。 */
type ActiveCommitDisplay = {
	display: HTMLElement;
	hiddenElements: Array< { element: HTMLElement; visibility: string } >;
	sourceRow: HTMLElement | null;
	sourceVisibility: string | null;
};

/**
 * 有効dropの最終位置を、Core Table更新中に維持する静止表示へ引き継ぐ。
 *
 * @return DOM要素をReact描画へ追加せず、editor DOM上の一時表示だけを管理するためnull。
 */
export const RowCommitDisplay = () => {
	const phase = useRowDndPhase();
	const activeDisplay = useRef< ActiveCommitDisplay | null >( null );
	const cleanupFrame = useRef< { editorWindow: Window; requestId: number } | null >( null );

	const clearCommitDisplay = useCallback( (): void => {
		const currentFrame = cleanupFrame.current;
		cleanupFrame.current = null;
		if ( currentFrame !== null ) {
			currentFrame.editorWindow.cancelAnimationFrame( currentFrame.requestId );
		}

		const current = activeDisplay.current;
		activeDisplay.current = null;
		if ( current === null ) {
			return;
		}

		current.display.remove();
		current.hiddenElements.forEach( ( { element, visibility } ) => {
			if ( element.isConnected ) {
				element.style.visibility = visibility;
			}
		} );
		if ( current.sourceRow !== null && current.sourceVisibility !== null && current.sourceRow.isConnected ) {
			current.sourceRow.style.visibility = current.sourceVisibility;
		}
	}, [] );

	useDragDropMonitor( {
		onDragStart: () => {
			clearCommitDisplay();
		},
		onDragEnd: ( event ) => {
			/* 取消または有効移動先のない終了では、確定済み位置を示す静止表示を生成しない。 */
			if ( event.canceled || getRowDndDestinationBoundaryIndex() === null ) {
				return;
			}

			const sourceElement = event.operation.source?.element;
			const editorDocument = sourceElement?.ownerDocument ?? null;
			const editorWindow = editorDocument?.defaultView ?? null;
			if ( editorDocument === null || editorWindow === null ) {
				return;
			}

			const movingDisplay = editorDocument.querySelector< HTMLElement >( MOVING_DISPLAY_SELECTOR );
			const insertionGap = editorDocument.querySelector< HTMLElement >( INSERTION_GAP_SELECTOR );
			if ( movingDisplay === null || insertionGap === null ) {
				return;
			}

			const gapRectangle = insertionGap.getBoundingClientRect();
			const movingRectangle = movingDisplay.getBoundingClientRect();
			/* 最終位置または移動行の表示寸法を確定できない場合は、推測した確定表示を生成しない。 */
			if (
				gapRectangle.width <= 0 ||
				gapRectangle.height <= 0 ||
				movingRectangle.width <= 0 ||
				movingRectangle.height <= 0
			) {
				return;
			}

			clearCommitDisplay();
			const display = movingDisplay.cloneNode( true ) as HTMLElement;
			display.classList.add( COMMIT_DISPLAY_CLASS );
			display.style.top = `${ gapRectangle.top }px`;
			display.style.left = `${ gapRectangle.left }px`;
			display.style.width = `${ movingRectangle.width }px`;
			display.style.height = `${ movingRectangle.height }px`;
			display.style.transform = 'none';
			editorDocument.body.append( display );

		const sourceRow = editorDocument.querySelector< HTMLElement >( SOURCE_ROW_SELECTOR );
		const sourceVisibility = sourceRow?.style.visibility ?? null;
		if ( sourceRow !== null ) {
			/* 元行はレイアウトを維持したまま隠し、押しのけ表示で埋まった移動元位置との二重表示を防ぐ。 */
			sourceRow.style.visibility = 'hidden';
		}

		activeDisplay.current = {
			display,
			hiddenElements: [],
			sourceRow,
			sourceVisibility,
		};

		/*
		 * 同じ物理DnD終了で既存Drop Animationが生成する複製を含め、静止確定表示以外のMoving Rowを
		 * 最初の描画前に隠す。これにより重いTable更新でアニメーション途中の表示が凍結して見えないようにする。
		 */
		const requestId = editorWindow.requestAnimationFrame( () => {
			cleanupFrame.current = null;
			const current = activeDisplay.current;
			if ( current === null || current.display !== display ) {
				return;
			}

			editorDocument.querySelectorAll< HTMLElement >( MOVING_DISPLAY_SELECTOR ).forEach( ( element ) => {
				if ( element === display ) {
					return;
				}
				current.hiddenElements.push( {
					element,
					visibility: element.style.visibility,
				} );
				element.style.visibility = 'hidden';
			} );
		} );
		cleanupFrame.current = { editorWindow, requestId };
	},
	} );

	useEffect( () => {
		/* 有効dropの確定処理が終了してidleへ戻ったら、実Tableへ表示を引き継いで静止表示を解除する。 */
		if ( phase === 'idle' && activeDisplay.current !== null ) {
			clearCommitDisplay();
		}
	}, [ phase, clearCommitDisplay ] );

	useEffect( () => clearCommitDisplay, [ clearCommitDisplay ] );

	return null;
};