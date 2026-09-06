/**
 * Row Reorderモード中、現在のTarget Resolution結果に応じて行の操作可否を表示する。
 *
 * 移動可能な行は従来どおり操作可能表示とし、結合範囲により移動できない行は移動不可表示として区別する。
 * Presentation自身では行構造制約を解釈せず、Reorder Target Resolutionが返す開始可否だけを表示へ反映する。
 */

import { useEffect, useRef } from '@wordpress/element';
import type { PointerEvent, ReactNode } from 'react';

import { rowReorderTargetResolution } from '@/reorder/row-reorder/target-resolution';

import './row-highlight.scss';

const HIGHLIGHTABLE_ROW_CLASS = 'yamabiko-table-reorder-row-highlightable';
const UNAVAILABLE_ROW_CLASS = 'yamabiko-table-reorder-row-unavailable';

/** 行ホバー表示が既存Block wrapperのポインター入力へ接続する処理。 */
export type RowHighlightPointerOverHandler = ( event: PointerEvent< Element > ) => void;

/**
 * 現在のTarget Resolution結果に応じて、行へ操作可能または移動不可の表示状態を反映する。
 *
 * 同一Tableの判定では一つのResolverを利用し、Table構造を行ごとに取得し直さない。
 * DnD開始時はTarget Resolutionが要求時点の現在構造を再取得して最終判断するため、この表示は開始可否の権威を持たない。
 *
 * @param props               行表示に必要な値。
 * @param props.enabled       現在のTableで行並び替えモードが有効な場合はtrue。
 * @param props.tableIdentity 行並び替え対象のTable Identity。
 * @param props.children      既存DOMへホバー判定処理を接続する描画処理。
 * @return 行の操作可否表示へ接続された子要素。
 */
export const RowHighlight = ( props: {
	enabled: boolean;
	tableIdentity: string;
	children: ( onPointerOverCapture: RowHighlightPointerOverHandler ) => ReactNode;
} ) => {
	const { enabled, tableIdentity, children } = props;
	const currentRow = useRef< HTMLTableRowElement | null >( null );
	const resolver = enabled ? rowReorderTargetResolution.createResolver( tableIdentity ) : null;

	useEffect( () => {
		/* モード終了、対象Table変更、またはPresentation境界終了時に一時的な操作可否表示を実Tableへ残さない。 */
		return () => {
			currentRow.current?.classList.remove( HIGHLIGHTABLE_ROW_CLASS, UNAVAILABLE_ROW_CLASS );
			currentRow.current = null;
		};
	}, [ enabled, tableIdentity ] );

	const onPointerOverCapture: RowHighlightPointerOverHandler = ( event ) => {
		const target = event.target as Element | null;
		const currentTarget = event.currentTarget;
		const table = currentTarget.querySelector( 'table' );
		const tableBody = table?.tBodies.item( 0 ) ?? null;
		const row = target?.closest( 'tr' ) as HTMLTableRowElement | null;

		/* 同じ行の内部要素間を移動している間は、同じ表示判定を繰り返さない。 */
		if ( row !== null && row === currentRow.current ) {
			return;
		}

		currentRow.current?.classList.remove( HIGHLIGHTABLE_ROW_CLASS, UNAVAILABLE_ROW_CLASS );
		currentRow.current = null;

		/* 行並び替えモード外、または対象Tableのtbody直下行でない位置は操作可否表示の対象にしない。 */
		if (
			! enabled ||
			resolver === null ||
			! tableBody ||
			! row ||
			row.parentElement !== tableBody
		) {
			return;
		}

		const resolution = resolver.resolve( row.sectionRowIndex );

		/* 開始可能な行だけを操作可能として示す。 */
		if ( resolution.status === 'resolved' ) {
			row.classList.add( HIGHLIGHTABLE_ROW_CLASS );
			currentRow.current = row;
			return;
		}

		/* Designで理由を提示する開始拒否だけを、利用者が事前に識別できる移動不可表示として示す。 */
		if ( resolution.status === 'rejected' ) {
			row.classList.add( UNAVAILABLE_ROW_CLASS );
			currentRow.current = row;
		}
	};

	return children( onPointerOverCapture );
};
