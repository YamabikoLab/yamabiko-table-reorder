/**
 * 1回のDnD中だけ有効なReorder Sessionの状態とLifecycleを管理する。
 *
 * Reorder Target Resolutionが確定した並び替え対象と並び替え制約を開始時に受け取り、
 * DnD進行中の現在の有効な移動先を保持する。完了時は有効な移動先が存在する場合だけ
 * Committed Reorderを生成し、キャンセルまたはabort後に状態を次のDnDへ持ち越さない。
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

/** Reorder Sessionがactiveではない状態を含むDnD Interactionの所有状態。 */
export type ReorderSessionState = ReorderSession | null;

/**
 * Data Updateへ渡せる確定済み並び替え。
 *
 * activeなReorder Sessionに有効な移動先が存在する場合だけ生成され、並び替え種別、
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
 * `null`は現在位置に有効な移動先が存在しない正常状態を表す。移動先が存在する場合は
 * activeなReorder Sessionと同じ並び替え種別および対象Tableであることを要求する。
 *
 * @param session     更新対象のactiveなReorder Session。
 * @param destination Drop Target Resolutionが返した現在の有効な移動先、または`null`。
 * @return 現在の有効な移動先を反映したReorder Session。
 */
export const updateReorderDestination = (
	session: ReorderSession,
	destination: ReorderDestination | null
): ReorderSession => {
	if ( destination === null ) {
		if ( session.kind === 'row' ) {
			return { ...session, destination: null };
		}

		return { ...session, destination: null };
	}

	assertDestinationMatchesSession( session, destination );

	if ( session.kind === 'row' && destination.kind === 'row' ) {
		return { ...session, destination };
	}

	if ( session.kind === 'column' && destination.kind === 'column' ) {
		return { ...session, destination };
	}

	throw new Error(
		'Reorder Session invariant violated: reorder kind must match destination kind.'
	);
};

/**
 * activeなReorder Sessionを完了し、確定可能な場合だけCommitted Reorderを生成する。
 *
 * @param session 完了対象のactiveなReorder Session。
 * @return 有効な移動先がある場合はCommitted Reorder、ない場合は`null`。
 */
export const completeReorderSession = ( session: ReorderSession ): CommittedReorder | null => {
	if ( session.destination === null ) {
		return null;
	}

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
 * activeなReorder SessionをキャンセルしてDnD idleへ戻す。
 *
 * キャンセルはCommitted Reorderを生成せず、Reorder Modeにも影響しない。
 *
 * @param session 終了対象のactiveなReorder Session。
 * @return activeなReorder Sessionが存在しない状態。
 */
export const cancelReorderSession = ( session: ReorderSession ): null => {
	void session;
	return null;
};

/**
 * 有効な移動先がactiveなReorder Sessionと同じ並び替え操作に属することを確認する。
 *
 * @param session     判定対象のactiveなReorder Session。
 * @param destination Drop Target Resolutionが返した有効な移動先。
 */
const assertDestinationMatchesSession = (
	session: ReorderSession,
	destination: ReorderDestination
): void => {
	if ( session.kind !== destination.kind ) {
		throw new Error(
			'Reorder Session invariant violated: reorder kind must match destination kind.'
		);
	}

	if ( session.target.clientId !== destination.clientId ) {
		throw new Error(
			'Reorder Session invariant violated: target and destination must belong to the same Table.'
		);
	}
};
