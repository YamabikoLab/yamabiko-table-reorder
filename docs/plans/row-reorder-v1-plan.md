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
- Source guidelines:
  - `src/AGENTS.md`
  - `src/reorder/AGENTS.md`
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

`Reorder Mode`と`Editor DOM Context`は既存実装を起点とし、現在のArchitectureとの適合を確認してからRow Reorderの未実装責務へ進む。

Row Reorderの未実装責務は、まずSupported Table Blockとの境界と行の判定・更新を成立させ、その上にDnD Session Lifecycleを構築する。次に表示、自動スクロール、PC / タッチ入力を接続する。外側のReorder Guidance境界を成立させた後、行側のRediscovery Detectionを接続する。

各段階では、その段階で成立した責務をfocused testで確認する。実装全体が接続された後に、Requirements / Design / Quality Requirementsに対する横断validationと主要E2Eを行う。

実装中にArchitectureの変更が必要になった場合は、その判断をPlanまたは実装Issueで確定せず、`docs/architecture/row-reorder-v1-architecture.md`へ戻して更新した後にPlanを追従させる。

## Architecture impact

このPlanは、確定済みの`docs/architecture/row-reorder-v1-architecture.md`を実装へ落とし込むものであり、Architecture自体の変更は予定しない。

実装判断を確定するために責務境界、状態所有、Contract、Lifecycle、Invariantの変更が必要になった場合は、その判断を実装側で行わずArchitectureへ戻す。Reorder GuidanceはArchitectureでRow Reorderの外側の境界として定義済みであり、このPlanではRow Reorderから必要となるその境界の実装・接続を実装単位として扱う。

## Decisions and validation questions

### Decide before implementation

以下はRequirements / Design / Architectureを変更しない範囲で、該当する実装Issueを開始する前に確定する。決定結果がArchitectureの責務境界、状態所有、Contract、Lifecycle、Invariantを変更する場合は、実装判断として確定せずArchitectureへ戻す。

1. **既存境界をそのまま利用できるか**
   - 現在の`Reorder Mode`と`Editor DOM Context`の公開API・状態モデル・テストが、確定済みArchitectureのContractとLifecycleをそのまま満たすか確認する。
   - 満たす場合は既存実装を前提として後続へ進み、満たさない場合はArchitectureを変えずに必要な実装修正を先行させる。

2. **Architecture責務をsourceへどう配置するか**
   - `src/reorder/row-reorder/`内で、Table Integration、Target Resolution、DnD Interaction、Data Update、Presentation、Auto Scroll、Input Interaction、Rediscovery Detectionをどのファイル・module境界へ対応させるか確定する。
   - Reorder GuidanceはRow Reorder外側の責務として、Row Reorder内部へ混在させない配置を確定する。
   - source構造は具体的責務を反映し、汎用的な`shared` / `utils` / `helpers`へ逃がさない。

3. **Table Integrationの具体的なType表現をどうするか**
   - Architectureが要求するTable同一性、現在の行構造、行更新境界、正常な不在・更新不能を、TypeScript上でどのTypeとResult表現にするか確定する。
   - Core Table / Flexible Table Blockの差を境界内で吸収し、後続責務へBlock固有表現を漏らさない具体的な変換境界を確定する。
   - 行制約判定に必要な情報を超えて、列方向のための共通Table表現を導入しない。

4. **DnD operationとSessionをTypeScriptでどう表現するか**
   - `start` / `progress` / `complete` / `cancel`のoperation APIと、その呼び出し経路を確定する。
   - idle / active、移動対象、Table同一性、最終有効移動先など、型で維持できる状態相関をどのstate modelで表現するか確定する。
   - 正常な不在・正常中止・外部環境変化と、内部Errorを具体的なType / Error経路でどう区別するか確定する。
   - operation boundaryとexecution boundaryが同じ共通中止経路へ合流する具体的なAPI境界を確定する。

