# PLAN-682: Row Reorder v1 implementation

## References

- Parent issue: #682
- Plan update issue: #700
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
- Row Reorderが利用するReorder Mode、Reorder Guidance、Editor DOM Contextとの接続
- 各Phaseで必要な実装前決定と実装中validation
- Product compositionと横断validation

### Not included

- Requirements / Design / Architectureの再定義
- Column Reorder固有の実装
- Row / Column間の共通Reorder抽象化
- Architectureに存在しない仕様、責務、制約の追加

## Approach

Reorder Mode / Toolbar integrationを最初に成立させ、その後にRow Reorder内部をTable IntegrationからDnD Interactionまで依存順に実装する。続いてPresentation、Auto Scroll、PC / Touch Input、Guidance、Rediscovery Detectionを接続し、最後にproduct compositionと横断validationを行う。

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
   - Architecture責務を`src/reorder/row-reorder/`内のmoduleへ対応付け、対応Table差を吸収するType / Result表現を確定する。

3. **Phase 3開始前: Reorder Target Resolutionの結果表現**
   - ArchitectureのContractを実装できるType / Result表現を確定する。

4. **Phase 4開始前: Drop Target Resolutionの結果表現**
   - progressとcomplete再照合を実装できるinput / result表現を確定する。

5. **Phase 5開始前: Data UpdateのWordPress更新方式**
   - ArchitectureとUndo要件を満たす更新経路を確定する。

6. **Phase 6開始前: DnD operation / Session / 終了結果の実装表現**
   - operation API、Session state model、正常結果とErrorの表現、共通中止経路への接続方法を確定する。

7. **Phase 7開始前: Reorder Presentationの描画方式**
   - React / DOM / CSSの分担とcleanup方式を確定する。

8. **Phase 8開始前: Auto Scrollの実行方式**
   - 更新方式とDnD Interactionへのfailure接続方法を確定する。

9. **Phase 9開始前: PC Input Interactionのevent接続方式**
   - browser event、listener lifecycle、DnD operationへの変換方式を確定する。

10. **Phase 10開始前: Touch Input Interactionのevent接続方式**
    - touch / pointer系event、listener lifecycle、DnD operationへの変換方式を確定する。

11. **Phase 11開始前: Reorder Guidanceの状態実装位置**
    - Architectureで定義された状態をWordPress / React側のどこで保持するか確定する。

12. **Phase 12開始前: Rediscovery Detectionの判定方式**
    - Designの意味を変えない範囲で必要な観測入力と実装値を確定する。

13. **Phase 13開始前: Product composition boundary**
    - `src/index.tsx`をthin entry pointとして保つ生成・接続・cleanup位置を確定する。

14. **Phase 14開始前: 横断validation matrix**
    - Requirements / Design / Architecture / Quality Requirementsを、focused test、Playwright、計測のどこで確認するか確定する。

### Validate during implementation

1. **Phase 1、Phase 14で最終確認: Reorder Mode / Toolbar integration**
   - Architectureで定義されたReorder ModeのLifecycle、Table scope、Toolbar integration、通常編集との関係が成立することを確認する。
   - Evidence: focused state / React integration testと主要E2E。

2. **Phase 2 / 5、Phase 14で最終確認: Table Integration / Data Update**
   - 対応Table Blockへの適応と更新がArchitectureおよびRequirementsどおり成立することを確認する。
   - Evidence: focused integration testと主要E2E。

3. **Phase 4 / 6、Phase 14で最終確認: complete再照合**
   - complete再照合がArchitectureどおり現在構造での移動成立可否を判定し、その結果に応じた経路へ進むことを確認する。
   - Evidence: focused normal / failure-recovery testと主要E2E。

4. **Phase 6 / 1、Phase 14で最終確認: DnD終了後Lifecycle**
   - DnD終了後のReorder Modeとの接続がArchitectureどおり成立することを確認する。
   - Evidence: DnD InteractionとReorder Modeのfocused integration test、主要E2E。

5. **Phase 6 / 8、Phase 14で最終確認: failure recovery**
   - operation boundary / execution boundaryからのfailure recoveryがArchitectureどおり成立することを確認する。
   - Evidence: failure / recovery focused test。

6. **Phase 7、Phase 14で最終確認: Presentation / notification / cleanup**
   - DnD表示、cleanup、利用者向け通知がDesign / Architectureどおり成立することを確認する。
   - Evidence: Presentation focused testと主要E2E。

7. **Phase 7〜10、Phase 13 / 14で最終確認: Editor lifecycle / input**
   - Editor lifecycleへの追従とPC / Touch入力の製品経路がArchitecture / Designどおり成立することを確認する。
   - Evidence: lifecycle focused test、input focused test、composition test、主要E2E。

8. **Phase 11 / 12、Phase 13 / 14で最終確認: Guidance / Rediscovery**
   - 初回案内と再案内の製品経路がDesign / Architectureどおり成立することを確認する。
   - Evidence: focused testと主要E2E。

9. **Phase 14: Quality Requirements**
   - Quality Requirementsで定義された保証範囲を、Phase 14開始前に確定したvalidation matrixに従って確認する。

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

- Outcome: 後続Phaseが対応Table Blockへ依存せずに必要なTable境界を利用できる。
- Tasks:
  - Row Reorder用Table Integrationを実装する。
- Validation:
  - ArchitectureのContractと対応Table Blockへの適応をfocused testで確認する。

### Phase 3: Reorder Target Resolution

- Outcome: DnD開始試行に必要な解決境界が利用できる。
- Tasks:
  - Reorder Target Resolutionを実装し、Table Integrationへ接続する。
- Validation:
  - ArchitectureのContractをfocused testで確認する。

### Phase 4: Drop Target Resolution

