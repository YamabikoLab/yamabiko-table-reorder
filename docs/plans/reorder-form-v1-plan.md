# PLAN-898: Reorder Form v1 implementation

## References

- Parent issue: #898
- Requirements:
  - `docs/requirements/reorder-form-v1-requirements.md`
  - `docs/requirements/reorder-v1-requirements.md`
  - `docs/requirements/reorder-v1-quality-requirements.md`
- Design:
  - `docs/design/reorder-form-v1-design.md`
  - `docs/design/reorder-v1-design.md`
- Architecture: `docs/architecture/reorder-form-v1-architecture.md`
- Related architecture issue: #927
- Plan guidelines:
  - `docs/plans/AGENTS.md`
  - `docs/plans/TEMPLATE.md`
- Source guidelines:
  - `src/AGENTS.md`
  - `src/reorder/AGENTS.md`
- Validation: `docs/development/testing.md`

## Goal

確定済みのReorder Form（RF）v1 Architectureを、現在の`main`に存在するRow / Column Reorder実装を適切に再利用しながら、レビュー可能な実装単位へ分け、依存関係に沿って実装・検証できる順序を定める。

RFはDnDの補助機能として実装せず、一つのフォーム入口と入力Lifecycleを持つ独立した並び替え手段として実装する。一方で、Table構造の解釈、構造診断、更新対象セル数算出、確定更新、Reorder Apply Policy、およびWordPress側の大規模反映表示は、Architectureで定義された既存責務境界を拡張または再利用する。

## Scope

### Included

- Reorder Form v1 Architectureを実装するための実装順序とIssue単位
- RF Interaction、RF Input Interpretation、Row RF Resolution、Column RF Resolution、RF Apply Coordinationの新規実装
- Row / Column Table IntegrationをRF ArchitectureのContractまで拡張する実装
- 結合セルによる構造拒否について、RFとDnDで再利用できる方向固有の構造診断情報をTable Integration / Resolution境界へ追加する実装
- Column RF入力に必要な論理列Identity、列番号、利用可能な見出し表示値の取得
- Reorder Apply Policyの既存実装再利用
- WordPress Reorder IntegrationへのRFツールバー入口、Popover入力画面、Reorder Modeとの排他接続
- WordPress Reorder Apply IntegrationをRF Apply Coordinationへ接続する拡張
- Reorder GuidanceへRF入口選択を既存共通案内の終了条件として追加する実装
- Core Table / Flexible Table Block、iframe / non-iframe、Row / Column、結合セル、no-op、Undo、通常反映、確認付き大規模反映、失敗復帰を含む横断validation
- RFが追加する入力解釈、構造解決、経路選択、Lifecycle管理の性能確認

### Not included

- Requirements / Design / Architectureの再定義
- RFを`edit | row | column` Reorder Modeへ`form`として追加する変更
- RFから既存DnD Interaction / DnD Sessionを経由してTableを更新する実装
- Row / Column DnD固有処理を新しいshared reorder abstractionへ統合する変更
- 既存Row / Column `reorder-apply.ts`をRFから名前だけで流用する変更
- Keyboardのみでの操作、focus、announcementなど、RF v1の現行Requirements / Designで別要件とされているアクセシビリティ実装
- RF公開後のversion更新やrelease作業

## Current implementation gap

現在の`main`には、Row / Column Reorder v1、`edit | row | column`を所有するReorder Mode、共通Reorder Guidance、Editor DOM Context、Reorder Apply Policy、WordPress Reorder Integration、確認付き大規模反映を接続するWordPress Reorder Apply Integrationが実装済みである。

Row / Column Table Integrationは、現在構造の制約取得、更新対象セル数算出、確定済み移動の反映を既に提供している。Reorder Apply Policyも、Table Integrationが算出した更新対象セル数から確認付き大規模反映の要否を判断する共通実装として存在する。WordPress側には、Row / Columnの大規模反映状態を確認Modal、反映中表示、BlockEdit退避、表示復帰へ接続する実装が存在する。

