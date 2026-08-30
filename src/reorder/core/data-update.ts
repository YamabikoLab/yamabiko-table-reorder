/**
 * 確定済みReorderをTable Integrationへ渡す共通Data Updateを提供する。
 *
 * 行・列固有Targetの位置解釈とTableデータ変更規則は、DnD開始時に選択された同じ方向の責務から受け取る。
 * 共通側では挿入境界から最終位置への正規化、no-op判定、1回だけのTable更新要求を扱い、
 * 行・列固有の意味や対応Table Block固有のデータ構造は解釈しない。
 */
import type { ConcreteCommittedReorder } from '@/reorder/core/reorder-session';
import type { ReorderKind, ReorderTarget } from '@/reorder/core/reorder-types';
import type {
	ConcreteTableReorderUpdate,
	TableUpdateChangesResolver,
	TableUpdateIntegration,
	TableUpdateResult,
} from '@/reorder/foundation/table-update';

/** 方向固有Targetから共通の移動元位置を取得する契約。 */
export type ReorderSourceIndexResolver< K extends ReorderKind > = (
	target: ReorderTarget< K >
) => number;

/**
 * DnD開始時に確定した方向について、Data Updateまで同じ方向対応を維持するための契約。
 *
 * 位置の意味とTableデータ変更規則は各方向責務が所有し、共通Data Updateは受け取った規則を組み合わせるだけとする。
 */
export type DataUpdateDirectionAdapter< K extends ReorderKind > = {
	getSourceIndex: ReorderSourceIndexResolver< K >;
	resolveTableUpdateChanges: TableUpdateChangesResolver< K >;
};

/** Data UpdateがDnD Interactionへ返す更新結果。 */
export type DataUpdateResult = TableUpdateResult | { status: 'unchanged' };

/** 確定済みReorderをTableデータ更新へ接続するData Update契約。 */
export type DataUpdate = {
	/**
	 * 同じ方向のTarget / Destination / 更新規則対応を保ったまま、確定済みReorderを1回だけ更新境界へ渡す。
	 *
	 * @param reorder DnD Interactionで確定した一方向の並び替え。
	 * @param adapter 開始時に選択され、同じ方向を維持してきた位置取得とTableデータ変更規則。
	 * @return 更新成立、データ変更なし、開始不可、または成立未確認の結果。
	 */
	update: < K extends ReorderKind >(
		reorder: ConcreteCommittedReorder< K >,
		adapter: DataUpdateDirectionAdapter< K >
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
	const destinationIndex = boundaryIndex <= sourceIndex ? boundaryIndex : boundaryIndex - 1;
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
	update: < K extends ReorderKind >(
		reorder: ConcreteCommittedReorder< K >,
		adapter: DataUpdateDirectionAdapter< K >
	): DataUpdateResult => {
		const sourceIndex = adapter.getSourceIndex( reorder.target );
		const destinationIndex = getReorderDestinationIndex(
			sourceIndex,
			reorder.destination.boundaryIndex
		);

		// 元位置の直前・直後の挿入境界は最終位置が変わらないため、Tableデータ更新を発生させない。
		if ( sourceIndex === destinationIndex ) {
			return { status: 'unchanged' };
		}

		const update: ConcreteTableReorderUpdate< K > = {
			kind: reorder.kind,
			clientId: reorder.target.clientId,
			sourceIndex,
			destinationIndex,
		};

		return tableIntegration.updateReorder( update, adapter.resolveTableUpdateChanges );
	},
} );
