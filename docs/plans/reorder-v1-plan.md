# PLAN-499: Reorder v1実装

## References

- Parent issue: #499
- Reconstruction issues: #569, #593
- Implementation parent: #539
- Requirements: `docs/requirements/reorder-v1-requirements.md`
- Design: `docs/design/reorder-v1-design.md`
- Architecture: `docs/architecture/reorder-v1-architecture.md`

## Goal

更新後のReorder v1 Architectureを入力として、現在の実装状態から正式v1を完成させるための実装方向、実装順、実装依存、validation、Issue分割を明確にする。

Architectureで定義済みの責務、Contract、Dependency、Lifecycle、InvariantはPlanで再定義せず、実装をどの順序と単位で進めるかに集中する。

## Current implementation baseline

### 維持する実装

以下は現在のArchitectureと整合しているため維持する。

- Editor DOM Context
- Reorder Modeの現在の状態管理ロジック
- `src/reorder/reorder-mode.ts`までの現在のsource状態

#547、#540、#541は完了済みとして扱う。#542はReorder Constraint Resolutionを独立責務として実装しない方針で完了済みとして扱う。

### Reorder Modeのbaseline整合

後続実装へ進む前に、`src/reorder/reorder-mode.ts`を更新後Architectureと照合し、旧Architecture前提だけを最小限修正する。

現在の状態管理ロジックを作り直すことは目的としない。特にsourceコメント、公開Contractの説明、testの前提に、Reorder PresentationがReorder Modeへ直接依存するなど更新前Architectureの前提が残っていないことを確認する。

このbaseline整合を完了した後、#585を現在の実装再開地点とする。

## Scope

### Included

- Reorder Modeのbaseline整合
- 共通Table structureの具体的なType確定
- Table Integration
- Reorder Target Resolution
- Drop Target Resolution
- DnD InteractionとReorder Session
- Data Update
- PC / タッチのInput Interaction
- Reorder Presentation
- Auto Scroll
- First-use Guidance
- Reorder Rediscovery
- Core Table / Flexible Table Blockの統合
- 大規模TableのPerformance検証
- 正式v1の主要E2E

### Not included

- Keyboard操作、ドラッグを必要としない操作、focus、announcementなど、別要件として扱うアクセシビリティ実装
- Requirements、Design、Architectureの再定義
- Architectureで決定すべき事項をPlan内で決定すること
- PrototypeまたはArchitecture確定前のformal v1実装構造の復元

## Approach

- `docs/architecture/reorder-v1-architecture.md`と`docs/plans/AGENTS.md`をPlan再構成の正本として扱う。
- 現行Planは既存の実装順とIssue構成を確認するための現状参照として扱い、旧Architecture前提を維持する根拠にはしない。
- まずReorder Modeのbaseline整合を行い、その後#585から実装を再開する。
- #585で共通Table structureの具体的なTypeを確定した後、#571でTable Integrationを実装する。
- Table Integrationが提供する要求時点の共通Table structureを入力に、#572で開始対象解決とDnD中に利用する制約情報の具体的な実装表現を確定する。
- #573では#572で具体化した判定入力を利用してDrop Target Resolutionを実装する。
- #574でDnD InteractionとReorder Sessionを実装し、成立した1回のDnD中だけ制約情報を保持してDrop Target Resolutionへ必要な値を渡す経路を接続する。
- #575で確定済み並び替えからTable Integrationへの更新経路を接続する。
- その後にInput Interaction、Presentation、Auto Scroll、Guidanceを統合する。
- Performance検証と正式v1主要E2Eは、主要実装が揃った後に行う。
- 実装中にArchitecture変更が必要になった場合はPlanで解決せず、Architectureを先に更新する。

## Implementation phases

### Phase 1: 実装済みbaseline

- Outcome: 後続実装の出発点となる既存基盤が維持されている。
- Status: 完了。
- Completed Issues:
  - #547 sourceの共通・行・列モジュール境界
  - #540 Editor DOM Context
  - #541 Reorder Mode
  - #542 Reorder Constraint Resolutionは独立責務として実装しないため終了

