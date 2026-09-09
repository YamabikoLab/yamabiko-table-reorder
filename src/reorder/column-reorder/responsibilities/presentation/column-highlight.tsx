/**
 * Column Reorderモード中、現在操作しようとしているセルへ列の開始可否を予告表示する。
 *
 * 移動可能な列は現在セルだけを操作可能表示とし、結合範囲により移動できない列は現在セルだけを移動不可表示として区別する。
 * Presentation自身では列構造制約を解釈せず、Reorder Target Resolutionが返す開始可否だけを表示へ反映する。
 * DnD開始後の移動対象列全体の表示はDnD中Presentationへ委ね、この責務では開始前の列全体表示を所有しない。
 */

import { useEffect, useRef } from '@wordpress/element';
import type { PointerEvent, ReactNode } from 'react';

import { useColumnDndPhase } from '@/reorder/column-reorder/integration/dnd-interaction-react';
import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';

import './column-highlight.scss';

const HIGHLIGHTABLE_CELL_CLASS = 'yamabiko-table-reorder-column-highlightable-cell';
const UNAVAILABLE_CELL_CLASS = 'yamabiko-table-reorder-column-unavailable-cell';

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
 * 現在セルの操作可否表示を解除する。
 *
 * @param cell 現在操作可否表示を持つセル。
 */
const clearVisualState = ( cell: HTMLTableCellElement | null ): void => {
	cell?.classList.remove( HIGHLIGHTABLE_CELL_CLASS, UNAVAILABLE_CELL_CLASS );
};

/**
 * 現在のTarget Resolution結果に応じて、DnD開始前のセルへ操作可能または移動不可を予告表示する。
 *
 * 同一render内の開始可否判定ではTarget Resolutionが提供する一つのResolverを利用し、Table制約をセルごとに取得し直さない。
 * Highlight自身はTable構造のsnapshotやrevision監視を所有せず、現在認識しているセルだけを一時的に保持する。
 * 同一セル内の要素間移動では開始可否を再解決せず、マウスが現在セルを離れた場合だけ表示を終了する。
 * タッチ入力では指を離しただけでは現在セルを解除せず、次に認識したセルまたは意味のあるLifecycle変更まで表示する。
 * DnD開始時はTarget Resolutionが要求時点の現在構造を再取得して最終判断するため、この表示は開始可否の権威を持たない。
 *
 * @param props               セル予告表示に必要な値。
 * @param props.enabled       現在のTableで列並び替えモードが有効な場合はtrue。
 * @param props.tableIdentity 列並び替え対象のTable Identity。
 * @param props.children      既存DOMへ操作対象判定とマウス終了処理を接続する描画処理。
 * @return 列の操作可否予告表示へ接続された子要素。
 */
export const ColumnHighlight = ( props: {
	enabled: boolean;
	tableIdentity: string;
	children: (
		onPointerOverCapture: ColumnHighlightPointerOverHandler,
		onPointerOutCapture: ColumnHighlightPointerOutHandler
	) => ReactNode;
} ) => {
	const { enabled, tableIdentity, children } = props;
	const dndPhase = useColumnDndPhase();
	const currentCell = useRef< HTMLTableCellElement | null >( null );
	const resolver =
		enabled && dndPhase === 'idle'
			? columnReorderTargetResolution.createResolver( tableIdentity )
			: null;

	useEffect( () => {
		/* モード終了、対象Table変更、DnD Lifecycle変更、またはPresentation境界終了時に開始前表示を実Tableへ残さない。 */
		return () => {
			clearVisualState( currentCell.current );
			currentCell.current = null;
		};
	}, [ enabled, tableIdentity, dndPhase ] );

	const onPointerOverCapture: ColumnHighlightPointerOverHandler = ( event ) => {
		const target = event.target as Element | null;
		const currentTarget = event.currentTarget;
		const table = currentTarget.querySelector( 'table' );
		const cell = target?.closest( 'th, td' ) as HTMLTableCellElement | null;

		/* 同一セル内の要素間移動では、同じ開始可否判定と表示を繰り返さない。 */
		if ( cell !== null && cell === currentCell.current ) {
			return;
		}

		clearVisualState( currentCell.current );
		currentCell.current = null;

		/* 列DnD開始前以外、または現在Tableへ直接属さないセルは操作可否予告の対象にしない。 */
		if (
			! enabled ||
			dndPhase !== 'idle' ||
			resolver === null ||
			! table ||
			! cell ||
			cell.closest( 'table' ) !== table
		) {
			return;
		}

		const sourceColumnIndex = resolveColumnSourceIndex( table, cell );

		/* 現在Tableの論理列へ対応付けられないセルでは、開始可否を推測しない。 */
		if ( sourceColumnIndex === null ) {
			return;
		}

		const resolution = resolver.resolve( sourceColumnIndex );
		currentCell.current = cell;

		/* 開始可能な列だけを現在セルで操作可能として予告する。 */
		if ( resolution.status === 'resolved' ) {
			cell.classList.add( HIGHLIGHTABLE_CELL_CLASS );
			return;
		}

		/* Designで理由を提示する開始拒否だけを、現在セルで事前に識別できる移動不可表示として示す。 */
		if ( resolution.status === 'rejected' ) {
			cell.classList.add( UNAVAILABLE_CELL_CLASS );
		}
	};

	const onPointerOutCapture: ColumnHighlightPointerOutHandler = ( event ) => {
		/* タッチでは指を離した後も現在操作対象として認識したセルを維持し、マウスだけhover終了として扱う。 */
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

		/* 現在セル内部の要素間移動では予告表示を維持し、マウスが現在セルを離れた場合だけ終了する。 */
		if ( remainsInsideCell ) {
			return;
		}

		clearVisualState( cell );
		currentCell.current = null;
	};

	return children( onPointerOverCapture, onPointerOutCapture );
};
