/**
 * 複数の対応Tableが同時に存在する場合も、Column Reorder Presentationを現在の操作対象だけへ接続することを確認する。
 *
 * TableごとのDnD境界はReact identity維持のため常時存在する一方、DnD状態を購読するPresentationは
 * 現在選択中かつ列並び替えが有効なTableだけが所有し、1回の列DnD通知へ複数の表示が反応しない構造を維持する。
 */

import { render, screen } from '@testing-library/react';
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
	columnReorderTargetResolution: {
		resolve: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/input', () => ( {
	ColumnInput: ( {
		children,
	}: {
		children: ( handler: React.PointerEventHandler< Element > ) => ReactNode;
	} ) => children( () => undefined ),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/presentation/column-presentation', () => ( {
	ColumnPresentation: () => <div data-testid="column-presentation" />,
} ) );

describe( 'Column DnD presentation ownership', () => {
	/**
	 * 複数TableのDnD境界が存在しても、現在の列並び替え対象だけがPresentationを所有することを確認する。
	 *
	 * 事前条件:
	 * - Table AとTable BのColumn DnD境界が同時に存在する。
	 * - Table Aだけが列並び替え有効かつ現在の操作対象である。
	 *
	 * 操作:
	 * - 両TableのDnD境界を描画する。
	 *
	 * 期待結果:
	 * - 両Tableの既存Block subtreeは描画される。
	 * - Column Reorder PresentationはTable Aに対応する1つだけが存在する。
	 */
	it( 'when multiple column DnD boundaries are mounted, should connect presentation only for the active current table', () => {
		render(
			<>
				<ColumnDnd enabled presentationEnabled tableIdentity="table-a">
					{ () => <div data-testid="table-a" /> }
				</ColumnDnd>
				<ColumnDnd enabled presentationEnabled={ false } tableIdentity="table-b">
					{ () => <div data-testid="table-b" /> }
				</ColumnDnd>
			</>
		);

		expect( screen.queryByTestId( 'table-a' ) ).not.toBeNull();
		expect( screen.queryByTestId( 'table-b' ) ).not.toBeNull();
		expect( screen.getAllByTestId( 'column-presentation' ) ).toHaveLength( 1 );
	} );
} );
