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

各段階では、その段階で成立した責務をfocused testで確認する。責務実装後はplugin-wide entry pointからWordPress Editorの製品経路へcompositionし、その接続が成立した状態でRequirements / Design / Quality Requirementsに対する横断validationと主要E2Eを行う。

実装中にArchitectureの変更が必要になった場合は、その判断をPlanまたは実装Issueで確定せず、`docs/architecture/row-reorder-v1-architecture.md`へ戻して更新した後にPlanを追従させる。

## Architecture impact

このPlanは、確定済みの`docs/architecture/row-reorder-v1-architecture.md`を実装へ落とし込むものであり、Architecture自体の変更は予定しない。

実装判断を確定するために責務境界、状態所有、Contract、Lifecycle、Invariantの変更が必要になった場合は、その判断を実装側で行わずArchitectureへ戻す。Reorder GuidanceはArchitectureでRow Reorderの外側の境界として定義済みであり、このPlanではRow Reorderから必要となるその境界の実装・接続を実装単位として扱う。

## Decisions and validation questions

### Decide before implementation

以下はRequirements / Design / Architectureを変更しない範囲で、記載したPhaseを開始する前に確定する。決定結果がArchitectureの責務境界、状態所有、Contract、Lifecycle、Invariantを変更する場合は、実装判断として確定せずArchitectureへ戻す。

1. **Phase 1開始前: 既存境界をそのまま利用できるか**
   - 現在の`Reorder Mode`と`Editor DOM Context`の公開API・状態モデル・テストが、確定済みArchitectureのContractとLifecycleをそのまま満たすか確認する。
   - 満たす場合は既存実装を前提としてPhase 2へ進み、満たさない場合はArchitectureを変えずに必要な実装修正をPhase 1で完了させる。

2. **Phase 2開始前: Architecture責務をsourceへどう配置するか**
   - `src/reorder/row-reorder/`内で、Table Integration、Target Resolution、DnD Interaction、Data Update、Presentation、Auto Scroll、Input Interaction、Rediscovery Detectionをどのファイル・module境界へ対応させるか確定する。
   - Reorder GuidanceはRow Reorder外側の責務として、Row Reorder内部へ混在させない配置を確定する。
   - source構造は具体的責務を反映し、汎用的な`shared` / `utils` / `helpers`へ逃がさない。

3. **Phase 2開始前: Table Integrationの具体的なType表現をどうするか**
   - Architectureが要求するTable同一性、現在の行構造、行更新境界、正常な不在・更新不能を、TypeScript上でどのTypeとResult表現にするか確定する。
   - Core Table / Flexible Table Blockの差を境界内で吸収し、後続責務へBlock固有表現を漏らさない具体的な変換境界を確定する。
   - 行制約判定に必要な情報を超えて、列方向のための共通Table表現を導入しない。

4. **Phase 3開始前: Reorder Target Resolutionの実装境界をどう表現するか**
   - DnD開始位置、現在のTable情報、移動可能な行、開始できない正常な理由をどのType / Resultとして表現するか確定する。
   - `rowspan`等による行単位の移動可否を、Table Integrationから受け取る情報からどの形で導出し、後続へ何を渡すか確定する。
   - Session開始後の状態やDrop Target Resolutionの責務を先取りしない。

5. **Phase 4開始前: Drop Target Resolutionの移動先をどう表現するか**
   - progress時の有効移動先と、現在は確定できない正常な結果をどのType / Resultで表現するか確定する。
   - complete時にSessionの最終有効移動先を現在構造へ再照合できるよう、移動先のidentityと再照合入力をどの形で維持するか確定する。
   - progress時の判定結果だけをcompleteの確定根拠にしないType / API境界とする。

6. **Phase 5開始前: Data UpdateをWordPressの更新へどう接続するか**
   - Table Integrationの更新境界を利用して、確定済み行移動を対象Blockへ一度だけ反映する具体的なWordPress data update経路を確定する。
   - 一回の成立した行並び替えを一回のUndo単位として維持できる更新方式を確定する。
   - 更新開始前の外部状態変化を正常な更新不能として返し、独自retry / rollbackを導入しない。

7. **Phase 6開始前: DnD operationとSessionをTypeScriptでどう表現するか**
   - `start` / `progress` / `complete` / `cancel`のoperation APIと、その呼び出し経路を確定する。
   - idle / active、移動対象、Table同一性、最終有効移動先など、型で維持できる状態相関をどのstate modelで表現するか確定する。
   - 正常な不在・正常中止・外部環境変化と、内部Errorを具体的なType / Error経路でどう区別するか確定する。
   - operation boundaryとexecution boundaryが同じ共通中止経路へ合流する具体的なAPI境界を確定する。