一方、RF Architectureで定義された次の実装は存在しない。

- RFのopen / close、対象Table、方向、入力保持を所有するRF Interaction
- 行番号入力等を内部指定へ変換するRF Input Interpretation
- Row / Column固有のRF指定を現在Tableへ照合する方向固有Resolution
- RF固有の通常反映 / 確認付き大規模反映Lifecycleを所有するRF Apply Coordination
- TableツールバーのRF入口とPopover入力画面
- RFとRow / Column Reorder Modeの排他接続
- RF入口を既存Guidance終了条件へ接続する経路

また、既存Table IntegrationはDnDに必要な制約と更新能力を中心に構成されているため、RF Architectureで必要となる次のContract拡張が必要である。

- Row / Columnの結合セル拒否理由として利用できる位置診断
- Column RF選択肢のための最小列記述
- RF Apply Coordinationが反映前に現在Tableへ候補を再照合するための方向固有境界

既存Row / Column `reorder-apply.ts`は、DnD Session終了後に確認付き大規模反映へ進む方向固有Lifecycleとして成立している。RFはDnD Sessionを持たないため、このLifecycleを直接再利用せず、RF専用のApply Coordinationを追加して共通PolicyとWordPress Reorder Apply Integrationだけを再利用する。

## Approach

RF固有処理は`src/reorder/reorder-form/`配下へ独立して実装し、Row / Column固有Resolutionは同じRF境界の中でも別moduleとして維持する。RF Architectureが一文書であることを理由に、Row / Column Table Integrationや方向固有移動意味を共通化しない。

実装は内側の意味境界から外側のUIへ向かって進める。

最初にRow / Column Table IntegrationをRFで必要なContractまで拡張する。既存の構造解析と確定更新を正本として維持し、RF用に別のTable解析を作らない。Rowでは現在行数と行制約に加えてblocking merged rangeを特定できる診断を提供し、Columnでは論理列制約と同じ解析結果からRF用の最小列記述と診断を提供する。確定更新については、RFからもDnDと同じ構造ルールと一回のWordPress更新境界を利用できるようにする。

次にRF Input Interpretationと方向固有Resolutionを実装する。Input InterpretationはTable構造を参照せず、Rowの1-based入力を現在行数の範囲内の0-based位置へ変換し、未入力と不正入力を区別する。Row / Column RF Resolutionは、移動前Table上の対象行・対象列と`above | below` / `left | right`を現在Tableへ照合し、確定候補、構造拒否、no-opを解決する。入力中の解決結果はApply直前の最終権威にしない。

意味処理が成立した後、RF Interactionを実装する。共有observable stateがReact componentのmount / unmountを越えて維持される必要があるため、Architecture上のopen RF Sessionを一つの状態責務として表現し、必要であれば既存Reorder Modeと同じくZustandを用いる。RF InteractionはTable構造snapshotやWordPress表示状態を所有せず、方向ごとの入力と現在結果だけを保持する。

続いてRF Apply Coordinationを実装する。通常反映では長期状態を持たず、現在Table再照合、更新対象セル数取得、Reorder Apply Policyによる経路選択、更新要求を一回の処理で完了させる。確認付き大規模反映だけはRF固有の`confirming | applying | restoring`相当の状態を持ち、WordPress Reorder Apply Integrationへ公開する。既存Row / Column Reorder Applyとの重複を避けるため、WordPress側の共通表示接続は方向別DnD Applyだけを知る現在実装から、複数のApply Lifecycleを接続できる構成へ整理する。ただし、方向固有の移動意味やTable再照合をWordPress側へ移さない。

最後にWordPress Reorder IntegrationへRF入口とPopoverを接続する。RF開始時は同一TableのReorder Modeを`edit`へ戻してからRF Interactionを開始し、RF open中にRow / Column入口が選択された場合はRFを終了してから方向固有モードへ切り替える。RF終了時に以前のDnDモードは復元しない。GuidanceはRF専用状態を追加せず、RF開始を既存共通案内の終了契機として扱う。

