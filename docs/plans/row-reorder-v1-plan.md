# PLAN-682: Row Reorder v1 implementation

## References

- Parent issue: #682
- Plan update issues: #700, #752
- Requirements:
  - `docs/requirements/reorder-v1-requirements.md`
  - `docs/requirements/reorder-v1-quality-requirements.md`
- Design:
  - `docs/design/reorder-v1-design.md`
  - `docs/design/row-reorder-v1-design.md`
- Architecture: `docs/architecture/row-reorder-v1-architecture.md`
- Plan guidelines: `docs/plans/AGENTS.md`
- Source guidelines:
  - `src/AGENTS.md`
  - `src/reorder/AGENTS.md`
- Validation: `docs/development/testing.md`

## Goal

確定済みのRow Reorder v1 Architectureを、レビュー可能な実装単位へ分け、依存関係に沿って実装・検証できる順序を定める。

## Scope

### Included

- Row Reorder v1 Architectureを実装するための実装順序とIssue単位
- Row Reorderが利用するReorder Mode、Reorder Guidance、Editor DOM Context、DnD Engineとの接続
- 各Phaseで必要な実装前決定と実装中validation
- Product compositionと横断validation

### Not included

- Requirements / Design / Architectureの再定義
- Column Reorder固有の実装
- Row / Column間の共通Reorder抽象化
- Architectureに存在しない仕様、責務、制約の追加

## Approach

Reorder Mode / Toolbar integrationを最初に成立させ、次にTable Integrationで対応Table Blockの構造取得と確定済み行移動の反映境界を成立させる。その後、DnD Engineとの接続を含むDnD Interaction / Session Lifecycleを実装し、開始可否判定、Session開始、移動先判定、complete時の現在構造への再照合、確定・中止・回復を一つのLifecycleとして成立させる。

DnD Interactionの境界を成立させた後、PC / Touch Input Interactionから開始候補をDnD Engineへ接続し、入力からDnD Interactionへ到達する実装経路を成立させる。DnD EngineにはArchitectureで採用済みのdnd-kitを用い、Input Interactionが開始候補のDraggableを、DnD InteractionがSession成立後のDroppableを必要な期間だけ接続する。

入力経路の成立後にReorder Presentationを接続し、その後Auto Scroll、Guidance、Rediscovery Detectionを接続する。物理的なDnD進行、collision detection、自動スクロール実行はDnD Engineへ委ね、DnD Engine標準のVisual Feedbackは利用せず、Presentationを独立して接続する。最後にproduct compositionと横断validationを行う。

各Phaseでは、その段階で必要な実装レベルの選択だけを確定し、focused test / integration testでArchitectureへの適合を確認する。実WordPress Editorの製品経路を通るPlaywrightはproduct composition成立後に行う。

実装中にRequirements / Design / Architectureの変更が必要になった場合はPlanまたは実装Issueで判断せず、該当する上位文書を先に更新してからPlanを追従させる。

## Architecture impact

このPlanは、確定済みの`docs/architecture/row-reorder-v1-architecture.md`を実装へ落とし込むものであり、Architecture自体の変更は予定しない。

## Decisions and validation questions

### Decide before implementation

以下は、記載したPhaseを開始する前に実装レベルで確定する。上位文書の決定を変更する必要が生じた場合は、そのPhaseでは決定しない。

1. **Phase 1開始前: Reorder Mode / Toolbar integrationの実装境界**

   - 状態表現とReact / WordPressへの接続位置を確定する。

2. **Phase 2開始前: Row Reorderのsource配置とTable Integrationの型表現**

   - Architecture責務を`src/reorder/row-reorder/`内のmoduleへ対応付け、対応Table差を吸収するType / Result表現と、確定済み行移動の更新方式を確定する。

3. **Phase 3開始前: DnD Interaction / Session Lifecycleの実装表現**

   - dnd-kitのLifecycleをDnD Interactionへ接続する位置、Session state model、開始可否結果、正常結果とErrorの表現、Droppableの遅延接続とcleanup、共通中止経路を確定する。

4. **Phase 4開始前: PC Input InteractionのDnD Engine接続方式**

   - browser event、listener lifecycle、開始候補Draggableの遅延接続、Sensor activationへの接続方式を確定する。

5. **Phase 5開始前: Touch Input InteractionのDnD Engine接続方式**

   - touch / pointer系event、listener lifecycle、開始候補Draggableの遅延接続、Sensor activationへの接続方式を確定する。

6. **Phase 6開始前: Reorder Presentationの描画方式**

   - React / DOM / CSSの分担、DnD Engineから利用する物理情報の取得方法、独自Visual Feedbackとcleanup方式を確定する。

