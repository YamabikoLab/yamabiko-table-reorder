/**
 * 行・列で同じ意味を持つReorder Sessionの状態とライフサイクルを管理する。
 *
 * 方向固有のTarget / Destinationは各Reorder責務の型を利用し、共通責務は1回のDnD中の保持、
 * destination更新、完了、キャンセルだけを扱う。方向対応は型で保証し、Table個体の一致だけを実行時に確認する。
 */
import type { ReorderConstraints } from './reorder-target-resolution-rules';
import type {
	ReorderDestination,
	ReorderKind,
	ReorderTarget,
} from './reorder-types';

/** 指定した並び替え種別に対応するReorder Session。 */
export type ReorderSession< K extends ReorderKind = ReorderKind > = {
	[ Kind in K ]: {
		kind: Kind;
		target: ReorderTarget< Kind >;
		constraints: ReorderConstraints;
		destination: ReorderDestination< Kind > | null;
	};
}[ K ];

/** 行Reorder Session。 */
export type RowReorderSession = ReorderSession< 'row' >;

/** 列Reorder Session。 */
export type ColumnReorderSession = ReorderSession< 'column' >;

/** DnD Interactionが所有するReorder Sessionの有効状態または待機状態。 */
export type ReorderSessionState< K extends ReorderKind = ReorderKind > = ReorderSession< K > | null;

/** Data Updateへ渡せる確定済み並び替え。 */
export type CommittedReorder< K extends ReorderKind = ReorderKind > = {
	[ Kind in K ]: {
		kind: Kind;
		target: ReorderTarget< Kind >;
		destination: ReorderDestination< Kind >;
	};
}[ K ];

/**
 * Reorder Target Resolutionで成立した値から新しいReorder Sessionを開始する。
 *
 * @param target      並び替え対象として成立した方向固有Reorder Target。
 * @param constraints このDnD中だけ利用するReorder Constraints。
 * @return 有効な移動先をまだ持たない同じ方向のReorder Session。
 */
export function startReorderSession< K extends ReorderKind >(
	target: ReorderTarget< K > & { kind: K },
	constraints: ReorderConstraints
): ReorderSession< K >;
export function startReorderSession(
	target: ReorderTarget,
	constraints: ReorderConstraints
): ReorderSession {
	// Session開始時の方向を操作終了まで固定するため、方向固有Targetから対応するSessionを生成する。
	if ( target.kind === 'row' ) {
		return { kind: 'row', target, constraints, destination: null };
	}

	return { kind: 'column', target, constraints, destination: null };
}

/**
 * Reorder Sessionの現在の有効な移動先を更新する。
 *
 * 型契約によりSessionとDestinationの方向を一致させる。Table個体は値レベルでしか保証できないため、
 * destinationが存在する場合だけ同一Tableであることを実行時に確認する。
 *
 * @param session     更新対象のReorder Session。
 * @param destination 同じ方向の有効な移動先、または`null`。
 * @return 現在の移動先を反映した同じ方向のReorder Session。
 */
export const updateReorderDestination = < TSession extends ReorderSession >(
	session: TSession,
	destination: NoInfer< ReorderDestination< TSession[ 'kind' ] > | null >
): TSession => {
	// 並び替え対象を別Tableへ移動する操作は扱わないため、移動先は開始時と同じTableに属する必要がある。
	if ( destination !== null && session.target.clientId !== destination.clientId ) {
		throw new Error(
			'Reorder Session invariant violated: target and destination must belong to the same Table.'
		);
	}

	return { ...session, destination };
};

/**
 * Reorder Sessionを完了し、有効な移動先がある場合だけCommitted Reorderを生成する。
 *
 * @param session 完了対象のReorder Session。
 * @return 確定可能な同じ方向の並び替え、またはデータ変更を伴わない正常完了を表す`null`。
 */
export function completeReorderSession< K extends ReorderKind >(
	session: ReorderSession< K > & { kind: K }
): CommittedReorder< K > | null;
export function completeReorderSession( session: ReorderSession ): CommittedReorder | null {
	// 有効な移動先がないDnDはTableデータ変更を発生させない。
	if ( session.destination === null ) {
		return null;
	}

	// 両方向を束ねる完了境界ではSession方向を選択し、型で対応済みのTargetとDestinationを確定結果へ渡す。
	if ( session.kind === 'row' ) {
		return { kind: 'row', target: session.target, destination: session.destination };
	}

	return { kind: 'column', target: session.target, destination: session.destination };
}

/**
 * Reorder SessionをキャンセルしてDnD待機状態へ戻す。
 *
 * @param session 終了対象のReorder Session。
 * @return 有効なReorder Sessionが存在しない状態。
 */
export const cancelReorderSession = ( session: ReorderSession ): null => {
	void session;
	return null;
};