### Phase 2: Baseline整合と共通Table structure確定

- Outcome: 更新後Architectureと現在sourceのbaselineが一致し、Table Integration実装に必要な共通Table structureの具体的なTypeが確定している。
- Implementation units:
  - Reorder Mode baseline整合を行う新規Issue
  - #585 共通Table structureのTypeを確定する
- Implementation dependency:
  - Reorder Mode baseline整合を先に完了する。
  - #585を完了してから#571へ進む。
- Validation:
  - baseline整合では変更したsourceに適用されるfocused testを実行する。
  - #585はTypeの実装可能性と、後続のTable Integration / Reorder Target Resolutionが必要とする情報を過不足なく表現できることをレビューで確認する。

### Phase 3: Table Integration

- Outcome: #571が完了し、Core Table / Flexible Table Blockから要求時点の共通Table structureを取得し、後続の更新境界としても利用できる状態になる。
- Issue:
  - #571 Table Integrationを実装する。
- Implementation dependency:
  - #585で確定した共通Table structureを入力とする。
- Validation:
  - #571で追加・更新したfocused testを実行する。
  - Core Table / Flexible Table Blockの主要な構造取得ケースを確認する。

### Phase 4: Reorder Target Resolution

- Outcome: #572が完了し、DnD開始試行から移動対象の解決結果と、そのDnDで使用する制約情報を得られる状態になる。
- Issue:
  - #572 Reorder Target Resolutionを実装する。
- Implementation dependency:
  - #571の共通Table structure取得経路を利用できること。
- Validation:
  - 行・列の開始対象解決と制約情報導出の主要ケースをfocused testで確認する。

### Phase 5: Drop Target Resolution / DnD Interaction / Reorder Session

- Outcome: #573と#574が完了し、開始済みDnDで同じ制約情報を利用しながら移動先を判定できる共通DnD実装が揃う。
- Issues:
  - #573 Drop Target Resolutionを実装する。
  - #574 DnD InteractionとReorder Sessionを実装する。
- Implementation dependency:
  - #573は#572で具体化した判定入力を前提とする。
  - #574は#572 / #573の実装成果を接続する。
- Validation:
  - #573と#574で追加・更新したfocused testを実行する。
  - 複数回のdestination判定でTable全体を再解析せず、1回のDnD中の判定入力を再利用できる実装経路になっていることを確認する。

### Phase 6: Data Update

- Outcome: #575が完了し、有効な移動先で確定した並び替えを対象Tableへ反映できる状態になる。
- Issue:
  - #575 Data Updateを実装する。
- Implementation dependency:
  - #574から確定済み並び替えを受け取れること。
  - #571のTable Integration更新境界を利用できること。
- Validation:
  - Core Table / Flexible Table Blockの行・列更新の主要ケースをfocused testで確認する。
  - 1回の確定操作が1回だけ反映されることを確認する。

### Phase 7: Input Interaction

- Outcome: #576と#577が完了し、PCとタッチの主要入力を共通DnD経路へ接続できる状態になる。
- Issues:
  - #576 PC向けInput Interactionを実装する。
  - #577 タッチ向けInput Interactionを実装する。
- Validation:
  - #576と#577で追加・更新した自動テストを実行する。
  - PC / タッチの主要入力フローをPlaywrightで確認する。

### Phase 8: Reorder Presentation

- Outcome: #578が完了し、DnD開始後の移動対象、destination、周囲の表示変化、commit / cancelの主要表示を共通DnD経路へ統合できる状態になる。
- Issue:
  - #578 Reorder Presentationを実装する。
- Validation:
  - #578で追加・更新した自動テストを実行する。
  - DnD開始前のモード切替だけでは移動対象表示を開始せず、DnD開始後の現在対象だけを扱うことを主要フローで確認する。