各Phaseではfocused Jest testを中心に責務境界を確認し、WordPress Editor上の実経路が成立した後にPlaywrightでiframe / non-iframeとSupported Table Blockの横断契約を検証する。

実装中にRequirements / Design / Architectureの変更が必要になった場合はPlanまたは実装Issueで決定せず、該当する上位文書を先に更新してからPlanを追従させる。

## Architecture impact

本Planは`docs/architecture/reorder-form-v1-architecture.md`を実装へ写像するものであり、新しいArchitecture責務は追加しない。

実装時に特に注意する既存責務への影響は次のとおりとする。

- Row / Column Table IntegrationはRFのためにContractを拡張するが、方向固有構造の最終権威という既存責務を維持する。
- Reorder Apply Policyは既存の共通実装をそのまま正本とし、RF専用Policyを追加しない。
- WordPress Reorder Apply IntegrationはRF Apply Coordinationも接続できるよう実装を拡張するが、Apply Lifecycle自体や方向固有移動意味を所有しない。
- WordPress Reorder IntegrationはRF入口、Popover、排他接続を追加するが、RF入力状態の正本を所有しない。
- Reorder Guidance IntegrationはRF開始を既存案内の終了条件へ追加するだけとし、RF専用の永続Guidance状態を追加しない。

Plan作成時点でArchitecture変更を必要とする事項は確認されていない。実装中に既存責務では表現できない状態所有、Contract、Lifecycle、Invariantが必要になった場合は、そのPhaseを進める前にArchitectureを更新する。

## Implementation phases

### Phase 1: Table Integration Contract extension

- Outcome: RF固有責務がSupported Table Blockの保存表現を直接解釈せず、現在の入力情報、方向固有制約、構造診断、更新対象セル数、確定更新を既存Table Integrationから利用できる。
- Tasks:
  - Row Table Integrationへ、現在の`tbody`行数をRF入力範囲として安全に取得できる境界を整理する。
  - Rowの結合セル制約について、移動不可理由へ利用できる最初のblocking merged rangeを特定できる方向固有診断を追加する。
  - Column Table Integrationへ、論理列Identity、利用者向け列番号、利用可能な見出し表示値だけを持つRF用最小列記述を追加する。
  - Columnの既存論理Table解析を再利用して、最初のblocking merged rangeを特定できる方向固有診断を追加する。
  - RF Apply Coordinationから現在候補の成立性を再照合できる方向固有の実装境界を整理する。更新対象セル数算出と確定更新は既存ロジックを正本として維持する。
  - DnDとRFで異なる構造判定ロジックを作らない。
- Validation:
  - Core Table / Flexible Table Blockの代表構造、rowspan / colspan、head / body / foot、空見出し、重複見出し、診断位置、更新対象セル数、一回の更新境界をfocused testで確認する。
  - 既存Row / Column DnD向けTable Integration testが引き続き成立することを確認する。

### Phase 2: RF Input Interpretation

- Outcome: UI入力をTable構造から独立して、方向固有Resolutionが扱える内部指定へ安全に変換できる。
- Tasks:
  - RF固有実装境界として`src/reorder/reorder-form/`を作成する。
  - Rowの1-based入力について、未入力、不正入力、有効入力を区別する結果表現を実装する。
  - 有効なRow入力だけを現在行数の範囲内の0-based位置へ変換する。
  - Columnは現在の列記述から選択された論理列Identityを内部指定として扱い、任意文字列から列位置を推測しない。
  - 数値入力をTableデータやHTMLとして扱わず、入力境界で必要な型・範囲検証だけを行う。
- Validation:
  - 未入力、整数でない値、`1`未満、上限超過、境界値、有効値、Column未選択 / 有効選択をpure Jest testで確認する。

### Phase 3: Row / Column RF Resolution

