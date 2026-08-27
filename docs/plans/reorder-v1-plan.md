# PLAN-499: Reorder v1実装

## References

- Parent issue: #499
- Reconstruction issue: #532
- Requirements: `docs/requirements/reorder-v1-requirements.md`
- Design: `docs/design/reorder-v1-design.md`
- Architecture: `docs/architecture/reorder-v1-architecture.md`

## Goal

確定したReorder v1 Architectureを、責務間の依存関係に沿って小さくレビュー可能な実装単位へ分割し、Core TableとFlexible Table Blockの行・列DnDをPhase 1から段階的に再実装できる状態にする。

## Scope

### Included

- 正式v1の行・列DnD実装
- Editor DOM Contextを利用するDOM / Web API境界
- Reorder Modeと共通Reorder Session
- Table構造からの並び替え制約抽出と再利用
- DnD開始試行時の移動対象判定
- DnD開始後の移動先判定
- PCとタッチ端末の入力対応
- 並び替えモード中、移動不可時、DnD中、確定・キャンセル時のPresentation
- 行・列方向に応じたAuto Scroll
- 確定時のCore TableとFlexible Table Blockのデータ更新とUndo
- 初回案内と再案内
- 大規模Tableを含む性能検証
- WordPress / Gutenberg統合と入力操作のE2E検証

### Not included

- Keyboard操作、ドラッグを必要としない操作、focus、announcementなど、別要件として扱うアクセシビリティ実装
- Requirements、Design、Architectureの再定義
- Architecture確定前に作成されたformal v1実装を前提とした継ぎ足し
- Prototypeの構造を正式v1へそのまま復元すること

## Approach

- 実装は`src/AGENTS.md`に従う。
- `docs/architecture/reorder-v1-architecture.md`を実装順序と責務境界の唯一のArchitecture入力として扱う。
- Architectureで定義された責務を実装モジュールへ対応付けるが、Architecture上の責務名とソースファイルを機械的に1対1対応させることは前提にしない。
- DOM / Web APIを利用する責務より先にEditor DOM Contextを成立させ、利用側へiframe / non-iframe判定を持ち込まない。
- Reorder Target ResolutionとDrop Target Resolutionより先にReorder Constraint Resolutionを成立させ、Table構造解析を判定責務へ重複させない。
- DnD開始前の移動対象判定と、開始後の移動先判定を別の実装段階として成立させた上で、DnD Interactionへ接続する。
- Input InteractionはPC / タッチ固有差をそこで閉じ、DnD Interaction以降を共通処理として実装する。
- Reorder Presentation、Auto Scroll、案内機能などDOM / Web APIを利用する責務はEditor DOM Contextを経由して段階的に接続する。
- Tableデータ更新はDnD進行とPresentationから分離し、有効な移動先で完了した確定結果だけを反映する。
- Prototypeの実装は`prototype-final`を調査・比較の参考資料としてのみ利用し、旧構造を新しいsourceの前提にしない。
- Architecture確定前のformal v1実装はGit履歴から参照してよいが、そのPhase完了状態や実装構造を新Planへ引き継がない。
- 各Phaseは後続Phaseが依存できるレビュー可能なOutcomeを持ち、そのPhaseに適した自動テストまたは実環境検証で境界を確認する。
- 実装中にArchitectureの変更が必要になった場合は、その判断をPlanで解決せずArchitectureへ戻して確定した後にPlanを追随させる。

## Implementation phases

### Phase 1: 共通基盤

- Outcome: 後続の入力・表示・DnD判定が依存できるeditor context、並び替えモード、Table構造制約の基盤が成立する。
- Tasks:
  - Editor DOM Contextを実装する。
  - Reorder Modeを実装する。
  - Reorder Constraint Resolutionを実装し、Core TableとFlexible Table Blockから判定に必要な構造上の制約だけを抽出できるようにする。
  - 同じTable構造が有効な間は抽出済み制約情報を再利用し、構造変更後は以前の制約情報を無効にする実装境界を成立させる。