7. **Phase 7開始前: Auto ScrollのDnD Engine設定方式**

   - 行方向だけを許可する設定、対象Tableに必要な許可範囲の表現、DnD Interactionへのfailure接続方法を確定する。

8. **Phase 8開始前: Reorder Guidanceの状態実装位置**

   - Architectureで定義された状態をWordPress / React側のどこで保持するか確定する。

9. **Phase 9開始前: Rediscovery Detectionの判定方式**

   - Designの意味を変えない範囲で必要な観測入力と実装値を確定する。

10. **Phase 10開始前: Product composition boundary**

    - `src/index.tsx`をthin entry pointとして保つ生成・接続・cleanup位置とDnD Engine providerの配置を確定する。

11. **Phase 11開始前: 横断validation matrix**
    - Requirements / Design / Architecture / Quality Requirementsを、focused test、Playwright、計測のどこで確認するか確定する。
    - PerformanceはTable全体の更新時間を合否基準にせず、対応Table Block本体の更新コストとYTR自身の追加コストを区別して確認できる計測方法を定める。

### Validate during implementation

1. **Phase 1、Phase 11で最終確認: Reorder Mode / Toolbar integration**

   - Architectureで定義されたReorder ModeのLifecycle、Table scope、Toolbar integration、通常編集との関係が成立することを確認する。
   - Evidence: focused state / React integration testと主要E2E。

2. **Phase 2、Phase 11で最終確認: Table Integration**

   - 対応Table Blockへの適応、現在構造の取得、確定済み行移動の反映、WordPress Undoとの境界がArchitectureおよびRequirementsどおり成立することを確認する。
   - Evidence: focused integration testと主要E2E。

3. **Phase 3、Phase 11で最終確認: DnD Interaction / Session Lifecycle**

   - active DnD成立前の開始可否判定、startでのSession成立、Session開始時制約によるprogress判定、complete時の現在構造への再照合、確定・cancel・正常中止・failure recoveryが一つのLifecycleとして成立することを確認する。
   - Evidence: focused normal / failure-recovery testと主要E2E。

4. **Phase 3 / 4 / 5、Phase 11で最終確認: Draggable / Droppableの遅延接続とcleanup**

   - 開始候補DraggableをInput Interactionが、Session成立後のDroppableをDnD Interactionが所有し、不要になった時点でそれぞれ安全に破棄することを確認する。
   - Evidence: focused lifecycle / integration test。

5. **Phase 3 / 1、Phase 11で最終確認: DnD終了後Lifecycle**

   - DnD終了後のReorder Modeとの接続がArchitectureどおり成立することを確認する。
   - Evidence: DnD InteractionとReorder Modeのfocused integration test、主要E2E。

6. **Phase 3 / 7、Phase 11で最終確認: failure recovery**

   - operation boundary / execution boundaryからのfailure recoveryがArchitectureどおり成立することを確認する。
   - Evidence: failure / recovery focused test。

7. **Phase 6、Phase 11で最終確認: Presentation / notification / cleanup**

   - dnd-kit標準Visual Feedbackへ依存せず、DnD表示、cleanup、利用者向け通知がDesign / Architectureどおり成立することを確認する。
   - Evidence: Presentation focused testと主要E2E。

8. **Phase 7、Phase 11で最終確認: Auto Scroll**

   - Row Reorderが縦方向と対象Tableに必要な許可範囲だけを決定し、物理的なスクロール実行をDnD Engineへ委ねることを確認する。
   - Evidence: Auto Scroll focused testと主要E2E。

9. **Phase 4 / 5、Phase 10 / 11で最終確認: Editor lifecycle / input**

   - Editor lifecycleへの追従とPC / Touch入力の製品経路がArchitecture / Designどおり成立することを確認する。
   - Evidence: lifecycle focused test、input focused test、composition test、主要E2E。

10. **Phase 8 / 9、Phase 10 / 11で最終確認: Guidance / Rediscovery**

    - 初回案内と再案内の製品経路がDesign / Architectureどおり成立することを確認する。
    - Evidence: focused testと主要E2E。

11. **Phase 11: Quality Requirements**
    - Quality Requirementsで定義された保証範囲を、Phase 11開始前に確定したvalidation matrixに従って確認する。
    - Performanceは代表的な大規模Tableをストレステストとして使用し、対応Table Block本体の属性更新・再描画時間をYTRの合否基準から除外したうえで、並び替え計算、状態更新、表示更新、DnD Engineとの接続管理などYTR自身が追加する処理が新たな長時間停止を生んでいないことを確認する。

## Implementation phases

### Phase 1: Reorder Mode foundation