### Phase 9: Auto Scroll

- Outcome: #579が完了し、長大Tableでの主要DnDフローを確認できる状態になる。
- Issue:
  - #579 Auto Scrollを実装する。
- Validation:
  - #579で追加・更新した自動テストを実行する。
  - 対応editor環境でPlaywrightまたは実環境確認を行う。

### Phase 10: Guidance

- Outcome: #580と#581が完了し、Guidance関連の正式v1実装が揃う。
- Issues:
  - #580 First-use Guidanceを実装する。
  - #581 Reorder Rediscoveryを実装する。
- Validation:
  - #580と#581で追加・更新した自動テストを実行する。
  - PC / タッチの主要案内フローをPlaywrightで確認する。

### Phase 11: Performanceと統合E2E

- Outcome: #582と#583が完了し、正式v1の実装・計測・主要E2Eが揃う。
- Issues:
  - #582 大規模TableのPerformanceを検証・調整する。
  - #583 Core TableとFlexible Table Blockの正式v1主要E2Eを完成させる。
- Validation:
  - Core Table / Flexible Table Block、行 / 列、PC / タッチの主要フローをPlaywrightで確認する。
  - Architectureで定めた対象規模と条件に従ってPerformanceを計測する。

## Implementation order

現在の実装状態からの基本順は次とする。

1. Reorder Mode baseline整合の新規Issue
2. #585 共通Table structureのType確定
3. #571 Table Integration
4. #572 Reorder Target Resolution
5. #573 Drop Target Resolution
6. #574 DnD Interaction / Reorder Session
7. #575 Data Update
8. #576 PC Input Interaction
9. #577 Touch Input Interaction
10. #578 Reorder Presentation
11. #579 Auto Scroll
12. #580 First-use Guidance
13. #581 Reorder Rediscovery
14. #582 Performance検証・調整
15. #583 正式v1主要E2E完成

この順序はArchitecture上のStructural Dependencyを複製したものではなく、後続Issueが必要とする具体的な実装成果を先に成立させるための実装順である。

次に着手する実装単位はReorder Mode baseline整合とし、その完了後に#585へ戻る。

## Implementation dependencies

- #585で共通Table structureの具体的なTypeを確定してから#571を実装する。
- #571で要求時点の共通Table structure取得経路を成立させてから#572を実装する。
- #572で移動対象解決結果と制約情報の具体的な表現を成立させてから#573を実装する。
- #573でdestination判定を成立させてから#574でDnD Interaction / Reorder Sessionへ統合する。
- #575は#574の確定済み並び替えと#571のTable Integration更新境界を接続する。
- #576 / #577以降は共通DnD経路が成立した状態を前提に統合する。
- #582 / #583は主要実装が揃った状態を前提にする。

## Decisions and validation questions

### Decide before implementation

- #585で、共通Table structureの具体的なTypeを確定する。
- #571で、Core Table / Flexible Table Blockから共通Table structureへ変換する具体的な方法と、対応Tableに適切なIntegrationを適用する実装方式を確定する。
- #572で、移動対象解決結果と制約情報の具体的なTypeを確定する。
- #574で、Reorder Sessionの具体的な状態表現を確定する。
- #578で、Architectureの表示要件を満たす具体的なDOM更新・アニメーション方式を確定する。

### Validate during implementation

- DnD開始試行時の共通Table structure生成と制約情報導出が想定最大規模で実用的か。
- DnD中のDrop Target ResolutionとReorder Presentationのどこが実測上のhot pathになるか。
- Presentationの更新範囲と実装方式が大規模Tableで実用的か。
- PC / タッチの入力を正式v1の共通DnD経路へ安定して接続できるか。
- Reorder Rediscoveryの具体的な実装値が通常編集と競合しないか。

## Issue breakdown

### Completed baseline

