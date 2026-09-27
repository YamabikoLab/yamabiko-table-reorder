/**
 * WordPress Reorder Apply Integrationの表示Lifecycleが、Production DOM Context・表示復帰・focusと描画完了に従って進むことを確認する。
 */

import { render } from '@testing-library/react';
import { createPortal } from 'react-dom';

import type { ReorderApplyPresentationState } from './adapter';
import { useReorderApplyLifecycle } from './lifecycle';

const RESTORED_CELL_CLASS = 'yamabiko-table-reorder-restored-cell';

/**
 * JSDOMにないpaintを、実Editor Window上のAnimation Frame境界だけで決定的に進められるようにする。
 *
 * @param editorWindow 基準要素が属するEditor Window。
 * @return 次のFrameを進める操作と解除処理。
 */
const controlAnimationFrames = ( editorWindow: Window ) => {
	let nextFrameId = 1;
	const callbacks = new Map< number, FrameRequestCallback >();
	const requestAnimationFrame = jest
		.spyOn( editorWindow, 'requestAnimationFrame' )
		.mockImplementation( ( callback: FrameRequestCallback ) => {
			const frameId = nextFrameId++;
			callbacks.set( frameId, callback );
			return frameId;
		} );
	const cancelAnimationFrame = jest
		.spyOn( editorWindow, 'cancelAnimationFrame' )
		.mockImplementation( ( frameId: number ) => {
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
	const restore = (): void => {
		requestAnimationFrame.mockRestore();
		cancelAnimationFrame.mockRestore();
	};
	return { flushNextFrame, restore };
};

/**
 * 実browsing contextを持つEditor iframeとLifecycle基準要素の描画先を作成する。
 *
 * @param title fixtureを識別するiframe title。
 * @return Editor document、window、描画先、Frame制御、破棄操作。
 */
const createEditorFixture = ( title: string ) => {
	const iframe = document.createElement( 'iframe' );
	iframe.title = title;
	document.body.append( iframe );
	const editorDocument = iframe.contentDocument;
	const editorWindow = iframe.contentWindow;
	if ( editorDocument === null || editorWindow === null ) {
		iframe.remove();
		throw new Error( 'Expected editor iframe browsing context.' );
	}
	const referenceContainer = editorDocument.createElement( 'div' );
	editorDocument.body.append( referenceContainer );
	const frames = controlAnimationFrames( editorWindow );
	const cleanup = (): void => {
		frames.restore();
		iframe.remove();
	};
	return { editorDocument, editorWindow, referenceContainer, frames, cleanup };
};

/**
 * 表示状態に対応する現在要素へLifecycleの基準要素参照を接続する。
 *
 * @param props                    Lifecycleへ渡す状態と現在Editor DOM。
 * @param props.presentation       現在のPresentation状態。
 * @param props.referenceContainer 現在Editor DOM内の描画先。
 * @return 現在phaseの基準要素。
 */
const LifecycleHarness = ( props: {
	presentation: ReorderApplyPresentationState;
	referenceContainer: Element;
} ) => {
	const { presentation, referenceContainer } = props;
	const { applyingReferenceElementRef, restorationReferenceElementRef } =
		useReorderApplyLifecycle( presentation );

	let referenceElement: React.ReactNode = null;
	/* 反映開始段階では、反映中表示そのものを現在のEditor DOM Contextの基準要素とする。 */
	if ( presentation.phase === 'applying' ) {
		referenceElement = <div ref={ applyingReferenceElementRef }>Applying</div>;
	}
	/* 表示復帰時は、現在Tableと同じEditor DOM Contextに属する基準要素を接続する。 */
	if ( presentation.phase === 'restoring' ) {
		referenceElement = <div ref={ restorationReferenceElementRef }>Restoring</div>;
	}
	return createPortal( referenceElement, referenceContainer );
};

/**
 * Production表示復帰とFocus Coordinationが参照できるTable DOMを作成する。
 *
 * @param editorDocument 表示復帰先のEditor document。
 * @param tableIdentity  対象TableのIdentity。
 * @param rowCount       Tableの行数。
 * @param columnCount    Tableの列数。
 */
const createTableDom = (
	editorDocument: Document,
	tableIdentity: string,
	rowCount: number,
	columnCount: number
) => {
	const tableBlock = editorDocument.createElement( 'div' );
	tableBlock.dataset.block = tableIdentity;
	const table = editorDocument.createElement( 'table' );
	const body = editorDocument.createElement( 'tbody' );
	for ( let rowIndex = 0; rowIndex < rowCount; rowIndex++ ) {
		const row = editorDocument.createElement( 'tr' );
		for ( let columnIndex = 0; columnIndex < columnCount; columnIndex++ ) {
			const cell = editorDocument.createElement( 'td' );
			const editable = editorDocument.createElement( 'span' );
			editable.setAttribute( 'contenteditable', 'true' );
			editable.textContent = `${ rowIndex + 1 }-${ columnIndex + 1 }`;
			Object.defineProperty( editable, 'scrollIntoView', {
				configurable: true,
				value: jest.fn(),
			} );
			/* JSDOMにないscroll境界は、Productionが選択したfallback要素でも呼び出せるよう補完する。 */
			Object.defineProperty( cell, 'scrollIntoView', {
				configurable: true,
				value: jest.fn(),
			} );
			cell.append( editable );
			row.append( cell );
		}
		Object.defineProperty( row, 'scrollIntoView', {
			configurable: true,
			value: jest.fn(),
		} );
		body.append( row );
	}
	table.append( body );
	tableBlock.append( table );
	editorDocument.body.prepend( tableBlock );
	return tableBlock;
};

describe( 'WordPress Reorder Apply Integration lifecycle', () => {
	/**
	 * 反映中表示が利用者へ描画される前に重いTable更新を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは反映開始状態である。
	 * - 基準要素は実Editor iframeに属している。
	 *
	 * 操作:
	 * - 反映中表示をmountし、JSDOMにない描画待ちを順に完了する。
	 *
	 * 期待結果:
	 * - 1回目の描画待ちだけでは反映を開始しない。
	 * - 反映中表示を利用者へ反映できる時点でTable更新を1回開始する。
	 */
	it( 'when applying presentation is mounted, should start the table update only after the applying view is painted', () => {
		const apply = jest.fn();
		const editor = createEditorFixture( 'applying-editor' );
		render(
			<LifecycleHarness
				referenceContainer={ editor.referenceContainer }
				presentation={ {
					phase: 'applying',
					kind: 'row',
					tableIdentity: 'table-a',
					apply,
				} }
			/>
		);

		expect( apply ).not.toHaveBeenCalled();
		editor.frames.flushNextFrame();
		expect( apply ).not.toHaveBeenCalled();
		editor.frames.flushNextFrame();
		expect( apply ).toHaveBeenCalledTimes( 1 );
		editor.cleanup();
	} );

	/**
	 * 反映開始時にEditor DOM Contextを解決できない場合も、別環境を推測せずTable更新を開始できることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは反映開始状態である。
	 * - 基準要素のdocumentには対応するwindowがない。
	 *
	 * 操作:
	 * - 反映中Presentationをmountする。
	 *
	 * 期待結果:
	 * - 描画待ちを作らずTable更新を1回開始する。
	 */
	it( 'when applying has no editor context, should start the table update without inventing another context', () => {
		const apply = jest.fn();
		const detachedDocument = document.implementation.createHTMLDocument( 'detached-editor' );
		const referenceContainer = detachedDocument.createElement( 'div' );
		detachedDocument.body.append( referenceContainer );

		render(
			<LifecycleHarness
				referenceContainer={ referenceContainer }
				presentation={ {
					phase: 'applying',
					kind: 'row',
					tableIdentity: 'table-a',
					apply,
				} }
			/>
		);

		expect( apply ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * Column successでも既存描画待ち後にProductionのColumn結果確認focusを一回適用してから完了することを確認する。
	 *
	 * 事前条件:
	 * - 列並び替えが成功し、確定後列位置が実Editor DOMに存在する。
	 *
	 * 操作:
	 * - 表示復帰Presentationをmountし、描画待ちを完了する。
	 *
	 * 期待結果:
	 * - 確定列は表示・強調される。
	 * - 描画後に同じ列へfocusしてからLifecycleを完了する。
	 */
	it( 'when a column reorder succeeds, should focus the confirmed column after paint before completing', () => {
		const editor = createEditorFixture( 'column-restoration-editor' );
		const tableBlock = createTableDom( editor.editorDocument, 'table-a', 1, 4 );
		const destinationCell = tableBlock.querySelectorAll( 'td' ).item( 2 );
		const complete = jest.fn( () => {
			expect( editor.editorDocument.activeElement ).toBe( destinationCell );
		} );

		render(
			<LifecycleHarness
				referenceContainer={ editor.referenceContainer }
				presentation={ {
					phase: 'restoring',
					owner: 'column',
					kind: 'column',
					tableIdentity: 'table-a',
					applied: true,
					destinationIndex: 2,
					complete,
				} }
			/>
		);

		expect( destinationCell.classList.contains( RESTORED_CELL_CLASS ) ).toBe( true );
		expect( editor.editorDocument.activeElement ).not.toBe( destinationCell );
		expect( complete ).not.toHaveBeenCalled();
		editor.frames.flushNextFrame();
		editor.frames.flushNextFrame();
		expect( editor.editorDocument.activeElement ).toBe( destinationCell );
		expect( complete ).toHaveBeenCalledTimes( 1 );
		editor.cleanup();
	} );

	/**
	 * 表示復帰時にEditor DOM Contextを解決できない場合は、誤った復帰先を推測せずLifecycleだけを完了することを確認する。
	 *
	 * 事前条件:
	 * - 並び替えは成功して確定後位置が存在する。
	 * - 基準要素のdocumentには対応するwindowがない。
	 *
	 * 操作:
	 * - 表示復帰Presentationをmountする。
	 *
	 * 期待結果:
	 * - Tableの結果位置は強調されない。
	 * - Lifecycle完了だけを1回実行する。
	 */
	it( 'when restoration has no editor context, should complete without restoring or focusing another context', () => {
		const complete = jest.fn();
		const detachedDocument = document.implementation.createHTMLDocument( 'detached-editor' );
		const tableBlock = createTableDom( detachedDocument, 'table-a', 2, 1 );
		const referenceContainer = detachedDocument.createElement( 'div' );
		detachedDocument.body.append( referenceContainer );

		render(
			<LifecycleHarness
				referenceContainer={ referenceContainer }
				presentation={ {
					phase: 'restoring',
					owner: 'row',
					kind: 'row',
					tableIdentity: 'table-a',
					applied: true,
					destinationIndex: 1,
					complete,
				} }
			/>
		);

		expect( tableBlock.querySelector( `.${ RESTORED_CELL_CLASS }` ) ).toBeNull();
		expect( complete ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 反映中表示が終了した後に、以前予約したTable更新を実行しないことを確認する。
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
		const editor = createEditorFixture( 'cancelled-applying-editor' );
		const view = render(
			<LifecycleHarness
				referenceContainer={ editor.referenceContainer }
				presentation={ {
					phase: 'applying',
					kind: 'row',
					tableIdentity: 'table-a',
					apply,
				} }
			/>
		);

		view.rerender(
			<LifecycleHarness
				referenceContainer={ editor.referenceContainer }
				presentation={ { phase: 'idle' } }
			/>
		);
		editor.frames.flushNextFrame();
		editor.frames.flushNextFrame();

		expect( apply ).not.toHaveBeenCalled();
		editor.cleanup();
	} );

	/**
	 * 反映中から表示復帰へ移る際に以前のEditor DOM Contextを再利用せず、現在の表示環境で復帰することを確認する。
	 *
	 * 事前条件:
	 * - 反映中表示はEditor DOM Context Aに属している。
	 * - 行反映後の表示復帰は別のEditor DOM Context Bに属している。
	 *
	 * 操作:
	 * - Context Aで反映開始まで進めた後、Context Bで表示復帰段階へ進める。
	 *
	 * 期待結果:
	 * - 結果強調とfocusはContext Bの確定行だけへ適用される。
	 * - Context Bの描画後にLifecycleを完了する。
	 */
	it( 'when restoration occurs in a new editor context, should restore only in the current context before completing', () => {
		const apply = jest.fn();
		const applyingEditor = createEditorFixture( 'applying-editor' );
		const restorationEditor = createEditorFixture( 'restoration-editor' );
		const applyingTable = createTableDom( applyingEditor.editorDocument, 'table-a', 5, 1 );
		const restorationTable = createTableDom( restorationEditor.editorDocument, 'table-a', 5, 1 );
		const restorationCell = restorationTable
			.querySelectorAll( 'tbody tr' )
			.item( 4 )
			.querySelector( 'td' );
		const complete = jest.fn( () => {
			expect( restorationEditor.editorDocument.activeElement ).toBe( restorationCell );
		} );
		const view = render(
			<LifecycleHarness
				referenceContainer={ applyingEditor.referenceContainer }
				presentation={ {
					phase: 'applying',
					kind: 'row',
					tableIdentity: 'table-a',
					apply,
				} }
			/>
		);
		applyingEditor.frames.flushNextFrame();
		applyingEditor.frames.flushNextFrame();
		expect( apply ).toHaveBeenCalledTimes( 1 );

		view.rerender(
			<LifecycleHarness
				referenceContainer={ restorationEditor.referenceContainer }
				presentation={ {
					phase: 'restoring',
					owner: 'row',
					kind: 'row',
					tableIdentity: 'table-a',
					applied: true,
					destinationIndex: 4,
					complete,
				} }
			/>
		);

		expect( applyingTable.querySelector( `.${ RESTORED_CELL_CLASS }` ) ).toBeNull();
		expect( restorationCell?.classList.contains( RESTORED_CELL_CLASS ) ).toBe( true );
		expect( complete ).not.toHaveBeenCalled();
		restorationEditor.frames.flushNextFrame();
		restorationEditor.frames.flushNextFrame();
		expect( restorationEditor.editorDocument.activeElement ).toBe( restorationCell );
		expect( complete ).toHaveBeenCalledTimes( 1 );
		applyingEditor.cleanup();
		restorationEditor.cleanup();
	} );

	/**
	 * Table更新が成立せず復帰先を確定できない場合も、誤った表示復帰を行わずLifecycleだけを完了することを確認する。
	 *
	 * 事前条件:
	 * - 列の並び替えは反映されていない。
	 * - 表示復帰先は確定していない。
	 *
	 * 操作:
	 * - 表示復帰段階をmountし、描画待ちを完了する。
	 *
	 * 期待結果:
	 * - Table内のどのセルも結果位置として強調・focusされない。
	 * - 現在表示を描画した後にLifecycleを完了する。
	 */
	it( 'when an update was not applied and has no destination, should complete restoration without restoring a destination', () => {
		const editor = createEditorFixture( 'failed-restoration-editor' );
		const tableBlock = createTableDom( editor.editorDocument, 'table-a', 1, 3 );
		const complete = jest.fn();

		render(
			<LifecycleHarness
				referenceContainer={ editor.referenceContainer }
				presentation={ {
					phase: 'restoring',
					owner: 'rf',
					kind: 'column',
					tableIdentity: 'table-a',
					applied: false,
					destinationIndex: null,
					complete,
				} }
			/>
		);

		expect( tableBlock.querySelector( `.${ RESTORED_CELL_CLASS }` ) ).toBeNull();
		editor.frames.flushNextFrame();
		editor.frames.flushNextFrame();
		expect( tableBlock.contains( editor.editorDocument.activeElement ) ).toBe( false );
		expect( complete ).toHaveBeenCalledTimes( 1 );
		editor.cleanup();
	} );
} );
