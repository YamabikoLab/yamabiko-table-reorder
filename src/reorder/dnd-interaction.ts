/**
 * DnD Interactionの行・列共通operation boundaryを公開する互換境界。
 *
 * 実体は`common`に置き、方向固有の開始要求と移動先生成は各Reorder責務へ委譲する。
 */
export {
	createDndInteraction,
	type DndCancelResult,
	type DndCompleteResult,
	type DndErrorLogger,
	type DndInteraction,
	type DndInteractionDependencies,
	type DndOperation,
	type DndProgressResult,
	type DndStartResult,
} from '@/reorder/common/dnd-interaction';
export type { DndStartPosition, DndStartRequest } from '@/reorder/common/dnd-start-request';
