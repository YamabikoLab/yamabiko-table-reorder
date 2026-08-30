# PLAN-682: Row Reorder v1 implementation

## References

- Parent issue: #682
- Requirements:
  - `docs/requirements/reorder-v1-requirements.md`
  - `docs/requirements/reorder-v1-quality-requirements.md`
- Design:
  - `docs/design/reorder-v1-design.md`
  - `docs/design/row-reorder-v1-design.md`
- Architecture: `docs/architecture/row-reorder-v1-architecture.md`
- Source guidelines: `src/reorder/AGENTS.md`
- Validation: `docs/development/testing.md`

## Goal

確定済みのRow Reorder v1 Architectureを、レビュー可能な実装単位へ分け、依存関係に沿って実装・検証できる順序を定める。

## Scope

### Included

- Row Reorder v1 Architectureで定義済みの責務を実装するための順序と実装単位
- Row Reorderに必要な外側の境界との接続
- 各段階のfocused validationと、完成時の横断validation
- 実装Issueの分割

### Not included

- Requirements / Design / Architectureの再定義
- Column Reorder固有の実装
- Row / Column間の共通Reorder抽象化
- Accessibility Requirementsとして別途扱う機能
- Plan作成時点でArchitectureに存在しない仕様・責務・制約・実装判断の追加

## Approach

`Reorder Mode`と`Editor DOM Context`は現在の実装を前提とし、Row Reorderの未実装責務を依存先から順に実装する。

まずSupported Table Blockとの境界と行の判定・更新を成立させ、その上にDnD Session Lifecycleを構築する。次に表示、自動スクロール、PC / タッチ入力を接続し、最後にRediscovery DetectionとReorder Guidanceとの接続を完成させる。

各段階では、その段階で成立した責務をfocused testで確認する。実装全体が接続された後に、Requirements / Design / Quality Requirementsに対する横断validationと主要E2Eを行う。

実装中にArchitectureの変更が必要になった場合は、その判断をPlanまたは実装Issueで確定せず、`docs/architecture/row-reorder-v1-architecture.md`へ戻して更新した後にPlanを追従させる。

## Implementation phases

### Phase 1: Table Integration

- Outcome: 後続責務が現在の対応Tableについて行並び替えに必要な情報を取得し、確定済み行移動の更新境界を利用できる。
- Tasks:
  - Row Reorder用Table Integrationを実装する。
  - Core Table / Flexible Table Blockとの差をこの境界で扱う。
  - 後続のTarget Resolution / Data Updateが利用するContractを実装する。
- Validation:
  - Table Integrationの正常系、正常な不在、対応Table Block差をfocused testで確認する。

### Phase 2: Reorder Target Resolution

- Outcome: DnD開始試行から、開始可能な移動対象または開始できない正常な結果を解決できる。
- Tasks:
  - Reorder Target Resolutionを実装する。
  - Phase 1のTable Integrationへ接続する。
- Validation:
  - 開始可能・開始不可の主要境界をfocused testで確認する。

### Phase 3: Drop Target Resolution

- Outcome: active DnD中の移動先判定と、complete時の現在構造への再照合を行える。
- Tasks:
  - Drop Target Resolutionを実装する。
  - Phase 1のTable Integrationへ接続する。
- Validation:
  - progress時の移動先判定とcomplete時の再照合をfocused testで確認する。
  - 外部Table状態変化による確定不能を正常な結果として確認する。

### Phase 4: Data Update

- Outcome: complete時に確定可能とされた行移動だけを対応Tableへ反映できる。
- Tasks:
  - Data Updateを実装する。
  - Phase 1のTable Integrationへ接続する。
- Validation:
  - 成立した更新、更新不能、Undo単位をfocused testで確認する。

### Phase 5: DnD Interaction

- Outcome: start / progress / complete / cancel、Session、正常中止、外部環境変化、内部Error recoveryを一つのRow Reorder Lifecycleとして扱える。
- Tasks:
  - DnD InteractionとSessionを実装する。
  - Phase 2 / 3 / 4の責務へ接続する。
  - operation boundaryと共通中止経路を実装する。
- Validation:
  - start / progress / complete / cancelのLifecycleをfocused testで確認する。
  - 正常な中止、外部環境変化、内部Error recoveryがそれぞれArchitectureどおりに終了することを確認する。

### Phase 6: Reorder Presentation

- Outcome: DnD Interactionの状態を、Row Reorderの利用者向け一時表示として表現・解除できる。
- Tasks:
  - Reorder Presentationを実装する。
  - DnD InteractionとEditor DOM Contextへ接続する。