- [x] #547 Reorder v1 sourceの共通・行・列のモジュール境界を確定する。
- [x] #540 Editor DOM Contextを実装する。
- [x] #541 Reorder Modeを実装する。
- [x] #542 Reorder Constraint Resolutionを独立責務として実装しない方針で終了する。

### Required before resuming #585

- [ ] 新規Issue: Reorder Modeの現在sourceを更新後Architectureへbaseline整合する。
  - 既存ロジックは基本的に維持する。
  - sourceコメント、Contract説明、test前提に残る旧Architecture依存だけを最小限修正する。

### Existing Issues after the Architecture update

- [ ] #585 共通Table structureのTypeを確定する。
  - 維持する。
  - 着手時にIssue本文を現在のArchitectureと最新のType検討内容へ同期する。
- [ ] #571 Table Integrationを実装する。
  - 維持する。
- [ ] #572 Reorder Target Resolutionを実装する。
  - 維持する。
- [ ] #573 Drop Target Resolutionを実装する。
  - 維持する。
- [ ] #574 DnD InteractionとReorder Sessionを実装する。
  - 維持する。
- [ ] #575 Data Updateを実装する。
  - 維持する。
- [ ] #576 PC向けInput Interactionを実装する。
  - 維持する。
- [ ] #577 タッチ向けInput Interactionを実装する。
  - 維持する。
- [ ] #578 Reorder Presentationを実装する。
  - 維持する。実装時は更新後Architectureを入力とし、モード中の全対象表示という旧前提を持ち込まない。
- [ ] #579 Auto Scrollを実装する。
  - 維持する。
- [ ] #580 First-use Guidanceを実装する。
  - 維持する。
- [ ] #581 Reorder Rediscoveryを実装する。
  - 維持する。
- [ ] #582 大規模TableのPerformanceを検証・調整する。
  - 維持する。
- [ ] #583 Core TableとFlexible Table Blockの正式v1主要E2Eを完成させる。
  - 維持する。

Plan確定後、#539の実装順と「次に着手するIssue」の記述をこのPlanへ追随させる。Issue本文ではArchitectureやPlanを複製せず、そのIssue固有のscope、completion conditions、validationに留める。

## Validation

検証コマンドと環境は`docs/development/testing.md`を正本とする。

- 本Planの変更自体はdocumentation-onlyとして扱う。
- 各後続Issueでは、そのIssueで変更するファイルと実装内容に適用されるfocused test、Node.js checks、build、Playwright、Performance計測を選択する。
- WordPress / Gutenberg統合やmouse・touch・pointer操作を含む変更では、対応するPlaywright E2Eを実行する。
- Performance変更または大規模Tableに関する変更では、Architectureで定めた対象条件に従って計測する。

本Plan変更の手動検証はユーザーが実施する。

## Completion criteria

- Reorder Modeのbaseline整合後、#585から実装を再開できる順序になっている。
- #585から#583まで、後続Issueが必要とする実装成果に基づいた順序と実装依存が明確になっている。
- 更新後Architectureで変更されたTable Integration、Reorder Target Resolution、Drop Target Resolution、Reorder Session、Reorder Presentationの前提が実装順へ反映されている。
- Plan内にArchitectureの責務、Contract、Structural Dependency、Lifecycle、Invariantを重複定義していない。
- 既存Issueについて、維持するものと後続で本文同期が必要なものが整理されている。
- PlanとIssue構成に、更新前Architectureの前提を維持する実装順が残っていない。

## Notes

- #569で、当時確定していたArchitectureからPlanと#571〜#583のIssue構成を再構成した。
- #591 / PR #592によるArchitecture更新を受け、#593で再度実装順とIssue構成を追随させる。
- Editor DOM ContextとReorder Modeの状態管理ロジックは現在のbaselineとして維持する。
- Reorder Modeは後続実装前に旧Architecture前提だけを最小限整合する。
- #585をArchitecture更新後の実装再開地点とする。
- 過去のformal v1実装はGit履歴から、Prototypeの知見は`prototype-final` tagから参照する。