- Validation:
  - iframe / non-iframeの違いを利用側へ露出せず、現在のeditor lifecycleに対応するcontextを解決できることを確認する。
  - Reorder Modeで通常、行並び替え、列並び替えが同時に1つだけ成立することをJestで確認する。
  - 行では`rowspan`、列では`rowspan` / `colspan`に由来する必要な制約を抽出できることをJestで確認する。
  - 同じTable構造では制約情報を再利用し、並び替え確定、行列追加・削除、結合状態変更、Undo / Redoなどで構造が変化した後は古い情報を再利用しないことを確認する。
  - Table全体の並び替え用コピーやセル数に比例する常駐中間オブジェクトを実装前提にしていないことをレビューで確認する。

### Phase 2: 移動対象判定と移動先判定

- Outcome: DnD開始前の移動対象可否と、開始後の有効な移動先を、共通の制約情報から独立して判定できる。
- Tasks:
  - Reorder Target Resolutionを実装する。
  - 行では`rowspan`、列では`colspan`に基づく移動対象可否と移動不可理由を実装する。
  - Drop Target Resolutionを実装する。
  - 行DnDでは行間、列DnDでは列間について、Table構造を保てる移動先だけを返す判定を実装する。
- Validation:
  - Reorder Target ResolutionがDnD開始試行時の判定だけを扱い、モード中表示のための全対象事前判定を行わないことをJestで確認する。
  - 行では`colspan`だけ、列では`rowspan`だけを理由に移動不可にしないことを確認する。
  - Drop Target ResolutionがDnD開始後の移動先だけを扱い、開始対象可否を判定しないことを確認する。
  - Reorder Target ResolutionとDrop Target ResolutionがTable全体を直接解析せず、Reorder Constraint Resolutionの制約情報を利用することを確認する。

### Phase 3: 共通DnD Sessionと確定更新

- Outcome: 入力方式に依存しない共通Reorder Sessionが、開始可否、進行、完了、キャンセルと確定更新までをArchitectureどおり統括できる。
- Tasks:
  - DnD Interactionの共通Lifecycleを実装する。
  - 開始試行時にReorder Modeの方向と開始対象をReorder Target Resolutionへ渡し、移動可能な場合だけReorder Sessionを開始する。
  - activeなDnD中だけDrop Target Resolutionへ移動先判定を要求し、現在の有効な移動先と確定可能性を保持する。
  - Data Updateを実装し、Core TableとFlexible Table Blockの行・列更新を接続する。
  - 有効な移動先で完了した場合だけ確定結果を1回反映し、キャンセルまたは無効な完了では更新しない。
- Validation:
  - 移動不可な開始試行ではReorder Sessionを作らないことをJestで確認する。
  - DnD InteractionがReorder Constraint Resolutionへ直接依存しないことを確認する。
  - 行・列で共通のstart / progress / destination / commit / cancel Lifecycleが成立することをJestで確認する。
  - DnD中にTableデータが変更されず、有効な完了だけが1回更新されることを確認する。
  - 1回の成立した並び替えが1回のUndoで戻ることを実環境で確認する。

### Phase 4: Input Interaction

- Outcome: PCとタッチ端末の入力差をInput Interaction内で吸収し、共通DnD Interactionへ開始試行・進行・完了・キャンセルを渡せる。
- Tasks:
  - Input Interactionの共通境界を実装する。
  - PC向け入力解釈を実装する。
  - タッチ向け入力解釈を実装する。
  - DOM / Web APIを利用する入力処理をEditor DOM Contextへ接続する。
  - 通常編集状態ではDnD開始試行を成立させず、並び替え方向はInput InteractionではなくReorder ModeからDnD Interactionが取得する構成を維持する。
- Validation:
  - PCとタッチ固有の入力状態がDnD InteractionのContractへ漏れないことをJestで確認する。
  - Input Interactionが移動対象可否や移動先有効性を自身で判定しないことを確認する。
  - iframe / non-iframeをInput Interactionが直接判定しないことを確認する。
  - PCとタッチ端末の実入力から共通DnD開始・進行・完了・キャンセルへ接続できることをPlaywrightで確認する。
  - 通常編集とDnD開始試行が競合しないことを実環境で確認する。

