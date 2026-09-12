/**
 * WordPress Reorder Apply Integrationの表示Lifecycleが、各段階の現在のEditor DOM Contextと描画完了に従って進むことを確認する。
 */

import { render } from '@testing-library/react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import type { ReorderApplyPresentationState } from './adapter';
import { useReorderApplyLifecycle } from './lifecycle';
import { restoreMovedColumn, restoreMovedRow } from './restoration';

jest.mock( '@/reorder/editor-dom-context', () => ( {
	resolveEditorDomContext: jest.fn(),
} ) );

jest.mock( './restoration', () => ( {
	restoreMovedColumn: jest.fn(),
	restoreMovedRow: jest.fn(),
} ) );

const resolveEditorDomContextMock = resolveEditorDomContext as jest.Mock;
const restoreMovedColumnMock = restoreMovedColumn as jest.Mock;
const restoreMovedRowMock = restoreMovedRow as jest.Mock;

/** 描画待ちをテスト側から1段階ずつ進められるEditor Windowを作成する。 */
const createEditorWindow = () => {
	let nextFrameId = 1;
	const callbacks = new Map< number, FrameRequestCallback >();
	const requestAnimationFrame = jest.fn( ( callback: FrameRequestCallback ) => {
		const frameId = nextFrameId++;
		callbacks.set( frameId, callback );
		return frameId;
	} );
	const cancelAnimationFrame = jest.fn( ( frameId: number ) => {
		callbacks.delete( frameId );
	} );
	const flushNextFrame = (): void => {
		const nextFrame = callbacks.entries().next();
		/* 待機中の描画更新がない場合は、Lifecycleを進める処理も実行しない。 */
		if ( nextFrame.done ) {
			return;
		}
		const [ frameId, callback ] = nextFrame.value;
		callbacks.delete( frameId );
		callback( 0 );
	};
	return {
		window: { requestAnimationFrame, cancelAnimationFrame } as unknown as Window,
		flushNextFrame,
	};
};

/** 表示状態に対応する現在要素へLifecycleの基準要素参照を接続する。 */
const LifecycleHarness = ( props: { presentation: ReorderApplyPresentationState } ) => {
	const { presentation } = props;
	const { applyingReferenceElementRef, restorationReferenceElementRef } =
		useReorderApplyLifecycle( presentation );

	/* 反映開始段階では、反映中表示そのものを現在のEditor DOM Contextの基準要素とする。 */
	if ( presentation.phase === 'applying' ) {
		return <div ref={ applyingReferenceElementRef }>Applying</div>;
	}
	/* 再mount後は、復帰中表示を新しいEditor DOM Contextの基準要素として接続し直す。 */
	if ( presentation.phase === 'remounting' ) {
		return <div ref={ restorationReferenceElementRef }>Restoring</div>;
	}
	return null;
};