- Outcome: Row Reorder実装の前提となるReorder Mode / Toolbar integrationが成立する。
- Tasks:
  - 既存Reorder Modeを最新Architectureへ追従する。
  - Toolbar integrationを実装する。
  - Editor DOM Contextを照合し、必要な場合だけ最小修正する。
- Validation:
  - Architectureへの適合をfocused state / React integration testで確認する。

### Phase 2: Table Integration

- Outcome: 後続Phaseが対応Table Blockへ依存せずに現在構造の取得と確定済み行移動の反映を利用できる。
- Tasks:
  - Row Reorder用Table Integrationを実装する。
  - 対応Table Block差を吸収し、確定済み行移動を1回のUndo単位として反映する更新境界を成立させる。
- Validation:
  - ArchitectureのContract、対応Table Blockへの適応、更新結果、Undo境界をfocused testで確認する。

### Phase 3: DnD Interaction and Session Lifecycle

- Outcome: DnD EngineのLifecycleをRow Reorderの意味へ変換し、開始から終了までの行DnD Lifecycleが成立する。
- Tasks:
  - dnd-kitをDnD EngineとしてDnD Interactionへ接続する。
  - active DnD成立前にTable Integrationの現在構造を利用して開始可否を判定する。
  - startでSessionを開始し、開始可否判定時に確認した行制約を保持する。
  - Session成立後に必要なDroppable候補だけを遅延接続する。
  - progressでDnD Engineの現在targetと位置関係を挿入位置へ変換し、Session開始時制約で有効性を判定する。
  - completeでTable Integrationから現在構造を取得し直し、移動対象と最終有効移動先を再照合して、成立する場合だけ行更新境界を利用する。
  - cancel、成立しないdrop、外部環境変化、内部Errorの終了経路とDroppable cleanupを成立させる。
  - DnD終了後のReorder Mode継続可否を外側の境界へ接続する。
- Validation:
  - Architectureで定義されたstart attempt、Session Lifecycle、progress、complete再照合、cancel、failure recoveryをfocused integration testで確認する。
  - progressでTable Integrationから現在構造を取得し直さないことを確認する。
  - DnD Engine固有の物理状態をSessionへ保持しないことを確認する。

### Phase 4: PC Input Interaction

- Outcome: PC入力から必要な開始候補だけをDnD Engineへ接続し、Row ReorderのDnD開始試行へ到達できる。
- Tasks:
  - PC Input Interactionを実装する。
  - 開始条件成立時に開始候補行だけをDraggableとして遅延接続し、同じ入力をDnD EngineのSensorへ接続する。
  - 開始不成立、DnD終了、cancel、モード終了、外部環境変化、failure recoveryでInput Interaction所有の一時状態をcleanupする。
- Validation:
  - 入力開始条件、Draggable lifecycle、DnD Engine接続、cleanupをfocused testで確認する。

### Phase 5: Touch Input Interaction

- Outcome: Touch入力から必要な開始候補だけをDnD Engineへ接続し、Row ReorderのDnD開始試行へ到達できる。
- Tasks:
  - Touch Input Interactionを実装する。
  - 開始条件成立時に開始候補行だけをDraggableとして遅延接続し、同じ入力をDnD EngineのSensorへ接続する。
  - 開始不成立、DnD終了、cancel、モード終了、外部環境変化、failure recoveryでInput Interaction所有の一時状態をcleanupする。
- Validation:
  - 入力開始条件、Draggable lifecycle、DnD Engine接続、cleanupをfocused testで確認する。

### Phase 6: Reorder Presentation

- Outcome: Row Reorderの意味状態とDnD Engineの必要な物理情報を、独立した利用者向け表示へ接続できる。
- Tasks:
  - Reorder Presentationを実装し、DnD Interaction、DnD Engine、Editor DOM Contextへ接続する。
  - dnd-kit標準Visual Feedbackを無効化し、実Table DOM順序を変更しない独自表示を成立させる。
- Validation:
  - Design / Architectureへの適合、表示範囲、通知、cleanupをfocused testで確認する。

### Phase 7: Auto Scroll

- Outcome: 行DnD中の縦方向Auto ScrollをDnD Engineの実行境界へ接続できる。
- Tasks:
  - Auto Scrollを実装し、DnD Interaction、Editor DOM Context、Editor Scroll Area、DnD Engineへ接続する。
  - Row Reorderが縦方向と対象Tableに必要な許可範囲だけを決定し、物理的な検出・速度制御・実行はDnD Engineへ委ねる。
- Validation:
  - Architectureへの適合、許可方向・範囲、終了時cleanup、failure接続をfocused testで確認する。

### Phase 8: Reorder Guidance

- Outcome: Row Reorderが利用する共通案内境界を製品経路へ接続できる。
- Tasks:
  - Reorder Guidanceを実装し、必要な外側境界へ接続する。