### Phase 5: Reorder Presentation

- Outcome: 並び替えモード中、移動不可時、DnD中、確定・キャンセル時の視覚フィードバックがTableデータ更新から分離して成立する。
- Tasks:
  - Reorder Presentationを実装し、DOM / Web API利用をEditor DOM Contextへ接続する。
  - 並び替えモード中は現在方向の行または列を対象として表示する。
  - 移動不可な開始試行ではDnDを開始せず、DnD Interactionから受け取った理由を一時表示する。
  - DnD中の移動対象、行の水平挿入線、列の垂直挿入線を実装する。
  - 移動先変更時は実際に表示位置が変わる周囲の行・列だけを表示上移動させる。
  - 確定時とキャンセル時の表示遷移を実装する。
- Validation:
  - モード中の対象表示のためにReorder Target Resolutionを利用しないことを確認する。
  - 移動不可理由の表示でReorder Sessionを開始しないことを確認する。
  - 無効な移動先へ確定可能な挿入線を表示しないことを確認する。
  - DnD中にTableの実データ順序が変わらないことを確認する。
  - 移動先変更時に無関係な行・列を一斉に表示更新しないことを確認する。
  - iframe / non-iframeをPresentationが直接判定しないことを確認する。

### Phase 6: Auto Scroll

- Outcome: 画面内に収まらないTableでも、activeなDnDの方向に沿って並び替えを継続できる。
- Tasks:
  - Auto Scrollを実装し、DOM / Web API利用をEditor DOM Contextへ接続する。
  - 行DnDでは縦方向だけ、列DnDでは横方向だけを自動スクロール対象にする。
  - activeなDnD中だけ方向制約を適用し、通常状態や移動不可な開始試行には持ち込まない。
  - Reorder Presentationの表示範囲制約と組み合わせても必要な自動スクロールを妨げないよう接続する。
- Validation:
  - 長いTableで行DnDの縦方向自動スクロールをPlaywrightで確認する。
  - 横に広いTableで列DnDの横方向自動スクロールをPlaywrightで確認する。
  - 行DnDで横方向、列DnDで縦方向の自動スクロールを行わないことを確認する。
  - DnDしていない通常スクロールと移動不可な開始試行が方向制約を受けないことを確認する。
  - iframe / non-iframeをAuto Scrollが直接判定しないことを確認する。

### Phase 7: 初回案内と再案内

- Outcome: 初回利用者と機能を忘れた利用者が、通常編集を妨げられずに並び替え入口を発見できる。
- Tasks:
  - First-use Guidanceを実装し、DOM / Web API利用をEditor DOM Contextへ接続する。
  - PCとタッチ端末で独立した初回表示済み状態と表示契機を扱う。
  - Reorder Rediscoveryを実装し、DOM / Web API利用をEditor DOM Contextへ接続する。
  - 通常編集として成立しない並び替え試行候補の繰り返しだけから再案内を成立させる。
  - 同じ状況で再案内を過度に繰り返さない抑制を実装する。
- Validation:
  - PCとタッチ端末それぞれの初回表示契機、終了条件、表示済み状態をPlaywrightで確認する。
  - 初回案内と再案内が通常のセル編集、文字選択、通常スクロールを妨げないことを確認する。
  - 一度だけの短いドラッグでは再案内しないことを確認する。
  - 並び替えモード中は再案内判定を行わず、同じ状況で再案内が過度に繰り返されないことを確認する。
  - iframe / non-iframeを案内責務が直接判定しないことを確認する。

### Phase 8: Performanceと統合検証

