/**
 * Row Reorderモード中、現在のTarget Resolution結果に応じて行の操作可否を表示する。
 *
 * 移動可能な行は従来どおり操作可能表示とし、結合範囲により移動できない行は移動不可表示として区別する。
 * Presentation自身では行構造制約を解釈せず、Reorder Target Resolutionが返す開始可否だけを表示へ反映する。
 * Reorder Mode離脱は非React購読で受け取り、React renderを要求せず表示とResolverを破棄する。
 */

import { useCallback, useEffect, useRef } from '@wordpress/element';
import type { PointerEvent, ReactNode } from 'react';

import {
	getRowDndPhase,
	subscribeRowDndState,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import { rowReorderTargetResolution } from '@/reorder/row-reorder/responsibilities/target-resolution';
import { subscribeReorderMode } from '@/reorder/reorder-mode-subscription';

import './row-highlight.scss';

const HIGHLIGHTABLE_ROW_CLASS = 'yamabiko-table-reorder-row-highlightable';
const UNAVAILABLE_ROW_CLASS = 'yamabiko-table-reorder-row-unavailable';

/** 行ホバー表示が既存Block wrapperのポインター入力へ接続する処理。 */
export type RowHighlightPointerOverHandler = ( event: PointerEvent< Element > ) => void;

/**
 * 現在のTarget Resolution結果に応じて、行へ操作可能または移動不可の表示状態を反映する。
 *
 * Resolverは最初の有効な操作可否判定で生成し、同一Highlight Lifecycle内で再利用する。
 * DnD開始時とRow Reorder Mode離脱時は一時Resolverと表示を破棄する。
 * 開始可否は入力時に`isActive`から参照し、mode変更をReact props更新として要求しない。
 *
 * @param props               行表示に必要な値。
 * @param props.enabled       Highlight接続境界自体を利用できる場合はtrue。
 * @param props.isActive      現在Tableで行並び替えが有効かをevent-timeで返す処理。省略時はenabledを利用する。
 * @param props.tableIdentity 行並び替え対象のTable Identity。
 * @param props.children      既存DOMへホバー判定処理を接続する描画処理。
 * @return 行の操作可否表示へ接続された子要素。
 */
export const RowHighlight = ( props: {
	enabled: boolean;
	isActive?: () => boolean;
	tableIdentity: string;
	children: ( onPointerOverCapture: RowHighlightPointerOverHandler ) => ReactNode;
} ) => {
	const { enabled, isActive, tableIdentity, children } = props;
	const currentRow = useRef< HTMLTableRowElement | null >( null );
	const resolver = useRef< ReturnType< typeof rowReorderTargetResolution.createResolver > | null >(
		null
	);
	const resolverTableIdentity = useRef< string | null >( null );
	const resolveActive = useCallback( () => isActive?.() ?? enabled, [ enabled, isActive ] );

	useEffect( () => {
		resolver.current = null;
		resolverTableIdentity.current = null;

		const clearHighlightState = (): void => {
			currentRow.current?.classList.remove( HIGHLIGHTABLE_ROW_CLASS, UNAVAILABLE_ROW_CLASS );
			currentRow.current = null;
		};

		const clearTransientHighlightState = (): void => {
			clearHighlightState();
			resolver.current = null;
			resolverTableIdentity.current = null;
		};

		const synchronizeDndLifecycle = (): void => {
			if ( getRowDndPhase() === 'active' ) {
				clearTransientHighlightState();
			}
		};

		const unsubscribeDnd = enabled ? subscribeRowDndState( synchronizeDndLifecycle ) : () => {};
		const unsubscribeMode = subscribeReorderMode( tableIdentity, () => {
			/* Row Reorder Modeから離脱した時点で、React renderを待たず開始前表示とResolverを破棄する。 */
			if ( ! resolveActive() ) {
				clearTransientHighlightState();
			}
		} );

		return () => {
			unsubscribeDnd();
			unsubscribeMode();
			clearTransientHighlightState();
		};
	}, [ enabled, tableIdentity, resolveActive ] );

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
			! enabled ||
			! resolveActive() ||
			getRowDndPhase() !== 'idle' ||
			! tableBody ||
			! row ||
			row.parentElement !== tableBody
		) {
			return;
		}

		if ( resolver.current === null || resolverTableIdentity.current !== tableIdentity ) {
			resolver.current = rowReorderTargetResolution.createResolver( tableIdentity );
			resolverTableIdentity.current = tableIdentity;
		}

		const resolution = resolver.current.resolve( row.sectionRowIndex );

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
