/**
 * Column ReorderのPresentation接続境界を検証する。
 *
 * 各表示責務の内部挙動は個別テストへ委ね、Column Presentationが終了通知を含む表示責務を接続することだけを確認する。
 */

import { render, screen } from '@testing-library/react';

import { ColumnPresentation } from './column-presentation';

jest.mock( './insertion-line', () => ( {
	ColumnInsertionLine: () => <div>insertion line</div>,
} ) );

jest.mock( './moving-column', () => ( {
	ColumnMovingDisplay: () => <div>moving column</div>,
} ) );

jest.mock( './start-rejection-notice', () => {
	const { forwardRef } = jest.requireActual( '@wordpress/element' );

	return {
		ColumnStartRejectionNotice: forwardRef( function MockColumnStartRejectionNotice() {
			return <div>start rejection notice</div>;
		} ),
	};
} );

jest.mock( './termination-notice', () => ( {
	ColumnTerminationNotice: () => <div>termination notice</div>,
} ) );

describe( 'ColumnPresentation', () => {
	/**
	 * 列DnDの終了通知PresentationがColumn Presentation境界へ接続されることを確認する。
	 *
	 * 期待結果:
	 * - 終了通知Presentationが描画される。
	 */
	it( 'should connect the termination notice presentation', () => {
		render( <ColumnPresentation startRejectionNoticeRef={ null } /> );

		expect( screen.queryByText( 'termination notice' ) ).not.toBeNull();
	} );
} );
