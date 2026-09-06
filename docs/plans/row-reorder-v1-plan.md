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

Reorder Mode / Toolbar integrationを最初に成立させ、次にTable Integrationを実装する。その後、DnD Interaction / Session LifecycleをDnD EngineとTable Integrationへ接続し、Architectureで定義されたLifecycleを実装する。

DnD Interactionの接続を成立させた後、PC / Touch Input InteractionをDnD Engineへ接続し、入力からDnD Interactionへ到達する実装経路を成立させる。DnD EngineにはArchitectureで採用済みのdnd-kitを用いる。

入力経路の成立後にReorder Presentationを接続し、その後DnD Engineの自動スクロール設定とGuidanceを接続する。自動スクロールは行DnDで縦方向だけを有効にし、最後にproduct compositionと横断validationを行う。

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

   - dnd-kitへのadapter構成、Architectureで定義されたSession stateのType表現、結果 / Error表現、focused testの境界を確定する。

4. **Phase 4開始前: PC Input InteractionのDnD Engine接続方式**

   - PC入力をdnd-kitのSensor / activatorへ接続するevent adapterの構成を確定する。

5. **Phase 5開始前: Touch Input InteractionのDnD Engine接続方式**

   - Touch入力をdnd-kitのSensor / activatorへ接続するevent adapterの構成を確定する。

6. **Phase 6開始前: Reorder Presentationの描画方式**

   - React / DOM / CSSの分担と、DnD Engineから利用する物理情報の取得方法を確定する。

7. **Phase 7開始前: DnD Engineの自動スクロール設定方式**

   - dnd-kitの自動スクロールを行DnDでは縦方向だけ有効にする設定方式を確定する。

8. **Phase 8開始前: Reorder Guidanceの状態実装位置**

   - Architectureで定義された状態をWordPress / React側のどこで保持するか確定する。

9. **Phase 9開始前: Product composition boundary**

   - `src/index.tsx`をthin entry pointとして保つ生成・接続・cleanup位置とDnD Engine providerの配置を確定する。

10. **Phase 10開始前: 横断validation matrix**
    - Requirements / Design / Architecture / Quality Requirementsを、focused test、Playwright、計測のどこで確認するか確定する。
    - PerformanceはTable全体の更新時間を合否基準にせず、対応Table Block本体の更新コストとYTR自身の追加コストを区別して確認できる計測方法を定める。

### Validate during implementation

1. **Phase 1、Phase 10で最終確認: Reorder Mode / Toolbar integration**

   - Architectureで定義されたReorder ModeのLifecycle、Table scope、Toolbar integration、通常編集との関係が成立することを確認する。
   - Evidence: focused state / React integration testと主要E2E。

2. **Phase 2、Phase 10で最終確認: Table Integration**

   - 対応Table Blockへの適応、現在構造の取得、確定済み行移動の反映、WordPress Undoとの境界がArchitectureおよびRequirementsどおり成立することを確認する。
   - Evidence: focused integration testと主要E2E。

3. **Phase 3、Phase 10で最終確認: DnD Interaction / Session Lifecycle**

   - DnD EngineとTable Integrationへの接続上で、Architectureで定義されたDnD Interaction / Session Lifecycleが成立することを確認する。
   - Evidence: focused normal / failure-recovery integration testと主要E2E。

4. **Phase 3 / 4 / 5、Phase 10で最終確認: DnD Engine integration**

   - PC / Touch Input InteractionとDnD Interactionが、Architectureで定義された接続境界を保ってDnD Engineへ接続されることを確認する。
   - Evidence: focused lifecycle / integration test。

5. **Phase 3 / 1、Phase 10で最終確認: DnD終了後Lifecycle**

   - DnD InteractionとReorder Modeの接続結果がArchitectureに適合することを確認する。
   - Evidence: DnD InteractionとReorder Modeのfocused integration test、主要E2E。

6. **Phase 3、Phase 10で最終確認: failure recovery**

   - failure recovery経路がArchitectureに適合することを確認する。
   - Evidence: failure / recovery focused test。

7. **Phase 6、Phase 10で最終確認: Presentation / notification / cleanup**

   - Reorder PresentationがDesign / Architectureに適合することを確認する。
   - Evidence: Presentation focused testと主要E2E。

8. **Phase 7、Phase 10で最終確認: DnD Engine auto scroll**

   - 行DnDでDnD Engineの自動スクロールが縦方向だけ有効になることを確認する。
   - Evidence: focused integration testと主要E2E。

9. **Phase 4 / 5、Phase 9 / 10で最終確認: Editor lifecycle / input**

   - Editor lifecycleへの追従とPC / Touch入力の製品経路がArchitecture / Designどおり成立することを確認する。
   - Evidence: lifecycle focused test、input focused test、composition test、主要E2E。

10. **Phase 8、Phase 9 / 10で最終確認: Guidance**

    - 初回案内の製品経路がDesign / Architectureどおり成立することを確認する。
    - Evidence: focused testと主要E2E。

11. **Phase 10: Quality Requirements**
    - Quality Requirementsで定義された保証範囲を、Phase 10開始前に確定したvalidation matrixに従って確認する。
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

