# YTR glossary

この用語集は、formal YTR v1の`src/`で使用する用語の基準を定める。ソースコードの識別子、JSDoc、コメントでは、同じ概念をこの用語集で定義した同じ用語で表現する。

現在の定義は`src/`内で実際に使われている名称とコメントを根拠として整理している。既存の用語で表現できない新しい概念を導入する場合は、その変更とあわせて用語集を更新する。`direction`や`axis`は現在の`src/`には登場しないため、現時点では定義しない。

| # | 用語（英語） | 用語（日本語） | コード上の表記 | 概要 | 備考 |
| ---: | --- | --- | --- | --- | --- |
| 1 | Yamabiko Table Reorder | Yamabiko Table Reorder | `PLUGIN_NAME` | プラグイン名。 | `YTR`は文書上の略称として使用する。 |
| 2 | Reorder | 並び替え | `reorder` | 行または列の順序を変更する操作や処理の総称。 | 概念名としては「移動」より「並び替え」を優先する。 |
| 3 | Reorder Mode | 並び替えモード | `ReorderMode`, `mode`, `createReorderMode()`, `getState()`, `enter()`, `exit()` | Table編集と行・列の並び替えを排他的に表す現在のモード。 | `edit`、`row`、`column`を持つ状態概念。`Reorder Kind`とは区別する。 |
| 4 | Edit Mode | 通常編集モード | `edit`, `edit mode` | 通常のTable編集を行うReorder Mode。DnDは開始できない。 | ソース内の「通常編集状態」はこの概念を指す。用語としては「通常編集モード」を推奨する。 |
| 5 | Reorder Kind | 並び替え種別 | `ReorderKind`, `kind`, `getReorderKind()` | 並び替える対象が行か列かを表す種別。 | 値は`row`または`column`。`edit`を含まないため、`Reorder Mode`と同義にしない。`ConcreteReorderKind`はこの種別が行または列の一方向へ確定していることを型で表す補助表現であり、独立した概念ではない。 |
| 6 | Row Reorder | 行並び替え | `row` | 行を並び替えるReorder ModeまたはReorder Kind。 | 文脈に応じてmodeかkindかを明確にする。 |
| 7 | Column Reorder | 列並び替え | `column` | 列を並び替えるReorder ModeまたはReorder Kind。 | 文脈に応じてmodeかkindかを明確にする。 |
| 8 | Reorder Session | 並び替えセッション | `ReorderSession`, `session`, `startReorderSession()`, `updateReorderDestination()`, `completeReorderSession()`, `cancelReorderSession()` | 進行中の1回の並び替え操作を表す状態。並び替え種別、並び替え対象、現在の有効な移動先を保持する。 | 「共通Reorder Session」や単独の「Session」も同じ概念を指す。概念名は`Reorder Session`に統一する。`ConcreteReorderSession`は一方向へ確定済みの同じReorder Sessionを型で表す補助表現であり、独立した状態やLifecycleを持たない。 |
| 9 | Reorder Target | 並び替え対象 | `ReorderTarget`, `target` | 1回の並び替えで移動する行または列。 | ソース内では「移動対象」と「並び替え対象」が使われている。`Drop Target`との混同を避けるため、日本語は「並び替え対象」を推奨する。`ConcreteReorderTarget`は一方向へ確定済みの同じReorder Targetを型で表す補助表現であり、独立した概念ではない。 |
| 10 | Reorder Destination | 移動先 | `ReorderDestination`, `destination`, `updateReorderDestination()` | Drop Target Resolutionによって有効と判定された現在の移動先。 | `Reorder Target`と区別するため、移動先を`target`とは呼ばず`destination`を使用する。 |
| 11 | Committed Reorder | 確定済み並び替え | `CommittedReorder`, `committed reorder` | Reorder Sessionの完了時に生成され、Data Updateへ渡せる確定済みの並び替え。 | ソース内の「確定結果」もこの概念を指す。概念名は「確定済み並び替え」を推奨する。 |
| 12 | Logical Index | 論理インデックス | `index` | Table内で並び替え対象または移動先の位置を表す論理的なindex。 | DOMやブロック固有表現そのものではない。 |
| 13 | DnD | ドラッグ＆ドロップ | `DnD` | ドラッグ操作によって行または列を並び替える入力方式。 | コードや技術文書では`DnD`を使用する。 |
| 14 | Drop Target Resolution | ドロップ先判定 | `Drop Target Resolution` | ドロップ候補から有効なReorder Destinationを判定する責務。 | 現在はコメント内の責務名として登場する。ここでの`Target`は`Reorder Target`とは別概念。 |
| 15 | Data Update | データ更新 | `Data Update` | Committed Reorderを受け取り、並び替え結果をデータへ反映する責務。 | 現在はコメント内の責務名として登場し、`src/`には実装されていない。 |
| 16 | Editor DOM Context | エディターDOM環境 | `EditorDomContext`, `resolveEditorDomContext()` | 現在のエディター画面内の基準要素から、その要素と同じ表示環境の`document`と`window`を解決し、DOM / Web APIを利用する責務へ提供する概念。 | iframe / non-iframeの違いを利用側へ持ち込まず、解決結果を保持しない。 |
| 17 | Table Integration | Table統合 | `TableIntegration`, `createTableIntegration()` | 外部Table plugin固有のTable構造取得およびデータ更新方法をReorder coreから隠蔽する境界。 | 要求時に対象Tableの現在データを利用し、Tableデータや共通Table structureを保持しない。 |
| 18 | Table Structure | Table構造 | `TableStructure` | Reorder coreが利用する共通Table structure。通常セルは持たず、結合セルの位置と範囲だけを保持する。 | Table IntegrationがReorder coreへ公開するContractで、`mergedCells`に`TableMergedCellStructure`を保持する。 |
| 19 | Table Merged Cell Structure | Table結合セル構造 | `TableMergedCellStructure` | 共通Table structure上で1つの結合セルが属するsection、開始位置、縦横の占有範囲を表す。 | Table IntegrationがReorder coreへ公開するContractで、`rowStart` / `columnStart`は0-basedのlogical Table grid上の位置を表す。 |
| 20 | Reorder Target Resolution | 並び替え対象解決 | `ReorderTargetResolution`, `createReorderTargetResolution()` | DnD開始試行時にReorder Targetの成立可否を判定し、そのDnDで利用するReorder Constraintsを導出する責務。 | 行ではbody sectionの縦結合、列ではTable全体の横結合を対象方向の制約として扱う。 |
| 21 | Reorder Constraints | 並び替え制約 | `ReorderConstraints`, `blockedBoundaries` | 1回のDnD中に移動先判定で利用する構造上の制約。 | `blockedBoundaries`は対象方向の結合セル内部のinsertion boundary indexを重複なし・昇順で保持する。 |
