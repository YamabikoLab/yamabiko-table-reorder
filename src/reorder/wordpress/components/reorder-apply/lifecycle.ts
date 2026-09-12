/**
 * WordPress Reorder Apply Integrationの表示Lifecycleを接続する。
 *
 * 反映開始前と表示復帰完了前に必要な描画待ちを管理し、各段階で現在表示されている基準要素から
 * Editor DOM Contextを解決する。反映中から再mount後へDOM要素やEditor DOM Contextを持ち越さず、
 * 段階終了時には未完了の描画待ちを破棄する。
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import type { ReorderApplyPresentationState } from './adapter';
import { restoreMovedColumn, restoreMovedRow } from './restoration';

/** WordPress表示Lifecycleが各段階の現在の基準要素を受け取る参照。 */
export type ReorderApplyLifecycleReferences = {
	/** 反映中表示が属する現在のEditor DOM Contextを特定する基準要素。 */
	applyingReferenceElementRef: RefObject< HTMLDivElement >;
	/** 再mount後の表示が属する現在のEditor DOM Contextを特定する基準要素。 */
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
 * 確認付き大規模反映の反映開始と再mount後の表示復帰を、現在のEditor DOM Contextへ接続する。
 *
 * 反映中表示が描画された後にTable更新を開始し、再mount後は反映成功時だけ表示位置とフォーカスを復帰してから
 * 完了通知を行う。各段階ではその時点の基準要素からEditor DOM Contextを解決し、以前の表示環境を再利用しない。
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
		if ( ! isApplying || apply === null ) {
			return;
		}

		const referenceElement = applyingReferenceElementRef.current;
		const editorContext =
			referenceElement === null ? null : resolveEditorDomContext( referenceElement );
		/* 現在のEditor DOM Contextを解決できない場合は別の表示環境を推測せず、描画待ちだけを省略する。 */
		if ( editorContext === null ) {
			apply();
			return;
		}

		/* 対象Tableを退避した反映中表示が利用者へ反映された後に、重いTable更新を開始する。 */
		return runAfterVisualPaint( editorContext.window, apply );
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

		const referenceElement = restorationReferenceElementRef.current;
		const editorContext =
			referenceElement === null ? null : resolveEditorDomContext( referenceElement );
		/* 反映成功時だけ、再mount後の現在Editor DOM Contextで表示位置とフォーカスを復帰する。 */
		if ( applied && editorContext !== null ) {
			if ( direction === 'row' ) {
				restoreMovedRow( editorContext.document, tableIdentity, destinationIndex );
			} else {
				restoreMovedColumn( editorContext.document, tableIdentity, destinationIndex );
			}
		}

		/* 現在のEditor DOM Contextがない場合も別の表示環境へ切り替えず、復帰Lifecycleだけを完了する。 */
		if ( editorContext === null ) {
			complete();
			return;
		}

		return runAfterVisualPaint( editorContext.window, complete );
	}, [ applied, complete, destinationIndex, direction, isRemounting, tableIdentity ] );

	return { applyingReferenceElementRef, restorationReferenceElementRef };
};
