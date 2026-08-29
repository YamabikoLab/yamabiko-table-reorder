/**
 * 行・列に共通する並び替え種別と、種別ごとの方向固有Target / Destinationの型対応を定義する。
 *
 * 行・列固有型の意味と正本は`row-reorder` / `column-reorder`に保持し、この契約では並び替え種別と
 * 対応する型の関係だけを表現する。これにより、共通Reorder責務が方向対応を型で維持できるようにする。
 */
import type { ColumnReorderDestination } from '@/reorder/column-reorder/drop-target-resolution';
import type { ColumnReorderTarget } from '@/reorder/column-reorder/reorder-target-resolution';
import type { RowReorderDestination } from '@/reorder/row-reorder/drop-target-resolution';
import type { RowReorderTarget } from '@/reorder/row-reorder/reorder-target-resolution';

/** Reorderが扱う行または列の並び替え種別。 */
export type ReorderKind = 'row' | 'column';

/** 並び替え種別と方向固有Target / Destinationの対応関係。 */
export type ReorderTypeMap = {
	row: {
		target: RowReorderTarget;
		destination: RowReorderDestination;
	};
	column: {
		target: ColumnReorderTarget;
		destination: ColumnReorderDestination;
	};
};

/** 指定した並び替え種別に対応するReorder Target。 */
export type ReorderTarget< K extends ReorderKind = ReorderKind > =
	ReorderTypeMap[ K ][ 'target' ];

/** 指定した並び替え種別に対応するReorder Destination。 */
export type ReorderDestination< K extends ReorderKind = ReorderKind > =
	ReorderTypeMap[ K ][ 'destination' ];