- Outcome: 解釈済みRF指定を要求時点の現在Tableへ照合し、確定候補、構造拒否、no-opを副作用なく解決できる。
- Tasks:
  - Row RF Resolutionを実装し、移動元行・移動先行・`above | below`を移動前Table基準の行間境界へ変換する。
  - Column RF Resolutionを実装し、移動元論理列・移動先論理列・`left | right`を移動前Table基準の列間境界へ変換する。
  - source / destinationの現在範囲、blocked boundary、方向固有のsource移動可否をTable Integrationの現在制約へ照合する。
  - 実際の並び順が変わらない候補をno-opとして解決する。
  - 構造拒否時はTable Integrationの方向固有診断から最初のblocking merged rangeを返す。
  - 入力中のResolution結果をApply時の現在Table権威として扱わない。
- Validation:
  - 先頭・中間・末尾への移動、前方 / 後方移動、移動先対象を移動前位置として扱うこと、no-op、範囲変化、結合セル拒否、Table利用不能をRow / Column別のfocused testで確認する。

### Phase 4: RF Interaction and Session lifecycle

- Outcome: 一つの対象Tableに対するRFのopen / close、Row / Column切替、入力保持、現在結果、Cancel、Apply要求、成功 / 失敗復帰を一つの状態責務として管理できる。
- Tasks:
  - `closed`と一つのopen RF Sessionを表現する状態と操作境界を実装する。
  - open Sessionへ対象Table Identity、現在方向、方向ごとの入力、現在の入力 / Resolution結果を保持する。
  - 初期方向をRowとし、方向切替時に切替前方向のエラー・構造拒否結果を現在表示へ持ち越さない。
  - Row入力範囲とColumn列選択肢を各Table Integrationから要求時点で取得する。
  - 入力変更時にInput Interpretationと現在方向のResolutionを接続する。
  - resolvedかつno-opでない場合だけApply可能状態とする。
  - CancelではTableを更新せずSessionを終了する。
  - Apply失敗または大規模反映Cancel後に入力を保持したopen Sessionへ戻れる状態遷移を用意する。
- Validation:
  - open / close、初期Row、方向切替、方向別入力保持、旧結果の非継承、別Table開始、一Session制約、Cancel、Apply可否をstore / responsibility testで確認する。
  - React mount / unmount / remountを状態終了条件にしないことを確認する。

### Phase 5: RF Apply Coordination

- Outcome: RF候補をDnD Sessionへ依存せず、現在Table再照合、経路選択、通常反映、確認付き大規模反映、成功 / 失敗へ接続できる。
- Tasks:
  - RF専用Apply Coordinationを`src/reorder/reorder-form/`配下へ実装する。
  - Apply要求時に対応方向のTable Integrationで候補を現在Tableへ再照合し、成立する場合だけ更新対象セル数を取得する。
  - 既存`requiresLargeReorderApply`を利用して通常反映と確認付き大規模反映を選択する。
  - 通常反映では更新要求時点でもTable Integrationを最終権威として成立性を確認し、一回の確定更新として反映する。
  - 確認付き大規模反映では一つのTable / 方向 / 候補とLifecycle状態だけを保持し、確認中はTableを変更しない。
  - Cancelでは候補を破棄して入力保持状態へ戻す。
  - Continue後は反映表示成立後に現在Tableへ再照合して更新し、成功・失敗にかかわらずediting surface restoration完了後にRF Interactionへ結果を返す。
  - 既存Row / Column DnD `reorder-apply.ts`はRFから呼び出さない。
- Validation:
  - 通常反映、Policy境界、大規模確認、Cancel、Continue、確認中のTable未変更、Continue後の外部Table変化、更新不能、一候補制約、成功 / 失敗結果をfocused testで確認する。
  - 一回の成立したRF移動が一回のWordPress更新 / Undo単位になることをTable Integration testとintegration testで確認する。

### Phase 6: WordPress Reorder Apply Integration extension

- Outcome: RF Apply Coordinationの確認・反映・表示復帰を、既存Row / Column大規模反映と同じWordPress Editor表示責務へ接続できる。
- Tasks:
  - 現在Row / Columnの方向別Apply状態を直接購読しているWordPress側実装を、RF Apply Coordinationも接続できる構成へ整理する。
  - 確認ModalではRF候補を利用者向け位置として表示できるよう、RF用のsummary接続を追加する。
  - Continue時は対象Tableのediting surface退避と反映中表示を重い更新より先に成立させる。
  - RF Apply Coordinationへ表示成立、Cancel / Continue、editing surface restoration完了を返す。
  - 対象Table以外のブロック操作を不必要に妨げない。
  - 既存Row / Column大規模反映の表示Lifecycleを回帰させない。