- Outcome: progressとcompleteに必要な移動先解決境界が利用できる。
- Tasks:
  - Drop Target Resolutionを実装し、Table Integrationへ接続する。
- Validation:
  - progressとcomplete再照合がArchitectureどおり成立することをfocused testで確認する。

### Phase 5: Data Update

- Outcome: 確定済みの行移動を対応Table Blockへ反映する境界が利用できる。
- Tasks:
  - Data Updateを実装し、Table Integrationへ接続する。
- Validation:
  - ArchitectureとUndo要件への適合をfocused testで確認する。

### Phase 6: DnD Interaction

- Outcome: Phase 3〜5をDnD operation / Session Lifecycleとして統合できる。
- Tasks:
  - DnD InteractionとSessionを実装する。
  - Phase 3 / 4 / 5とPhase 1へ接続する。
- Validation:
  - Architectureで定義されたLifecycleとfailure recoveryをfocused integration testで確認する。

### Phase 7: Reorder Presentation

- Outcome: DnD Interactionの状態を利用者向け表示へ接続できる。
- Tasks:
  - Reorder Presentationを実装し、DnD InteractionとEditor DOM Contextへ接続する。
- Validation:
  - Design / Architectureへの適合とcleanupをfocused testで確認する。

### Phase 8: Auto Scroll

- Outcome: 行DnD中のAuto Scrollを製品経路へ接続できる。
- Tasks:
  - Auto Scrollを実装し、DnD InteractionとEditor DOM Contextへ接続する。
- Validation:
  - Architectureへの適合とfailure接続をfocused testで確認する。

### Phase 9: PC Input Interaction

- Outcome: PC入力をRow ReorderのDnD operationへ接続できる。
- Tasks:
  - PC Input Interactionを実装し、必要な外側境界とDnD Interactionへ接続する。
- Validation:
  - 入力変換とlistener lifecycleをfocused testで確認する。

### Phase 10: Touch Input Interaction

- Outcome: Touch入力をRow ReorderのDnD operationへ接続できる。
- Tasks:
  - Touch Input Interactionを実装し、必要な外側境界とDnD Interactionへ接続する。
- Validation:
  - 入力変換とlistener lifecycleをfocused testで確認する。

### Phase 11: Reorder Guidance

- Outcome: Row Reorderが利用する共通案内境界を製品経路へ接続できる。
- Tasks:
  - Reorder Guidanceを実装し、必要な外側境界へ接続する。
- Validation:
  - Design / Architectureへの適合をfocused testで確認する。

### Phase 12: Rediscovery Detection

- Outcome: 行側の再案内候補検出をReorder Guidanceへ接続できる。
- Tasks:
  - Rediscovery Detectionを実装し、Reorder Guidanceへ接続する。
- Validation:
  - Design / Architectureへの適合をfocused testで確認する。

### Phase 13: Product composition

- Outcome: Phase 1〜12がplugin-wide entry pointからWordPress Editorの実利用経路へ接続される。
- Tasks:
  - composition boundaryを実装する。
  - Editor lifecycleに応じたcleanupと再接続を成立させる。
- Validation:
  - focused integration testと、実entry pointを通る最小Playwright scenarioで製品経路を確認する。

### Phase 14: Cross-cutting validation

- Outcome: Row Reorder v1全体の上位文書への適合を確認できる。
- Tasks:
  - Phase 14開始前に確定したvalidation matrixに従って横断validationを実施する。
- Validation:
  - 適用するfocused test、Node.js / build checks、Playwright E2E、repository checkは`docs/development/testing.md`に従う。

## Issue breakdown

Planレビュー後、次の単位で実装Issueを作成する。各IssueはこのPlanと該当Architecture責務を参照し、上位文書の内容を複製しない。

- [ ] Reorder Mode foundation / Toolbar integration
- [ ] Table Integration
- [ ] Reorder Target Resolution
- [ ] Drop Target Resolution
- [ ] Data Update
- [ ] DnD Interaction and Session Lifecycle
- [ ] Reorder Presentation
- [ ] Auto Scroll
- [ ] PC Input Interaction
- [ ] Touch Input Interaction
- [ ] Reorder Guidance
- [ ] Rediscovery Detection
- [ ] Row Reorder product composition
- [ ] Row Reorder cross-cutting validation and E2E

実装順は上記Phase順を基本とする。Editor DOM Contextにsource変更が必要な場合はPhase 1 Issueに含めるか、変更量が独立レビューを必要とする場合だけ別Issueへ分ける。Phase 9〜12は製品composition前に実行可能なfocused validationまでを完了条件とし、実WordPress Editorの製品経路を通るPlaywrightはPhase 13 / 14で扱う。

## Validation

- 各実装Issueでは、そのPhaseの実装結果が該当する上位文書に適合することをfocused test / integration testで確認する。
- Phase 13でproduct compositionを成立させ、実entry pointを通る最小Playwright scenarioを実行する。
- Phase 14でvalidation matrixに従って横断確認する。
- 具体的なコマンドと適用範囲は`docs/development/testing.md`を正本とする。

## Completion criteria

- 最新Row Reorder v1 Architectureの実装対象が、依存関係に沿ったレビュー可能なIssue単位へ分割されている。
- Reorder Mode / Toolbar integrationが最初の実装Phaseとして反映されている。
- 各Phase開始前に、そのPhaseに必要な実装レベルの`Decide before implementation`が解決される構成になっている。
- `Validate during implementation`が、検証対象の上位文書、該当Phase、evidenceへ結び付いている。
- Requirements / Design / Architectureの決定をPlanで再定義していない。
- Column Reorder固有の内部実装またはRow / Column共通Reorder抽象化へ依存していない。
- 実装中に上位文書の変更が必要になった場合、該当文書を先に更新してからPlanを追従させる。
