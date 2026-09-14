/**
 * Column Reorderモード中、現在操作しようとしているセルへ列の開始可否を予告表示する。
 *
 * 移動可能な列は現在セルだけを操作可能表示とし、結合範囲により移動できない列は現在セルだけを移動不可表示として区別する。
 * Presentation自身では列構造制約を解釈せず、Reorder Target Resolutionが返す開始可否だけを表示へ反映する。
 * Reorder Mode離脱は非React購読で受け取り、React renderを要求せず表示とResolverを破棄する。
 */

import { useEffect, useRef } from '@wordpress/element';
import type { PointerEvent, ReactNode } from 'react';

import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';
import {
	getColumnDndPhase,
	subscribeColumnDndState,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';
import { columnReorderMode } from '@/reorder/reorder-mode';
import { subscribeReorderMode } from '@/reorder/reorder-mode-subscription';

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
 * Resolverは最初の有効な開始可否判定で生成し、同一Highlight Lifecycle内で再利用する。
 * DnD開始時とColumn Reorder Mode離脱時は開始前表示とResolverを破棄する。
 * 開始可否は方向固有Reorder Mode APIから入力時に直接参照し、mode変更をReact props更新として要求しない。
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
	const resolver = useRef< ReturnType<
		typeof columnReorderTargetResolution.createResolver
	> | null >( null );
	const resolverTableIdentity = useRef< string | null >( null );

	useEffect( () => {
		resolver.current = null;
		resolverTableIdentity.current = null;

		const clearHighlightState = (): void => {
			clearVisualState( currentCell.current );
			currentCell.current = null;
		};

		const clearTransientHighlightState = (): void => {
			clearHighlightState();
			resolver.current = null;
			resolverTableIdentity.current = null;
		};

		const synchronizeDndLifecycle = (): void => {
			if ( getColumnDndPhase() === 'active' ) {
				clearTransientHighlightState();
			}
		};

		const unsubscribeDnd = subscribeColumnDndState( synchronizeDndLifecycle );
		const unsubscribeMode = subscribeReorderMode( tableIdentity, () => {
			/* Column Reorder Modeから離脱した時点で、React renderを待たず開始前表示とResolverを破棄する。 */
			if ( ! columnReorderMode.isActive( tableIdentity ) ) {
				clearTransientHighlightState();
			}
		} );

		return () => {
			unsubscribeDnd();
			unsubscribeMode();
			clearTransientHighlightState();
		};
	}, [ tableIdentity ] );

	const onPointerOverCapture: ColumnHighlightPointerOverHandler = ( event ) => {
		const cell = ( event.target as Element | null )?.closest(
			'th, td'
		) as HTMLTableCellElement | null;

		if ( cell !== null && cell === currentCell.current ) {
			return;
		}

		clearVisualState( currentCell.current );
		currentCell.current = null;
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

		if ( resolver.current === null || resolverTableIdentity.current !== tableIdentity ) {
			resolver.current = columnReorderTargetResolution.createResolver( tableIdentity );
			resolverTableIdentity.current = tableIdentity;
		}

		const resolution = resolver.current.resolve( sourceColumnIndex );
		currentCell.current = cell;

		if ( resolution.status === 'resolved' ) {
			cell.classList.add( HIGHLIGHTABLE_CELL_CLASS );
			return;
		}

		if ( resolution.status === 'rejected' ) {
			cell.classList.add( UNAVAILABLE_CELL_CLASS );
			currentCell.current = cell;
		}
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

		clearVisualState( cell );
		currentCell.current = null;
	};

	return children( onPointerOverCapture, onPointerOutCapture );
};