- Validation:
  - Row / Column / RFそれぞれのconfirming / applying / restoring相当状態が対象Tableだけへ表示されることをReact integration testで確認する。
  - Continue前にTableが変更されないこと、BlockEdit退避後にApplyが開始されること、表示復帰完了までLifecycleが終了しないことを確認する。

### Phase 7: WordPress RF entry, Popover, and exclusivity

- Outcome: 対応TableのツールバーからRFを開始し、Tableを確認しながらRow / Column入力を行い、既存DnDと排他的に操作できる製品経路が成立する。
- Tasks:
  - 「列を並び替え」の隣にRF ToolbarButtonを追加し、Designで定義されたラベルとアイコンを接続する。
  - RF入口選択時に同一TableのReorder Modeを`edit`へ戻してからRF Interactionを開始する。
  - RF Interaction状態をPopover入力画面へ接続する。
  - Row入力では現在行範囲、移動元、移動先、上 / 下、入力エラー、構造拒否、no-op、Apply可否を表示する。
  - Column入力では現在列記述、移動元、移動先、左 / 右、構造拒否、no-op、Apply可否を表示する。
  - 結合セル拒否時は方向固有診断を利用して行・列範囲の利用者向けメッセージへ変換し、PresentationでTableを再解析しない。
  - RF open中にRow / Column入口を選択した場合はRFを終了してから選択したDnDモードへ進む。
  - RF終了時は過去のRow / Columnモードを復元しない。
  - 通常反映成功時はRFを終了して完了通知を表示し、失敗時は入力保持したPopoverへ戻す。
- Validation:
  - Toolbar順序、Popover open / close、初期Row、方向切替、入力表示、Apply disabled / enabled、Cancel、DnDとの排他、成功 / 失敗表示をReact / WordPress integration testで確認する。
  - 再mountだけでRF Sessionを失わないことを既存mount stability testと同種の検証で確認する。

### Phase 8: Reorder Guidance integration

- Outcome: RF入口がRow / Column入口と同じ既存初回案内の一部として扱われ、RF専用の永続状態を追加せず案内を終了できる。
- Tasks:
  - RF開始状態をReorder Guidance Integrationへ接続する。
  - RF入口選択時に現在操作環境の初回案内を表示済みとして保存し、案内を終了する。
  - RF open中は新しいGuidanceを開始しない。
  - PC / touchの既存Preference keyをそのまま利用し、RF専用keyを追加しない。
- Validation:
  - 未表示時の共通案内、RF入口選択での表示済み保存、Row / Column既存経路、PC / touch分離をfocused / integration testで確認する。

### Phase 9: Product composition and cross-cutting validation

- Outcome: RF v1の主要利用経路がSupported Table BlockとEditor contextを跨いで成立し、既存Row / Column Reorderを回帰させない。
- Tasks:
  - RF製品経路をWordPress integrationへ最終接続する。
  - 必要なuser-visible stringを`messages`責務へ追加し、既存i18n pipelineで抽出可能にする。
  - RF向けPlaywright projectまたは既存project構成への配置を、テスト責務に合わせて決定して追加する。
  - Core Table / Flexible Table BlockでRow / Column RFの通常移動、結合セル拒否、no-op、Cancel、Undoを確認する。
  - iframe / non-iframeでToolbar、Popover、入力、反映、失敗復帰が同じ契約を満たすことを確認する。
  - 大規模Tableで通常反映 / 確認付き反映の分岐と、RF自身の入力解釈・Resolution・Lifecycle管理に新しい持続的な停止がないことを確認する。
  - 既存Row / Column DnDの主要Jest / E2Eが回帰していないことを確認する。