- Validation:
  - Design / Architectureへの適合をfocused testで確認する。

### Phase 9: Rediscovery Detection

- Outcome: 行側の再案内候補検出をReorder Guidanceへ接続できる。
- Tasks:
  - Rediscovery Detectionを実装し、Reorder Guidanceへ接続する。
- Validation:
  - Design / Architectureへの適合をfocused testで確認する。

### Phase 10: Product composition

- Outcome: Phase 1〜9がplugin-wide entry pointからWordPress Editorの実利用経路へ接続される。
- Tasks:
  - composition boundaryを実装する。
  - DnD Engine providerを含むRow Reorderの生成・接続境界を成立させる。
  - Editor lifecycleに応じたcleanupと再接続を成立させる。
- Validation:
  - focused integration testと、実entry pointを通る最小Playwright scenarioで製品経路を確認する。

### Phase 11: Cross-cutting validation

- Outcome: Row Reorder v1全体の上位文書への適合と、YTR自身のPerformance責任を確認できる。
- Tasks:
  - Phase 11開始前に確定したvalidation matrixに従って横断validationを実施する。
  - 代表的な大規模Tableをストレステストとして使用し、Table Block本体の更新時間とYTR自身の追加コストを区別して計測する。
- Validation:
  - 適用するfocused test、Node.js / build checks、Playwright E2E、repository checkは`docs/development/testing.md`に従う。
  - PerformanceはTable全体のcommit時間そのものではなく、YTR自身が追加する処理に新たな長時間停止がないことを確認する。

## Issue breakdown

Planレビュー後、次の単位で実装Issueを作成する。各IssueはこのPlanと該当Architecture責務を参照し、上位文書の内容を複製しない。

- [x] Reorder Mode foundation / Toolbar integration
- [x] Table Integration
- [ ] DnD Interaction and Session Lifecycle / DnD Engine integration
- [ ] PC Input Interaction
- [ ] Touch Input Interaction
- [ ] Reorder Presentation
- [ ] Auto Scroll
- [ ] Reorder Guidance
- [ ] Rediscovery Detection
- [ ] Row Reorder product composition
- [ ] Row Reorder cross-cutting validation and E2E

実装順は上記Phase順を基本とする。Editor DOM Contextにsource変更が必要な場合はPhase 1 Issueに含めるか、変更量が独立レビューを必要とする場合だけ別Issueへ分ける。Phase 4〜9は製品composition前に実行可能なfocused validationまでを完了条件とし、実WordPress Editorの製品経路を通るPlaywrightはPhase 10 / 11で扱う。

## Validation

- 各実装Issueでは、そのPhaseの実装結果が該当する上位文書に適合することをfocused test / integration testで確認する。
- Phase 3では、開始可否判定、Droppableの遅延接続、Session開始時制約、progress、complete再照合、確定・中止・回復をDnD Engineとの実接続を含めて確認する。
- Phase 4 / 5では、PC / Touch Input InteractionによるDraggableの遅延接続とcleanup、および入力からDnD Interactionへ到達する経路を確認する。
- Phase 10でproduct compositionを成立させ、実entry pointを通る最小Playwright scenarioを実行する。
- Phase 11でvalidation matrixに従って横断確認し、代表的な大規模TableではYTR自身の追加コストをストレステストする。
- 具体的なコマンドと適用範囲は`docs/development/testing.md`を正本とする。

## Completion criteria

- 最新Row Reorder v1 Architectureの実装対象が、依存関係に沿ったレビュー可能なIssue単位へ分割されている。
- Reorder Target Resolution / Drop Target Resolution / Data Updateが独立責務、独立Phase、Issue単位として残っていない。
- 開始可否判定と移動先判定がDnD Interaction / Session Lifecycleへ、確定済み行移動の反映がTable Integrationへ統合されている。
- DnD Interaction、Input Interaction、Reorder Presentationの順に主要なDnD実装経路を成立させ、その後Auto Scrollを接続する実装順になっている。
- DnD Engine、Draggable / Droppableの遅延接続、独立Presentation、Auto Scroll、Input Interactionの実装方向・順序・Validationが最新Architectureと矛盾しない。
- 各Phase開始前に、そのPhaseに必要な実装レベルの`Decide before implementation`が解決される構成になっている。
- `Validate during implementation`が、検証対象の上位文書、該当Phase、evidenceへ結び付いている。
- Requirements / Design / Architectureの決定をPlanで再定義していない。
- Column Reorder固有の内部実装またはRow / Column共通Reorder抽象化へ依存していない。
- 実装中に上位文書の変更が必要になった場合、該当文書を先に更新してからPlanを追従させる。
