# PLAN-499: Reorder v1実装

## References

- Parent issue: #499
- Reconstruction issue: #532
- Requirements: `docs/requirements/reorder-v1-requirements.md`
- Design: `docs/design/reorder-v1-design.md`
- Architecture: `docs/architecture/reorder-v1-architecture.md`

## Goal

確定したReorder v1 Architectureを、Phase 1からの実装順序、レビュー可能な実装単位、検証方法、Issue分割へ落とし込み、Core TableとFlexible Table Blockの行・列DnDを段階的に実装できる状態にする。

## Scope

### Included

- 正式v1の行・列DnD実装
- Editor DOM Context、Reorder Mode、Reorder Constraint Resolutionの実装
- Reorder Target Resolution、Drop Target Resolutionの実装
- DnD Interactionと共通Reorder Sessionの実装
- PCとタッチ端末のInput Interaction実装
- Reorder Presentation、Auto Scrollの実装
- Core TableとFlexible Table BlockのData Update実装
- First-use Guidance、Reorder Rediscoveryの実装
- 大規模Tableを含むPerformance検証
- WordPress / Gutenberg統合と入力操作のE2E検証

### Not included

- Keyboard操作、ドラッグを必要としない操作、focus、announcementなど、別要件として扱うアクセシビリティ実装
- Requirements、Design、Architectureの再定義
- Architecture確定前に作成されたformal v1実装を前提とした継ぎ足し
- Prototypeの構造を正式v1へそのまま復元すること

## Approach

- 実装は`src/AGENTS.md`に従う。
- `docs/architecture/reorder-v1-architecture.md`を責務、Contract、Dependency、Lifecycle、Invariantの唯一のArchitecture入力として扱い、Planではそれらを再定義しない。
- Architectureで定義された責務を実装モジュールへ対応付けるが、Architecture上の責務名とソースファイルを機械的に1対1対応させることは前提にしない。
- Editor DOM Context、Reorder Mode、Reorder Constraint Resolutionを最初の実装基盤として成立させる。
- Reorder Target ResolutionとDrop Target Resolutionは、Reorder Constraint Resolutionの実装後に成立させる。
- DnD Interactionと共通Reorder Session、Data Updateは、対象判定と移動先判定の実装後に接続する。
- PC / タッチのInput Interaction、Reorder Presentation、Auto Scroll、案内機能は、共通DnD基盤へ段階的に接続する。
- Prototypeの実装は`prototype-final`を調査・比較の参考資料としてのみ利用し、旧構造を新しいsourceの前提にしない。
- Architecture確定前のformal v1実装はGit履歴から参照してよいが、そのPhase完了状態や実装構造を新Planへ引き継がない。
- 各Phaseは後続Phaseが依存できるレビュー可能なOutcomeを持ち、そのPhaseに適した自動テスト、実環境検証、または計測で実装結果を確認する。
- 実装中にArchitectureの変更が必要になった場合は、その判断をPlanで解決せずArchitectureへ戻して確定した後にPlanを追随させる。

## Implementation phases

### Phase 1: 共通基盤

- Outcome: 後続Phaseが利用できるEditor DOM Context、Reorder Mode、Reorder Constraint Resolutionの実装基盤が成立する。
- Tasks:
  - Editor DOM Contextを実装する。
  - Reorder Modeを実装する。
  - Reorder Constraint Resolutionを実装する。
  - ArchitectureのPerformance / Lifecycle条件を満たすため、制約情報の表現、再利用、無効化の実装方式を決定する。
- Validation:
  - Editor DOM Context、Reorder Mode、Reorder Constraint ResolutionがArchitectureで定義されたContract / Lifecycleを満たすことをJestと実環境で確認する。
  - Core TableとFlexible Table Blockについて、Architectureで定義された制約抽出結果をJestで確認する。
  - 制約情報の再利用・無効化方式と常駐データ量がArchitectureのPerformance条件を満たせる実装になっていることをレビューまたは計測で確認する。

### Phase 2: 移動対象判定と移動先判定

- Outcome: Reorder Target ResolutionとDrop Target Resolutionが独立した実装単位として成立する。
- Tasks:
  - Reorder Target Resolutionを実装する。
  - Drop Target Resolutionを実装する。
  - 両責務をReorder Constraint Resolutionへ接続する。
- Validation:
  - Architectureで定義されたReorder Target Resolution / Drop Target ResolutionのContract、Lifecycle、Dependency境界に従っていることをJestで確認する。
  - 行・列それぞれの判定結果がArchitectureで定義された規則と一致することをJestで確認する。
  - 判定処理の実装がArchitectureのPerformance条件に反する全体再解析を前提としていないことをレビューまたは計測で確認する。

### Phase 3: 共通DnD Sessionと確定更新

