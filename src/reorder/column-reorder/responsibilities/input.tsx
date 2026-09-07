/**
 * 列並び替えのPCポインター入力開始条件とDnD開始対象の接続を所有する。
 *
 * 現在Table内のセルから移動元論理列を解決し、第一段階のReorder Target Resolutionで
 * 開始可能な列だけをdnd-kitのDraggableへ一時登録する。
 * タッチ入力、active DnD成立後の進行、移動先解決、確定、取消はこの責務では扱わない。
 */

import { Draggable, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import type { PointerEvent, ReactNode } from 'react';

import { columnReorderTargetResolution, type ColumnReorderTarget } from './target-resolution';

/**
 * 列DnDを既存DOMのPCポインター入力へ接続する開始処理。
 *
 * @param event 現在Table内で列DnD開始候補を判定するPCポインター入力。
 */
export type ColumnDndPointerDownHandler = ( event: PointerEvent< Element > ) => void;

/** 各論理列で、前の行から継続するrowspanが残っている行数。 */
type RemainingRowSpan = number[];

/**
 * 現在行でセルを配置できる次の論理列位置を解決する。
 *
 * @param remainingRowSpans 前の行から継続する縦結合の占有状態。
 * @param startIndex        探索を開始する論理列位置。
 * @return 現在行で次のセルを配置できる論理列位置。
 */
const resolveNextAvailableColumnIndex = (
	remainingRowSpans: RemainingRowSpan,
	startIndex: number
): number => {
	let columnIndex = startIndex;

	/* 前行から継続する縦結合が占有する列を除外し、現在セルが開始する論理列を求める。 */
	while ( ( remainingRowSpans[ columnIndex ] ?? 0 ) > 0 ) {
		columnIndex += 1;
	}

	return columnIndex;
};

/**
 * 現在Table内のセルが開始する0-based論理列位置を解決する。
 *
 * DOM上のcellIndexは横結合や前行から継続する縦結合を論理列として表さないため、
 * 対象sectionの先頭から結合範囲を反映してセル配置を解釈する。
 * 対象セルが現在Table直下のhead / body / footに属さない場合は解決しない。
 *
 * @param table      列並び替え対象のTable。
 * @param targetCell PC入力が開始されたTableセル。
 * @return 対象セルが開始する0-based論理列位置。安全に解釈できない場合はnull。
 */
const resolveSourceColumnIndex = (
	table: HTMLTableElement,
	targetCell: HTMLTableCellElement
): number | null => {
	const targetRow = targetCell.parentElement;
	const targetSection = targetRow?.parentElement;

	/* 現在Table直下の標準sectionに属するセルだけを列開始対象として解釈する。 */
	if (
		! targetRow ||
		targetRow.tagName !== 'TR' ||
		! targetSection ||
		! [ 'THEAD', 'TBODY', 'TFOOT' ].includes( targetSection.tagName ) ||
		targetSection.parentElement !== table
	) {
		return null;
	}

	const section = targetSection as HTMLTableSectionElement;
	const remainingRowSpans: RemainingRowSpan = [];

	/* 対象行までの結合範囲を引き継ぎ、入力セルがTable全体のどの論理列から始まるかを解決する。 */
	for ( const row of Array.from( section.rows ) ) {
		let nextColumnIndex = 0;

		/* 現在行の各セルを横結合幅と継続中の縦結合へ照合し、Table全体の論理列位置へ対応付ける。 */
		for ( const cell of Array.from( row.cells ) ) {
			const columnStart = resolveNextAvailableColumnIndex( remainingRowSpans, nextColumnIndex );
			const columnSpan = Math.max( cell.colSpan, 1 );
			const columnEnd = columnStart + columnSpan;

			if ( cell === targetCell ) {
				return columnStart;
			}

			const rowSpan = Math.max( cell.rowSpan, 1 );

			/* 後続行でも占有される論理列を保持し、同じ位置へ別セルを割り当てない。 */
			if ( rowSpan > 1 ) {
				/* 縦結合セルが覆うすべての論理列を、後続行で利用できない占有範囲として記録する。 */
				for ( let index = columnStart; index < columnEnd; index += 1 ) {
					remainingRowSpans[ index ] = Math.max( remainingRowSpans[ index ] ?? 0, rowSpan );
				}
			}

			nextColumnIndex = columnEnd;
		}

		/* 次行へ進む前に現在行で消費した縦結合期間を1行分減らす。 */
		for ( let index = 0; index < remainingRowSpans.length; index += 1 ) {
			const remaining = remainingRowSpans[ index ] ?? 0;
			remainingRowSpans[ index ] = Math.max( remaining - 1, 0 );
		}

		if ( row === targetRow ) {
			return null;
		}
	}

	return null;
};

/**
 * PCポインター入力から列DnD開始候補を解決し、現在の入力で必要な列だけをDraggableへ登録する。
 *
 * 第一段階のReorder Target Resolutionで開始可能な列だけを物理DnDへ接続する。
 * 入力ごとに登録したDraggableは次の開始候補へ持ち越さず、常に現在の開始候補だけを有効にする。
 * タッチ入力はPhase 6で同じ入力責務へ接続するため、このPhaseでは受理しない。
 *
 * @param props                         PC入力接続に必要な値。
 * @param props.enabled                 現在のTableで列並び替え開始入力を受け付ける場合はtrue。
 * @param props.tableIdentity           列並び替え対象のTable Identity。
 * @param props.activeDraggable         現在のポインター入力で登録したDraggableを保持する参照。
 * @param props.activeDraggable.current 現在のポインター入力で登録したDraggable。未登録の場合はnull。
 * @param props.children                既存DOMへポインター開始処理を接続する描画処理。
 * @return PCポインター入力による列DnD開始へ接続された子要素。
 */
export const ColumnInput = ( props: {
	enabled: boolean;
	tableIdentity: string;
	activeDraggable: {
		current: Draggable | null;
	};
	children: ( onPointerDownCapture: ColumnDndPointerDownHandler ) => ReactNode;
} ) => {
	const { enabled, tableIdentity, activeDraggable, children } = props;
	const manager = useDragDropManager();

	const onPointerDownCapture: ColumnDndPointerDownHandler = ( event ) => {
		/* 列並び替えが無効、物理DnD接続を利用できない、またはPC以外の入力では開始候補を受け付けない。 */
		if ( ! enabled || ! manager || event.pointerType !== 'mouse' ) {
			return;
		}

		/* 新しいDnDを開始できる主ポインターの左ボタン入力だけを受け入れる。 */
		if ( ! event.isPrimary || event.button !== 0 || ! manager.dragOperation.status.idle ) {
			return;
		}

		const target = event.target as Element | null;
		const currentTarget = event.currentTarget;

		/* 開始位置または対象Tableの基準要素を確認できない入力は、開始候補として扱わない。 */
		if ( ! target || ! currentTarget ) {
			return;
		}

		const table = currentTarget.querySelector( 'table' );
		const cell = target.closest( 'th, td' ) as HTMLTableCellElement | null;

		/* 現在Tableに直接属するセルだけを開始対象とし、入れ子TableやTable外の入力は対象にしない。 */
		if ( ! table || ! cell || cell.closest( 'table' ) !== table ) {
			return;
		}

		const sourceColumnIndex = resolveSourceColumnIndex( table, cell );

		/* 論理列位置を安全に解釈できないセルからは、物理DnD開始候補を生成しない。 */
		if ( sourceColumnIndex === null ) {
			return;
		}

		event.preventDefault();

		/* 開始候補は現在のPC入力だけに対応させ、前回入力の一時登録を残さない。 */
		activeDraggable.current?.destroy();
		activeDraggable.current = null;

		const source: ColumnReorderTarget = {
			tableIdentity,
			sourceColumnIndex,
		};
		const resolution = columnReorderTargetResolution.resolve( source );

		/* 第一段階で現在Tableの開始対象として成立した列だけを物理DnDへ登録する。 */
		if ( resolution.status !== 'resolved' ) {
			return;
		}

		activeDraggable.current = new Draggable(
			{
				id: `ytr-column:${ tableIdentity }:${ sourceColumnIndex }`,
				element: cell,
				data: resolution.target,
				sensors: [
					PointerSensor.configure( {
						activationConstraints: [
							new PointerActivationConstraints.Distance( {
								value: 5,
							} ),
						],
						/* Tableセル内部からのPCポインター入力を列DnD開始対象として扱う。 */
						preventActivation: () => false,
					} ),
				],
			},
			manager
		);
	};

	return children( onPointerDownCapture );
};
