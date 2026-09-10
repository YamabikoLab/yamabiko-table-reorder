/**
 * #912の大規模Table並び替えPoCとして、確認から反映中までの一時的な状態を所有する。
 *
 * Row DnD Sessionとは独立して並び替え意図だけを保持し、Core Tableを強制的にPoC対象として受理する。
 * 反映完了または通常の反映不能ではidleへ戻し、WordPress接続境界が現在Tableを再mountできる状態にする。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { select } from '@wordpress/data';
import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

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
	| { phase: 'applying'; move: LargeReorderPocRowMove };

type LargeReorderPocActions = {
	confirm: () => void;
	cancel: () => void;
	complete: () => void;
};

type LargeReorderPocStore = LargeReorderPocState & LargeReorderPocActions;

type LargeReorderPocConsole = typeof globalThis & {
	ytr912MoveRow?: ( sourceRowNumber: number, destinationRowNumber: number ) => boolean;
};

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
			complete: () => {
				const state = get();
				if ( state.phase !== 'applying' ) {
					throw new Error( 'Large reorder PoC completion requires an applying move.' );
				}

				set( { phase: 'idle', move: null }, undefined, 'large-reorder-poc/complete' );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / Large Reorder PoC' }
	)
);

/**
 * 行dropを#912 PoCへ引き渡せるか判定し、対象なら確認待ち状態を開始する。
 *
 * PoCではCore Tableだけを強制的に大規模扱いし、投稿保存状態には介入しない。
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

/** 反映完了または通常の反映不能後にPoCを終了し、Tableを再mount可能な通常状態へ戻す。 */
export const completeLargeReorderPoc = (): void => largeReorderPocStore.getState().complete();

/**
 * 選択中のCore Tableへ、DnDを使わず1-based行番号で#912 PoCの行移動を要求する。
 *
 * 長距離DnDを繰り返さずにunmount・更新・再mountの性能比較を行うためのPoC専用入口であり、正式機能には含めない。
 *
 * @param sourceRowNumber      移動前の1-based行番号。
 * @param destinationRowNumber 並び替え後に配置したい1-based行番号。
 * @return PoCの確認待ちを開始できた場合はtrue。指定または選択対象が成立しない場合はfalse。
 */
const requestLargeRowReorderPocFromConsole = (
	sourceRowNumber: number,
	destinationRowNumber: number
): boolean => {
	const blockEditor = select( blockEditorStore );
	const selectedBlockClientId = blockEditor.getSelectedBlockClientId();
	const selectedBlock = selectedBlockClientId
		? blockEditor.getBlock( selectedBlockClientId )
		: null;

	/* Console入口は現在選択中のCore Tableだけを対象とし、別Blockへ暗黙に作用させない。 */
	if ( ! selectedBlockClientId || ! selectedBlock || selectedBlock.name !== 'core/table' ) {
		globalThis.console.warn( '[YTR #912 PoC] Select a Core Table before calling ytr912MoveRow().' );
		return false;
	}

	const body = ( selectedBlock.attributes as { body?: unknown } ).body;
	if ( ! Array.isArray( body ) ) {
		globalThis.console.warn( '[YTR #912 PoC] The selected Core Table body is unavailable.' );
		return false;
	}

	const rowCount = body.length;
	const rowNumbersValid =
		Number.isInteger( sourceRowNumber ) &&
		Number.isInteger( destinationRowNumber ) &&
		sourceRowNumber >= 1 &&
		sourceRowNumber <= rowCount &&
		destinationRowNumber >= 1 &&
		destinationRowNumber <= rowCount;

	if ( ! rowNumbersValid ) {
		globalThis.console.warn( `[YTR #912 PoC] Row numbers must be integers from 1 to ${ rowCount }.` );
		return false;
	}

	if ( sourceRowNumber === destinationRowNumber ) {
		globalThis.console.warn( '[YTR #912 PoC] Source and destination rows are the same.' );
		return false;
	}

	if ( largeReorderPocStore.getState().phase !== 'idle' ) {
		globalThis.console.warn( '[YTR #912 PoC] Another PoC reorder is already active.' );
		return false;
	}

	const sourceRowIndex = sourceRowNumber - 1;
	const destinationBoundaryIndex =
		destinationRowNumber > sourceRowNumber ? destinationRowNumber : destinationRowNumber - 1;
	const requested = requestLargeRowReorderPoc( {
		tableIdentity: selectedBlockClientId,
		sourceRowIndex,
		destinationBoundaryIndex,
	} );

	if ( requested ) {
		globalThis.console.info(
			`[YTR #912 PoC] Requested row ${ sourceRowNumber } → ${ destinationRowNumber }.`
		);
	}

	return requested;
};

/* #912 PoCの手動性能確認だけで利用する一時的なConsole入口を公開する。 */
( globalThis as LargeReorderPocConsole ).ytr912MoveRow = requestLargeRowReorderPocFromConsole;
