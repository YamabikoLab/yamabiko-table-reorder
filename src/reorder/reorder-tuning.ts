/**
 * Reorder全体で実機検証により調整する静的なチューニング値を所有する。
 *
 * 操作・表示・性能の調整値だけを集約し、各責務の判定や振る舞いのロジックは所有しない。
 */

// Reorder Apply

/** 確認付きの大規模反映へ切り替える更新対象セル数。 */
export const REORDER_APPLY_CONFIRM_CELL_THRESHOLD = 300;

/** Reorder完了通知を表示する時間（ミリ秒）。 */
export const REORDER_COMPLETION_NOTICE_DURATION_MS = 2000;

// DnD Input

/** マウス操作でDnDを開始するまでに必要なポインター移動距離（px）。 */
export const DND_MOUSE_ACTIVATION_DISTANCE_PX = 5;

/** タッチ操作でDnDを開始するまでの長押し時間（ミリ秒）。 */
export const DND_TOUCH_ACTIVATION_DELAY_MS = 250;

/** タッチ長押し中にDnD開始を維持できるポインター移動許容距離（px）。 */
export const DND_TOUCH_ACTIVATION_TOLERANCE_PX = 5;

// DnD Auto Scroll

/** Column DnDで横Auto Scrollを開始する左右端領域の割合。 */
export const COLUMN_AUTO_SCROLL_EDGE_THRESHOLD_RATIO = 0.2;

/** Column DnDの横Auto Scrollで1描画フレームに移動する距離（px）。 */
export const COLUMN_AUTO_SCROLL_STEP_PX = 16;

/** Row DnDで縦Auto Scrollを開始する上下端領域の割合。 */
export const ROW_AUTO_SCROLL_EDGE_THRESHOLD_RATIO = 0.2;

// DnD Presentation

/** 正常なphysical drop後にdrop位置の行領域枠を表示する時間（ミリ秒）。 */
export const DND_POST_DROP_ROW_OUTLINE_DURATION_MS = 1000;

/** 正常なphysical drop後にdrop位置の列領域枠を表示する時間（ミリ秒）。 */
export const DND_POST_DROP_COLUMN_OUTLINE_DURATION_MS = 1000;

/** 結合セルによりDnDを開始できない場合の通知表示時間（ミリ秒）。 */
export const DND_START_REJECTION_NOTICE_DURATION_MS = 2500;

// Column DnD Layout Availability

/** Toolbar表示用Layout Availabilityの連続した変化通知をまとめる待機時間（ミリ秒）。 */
export const COLUMN_DND_LAYOUT_AVAILABILITY_DEBOUNCE_MS = 100;

// RF Interaction

/** RF narrow表示で高さ変更グリップとして扱うPointer操作領域の高さ（px）。 */
export const RF_NARROW_RESIZE_HANDLE_HEIGHT_PX = 18;

/** RF wide Popoverの手動移動を開始するポインター移動距離（px）。 */
export const RF_POPOVER_DRAG_THRESHOLD_PX = 4;

// RF Layout / Presentation

/** RF narrow表示で許可する最小高さ（px）。 */
export const RF_MINIMUM_NARROW_HEIGHT_PX = 180;

/** RFをwide表示からnarrow表示へ切り替えるEditor利用可能幅の閾値（px）。 */
export const RF_NARROW_AVAILABLE_WIDTH_PX = 700;

/** RF narrow表示で許可する最大高さのviewportに対する割合。 */
export const RF_NARROW_MAXIMUM_VIEWPORT_RATIO = 0.8;

/** Toolbarを基準にRF Popoverを表示するときのoffset（px）。 */
export const RF_POPOVER_OFFSET_PX = 8;

/** RF wide Popoverをviewport端から離す余白（px）。 */
export const RF_POPOVER_VIEWPORT_MARGIN_PX = 8;
