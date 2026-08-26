# YTR glossary

この用語集は、formal YTR v1の`src/`内で実際に使われている名称とコメントを根拠として、同じ概念を同じ用語で表現するための基準を整理する。

コード上の識別子は現状を記録し、表記揺れがある場合は備考に推奨用語を示す。`direction`や`axis`は現在の`src/`には登場しないため、現時点では意味を割り当てない。

| # | 用語（英語） | 用語（日本語） | コード上の表記 | 概要 | 備考 |
| ---: | --- | --- | --- | --- | --- |
| 1 | Yamabiko Table Reorder | Yamabiko Table Reorder | `PLUGIN_NAME` | プラグイン名。 | `YTR`は文書上の略称として使用する。 |
| 2 | Reorder | 並び替え | `reorder` | 行または列の順序を変更する操作や処理の総称。 | 概念名としては「移動」より「並び替え」を優先する。 |
| 3 | Reorder Mode | 並び替えモード | `ReorderMode`, `mode`, `createReorderMode()`, `enterReorderMode()`, `exitReorderMode()` | Table編集と行・列の並び替えを排他的に表す現在のモード。 | `edit`、`row`、`column`を持つ状態概念。`Reorder Kind`とは区別する。 |
| 4 | Edit Mode | 通常編集モード | `edit`, `edit mode` | 通常のTable編集を行うReorder Mode。DnDは開始できない。 | ソース内の「通常編集状態」はこの概念を指す。用語としては「通常編集モード」を推奨する。 |
| 5 | Reorder Kind | 並び替え種別 | `ReorderKind`, `kind`, `getReorderKind()` | 並び替える対象が行か列かを表す種別。 | 値は`row`または`column`。`edit`を含まないため、`Reorder Mode`と同義にしない。 |
| 6 | Row Reorder | 行並び替え | `row` | 行を並び替えるReorder ModeまたはReorder Kind。 | 文脈に応じてmodeかkindかを明確にする。 |
| 7 | Column Reorder | 列並び替え | `column` | 列を並び替えるReorder ModeまたはReorder Kind。 | 文脈に応じてmodeかkindかを明確にする。 |
| 8 | Reorder Session | 並び替えセッション | `ReorderSession`, `session`, `startReorderSession()`, `updateReorderDestination()`, `completeReorderSession()`, `cancelReorderSession()` | 進行中の1回の並び替え操作を表す状態。並び替え種別、並び替え対象、現在の有効な移動先を保持する。 | 「共通Reorder Session」や単独の「Session」も同じ概念を指す。概念名は`Reorder Session`に統一する。 |
| 9 | Reorder Target | 並び替え対象 | `ReorderTarget`, `target` | 1回の並び替えで移動する行または列。 | ソース内では「移動対象」と「並び替え対象」が使われている。`Drop Target`との混同を避けるため、日本語は「並び替え対象」を推奨する。 |
| 10 | Reorder Destination | 移動先 | `ReorderDestination`, `destination`, `updateReorderDestination()` | Drop Target Resolutionによって有効と判定された現在の移動先。 | `Reorder Target`と区別するため、移動先を`target`とは呼ばず`destination`を使用する。 |
| 11 | Committed Reorder | 確定済み並び替え | `CommittedReorder`, `committed reorder` | Reorder Sessionの完了時に生成され、Data Updateへ渡せる確定済みの並び替え。 | ソース内の「確定結果」もこの概念を指す。概念名は「確定済み並び替え」を推奨する。 |
| 12 | Logical Index | 論理インデックス | `index` | Table内で並び替え対象または移動先の位置を表す論理的なindex。 | DOMやブロック固有表現そのものではない。 |
| 13 | DnD | ドラッグ＆ドロップ | `DnD` | ドラッグ操作によって行または列を並び替える入力方式。 | コードや技術文書では`DnD`を使用する。 |
| 14 | Drop Target Resolution | ドロップ先判定 | `Drop Target Resolution` | ドロップ候補から有効なReorder Destinationを判定する責務。 | 現在はコメント内の責務名として登場する。ここでの`Target`は`Reorder Target`とは別概念。 |
| 15 | Data Update | データ更新 | `Data Update` | Committed Reorderを受け取り、並び替え結果をデータへ反映する責務。 | 現在はコメント内の責務名として登場し、`src/`には実装されていない。 |