describe( 'WordPress Reorder Apply Integration lifecycle', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 概要:
	 * - 反映中表示が利用者へ描画される前に重いTable更新を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは反映開始状態である。
	 * - 現在の基準要素からEditor DOM Contextを解決できる。
	 *
	 * 操作:
	 * - 反映中表示をmountし、描画待ちを順に完了する。
	 *
	 * 期待結果:
	 * - 1回目の描画待ちだけでは反映を開始しない。
	 * - 反映中表示を利用者へ反映できる時点でTable更新を1回開始する。
	 */
	it( 'when applying presentation is mounted, should start the table update only after the applying view is painted', () => {
		const apply = jest.fn();
		const editorWindow = createEditorWindow();
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: editorWindow.window,
		} );

		render(
			<LifecycleHarness
				presentation={ {
					phase: 'applying',
					kind: 'row',
					tableIdentity: 'table-a',
					apply,
				} }
			/>
		);

		expect( apply ).not.toHaveBeenCalled();
		editorWindow.flushNextFrame();
		expect( apply ).not.toHaveBeenCalled();
		editorWindow.flushNextFrame();
		expect( apply ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - 反映中表示が終了した後に、以前予約したTable更新を実行しないことを確認する。
	 *
	 * 事前条件:
	 * - 反映中表示の描画待ちが未完了である。
	 *
	 * 操作:
	 * - 描画待ち完了前に表示状態を通常状態へ変更する。
	 *
	 * 期待結果:
	 * - 終了済みの反映開始操作は実行されない。
	 */
	it( 'when applying presentation ends before paint completes, should cancel the pending table update', () => {
		const apply = jest.fn();
		const editorWindow = createEditorWindow();
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: editorWindow.window,
		} );
		const view = render(
			<LifecycleHarness
				presentation={ {
					phase: 'applying',
					kind: 'row',
					tableIdentity: 'table-a',
					apply,
				} }
			/>
		);

		view.rerender( <LifecycleHarness presentation={ { phase: 'idle' } } /> );
		editorWindow.flushNextFrame();
		editorWindow.flushNextFrame();

		expect( apply ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 反映中から再mountへ移る際に以前のEditor DOM Contextを再利用せず、現在の表示環境で復帰することを確認する。
	 *
	 * 事前条件:
	 * - 反映中表示はEditor DOM Context Aに属している。
	 * - 行反映後の再mount表示は別のEditor DOM Context Bに属している。
	 *
	 * 操作:
	 * - Context Aで反映開始まで進めた後、Context Bで表示復帰段階へ進める。
	 *
	 * 期待結果:
	 * - 表示復帰にはContext Bのdocumentと反映後最終行位置だけを利用する。
	 * - 復帰表示の描画後にLifecycleを完了する。
	 */
	it( 'when remounting occurs in a new editor context, should restore only in the remounted context before completing', () => {
		const apply = jest.fn();
		const complete = jest.fn();
		const applyingWindow = createEditorWindow();
		const restorationWindow = createEditorWindow();
		const applyingDocument = document.implementation.createHTMLDocument( 'applying-editor' );
		const restorationDocument = document.implementation.createHTMLDocument( 'remounted-editor' );
		resolveEditorDomContextMock.mockReturnValueOnce( {
			document: applyingDocument,
			window: applyingWindow.window,
		} );
		const view = render(
			<LifecycleHarness
				presentation={ {
					phase: 'applying',
					kind: 'row',
					tableIdentity: 'table-a',
					apply,
				} }
			/>
		);
		applyingWindow.flushNextFrame();
		applyingWindow.flushNextFrame();
		expect( apply ).toHaveBeenCalledTimes( 1 );

		resolveEditorDomContextMock.mockReturnValueOnce( {
			document: restorationDocument,
			window: restorationWindow.window,
		} );
		view.rerender(
			<LifecycleHarness
				presentation={ {
					phase: 'remounting',
					kind: 'row',
					tableIdentity: 'table-a',
					applied: true,
					destinationIndex: 4,
					complete,
				} }
			/>
		);

		expect( restoreMovedRowMock ).toHaveBeenCalledWith( restorationDocument, 'table-a', 4 );
		expect( restoreMovedRowMock ).not.toHaveBeenCalledWith( applyingDocument, 'table-a', 4 );
		expect( complete ).not.toHaveBeenCalled();
		restorationWindow.flushNextFrame();
		restorationWindow.flushNextFrame();
		expect( complete ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - Table更新が成立しなかった場合は誤った表示復帰を行わずLifecycleだけを完了することを確認する。
	 *
	 * 事前条件:
	 * - 列の並び替えは反映されず、対象Tableは再mountされている。
	 * - 再mount後のEditor DOM Contextを解決できる。
	 *
	 * 操作:
	 * - 表示復帰段階をmountし、描画待ちを完了する。
	 *
	 * 期待結果:
	 * - 行・列どちらの表示復帰も行わない。
	 * - 再mount後の表示を描画した後にLifecycleを完了する。
	 */
	it( 'when a column update was not applied, should complete remounting without restoring a destination', () => {
		const complete = jest.fn();
		const editorWindow = createEditorWindow();
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: editorWindow.window,
		} );

		render(
			<LifecycleHarness
				presentation={ {
					phase: 'remounting',
					kind: 'column',
					tableIdentity: 'table-a',
					applied: false,
					destinationIndex: 2,
					complete,
				} }
			/>
		);

		expect( restoreMovedRowMock ).not.toHaveBeenCalled();
		expect( restoreMovedColumnMock ).not.toHaveBeenCalled();
		editorWindow.flushNextFrame();
		editorWindow.flushNextFrame();
		expect( complete ).toHaveBeenCalledTimes( 1 );
	} );
} );