- Validation:
  - `docs/development/testing.md`に従い、Node.js quality gate、production build、repository check、対応するPlaywright E2Eを実行する。
  - RF性能評価はTable Block本体の再描画時間とRF自身の追加コストを区別し、固定millisecond gateを新設しない。

## Decisions and validation questions

### Decide before implementation

1. **Phase 1開始前: Table IntegrationのRF向け公開Type**

   - 既存DnD Contractを壊さず、構造診断とColumn最小列記述をどのTypeとして公開するかを確定する。
   - 診断はRF専用表示文言ではなく、行・列範囲を意味する方向固有データとして表現する。

2. **Phase 3開始前: RF候補 / Resolution resultのType表現**

   - `resolved`、構造拒否、no-op、利用不能を、RF Interactionが表示状態へ安全に接続できる結果表現として確定する。
   - RowとColumnで見た目が似ていても、方向固有候補を一つの共通Move Typeへ統合しない。

3. **Phase 4開始前: RF Interactionの状態管理方式**

   - React componentのmount / unmountから独立した一Session状態が必要なため、Zustand storeを第一候補とする。
   - ただしcomponent-local stateでArchitecture上のLifecycleを完全に満たせる根拠が得られた場合は、不要なstoreを追加しない。

4. **Phase 6開始前: WordPress Reorder Apply Integrationの購読境界**

   - Row / Column / RFの各Apply責務をWordPress側が個別importして分岐し続けるか、Editor表示接続に必要な最小共通adapterを導入するかを実装レベルで決定する。
   - この選択でApply Lifecycleの所有権や方向固有移動意味を共通化してはならない。

5. **Phase 7開始前: Popover anchorとReact配置**

   - Tableを覆い隠さず、iframe / non-iframeの双方で現在Toolbarを基準に表示できるWordPress `Popover`の配置方法を確定する。
   - RF Sessionの正本をPopover component lifecycleへ依存させない。

6. **Phase 9開始前: RF E2Eのproject配置**

   - RFはRow / Columnの両方を一つの入口から扱うため、既存`row` / `column` projectへ重複配置するか、独立した`form` projectを追加するかをテスト責務とCIコストから決定する。
   - project構成の変更が必要な場合は`tests/e2e/AGENTS.md`とCI構成へ従う。

### Validate during implementation

- Column見出し取得について、Core Table / Flexible Table Block双方で利用者向け表示に使える値をTable属性から安定して取得できるか確認する。取得不能または表示に適さない場合は列番号だけへfallbackし、Architectureで定義した最小列記述を越えてTable内容をRF状態へ保持しない。
- blocking merged rangeの算出を既存Table解析へ追加した際、1,000 × 20程度のTableで入力変更ごとに意味のある追加コストを生じないことを計測する。問題がある場合はcache追加ではなく、まず解析経路と要求タイミングを見直す。
- WordPress Popoverの再生成やBlockEditの再mountがRF Sessionに与える影響を実Editorで確認する。Sessionが失われる場合はReact stateで補完せず、Architectureの状態所有に沿ってRF Interaction側を修正する。
- RF大規模反映で既存BlockEdit退避方式を利用した場合、入力保持、Cancel、失敗復帰、対象Table外操作がDesignどおり成立するか確認する。
- 入力中Resolutionの実行頻度が大規模Tableで操作感を損なう場合は、Architectureの「要求時点の現在Table」契約を維持したまま、解決を開始する入力成立条件やReact更新経路を軽量化する。

## Issue breakdown

Planレビュー後、次を一つのIssueへ詰め込まず、原則として各Phaseを一つのレビュー可能な実装Issueとして作成する。

- [ ] Phase 1: Row / Column Table IntegrationをRF Contractへ拡張する
- [ ] Phase 2: RF Input Interpretationを実装する
- [ ] Phase 3: Row / Column RF Resolutionを実装する
- [ ] Phase 4: RF Interaction / Session Lifecycleを実装する
- [ ] Phase 5: RF Apply Coordinationを実装する
- [ ] Phase 6: WordPress Reorder Apply IntegrationをRFへ拡張する
- [ ] Phase 7: RF Toolbar入口 / Popover / 排他接続を実装する
- [ ] Phase 8: RF入口をReorder Guidanceへ接続する
- [ ] Phase 9: RF product composition / E2E / performance validationを追加する

