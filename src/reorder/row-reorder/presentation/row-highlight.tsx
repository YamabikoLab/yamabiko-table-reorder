/**
 * Row Reorderモード中、現在のTable制約に対して行単位で移動可能な行だけをホバー表示の対象にする。
 *
 * Table Block固有の縦結合表現は解釈せず、Table Integrationが公開する分断不可境界だけを利用する。
 * 行単位で移動できない行には操作可能表示を付けず、DnD開始可否と利用者向け表示の意味を一致させる。
 */

import { useEffect, useRef } from '@wordpress/element';
import type { PointerEvent, ReactNode } from 'react';

import { rowTableIntegration } from '@/reorder/row-reorder/table-integration';

import './row-highlight.scss';

const HIGHLIGHTABLE_ROW_CLASS = 'yamabiko-table-reorder-row-highlightable';

/** 行ホバー表示が既存Block wrapperのポインター入力へ接続する処理。 */
export type RowHighlightPointerOverHandler = ( event: PointerEvent< Element > ) => void;

/**
 * 現在のTable制約に対して行単位で移動可能な行だけを、ホバー表示とgrabカーソルの対象として識別する。
 *
 * 制約情報は描画時点でTable Integrationから取得し、ポインター移動のたびにTable全体を再解析しない。
 * DnD開始時の可否はDnD Interactionが現在制約を再取得して最終判断するため、この表示は開始可否の権威を持たない。
 *
 * @param props               行ホバー表示に必要な値。
 * @param props.enabled       現在のTableで行並び替えモードが有効な場合はtrue。
 * @param props.tableIdentity 行並び替え対象のTable Identity。
 * @param props.children      既存DOMへホバー判定処理を接続する描画処理。
 * @return 行ホバー表示へ接続された子要素。
 */
export const RowHighlight = ( props: {
	enabled: boolean;
	tableIdentity: string;
	children: ( onPointerOverCapture: RowHighlightPointerOverHandler ) => ReactNode;
} ) => {
	const { enabled, tableIdentity, children } = props;
	const highlightedRow = useRef< HTMLTableRowElement | null >( null );
	const constraints = enabled ? rowTableIntegration.getConstraints( tableIdentity ) : null;

	useEffect( () => {
		/* モード終了、対象Table変更、またはPresentation境界終了時に一時的な操作可能表示を実Tableへ残さない。 */
		return () => {
			highlightedRow.current?.classList.remove( HIGHLIGHTABLE_ROW_CLASS );
			highlightedRow.current = null;
		};
	}, [ enabled, tableIdentity ] );

	const onPointerOverCapture: RowHighlightPointerOverHandler = ( event ) => {
		const target = event.target as Element | null;
		const currentTarget = event.currentTarget;
		const table = currentTarget.querySelector( 'table' );
		const tableBody = table?.tBodies.item( 0 ) ?? null;
		const row = target?.closest( 'tr' ) as HTMLTableRowElement | null;

		/* 同じ行の内部要素間を移動している間は、同じ表示判定を繰り返さない。 */
		if ( row !== null && row === highlightedRow.current ) {
			return;
		}

		highlightedRow.current?.classList.remove( HIGHLIGHTABLE_ROW_CLASS );
		highlightedRow.current = null;

		/* 行並び替えモード外、制約取得不能、または対象Tableのtbody直下行でない位置は操作可能表示の対象にしない。 */
		if (
			! enabled ||
			constraints === null ||
			! tableBody ||
			! row ||
			row.parentElement !== tableBody
		) {
			return;
		}

		const rowIndex = row.sectionRowIndex;
		const rowInRange = rowIndex >= 0 && rowIndex < constraints.rowCount;
		const blockedByMergedRange =
			constraints.blockedBoundaries.includes( rowIndex ) ||
			constraints.blockedBoundaries.includes( rowIndex + 1 );

		/* 現在制約で実在し、直前・直後のどちらも縦結合の分断不可境界でない行だけを行単位の移動対象として示す。 */
		if ( ! rowInRange || blockedByMergedRange ) {
			return;
		}

		row.classList.add( HIGHLIGHTABLE_ROW_CLASS );
		highlightedRow.current = row;
	};

	return children( onPointerOverCapture );
};
