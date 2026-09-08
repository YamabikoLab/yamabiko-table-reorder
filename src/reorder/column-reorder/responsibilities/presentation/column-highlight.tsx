/**
 * Column Reorderモード中、現在のTarget Resolution結果に応じて列の操作可否を表示する。
 *
 * 移動可能な列は操作可能表示とし、結合範囲により移動できない列は移動不可表示として区別する。
 * Presentation自身では列構造制約を解釈せず、Reorder Target Resolutionが返す開始可否だけを表示へ反映する。
 * 大規模Tableではホバーごとに全行を更新せず、現在のeditor表示領域へ一つの列表示を重ねる。
 */

import { useEffect, useRef } from '@wordpress/element';
import type { PointerEvent, ReactNode } from 'react';

import {
	createColumnSourceIndexResolver,
	type ColumnSourceIndexResolver,
} from '@/reorder/column-reorder/integration/source-column-resolution';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';

import './column-highlight.scss';

const HIGHLIGHTABLE_CELL_CLASS = 'yamabiko-table-reorder-column-highlightable-cell';
const UNAVAILABLE_CELL_CLASS = 'yamabiko-table-reorder-column-unavailable-cell';
const HIGHLIGHT_OVERLAY_CLASS = 'yamabiko-table-reorder-column-highlight';
const HIGHLIGHTABLE_OVERLAY_CLASS = 'yamabiko-table-reorder-column-highlight--highlightable';
const UNAVAILABLE_OVERLAY_CLASS = 'yamabiko-table-reorder-column-highlight--unavailable';

/** Reorder Target Resolutionの意味状態を操作可否表示へ反映するための表示状態。 */
type ColumnHighlightStatus = 'resolved' | 'rejected' | 'unavailable';

/** 同じ論理列内で開始可否の再判定を避けるために保持する現在の表示判断。 */
type ColumnHighlightState = {
	sourceColumnIndex: number;
	status: ColumnHighlightStatus;
};

/** 現在Tableのセルと論理列位置の対応を、そのTableと組にして保持する一時的な解決基準。 */
type CachedSourceResolver = {
	table: HTMLTableElement;
	resolver: ColumnSourceIndexResolver;
};

/**
 * 列ホバー表示が既存Block wrapperのポインター入力へ接続する処理。
 *
 * @param event 現在の操作可否表示対象を解決するポインター入力。
 */
export type ColumnHighlightPointerOverHandler = ( event: PointerEvent< Element > ) => void;

/**
 * 現在の操作可否表示を対象セルとeditor上の列表示から解除する。
 *
 * @param cell    現在ポインター表示を持つセル。
 * @param overlay 現在editorへ重ねている列表示。
 */
const clearVisualState = (
	cell: HTMLTableCellElement | null,
	overlay: HTMLDivElement | null
): void => {
	cell?.classList.remove( HIGHLIGHTABLE_CELL_CLASS, UNAVAILABLE_CELL_CLASS );
	overlay?.remove();
};

/**
 * 現在表示中のTable範囲へ、対象セルの横位置を基準とした列表示を生成する。
 *
 * Table全行のセルを更新せず、現在のeditor表示領域と対象セルの表示矩形だけから一つの表示領域を作る。
 * 結合セル上では対象セル全体を示し、移動不可となる結合範囲を視覚的に確認できるようにする。
 *
 * @param table  Column Reorder対象Table。
 * @param cell   現在ポインターがある対象セル。
 * @param status Target Resolutionが返した利用者向け表示状態。
 * @return editorへ追加した列表示。表示領域を成立させられない場合はnull。
 */
const createHighlightOverlay = (
	table: HTMLTableElement,
	cell: HTMLTableCellElement,
	status: Exclude< ColumnHighlightStatus, 'unavailable' >
): HTMLDivElement | null => {
	const editorDocument = cell.ownerDocument;
	const editorWindow = editorDocument.defaultView;

	/* 現在のeditor表示領域を取得できない場合は、安全な列表示領域を生成しない。 */
	if ( editorWindow === null || editorDocument.body === null ) {
		return null;
	}

	const tableRectangle = table.getBoundingClientRect();
	const cellRectangle = cell.getBoundingClientRect();
	const top = Math.max( tableRectangle.top, 0 );
	const bottom = Math.min( tableRectangle.bottom, editorWindow.innerHeight );
	const left = Math.max( cellRectangle.left, 0 );
	const right = Math.min( cellRectangle.right, editorWindow.innerWidth );
	const width = right - left;
	const height = bottom - top;

	/* editor表示領域内に対象列を示せる範囲がない場合は、一時表示を生成しない。 */
	if ( width <= 0 || height <= 0 ) {
		return null;
	}

	const overlay = editorDocument.createElement( 'div' );
	const statusClass =
		status === 'resolved' ? HIGHLIGHTABLE_OVERLAY_CLASS : UNAVAILABLE_OVERLAY_CLASS;
	overlay.className = `${ HIGHLIGHT_OVERLAY_CLASS } ${ statusClass }`;
	overlay.setAttribute( 'aria-hidden', 'true' );
	overlay.style.left = `${ left }px`;
	overlay.style.top = `${ top }px`;
	overlay.style.width = `${ width }px`;
	overlay.style.height = `${ height }px`;
	editorDocument.body.append( overlay );
	return overlay;
};

