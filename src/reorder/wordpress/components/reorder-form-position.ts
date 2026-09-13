/**
 * Reorder Form（RF）の入力Popoverを利用者が移動した位置をPresentation状態として所有する。
 *
 * RF Interactionの入力・並び替え状態とは分離し、同じRF Session中のReact再mountでは位置を維持する。
 * 新しいRF Sessionを開始する場合は初期配置へ戻し、Popoverは再びToolbarを基準に表示する。
 */

import { useCallback } from '@wordpress/element';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** RF入力Popoverの左上位置を、現在Editor viewport基準の座標で表す。 */
export type ReorderFormPosition = {
	x: number;
	y: number;
};

/** RF入力Popoverの現在表示サイズを表す。 */
type ReorderFormSize = {
	width: number;
	height: number;
};

/** RF入力Popoverを配置できる現在Editor viewportの大きさを表す。 */
type ReorderFormViewport = {
	width: number;
	height: number;
};

/** RF入力Popoverをviewport端へ密着させず操作可能な余白を残す。 */
const viewportMargin = 8;

/** RF入力Popoverの手動配置状態を表す。 */
type ReorderFormPositionStore = {
	tableIdentity: string | null;
	position: ReorderFormPosition | null;
	beginSession: ( tableIdentity: string ) => void;
	setPosition: ( tableIdentity: string, position: ReorderFormPosition ) => void;
};

/**
 * RF入力Popoverの手動配置をReactのmount / unmountから独立して保持する。
 *
 * RF Session開始時に対象Tableを切り替えて位置を破棄し、Session中の移動だけを同一Tableへ反映する。
 */
const reorderFormPositionStore = createStore< ReorderFormPositionStore >()( ( set, get ) => ( {
	tableIdentity: null,
	position: null,
	beginSession: ( tableIdentity ) => {
		set( { tableIdentity, position: null } );
	},
	setPosition: ( tableIdentity, position ) => {
		/* 終了済みまたは別Tableの古いPointer操作では現在Sessionの配置を変更しない。 */
		if ( get().tableIdentity !== tableIdentity ) {
			return;
		}

		set( { position } );
	},
} ) );

/** RF Session入口とPopover Presentationへ提供する位置状態操作。 */
export const reorderFormPosition = {
	/**
	 * 新しいRF Sessionの初期配置を開始する。
	 *
	 * @param tableIdentity 新しいRF Sessionの対象Table Identity。
	 */
	beginSession: ( tableIdentity: string ): void => {
		reorderFormPositionStore.getState().beginSession( tableIdentity );
	},
	/**
	 * 現在RF Sessionの手動配置を更新する。
	 *
	 * @param tableIdentity 現在RF Sessionの対象Table Identity。
	 * @param position      Editor viewport内で利用者が指定した左上位置。
	 */
	setPosition: ( tableIdentity: string, position: ReorderFormPosition ): void => {
		reorderFormPositionStore.getState().setPosition( tableIdentity, position );
	},
};

/**
 * 利用者が指定した位置を、RF入力PopoverがEditor viewport内へ残る範囲へ制限する。
 *
 * @param requestedPosition 利用者のPointer操作から得た希望位置。
 * @param size              現在のRF入力Popoverサイズ。
 * @param viewport          現在のEditor viewportサイズ。
 * @return viewport端の操作余白を保ったRF入力Popoverの左上位置。
 */
export const clampReorderFormPosition = (
	requestedPosition: ReorderFormPosition,
	size: ReorderFormSize,
	viewport: ReorderFormViewport
): ReorderFormPosition => {
	const maximumX = Math.max( viewportMargin, viewport.width - size.width - viewportMargin );
	const maximumY = Math.max( viewportMargin, viewport.height - size.height - viewportMargin );
	const x = Math.min( Math.max( requestedPosition.x, viewportMargin ), maximumX );
	const y = Math.min( Math.max( requestedPosition.y, viewportMargin ), maximumY );

	return { x, y };
};

/**
 * 対象TableのRF入力Popover手動配置をReactへ提供する。
 *
 * @param tableIdentity RF入力Popoverを表示するTable Identity。
 * @return 現在Sessionの手動配置と、その位置を更新する操作。
 */
export const useReorderFormPosition = ( tableIdentity: string ) => {
	const position = useStore( reorderFormPositionStore, ( state ) => {
		const positionForTable = state.tableIdentity === tableIdentity ? state.position : null;
		return positionForTable;
	} );
	const setPosition = useCallback(
		( nextPosition: ReorderFormPosition ) =>
			reorderFormPosition.setPosition( tableIdentity, nextPosition ),
		[ tableIdentity ]
	);

	return { position, setPosition };
};
