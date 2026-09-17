/**
 * Column Reorderモード中、現在操作しようとしているセルへ列の開始可否を予告表示する。
 *
 * 移動可能な列と結合範囲により移動できない列は、対象セルの現在位置を基準にYTR所有の表示として区別する。
 * Presentation自身では列構造制約を解釈せず、Reorder Target Resolutionが返す開始可否だけを表示へ反映する。
 * Highlight表示はTable subtreeのReact renderへ伝播させず、表示開始時の位置を一時的なPresentation snapshotとして扱う。
 */

import { useCallback, useEffect, useRef } from '@wordpress/element';
import type { PointerEvent, ReactNode } from 'react';

import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';
import {
	getColumnDndPhase,
	subscribeColumnDndState,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { resolveColumnReorderTarget } from '@/reorder/column-reorder/responsibilities/target-resolution';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { columnReorderMode } from '@/reorder/reorder-mode';
import { subscribeReorderMode } from '@/reorder/reorder-mode-subscription';

import './column-highlight.scss';

const HIGHLIGHT_CLASS = 'yamabiko-table-reorder-column-highlight';
const HIGHLIGHT_RESOLVED_CLASS = 'yamabiko-table-reorder-column-highlight-resolved';
const HIGHLIGHT_REJECTED_CLASS = 'yamabiko-table-reorder-column-highlight-rejected';
const CURSOR_GRAB_CLASS = 'yamabiko-table-reorder-column-highlight-cursor-grab';
const CURSOR_DEFAULT_CLASS = 'yamabiko-table-reorder-column-highlight-cursor-default';

type ColumnHighlightStatus = 'resolved' | 'rejected';

type ColumnHighlightPresentation = {
	overlay: HTMLDivElement;
	editorDocument: Document;
	onScroll: EventListener;
};

/**
 * 列の操作可否表示が既存Block wrapperのポインター入力へ接続する処理。
 *
 * @param event 現在の操作可否表示対象を解決するポインター入力。
 */
export type ColumnHighlightPointerOverHandler = ( event: PointerEvent< Element > ) => void;

/**
 * マウスのセル予告表示が既存Block wrapperの終了入力へ接続する処理。
 *
 * @param event マウスポインターが現在の操作対象セルから離れたことを判断する入力。
 */
export type ColumnHighlightPointerOutHandler = ( event: PointerEvent< Element > ) => void;

/**
 * 現在セルの開始可否表示をYTR所有DOMへ生成する。
 *
 * 表示開始時のセル位置だけを使用し、その後のBlock再描画やDOM再接続を追跡しない。
 * cursorはEditor Documentのbodyが所有し、overlay自身は入力を受け取らない。
 *
 * @param cell      現在操作対象として確定したセル。
 * @param status    Target Resolutionが確定した開始可否。
 * @param onCleanup 実際のscroll発生時にHighlight全体を終了する処理。
 * @return Highlightの一時Presentation。Editor DOM Contextを解決できない場合はnull。
 */
const createHighlightPresentation = (
	cell: HTMLTableCellElement,
	status: ColumnHighlightStatus,
	onCleanup: () => void
): ColumnHighlightPresentation | null => {
	const editorContext = resolveEditorDomContext( cell );

	/* 現在セルと同じEditor DOM Contextを解決できない場合は、別documentへ表示を生成しない。 */
	if ( editorContext === null ) {
		return null;
	}

	const rectangle = cell.getBoundingClientRect();
	const overlay = editorContext.document.createElement( 'div' );
	overlay.classList.add( HIGHLIGHT_CLASS );
	overlay.classList.add(
		status === 'resolved' ? HIGHLIGHT_RESOLVED_CLASS : HIGHLIGHT_REJECTED_CLASS
	);
	overlay.style.top = `${ rectangle.top }px`;
	overlay.style.left = `${ rectangle.left }px`;
	overlay.style.width = `${ rectangle.width }px`;
	overlay.style.height = `${ rectangle.height }px`;
	editorContext.document.body.appendChild( overlay );

	const cursorClass = status === 'resolved' ? CURSOR_GRAB_CLASS : CURSOR_DEFAULT_CLASS;
	editorContext.document.body.classList.add( cursorClass );

	const onScroll: EventListener = () => {
		onCleanup();
	};
	editorContext.document.addEventListener( 'scroll', onScroll, true );

	return {
		overlay,
		editorDocument: editorContext.document,
		onScroll,
	};
};

/**
 * 現在のTarget Resolution結果に応じて、DnD開始前のセル位置へ操作可能または移動不可を予告表示する。
 *
 * pointer入力時に要求時点のTableから開始可否と表示位置を解決し、成立したHighlightは次の入力またはcleanupまで固定する。
 * DnD開始、Column Reorder Mode離脱、マウスの対象セル離脱、実際のscroll発生では開始前表示を破棄する。
 * 表示変更はYTR所有DOMだけを命令的に更新し、配下のBlock subtreeをReact再描画しない。
 *
 * @param props               セル予告表示に必要な値。
 * @param props.tableIdentity 列並び替え対象のTable Identity。
 * @param props.children      既存DOMへ操作対象判定とマウス終了処理を接続する描画処理。
 * @return 列の操作可否予告表示へ接続された子要素。
 */
export const ColumnHighlight = ( props: {
	tableIdentity: string;
	children: (
		onPointerOverCapture: ColumnHighlightPointerOverHandler,
		onPointerOutCapture: ColumnHighlightPointerOutHandler
	) => ReactNode;
} ) => {
	const { tableIdentity, children } = props;
	const currentCell = useRef< HTMLTableCellElement | null >( null );
	const currentPresentation = useRef< ColumnHighlightPresentation | null >( null );

	const clearHighlightState = useCallback( (): void => {
		const presentation = currentPresentation.current;

		if ( presentation !== null ) {
			presentation.editorDocument.removeEventListener( 'scroll', presentation.onScroll, true );
			presentation.overlay.remove();
			presentation.editorDocument.body.classList.remove(
				CURSOR_GRAB_CLASS,
				CURSOR_DEFAULT_CLASS
			);
		}

		currentPresentation.current = null;
		currentCell.current = null;
	}, [] );

	useEffect( () => {
		const synchronizeDndLifecycle = (): void => {
			if ( getColumnDndPhase() === 'active' ) {
				clearHighlightState();
			}
		};

		const unsubscribeDnd = subscribeColumnDndState( synchronizeDndLifecycle );
		const unsubscribeMode = subscribeReorderMode( tableIdentity, () => {
			/* Column Reorder Modeから離脱した時点で、React renderを待たず開始前表示を破棄する。 */
			if ( ! columnReorderMode.isActive( tableIdentity ) ) {
				clearHighlightState();
			}
		} );

		return () => {
			unsubscribeDnd();
			unsubscribeMode();
			clearHighlightState();
		};
	}, [ clearHighlightState, tableIdentity ] );

	const onPointerOverCapture: ColumnHighlightPointerOverHandler = ( event ) => {
		const cell = ( event.target as Element | null )?.closest(
			'th, td'
		) as HTMLTableCellElement | null;

		if ( cell !== null && cell === currentCell.current ) {
			return;
		}

		clearHighlightState();
		const table = event.currentTarget.querySelector( 'table' );

		if (
			! columnReorderMode.isActive( tableIdentity ) ||
			getColumnDndPhase() !== 'idle' ||
			! table ||
			! cell ||
			cell.closest( 'table' ) !== table
		) {
			return;
		}

		const sourceColumnIndex = resolveColumnSourceIndex( table, cell );

		if ( sourceColumnIndex === null ) {
			return;
		}

		const resolution = resolveColumnReorderTarget( {
			tableIdentity,
			sourceColumnIndex,
		} );

		if ( resolution.status !== 'resolved' && resolution.status !== 'rejected' ) {
			return;
		}

		const presentation = createHighlightPresentation(
			cell,
			resolution.status,
			clearHighlightState
		);

		if ( presentation === null ) {
			return;
		}

		currentCell.current = cell;
		currentPresentation.current = presentation;
	};

	const onPointerOutCapture: ColumnHighlightPointerOutHandler = ( event ) => {
		if ( event.pointerType !== 'mouse' ) {
			return;
		}

		const cell = currentCell.current;
		const relatedTarget = event.relatedTarget;
		const relatedNode =
			typeof relatedTarget === 'object' && relatedTarget !== null && 'nodeType' in relatedTarget
				? ( relatedTarget as Node )
				: null;
		const remainsInsideCell = cell !== null && relatedNode !== null && cell.contains( relatedNode );

		if ( remainsInsideCell ) {
			return;
		}

		clearHighlightState();
	};

	return children( onPointerOverCapture, onPointerOutCapture );
};