5. **Reorder Presentationをどの描画境界で実現するか**
   - 移動対象、水平挿入線、周囲行の一時移動、移動不可理由を、TableデータをDnD中に更新せず表現する具体的な描画方式を確定する。
   - React component / hook、DOM要素、CSSによる表現の責務分担と、Editor context変更・DnD終了時のcleanup方法を確定する。
   - Architectureで定義された表示責務を越えて、共通案内状態やColumn Reorder表示を取り込まない。

6. **Auto Scrollをどの実行方式で制御するか**
   - active DnD中の現在位置から縦方向Auto Scrollを更新する具体的な実行方式と、Editor Scroll Areaを扱う境界を確定する。
   - 非同期callback等のexecution boundaryを利用する場合は、Errorを独自に記録・回復せずDnD Interactionの共通中止経路へ渡せる構成を確定する。

7. **PC / Touch入力を共通DnD operationへどう変換するか**
   - PCとタッチそれぞれについて、利用するbrowser eventとlistener lifecycle、DnD開始判定から`start` / `progress` / `complete` / `cancel`へ変換する具体的な経路を各Input Interaction Issueで確定する。
   - タッチではDnD開始前の通常スクロールを不必要に妨げないevent制御境界を確定する。
   - PC / Touch固有状態をDnD Sessionへ持ち込まない。

8. **Reorder Guidanceの状態をどの実装境界で保持するか**
   - ArchitectureとDesignで定義済みのPC / タッチごとの初回案内表示済み状態、共通入口案内状態、案内抑制状態を、どのWordPress / React側の状態境界で保持するか確定する。
   - 保存期間など利用者向け挙動の意味を新たに決める必要が生じた場合は、実装で補完せずDesign / Architectureへ戻す。
   - Rediscovery Detectionは行側の候補通知だけを行い、共通案内状態を所有しない接続APIを確定する。

### Validate during implementation

以下は実装結果、実ブラウザ、計測から確認できるため、実装を進めながら検証する。

1. **Editor lifecycleへの追従**
   - iframe / non-iframe、mount / unmount / remountを含む対象Editor環境で、入力listener、Presentation、Auto Scrollが古いDOM参照を保持せず現在のEditor contextへ追従できるか確認する。
   - Evidence: 対象WordPress環境でのfocused E2Eと、必要なlifecycle test。

2. **PC / Touch入力と通常編集の両立**
   - PCで通常のTable編集と行DnDが意図せず競合しないこと、タッチでDnD開始前の通常スクロールを不必要に妨げないことを確認する。
   - Evidence: 実browser inputを使ったPlaywright scenario。

3. **DnD表示とcleanup**
   - 移動対象、挿入線、周囲行の移動、移動不可理由がDesignどおり追跡でき、complete / cancel / 外部環境変化 / 内部Error recovery後にDnD中だけの表示が残らないことを確認する。
   - Evidence: Presentationのfocused testと主要E2E。

4. **外部環境変化とError recovery**
   - active DnD中のTable / Editor状態変化、complete時の再照合不成立、operation boundaryとexecution boundaryの内部Errorが、Architectureで定義されたそれぞれの終了経路へ合流することを確認する。
   - Evidence: 各failure / recovery pathのfocused test。

5. **対応Table Block間の同等性とUndo**
   - Core Table / Flexible Table Blockの双方で、同じRow Reorder flowが成立し、成立した一回の行並び替えが一回のUndo単位になることを確認する。
   - Evidence: focused integration testと主要E2E。

6. **QR-01 Performance**
   - Quality Requirementsの保証対象規模まで、DnD中のTarget Resolution、Presentation、Auto Scrollなどが利用者の操作を妨げる処理になっていないことを計測・確認する。
   - Evidence: 想定最大規模を含む代表Tableでの計測結果と実操作確認。固定数値を新しいRequirementとして追加しない。

