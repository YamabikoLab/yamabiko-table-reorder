# Issue #736: DnD Interaction / Session Lifecycle詳細実装Planの作成

## Summary

- docs/plans/row-reorder-dnd-interaction-plan.mdを新設し、#690および#731〜#733を現在の実装へ落とし込む作業手順を記載する。
- docs/plans/row-reorder-v1-plan.mdから廃止済みのReorder Target Resolution、Drop Target Resolution、Data Updateの独立Phaseを除き、Table IntegrationからDnD Interactionへ直接進む順序と詳細Planへの参照に更
  新する。

- 今回変更するのはPlan文書のみとし、Architecture、TypeScript、テスト、依存関係、生成DSLは変更しない。

## Plan文書の整合

- 親Planでは旧Phase 3〜5、それらの事前決定とIssue breakdownを削除する。既存Issue番号との対応を維持するためDnD InteractionはPhase 6の名称を維持し、Phase 2完了後に開始するものとする。
- Phase 6のOutcome、Tasks、Validation、Decide before implementationを詳細Planに合わせ、Reorder PresentationとAuto Scrollの本体は後続Phaseのままとする。
- 詳細PlanのReferencesにはRequirements、Design、Architecture、親Plan、Issue #690、#731〜#733、#736、適用されるAGENTS.md、テストガイドを記載する。
- Requirements、Design、Architectureの振る舞い・責務・理由は複製せず、対象ファイル、型、公開境界、接続順、テスト、完了条件へ具体化する。

## 詳細Planに記載する実装Step

### Step 0: Architecture前提の先行整合

- Source実装とは別の先行Issueでdocs/architecture/row-reorder-v1-architecture.mdを更新し、次を確定する。

  - DnD Interactionが、tableIdentityから現在のTable基準要素とEditor DOM Contextを取得する依存関係。
  - Editor lifecycleに追従するTable基準要素の登録・解除境界。DOM参照はSessionへ保持しない。
  - active Session終了をInput Interactionへ通知する最小境界。
  - DnD終了後のcanContinue結果をReorder Modeへ渡す境界。
  - PresentationとAuto ScrollのreportFailure(error)を、呼び出し元を識別して一度だけ記録するfailure ingress。

- Architecture更新時は対応DSLを再生成・検証する。これが承認されるまでSource実装を開始しない。

### Step 1: 現在のTable DOMとReorder Mode終了境界

- 対象:

  - src/reorder/editor-dom-context.tsと隣接テスト
  - src/reorder/wordpress/components/block-list-block.tsxと既存React統合テスト
  - src/reorder/reorder-mode.tsと隣接テスト

- BlockListBlockの既存wrapper refを壊さず、tableIdentityに対応する現在の基準要素をEditor DOM Contextへ登録する。再mount時は新しい登録を正本とし、古いcleanupが新しい登録を解除しないよう登録単位を照合す
  る。

- Editor DOM Contextは、現在登録され接続中の基準要素、そのownerDocument、defaultViewだけを返す。過去の要素、global document、別iframeへのfallbackは行わない。
- Row Reorder向けReorder Mode境界へfinishDnd(tableIdentity, canContinue)を追加する。falseかつ同じTableのrow modeだけをeditへ戻し、それ以外のモードには影響させない。
- 完了条件:
  - iframe/non-iframe、再mount、stale cleanup、基準要素不在をテストできる。
  - DnD側がStoreやWordPress固有DOM探索へ依存せず、現在のTable基準要素を取得できる。

### Step 2: Zustand State、公開境界、start/progress

- 対象:

  - 新規src/reorder/row-reorder/dnd-interaction.ts
  - 新規src/reorder/row-reorder/dnd-interaction.test.ts

- 次の型を定義する。

  - Point
  - RowDndSession：tableIdentity、sourceRowIndex、destinationBoundaryIndex、currentPoint、structureAtStart
  - RowDndPresentationNotice
  - 内部RowDndStateと内部RowDndActions
  - RowDndInput
  - RowDndPresentationState / RowDndPresentationActions
  - RowDndAutoScrollState / RowDndAutoScrollActions
  - Input cleanup向けの最小active状態

