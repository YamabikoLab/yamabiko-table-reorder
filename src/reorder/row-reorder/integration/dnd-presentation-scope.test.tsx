/**
 * 複数の対応Tableが同時に存在する場合も、Reorder Presentationを現在の操作対象だけへ接続することを確認する。
 *
 * TableごとのDnD境界はReact identity維持のため常時存在する一方、共有通知や共有状態を購読するPresentationは
 * 現在選択中のTableだけが所有し、1回の行DnD通知へ複数の表示が反応しない構造を維持する。
 */

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { RowDnd } from './dnd';

jest.mock( '@dnd-kit/dom', () => ( {
	AutoScroller: {
		configure: jest.fn( () => ( { configured: true } ) ),
	},
	Cursor: {},
	PreventSelection: {},
	Feedback: {},
	Draggable: jest.fn(),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	DragDropProvider: ( { children }: { children: ReactNode } ) => children,
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/dnd-interaction', () => ( {
	rowDndInteraction: {
		start: jest.fn(),
		updateDestination: jest.fn(),
		complete: jest.fn(),
		cancel: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/row-reorder/integration/destination-resolution', () => ( {
	createRowDestinationResolver: jest.fn(),
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/target-resolution', () => ( {
	resolveRowReorderTarget: jest.fn(),
} ) );

let mockOnStartRejection: ( ( request: unknown ) => void ) | null = null;

jest.mock( '@/reorder/row-reorder/responsibilities/input', () => ( {
	RowInput: ( {
		children,
		onStartRejection,
	}: {
		children: ( handler: React.PointerEventHandler< Element > ) => ReactNode;
		onStartRejection: ( request: unknown ) => void;
	} ) => {
		mockOnStartRejection = onStartRejection;
		return children( () => undefined );
	},
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/presentation/row-presentation', () => ( {
	RowPresentation: ( props: {
		startRejectionNoticeRef: React.MutableRefObject< {
			show: ( request: unknown ) => void;
		} | null >;
	} ) => {
		const React = jest.requireActual< typeof import('react') >( 'react' );
		const [ noticeCount, setNoticeCount ] = React.useState( 0 );
		React.useImperativeHandle(
			props.startRejectionNoticeRef,
			() => ( { show: () => setNoticeCount( ( current ) => current + 1 ) } ),
			[]
		);
		return <div data-testid="row-presentation">{ noticeCount }</div>;
	},
} ) );

describe( 'Row DnD presentation ownership', () => {
	beforeEach( () => {
		mockOnStartRejection = null;
	} );

	/**
	 * 複数TableのDnD境界が存在しても、現在の操作対象だけがPresentationを所有することを確認する。
	 *
	 * 事前条件:
	 * - Table AとTable BのDnD境界が同時に存在する。
	 * - Table Aだけが現在の操作対象である。
	 *
	 * 操作:
	 * - 両TableのDnD境界を描画する。
	 *
	 * 期待結果:
	 * - 両Tableの既存Block subtreeは描画される。
	 * - Reorder PresentationはTable Aに対応する1つだけが存在する。
	 */
	it( 'when multiple table DnD boundaries are mounted, should connect presentation only for the current table', () => {
		render(
			<>
				<RowDnd presentationEnabled tableIdentity="table-a">
					{ () => <div data-testid="table-a" /> }
				</RowDnd>
				<RowDnd presentationEnabled={ false } tableIdentity="table-b">
					{ () => <div data-testid="table-b" /> }
				</RowDnd>
			</>
		);

		expect( screen.queryByTestId( 'table-a' ) ).not.toBeNull();
		expect( screen.queryByTestId( 'table-b' ) ).not.toBeNull();
		expect( screen.getAllByTestId( 'row-presentation' ) ).toHaveLength( 1 );
	} );

	/**
	 * 開始拒否通知がNoticeだけを更新し、Table subtreeを再描画しないことを確認する。
	 *
	 * 事前条件:
	 * - 現在TableのDnD境界にPresentationとInputが接続されている。
	 *
	 * 操作:
	 * - Inputから結合セルによる開始拒否を通知する。
	 *
	 * 期待結果:
	 * - Noticeの表示状態だけが更新され、既存Block subtreeの描画回数は増えない。
	 */
	it( 'when input reports a start rejection, should update only the notice without rerendering the table subtree', () => {
		const childrenRender = jest.fn( () => <div data-testid="table" /> );
		render(
			<RowDnd presentationEnabled tableIdentity="table-a">
				{ childrenRender }
			</RowDnd>
		);
		const initialRenderCount = childrenRender.mock.calls.length;

		act( () => {
			mockOnStartRejection?.( {
				blockingMergedRange: {
					rowStart: 0,
					rowEnd: 1,
					columnStart: 0,
					columnEnd: 0,
				},
				clientX: 10,
				clientY: 20,
			} );
		} );

		expect( screen.getByTestId( 'row-presentation' ).textContent ).toBe( '1' );
		expect( childrenRender ).toHaveBeenCalledTimes( initialRenderCount );
	} );
} );