/**
 * 現在のTarget Resolution結果に応じて、列へ操作可能または移動不可の表示状態を反映する。
 *
 * Target Resolutionとセル→論理列対応は同一Tableで一度生成したResolverを再利用する。
 * これにより、ホバー対象変更ごとにTable構造または対象行までのDOMを走査し直さない。
 * DnD開始時はTarget Resolutionが要求時点の現在構造を再取得して最終判断するため、この表示は開始可否の権威を持たない。
 *
 * @param props               列表示に必要な値。
 * @param props.enabled       現在のTableで列並び替えモードが有効な場合はtrue。
 * @param props.tableIdentity 列並び替え対象のTable Identity。
 * @param props.children      既存DOMへホバー判定処理を接続する描画処理。
 * @return 列の操作可否表示へ接続された子要素。
 */
export const ColumnHighlight = ( props: {
	enabled: boolean;
	tableIdentity: string;
	children: ( onPointerOverCapture: ColumnHighlightPointerOverHandler ) => ReactNode;
} ) => {
	const { enabled, tableIdentity, children } = props;
	const targetResolver = useRef< ReturnType<
		typeof columnReorderTargetResolution.createResolver
	> | null >( null );
	const sourceResolver = useRef< CachedSourceResolver | null >( null );
	const currentState = useRef< ColumnHighlightState | null >( null );
	const currentCell = useRef< HTMLTableCellElement | null >( null );
	const currentOverlay = useRef< HTMLDivElement | null >( null );

	useEffect( () => {
		/* モード終了、対象Table変更、またはPresentation境界終了時に一時的な操作可否表示と解決基準を残さない。 */
		return () => {
			clearVisualState( currentCell.current, currentOverlay.current );
			currentCell.current = null;
			currentOverlay.current = null;
			currentState.current = null;
			targetResolver.current = null;
			sourceResolver.current = null;
		};
	}, [ enabled, tableIdentity ] );

	/**
	 * 現在の開始可否判断を、ポインター下のセルとeditor上の列表示へ反映する。
	 *
	 * @param table  Column Reorder対象Table。
	 * @param cell   現在ポインターがある対象セル。
	 * @param status Target Resolutionが返した操作可能または開始拒否の意味状態。
	 */
	const applyVisualState = (
		table: HTMLTableElement,
		cell: HTMLTableCellElement,
		status: Exclude< ColumnHighlightStatus, 'unavailable' >
	): void => {
		clearVisualState( currentCell.current, currentOverlay.current );
		const cellClass =
			status === 'resolved' ? HIGHLIGHTABLE_CELL_CLASS : UNAVAILABLE_CELL_CLASS;
		cell.classList.add( cellClass );
		currentCell.current = cell;
		currentOverlay.current = createHighlightOverlay( table, cell, status );
	};

	const onPointerOverCapture: ColumnHighlightPointerOverHandler = ( event ) => {
		const target = event.target as Element | null;
		const currentTarget = event.currentTarget;
		const table = currentTarget.querySelector( 'table' );
		const cell = target?.closest( 'th, td' ) as HTMLTableCellElement | null;

		/* 列並び替えモード外、または現在Tableへ直接属さないセルは操作可否表示の対象にしない。 */
		if ( ! enabled || ! table || ! cell || cell.closest( 'table' ) !== table ) {
			clearVisualState( currentCell.current, currentOverlay.current );
			currentCell.current = null;
			currentOverlay.current = null;
			currentState.current = null;
			return;
		}

		/* 現在Tableのセル対応は最初の表示判定時に一度だけ解釈し、その後のホバー判定で再利用する。 */
		if ( sourceResolver.current === null || sourceResolver.current.table !== table ) {
			sourceResolver.current = {
				table,
				resolver: createColumnSourceIndexResolver( table ),
			};
		}

		const sourceColumnIndex = sourceResolver.current.resolver.resolve( cell );

		/* 現在Tableの論理列へ対応付けられないセルでは、開始可否を推測せず既存表示も解除する。 */
		if ( sourceColumnIndex === null ) {
			clearVisualState( currentCell.current, currentOverlay.current );
			currentCell.current = null;
			currentOverlay.current = null;
			currentState.current = null;
			return;
		}

		/* 同じ論理列内では開始可否を再判定せず、現在ポインター下のセルへ表示だけを追従させる。 */
		if ( currentState.current?.sourceColumnIndex === sourceColumnIndex ) {
			const status = currentState.current.status;
			if ( status === 'resolved' || status === 'rejected' ) {
				applyVisualState( table, cell, status );
			}
			return;
		}

		clearVisualState( currentCell.current, currentOverlay.current );
		currentCell.current = null;
		currentOverlay.current = null;

		/* 同一Tableの開始可否判定は一つのResolverを利用し、ホバー対象変更ごとにTable制約を取得し直さない。 */
		if ( targetResolver.current === null ) {
			targetResolver.current = columnReorderTargetResolution.createResolver( tableIdentity );
		}

		const resolution = targetResolver.current.resolve( sourceColumnIndex );
		currentState.current = {
			sourceColumnIndex,
			status: resolution.status,
		};

		/* 開始可能な列だけを操作可能として示す。 */
		if ( resolution.status === 'resolved' ) {
			applyVisualState( table, cell, 'resolved' );
			return;
		}

		/* Designで理由を提示する開始拒否だけを、利用者が事前に識別できる移動不可表示として示す。 */
		if ( resolution.status === 'rejected' ) {
			applyVisualState( table, cell, 'rejected' );
		}
	};

	return children( onPointerOverCapture );
};