- Zustandの内部Storeを状態の正本とする。StateとActionsを別型で定義してから合成し、Store、getState()、setState()、Session全体は公開しない。
- PresentationにはSessionからtableIdentity、sourceRowIndex、destinationBoundaryIndex、currentPointだけを投影し、structureAtStartを公開しない。Auto ScrollにはtableIdentityとcurrentPointだけを投影する。
- Table wrapper内の現在のtableとtbodyを解決し、開始座標ではelementFromPoint()とclosest('tr')を使って対象Tableの直接のtbody行だけをsourceRowIndexへ変換する。
- 移動先は現在のtbody行矩形とclientYを比較し、行中央より上を直前境界、全行中央より下を末尾境界として解決する。tbody外、範囲外、blockedBoundaries、移動元の直前・直後に相当するno-op境界はnullとする。
- start(tableIdentity, point)はrow mode、現在DOM、rowTableIntegration.getStructure()、移動対象行を照合する。移動可能な場合だけ構造をコピーしたstructureAtStartを持つSessionを開始してtrueを返す。
- rowspan範囲内の行ではSessionを開始せず、単調増加するIDを持つstart-unavailable / merged-cells通知を設定してfalseを返す。対象外、DOM不在、Table利用不能は正常な開始不可として扱う。
- progress(point)はcurrentPointを更新し、現在DOMの矩形とstructureAtStartだけで移動先を再計算する。Table Integrationから構造を再取得しない。
- refreshDestination()もSessionのcurrentPointとscroll後の現在DOMから同じ判定を行う。Session終了後の遅延呼び出しは正常なno-opとする。
- 完了条件:
  - start成功・拒否、Session生成、開始時構造のsnapshot、progress、no-op/blocked境界、DOM不在、refreshDestinationを公開境界から検証できる。

### Step 3: complete、cancel、通知、共通failure recovery

- complete(point)はprogress結果を流用せず、drop時点のPointから最終境界を再解決する。最終境界が開始時構造上で無効なら、成立しないdropとして更新・terminated通知なしで終了する。
- 最終境界が有効な場合だけrowTableIntegration.getStructure()を再実行し、現在のrowCountとblockedBoundariesに対して移動元、移動先、no-op条件を再照合する。
- 再照合成功時だけrowTableIntegration.applyRowMove({ clientId: tableIdentity, sourceRowIndex, destinationBoundaryIndex })を1回呼ぶ。table-integration.tsのData Update由来のJSDocもDnD Interactionからの直
  接利用へ合わせる。

- 現在構造の不在・変化または更新不能は外部環境変化として記録せず、安全な終了へ合流する。active操作を継続不能として終了した場合だけterminated通知を設定する。
- cancel()はTable Integrationを呼ばず、SessionとDnD一時状態を破棄する。成立しないdropと通常cancelではterminatedを設定しない。
- dismissPresentationNotice(id)は現在通知とIDが一致する場合だけ解除し、古いtimerが新しい通知を消さないようにする。
- PresentationとAuto Scrollには同じreportFailure(error)シグネチャを提供するが、各公開Facadeから内部共通中止経路へpresentationまたはauto-scrollの発生元を付けて渡す。
- start、progress、complete、cancel、refreshDestinationおよびreportFailureの内部Errorは共通中止経路へ集約する。発生元と元のErrorを一度だけ記録し、Sessionと一時状態を破棄し、必要なterminated通知とReorder
  Mode継続結果を反映してidleへ戻す。Editor全体へ再throwしない。

- complete成功、cancel、成立しないdrop、外部変化、内部failureの全終了経路で、Presentation/Auto Scroll/Input向けactive状態に終了済みSessionの値を残さない。
- 完了条件:
  - 更新は現在構造で再照合できたcomplete成功時だけ発生し、全終了経路が安全なidleへ収束する。

## Test Plan

- Jestで、Issue #736が要求するstart成功・開始不可・Session生成・progress・開始時構造利用・complete再照合・成功時だけの行更新・成立しないdrop・cancel・外部変化・内部failure recoveryを網羅する。
- presentationNotice、連続通知のID競合、dismissPresentationNotice、Presentation/Auto Scroll別のreportFailure、一度だけの記録、refreshDestination、終了後の状態消去を検証する。
- DOMテストでは行矩形を明示的にmockし、先頭・中間・末尾・tbody外・blocked/no-op境界、iframeのownerDocument、Table再mountを扱う。

## Assumptions

- tableIdentityは現在のWordPress Block clientIdであり、Table wrapper登録とapplyRowMove.clientIdで同じ値を使用する。
- Reorder Presentation本体、overlay、挿入線描画、文言・表示時間、Auto Scroll本体、requestAnimationFrame loop、速度制御は対象外とする。
- Row/Column共通Store、共通Session、共通座標resolverは導入しない。
- Architecture先行更新は別の承認可能な変更単位とし、その決定を詳細Plan内で代替しない。