Phase 1でTable Integrationの変更量がRow診断、Column診断 / 列記述、Apply再照合の三領域に大きく分かれる場合は、レビュー容易性を優先して複数Issueへ分割してよい。ただし、Row / Columnの方向固有実装を一つの新しい共通実装へまとめるための分割は行わない。

Phase 7でPopover UIとWordPress排他接続の変更量が大きくなる場合も、RF Interaction Contractを先に固定したうえでUI表示と統合配線を分割してよい。

Issue本文ではPlan全体を複製せず、そのIssueのscope、依存する完了Phase、対象Architecture責務、completion condition、validationだけを記載する。

## Validation

実装完了時は`docs/development/testing.md`を正本として、変更範囲に対応する検証を実行する。

- RF pure logic / store / React / WordPress integration: focused Jestで反復し、最終的に`npm test`を実行する。
- production asset: `npm run build`を実行する。
- repository hygiene: `git diff --check origin/main...HEAD`を実行する。
- E2E: compatibleな`wp-dev`環境でRFの実経路をPlaywright検証し、Core Table / Flexible Table Block、iframe / non-iframeを代表環境で確認する。
- regression: Row / Columnの既存主要Jest / E2Eが成立することを確認する。
- performance: 大規模TableでRF自身の入力解釈、構造Resolution、Apply coordinationに新しい持続的なボトルネックがないことを確認し、Table Block本体のcommitコストと区別して記録する。

各実装Issueでは、そのPhaseに必要な最小のfocused validationを完了条件とし、全横断validationを毎Issueへ重複させない。

## Completion criteria

- RFをTableツールバーから開始し、Row / Columnを一つのRF Session内で切り替えられる。
- RF開始時に同一TableのRow / Column Reorder Modeが終了し、RF終了時に以前のモードを自動復元しない。
- Rowの1-based入力とColumn選択肢が安全に内部指定へ解釈され、不正入力ではTableを変更しない。
- Row / Column指定が要求時点の現在Tableへ方向固有に解決され、構造拒否とno-opではTableを変更しない。
- 結合セル拒否では最初のblocking merged rangeの位置を利用者が識別でき、PresentationがTableを再解析しない。
- RF Apply CoordinationがDnD Sessionへ依存せず、通常反映と確認付き大規模反映を既存Reorder Apply Policyへ接続する。
- 確認中はTableを変更せず、Continue後は方向固有Table Integrationを最終権威として現在Tableへ再照合する。
- 成立した一回のRF並び替えが一回のWordPress更新およびUndo単位になる。
- 反映成功後はRFを終了し、Cancel / 入力不正 / 構造拒否 / no-op / 再照合不成立 / 更新不能では不要なTable更新を行わない。
- 反映失敗または大規模反映Cancel後は入力を保持したRFへ戻る。
- RF入口が既存Reorder Guidanceの共通入口として扱われ、RF専用の永続案内状態を追加しない。
- Core Table / Flexible Table Blockおよび代表iframe / non-iframe環境で主要RF契約が検証される。
- 既存Row / Column DnDの主要契約を回帰させない。

## Notes

- RFはRow / Column DnDより物理入力・Presentation責務が少ないため、DnD ArchitectureのPhase構成を機械的に複製しない。RF固有の複雑さは入力Session、方向固有Resolution、Apply Coordination、WordPress Popover接続に集中する。
- 既存実装を再利用する箇所でも、Architecture責務が異なる場合は既存functionを直接使えることと責務そのものを共有できることを区別する。特に既存Row / Column `reorder-apply.ts`は後者に該当しない。
- Table Integrationへの診断追加はRFだけのための一時的な表示機能にせず、DnDでも同じ構造理由を利用できる方向固有Contractとして実装する。