8. **Phase 7開始前: Reorder Presentationをどの描画境界で実現するか**
   - 移動対象、水平挿入線、周囲行の一時移動、移動不可理由を、TableデータをDnD中に更新せず表現する具体的な描画方式を確定する。
   - React component / hook、DOM要素、CSSによる表現の責務分担と、Editor context変更・DnD終了時のcleanup方法を確定する。
   - Architectureで定義された表示責務を越えて、共通案内状態やColumn Reorder表示を取り込まない。

9. **Phase 8開始前: Auto Scrollをどの実行方式で制御するか**
   - active DnD中の現在位置から縦方向Auto Scrollを更新する具体的な実行方式と、Editor Scroll Areaを扱う境界を確定する。
   - 非同期callback等のexecution boundaryを利用する場合は、Errorを独自に記録・回復せずDnD Interactionの共通中止経路へ渡せる構成を確定する。

10. **Phase 9開始前: PC入力をDnD operationへどう変換するか**
    - 利用するbrowser eventとlistener lifecycle、DnD開始判定から`start` / `progress` / `complete` / `cancel`へ変換する具体的な経路を確定する。
    - 通常編集との競合を避けながら、PC固有状態をDnD Sessionへ持ち込まない構成を確定する。

11. **Phase 10開始前: Touch入力をDnD operationへどう変換するか**
    - 利用するtouch / pointer系eventとlistener lifecycle、DnD開始判定から`start` / `progress` / `complete` / `cancel`へ変換する具体的な経路を確定する。
    - DnD開始前の通常スクロールを不必要に妨げないevent制御境界を確定する。
    - Touch固有状態をDnD Sessionへ持ち込まない。

12. **Phase 11開始前: Reorder Guidanceの状態をどの実装境界で保持するか**
    - ArchitectureとDesignで定義済みのPC / タッチごとの初回案内表示済み状態、共通入口案内状態、案内抑制状態を、どのWordPress / React側の状態境界で保持するか確定する。
    - 保存期間など利用者向け挙動の意味を新たに決める必要が生じた場合は、実装で補完せずDesign / Architectureへ戻す。
    - Reorder Modeとの接続と案内終了時の状態更新を、Row / Column固有状態を持ち込まず実現するAPI境界を確定する。

13. **Phase 12開始前: Rediscovery Detectionをどの判定方式で実現するか**
    - Designで定義された「同じ行付近で短時間に繰り返された行移動意図」を、通常編集、文字選択、通常スクロール等と区別する具体的な観測入力と短期状態を確定する。
    - 回数、時間幅、位置範囲など具体値が必要な場合は、Designの意味を変えない実装値として確定し、利用者向け仕様の追加が必要ならDesignへ戻す。
    - 成立時は行側の再案内候補だけをReorder Guidanceへ通知し、案内表示状態をRediscovery Detection側へ持たせない。

14. **Phase 13開始前: 各責務を製品経路へどうcompositionするか**
    - `src/index.tsx`をthin plugin-wide entry pointとして保ちながら、Phase 1〜12で成立した責務をどのcomposition boundaryで生成・接続・cleanupするか確定する。
    - WordPress Editorへ登録する具体的なAPIやReact境界を確定し、entry pointへ各責務の内部実装を持ち込まない。
    - Editor context変更、unmount / remount時に古い接続やDOM参照を残さず、重複登録を生じさせないlifecycleを実装方式として確定する。

15. **Phase 14開始前: 横断validationの実行単位をどう構成するか**
    - Requirements / Design / Architecture / Quality Requirementsのどの主要契約をfocused test、Playwright、計測で確認するかvalidation matrixを確定する。
    - Core Table / Flexible Table Block、PC / Touch、対象Editor環境について、重複を避けつつ保証範囲を確認できる代表scenarioを確定する。
    - 新しいRequirementや固定性能基準をvalidation都合で追加しない。

### Validate during implementation

以下は実装結果、実ブラウザ、計測から確認できるため、記載したPhaseで検証する。Phase 1〜12では製品compositionを前提としないfocused test / integration testまでを各Phaseの完了時evidenceとする。実WordPress Editorの製品経路を通るPlaywrightはPhase 13でcomposition成立後に開始し、Phase 14で主要flowを横断確認する。途中の検証結果が後続Phaseの実装方向・順序・Issue境界へ影響する場合はPlanを更新し、Architecture変更が必要ならArchitectureへ戻す。

