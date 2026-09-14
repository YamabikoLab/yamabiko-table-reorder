/**
 * Row Reorderモード中、現在のTarget Resolution結果に応じて行の操作可否を表示する。
 *
 * 移動可能な行は従来どおり操作可能表示とし、結合範囲により移動できない行は移動不可表示として区別する。
 * Presentation自身では行構造制約を解釈せず、Reorder Target Resolutionが返す開始可否だけを表示へ反映する。
 * Reorder Mode離脱は非React購読で受け取り、React renderを要求せず表示を破棄する。
 */

import { useEffect, useRef } from '@wordpress/element';
import type { PointerEvent, ReactNode } from 'react';

import { rowReorderMode } from '@/reorder/reorder-mode';
import { subscribeReorderMode } from '@/reorder/reorder-mode-subscription';
import {
	getRowDndPhase,
	subscribeRowDndState,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import { resolveRowReorderTarget } from '@/reorder/row-reorder/responsibilities/target-resolution';

import './row-highlight.scss';

const HIGHLIGHTABLE_ROW_CLASS = 'yamabiko-table-reorder-row-highlightable';
const UNAVAILABLE_ROW_CLASS = 'yamabiko-table-reorder-row-unavailable';

/** 行ホバー表示が既存Block wrapperのポインター入力へ接続する処理。 */
export type RowHighlightPointerOverHandler = ( event: PointerEvent< Element > ) => void;

/**
 * 現在のTarget Resolution結果に応じて、行へ操作可能または移動不可の表示状態を反映する。
 *
 * hover対象が変わるたびに要求時点のTableから開始可否を解決する。
 * DnD開始時とRow Reorder Mode離脱時は開始前表示を破棄する。
 * 開始可否は方向固有Reorder Mode APIから入力時に直接参照し、mode変更をReact props更新として要求しない。
 *
 * @param props               行表示に必要な値。
 * @param props.tableIdentity 行並び替え対象のTable Identity。
 * @param props.children      既存DOMへホバー判定処理を接続する描画処理。
 * @return 行の操作可否表示へ接続された子要素。
 */
export const RowHighlight = ( props: {
	tableIdentity: string;
	children: ( onPointerOverCapture: RowHighlightPointerOverHandler ) => ReactNode;
} ) => {
	const { tableIdentity, children } = props;
	const currentRow = useRef< HTMLTableRowElement | null >( null );

	useEffect( () => {
		const clearHighlightState = (): void => {
			currentRow.current?.classList.remove( HIGHLIGHTABLE_ROW_CLASS, UNAVAILABLE_ROW_CLASS );
			currentRow.current = null;
		};

		const synchronizeDndLifecycle = (): void => {
			if ( getRowDndPhase() === 'active' ) {
				clearHighlightState();
			}
		};

		const unsubscribeDnd = subscribeRowDndState( synchronizeDndLifecycle );
		const unsubscribeMode = subscribeReorderMode( tableIdentity, () => {
			/* Row Reorder Modeから離脱した時点で、React renderを待たず開始前表示を破棄する。 */
			if ( ! rowReorderMode.isActive( tableIdentity ) ) {
				clearHighlightState();
			}
		} );

		return () => {
			unsubscribeDnd();
			unsubscribeMode();
			clearHighlightState();
		};
	}, [ tableIdentity ] );

	const onPointerOverCapture: RowHighlightPointerOverHandler = ( event ) => {
		const target = event.target as Element | null;
		const currentTarget = event.currentTarget;
		const table = currentTarget.querySelector( 'table' );
		const tableBody = table?.tBodies.item( 0 ) ?? null;
		const row = target?.closest( 'tr' ) as HTMLTableRowElement | null;

		if ( row !== null && row === currentRow.current ) {
			return;
		}

		currentRow.current?.classList.remove( HIGHLIGHTABLE_ROW_CLASS, UNAVAILABLE_ROW_CLASS );
		currentRow.current = null;

		if (
			! rowReorderMode.isActive( tableIdentity ) ||
			getRowDndPhase() !== 'idle' ||
			! tableBody ||
			! row ||
			row.parentElement !== tableBody
		) {
			return;
		}

		const resolution = resolveRowReorderTarget( {
			tableIdentity,
			sourceRowIndex: row.sectionRowIndex,
		} );

		if ( resolution.status === 'resolved' ) {
			row.classList.add( HIGHLIGHTABLE_ROW_CLASS );
			currentRow.current = row;
			return;
		}

		if ( resolution.status === 'rejected' ) {
			row.classList.add( UNAVAILABLE_ROW_CLASS );
			currentRow.current = row;
		}
	};

	return children( onPointerOverCapture );
};