- Outcome: 入力方式に依存しないDnD Interactionと共通Reorder Session、Data Updateが一連の実装として成立する。
- Tasks:
  - DnD Interactionと共通Reorder Sessionを実装する。
  - Reorder Target Resolution、Drop Target Resolution、Data UpdateをArchitectureで定義された境界に従ってDnD Interactionへ接続する。
  - Core TableとFlexible Table BlockのData Update実装を接続する。
- Validation:
  - DnD InteractionとReorder SessionがArchitectureで定義されたLifecycle / Dependency境界を満たすことをJestで確認する。
  - Requirements / Designで定義された成立、キャンセル、確定更新、Undoの主要フローをJestまたは実環境で確認する。
  - Core TableとFlexible Table Blockの更新処理を共通DnD経路から利用できることを確認する。

### Phase 4: Input Interaction

- Outcome: PCとタッチ端末の入力実装が共通DnD Interactionへ接続される。
- Tasks:
  - Input Interactionの共通実装境界を決定する。
  - PC向け入力解釈を実装する。
  - タッチ向け入力解釈を実装する。
  - DOM / Web APIを利用する入力処理をEditor DOM Contextへ接続する。
- Validation:
  - Input InteractionがArchitectureで定義されたContract / Dependency境界を満たすことをJestで確認する。
  - PCとタッチ端末の主要入力フローがRequirements / Designどおり共通DnD経路へ接続されることをPlaywrightで確認する。
  - Editor DOM Contextを利用する入力実装が対応editor環境で成立することを実環境で確認する。

### Phase 5: Reorder Presentation

- Outcome: Reorder Presentationが共通DnD経路へ接続され、必要な視覚フィードバックが成立する。
- Tasks:
  - Reorder Presentationを実装し、DOM / Web API利用をEditor DOM Contextへ接続する。
  - 並び替えモード表示と移動不可フィードバックを実装する。
  - DnD中の移動対象、移動先、確定・キャンセルに対応する表示を実装する。
  - 大規模Tableでも実用的な表示更新範囲とアニメーション方式を決定する。
- Validation:
  - Requirements / Designで定義された主要な視覚フィードバックをPlaywrightまたは実環境で確認する。
  - Reorder PresentationがArchitectureで定義されたContract / Dependency / Lifecycle境界を満たすことをJestまたはレビューで確認する。
  - 表示更新の範囲と頻度がArchitectureのPerformance条件を満たせることを計測またはinstrumentationで確認する。

### Phase 6: Auto Scroll

- Outcome: Auto Scrollが共通DnD経路へ接続され、画面内に収まらないTableでも主要DnDを継続できる。
- Tasks:
  - Auto Scrollを実装し、DOM / Web API利用をEditor DOM Contextへ接続する。
  - DnD InteractionとReorder Presentationへ接続する。
  - スクロール開始領域、速度、更新頻度などの実装値を実環境で調整する。
- Validation:
  - 行・列DnDのAuto ScrollがRequirements / DesignとArchitectureで定義された条件に従って動作することをPlaywrightで確認する。
  - 通常操作との競合がないことを実環境で確認する。
  - Editor DOM Contextを利用するAuto Scroll実装が対応editor環境で成立することを確認する。

### Phase 7: 初回案内と再案内

- Outcome: First-use GuidanceとReorder Rediscoveryが正式v1の入力・表示実装へ接続される。
- Tasks:
  - First-use Guidanceを実装し、DOM / Web API利用をEditor DOM Contextへ接続する。
  - Reorder Rediscoveryを実装し、DOM / Web API利用をEditor DOM Contextへ接続する。
  - PC / タッチごとの状態保存、表示制御、抑制の実装方式を決定する。
- Validation:
  - Requirements / Designで定義された初回案内と再案内の主要フローをPlaywrightで確認する。
  - First-use GuidanceとReorder RediscoveryがArchitectureで定義されたContract / Lifecycle境界を満たすことをJestまたはレビューで確認する。
  - 通常編集や通常入力との競合がないことを実環境で確認する。

### Phase 8: Performanceと統合検証

- Outcome: 正式v1全体が対応Tableと想定最大規模で、Architectureの条件を満たしながら実用的に利用できることを確認する。
- Tasks:
  - Core TableとFlexible Table Blockについて、行・列、PC・タッチの主要E2Eを揃える。
  - 400行以上、12列以上、または2,000セル以上の大規模Tableで主要DnD経路を計測する。
  - 最大1,000行・20列・20,000セルを想定した負荷で、制約抽出、対象判定、移動先判定、Presentation更新、常駐状態を確認する。
  - hot path、全体走査、常駐データ量、表示更新範囲を計測またはinstrumentationで確認する。
  - 必要に応じて実装方式を調整する。ただしArchitecture変更が必要な場合は先にArchitectureを更新する。