1. **Phase 1: 既存境界のArchitecture適合**
   - `Reorder Mode` / `Editor DOM Context`が現在のArchitectureのContract / Lifecycleを満たし、後続Phaseの前提として利用できることを確認する。
   - Evidence: 既存または修正後のfocused test。
   - Phase 1完了条件として確認し、未解決のままPhase 2へ進めない。

2. **Phase 2 / 5、Phase 14で最終確認: 対応Table Block間の同等性とUndo**
   - Phase 2でCore Table / Flexible Table Blockから必要な現在情報を同じRow Reorder Contractへ適応できることを確認する。
   - Phase 5で成立した一回の行並び替えが一回のUndo単位になることを確認する。
   - Phase 14で双方のTable Blockについて主要end-to-end flowを再確認する。
   - Evidence: Phase 2 / 5のfocused integration testとPhase 14の主要E2E。

3. **Phase 4 / 6、Phase 14で最終確認: 外部Table状態変化とcomplete再照合**
   - progress後にTable状態が変化した場合、Phase 4のcomplete再照合が確定不能を正常な結果として返せることを確認する。
   - Phase 6でその結果がData Updateへ進まず共通中止経路へ合流することを確認する。
   - Phase 14で統合flowとして再確認する。
   - Evidence: Phase 4 / 6のfocused failure / recovery testとPhase 14の主要E2E。

4. **Phase 6、Phase 8で追加確認、Phase 14で最終確認: 内部Error recovery**
   - Phase 6でstart / progress / complete / cancelのoperation boundaryに伝播した内部Errorが一度だけ記録され、Sessionと一時状態を破棄してidleへ戻ることを確認する。
   - Phase 8で非同期callback等のexecution boundaryを利用する場合は、独自recoveryを持たず同じ共通中止経路へ合流することを確認する。
   - Phase 14で主要統合flowから安全に編集継続できることを再確認する。
   - Evidence: Phase 6 / 8の各failure / recovery pathのfocused testとPhase 14の必要なE2E。

5. **Phase 7、Phase 14で最終確認: DnD表示とcleanup**
   - 移動対象、挿入線、周囲行の移動、移動不可理由がDesignどおり追跡できることを確認する。
   - complete / cancel / 外部環境変化 / 内部Error recovery後にDnD中だけの表示が残らないことを確認する。
   - Evidence: Phase 7のPresentation focused testとPhase 14の主要E2E。

6. **Phase 7〜10、Phase 13、Phase 14で最終確認: Editor lifecycleへの追従**
   - iframe / non-iframe、mount / unmount / remountを含む対象Editor環境で、Presentation、Auto Scroll、PC / Touch入力listenerと製品compositionが古いDOM参照や接続を保持せず現在のEditor contextへ追従できるか確認する。
   - Phase 7〜10では各責務のlifecycleをfocused testで確認する。Phase 13でcomposition成立後に実entry pointを通る最小Playwright scenarioから製品経路の追従を確認し、Phase 14で主要flowとして再確認する。
   - Evidence: Phase 7〜10のlifecycle focused test、Phase 13の最小Playwright scenario、Phase 14の対象WordPress環境での代表Playwright scenario。

7. **Phase 8、Phase 14で最終確認: Auto Scrollの継続性と終了**
   - active Session中だけ必要な縦方向Auto Scrollが動作し、complete / cancel / abort / recoveryで終了することを確認する。
   - Editor Scroll Areaを利用できない状態を内部Errorとして扱わず、安全に終了できることを確認する。
   - Evidence: Phase 8のfocused testとPhase 14の実ブラウザでの主要scenario。

8. **Phase 9、Phase 13で製品経路確認、Phase 14で最終確認: PC入力と通常編集の両立**
   - Phase 9でPC入力の状態変換、listener lifecycle、Row Reorder operationへの接続をfocused testで確認する。
   - Phase 13でcomposition成立後、実browser inputが製品経路からRow Reorderへ到達できることを確認する。
   - Phase 14で通常のTable編集と行DnDが意図せず競合せず、行並び替えモード中だけRow Reorder operationへ接続される主要flowを再確認する。
   - Evidence: Phase 9のfocused test、Phase 13の実entry pointを通る最小Playwright scenario、Phase 14の実browser inputを使った代表Playwright scenario。

