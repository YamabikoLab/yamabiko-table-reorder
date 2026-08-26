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

### Not included

- Keyboard操作、ドラッグを必要としない操作、focus、announcementなど、別要件として扱うアクセシビリティ実装
- Playwright E2Eの整備
- Requirements、Design、Architectureの再定義

## Approach

- 実装は`src/AGENTS.md`に従う。
- `src/`の正式v1実装をArchitectureの責務境界に沿って構築する。
- Prototypeの実装は`prototype-final`を調査・比較のための参考資料としてのみ利用し、旧構造をそのまま復元しない。
- まずDnDの共通進行と確定データ更新を成立させ、その上に入力方式、Presentation、自動スクロール、案内機能を接続する。
- 行と列はDnD Lifecycleとcommit/cancelの流れを共通化し、方向やTable構造の差を各境界へ閉じ込める。
- Core TableとFlexible Table Blockの差は共通DnD進行へ持ち込まず、対象Tableの構造取得と確定更新に必要な境界で扱う。
- DnD中は実データを更新せず、確定時に1回だけ更新する。大規模Tableでは操作中の処理対象を必要範囲へ限定する。
- 各PhaseでそのPhaseに適した検証を行い、後続Phaseが依存できる状態を確認してから進める。

## Implementation phases

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
  - Input Interactionを実装し、PCとタッチ端末の入力差を共通DnD進行から分離する。
  - 行・列それぞれの開始対象と並び替え方向を共通Contractへ接続する。
  - 通常編集状態ではDnDを開始しない境界を実装する。
- Validation:
  - PCとタッチ端末の入力解釈とDnD開始境界をJestで確認する。
  - 通常編集とDnD開始が競合しないことを確認する。

### Phase 3: DnD Presentation

- Outcome: 並び替えモード中とDnD中の視覚フィードバックが実データ更新と分離して成立する。
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
  - 行DnDでは縦方向、列DnDでは横方向だけを自動スクロール対象にする。
  - Presentationの表示範囲制約と自動スクロールを両立させる。
- Validation:
  - 長いTableで行DnDの縦方向自動スクロールを確認する。
  - 横に広いTableで列DnDの横方向自動スクロールを確認する。
  - DnDしていない通常スクロールが制限されないことを確認する。

### Phase 5: 案内と再発見

- Outcome: 初回利用者と機能を忘れた利用者が並び替え入口を発見できる。
- Tasks:
  - First-use Guidanceを実装する。
  - PCとタッチ端末で独立した表示済み状態を扱う。
  - Reorder Rediscoveryを実装する。
  - 通常編集を妨げず、並び替えを試みる操作の繰り返しだけを再案内候補として扱う。
- Validation:
  - 操作環境ごとの初回表示と終了条件を確認する。
  - 一度だけの短いドラッグや通常編集では再案内しないことを確認する。
  - 同じ状況で再案内が過度に繰り返されないことを確認する。

### Phase 6: Performanceと統合検証

- Outcome: 正式v1全体が対応Tableと想定最大規模で実用的に利用できることを確認する。
- Tasks:
  - 400行以上、12列以上、または2,000セル以上の大規模Tableで主要DnD経路を計測する。
  - 最大1,000行・20列・20,000セルを想定した負荷で、操作中の全体走査、常駐状態、不要な表示更新を確認する。
  - 必要に応じて実装方式を調整する。ただしArchitecture変更が必要な場合は先にArchitectureを更新する。
- Validation:
  - 大規模TableでDnDの実用性を計測し、ボトルネックがArchitectureのPerformance制約に反していないことを確認する。

## Decisions and validation questions

### Decide before implementation

- Architectureの各責務を`src/`内でどのモジュール境界へ割り当てるか。
- Core TableとFlexible Table Blockの構造取得・確定更新の差をどの実装境界で吸収するか。
- Prototypeから参考にする実装知見と、正式v1では採用しない旧実装方式を区別する。

### Validate during implementation

- 大規模Tableで移動先判定とPresentation更新のどこが実測上のhot pathになるか。
- Presentationのアニメーションを実用的な性能で維持できる更新範囲と実装方式。
- Reorder Rediscoveryで通常編集を誤判定せず再案内を成立させる判定値。
- PCとタッチ端末で共通Contractを維持したまま、入力固有の開始判定を安定して扱えるか。

## Issue breakdown

- [ ] Reorder Modeと共通Reorder Sessionを実装する
- [ ] Drop Target ResolutionとData Updateを実装する
- [ ] PC向けInput Interactionを実装する
- [ ] タッチ向けInput Interactionを実装する
- [ ] Reorder Presentationを実装する
- [ ] Auto Scrollを実装する
- [ ] First-use Guidanceを実装する
- [ ] Reorder Rediscoveryを実装する
- [ ] 大規模TableのPerformanceを検証・調整する

子Issueは本Planのレビュー後に作成し、実装順序または検証上の依存がある場合だけIssue間依存を設定する。

## Validation

検証コマンドと環境は`docs/development/testing.md`に従う。Playwright E2Eの整備は本Planの対象外とし、専用Issueで扱う。

- DocumentationのみのPlan変更: `git diff --check origin/main...HEAD`
- TypeScript、CSSなどの実装変更: `npm test`、`npm run build`、repository check
- Expected result: 各PhaseのOutcomeとArchitectureのInvariantを維持した状態で、そのPhaseに必要な検証が成功する。

## Completion criteria

- Architectureで定義された正式v1の責務が実装されている。
- Core TableとFlexible Table Blockで、PC・タッチの行・列DnDが成立する。
- DnD中のPresentation、自動スクロール、確定・キャンセル、Undoが設計どおり動作する。
- 初回案内と再案内が通常編集を妨げず成立する。
- 大規模Tableで正式v1のDnDを実用的に利用できることを検証できている。
- 実装から得た結果によってArchitecture変更が必要になった場合、その変更がPlanより先に反映されている。
