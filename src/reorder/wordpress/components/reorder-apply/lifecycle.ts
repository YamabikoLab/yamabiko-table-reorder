/**
 * WordPress Reorder Apply Integrationの表示Lifecycleを接続する。
 *
 * 反映開始前と表示復帰完了前に必要な描画待ちを管理し、各段階で現在表示されている基準要素から
 * Editor DOM Contextを解決する。Apply successでは表示再成立後の現在DOMへ結果確認focusを一回適用してから完了する。
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { requestApplyFocus } from '@/reorder/wordpress/focus/apply';

import type { ReorderApplyPresentationState } from './adapter';
import { restoreMovedColumn, restoreMovedRow } from './restoration';

/** WordPress表示Lifecycleが各段階の現在の基準要素を受け取る参照。 */
export type ReorderApplyLifecycleReferences = {
	/** 反映中表示が属する現在のEditor DOM Contextを特定する基準要素。 */
	applyingReferenceElementRef: RefObject< HTMLDivElement >;
	/** 表示復帰時の現在のEditor DOM Contextを特定する基準要素。 */
	restorationReferenceElementRef: RefObject< HTMLDivElement >;
};

/**
 * 現在のEditor DOM Contextで表示更新が利用者へ反映された後にLifecycle操作を進める。
 *
 * 呼び出し元の段階が終了した場合は、まだ実行されていない操作を破棄できるよう解除処理を返す。
 *
 * @param editorWindow 現在の基準要素から解決したEditor DOM Contextのwindow。
 * @param callback     表示更新後に進めるLifecycle操作。
 * @return 未完了の描画待ちを破棄する解除処理。
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
 * 反映開始と反映後の表示復帰を、現在のEditor DOM Contextへ接続する。
 *
 * 反映中表示が描画された後にTable更新を開始する。success表示復帰では表示位置と結果強調を復帰し、
 * 既存描画待ち後の現在DOMへ結果確認focusを一回適用してからLifecycleを完了する。
 *
 * @param presentation 対象Tableへ表示している現在のPresentation状態。
 * @return 反映中と表示復帰中の現在の基準要素へ接続する参照。
 */
export const useReorderApplyLifecycle = (
	presentation: ReorderApplyPresentationState
): ReorderApplyLifecycleReferences => {
	const applyingReferenceElementRef = useRef< HTMLDivElement >( null );
	const restorationReferenceElementRef = useRef< HTMLDivElement >( null );

	const isApplying = presentation.phase === 'applying';
	const apply = isApplying ? presentation.apply : null;

	useEffect( () => {
		// 反映開始段階以外では、反映中表示の描画待ちとTable更新を開始しない。
		if ( ! isApplying || apply === null ) {
			return;
		}

		const referenceElement = applyingReferenceElementRef.current;
		const editorContext =
			referenceElement === null ? null : resolveEditorDomContext( referenceElement );
		// 現在のEditor DOM Contextを解決できない場合は別の表示環境を推測せず、描画待ちだけを省略する。
		if ( editorContext === null ) {
			apply();
			return;
		}

		// 対象Tableを退避した反映中表示が利用者へ反映された後に、重いTable更新を開始する。
		return runAfterVisualPaint( editorContext.window, apply );
	}, [ apply, isApplying ] );

	const isRestoring = presentation.phase === 'restoring';
	const kind = isRestoring ? presentation.kind : null;
	const tableIdentity = isRestoring ? presentation.tableIdentity : null;
	const applied = isRestoring ? presentation.applied : false;
	const destinationIndex = isRestoring ? presentation.destinationIndex : null;
	const complete = isRestoring ? presentation.complete : null;

	useEffect( () => {
		// 表示復帰段階が成立していない間は、復帰とLifecycle完了を開始しない。
		if ( ! isRestoring || kind === null || tableIdentity === null || complete === null ) {
			return;
		}

		// 反映成功時には確定済みの復帰先が必須であり、失敗時には復帰先なしでもLifecycleを完了できる。
		if ( applied && destinationIndex === null ) {
			return;
		}

		const referenceElement = restorationReferenceElementRef.current;
		const editorContext =
			referenceElement === null ? null : resolveEditorDomContext( referenceElement );

		// success時だけ、現在Editor DOM Contextで表示位置と結果強調を復帰する。focusはここでは適用しない。
		if ( applied && destinationIndex !== null && editorContext !== null ) {
			if ( kind === 'row' ) {
				restoreMovedRow( editorContext.document, tableIdentity, destinationIndex );
			} else {
				restoreMovedColumn( editorContext.document, tableIdentity, destinationIndex );
			}
		}

		// 現在のEditor DOM Contextがない場合も別の表示環境へ切り替えず、復帰Lifecycleだけを完了する。
		if ( editorContext === null ) {
			complete();
			return;
		}

		return runAfterVisualPaint( editorContext.window, () => {
			/*
			 * success時は描画待ち完了時点の現在要素からfocus先を解決する。
			 * Focus Coordination自身には待機状態を持たせず、この一回適用後にLifecycleを完了する。
			 */
			const currentReferenceElement = restorationReferenceElementRef.current;
			if ( applied && destinationIndex !== null && currentReferenceElement !== null ) {
				requestApplyFocus(
					{
						type: kind === 'row' ? 'row-success' : 'column-success',
						tableIdentity,
						destinationIndex,
					},
					currentReferenceElement
				);
			}
			complete();
		} );
	}, [ applied, complete, destinationIndex, isRestoring, kind, tableIdentity ] );

	return { applyingReferenceElementRef, restorationReferenceElementRef };
};
