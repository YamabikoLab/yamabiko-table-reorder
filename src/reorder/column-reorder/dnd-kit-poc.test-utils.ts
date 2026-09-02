/**
 * 実ブラウザ専用の列dnd-kit PoCをJestのWordPress統合テストから切り離すための代替境界を提供する。
 *
 * jsdomではブラウザのDnD実行環境を再現せず、既存のReorder Mode統合テストが本来の責務だけを検証できるようにする。
 */

/**
 * Jestでは列dnd-kit PoCを開始せず、WordPress統合テストからブラウザ専用処理を分離する。
 *
 * @return PoCを開始しないため常にnull。
 */
export const connectDndKitColumnPoc = () => null;
