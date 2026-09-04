/**
 * 行専用DnD InteractionのReact購読境界が、行DnD SessionのLifecycleだけを描画へ反映することを確認する。
 *
 * StoreやSession内部を直接参照せず、React向けのuseRowDndActive()を購読し、
 * idle、start、complete、cancelによるactive状態の変化を検証する。
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { rowDndInteraction } from './dnd-interaction';
import { useRowDndActive } from './dnd-interaction-react';
import { rowTableIntegration } from './table-integration';

jest.mock( './table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		applyRowMove: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.MockedFunction<
	typeof rowTableIntegration.getConstraints
>;

const availableConstraints = {
	rowCount: 5,
	blockedBoundaries: [] as readonly number[],
};

const source = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

type ReactActGlobal = typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/** Auto Scroll向け公開IFの現在値だけをDOMへ反映するテスト用購読境界。 */
const RowDndActiveProbe = () => {
	const active = useRowDndActive();
	return <div data-active={ active ? 'true' : 'false' } />;
};

describe( 'Row DnD React active state interface', () => {
	const reactActGlobal = globalThis as ReactActGlobal;
	const previousReactActEnvironment = reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
	let container: HTMLDivElement;
	let root: Root;

	beforeAll( () => {
		reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	afterAll( () => {
		reactActGlobal.IS_REACT_ACT_ENVIRONMENT = previousReactActEnvironment;
	} );

	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReset();
		getConstraintsMock.mockReturnValue( availableConstraints );
		rowDndInteraction.cancel();
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );

		act( () => {
			root.render( <RowDndActiveProbe /> );
		} );
	} );

	afterEach( () => {
		act( () => {
			rowDndInteraction.cancel();
			root.unmount();
		} );
		container.remove();
	} );

	const getActiveValue = (): string | null =>
		container.querySelector( '[data-active]' )?.getAttribute( 'data-active' ) ?? null;

	const startSession = (): void => {
		const initialConstraints = rowDndInteraction.prepareStart( source );

		if ( initialConstraints === null ) {
			throw new Error( 'Test precondition failed: expected initial constraints.' );
		}

		rowDndInteraction.start( source, initialConstraints );
	};

	/**
	 * 概要:
	 * - 行DnD Sessionが存在しないとき、Auto Scroll向けactive状態が無効であることを確認する。
	 *
	 * 事前条件:
	 * - 行DnD Interactionはidleである。
	 *
	 * 操作:
	 * - useRowDndActive()を購読する。
	 *
	 * 期待結果:
	 * - falseが返る。
	 */
	it( 'when row DnD is idle, should expose inactive state', () => {
		expect( getActiveValue() ).toBe( 'false' );
	} );

	/**
	 * 概要:
	 * - 行DnD Session開始時に、Auto Scroll向けactive状態が有効になることを確認する。
	 *
	 * 事前条件:
	 * - 行DnD Interactionはidleで、開始可能な行制約を取得できる。
	 *
	 * 操作:
	 * - prepareStart()後にstart()でSessionを開始する。
	 *
	 * 期待結果:
	 * - useRowDndActive()の購読値がtrueへ更新される。
	 */
	it( 'when row DnD starts, should expose active state', () => {
		act( () => {
			startSession();
		} );

		expect( getActiveValue() ).toBe( 'true' );
	} );

	/**
	 * 概要:
	 * - 行DnD Sessionをcompleteすると、Auto Scroll向けactive状態が終了することを確認する。
	 *
	 * 事前条件:
	 * - activeな行DnD Sessionが成立している。
	 * - 有効移動先は設定されていないため、Table更新を伴わず正常終了できる。
	 *
	 * 操作:
	 * - complete()でSessionを終了する。
	 *
	 * 期待結果:
	 * - useRowDndActive()の購読値がfalseへ戻る。
	 */
	it( 'when row DnD completes, should expose inactive state', () => {
		act( () => {
			startSession();
		} );
		expect( getActiveValue() ).toBe( 'true' );

		act( () => {
			rowDndInteraction.complete();
		} );

		expect( getActiveValue() ).toBe( 'false' );
	} );

	/**
	 * 概要:
	 * - 行DnD Sessionをcancelすると、Auto Scroll向けactive状態が終了することを確認する。
	 *
	 * 事前条件:
	 * - activeな行DnD Sessionが成立している。
	 *
	 * 操作:
	 * - cancel()でSessionを終了する。
	 *
	 * 期待結果:
	 * - useRowDndActive()の購読値がfalseへ戻る。
	 */
	it( 'when row DnD is cancelled, should expose inactive state', () => {
		act( () => {
			startSession();
		} );
		expect( getActiveValue() ).toBe( 'true' );

		act( () => {
			rowDndInteraction.cancel();
		} );

		expect( getActiveValue() ).toBe( 'false' );
	} );
} );
