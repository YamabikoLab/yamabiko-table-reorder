/**
 * 確定済みReorderをTable Integrationへ渡す共通Data Updateを提供する。
 *
 * 行・列固有Targetの位置解釈は各方向責務から受け取り、共通側では挿入境界から最終位置への正規化、
 * no-op判定、1回だけのTable更新要求を扱う。Table Block固有のデータ構造や更新方法は扱わない。
 */
import type { CommittedReorder } from '@/reorder/core/reorder-session';
import type { ReorderKind, ReorderTarget } from '@/reorder/core/reorder-types';
import type {
	ConcreteTableReorderUpdate,
	TableUpdateIntegration,
	TableUpdateResult,
} from '@/reorder/foundation/table-update';

/** 方向固有Targetを共通の移動元位置へ射影する契約。 */
export type ReorderSourceIndexResolver< K extends ReorderKind > = (
	target: ReorderTarget< K >
) => number;

/** Data UpdateがDnD Interactionへ返す更新結果。 */
export type DataUpdateResult = TableUpdateResult | { status: 'unchanged' };

/** 確定済みReorderをTableデータ更新へ接続するData Update契約。 */
export type DataUpdate = {
	/**
	 * 同じ方向のTarget / Destination対応を保ったまま、確定済みReorderを1回だけ更新境界へ渡す。
	 *
	 * @param reorder        DnD Interactionで確定した同一方向の並び替え。
	 * @param getSourceIndex 方向固有Targetを共通の移動元位置へ射影する同方向の規則。
	 * @return 更新成立、データ変更なし、開始不可、または成立未確認の結果。
	 */
	update: < K extends ReorderKind >(
		reorder: CommittedReorder< K >,
		getSourceIndex: ReorderSourceIndexResolver< K >
	) => DataUpdateResult;
};

/**
 * 挿入境界を、移動対象を一度取り除いた後の最終0-based位置へ正規化する。
 *
 * @param sourceIndex   並び替え前の移動元位置。
 * @param boundaryIndex 並び替え前のTable上で表した挿入境界。
 * @return 並び替え後に移動対象が占める0-based位置。
 */
export const getReorderDestinationIndex = (
	sourceIndex: number,
	boundaryIndex: number
): number => {
	const destinationIndex =
		boundaryIndex <= sourceIndex ? boundaryIndex : boundaryIndex - 1;
	return destinationIndex;
};

/**
 * Table Integration更新境界を利用するData Updateを作成する。
 *
 * @param tableIntegration 対応Table Blockへ確定済み更新を反映するTable Integration境界。
 * @return 状態を保持せず、1つの確定済みReorderごとに最大1回だけ更新を要求するData Update。
 */
export const createDataUpdate = (
	tableIntegration: Pick< TableUpdateIntegration, 'updateReorder' >
): DataUpdate => ( {
	update: ( reorder, getSourceIndex ) => {
		const sourceIndex = getSourceIndex( reorder.target );
		const destinationIndex = getReorderDestinationIndex(
			sourceIndex,
			reorder.destination.boundaryIndex
		);

		// 元位置の直前・直後の挿入境界は最終位置が変わらないため、Tableデータ更新を発生させない。
		if ( sourceIndex === destinationIndex ) {
			return { status: 'unchanged' };
		}

		const update = {
			kind: reorder.kind,
			clientId: reorder.target.clientId,
			sourceIndex,
			destinationIndex,
		} as ConcreteTableReorderUpdate< typeof reorder.kind >;

		return tableIntegration.updateReorder( update );
	},
} );
