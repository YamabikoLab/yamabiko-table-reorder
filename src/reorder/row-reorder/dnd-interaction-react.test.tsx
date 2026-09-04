/**
 * 行専用DnD InteractionのReact購読境界が、共有状態をReact描画へ正しく反映することを確認する。
 *
 * StoreやSession内部を直接参照せず、React Testing Libraryを通して公開Hookを購読し、
 * Lifecycle状態、active状態、現在の移動先、およびmount / unmountをまたぐ共有状態の継続を検証する。
 */

import { act, renderHook } from '@testing-library/react';

import { rowDndInteraction } from './dnd-interaction';
import {
	useRowDndActive,
	useRowDndDestinationBoundaryIndex,
	useRowDndPhase,
} from './dnd-interaction-react';
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

/** React利用者へ公開される行DnD共有状態を1つの購読結果として確認する。 */
const useRowDndPublicState = () => ( {
	phase: useRowDndPhase(),
	active: useRowDndActive(),
	destinationBoundaryIndex: useRowDndDestinationBoundaryIndex(),
} );

/** 開始可能な行DnD Sessionを成立させる。 */
const startSession = (): void => {
	const initialConstraints = rowDndInteraction.prepareStart( source );

	if ( initialConstraints === null ) {
		throw new Error( 'Test precondition failed: expected initial constraints.' );
	}

	rowDndInteraction.start( source, initialConstraints );
};

describe( 'Row DnD React state interface', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReset();
		getConstraintsMock.mockReturnValue( availableConstraints );
		rowDndInteraction.cancel();
	} );

	afterEach( () => {
		rowDndInteraction.cancel();
	} );

	/**
	 * 概要:
	 * - 行DnD Sessionが存在しないとき、React利用者へidle状態と移動先なしを公開することを確認する。
	 *
	 * 事前条件:
	 * - 行DnD Interactionはidleである。
	 *
	 * 操作:
	 * - React向け公開Hookを購読する。
	 *
	 * 期待結果:
	 * - phaseはidle、activeはfalse、現在の移動先境界はnullである。
	 */
	it( 'when row DnD is idle, should expose the idle public state', () => {
		const { result } = renderHook( useRowDndPublicState );

		expect( result.current ).toEqual( {
			phase: 'idle',
			active: false,
			destinationBoundaryIndex: null,
		} );
	} );

	/**
	 * 概要:
	 * - 行DnD Session開始時に、React利用者へactiveなLifecycle状態を反映することを確認する。
	 *
	 * 事前条件:
	 * - 行DnD Interactionはidleで、開始可能な行制約を取得できる。
	 *
	 * 操作:
	 * - React向け公開Hookを購読した状態でSessionを開始する。
	 *
	 * 期待結果:
	 * - phaseはactive、activeはtrueへ更新され、移動先はまだnullである。
	 */
	it( 'when row DnD starts, should expose the active lifecycle state', () => {
		const { result } = renderHook( useRowDndPublicState );

		act( () => {
			startSession();
		} );

		expect( result.current ).toEqual( {
			phase: 'active',
			active: true,
			destinationBoundaryIndex: null,
		} );
	} );

	/**
	 * 概要:
	 * - DnD中の有効移動先が変化したとき、Reorder Presentation向けの現在移動先だけをReactへ反映することを確認する。
	 *
	 * 事前条件:
	 * - activeな行DnD Sessionが成立している。
	 *
	 * 操作:
	 * - 有効な境界4を設定した後、現在の移動先候補なしとしてnullへ更新する。
	 *
	 * 期待結果:
	 * - React購読値は4へ更新された後nullへ戻り、Lifecycleはactiveのまま維持される。
	 */
	it( 'when the current destination changes, should expose only the latest destination', () => {
		const { result } = renderHook( useRowDndPublicState );

		act( () => {
			startSession();
			rowDndInteraction.updateDestination( 4 );
		} );

		expect( result.current.destinationBoundaryIndex ).toBe( 4 );
		expect( result.current.phase ).toBe( 'active' );

		act( () => {
			rowDndInteraction.updateDestination( null );
		} );

		expect( result.current.destinationBoundaryIndex ).toBeNull();
		expect( result.current.phase ).toBe( 'active' );
	} );

	/**
	 * 概要:
	 * - 行DnD Sessionをcompleteすると、React利用者へidle状態へ戻ったことを反映することを確認する。
	 *
	 * 事前条件:
	 * - activeな行DnD Sessionが成立している。
	 * - 有効移動先は設定されていないため、Table更新を伴わず正常終了できる。
	 *
	 * 操作:
	 * - complete()でSessionを終了する。
	 *
	 * 期待結果:
	 * - phaseはidle、activeはfalse、移動先境界はnullへ戻る。
	 */
	it( 'when row DnD completes, should expose the idle public state', () => {
		const { result } = renderHook( useRowDndPublicState );

		act( () => {
			startSession();
		} );

		act( () => {
			rowDndInteraction.complete();
		} );

		expect( result.current ).toEqual( {
			phase: 'idle',
			active: false,
			destinationBoundaryIndex: null,
		} );
	} );

	/**
	 * 概要:
	 * - 行DnD Sessionをcancelすると、React利用者へidle状態へ戻ったことを反映することを確認する。
	 *
	 * 事前条件:
	 * - activeな行DnD Sessionが成立している。
	 *
	 * 操作:
	 * - cancel()でSessionを終了する。
	 *
	 * 期待結果:
	 * - phaseはidle、activeはfalse、移動先境界はnullへ戻る。
	 */
	it( 'when row DnD is cancelled, should expose the idle public state', () => {
		const { result } = renderHook( useRowDndPublicState );

		act( () => {
			startSession();
			rowDndInteraction.updateDestination( 4 );
		} );

		act( () => {
			rowDndInteraction.cancel();
		} );

		expect( result.current ).toEqual( {
			phase: 'idle',
			active: false,
			destinationBoundaryIndex: null,
		} );
	} );

	/**
	 * 概要:
	 * - React利用者が一度unmountしても、activeな行DnD SessionはReact Lifecycleから独立して維持されることを確認する。
	 *
	 * 事前条件:
	 * - React向け公開Hookを購読中にactive Sessionが成立し、移動先境界4が設定されている。
	 *
	 * 操作:
	 * - Hookをunmountした後、同じ公開Hookを再度mountする。
	 *
	 * 期待結果:
	 * - 再mount時にもphaseはactive、activeはtrue、現在の移動先境界は4として取得できる。
	 */
	it( 'when the React consumer remounts during an active session, should expose the existing shared state', () => {
		const firstRender = renderHook( useRowDndPublicState );

		act( () => {
			startSession();
			rowDndInteraction.updateDestination( 4 );
		} );

		firstRender.unmount();
		const remounted = renderHook( useRowDndPublicState );

		expect( remounted.result.current ).toEqual( {
			phase: 'active',
			active: true,
			destinationBoundaryIndex: 4,
		} );
	} );
} );
