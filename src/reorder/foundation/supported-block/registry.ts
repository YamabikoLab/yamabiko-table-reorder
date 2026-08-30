/**
 * Supported BlockのBlock名とTable Integration適応実装の対応付けを一元管理する。
 *
 * Table Integrationはこの対応表だけを参照して要求時点のBlockに適したIntegrationへ委譲する。
 * 各Supported Block固有実装は互いを参照せず、対応Blockの追加・削除による変更をこの対応表へ閉じ込める。
 */

import type { SupportedBlockIntegration } from '@/reorder/foundation/table-integration';
import { coreTableIntegration } from '@/reorder/foundation/supported-block/core-table/integration';
import { flexibleTableBlockIntegration } from '@/reorder/foundation/supported-block/flexible-table-block/integration';

/**
 * Supported BlockのBlock名と、その固有属性を共通Table区画へ適応するIntegrationの対応表。
 *
 * 対応していないBlock名にはIntegrationを割り当てず、Table Integration境界で非対応Tableとして扱う。
 */
export const SUPPORTED_BLOCK_INTEGRATIONS: Readonly<
	Partial< Record< string, SupportedBlockIntegration > >
> = {
	'core/table': coreTableIntegration,
	'flexible-table-block/table': flexibleTableBlockIntegration,
};
