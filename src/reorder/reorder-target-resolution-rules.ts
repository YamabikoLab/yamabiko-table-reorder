/**
 * Reorder Target Resolutionの方向非依存規則を公開する互換境界。
 *
 * 実体は`common`に置き、行・列で同じ意味と変更理由を持つ規則だけを共有する。
 */
export {
	resolveTargetWithinScope,
	type ReorderConstraints,
	type ReorderTargetAxis,
	type ReorderTargetResolutionFailureReason,
	type ReorderTargetResolutionResult,
} from '@/reorder/common/reorder-target-resolution-rules';
