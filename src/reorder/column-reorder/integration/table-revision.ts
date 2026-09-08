/**
 * Column Reorderの一時的な解決基準を、対応TableのWordPress Blockデータ更新Lifecycleへ接続する。
 *
 * Table属性の内容は解釈せず、Block属性参照の変更だけをTableデータ更新として通知する。
 * これによりUndo、Redo、列並び替え、および同一Tableへの別経路の属性更新を、ホバーごとのTable構造再解析なしでResolver snapshotの無効化契機にできる。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import { select, subscribe } from '@wordpress/data';

/** Tableデータ更新時に現在の一時的な解決基準を破棄する利用側へ通知する処理。 */
type ColumnTableRevisionListener = () => void;

/**
 * 指定Tableの現在Block属性参照を、Tableデータ更新判定だけに利用する不透明なrevisionとして取得する。
 *
 * 属性内容や列制約は解釈せず、対象Blockが存在しない場合はnullをrevisionとして扱う。
 *
 * @param tableIdentity 更新を監視するTable個体の識別値。
 * @return 現在Block属性の参照。対象Blockが存在しない場合はnull。
 */
const getColumnTableRevision = ( tableIdentity: string ): object | null => {
	const block = select( blockEditorStore ).getBlock( tableIdentity );
	if ( block === null || block === undefined ) {
		return null;
	}
	return block.attributes;
};

/**
 * 指定TableのBlock属性参照が変化したときだけ、Tableデータ更新として利用側へ通知する。
 *
 * WordPress Data全体の更新通知を受けても、対象Tableの属性参照が同じ間は通知しない。
 * 監視は利用側が必要とするLifecycleだけで開始し、返した解除処理により必ず終了できる。
 *
 * @param tableIdentity 更新を監視するTable個体の識別値。
 * @param listener      Tableデータ更新時に一時的な解決基準を破棄する処理。
 * @return Tableデータ更新監視を終了する処理。
 */
export const subscribeColumnTableRevision = (
	tableIdentity: string,
	listener: ColumnTableRevisionListener
): ( () => void ) => {
	let currentRevision = getColumnTableRevision( tableIdentity );
	const unsubscribe = subscribe( () => {
		const nextRevision = getColumnTableRevision( tableIdentity );
		/* 対象Tableの属性参照が変わらないWordPress Data更新では、Column Reorderの解決基準を無効化しない。 */
		if ( nextRevision === currentRevision ) {
			return;
		}
		currentRevision = nextRevision;
		listener();
	} );
	return unsubscribe;
};
