/**
 * WordPress Reorder Apply Integrationの表示Lifecycleを接続する。
 *
 * applyingでは現在mountされている反映中Presentation anchor、remountingでは表示復帰後のstatus anchorから
 * Editor DOM Contextをそのphaseごとに解決し、paint-before-apply、scroll / focus restoration、完了待ちを接続する。
 * phaseを跨いでDOM NodeやEditor Contextを保持せず、予約したframeは各phase終了時にcleanupする。
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { ReorderApplyPresentationState } from './adapter';
import { restoreMovedColumn, restoreMovedRow } from './restoration';

/** WordPress表示Lifecycleが各phaseの現在要素を受け取るPresentation anchor。 */
export type ReorderApplyLifecycleAnchors = {
	applyingAnchorRef: RefObject< HTMLDivElement >;
	restorationAnchorRef: RefObject< HTMLDivElement >;
};

/**
 * 現在のEditor Windowで2 frame待ってから処理し、phase終了時に予約を破棄できるようにする。
 *
 * @param editorWindow 現在mountされているPresentation要素から解決したEditor Window。
 * @param callback     paint後に実行するLifecycle操作。
 * @return 予約済みframeを取り消すcleanup。
 */
const runAfterVisualPaint = ( editorWindow: Window, callback: () => void ): ( () => void ) => {
	let secondFrame = 0;
	const firstFrame = editorWindow.requestAnimationFrame( () => {
		secondFrame = editorWindow.requestAnimationFrame( callback );
	} );
	const cleanup = (): void => {
		editorWindow.cancelAnimationFrame( firstFrame );
		if ( secondFrame !== 0 ) {
			editorWindow.cancelAnimationFrame( secondFrame );
		}
	};
	return cleanup;
};

/**
 * 確認付き大規模反映のapplying / remounting phaseを現在のEditor Contextへ接続する。
 *
 * @param presentation 対象Tableへ表示している現在のPresentation状態。
 * @return applyingとrestorationそれぞれの現在要素へ接続するanchor ref。
 */
export const useReorderApplyLifecycle = (
	presentation: ReorderApplyPresentationState
): ReorderApplyLifecycleAnchors => {
	const applyingAnchorRef = useRef< HTMLDivElement >( null );
	const restorationAnchorRef = useRef< HTMLDivElement >( null );

	const isApplying = presentation.phase === 'applying';
	const apply = isApplying ? presentation.apply : null;

	useEffect( () => {
		if ( ! isApplying || apply === null ) {
			return;
		}

		const editorWindow = applyingAnchorRef.current?.ownerDocument.defaultView ?? null;
		/* Editor Windowを現在要素から取得できない場合は別Contextを推測せず、paint待ちだけを省略する。 */
		if ( editorWindow === null ) {
			apply();
			return;
		}

		/* 対象Tableの退避と反映中表示を先に描画し、重いTable更新より前に利用者へ反映開始を伝える。 */
		return runAfterVisualPaint( editorWindow, apply );
	}, [ apply, isApplying ] );

	const isRemounting = presentation.phase === 'remounting';
	const direction = isRemounting ? presentation.direction : null;
	const tableIdentity = isRemounting ? presentation.tableIdentity : null;
	const applied = isRemounting ? presentation.applied : false;
	const destinationIndex = isRemounting ? presentation.destinationIndex : null;
	const complete = isRemounting ? presentation.complete : null;

	useEffect( () => {
		if (
			! isRemounting ||
			direction === null ||
			tableIdentity === null ||
			destinationIndex === null ||
			complete === null
		) {
			return;
		}

		const editorDocument = restorationAnchorRef.current?.ownerDocument ?? null;
		/* 反映成功時だけ、remount後の現在Documentから対象を取り直して表示位置とfocusを復帰する。 */
		if ( applied && editorDocument !== null ) {
			if ( direction === 'row' ) {
				restoreMovedRow( editorDocument, tableIdentity, destinationIndex );
			} else {
				restoreMovedColumn( editorDocument, tableIdentity, destinationIndex );
			}
		}

		const editorWindow = editorDocument?.defaultView ?? null;
		/* 現在のEditor Windowがない場合も別Windowへfallbackせず、復帰Lifecycleだけを完了する。 */
		if ( editorWindow === null ) {
			complete();
			return;
		}

		return runAfterVisualPaint( editorWindow, complete );
	}, [ applied, complete, destinationIndex, direction, isRemounting, tableIdentity ] );

	return { applyingAnchorRef, restorationAnchorRef };
};