- Validation:
  - 行・列、PC・タッチ、Core Table・Flexible Table Blockの主要フローをPlaywrightで確認する。
  - 大規模TableでDnDの実用性を計測し、ArchitectureのPerformance条件を満たすことを確認する。
  - Architectureで定義されたContract / Dependency / Lifecycle / Invariantが統合後も維持されていることをレビューする。

## Decisions and validation questions

### Decide before implementation

- Architectureで定義された各責務を`src/`内のどのモジュール境界へ対応付けるか。
- Core TableとFlexible Table Blockの構造取得・更新差を、Reorder Constraint ResolutionとData Updateの実装でどのように吸収するか。
- Editor DOM Contextへ渡す「現在のeditor contextに属する基準」を実装上どの値として表現するか。
- Reorder Constraint Resolutionの制約情報について、Architectureの条件を満たす再利用・無効化方式をどの実装で管理するか。
- Reorder Presentationの表示更新とアニメーションをどの実装方式で成立させるか。
- PrototypeおよびArchitecture確定前のformal v1実装から参考にする知見と、新しい正式v1では採用しない実装構造を区別する。

### Validate during implementation

- Editor lifecycleが変化する実環境で、Editor DOM Contextの実装方式が安定して機能するか。
- 大規模TableでReorder Constraint Resolutionの抽出コストと再利用方式が実用的か。
- DnD中のDrop Target ResolutionとReorder Presentationのどこが実測上のhot pathになるか。
- Presentationのアニメーションを実用的な性能で維持できる更新範囲と実装方式。
- Reorder Rediscoveryの実装値が通常編集と競合せず安定して機能するか。
- PCとタッチ端末で共通DnD経路へ安定して接続できる入力実装方式は何か。

## Issue breakdown

- [ ] Editor DOM Contextを実装する。
- [ ] Reorder Modeを実装する。
- [ ] Reorder Constraint Resolutionを実装する。
- [ ] Reorder Target Resolutionを実装する。
- [ ] Drop Target Resolutionを実装する。
- [ ] DnD Interactionと共通Reorder Sessionを実装する。
- [ ] Data Updateを実装し、Core TableとFlexible Table Blockの確定更新を接続する。
- [ ] PC向けInput Interactionを実装する。
- [ ] タッチ向けInput Interactionを実装する。
- [ ] Reorder Presentationのモード表示と移動不可フィードバックを実装する。
- [ ] Reorder PresentationのDnD表示と確定・キャンセル遷移を実装する。
- [ ] Auto Scrollを実装する。
- [ ] First-use Guidanceを実装する。
- [ ] Reorder Rediscoveryを実装する。
- [ ] 大規模TableのPerformanceを検証・調整する。
- [ ] Core TableとFlexible Table Blockの正式v1主要E2Eを完成させる。

子Issueは本Planのレビュー後に作成する。Issue間依存は、Architecture上の責務関係そのものを複製するためではなく、実装または検証の順序上必要な場合だけ設定する。

## Validation

検証コマンドと環境は`docs/development/testing.md`に従う。

- DocumentationのみのPlan変更: `git diff --check origin/main...HEAD`
- TypeScript、CSSなどの実装変更: `npm test`、`npm run build`、repository check
- 実際のWordPress / Gutenberg統合やmouse・touch・pointer操作を含む変更: 対応するPlaywright E2E
- Performance変更または大規模Tableに関する変更: 対象規模での計測とArchitectureのPerformance条件に対する確認
- Expected result: 各PhaseのOutcomeを満たし、Architectureで定義されたContract / Dependency / Lifecycle / Invariantを参照して必要な検証が成功する。

## Completion criteria

- 本PlanのPhaseとIssue breakdownに沿って、Architectureで定義された正式v1の責務が実装されている。
- Core TableとFlexible Table Blockについて、PC・タッチの行・列DnD主要フローがRequirements / Designどおり成立することをPlaywright E2Eで確認できている。
- Architectureで定義されたContract / Dependency / Lifecycle / Invariantを、対応するJest、Playwright、実環境確認、レビューで検証できている。
- 大規模Tableの計測を完了し、ArchitectureのPerformance条件を満たしている。
- 実装前に必要な実装レベルの決定事項が解消され、必要に応じてPlanの順序またはIssue breakdownへ反映されている。
- 実装からArchitecture変更の必要性が判明した場合、その変更がPlanより先にArchitectureへ反映されている。

## Notes

- 本Planは#532により、Architecture確定前のformal v1実装の進捗を引き継がず、確定ArchitectureからPhase 1以降を全面再構成したものである。
- 過去のformal v1実装はGit履歴から、Prototypeの知見は`prototype-final` tagから参照する。