7. **Guidance / Rediscoveryの実利用経路**
   - 初回案内と行側Rediscovery候補が通常編集を妨げず、外側のReorder Guidanceへ正しく接続されることを確認する。
   - Evidence: state-level focused testと主要E2E。

## Implementation phases

### Phase 1: Existing boundary alignment

- Outcome: `Reorder Mode`と`Editor DOM Context`を、確定済みArchitectureに適合する実装前提として利用できる。
- Tasks:
  - 現在の実装とArchitectureのContract / Lifecycleを照合する。
  - 実装修正が必要な場合だけ、Architectureを変更せず必要最小限の修正を行う。
- Validation:
  - 既存または修正後のfocused testで境界の成立を確認する。

### Phase 2: Table Integration

- Outcome: 後続責務が現在の対応Tableについて行並び替えに必要な情報を取得し、確定済み行移動の更新境界を利用できる。
- Tasks:
  - Row Reorder用Table Integrationを実装する。
  - Core Table / Flexible Table Blockとの差をこの境界で扱う。
  - 後続のTarget Resolution / Data Updateが利用するContractを実装する。
- Validation:
  - Table Integrationの正常系、正常な不在、対応Table Block差をfocused testで確認する。

### Phase 3: Reorder Target Resolution

- Outcome: DnD開始試行から、開始可能な移動対象または開始できない正常な結果を解決できる。
- Tasks:
  - Reorder Target Resolutionを実装する。
  - Phase 2のTable Integrationへ接続する。
- Validation:
  - 開始可能・開始不可の主要境界をfocused testで確認する。

### Phase 4: Drop Target Resolution

- Outcome: active DnD中の移動先判定と、complete時の現在構造への再照合を行える。
- Tasks:
  - Drop Target Resolutionを実装する。
  - Phase 2のTable Integrationへ接続する。
- Validation:
  - progress時の移動先判定とcomplete時の再照合をfocused testで確認する。
  - 外部Table状態変化による確定不能を正常な結果として確認する。

### Phase 5: Data Update

- Outcome: complete時に確定可能とされた行移動だけを対応Tableへ反映できる。
- Tasks:
  - Data Updateを実装する。
  - Phase 2のTable Integrationへ接続する。
- Validation:
  - 成立した更新、更新不能、Undo単位をfocused testで確認する。

### Phase 6: DnD Interaction

- Outcome: start / progress / complete / cancel、Session、正常中止、外部環境変化、内部Error recoveryを一つのRow Reorder Lifecycleとして扱える。
- Tasks:
  - DnD InteractionとSessionを実装する。
  - Phase 3 / 4 / 5の責務へ接続する。
  - operation boundaryと共通中止経路を実装する。
- Validation:
  - start / progress / complete / cancelのLifecycleをfocused testで確認する。
  - 正常な中止、外部環境変化、内部Error recoveryがそれぞれArchitectureどおりに終了することを確認する。

### Phase 7: Reorder Presentation

- Outcome: DnD Interactionの状態を、Row Reorderの利用者向け一時表示として表現・解除できる。
- Tasks:
  - Reorder Presentationを実装する。
  - DnD InteractionとEditor DOM Contextへ接続する。
- Validation:
  - DnD開始、移動先変更、移動不可、complete / cancel / abort時の表示状態をfocused testで確認する。

### Phase 8: Auto Scroll

- Outcome: activeな行DnDに必要な縦方向Auto Scrollを開始・更新・終了できる。
- Tasks:
  - Auto Scrollを実装する。
  - DnD InteractionとEditor DOM Contextへ接続する。
  - execution boundaryが必要な場合はDnD Interactionの共通中止経路へ接続する。
- Validation:
  - active Session中の開始・更新・終了と、execution boundaryからのfailure recoveryをfocused testで確認する。

### Phase 9: PC Input Interaction

- Outcome: PC入力をRow Reorderのstart / progress / complete / cancelへ接続できる。
- Tasks:
  - PC入力経路をInput Interactionとして実装する。
  - Reorder Mode、Editor DOM Context、DnD Interactionへ接続する。
