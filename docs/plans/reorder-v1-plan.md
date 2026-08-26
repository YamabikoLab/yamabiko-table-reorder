# PLAN-499: Reorder v1実装

## References

- Parent issue: #499
- Requirements: `docs/requirements/reorder-v1-requirements.md`
- Design: `docs/design/reorder-v1-design.md`
- Architecture: `docs/architecture/reorder-v1-architecture.md`

## Goal

正式v1のArchitectureを、依存関係に沿って小さくレビュー可能な実装単位へ分割し、Core TableとFlexible Table Blockの行・列DnDを段階的に実装できる状態にする。

## Scope

### Included

- 正式v1の行・列DnD実装
- PCとタッチ端末の入力対応
- 並び替えモード、初回案内、再案内
- 移動先判定、DnD中の表示、自動スクロール、確定時のデータ更新
- Core TableとFlexible Table Blockへの対応
- 大規模Tableを含む性能検証
- 正式v1の実際のWordPress / Gutenberg統合と入力操作のE2E検証

### Not included

- Keyboard操作、ドラッグを必要としない操作、focus、announcementなど、別要件として扱うアクセシビリティ実装
- Requirements、Design、Architectureの再定義

## Approach

- 実装は`src/AGENTS.md`に従う。
- Architectureで定義された責務を`src/`の実装モジュールへ対応付ける。
- Prototypeの実装は`prototype-final`を調査・比較のための参考資料としてのみ利用し、旧構造をそのまま復元しない。
- まずReorder基盤を成立させ、その上に入力、Presentation、自動スクロール、案内機能を順に接続する。
- 各PhaseでそのPhaseに適した検証を行い、後続Phaseが依存できる状態を確認してから進める。

## Implementation phases

各Phaseを原則として1つのGitHub Issueとして扱う。1 Issueとしてレビュー可能な範囲を超える場合だけ、そのPhase内で実装単位を分割する。

### Phase 1: Reorder基盤

- Outcome: 行・列に共通するReorder Sessionと確定更新の基盤が成立する。
- Tasks:
  - Reorder Modeを実装する。
  - DnD Interactionの共通Lifecycleを実装する。
  - Drop Target Resolutionを実装する。
  - Data Updateを実装し、Core TableとFlexible Table Blockの確定更新を接続する。
- Validation:
  - 行・列それぞれで有効な移動先だけが確定できることをJestで確認する。
  - キャンセルまたは無効な完了でデータ更新されないことを確認する。
  - 1回の成立した並び替えが1回のUndoで戻ることを実環境で確認する。

### Phase 2: 入力と基本DnD

- Outcome: PCとタッチ端末から共通Reorder Sessionを開始・進行・完了・キャンセルできる。
- Tasks:
  - Input Interactionを実装し、PCとタッチ端末の入力差を共通DnD進行へ接続する。
  - 行・列それぞれの開始対象と並び替え方向を実装する。
  - 通常編集状態ではDnDを開始しない入力境界を実装する。
- Validation:
  - 入力解釈とDnD開始境界のロジックをJestで確認する。
  - PCとタッチ端末の実入力から行・列DnDが成立することをPlaywrightで確認する。
  - 通常編集とDnD開始が競合しないことを実環境で確認する。

### Phase 3: DnD Presentation

- Outcome: 並び替えモード中とDnD中の視覚フィードバックが成立する。
- Tasks:
  - Reorder Presentationを実装する。
  - 並び替えモード中のDnD可能対象を表示する。
  - 移動対象、挿入線、移動先変更に伴う周囲の表示移動を実装する。
  - 確定時とキャンセル時の表示遷移を実装する。
- Validation:
  - 行・列それぞれで現在の有効な移動先が正しく表示されることを確認する。
  - DnD中にTableの実データ順序が変わらないことを確認する。
  - 無関係な行・列を一斉に表示更新しないことを確認する。

### Phase 4: 自動スクロール