- Outcome: 正式v1全体が対応Tableと想定最大規模でArchitectureの責務境界を保ちながら実用的に利用できることを確認する。
- Tasks:
  - Core TableとFlexible Table Blockについて、行・列、PC・タッチの主要E2Eを揃える。
  - 400行以上、12列以上、または2,000セル以上の大規模Tableで主要DnD経路を計測する。
  - 最大1,000行・20列・20,000セルを想定した負荷で、制約抽出、開始判定、移動先判定、Presentation更新、常駐状態を確認する。
  - 同じTable構造で制約情報が再利用され、開始試行や移動先変更ごとにTable全体を再解析していないことを計測またはinstrumentationで確認する。
  - DnD中の全体走査、セル数に比例する常駐Reorder状態、不要な表示更新が実用性を損なっていないことを確認する。
  - 必要に応じて実装方式を調整する。ただしArchitecture変更が必要な場合は先にArchitectureを更新する。
- Validation:
  - 行・列、PC・タッチ、Core Table・Flexible Table Blockの主要フローをPlaywrightで確認する。
  - 大規模TableでDnDの実用性を計測し、ボトルネックがArchitectureのPerformance制約に反していないことを確認する。
  - Architecture-wide invariantsと各責務のLifecycle境界が統合後も維持されていることをレビューする。

## Decisions and validation questions

### Decide before implementation

- Architectureで定義された各責務を`src/`内のどのモジュール境界へ対応付けるか。
- Core TableとFlexible Table Blockの構造取得・更新差を、Reorder Constraint ResolutionとData Updateの実装境界でどのように吸収するか。
- Editor DOM Contextへ渡す「現在のeditor contextに属する基準」を実装上どの値として表現するか。
- Reorder Constraint Resolutionが抽出済み制約情報の有効性を、実装上どのTable構造識別または変更検知で管理するか。
- PrototypeおよびArchitecture確定前のformal v1実装から参考にする知見と、新しい正式v1では採用しない実装構造を区別する。

### Validate during implementation

- Editor lifecycleが変化する実環境で、現在のcontextを必要な時点で安定して解決できるか。
- 大規模TableでReorder Constraint Resolutionの抽出コストと再利用方式が実用的か。
- DnD中のDrop Target ResolutionとReorder Presentationのどこが実測上のhot pathになるか。
- Presentationのアニメーションを実用的な性能で維持できる更新範囲と実装方式。
- Reorder Rediscoveryで通常編集を誤判定せず再案内を成立させる判定値。
- PCとタッチ端末でArchitectureのContractを維持しながら、入力固有の開始判定を安定して扱えるか。

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
- Performance変更または大規模Tableに関する変更: 対象規模での計測と、ArchitectureのPerformance制約に対する確認
- Expected result: 各PhaseのOutcomeとArchitectureのContract / Lifecycle / Invariantを維持した状態で、そのPhaseに必要な検証が成功する。

## Completion criteria

- Editor DOM Contextを含むArchitectureで定義された正式v1の責務が実装されている。
- DnD開始前の移動対象判定と、開始後の移動先判定が分離され、共通の制約情報を利用している。
- 同じTable構造が有効な間は制約情報を再利用し、構造変更後は以前の制約情報を再利用しない。
- PCとタッチ端末の入力差がInput Interaction内で閉じ、DnD Interaction以降が共通Lifecycleとして成立している。
- Core TableとFlexible Table Blockで、PC・タッチの行・列DnDが成立することをPlaywright E2Eで確認できている。
- DnD中のPresentation、自動スクロール、確定・キャンセル、UndoがArchitectureどおり動作する。
- 初回案内と再案内が通常編集を妨げず成立する。
- DOM / Web APIを利用する責務がiframe / non-iframeを直接判定せずEditor DOM Contextを利用している。
- 大規模Tableで正式v1のDnDを実用的に利用でき、ArchitectureのPerformance制約を維持している。
- 実装からArchitecture変更の必要性が判明した場合、その変更がPlanより先にArchitectureへ反映されている。

## Notes

- 本Planは#532により、Architecture確定前のformal v1実装の進捗を引き継がず、確定ArchitectureからPhase 1以降を全面再構成したものである。
- 過去のformal v1実装はGit履歴から、Prototypeの知見は`prototype-final` tagから参照する。
