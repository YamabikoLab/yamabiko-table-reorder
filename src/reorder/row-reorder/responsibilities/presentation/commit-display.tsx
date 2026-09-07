/**
 * Row Reorderの有効drop後、Table更新が完了するまで移動完了位置を静止表示として維持する。
 *
 * DnD中のMoving RowとInsertion Gapからdrop時点の最終表示を引き継ぎ、Core Tableの確定処理へ入る前に
 * 移動行を最終位置へ固定する。確定中はアニメーション途中の表示を残さず、利用者には移動済みの配置だけを示す。
 * 静止表示はeditor文書座標へ配置し、Tableと同じ文書スクロールに追従する。Core Tableが所有する実DOM順は変更せず、
 * DnD Interactionがidleへ戻った時点で一時表示を解除する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { useCallback, useEffect, useRef } from '@wordpress/element';

import { useRowDndPhase } from '@/reorder/row-reorder/integration/dnd-interaction-react';
import { getRowDndDestinationBoundaryIndex } from '@/reorder/row-reorder/responsibilities/dnd-interaction';

const MOVING_DISPLAY_SELECTOR = '.yamabiko-table-reorder-moving-row';
const INSERTION_GAP_SELECTOR = '.yamabiko-table-reorder-insertion-gap';
const SOURCE_ROW_SELECTOR = '.yamabiko-table-reorder-moving-row-source';
const COMMIT_DISPLAY_CLASS = 'yamabiko-table-reorder-row-commit-display';
const COMMIT_PRESENTATION_SELECTOR = `${ MOVING_DISPLAY_SELECTOR }, ${ INSERTION_GAP_SELECTOR }`;

/** 確定中の静止表示と、表示を切り替えるため一時的に隠した既存Presentationを保持する。 */
type ActiveCommitDisplay = {
	display: HTMLElement;
	hiddenElements: Map< HTMLElement, string >;
};

/**
 * 確定表示と重複する既存Presentationを、元の表示指定を保持したまま一時的に隠す。
 *
 * @param activeDisplay 現在の確定表示と、その表示期間だけ隠す要素の集合。
 * @param element       確定表示と重複する既存Presentation。存在しない場合は何もしない。
 */
const hideDuringCommit = (
	activeDisplay: ActiveCommitDisplay,
	element: HTMLElement | null
): void => {
	if ( element === null || element === activeDisplay.display || activeDisplay.hiddenElements.has( element ) ) {
		return;
	}

	activeDisplay.hiddenElements.set( element, element.style.visibility );
	element.style.visibility = 'hidden';
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
		/* 確定表示へ切り替えるため隠した既存Presentationだけを、現在も同じeditor DOMに存在する場合に元へ戻す。 */
		current.hiddenElements.forEach( ( visibility, element ) => {
			if ( element.isConnected ) {
				element.style.visibility = visibility;
			}
		} );
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
			display.style.position = 'absolute';
			display.style.top = `${ gapRectangle.top + editorWindow.scrollY }px`;
			display.style.left = `${ gapRectangle.left + editorWindow.scrollX }px`;
			display.style.width = `${ movingRectangle.width }px`;
			display.style.height = `${ movingRectangle.height }px`;
			display.style.transform = 'none';
			editorDocument.body.append( display );

		const current: ActiveCommitDisplay = {
			display,
			hiddenElements: new Map(),
		};
		activeDisplay.current = current;

		/*
		 * 確定中は移動元、DnD中のMoving Row、Insertion Gapを表示せず、押しのけ済みTableと静止した移動行だけで
		 * 移動完了後の配置を示す。これにより固定座標のDnD表示をスクロール後へ持ち越さない。
		 */
		hideDuringCommit( current, editorDocument.querySelector< HTMLElement >( SOURCE_ROW_SELECTOR ) );
		hideDuringCommit( current, movingDisplay );
		hideDuringCommit( current, insertionGap );

		/*
		 * 同じ物理DnD終了で後から生成されるDrop Animationの複製も、Core Table更新前の最初の描画周期で隠す。
		 * 静止確定表示だけを残すことで、重いTable更新中にアニメーション途中の表示を凍結して見せない。
		 */
		const requestId = editorWindow.requestAnimationFrame( () => {
			cleanupFrame.current = null;
			const active = activeDisplay.current;
			if ( active === null || active.display !== display ) {
				return;
			}

			editorDocument
				.querySelectorAll< HTMLElement >( COMMIT_PRESENTATION_SELECTOR )
				.forEach( ( element ) => {
					hideDuringCommit( active, element );
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