9. **Phase 10、Phase 13で製品経路確認、Phase 14で最終確認: Touch入力と通常スクロールの両立**
   - Phase 10でTouch入力の状態変換、listener lifecycle、DnD開始前後のevent制御境界をfocused testで確認する。
   - Phase 13でcomposition成立後、実browser inputが製品経路からRow Reorderへ到達できることを確認する。
   - Phase 14でDnD開始前の通常のTable / Editorスクロールを不必要に妨げず、DnD開始後だけRow Reorder operationとして進行できる主要flowを再確認する。
   - Evidence: Phase 10のfocused test、Phase 13の実entry pointを通る最小Playwright scenario、Phase 14の実browser inputを使った代表Playwright scenario。

10. **Phase 11 / 12、Phase 13で製品経路確認、Phase 14で最終確認: Guidance / Rediscoveryの実利用経路**
    - Phase 11で初回案内状態、Reorder Modeとの接続、終了時の状態更新をfocused testで確認する。
    - Phase 12で行側Rediscovery候補と通常編集との判定境界、Reorder Guidanceへの通知をfocused testで確認する。
    - Phase 13でcomposition成立後、初回案内と再案内が実entry pointから製品経路へ到達できることを確認する。
    - Phase 14で初回案内と再案内の主要flowを再確認する。
    - Evidence: Phase 11 / 12のstate-level focused test、Phase 13の最小Playwright scenario、Phase 14の主要E2E。

11. **Phase 13: 製品compositionの成立**
    - plugin-wide entry pointからRow Reorderの既存責務がWordPress Editorの実利用経路へ接続され、各責務のfocused実装だけで終わっていないことを確認する。
    - Editor context変更、unmount / remount後も重複登録や古い接続を残さず、必要なcleanupと再接続が成立することを確認する。
    - Evidence: composition boundaryのfocused integration testと、Phase 9〜12で実ブラウザ確認を保留した経路を含む実entry point経由の最小Playwright scenario。

12. **Phase 14: QR-01 Performance**
    - Quality Requirementsの保証対象規模まで、DnD中のTarget Resolution、Presentation、Auto Scrollなどが利用者の操作を妨げる処理になっていないことを計測・確認する。
    - Evidence: 想定最大規模を含む代表Tableでの計測結果と実操作確認。
    - 固定数値を新しいRequirementとして追加しない。

13. **Phase 14: QR-02 Compatibility**
    - 対象WordPress / Editor環境、iframe / non-iframe、Core Table / Flexible Table Blockについて、Row Reorderの主要flowが保証範囲内で成立することを確認する。
    - Evidence: Phase 14開始前に確定したvalidation matrixに基づくPlaywright / integration結果。

14. **Phase 14: QR-03 Reliability / Robustness**
    - 外部環境変化または内部Errorが発生してもTable / Editorを不正な状態にせず、Row Reorderを安全に終了し、その後も編集を継続できることを横断確認する。
    - Evidence: Phase 4 / 6 / 8で成立させたfailure / recovery testと主要E2E。

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
  - 分離可能な入力状態変換、listener lifecycle、DnD operationへの接続をfocused testで確認する。
  - 実WordPress Editorの製品経路を通る実browser inputはPhase 9の完了条件に含めず、Phase 13のcomposition成立後にPlaywrightで確認する。

### Phase 10: Touch Input Interaction

- Outcome: タッチ入力をRow Reorderのstart / progress / complete / cancelへ接続できる。
- Tasks:
  - タッチ入力経路をInput Interactionとして実装する。
  - Reorder Mode、Editor DOM Context、DnD Interactionへ接続する。
- Validation:
  - 分離可能な入力状態変換、listener lifecycle、DnD開始前後のevent制御境界をfocused testで確認する。
  - 実WordPress Editorの製品経路を通るTouch入力と通常スクロールとの境界はPhase 10の完了条件に含めず、Phase 13のcomposition成立後にPlaywrightで確認する。

### Phase 11: Reorder Guidance

- Outcome: ArchitectureでRow Reorder外側に定義された共通案内境界が成立し、Row Reorderから必要な接続を利用できる。
- Tasks:
  - Reorder Guidanceを実装する。
  - Reorder ModeとEditor DOM Contextへ接続する。
  - Designで定義された初回案内を表現する。