- Validation:
  - 実ブラウザ入力が必要な部分はPlaywright、分離可能な状態変換はfocused unit testで確認する。

### Phase 10: Touch Input Interaction

- Outcome: タッチ入力をRow Reorderのstart / progress / complete / cancelへ接続できる。
- Tasks:
  - タッチ入力経路をInput Interactionとして実装する。
  - Reorder Mode、Editor DOM Context、DnD Interactionへ接続する。
- Validation:
  - 実ブラウザ入力と通常スクロールとの境界はPlaywright、分離可能な状態変換はfocused unit testで確認する。

### Phase 11: Reorder Guidance

- Outcome: ArchitectureでRow Reorder外側に定義された共通案内境界が成立し、Row Reorderから必要な接続を利用できる。
- Tasks:
  - Reorder Guidanceを実装する。
  - Reorder ModeとEditor DOM Contextへ接続する。
  - Designで定義された初回案内を表現する。
- Validation:
  - 初回案内状態とReorder Modeへの接続をfocused testで確認する。
  - 利用者向け初回案内の主要フローをPlaywrightで確認する。

### Phase 12: Rediscovery Detection

- Outcome: 通常編集時の行移動意図から行側の再案内候補を検出し、Reorder Guidanceへ通知できる。
- Tasks:
  - Rediscovery Detectionを実装する。
  - Reorder ModeとReorder Guidanceへ接続する。
- Validation:
  - 通常編集として成立する操作との境界と、行側候補通知をfocused testで確認する。
  - 再案内の主要フローをPlaywrightで確認する。

### Phase 13: Cross-cutting validation

- Outcome: Row Reorder v1の実装全体がRequirements / Design / Architecture / Quality Requirementsに対して整合していることを確認できる。
- Tasks:
  - Row Reorderの主要end-to-end flowを接続して確認する。
  - `QR-01`、`QR-02`、`QR-03`をRow Reorderについて横断検証する。
  - Core Table / Flexible Table Blockと対象Editor環境の主要E2Eを整備する。
- Validation:
  - focused test、Node.js / build checks、Playwright E2E、repository checkは`docs/development/testing.md`に従う。

## Issue breakdown

Planレビュー後、次の単位で実装Issueを作成する。各IssueはこのPlanと該当Architecture責務を参照し、Requirements / Design / Architectureの内容を本文へ複製しない。

- [ ] Existing Reorder Mode / Editor DOM Context alignment（source変更が必要な場合のみ）
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
- [ ] Row Reorder cross-cutting validation and E2E

実装順は上記Phase順を基本とし、後続Issueは必要な先行責務が成立してから開始する。Phase 1で既存境界のsource変更が不要と確認できた場合は、そのためだけのIssueは作成しない。独立して進められる後続責務がある場合でも、Architecture上の依存関係を変更する理由にはしない。

## Validation

- 各実装Issueで、責務単位のfocused testを追加・更新する。
- 実WordPress Editor、PC / タッチ入力、iframe / non-iframe、主要end-to-end flowはPlaywrightで確認する。
- 完成時にRow ReorderについてQuality Requirementsを横断検証する。
- 実行する具体的なコマンドと適用範囲は`docs/development/testing.md`を正本とする。

## Completion criteria

- Row Reorder v1 Architectureで定義された実装対象が、依存関係に沿ったレビュー可能なIssue単位で完成している。
- 実装開始前に確定が必要な実装判断が各該当Issueで解決されている。
- 実装中に検証する事項について、必要なevidenceが得られている。
- Requirements / Design / ArchitectureをPlanまたは実装で再定義していない。
- Column Reorder固有の状態・責務・内部仕様またはRow / Column共通Reorder抽象化へ依存していない。
- Row Reorderの主要フローとQuality Requirementsに対するvalidationが完了している。
- 実装中にArchitecture変更が必要になった場合、その変更がArchitectureへ先に反映され、Planが追従している。
