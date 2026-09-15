/**
 * WordPress Reorder Integrationが所有する、Table IdentityごとのToolbar表示用Column DnD Layout Availability snapshotを接続する。
 *
 * BlockListBlock側が現在のEditor DOMによる評価結果を更新し、Toolbar側が同じsnapshotを購読する。
 * 判定ロジック、DOM監視、永続状態、DnD Session開始可否は所有しない。
 */

import { useSyncExternalStore } from 'react';

import type { ColumnDndLayoutAvailability } from '@/reorder/column-reorder/responsibilities/layout-availability';

/** Toolbar表示用snapshotが未確定の場合に安全側へ倒す既定値。 */
const DEFAULT_AVAILABILITY: ColumnDndLayoutAvailability = 'unavailable';

/** Table Identityごとの現在snapshot。 */
const availabilityByTable = new Map< string, ColumnDndLayoutAvailability >();

/** Table Identityごとのsnapshot購読者。 */
const listenersByTable = new Map< string, Set< () => void > >();

/**
 * 対象TableのToolbar表示用availability snapshotを取得する。
 *
 * @param tableIdentity snapshotを所有するTable Identity。
 * @return 現在のsnapshot。未評価または破棄済みの場合はunavailable。
 */
export const getColumnDndLayoutAvailabilitySnapshot = (
	tableIdentity: string
): ColumnDndLayoutAvailability => availabilityByTable.get( tableIdentity ) ?? DEFAULT_AVAILABILITY;

/**
 * BlockListBlockで評価した現在値を対象TableのToolbar表示用snapshotへ反映する。
 *
 * @param tableIdentity snapshotを所有するTable Identity。
 * @param availability  現在のEditor DOMを評価した利用可否。
 */
export const updateColumnDndLayoutAvailabilitySnapshot = (
	tableIdentity: string,
	availability: ColumnDndLayoutAvailability
): void => {
	/* 同じ表示可否を再通知せず、Toolbar購読者には意味のあるsnapshot変更だけを伝える。 */
	if ( getColumnDndLayoutAvailabilitySnapshot( tableIdentity ) === availability ) {
		return;
	}

	availabilityByTable.set( tableIdentity, availability );
	listenersByTable.get( tableIdentity )?.forEach( ( listener ) => listener() );
};

/**
 * BlockListBlockの接続終了時に対象TableのToolbar表示用snapshotを破棄する。
 *
 * @param tableIdentity 破棄するsnapshotのTable Identity。
 */
export const clearColumnDndLayoutAvailabilitySnapshot = ( tableIdentity: string ): void => {
	const previousAvailability = getColumnDndLayoutAvailabilitySnapshot( tableIdentity );
	availabilityByTable.delete( tableIdentity );

	/* availableから安全側の既定値へ戻る場合だけ、Toolbarへ表示可否の変化を通知する。 */
	if ( previousAvailability !== DEFAULT_AVAILABILITY ) {
		listenersByTable.get( tableIdentity )?.forEach( ( listener ) => listener() );
	}
};

/**
 * 対象TableのToolbar表示用snapshot変更を購読する。
 *
 * @param tableIdentity 購読するTable Identity。
 * @param listener      snapshot変更時にToolbarへ通知する購読者。
 * @return 購読を終了する処理。
 */
export const subscribeColumnDndLayoutAvailabilitySnapshot = (
	tableIdentity: string,
	listener: () => void
): ( () => void ) => {
	const listeners = listenersByTable.get( tableIdentity ) ?? new Set< () => void >();
	listeners.add( listener );
	listenersByTable.set( tableIdentity, listeners );

	return () => {
		listeners.delete( listener );
		/* 最後の購読終了後はTable Identityごとの空集合を保持しない。 */
		if ( listeners.size === 0 ) {
			listenersByTable.delete( tableIdentity );
		}
	};
};

/**
 * 対象TableのToolbar表示用Column DnD Layout Availability snapshotをReactへ接続する。
 *
 * @param tableIdentity 購読するTable Identity。
 * @return 現在のToolbar表示用snapshot。
 */
export const useColumnDndLayoutAvailabilitySnapshot = (
	tableIdentity: string
): ColumnDndLayoutAvailability =>
	useSyncExternalStore(
		( listener ) => subscribeColumnDndLayoutAvailabilitySnapshot( tableIdentity, listener ),
		() => getColumnDndLayoutAvailabilitySnapshot( tableIdentity ),
		() => getColumnDndLayoutAvailabilitySnapshot( tableIdentity )
	);
