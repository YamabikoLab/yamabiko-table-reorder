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

まず、Row Reorderの外側にあるReorder Modeを最新Architectureへ追従させる。Tableツールバー入口、排他状態、対象Tableとの関連付け、通常編集との排他、DnD終了後のモード継続判定を成立させ、Row Reorderへは対象Tableで行並び替えが有効であることだけを提供できる状態にする。Editor DOM Contextは現在のArchitectureとの適合を確認し、必要な場合だけ最小修正する。

次にRow Reorder内部を、Table Integration、Reorder Target Resolution、Drop Target Resolution、Data Update、DnD Interactionの順で成立させる。DnD Interactionでは正常終了、正常中止、外部環境変化、内部Error recoveryを同じSession Lifecycleへ統合し、終了後はReorder Modeへ継続可否だけを返せるようにする。

その上でReorder Presentation、Auto Scroll、PC / Touch Input Interactionを接続する。外側のReorder Guidanceと行側のRediscovery Detectionを成立させた後、plugin-wide entry pointから製品経路へcompositionし、最後にRequirements / Design / Architecture / Quality Requirementsに対する横断validationを行う。

各Phaseでは、その段階で成立する責務だけをfocused test / integration testで確認する。実WordPress Editorの製品経路を通るPlaywrightはproduct composition成立後に行う。

実装中にArchitectureの変更が必要になった場合はPlanまたは実装Issueで判断せず、Architectureを先に更新してからPlanを追従させる。

## Architecture impact

このPlanは、確定済みの`docs/architecture/row-reorder-v1-architecture.md`を実装へ落とし込むものであり、Architecture自体の変更は予定しない。

実装判断が責務境界、状態所有、Contract、Lifecycle、Invariantの変更を必要とする場合は、実装を進めずArchitectureへ戻す。

## Decisions and validation questions

### Decide before implementation

以下は、記載したPhaseを開始する前に実装レベルで確定する。上位文書の決定を変更する必要が生じた場合は、そのPhaseでは決定しない。

1. **Phase 1開始前: Reorder Modeをどの状態モデルとUI境界で実現するか**
   - `edit | row | column`と対象Table Identityの相関をTypeScript上でどう表現するか確定する。
   - Tableツールバーの入口、active状態、再選択、方向切替をどのReact / WordPress境界で接続するか確定する。
   - Toolbar componentのunmount / remountそのものでは状態を失わない所有位置を確定する。
   - `row | column`中に対象Tableの内容編集を開始させない具体的な接続方法を確定する。

2. **Phase 2開始前: Row Reorderのsource配置をどう対応付けるか**
   - `src/reorder/row-reorder/`内で、Table Integration、Target Resolution、DnD Interaction、Data Update、Presentation、Auto Scroll、Input Interaction、Rediscovery Detectionをどのmodule境界へ対応させるか確定する。
   - Reorder Mode、Reorder Guidance、Editor DOM ContextをRow Reorder内部へ混在させない。
   - 汎用的な`shared` / `utils` / `helpers`へ責務を逃がさない。

3. **Phase 2開始前: Table IntegrationのType / Result表現をどうするか**
   - Table同一性、現在の行構造、行更新境界、正常な不在・更新不能をTypeScript上でどう表現するか確定する。
   - Core Table / Flexible Table Blockの差を境界内で吸収し、後続責務へBlock固有表現を漏らさない。

4. **Phase 3開始前: Reorder Target Resolutionの結果をどう表現するか**
   - DnD開始位置、移動可能な行、開始できない正常な理由をType / Resultとしてどう表現するか確定する。
   - Session開始後の状態やDrop Target Resolutionの責務を先取りしない。

5. **Phase 4開始前: Drop Target Resolutionの移動先と再照合入力をどう表現するか**
   - progress時の有効移動先と、現在は確定できない正常な結果をどう表現するか確定する。
   - complete時に現在構造へ再照合できるidentity / input表現を確定する。

6. **Phase 5開始前: Data UpdateをWordPress更新へどう接続するか**
   - 確定済み行移動を対象Blockへ一度だけ反映する更新経路を確定する。
   - 一回の成立した行並び替えを一回のUndo単位として維持できる更新方式を確定する。
   - 更新不能時に独自retry / rollbackを導入しない。

7. **Phase 6開始前: DnD operation / Session / 終了結果をどう表現するか**
   - `start` / `progress` / `complete` / `cancel`のoperation APIとSession state modelを確定する。
   - 正常な不在、正常中止、外部環境変化、内部ErrorをType / Error経路で区別する。
   - operation boundaryとexecution boundaryを同じ共通中止経路へ合流させるAPIを確定する。
   - DnD終了後にReorder Modeへ渡す「現在のTableでモードを安全に継続できるか」の結果表現を確定する。

