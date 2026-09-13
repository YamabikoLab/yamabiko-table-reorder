/**
 * WordPress Editor上で、Reorder Mode中の通常編集開始抑止を所有する。
 *
 * Gutenberg本体や他の拡張が設定した入力handlerを維持しつつ、Table内容の通常編集だけを開始させない。
 * DnD開始に必要なpointerdownはこの抑止境界で既定動作を取り消さない。
 */

import type { PointerEvent } from 'react';

/** Table内容への編集開始につながる入力イベント。 */
type EditingStartEvent = {
	preventDefault: () => void;
};

/** Block wrapperへ追加できる編集開始入力handler。 */
export type EditingStartHandler = ( event: EditingStartEvent ) => void;

/** Block wrapperで扱う編集開始入力と、変更せず維持するpointer入力のprops。 */
export type EditingStartWrapperProps = {
	onDoubleClickCapture?: EditingStartHandler;
	onMouseDownCapture?: EditingStartHandler;
	onPointerDownCapture?: ( event: PointerEvent< Element > ) => void;
	[ key: string ]: unknown;
};

/**
 * 並び替えモード中の選択Tableで、通常の内容編集だけを開始させない。
 *
 * @param event Table内容への編集開始につながる入力イベント。
 */
const preventEditingStart = ( event: EditingStartEvent ) => {
	event.preventDefault();
};

/**
 * Gutenberg既存の編集開始入力handlerを維持したまま、現在状態に応じてReorder Modeの編集開始抑止を追加する。
 *
 * 既存handlerへ先に入力を通知することで他のEditor拡張の処理を維持し、その後に現在のReorder Modeが通常編集を許可しない場合だけ編集開始を抑止する。
 * DnD開始用のpointerdownにはこのhandlerを適用しない。
 *
 * @param existingHandler Gutenberg本体または他のfilterが設定した既存handler。
 * @param shouldPrevent   現在の入力で通常編集開始を抑止する場合はtrueを返す処理。
 * @return 既存処理と現在状態に応じたReorder Modeの編集開始抑止を順に適用するhandler。
 */
export const preserveEditingStartHandler = (
	existingHandler: EditingStartHandler | undefined,
	shouldPrevent: () => boolean
): EditingStartHandler => {
	const handler: EditingStartHandler = ( event ) => {
		existingHandler?.( event );

		/* 通常編集へ戻った後は同じhandlerを維持したままGutenberg本来の入力結果を変更しない。 */
		if ( ! shouldPrevent() ) {
			return;
		}

		preventEditingStart( event );
	};

	return handler;
};
