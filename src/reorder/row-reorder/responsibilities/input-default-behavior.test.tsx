/**
 * 行DnD開始入力が、入力方式に応じてブラウザー既定動作を適切に扱うことを確認する。
 *
 * Reorder Target Resolutionは独立責務としてmockし、この境界では開始可能な行に対する
 * マウスとタッチのブラウザー既定動作だけを検証する。
 */

import { Draggable } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { RowInput, type RowDndPointerDownHandler } from './input';

jest.mock( '@dnd-kit/dom', () => ( {
	Draggable: jest.fn(),
	PointerSensor: {
		configure: jest.fn(),
	},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropManager: jest.fn(),
} ) );

jest.mock( './target-resolution', () => ( {
	rowReorderTargetResolution: {
		resolve: jest.fn( ( target ) => ( {
			status: 'resolved',
			target,
			initialConstraints: {
				rowCount: 1,
				blockedBoundaries: [],
			},
		} ) ),
	},
} ) );

const draggableConstructorMock = Draggable as unknown as jest.Mock;
const useDragDropManagerMock = useDragDropManager as jest.MockedFunction<
	typeof useDragDropManager
>;

/** 有効な行DnD開始対象を持つDOMを作成する。 */
const createTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = '<table><tbody><tr><td>row</td></tr></tbody></table>';
	const target = currentTarget.querySelector( 'td' );
	if ( target === null ) {
		throw new Error( 'Row input test target could not be created.' );
	}
	return { currentTarget, target };
};

/**
 * RowInputが子要素へ公開するポインター開始処理を取得する。
 *
 * @return 行DnDのポインター開始処理。
 */
const renderPointerHandler = (): RowDndPointerDownHandler => {
	let handler: RowDndPointerDownHandler | null = null;
	render(
		<RowInput enabled tableIdentity="table-1" activeDraggable={ { current: null } }>
			{ ( currentHandler ) => {
				handler = currentHandler;
				return <div />;
			} }
		</RowInput>
	);
	if ( handler === null ) {
		throw new Error( 'RowInput did not provide a pointer handler.' );
	}
	return handler;
};

/**
 * 有効な行DnD開始入力を生成する。
 *
 * @param pointerType    入力方式。
 * @param target         入力開始位置。
 * @param currentTarget  現在Tableの基準要素。
 * @param preventDefault ブラウザー既定動作の抑止を観測する処理。
 * @return 行DnD開始処理へ渡すポインターイベント。
 */
const createPointerEvent = (
	pointerType: string,
	target: Element,
	currentTarget: Element,
	preventDefault: jest.Mock
): ReactPointerEvent< Element > =>
	( {
		target,
		currentTarget,
		isPrimary: true,
		button: 0,
		pointerType,
		preventDefault,
	} ) as unknown as ReactPointerEvent< Element >;

describe( 'Row DnD input browser defaults', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		draggableConstructorMock.mockImplementation( () => ( {
			destroy: jest.fn(),
		} ) );
		useDragDropManagerMock.mockReturnValue( {
			dragOperation: {
				status: {
					idle: true,
				},
			},
		} as ReturnType< typeof useDragDropManager > );
	} );

	/**
	 * 概要:
	 * - マウスによる行DnD開始入力では文字選択等のブラウザー既定動作を抑止することを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えが有効で、tbody直下行から主マウス入力を開始できる。
	 *
	 * 操作:
	 * - 行セルへ主マウスボタン入力を行う。
	 *
	 * 期待結果:
	 * - Draggableを登録し、ブラウザー既定動作を抑止する。
	 */
	it( 'when eligible mouse input starts row DnD, should prevent the browser default action', () => {
		const { currentTarget, target } = createTarget();
		const pointerDownHandler = renderPointerHandler();
		const preventDefault = jest.fn();

		pointerDownHandler( createPointerEvent( 'mouse', target, currentTarget, preventDefault ) );

		expect( draggableConstructorMock ).toHaveBeenCalledTimes( 1 );
		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - タッチによる行DnD開始入力ではブラウザー既定動作を即時に抑止しないことを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えが有効で、tbody直下行から主タッチ入力を開始できる。
	 *
	 * 操作:
	 * - 行セルへ主タッチ入力を行う。
	 *
	 * 期待結果:
	 * - Draggableを登録するが、タッチ開始時点ではブラウザー既定動作を抑止しない。
	 */
	it( 'when eligible touch input starts row DnD, should keep the browser default action available', () => {
		const { currentTarget, target } = createTarget();
		const pointerDownHandler = renderPointerHandler();
		const preventDefault = jest.fn();

		pointerDownHandler( createPointerEvent( 'touch', target, currentTarget, preventDefault ) );

		expect( draggableConstructorMock ).toHaveBeenCalledTimes( 1 );
		expect( preventDefault ).not.toHaveBeenCalled();
	} );
} );