8. **Phase 7開始前: Reorder Presentationをどの描画境界で実現するか**
   - 移動対象、挿入線、周囲行の一時移動、移動不可理由、異常終了通知を、DnD中にTableデータを更新せず表現する具体方式を確定する。
   - React / DOM / CSSの責務分担とcleanup方法を確定する。

9. **Phase 8開始前: Auto Scrollをどの実行方式で制御するか**
   - active DnD中の現在位置から縦方向Auto Scrollを更新する方式を確定する。
   - execution boundaryが必要な場合は、独自recoveryを持たずDnD Interactionの共通中止経路へ渡せる構成にする。

10. **Phase 9開始前: PC入力をDnD operationへどう変換するか**
    - 利用するbrowser event、listener lifecycle、`start` / `progress` / `complete` / `cancel`への変換経路を確定する。
    - PC固有状態をDnD Sessionへ持ち込まない。

11. **Phase 10開始前: Touch入力をDnD operationへどう変換するか**
    - 利用するtouch / pointer系event、listener lifecycle、DnD operationへの変換経路を確定する。
    - DnD開始前の通常スクロールを不必要に妨げないevent制御境界を確定する。

12. **Phase 11開始前: Reorder Guidanceをどの状態境界で保持するか**
    - 初回案内表示済み状態、共通入口案内状態、案内抑制状態をどのWordPress / React側の状態境界で保持するか確定する。
    - 保存期間など利用者向け意味の追加が必要ならDesign / Architectureへ戻す。

13. **Phase 12開始前: Rediscovery Detectionをどの判定方式で実現するか**
    - 通常編集、文字選択、通常スクロール等と区別する観測入力と短期状態を確定する。
    - 回数、時間幅、位置範囲などが必要な場合はDesignの意味を変えない実装値として扱う。

14. **Phase 13開始前: 各責務を製品経路へどうcompositionするか**
    - `src/index.tsx`をthin entry pointとして保ち、各責務を生成・接続・cleanupするcomposition boundaryを確定する。
    - Editor context変更、unmount / remountで古い接続やDOM参照を残さない構成を確定する。

15. **Phase 14開始前: 横断validationをどう構成するか**
    - Requirements / Design / Architecture / Quality Requirementsの主要契約をfocused test、Playwright、計測のどこで確認するかvalidation matrixを確定する。
    - Core Table / Flexible Table Block、PC / Touch、対象Editor環境を重複なく確認する代表scenarioを確定する。

### Validate during implementation

1. **Phase 1: Reorder ModeとEditor DOM Contextの成立**
   - 行・列入口の排他、同じ入口の再選択、方向切替、対象Tableとの関連付け、別Tableへの移動、編集抑制を確認する。
   - Toolbar componentのunmount / remountだけではモードが終了しないことを確認する。
   - Editor DOM Contextが現在のArchitectureを満たすことを確認する。
   - Evidence: focused state / React integration test。

2. **Phase 2 / 5、Phase 14で最終確認: 対応Table Block間の同等性とUndo**
   - Phase 2でCore Table / Flexible Table Blockを同じRow Reorder Contractへ適応できることを確認する。
   - Phase 5で成立した一回の行並び替えが一回のUndo単位になることを確認する。
   - Evidence: focused integration testとPhase 14の主要E2E。

3. **Phase 4 / 6、Phase 14で最終確認: complete再照合と外部状態変化**
   - progress後にTable状態が変わった場合、complete再照合が確定不能を正常な結果として返すことを確認する。
   - Data Updateへ進まず共通中止経路へ合流することを確認する。
   - Evidence: focused failure / recovery testと主要E2E。

4. **Phase 6 / 1、Phase 14で最終確認: DnD終了後のReorder Mode**
   - complete、cancel、成立しないdropだけでは`row`を終了しないことを確認する。
   - DnD継続不能後も現在のTableでモードを継続可能なら`row`を維持し、モード自体を継続できない場合だけ`edit`へ戻ることを確認する。
   - Evidence: DnD InteractionとReorder Modeのfocused integration test、主要E2E。

5. **Phase 6 / 8、Phase 14で最終確認: 内部Error recovery**
   - operation boundaryへ伝播した内部Errorが一度だけ記録され、Sessionと一時状態を破棄してidleへ戻ることを確認する。
   - execution boundaryが必要な場合は独自recoveryを持たず同じ共通中止経路へ合流することを確認する。
   - Evidence: failure / recovery focused test。

