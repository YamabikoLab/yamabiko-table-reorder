/**
 * #910の大規模Table並び替えPoCとして、確認から反映・保存失敗までの一時的な状態を所有する。
 *
 * Row DnD Sessionとは独立して並び替え意図だけを保持し、Core Tableかつ保存済みのcleanな投稿だけをPoC対象として受理する。
 * 正式仕様ではなく方式検証のための境界であり、PoC成立後に#902の正式責務へ置き換える。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch, select } from '@wordpress/data';
import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { getLargeReorderSaveFirstMessage } from '@/messages';

/** PoCが後から再照合して反映する行移動意図。 */
export type LargeReorderPocRowMove = {
	/** 対象Core Table個体を識別するclientId。 */
	tableIdentity: string;
	/** drop時点のtbodyを基準とする0-based移動元行位置。 */
	sourceRowIndex: number;
	/** drop時点のtbodyを基準とする0-based移動先境界。 */
	destinationBoundaryIndex: number;
};

/** 大規模Table並び替えPoCが取り得る状態。 */
export type LargeReorderPocState =
	| { phase: 'idle'; move: null }
	| { phase: 'confirming'; move: LargeReorderPocRowMove }
	| { phase: 'applying'; move: LargeReorderPocRowMove }
	| { phase: 'failed'; move: LargeReorderPocRowMove };

type EditorSelect = {
	isEditedPostDirty: () => boolean;
	getCurrentPost: () => { status?: string } | null;
};

type NoticesDispatch = {
	createWarningNotice: ( message: string, options?: { type?: string } ) => void;
};

type LargeReorderPocActions = {
	confirm: () => void;
	cancel: () => void;
	fail: () => void;
};

type LargeReorderPocStore = LargeReorderPocState & LargeReorderPocActions;

const selectByName = select as unknown as ( storeName: string ) => unknown;
const dispatchByName = dispatch as unknown as ( storeName: string ) => unknown;

/** PoCの確認・反映状態を、DnD SessionやTable componentのmount状態から独立して保持する。 */
const largeReorderPocStore = createStore< LargeReorderPocStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			move: null,
			confirm: () => {
				const state = get();
				if ( state.phase !== 'confirming' ) {
					throw new Error( 'Large reorder PoC confirmation requires a pending move.' );
				}

				set( { phase: 'applying', move: state.move }, undefined, 'large-reorder-poc/confirm' );
			},
			cancel: () => {
				const state = get();
				if ( state.phase !== 'confirming' ) {
					throw new Error( 'Large reorder PoC cancellation requires a pending move.' );
				}

				set( { phase: 'idle', move: null }, undefined, 'large-reorder-poc/cancel' );
			},
			fail: () => {
				const state = get();
				if ( state.phase !== 'applying' ) {
					throw new Error( 'Large reorder PoC failure requires an applying move.' );
				}

				set( { phase: 'failed', move: state.move }, undefined, 'large-reorder-poc/fail' );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / Large Reorder PoC' }
	)
);

/**
 * 行dropを#910 PoCへ引き渡せるか判定し、対象なら確認待ち状態を開始する。
 *
 * PoCではCore Tableだけを強制的に大規模扱いする。未保存変更または未保存の新規投稿ではTableを変更せず、先に投稿保存が必要なことを通知する。
 *
 * @param move drop時点で再照合済みの行移動意図。
 * @return PoCがdropを処理した場合はtrue。PoC対象外で既存Row Reorder処理を続ける場合はfalse。
 */
export const requestLargeRowReorderPoc = ( move: LargeReorderPocRowMove ): boolean => {
	const block = select( blockEditorStore ).getBlock( move.tableIdentity );
	if ( ! block || block.name !== 'core/table' ) {
		return false;
	}

	const state = largeReorderPocStore.getState();
	if ( state.phase !== 'idle' ) {
		return true;
	}

	const editor = selectByName( 'core/editor' ) as EditorSelect;
	const currentPost = editor.getCurrentPost();
	const savedPost = currentPost !== null && currentPost.status !== 'auto-draft';
	if ( ! savedPost || editor.isEditedPostDirty() ) {
		const notices = dispatchByName( 'core/notices' ) as NoticesDispatch;
		notices.createWarningNotice( getLargeReorderSaveFirstMessage(), { type: 'snackbar' } );
		return true;
	}

	largeReorderPocStore.setState(
		{ phase: 'confirming', move },
		undefined,
		'large-reorder-poc/request'
	);
	return true;
};

/** PoC状態変更をReact境界から購読する。 */
export const subscribeLargeReorderPoc = ( listener: () => void ): ( () => void ) =>
	largeReorderPocStore.subscribe( listener );

/** 現在のPoC状態を取得する。 */
export const getLargeReorderPocState = (): LargeReorderPocState => largeReorderPocStore.getState();

/** 確認済みのPoC行移動を反映開始状態へ進める。 */
export const confirmLargeReorderPoc = (): void => largeReorderPocStore.getState().confirm();

/** 確認待ちのPoC行移動を破棄して通常状態へ戻す。 */
export const cancelLargeReorderPoc = (): void => largeReorderPocStore.getState().cancel();

/** 反映または投稿保存に失敗したPoCを終端状態へ進める。 */
export const failLargeReorderPoc = (): void => largeReorderPocStore.getState().fail();
