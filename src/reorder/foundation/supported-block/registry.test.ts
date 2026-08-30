/**
 * Supported BlockのBlock名と固有Integrationの対応付けがregistryに集約されていることを確認する。
 */

import { coreTableIntegration } from '@/reorder/foundation/supported-block/core-table/integration';
import { flexibleTableBlockIntegration } from '@/reorder/foundation/supported-block/flexible-table-block/integration';

import { SUPPORTED_BLOCK_INTEGRATIONS } from './registry';

describe( 'Supported Block Integration registry', () => {
	/**
	 * 対応するSupported Block名から各Block固有Integrationを取得できることを確認する。
	 *
	 * 事前条件:
	 * - Core TableとFlexible Table Blockが対応対象として登録されている。
	 *
	 * 操作:
	 * - 各Block名でregistryを参照する。
	 *
	 * 期待結果:
	 * - 各Block名が対応する固有Integrationへ割り当てられている。
	 */
	it( 'when a supported Block name is looked up, should return its Block-specific integration', () => {
		expect( SUPPORTED_BLOCK_INTEGRATIONS[ 'core/table' ] ).toBe( coreTableIntegration );
		expect( SUPPORTED_BLOCK_INTEGRATIONS[ 'flexible-table-block/table' ] ).toBe(
			flexibleTableBlockIntegration
		);
	} );

	/**
	 * 非対応Block名に暗黙のIntegrationを割り当てないことを確認する。
	 *
	 * 事前条件:
	 * - `core/paragraph`はSupported Blockとして登録されていない。
	 *
	 * 操作:
	 * - 非対応Block名でregistryを参照する。
	 *
	 * 期待結果:
	 * - Integrationは存在せずundefinedになる。
	 */
	it( 'when an unsupported Block name is looked up, should not return an integration', () => {
		expect( SUPPORTED_BLOCK_INTEGRATIONS[ 'core/paragraph' ] ).toBeUndefined();
	} );
} );