- Validation:
  - DnD開始、移動先変更、移動不可、complete / cancel / abort時の表示状態をfocused testで確認する。

### Phase 7: Auto Scroll

- Outcome: activeな行DnDに必要な縦方向Auto Scrollを開始・更新・終了できる。
- Tasks:
  - Auto Scrollを実装する。
  - DnD InteractionとEditor DOM Contextへ接続する。
  - execution boundaryが必要な場合はDnD Interactionの共通中止経路へ接続する。
- Validation:
  - active Session中の開始・更新・終了と、execution boundaryからのfailure recoveryをfocused testで確認する。

### Phase 8: PC Input Interaction

- Outcome: PC入力をRow Reorderのstart / progress / complete / cancelへ接続できる。
- Tasks:
  - PC入力経路をInput Interactionとして実装する。
  - Reorder Mode、Editor DOM Context、DnD Interactionへ接続する。
- Validation:
  - 実ブラウザ入力が必要な部分はPlaywright、分離可能な状態変換はfocused unit testで確認する。

### Phase 9: Touch Input Interaction

- Outcome: タッチ入力をRow Reorderのstart / progress / complete / cancelへ接続できる。
- Tasks:
  - タッチ入力経路をInput Interactionとして実装する。
  - Reorder Mode、Editor DOM Context、DnD Interactionへ接続する。
- Validation:
  - 実ブラウザ入力と通常スクロールとの境界はPlaywright、分離可能な状態変換はfocused unit testで確認する。

### Phase 10: Rediscovery Detection and Reorder Guidance integration

- Outcome: 行側の再案内候補検出と、Architectureで定義された外側のReorder Guidance境界との接続が成立する。
- Tasks:
  - Rediscovery Detectionを実装する。
  - Reorder Guidanceの必要な境界を実装または既存境界へ接続する。
  - Reorder Mode / Editor DOM Contextとの依存をArchitectureどおりに接続する。
- Validation:
  - 通常編集時の再案内候補検出とGuidanceへの接続をfocused testで確認する。
  - 利用者向け案内の主要フローはPlaywrightで確認する。

### Phase 11: Cross-cutting validation

- Outcome: Row Reorder v1の実装全体がRequirements / Design / Architecture / Quality Requirementsに対して整合していることを確認できる。
- Tasks:
  - Row Reorderの主要end-to-end flowを接続して確認する。
  - `QR-01`、`QR-02`、`QR-03`をRow Reorderについて横断検証する。
  - Core Table / Flexible Table Blockと対象Editor環境の主要E2Eを整備する。
- Validation:
  - focused test、Node.js / build checks、Playwright E2E、repository checkは`docs/development/testing.md`に従う。

## Issue breakdown

Planレビュー後、次の単位で実装Issueを作成する。各IssueはこのPlanと該当Architecture責務を参照し、Requirements / Design / Architectureの内容を本文へ複製しない。

- [ ] Table Integration
- [ ] Reorder Target Resolution
- [ ] Drop Target Resolution
- [ ] Data Update
- [ ] DnD Interaction and Session Lifecycle
- [ ] Reorder Presentation
- [ ] Auto Scroll
- [ ] PC Input Interaction
- [ ] Touch Input Interaction
- [ ] Rediscovery Detection and Reorder Guidance integration
- [ ] Row Reorder cross-cutting validation and E2E

実装順は上記Phase順を基本とし、後続Issueは必要な先行責務が成立してから開始する。独立して進められる後続責務がある場合でも、Architecture上の依存関係を変更する理由にはしない。

## Validation

- 各実装Issueで、責務単位のfocused testを追加・更新する。
- 実WordPress Editor、PC / タッチ入力、iframe / non-iframe、主要end-to-end flowはPlaywrightで確認する。
- 完成時にRow ReorderについてQuality Requirementsを横断検証する。
- 実行する具体的なコマンドと適用範囲は`docs/development/testing.md`を正本とする。

## Completion criteria

- Row Reorder v1 Architectureで定義された実装対象が、依存関係に沿ったレビュー可能なIssue単位で完成している。
- Requirements / Design / ArchitectureをPlanまたは実装で再定義していない。
- Column Reorder固有の状態・責務・内部仕様またはRow / Column共通Reorder抽象化へ依存していない。
- Row Reorderの主要フローとQuality Requirementsに対するvalidationが完了している。
- 実装中にArchitecture変更が必要になった場合、その変更がArchitectureへ先に反映され、Planが追従している。
