/**
 * Reorder Sessionの行・列共通Lifecycleを公開する互換境界。
 *
 * Sessionの実体は`common`に置き、方向固有Target / Destinationの正本は各Reorder責務に置く。
 */
export {
	cancelReorderSession,
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
	type ColumnReorderSession,
	type CommittedReorder,
	type ReorderSession,
	type ReorderSessionState,
	type RowReorderSession,
} from '@/reorder/common/reorder-session';