- Outcome: 画面内に収まらないTableでも、行・列の移動方向に沿ってDnDを継続できる。
- Tasks:
  - Auto Scrollを実装する。
  - 行DnDでは縦方向、列DnDでは横方向の自動スクロールを実装する。
  - Presentationと自動スクロールを接続する。
- Validation:
  - 長いTableで行DnDの縦方向自動スクロールをPlaywrightで確認する。
  - 横に広いTableで列DnDの横方向自動スクロールをPlaywrightで確認する。
  - DnDしていない通常スクロールが制限されないことを確認する。

### Phase 5: 案内と再発見

- Outcome: 初回利用者と機能を忘れた利用者が並び替え入口を発見できる。
- Tasks:
  - First-use Guidanceを実装する。
  - PCとタッチ端末で独立した表示済み状態を扱う。
  - Reorder Rediscoveryを実装する。
  - 再案内候補となる操作の判定を実装する。
- Validation:
  - PCとタッチ端末それぞれの初回表示と終了条件をPlaywrightで確認する。
  - 一度だけの短いドラッグや通常編集では再案内しないことを確認する。
  - 同じ状況で再案内が過度に繰り返されないことを確認する。

### Phase 6: Performanceと統合検証

- Outcome: 正式v1全体が対応Tableと想定最大規模で実用的に利用できることを確認する。
- Tasks:
  - 400行以上、12列以上、または2,000セル以上の大規模Tableで主要DnD経路を計測する。
  - 最大1,000行・20列・20,000セルを想定した負荷で、操作中の全体走査、常駐状態、不要な表示更新を確認する。
  - 必要に応じて実装方式を調整する。ただしArchitecture変更が必要な場合は先にArchitectureを更新する。
  - Core TableとFlexible Table Blockの正式v1主要E2Eを揃える。
- Validation:
  - 行・列、PC・タッチ、Core Table・Flexible Table Blockの主要フローをPlaywrightで確認する。
  - 大規模TableでDnDの実用性を計測し、ボトルネックがArchitectureのPerformance制約に反していないことを確認する。

## Decisions and validation questions

### Decide before implementation

- Architectureで定義された各責務を`src/`内のどのモジュールへ対応付けるか。
- Architectureで定義されたCore TableとFlexible Table Blockの境界を、どの実装モジュールへ対応付けるか。
- Prototypeから参考にする実装知見と、正式v1では採用しない旧実装方式を区別する。

### Validate during implementation

- 大規模Tableで移動先判定とPresentation更新のどこが実測上のhot pathになるか。
- Presentationのアニメーションを実用的な性能で維持できる更新範囲と実装方式。
- Reorder Rediscoveryで通常編集を誤判定せず再案内を成立させる判定値。
- PCとタッチ端末でArchitectureのContractを維持しながら、入力固有の開始判定を安定して扱えるか。

## Validation

検証コマンドと環境は`docs/development/testing.md`に従う。

- DocumentationのみのPlan変更: `git diff --check origin/main...HEAD`
- TypeScript、CSSなどの実装変更: `npm test`、`npm run build`、repository check
- 実際のWordPress / Gutenberg統合やmouse・touch・pointer操作を含む変更: 対応するPlaywright E2E
- Expected result: 各PhaseのOutcomeとArchitectureのInvariantを維持した状態で、そのPhaseに必要な検証が成功する。

## Completion criteria

- Architectureで定義された正式v1の責務が実装されている。
- Core TableとFlexible Table Blockで、PC・タッチの行・列DnDが成立することをPlaywright E2Eで確認できている。
- DnD中のPresentation、自動スクロール、確定・キャンセル、Undoが設計どおり動作する。
- 初回案内と再案内が通常編集を妨げず成立する。
- 大規模Tableで正式v1のDnDを実用的に利用できることを検証できている。
- 実装から得た結果によってArchitecture変更が必要になった場合、その変更がPlanより先に反映されている。
