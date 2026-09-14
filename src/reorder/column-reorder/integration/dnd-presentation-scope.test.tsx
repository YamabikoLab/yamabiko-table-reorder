/**
 * 複数の対応Tableが同時に存在する場合も、Column Reorder Presentationを現在の操作対象だけへ接続することを確認する。
 *
 * TableごとのDnD境界はReact identity維持のため常時存在する一方、DnD状態を購読するPresentationは
 * 現在選択中のTableだけが所有し、1回の列DnD通知へ複数の表示が反応しない構造を維持する。
 */

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ColumnDnd } from './dnd';

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

jest.mock( '@/reorder/column-reorder/responsibilities/dnd-interaction', () => ( {
	columnDndInteraction: {
		start: jest.fn(),
		updateDestination: jest.fn(),
		complete: jest.fn(),
		cancel: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/column-reorder/integration/destination-resolution', () => ( {
	createColumnDestinationResolver: jest.fn(),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/target-resolution', () => ( {
	resolveColumnReorderTarget: jest.fn(),
} ) );

let mockOnStartRejection: ( ( request: unknown ) => void ) | null = null;

jest.mock( '@/reorder/column-reorder/responsibilities/input', () => ( {
	ColumnInput: ( {
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

jest.mock( '@/reorder/column-reorder/responsibilities/presentation/column-presentation', () => ( {
	ColumnPresentation: ( props: {
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
		return <div data-testid="column-presentation">{ noticeCount }</div>;
	},
} ) );

describe( 'Column DnD presentation ownership', () => {
	beforeEach( () => {
		mockOnStartRejection = null;
	} );

	/**
	 * 複数TableのDnD境界が存在しても、現在の操作対象だけがPresentationを所有することを確認する。
	 *
	 * 事前条件:
	 * - Table AとTable BのColumn DnD境界が同時に存在する。
	 * - Table Aだけが現在の操作対象である。
	 *
	 * 操作:
	 * - 両TableのDnD境界を描画する。
	 *
	 * 期待結果:
	 * - 両Tableの既存Block subtreeは描画される。
	 * - Column Reorder PresentationはTable Aに対応する1つだけが存在する。
	 */
	it( 'when multiple column DnD boundaries are mounted, should connect presentation only for the current table', () => {
		render(
			<>
				<ColumnDnd presentationEnabled tableIdentity="table-a">
					{ () => <div data-testid="table-a" /> }
				</ColumnDnd>
				<ColumnDnd presentationEnabled={ false } tableIdentity="table-b">
					{ () => <div data-testid="table-b" /> }
				</ColumnDnd>
			</>
		);

		expect( screen.queryByTestId( 'table-a' ) ).not.toBeNull();
		expect( screen.queryByTestId( 'table-b' ) ).not.toBeNull();
		expect( screen.getAllByTestId( 'column-presentation' ) ).toHaveLength( 1 );
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
			<ColumnDnd presentationEnabled tableIdentity="table-a">
				{ childrenRender }
			</ColumnDnd>
		);
		const initialRenderCount = childrenRender.mock.calls.length;

		act( () => {
			mockOnStartRejection?.( {
				blockingMergedRange: {
					section: 'body',
					rowStart: 0,
					rowEnd: 0,
					columnStart: 0,
					columnEnd: 1,
				},
				clientX: 10,
				clientY: 20,
			} );
		} );

		expect( screen.getByTestId( 'column-presentation' ).textContent ).toBe( '1' );
		expect( childrenRender ).toHaveBeenCalledTimes( initialRenderCount );
	} );
} );
