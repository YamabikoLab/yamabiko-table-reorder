/**
 * 1回のDnD中だけ有効なReorder Sessionの状態とライフサイクルを管理する。
 *
 * Reorder Target Resolutionが確定した並び替え対象と並び替え制約を開始時に受け取り、
 * DnD進行中の現在の有効な移動先を保持する。完了時は有効な移動先が存在する場合だけ
 * Committed Reorderを生成し、キャンセルまたは`abort()`後に状態を次のDnDへ持ち越さない。
 */
import type { ReorderDestination } from '@/reorder/drop-target-resolution';
import type { ReorderConstraints, ReorderTarget } from '@/reorder/reorder-target-resolution';

/**
 * 進行中の1回の並び替え操作を表す状態。
 *
 * 並び替え種別、並び替え対象、そのDnDで利用する並び替え制約を必須状態として保持し、
 * 現在の有効な移動先は存在しないことが正常にあるため`null`を許可する。
 */
export type ReorderSession =
	| {
			kind: 'row';
			target: Extract< ReorderTarget, { kind: 'row' } >;
			constraints: ReorderConstraints;
			destination: Extract< ReorderDestination, { kind: 'row' } > | null;
	  }
	| {
			kind: 'column';
			target: Extract< ReorderTarget, { kind: 'column' } >;
			constraints: ReorderConstraints;
			destination: Extract< ReorderDestination, { kind: 'column' } > | null;
	  };

/** Reorder Sessionが有効ではない状態を含むDnD Interactionの所有状態。 */
export type ReorderSessionState = ReorderSession | null;

/**
 * Data Updateへ渡せる確定済み並び替え。
 *
 * 有効なReorder Sessionに有効な移動先が存在する場合だけ生成され、並び替え種別、
 * 並び替え対象、移動先の種別が一致していることを保証する。
 */
export type CommittedReorder =
	| {
			kind: 'row';
			target: Extract< ReorderTarget, { kind: 'row' } >;
			destination: Extract< ReorderDestination, { kind: 'row' } >;
	  }
	| {
			kind: 'column';
			target: Extract< ReorderTarget, { kind: 'column' } >;
			destination: Extract< ReorderDestination, { kind: 'column' } >;
	  };

/**
 * Reorder Target Resolutionで成立した値から新しいReorder Sessionを開始する。
 *
 * @param target      並び替え対象として成立したReorder Target。
 * @param constraints このDnD中だけ利用するReorder Constraints。
 * @return 有効な移動先をまだ持たない新しいReorder Session。
 */
export const startReorderSession = (
	target: ReorderTarget,
	constraints: ReorderConstraints
): ReorderSession => {
	// Reorder Sessionは開始時の並び替え種別を操作終了まで固定し、対象と移動先の型を同じ種別に保つ。
	if ( target.kind === 'row' ) {
		return {
			kind: 'row',
			target,
			constraints,
			destination: null,
		};
	}

	return {
		kind: 'column',
		target,
		constraints,
		destination: null,
	};
};

/**
 * Reorder Sessionの現在の有効な移動先を更新する。
 *
 * `null`は現在位置に有効な移動先が存在しない正常状態を表す。移動先が存在する場合は、具体的な
 * Reorder Session型を保持できる呼び出しでは型で並び替え種別を制約し、union境界では実行時の
 * 不変条件でもReorder Sessionとの種別一致を確認する。対象Tableの一致も実行時に確認する。
 *
 * @param session     更新対象の有効なReorder Session。
 * @param destination Drop Target Resolutionが返した有効な移動先、または`null`。
 * @return 現在の有効な移動先を反映した同じ種別のReorder Session。
 */
export const updateReorderDestination = < TSession extends ReorderSession >(
	session: TSession,
	destination: NoInfer< NonNullable< TSession[ 'destination' ] > > | null
): TSession => {
	// 具体型では型で種別を制約し、union境界でも安全性を維持するため、値として存在する移動先は種別とTableを確認する。
	if ( destination !== null ) {
		assertDestinationMatchesSession( session, destination );
	}

	return { ...session, destination };
};

/**
 * 有効なReorder Sessionを完了し、確定可能な場合だけCommitted Reorderを生成する。
 *
 * @param session 完了対象の有効なReorder Session。
 * @return 有効な移動先がある場合はCommitted Reorder、ない場合は`null`。
 */
export const completeReorderSession = ( session: ReorderSession ): CommittedReorder | null => {
	// 有効な移動先がないDnDはデータ変更を発生させないため、確定済み並び替えを生成しない。
	if ( session.destination === null ) {
		return null;
	}

	// 確定済み並び替えは開始時の並び替え種別を維持し、Data Updateへ同種別の対象と移動先を渡す。
	if ( session.kind === 'row' ) {
		return {
			kind: 'row',
			target: session.target,
			destination: session.destination,
		};
	}

	return {
		kind: 'column',
		target: session.target,
		destination: session.destination,
	};
};

/**
 * 有効なReorder SessionをキャンセルしてDnDの待機状態へ戻す。
 *
 * キャンセルはCommitted Reorderを生成せず、Reorder Modeにも影響しない。
 *
 * @param session 終了対象の有効なReorder Session。
 * @return 有効なReorder Sessionが存在しない状態。
 */
export const cancelReorderSession = ( session: ReorderSession ): null => {
	void session;
	return null;
};

/**
 * 有効な移動先がReorder Sessionと同じ並び替え種別かつ同じTableに属することを確認する。
 *
 * 具体的なReorder Session型を保持できる呼び出しでは型で種別を制約する。一方、行・列を束ねる
 * union境界では型だけで種別対応を保証できないため、実行時にも種別一致を確認する。Table個体の一致は
 * 値レベルでしか保証できないため、常に実行時の不変条件として確認する。
 *
 * @param session     判定対象の有効なReorder Session。
 * @param destination Drop Target Resolutionが返した有効な移動先。
 */
const assertDestinationMatchesSession = (
	session: ReorderSession,
	destination: ReorderDestination
): void => {
	// 1回のDnDは開始時の並び替え種別を維持するため、移動先も同じ並び替え種別である必要がある。
	if ( session.kind !== destination.kind ) {
		throw new Error(
			'Reorder Session invariant violated: session and destination must have the same reorder kind.'
		);
	}

	// 並び替え対象を別Tableへ移動する操作は扱わないため、移動先は開始時と同じTableに属する必要がある。
	if ( session.target.clientId !== destination.clientId ) {
		throw new Error(
			'Reorder Session invariant violated: target and destination must belong to the same Table.'
		);
	}
};