6. **Phase 7、Phase 14で最終確認: DnD表示、通知、cleanup**
   - DnD表示が状態に追従し、complete / cancel / abort / recovery後に残らないことを確認する。
   - cancel / 成立しないdropでは異常終了通知を表示せず、安全な操作継続不能による終了時だけDesignで定義された通知を表示することを確認する。
   - Evidence: Presentation focused testと主要E2E。

7. **Phase 7〜10、Phase 13、Phase 14で最終確認: Editor lifecycleへの追従**
   - iframe / non-iframe、mount / unmount / remountで古いDOM参照、listener、接続を残さないことを確認する。
   - Evidence: lifecycle focused test、composition test、代表Playwright scenario。

8. **Phase 8、Phase 14で最終確認: Auto Scroll**
   - active Session中だけ縦方向Auto Scrollが動作し、complete / cancel / abort / recoveryで終了することを確認する。
   - Evidence: focused testと実ブラウザscenario。

9. **Phase 9 / 10、Phase 13 / 14で最終確認: PC / Touch入力**
   - 各入力の状態変換とlistener lifecycleをfocused testで確認する。
   - composition後に実browser inputが製品経路からRow Reorderへ到達することを確認する。
   - TouchではDnD開始前の通常スクロールを不必要に妨げないことを確認する。

10. **Phase 11 / 12、Phase 13 / 14で最終確認: Guidance / Rediscovery**
    - 初回案内状態と行側Rediscovery候補通知をfocused testで確認する。
    - composition後に初回案内と再案内が製品経路で成立することを確認する。

11. **Phase 14: Quality Requirements**
    - Performance、Compatibility、Reliability / RobustnessをRequirementsで定義された保証範囲に対して確認する。
    - 固定数値や新しいRequirementをvalidation都合で追加しない。

## Implementation phases

### Phase 1: Reorder Mode foundation

- Outcome: Tableツールバー入口とReorder Modeの状態・対象Table scopeが最新Architectureに適合し、Row Reorderへ「対象Tableで行並び替えが有効」であることだけを提供できる。
- Tasks:
  - 既存Reorder Modeを最新Architectureへ追従する。
  - Tableツールバーの行・列入口とReorder Modeを接続する。
  - 対象Tableとの関連付け、通常編集との排他、モード切替・終了を実装する。
  - Editor DOM Contextの既存実装を照合し、必要な場合だけ最小修正する。
- Validation:
  - Reorder Modeの状態遷移、Table scope、Toolbar lifecycle、編集抑制をfocused testで確認する。

### Phase 2: Table Integration

- Outcome: 後続責務が現在の対応Tableについて行並び替えに必要な情報と更新境界を利用できる。
- Tasks:
  - Row Reorder用Table Integrationを実装する。
  - Core Table / Flexible Table Blockとの差をこの境界で扱う。
- Validation:
  - 正常系、正常な不在、対応Table Block差をfocused testで確認する。

### Phase 3: Reorder Target Resolution

- Outcome: DnD開始試行から、開始可能な移動対象または開始できない正常な結果を解決できる。
- Tasks:
  - Reorder Target Resolutionを実装し、Table Integrationへ接続する。
- Validation:
  - 開始可能・開始不可の主要境界をfocused testで確認する。

### Phase 4: Drop Target Resolution

- Outcome: active DnD中の移動先判定とcomplete時の現在構造への再照合を行える。
- Tasks:
  - Drop Target Resolutionを実装し、Table Integrationへ接続する。
- Validation:
  - progress時の移動先判定、complete時の再照合、外部状態変化による確定不能をfocused testで確認する。

### Phase 5: Data Update

- Outcome: complete時に確定可能とされた行移動だけを対応Tableへ反映できる。
- Tasks:
  - Data Updateを実装し、Table Integrationへ接続する。
- Validation:
  - 成立した更新、更新不能、Undo単位をfocused testで確認する。

### Phase 6: DnD Interaction

- Outcome: start / progress / complete / cancel、Session、正常中止、外部環境変化、内部Error recovery、Reorder Mode継続判定への接続を一つのLifecycleとして扱える。
- Tasks:
  - DnD InteractionとSessionを実装する。
  - Phase 3 / 4 / 5へ接続する。
  - operation boundaryと共通中止経路を実装する。
  - DnD終了後のモード継続可否をPhase 1のReorder Modeへ接続する。
