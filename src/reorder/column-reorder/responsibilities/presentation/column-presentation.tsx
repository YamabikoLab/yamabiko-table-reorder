/**
 * Column ReorderのDnD中に必要な利用者向け表示をまとめて接続する。
 *
 * 各PresentationはDnD Interactionの意味状態と表示に必要なDnD Engineの物理情報をそれぞれの境界から利用し、
 * 表示Lifecycleと表示状態を自身で所有する。
 */

import { ColumnMovingDisplay } from './moving-column';

/**
 * 列DnDに必要なPresentationを同じDnD Engine境界へ接続する。
 *
 * @return 列DnDの一時表示群。
 */
export const ColumnPresentation = () => <ColumnMovingDisplay />;
