/**
 * WordPress Editor上で、Reorder Mode中の通常編集開始抑止を所有する。
 *
 * Gutenberg本体や他の拡張が設定した入力handlerを維持しつつ、Table内容の通常編集だけを開始させない。
 */

/** Table内容への編集開始につながる入力イベント。 */
export type EditingStartEvent = {
	preventDefault: () => void;
};

/** Block wrapperへ追加できる編集開始入力handler。 */
export type EditingStartHandler = ( event: EditingStartEvent ) => void;

/** Block wrapperへ追加できる編集開始入力props。 */
export type EditingStartWrapperProps = {
	onDoubleClickCapture?: EditingStartHandler;
	onMouseDownCapture?: EditingStartHandler;
	onPointerDownCapture?: EditingStartHandler;
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
 * Gutenberg既存の編集開始入力handlerを維持したまま、Reorder Modeの編集開始抑止を追加する。
 *
 * 既存handlerへ先に入力を通知することで他のEditor拡張の処理を維持し、その後に通常編集の開始だけを抑止する。
 *
 * @param existingHandler Gutenberg本体または他のfilterが設定した既存handler。
 * @return 既存処理とReorder Modeの編集開始抑止を順に適用するhandler。
 */
export const preserveEditingStartHandler = (
	existingHandler?: EditingStartHandler
): EditingStartHandler =>
	( event ) => {
		existingHandler?.( event );
		preventEditingStart( event );
	};