- Outcome: Architectureで定義されたDnD Interaction / Session LifecycleをDnD EngineとTable Integrationへ接続できる。
- Tasks:
  - DnD Interaction / Session Lifecycleを実装する。
  - dnd-kitとTable Integrationへの実装接続を成立させる。
- Validation:
  - Architectureで定義されたLifecycleへの適合をfocused normal / failure-recovery integration testで確認する。

### Phase 4: PC Input Interaction

- Outcome: PC入力からDnD Engineを経由してDnD Interactionへ到達する実装経路が成立する。
- Tasks:
  - PC Input Interactionを実装する。
  - PC入力をDnD Engineへ接続する。
- Validation:
  - Architecture / Designへの適合とDnD Engine接続をfocused input / integration testで確認する。

### Phase 5: Touch Input Interaction

- Outcome: Touch入力からDnD Engineを経由してDnD Interactionへ到達する実装経路が成立する。
- Tasks:
  - Touch Input Interactionを実装する。
  - Touch入力をDnD Engineへ接続する。
- Validation:
  - Architecture / Designへの適合とDnD Engine接続をfocused input / integration testで確認する。

### Phase 6: Reorder Presentation

- Outcome: Reorder PresentationをArchitectureで定義された境界に従ってDnD Engineへ接続できる。
- Tasks:
  - Reorder Presentationを実装し、必要な実装境界へ接続する。
- Validation:
  - Design / Architectureへの適合をfocused testで確認する。

### Phase 7: DnD Engine auto scroll

- Outcome: 行DnDでDnD Engineの自動スクロールが縦方向だけ有効になる。
- Tasks:
  - dnd-kitの自動スクロール設定を行DnD向けに構成する。
- Validation:
  - 縦方向だけ自動スクロールすることをfocused integration testで確認する。

### Phase 8: Reorder Guidance

- Outcome: Row Reorderが利用する共通案内境界を製品経路へ接続できる。
- Tasks:
  - Reorder Guidanceを実装し、必要な外側境界へ接続する。
- Validation:
  - Design / Architectureへの適合をfocused testで確認する。

### Phase 9: Product composition

- Outcome: Phase 1〜8がplugin-wide entry pointからWordPress Editorの実利用経路へ接続される。
- Tasks:
  - composition boundaryを実装する。
  - DnD Engine providerを含むRow Reorderの生成・接続境界を成立させる。
  - Editor lifecycleに応じたcleanupと再接続を成立させる。
- Validation:
  - focused integration testと、実entry pointを通る最小Playwright scenarioで製品経路を確認する。

### Phase 10: Cross-cutting validation

- Outcome: Row Reorder v1全体の上位文書への適合と、YTR自身のPerformance責任を確認できる。
- Tasks:
  - Phase 10開始前に確定したvalidation matrixに従って横断validationを実施する。
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
- [ ] DnD Engine auto scroll configuration
- [ ] Reorder Guidance
- [ ] Row Reorder product composition
- [ ] Row Reorder cross-cutting validation and E2E

実装順は上記Phase順を基本とする。Editor DOM Contextにsource変更が必要な場合はPhase 1 Issueに含めるか、変更量が独立レビューを必要とする場合だけ別Issueへ分ける。Phase 4〜8は製品composition前に実行可能なfocused validationまでを完了条件とし、実WordPress Editorの製品経路を通るPlaywrightはPhase 9 / 10で扱う。

## Validation

- 各実装Issueでは、そのPhaseの実装結果が該当する上位文書に適合することをfocused test / integration testで確認する。
- Phase 3では、DnD Interaction / Session LifecycleとDnD Engine / Table Integrationの接続がArchitectureに適合することをfocused integration testで確認する。
- Phase 4 / 5では、PC / Touch Input InteractionからDnD Engineを経由してDnD Interactionへ到達する実装経路をfocused input / integration testで確認する。
- Phase 9でproduct compositionを成立させ、実entry pointを通る最小Playwright scenarioを実行する。
- Phase 10でvalidation matrixに従って横断確認し、代表的な大規模TableではYTR自身の追加コストをストレステストする。
- 具体的なコマンドと適用範囲は`docs/development/testing.md`を正本とする。

## Completion criteria

- 最新Row Reorder v1 Architectureの実装対象が、依存関係に沿ったレビュー可能なIssue単位へ分割されている。
- Reorder Target Resolution / Drop Target Resolution / Data Updateが独立責務、独立Phase、Issue単位として残っていない。
- 開始可否判定と移動先判定がDnD Interaction / Session Lifecycleへ、確定済み行移動の反映がTable Integrationへ統合されている。
- DnD Interaction、Input Interaction、Reorder Presentationの順に主要なDnD実装経路を成立させ、その後DnD Engineの自動スクロールを行DnD向けに設定する実装順になっている。
- DnD Engineを利用する各Phaseの実装方向・順序・Validationが最新Architectureと矛盾しない。
- 各Phase開始前に、そのPhaseに必要な実装レベルの`Decide before implementation`が解決される構成になっている。
- `Validate during implementation`が、検証対象の上位文書、該当Phase、evidenceへ結び付いている。
- Requirements / Design / Architectureの決定をPlanで再定義していない。
- Column Reorder固有の内部実装またはRow / Column共通Reorder抽象化へ依存していない。
- 実装中に上位文書の変更が必要になった場合、該当文書を先に更新してからPlanを追従させる。