- Validation:
  - 初回案内状態、Reorder Modeへの接続、終了時の状態更新をfocused testで確認する。
  - 実WordPress Editorの製品経路を通る初回案内はPhase 11の完了条件に含めず、Phase 13のcomposition成立後にPlaywrightで確認する。

### Phase 12: Rediscovery Detection

- Outcome: 通常編集時の行移動意図から行側の再案内候補を検出し、Reorder Guidanceへ通知できる。
- Tasks:
  - Rediscovery Detectionを実装する。
  - Reorder ModeとReorder Guidanceへ接続する。
- Validation:
  - 通常編集として成立する操作との判定境界と、行側候補通知をfocused testで確認する。
  - 実WordPress Editorの製品経路を通る再案内はPhase 12の完了条件に含めず、Phase 13のcomposition成立後にPlaywrightで確認する。

### Phase 13: Product composition

- Outcome: Phase 1〜12で成立した責務が、plugin-wide entry pointからWordPress Editorの実利用経路へ接続され、製品として起動・終了できる。
- Tasks:
  - `src/index.tsx`をthin plugin-wide entry pointとして保ちながら、既存責務を生成・接続するcomposition boundaryを実装する。
  - WordPress Editorへの必要な登録を行い、各責務の内部実装をentry pointへ持ち込まない。
  - Editor context変更、unmount / remount時に必要なcleanupと再接続を成立させ、重複登録や古いDOM参照を残さない。
- Validation:
  - composition boundaryのfocused integration testで生成・接続・cleanupを確認する。
  - Phase 9〜12で保留した実ブラウザ確認を含め、実entry pointを通る最小のPlaywright scenarioでRow Reorderが製品経路へ接続されていることを確認する。

### Phase 14: Cross-cutting validation

- Outcome: Row Reorder v1の実装全体がRequirements / Design / Architecture / Quality Requirementsに対して整合していることを確認できる。
- Tasks:
  - Phase 13で製品経路へ接続済みのRow Reorder主要end-to-end flowを確認する。
  - PC / Touch入力、初回案内、Rediscoveryによる再案内を含むPhase 9〜12の主要実利用flowを横断確認する。
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
- [ ] Row Reorder product composition
- [ ] Row Reorder cross-cutting validation and E2E

実装順は上記Phase順を基本とし、後続Issueは必要な先行責務が成立してから開始する。Phase 1で既存境界のsource変更が不要と確認できた場合は、そのためだけのIssueは作成しない。Phase 9〜12のIssueは製品composition前に実行可能なfocused validationまでを完了条件とし、実WordPress Editorの製品経路を通るPlaywrightはPhase 13 / 14のIssueで扱う。独立して進められる後続責務がある場合でも、Architecture上の依存関係を変更する理由にはしない。

## Validation

- Phase 1〜12の各実装Issueでは、責務単位で製品composition前に実行可能なfocused test / integration testを追加・更新する。
- Phase 13でproduct compositionを成立させ、実entry pointを通る最小のPlaywright scenarioでPhase 9〜12を含む製品経路への到達を確認する。
- Phase 14で実WordPress Editor、PC / タッチ入力、iframe / non-iframe、初回案内 / 再案内、主要end-to-end flowをPlaywrightで横断確認する。
- 完成時にRow ReorderについてQuality Requirementsを横断検証する。
- 実行する具体的なコマンドと適用範囲は`docs/development/testing.md`を正本とする。

## Completion criteria

- Row Reorder v1 Architectureで定義された実装対象が、依存関係に沿ったレビュー可能なIssue単位で完成している。
- 各Phaseを開始する前に、そのPhaseに紐づく`Decide before implementation`が解決されている。
- `Validate during implementation`について、Phase 1〜12では製品composition前に実行可能なfocused evidenceが得られている。
- Phase 13で各責務がplugin-wide entry pointからWordPress Editorの製品経路へ接続され、実entry pointを通る最小のPlaywright scenarioによってPhase 9〜12で保留した製品経路への到達確認まで完了している。
- Phase 14でPC / Touch入力、初回案内 / 再案内を含む主要flowとQuality Requirementsの横断validationが完了している。
- Requirements / Design / ArchitectureをPlanまたは実装で再定義していない。
- Column Reorder固有の状態・責務・内部仕様またはRow / Column共通Reorder抽象化へ依存していない。
- Row Reorderの主要フローとQuality Requirementsに対するvalidationが完了している。
- 実装中にArchitecture変更が必要になった場合、その変更がArchitectureへ先に反映され、Planが追従している。