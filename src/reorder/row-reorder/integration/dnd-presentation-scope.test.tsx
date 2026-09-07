/**
 * 複数の対応Tableが同時に存在する場合も、Reorder Presentationを現在の操作対象だけへ接続することを確認する。
 *
 * TableごとのDnD境界はReact identity維持のため常時存在する一方、共有通知や共有状態を購読するPresentationは
 * 現在選択中のTableだけが所有し、1回の行DnD通知へ複数の表示が反応しない構造を維持する。
 */

import { render, screen } from '@testing-library/react';
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
	rowReorderTargetResolution: {
		resolve: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/input', () => ( {
	RowInput: ( {
		children,
	}: {
		children: ( handler: React.PointerEventHandler< Element > ) => ReactNode;
	} ) => children( () => undefined ),
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/presentation/row-presentation', () => ( {
	RowPresentation: () => <div data-testid="row-presentation" />,
} ) );

describe( 'Row DnD presentation ownership', () => {
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
				<RowDnd enabled={ false } presentationEnabled tableIdentity="table-a">
					{ () => <div data-testid="table-a" /> }
				</RowDnd>
				<RowDnd enabled={ false } presentationEnabled={ false } tableIdentity="table-b">
					{ () => <div data-testid="table-b" /> }
				</RowDnd>
			</>
		);

		expect( screen.queryByTestId( 'table-a' ) ).not.toBeNull();
		expect( screen.queryByTestId( 'table-b' ) ).not.toBeNull();
		expect( screen.getAllByTestId( 'row-presentation' ) ).toHaveLength( 1 );
	} );
} );