- Validation:
  - 正常Lifecycle、外部環境変化、内部Error recovery、終了後のモード維持 / 終了をfocused testで確認する。

### Phase 7: Reorder Presentation

- Outcome: DnD Interactionの状態を行並び替えの一時表示として表現し、終了時に適切に解除・通知できる。
- Tasks:
  - Reorder Presentationを実装し、DnD InteractionとEditor DOM Contextへ接続する。
- Validation:
  - DnD表示、移動不可、cleanup、異常終了通知の境界をfocused testで確認する。

### Phase 8: Auto Scroll

- Outcome: activeな行DnDに必要な縦方向Auto Scrollを開始・更新・終了できる。
- Tasks:
  - Auto Scrollを実装し、DnD InteractionとEditor DOM Contextへ接続する。
- Validation:
  - 開始・更新・終了とexecution boundaryのfailure recoveryをfocused testで確認する。

### Phase 9: PC Input Interaction

- Outcome: PC入力をRow ReorderのDnD operationへ接続できる。
- Tasks:
  - PC入力経路をInput Interactionとして実装し、Reorder Mode、Editor DOM Context、DnD Interactionへ接続する。
- Validation:
  - 入力状態変換、listener lifecycle、operation接続をfocused testで確認する。

### Phase 10: Touch Input Interaction

- Outcome: タッチ入力をRow ReorderのDnD operationへ接続できる。
- Tasks:
  - タッチ入力経路をInput Interactionとして実装し、Reorder Mode、Editor DOM Context、DnD Interactionへ接続する。
- Validation:
  - 入力状態変換、listener lifecycle、DnD開始前後のevent制御をfocused testで確認する。

### Phase 11: Reorder Guidance

- Outcome: Row Reorder外側の共通案内境界が成立し、Row Reorderから必要な接続を利用できる。
- Tasks:
  - Reorder Guidanceを実装し、Reorder ModeとEditor DOM Contextへ接続する。
- Validation:
  - 初回案内状態、Reorder Modeへの接続、終了時状態更新をfocused testで確認する。

### Phase 12: Rediscovery Detection

- Outcome: 通常編集時の行移動意図から行側の再案内候補を検出し、Reorder Guidanceへ通知できる。
- Tasks:
  - Rediscovery Detectionを実装し、Reorder ModeとReorder Guidanceへ接続する。
- Validation:
  - 通常編集との判定境界と候補通知をfocused testで確認する。

### Phase 13: Product composition

- Outcome: Phase 1〜12の責務がplugin-wide entry pointからWordPress Editorの実利用経路へ接続される。
- Tasks:
  - `src/index.tsx`をthin entry pointとして保ちながらcomposition boundaryを実装する。
  - Editor context変更、unmount / remount時のcleanupと再接続を成立させる。
- Validation:
  - focused integration testと、実entry pointを通る最小Playwright scenarioで製品経路を確認する。

### Phase 14: Cross-cutting validation

- Outcome: Row Reorder v1全体がRequirements / Design / Architecture / Quality Requirementsに整合していることを確認できる。
- Tasks:
  - Reorder Modeを含む主要end-to-end flowを確認する。
  - PC / Touch入力、初回案内、Rediscovery、異常終了回復を横断確認する。
  - Core Table / Flexible Table Blockと対象Editor環境の主要E2Eを整備する。
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

- 各実装Issueでは、そのPhaseで成立する責務をfocused test / integration testで確認する。
- Phase 13でproduct compositionを成立させ、実entry pointを通る最小Playwright scenarioを実行する。
- Phase 14で実WordPress Editor、PC / Touch入力、対象Editor環境、対応Table Block、案内、異常終了回復を横断確認する。
- 具体的なコマンドと適用範囲は`docs/development/testing.md`を正本とする。

## Completion criteria

- 最新Row Reorder v1 Architectureの実装対象が、依存関係に沿ったレビュー可能なIssue単位へ分割されている。
- Reorder ModeのToolbar / Table scope / Lifecycleが最初の実装Phaseとして反映されている。
- 各Phase開始前に、そのPhaseに紐づく`Decide before implementation`が解決される構成になっている。
- `Validate during implementation`が該当Phaseとevidenceへ結び付いている。
- DnD終了後のReorder Mode維持 / 終了、異常終了通知、Toolbar lifecycleがvalidation対象に含まれている。
- Requirements / Design / ArchitectureをPlanで再定義していない。
- Column Reorder固有の内部実装またはRow / Column共通Reorder抽象化へ依存していない。
- 実装中にArchitecture変更が必要になった場合、Architectureを先に更新してからPlanを追従させる。
