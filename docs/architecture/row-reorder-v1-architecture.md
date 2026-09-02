# Row Reorder v1 Architecture

## 1. Introduction and Goals

本書は、正式v1の行並び替えを実現するための内部責務、境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

入力は`docs/design/reorder-v1-design.md`および`docs/design/row-reorder-v1-design.md`とし、利用者向け設計を行専用の責務モデルへ落とし込む。

本書はRow Reorderだけを対象とする。Column Reorderの状態、責務、Contractは定義せず、Row Reorderから参照しない。

通常編集、行並び替え、列並び替えの入口、モード選択、排他状態、および選択中の並び替えモードが有効なTableの識別はRow Reorderの外側にあるReorder Mode境界が所有する。初回案内の表示済み状態と、行・列の入口をまとめて提示する案内状態はRow Reorderの外側にあるReorder Guidance境界が所有する。Row Reorderは、行並び替えが有効であることだけを受け取り、その有効期間における行DnDの状態とLifecycleを所有する。

責務名はArchitecture上の概念名とし、行専用であることを責務名へ重複して付与しない。本書に定義するTable Integration、DnD InteractionなどはすべてRow Reorderの責務であり、将来Column Reorder側に同名の責務が存在しても共通実装または共有状態を意味しない。

## 2. Architecture Constraints

- Row ReorderとColumn Reorderは独立した実装とし、両者の間に共通の並び替え抽象化を導入しない。
- Reorder Mode境界はTableツールバーの行・列並び替え入口、`edit | row | column`の排他状態、および`row | column`が有効なTableを識別するための最小限のTable Identityを所有する。Table内容、行・列構造、移動対象、移動先、DnD Sessionその他の方向固有Table情報は所有せず、Row ReorderへColumn Reorderの内部状態、責務、Contractを公開しない。
- `edit`では通常のTable編集を許可し、`row | column`では対象Tableの内容編集を開始させない。通常編集と並び替えモードの排他はReorder Modeが所有し、Row ReorderまたはColumn Reorderへ重複して所有させない。
- Reorder Guidance境界はPC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列の入口をまとめて提示する共通案内状態をRow Reorderの外側で所有する。Row Reorderは行を移動しようとする通常編集時の操作検出だけを所有し、案内表示済み状態や列入口の案内状態を所有しない。
- 本書の責務名がColumn ReorderのArchitectureと同一であっても、責務の同一性、実装共有、状態共有を意味しない。
- Row Reorderは`tbody`の行だけを移動対象とし、行順以外のTable内容を変更しない。
- 行DnD中はTableデータを並べ替えず、DnD Interactionが確定した場合だけTable Integrationの行更新境界を利用して行順を更新する。
- completeではSessionが保持する最終有効移動先を現在のTable構造へ再照合し、その移動が現在も成立する場合だけDnD InteractionからTable Integrationへ確定済み行移動の反映を要求する。成立しない場合は外部環境変化による正常な中止へ合流する。
- Auto Scrollは行DnDに必要な縦方向だけを扱い、列方向のための抽象化を持たない。
- 対応Table BlockやEditor環境の差は、Row Reorderの利用者向け挙動へ漏らさず、それぞれを所有する境界で吸収する。
- 正常な不在、外部環境変化による継続不能、内部仕様またはruntime invariant違反を区別する。
- DnD終了理由の内部Error / 外部環境変化という内部分類と、Design上の利用者向け通知要否は分離する。cancelまたは成立しないdropでは通知せず、安全な操作継続ができずDnDを終了した場合はDesignで定義された通知対象として扱う。
- 型で表現できる状態相関は型と状態モデルで保証し、runtime assertionへ戻さない。runtime assertionはRow Reorderが所有し、型だけでは保証できない値レベルのInvariantに限定する。
- 内部エラーはRow Reorder内部で局所的に握り潰さず、DnDのstart、progress、complete、cancelの操作境界まで伝播させる。
- 通常のoperation boundaryへErrorを伝播できない非同期callback等のexecution boundaryだけはErrorを受け止めてよい。その境界は独自の記録や回復を行わず、元のoperation情報とErrorをDnD Interactionの同じ行専用共通中止経路へ渡す。
- 操作境界またはexecution boundaryから共通中止経路へ合流した内部エラーは、DnD Interactionで一度だけ記録し、Sessionと一時状態を破棄して安全なidleへ戻す。同じエラーを複数箇所で記録しない。
- 外部環境変化による継続不能は内部エラーとして記録せず、必要な一時状態だけを破棄して安全に操作を終了する。
- Performanceの責任境界は、対応Table Block本体の属性更新・再描画性能ではなく、Row Reorder自身が追加する並び替え処理のコストとする。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | `QR-02`で保証対象とする編集環境を提供し、Row Reorderの入力と表示が存在する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | `FR-13`で定義されるCore TableまたはFlexible Table Blockであり、Table Integrationを介して行構造の取得と行順更新を行う対象。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | 行DnD中に縦方向へ自動スクロールする対象領域を提供する。 |

Row ReorderはWordPress Editor、対応Table Block、WordPress Undo、およびEditor Scroll Areaと接続する。対応Table Blockの具体的な対象とEditor環境の保証範囲はRequirementsを正本とし、本書では再定義しない。

Editor DOM ContextはWordPress Editorの現在のeditor contextからDOM / Web APIを利用するためのcontextを解決する。Table IntegrationはSupported Table Blockとの差を吸収し、WordPress Undoの更新単位を壊さずに確定済み行移動を反映する。Auto Scrollは現在のEditor Scroll Areaだけを対象とする。

## 4. Solution Strategy

Row Reorderは、モード境界、共通入口案内境界、editor context、行の再案内候補検出、入力、Table Block差、DnD Session、表示、自動スクロールを別責務として扱う。移動対象判定と移動先判定はDnD InteractionのSession Lifecycleに含め、Table更新はTable Integrationの行更新境界として扱う。

Reorder ModeはTableツールバーの行・列入口と`edit | row | column`の排他状態を所有し、`row | column`を入口選択時のTable Identityへ関連付ける外側の境界である。選択中の入口の再選択では`edit`へ戻り、別方向の入口選択ではその方向へ切り替える。同じTable内では選択中のモードを維持し、別Blockを選択した場合は`edit`へ戻る。Toolbar componentのunmount / remountそのものはモード終了条件としない。Reorder Modeは行DnDのSessionや方向固有Table情報を所有せず、Row Reorderへは行DnDが有効であることだけを提供する。

Reorder Guidanceは初回案内と再案内でReorder Modeが所有する行・列の入口をまとめて案内する外側の境界であり、入口選択状態そのもの、行DnD Session、Column Reorder内部状態を所有しない。Editor DOM Contextは現在のWordPress Editorに属するDOM / Web API contextを必要な時点で解決する共有境界であり、Row Reorder固有状態を所有しない。

Rediscovery Detectionは通常編集時に行を移動しようとする反復操作だけを行側で検出し、案内表示の成立判断と表示状態はReorder Guidanceへ委ねる。

DnD Interactionは行DnDのoperation boundaryとSession Lifecycleを所有する。startでは現在のTable構造を取得して移動対象の開始可否を判定し、成立したTable構造をSession開始時の行制約として保持する。progressではSession開始時のTable構造を利用して移動先を判定し、Table Integrationから現在構造を取得し直さない。Sessionは移動対象行、対象Table同一性、開始時に成立した行制約上の前提、現在の有効移動先、DnD中の一時状態だけを保持し、列方向を識別する状態を持たない。completeでは現在のTable構造を取得し直し、Sessionの移動対象と最終有効移動先を現在構造へ再照合してから、成立する場合だけTable Integrationの行更新境界を直接利用して確定する。DnD終了後は、現在のTableで行並び替えモードを安全に継続できるかという結果だけをReorder Modeへ渡し、Reorder Modeが`row`維持または`edit`復帰を決定する。

正常な処理進行と異常時の回復は別のProcess Flow Viewで表現する。異常系は発生責務の一覧ではなく、回復意味が異なるパターンとして、外部環境変化、Session開始前の内部failure、active DnD中の内部failure、Table更新failureに分ける。内部の終了分類とは別に、安全な操作継続ができずDnDを終了したかをDesign上の利用者向け通知要否へ接続する。

### Process Flow Views

#### Row Reorder End-to-End {#PV_ROW_REORDER_END_TO_END kind=normal}

WordPress Editorの入力から行DnDを開始し、complete時にも現在のTable構造で成立することを確認できた行移動だけを対応Table Blockへ反映する主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_ROW_INPUT_INTERACTION | normal | WordPress Editorの入力が行並び替えの入力境界へ入る。 |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | normal | 入力方式固有の解釈から行DnDのstart、progress、complete、cancelへ進む。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | normal | start時の行構造取得とcomplete時の現在構造取得・確定済み行移動の反映へ進む。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | normal | 対応Table Blockから行構造を取得し、確定時は`tbody`の行順だけを反映する。 |

このViewは主要な処理進行だけを示す。Reorder Guidance、Rediscovery Detection、Presentation、Auto Scrollなどの補助責務やRuntime Interactionの往復はRuntime ViewとDependenciesで表現する。

#### External Environment Change and Recovery {#PV_ROW_EXTERNAL_CHANGE_RECOVERY kind=failure-recovery}

EditorまたはTableの外部状態変化によってactiveな行DnDを継続または確定できなくなった場合に、内部エラーとして扱わず共通中止経路へ合流し、安全に行DnDを終了する処理方向を示す。終了後のReorder Mode継続可否と利用者向け通知要否は、内部エラー分類とは別に判断する。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | failure | 現在のEditor contextを利用できないなど、外部環境変化による継続不能をoperation boundaryへ合流させる。 |
| RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | failure | 対象Tableが現在利用できない、complete時の現在構造では移動を確定できない、または更新開始前に現在更新できないなど、外部Table状態の変化による継続不能・確定不能をoperation boundaryへ合流させる。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | recovery | DnD中だけの表示状態を解除し、安全な操作継続不能による終了ではDesignで定義された通知を要求する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | recovery | 行DnDの自動スクロール一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | recovery | 入力方式固有のDnD一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | recovery | DnD終了後に現在のTableで行並び替えモードを安全に継続できるかを外側のモード境界へ渡す。 |

このViewの`failure`はProcess Flow Edgeの分類であり、内部エラーを意味しない。外部環境変化は正常に起こり得る継続不能または確定不能として扱い、エラー記録の対象にしない。一方、安全な操作継続ができずDnDを終了した結果はDesign上の通知対象へ接続する。

#### Start Failure and Recovery {#PV_ROW_START_FAILURE_RECOVERY kind=failure-recovery}

Session開始前のstart処理でRow Reorder内部のContractまたはInvariant違反が検出された場合に、Errorをstart operation boundaryへ伝播し、Sessionを成立させずidleへ戻る処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | failure | start処理中に検出されたRow Reorder所有のContractまたはInvariant違反をoperation boundaryへ伝播する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | recovery | startに属する入力一時状態を破棄し、Sessionを開始せずidleへ戻る。 |

operation boundaryは元のErrorと失敗した操作を一度だけ記録する。移動対象が成立しない通常結果はこのViewのfailureに含めない。

#### Active DnD Failure and Recovery {#PV_ROW_ACTIVE_DND_FAILURE_RECOVERY kind=failure-recovery}

active Session中のprogress、complete、cancel処理、または通常のoperation boundaryへ伝播できないexecution boundaryで内部Errorが発生した場合に、行専用の共通中止経路へ合流し、DnD一時状態を終了する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_PRESENTATION | RESP_ROW_DND_INTERACTION | failure | active DnD中の表示責務で検出された内部Errorをoperation boundaryまたは必要なexecution boundaryから共通中止経路へ渡す。 |
| RESP_ROW_AUTO_SCROLL | RESP_ROW_DND_INTERACTION | failure | active DnD中の自動スクロール責務で検出された内部Errorをoperation boundaryまたは必要なexecution boundaryから共通中止経路へ渡す。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | recovery | DnD中だけの表示状態を解除し、異常終了としてDesignで定義された通知を要求する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | recovery | 自動スクロール一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | recovery | 入力方式固有のDnD一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | recovery | DnD終了後に現在のTableで行並び替えモードを安全に継続できるかを外側のモード境界へ渡す。 |

通常のoperation boundaryへErrorを伝播できる場合はそこで捕捉する。非同期callback等のexecution boundaryでしか捕捉できない場合は、独自のlogやrecoveryを所有せず、元のoperation情報とErrorを同じ共通中止経路へ渡す。DnD InteractionはErrorを一度だけ記録し、Sessionを破棄してidleへ戻る。

#### Table Update Failure and Recovery {#PV_ROW_DATA_UPDATE_FAILURE_RECOVERY kind=failure-recovery}

complete時の現在構造への再照合が成立した後、Table Integrationの内部Errorにより更新処理を安全に継続できなくなった場合に、Errorをoperation boundaryへ戻し、開始済み更新をretryまたはrollbackせず安全にDnDを終了する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | failure | 更新処理中に検出された内部Errorをcomplete operation boundaryへ伝播する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | recovery | DnD中だけの表示状態を解除し、異常終了としてDesignで定義された通知を要求する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | recovery | 自動スクロール一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | recovery | 入力方式固有のDnD一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | recovery | DnD終了後に現在のTableで行並び替えモードを安全に継続できるかを外側のモード境界へ渡す。 |

すでに外部Tableへ成立した更新を共通中止経路が自動的に巻き戻さない。Table Integrationは独自のretryを開始しない。Reorder Modeが継続可能な場合は、その時点のTable状態を基準に後続の行並び替えを受理する。

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | Tableツールバーの行・列入口、`edit | row | column`の排他状態、および選択中モードのTable単位Lifecycleを所有する外側の境界。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態を所有する外側の境界。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のWordPress Editorに属するDOM / Web API contextを必要な時点で解決する。 |
| RESP_ROW_REDISCOVERY_DETECTION | Rediscovery Detection | 通常編集時の反復操作から行を移動しようとする意図が成立したことだけを検出し、外側の案内境界へ通知する。 |
| RESP_ROW_INPUT_INTERACTION | Input Interaction | PCとタッチ端末の入力固有差を行DnDのstart、progress、complete、cancelへ変換する。 |
| RESP_ROW_TABLE_INTEGRATION | Table Integration | 対応Table Blockとの差を吸収し、行並び替えに必要なTable同一性、現在構造、行更新境界、およびWordPress Undoとの境界を提供する。 |
| RESP_ROW_DND_INTERACTION | DnD Interaction | 行DnDのSession、開始可否判定、移動先判定、operation boundary、確定、中止、回復Lifecycleを所有する。 |
| RESP_ROW_PRESENTATION | Reorder Presentation | 移動不可理由、行DnD中の視覚フィードバック、およびDesignで定義された異常終了通知を表現する。 |
| RESP_ROW_AUTO_SCROLL | Auto Scroll | 行DnD中に必要な縦方向の自動スクロールを判断・制御する。 |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_REORDER_MODE | EXT_WORDPRESS_EDITOR | WordPress Editor上のTableツールバー入口、通常編集と行・列並び替えの排他、および対象Table単位のモードLifecycleを扱うために必要とする。 |
| RESP_REORDER_GUIDANCE | EXT_WORDPRESS_EDITOR | 初回案内と再案内の表示契機、および行・列の入口をまとめて提示する編集環境を必要とする。 |
| RESP_REORDER_GUIDANCE | RESP_EDITOR_DOM_CONTEXT | 共通入口案内を現在のeditor contextで表現するために必要とする。 |
| RESP_REORDER_GUIDANCE | RESP_REORDER_MODE | Reorder Modeが所有する行・列入口の案内と、入口選択による案内終了を整合させるために必要とする。 |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のeditor contextを解決するために現在のWordPress Editorを必要とする。 |
| RESP_ROW_REDISCOVERY_DETECTION | EXT_WORDPRESS_EDITOR | 通常編集として成立する操作と行移動の再案内候補を区別するために必要とする。 |
| RESP_ROW_REDISCOVERY_DETECTION | RESP_REORDER_MODE | 通常編集状態でだけ行移動意図の検出を行うために必要とする。 |
| RESP_ROW_REDISCOVERY_DETECTION | RESP_REORDER_GUIDANCE | 成立した行移動意図を共通の再案内判断へ渡すために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | EXT_WORDPRESS_EDITOR | PCまたはタッチ端末の入力を行DnD操作へ変換するために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | RESP_EDITOR_DOM_CONTEXT | 入力処理で現在のeditor DOM contextを利用するために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | RESP_REORDER_MODE | 行並び替えが有効な期間だけ行入力を受理するために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 入力を行DnDのoperationへ渡すために必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有の行構造取得と行順更新を行うために必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した1回の行並び替えを1回のUndoで戻せる更新単位を維持するために必要とする。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | DnD Interactionがモード状態を所有せず、DnD終了後のモードLifecycle判断をReorder Modeの責務として成立させるために必要とする。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | start時の行構造取得、complete時の現在構造への再照合、および確定した行移動の反映に必要とする。 |
| RESP_ROW_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 現在のeditor contextで行DnDの表示を行うために必要とする。 |
| RESP_ROW_PRESENTATION | RESP_ROW_DND_INTERACTION | 移動不可理由、active DnD状態、終了時の表示解除、およびDesign上の通知要否を表示状態へ反映するために必要とする。 |
| RESP_ROW_AUTO_SCROLL | RESP_ROW_DND_INTERACTION | activeな行DnD状態と終了状態を自動スクロール判断に必要とする。 |
| RESP_ROW_AUTO_SCROLL | RESP_EDITOR_DOM_CONTEXT | 現在のeditor contextでスクロール対象を扱うために必要とする。 |
| RESP_ROW_AUTO_SCROLL | EXT_SCROLL_AREA | 行DnD中に縦方向へスクロールできる外部領域を必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_ROW_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_REDISCOVERY_DETECTION RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL |
| DV_ROW_EDITOR_INTERACTION | Editor Interaction | EXT_WORDPRESS_EDITOR RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_REDISCOVERY_DETECTION RESP_ROW_INPUT_INTERACTION |
| DV_ROW_DND_CORE | DnD Core | EXT_SUPPORTED_TABLE_BLOCK RESP_REORDER_MODE RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION |
| DV_ROW_FEEDBACK | DnD Feedback | EXT_SCROLL_AREA RESP_EDITOR_DOM_CONTEXT RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL |
| DV_ROW_DATA_UPDATE | Table Update | EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

Tableツールバーの「行を並び替え」「列を並び替え」の入口、入口選択、および`edit | row | column`の排他状態を所有する。`row | column`では対象Tableの内容編集を開始させず、通常編集と並び替えモードを排他的に成立させる。Row Reorderへは行並び替えが有効であることだけを提供する。

##### State ownership

`edit | row | column`の排他状態と、`row | column`が現在どのTableに対して有効かを識別するための最小限のTable Identityを所有する。共通案内状態、Table内容、行・列構造、移動対象、移動先、行DnD Session、Column Reorder内部状態、その他の方向固有Table情報は所有しない。

##### Contract

Tableツールバーの入口選択を受け取り、行または列のモードを選択したTable Identityへ関連付ける。選択中の入口を再選択した場合は`edit`へ戻し、別方向の入口を選択した場合は同じTableに対する選択方向を切り替える。Row Reorderへは対象Tableで行並び替えが有効であることだけを提供し、Column Reorderの状態またはReorder Mode全体の状態を公開しない。

行DnD終了時は、Row Reorderから現在のTableで行並び替えモードを安全に継続できるかという結果だけを受け取る。継続できる場合は`row`を維持し、現在のTableに対するReorder Mode自体を安全に継続できない場合だけ`edit`へ戻る。個々の行が移動対象として成立するか、DnD終了理由が内部Errorか外部環境変化かは判定しない。

##### Lifecycle

`edit`から開始する。入口選択により選択時のTable Identityへ関連付けられた`row`または`column`へ移行する。同じTable内では現在のモードを維持し、別Blockを選択した場合は`edit`へ戻る。選択中の入口の再選択でも`edit`へ戻り、別方向の入口選択では同じTableに対する方向を切り替える。

DnDのcomplete、cancel、成立しないdropだけではReorder Modeを終了しない。DnDを安全に継続できなくなった場合は、そのDnD終了後に現在のTableでReorder Modeを安全に継続できるかを評価し、継続できる場合は選択中の`row | column`を維持し、継続できない場合だけ`edit`へ戻る。Toolbar componentのunmount / remountそのものはモード終了条件としない。

##### Invariants

- 同時に有効なモードは一つだけとする。
- 行入口と列入口を同時にactiveにしない。
- `row | column`は必ず一つのTable Identityへ関連付ける。
- `row | column`では関連付けられたTableの内容編集を開始させない。
- Row ReorderへColumn Reorderの内部状態、責務、Contract、Reorder Mode全体の状態を公開しない。
- Table内容、行・列構造、移動対象、移動先、DnD Sessionを所有しない。
- 共通入口案内の表示済み状態を所有しない。
- DnD SessionのLifecycleを所有しない。

#### Reorder Guidance {#RESP_REORDER_GUIDANCE}

##### Responsibility

初めて利用する人への案内と通常編集時の再案内について、Reorder Modeが所有する「行を並び替え」と「列を並び替え」の入口をまとめて提示する外側の案内境界を所有する。

##### State ownership

利用者についてPCとタッチ端末ごとの初回案内表示済み状態、現在の共通入口案内状態、および同じ状況で過度に再案内しないための案内抑制状態を所有する。入口の選択状態、行DnD Session、Column Reorder内部状態、行または列固有の移動意図検出状態は所有しない。

##### Contract

設計で定義された初回案内条件と、Row ReorderまたはColumn Reorder側で成立した方向固有の再案内候補を受け取り、必要な場合だけReorder Modeが所有する行・列両方の入口を確認できる共通案内を提示する。利用者がいずれかの入口を選択した場合、または初回案内を閉じた場合は案内を終了し、その操作環境では初回案内を表示済みとして扱う。

##### Lifecycle

初回案内はPCとタッチ端末の各操作環境で未表示の状態から表示契機により案内状態となり、いずれかの入口選択または案内終了で表示済みとなる。再案内は方向固有の検出結果を受けた場合に必要性を判断し、通常編集を妨げず、同じ状況で過度に繰り返さない範囲で一時的に案内する。

##### Invariants

- 初回案内と再案内では行・列両方の入口をまとめて提示する。
- 初回案内表示済み状態をRow ReorderとColumn Reorderへ重複して所有させない。
- 一方の入口を選択した場合でも、その操作環境の初回案内全体を表示済みとして扱う。
- 行または列の入口選択状態をReorder Guidanceの状態として所有しない。
- 行または列固有のDnD Sessionや内部状態を共通案内状態として保持しない。
- 共通案内によって通常のTable編集を妨げない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のWordPress Editorに属する基準から、その時点でDOM / Web APIを利用するためのeditor contextを解決する。

##### State ownership

解決したcontextをeditor lifecycleをまたぐ永続状態として所有しない。Reorder Mode、Reorder Guidance、行DnD Session、Tableデータ、移動対象、移動先を所有しない。

##### Contract

現在のeditor contextを安全に提供できる場合だけ、そのcontextを必要な責務へ提供する。現在のcontextを解決できない場合は、以前のcontextへfallbackせず正常な不在を返す。

##### Lifecycle

DOM / Web APIを必要とする時点で現在のeditor contextを解決する。Editor lifecycleが変化した場合は現在の基準から解決し直す。

##### Invariants

- 現在のWordPress Editorとは異なるcontextをfallbackとして提供しない。
- iframe / non-iframeというEditor方式を利用側へ判定させない。
- 現在のcontextを解決できない状態をRow Reorder内部のInvariant違反として扱わない。

#### Rediscovery Detection {#RESP_ROW_REDISCOVERY_DETECTION}

##### Responsibility

通常編集時に、セル内容の編集、文字選択、通常スクロールなどではなく、行を移動しようとする操作が短時間に繰り返されたと判断できる場合に、その行固有の再案内候補だけを検出する。

##### State ownership

行を移動しようとする反復操作の成立判定に必要な短期状態だけを所有する。初回案内表示済み状態、共通入口案内状態、再案内の表示抑制状態、行DnD Sessionは所有しない。

##### Contract

通常編集状態で観測した操作から、行を移動しようとする反復操作が成立したかを判定する。成立した場合はReorder Guidanceへ行側の再案内候補を通知し、案内を表示するか、どの入口を強調するか、初回案内が表示済みかは判断しない。

##### Lifecycle

通常編集状態でだけ判定を行い、行並び替えまたは列並び替えが有効になった場合、通常編集として成立する操作へ移行した場合、または判定系列が終了した場合は短期状態を破棄する。

##### Invariants

- 一度だけの短いドラッグや通常の編集操作を行移動意図の成立として扱わない。
- 行・列共通の案内表示状態を所有しない。
- 列を移動しようとする操作を検出しない。
- 行DnD Sessionを所有しない。
- Column Reorderの内部状態を判定に利用しない。

#### Input Interaction {#RESP_ROW_INPUT_INTERACTION}

##### Responsibility

PCとタッチ端末の入力固有の差を、行DnDのstart、progress、complete、cancelという共通のoperationへ変換する。

##### State ownership

入力方式固有の一時状態だけを所有する。行DnD Session、移動対象判定、移動先判定、Tableデータを所有しない。

##### Contract

Reorder Modeから対象Tableで行並び替えが有効であることを受け取り、その期間だけ行DnD入力を受理する。現在のEditor contextを利用できない場合は内部Errorへ変換せず、開始しない、またはactiveな操作を安全に終了できる継続不能結果としてoperation boundaryへ渡す。

##### Lifecycle

行並び替えが有効な期間にだけ活動する。DnD終了、モード終了、外部環境変化、内部failure recoveryで入力方式固有の一時状態を破棄する。

##### Invariants

- 列DnDを開始しない。
- PCとタッチ固有の状態をDnD InteractionへSession状態として持ち込まない。
- Editor contextの正常な不在を内部Errorとして扱わない。

#### Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility

Supported Table Blockとの差を吸収し、行並び替えに必要なTable同一性、現在の行構造、行更新境界、およびWordPress Undoとの境界を提供する。

##### State ownership

DnD Sessionや入力状態を所有しない。外部TableデータをRow Reorder独自の永続状態として複製しない。

##### Contract

現在の対応Tableについて、行制約判定と更新に必要な情報を同一Table由来の情報として提供する。DnD Interactionから現在構造で成立することを確認済みの移動対象と移動先、および対象Tableの同一性を受け取り、セル内容・属性・装飾その他の保持対象を変えずに行順だけを更新する。対応Tableが現在存在しない、外部Table状態を安全に取得できない、または更新開始前に現在更新できない場合は正常な不在または更新不能結果として返し、新しい行順を部分的に確定しない。1回の成立した行並び替えをWordPress Undo上の1回の更新単位として維持する。

対応Table Block固有の構造表現と更新方法、およびWordPress Undoとの接続はこの境界で吸収し、他のRow Reorder責務へ漏らさない。

##### Lifecycle

要求時点のSupported Table Blockから現在情報を取得または更新する。外部Table状態が継続して不変であることを前提にせず、取得した情報を外部状態監視用の永続状態として保持しない。確定済み行移動の更新不能時に独自のretryまたはrollbackを開始しない。

##### Invariants

- 行並び替えに不要な列専用構造をContractとして要求しない。
- Row Reorderが所有するTable同一性に矛盾する値を内部で生成しない。
- Supported Table Blockの消失やEditor lifecycle変化を内部Invariant違反としてassertしない。
- 対応外Blockへ不完全な行構造または更新能力を提供しない。
- `tbody`の行順以外を並び替え結果として変更しない。
- 一つの確定済み行移動の反映要求を複数回適用しない。
- 対象Table同一性がRow Reorderのruntime invariantを満たさない場合は成功扱いにしない。
- 1回の成立した行並び替えを複数の独立したUndo単位へ分割しない。

#### DnD Interaction {#RESP_ROW_DND_INTERACTION}

##### Responsibility

行DnDのSessionとstart、progress、complete、cancelのoperation boundaryを所有する。移動対象の開始可否判定、Session開始、移動先判定と更新、現在構造への再照合、確定、正常中止、外部環境変化による終了、内部Errorからの回復を一つの行専用Lifecycleとして管理する。

##### State ownership

activeな行DnD Sessionを所有する。Sessionは移動対象行、対象Table同一性、Session開始時に取得したTable構造、現在の有効移動先、DnD一時状態を保持する。列方向やColumn Reorderの状態は保持しない。Sessionが保持する開始時Table構造または移動先を外部Tableの現在構造そのものとして扱わない。Reorder Modeの`edit | row | column`状態または対象Table Identityは所有しない。

##### Contract

startでは開始位置とTable Integrationから取得した現在のTable情報を用いて`tbody`の移動対象行を解決し、その行が行単位で移動可能な場合だけSessionを開始する。`tbody`外、または`rowspan`等により行単位の移動で構造を保てない行ではSessionを開始せず、移動不可という正常な結果を内部Errorへ変換しない。Session開始時に取得したTable構造を、active Session中の移動先判定に用いる行制約として保持する。

progressではSession開始時のTable構造と現在位置を用いて、`tbody`内で構造を保てる行間だけを有効な移動先として判定し、現在の有効移動先を更新する。progressのたびにTable Integrationから現在のTable構造を取得し直さない。有効な移動先がない状態を内部Errorとして扱わない。

completeでは有効な最終移動先がある場合でも、Table Integrationから現在のTable情報を取得し直し、Sessionの移動対象、最終有効移動先、Table同一性が現在のTable構造でも成立することを再照合する。成立を確認できた場合だけTable Integrationの行更新境界へ確定済み行移動の反映を直接要求する。再照合できない、または現在は成立しない場合は外部環境変化による正常な中止へ合流し、新しい行順を確定しない。cancelまたはその他の継続不能でもTableデータを新たに確定せず終了する。

内部責務から伝播したErrorはoperation boundaryで捕捉し、対象operationと元のErrorをDnD Interactionで一度だけ記録した後、Row Reorder内の共通中止経路へ合流する。通常のoperation boundaryへ伝播できない非同期callback等のexecution boundaryだけはErrorを受け止めてよいが、独自の記録や回復を行わず、元のoperation情報とErrorを同じ共通中止経路へ渡す。外部環境変化による継続不能は記録しない。

DnD終了時は、終了理由の内部分類とは別に利用者向け通知要否を決定し、安全な操作継続ができずDnDを終了した場合はReorder PresentationへDesignで定義された通知を要求する。cancelまたは成立しないdropでは通知を要求しない。Sessionと一時状態の終了後、現在のTableで行並び替えモードを安全に継続できるかという結果だけをReorder Modeへ渡す。

##### Lifecycle

idleからstart成功時にactiveとなる。start成功時に取得したTable構造をSession開始時の行制約として保持する。progressはactive Sessionだけを更新し、Session開始時のTable構造に対して有効な移動先だけを保持する。completeでは現在のTable構造を取得し直して移動対象と最終移動先を再照合し、成立した場合だけ更新へ進み、再照合が成立しない場合は正常に中止する。complete成功、cancel、外部環境変化による正常終了、内部Error recoveryのいずれでもSessionとDnD中だけの一時状態を破棄してidleへ戻る。

complete成功、cancel、成立しないdropでは現在の行並び替えモードを維持できる結果をReorder Modeへ渡す。安全な操作継続ができずDnDを終了した場合は、終了後の現在Tableで行並び替えモード自体を安全に継続できるかを判定した結果をReorder Modeへ渡す。Table更新がすでに成立した後で継続不能になった場合は、回復処理によって成立済み更新を自動的に巻き戻さず、その時点のTable状態を後続判断の基準とする。

##### Invariants

- active Sessionは同時に一つだけ存在する。
- Sessionが参照する移動対象とTable同一性は同じ行DnD開始から成立した値である。
- `tbody`外の行を移動対象として成立させない。
- `rowspan`等により行単位の移動で構造を保てない行を移動対象として成立させない。
- progressではSession開始時に取得したTable構造を行制約の基準とし、現在のTable構造を都度取得して置き換えない。
- `tbody`外を移動先として成立させない。
- 行移動後にSession開始時のTable構造を壊す位置を有効な移動先として成立させない。
- Sessionが保持する最終有効移動先だけを根拠にcompleteを確定しない。
- completeは移動対象、最終移動先、Table同一性が現在のTable構造でも成立することを確認できた場合だけ新しい行順を確定する。
- complete時の再照合が成立しない場合は外部環境変化による正常な中止として扱い、新しい行順を確定しない。
- cancel、開始拒否、外部環境変化による終了は新しい行順を確定しない。
- DnD終了理由の内部Error / 外部環境変化という分類だけで利用者向け通知要否を決めない。
- cancelまたは成立しないdropを異常終了通知の対象にしない。
- Reorder Modeの排他状態または対象Table IdentityをSession状態として所有しない。
- 通常のoperation boundaryへ伝播できないexecution boundaryは独自のlogやrecoveryを所有せず、元のoperation情報とErrorを同じ共通中止経路へ渡す。
- 共通中止経路で回復を所有した内部ErrorをWordPress Editor全体へ再throwしない。
- 同じ内部Errorを複数箇所で記録しない。
- 内部Errorと正常な中止を同じログ対象として扱わない。

#### Reorder Presentation {#RESP_ROW_PRESENTATION}

##### Responsibility

行並び替えに必要な利用者向け一時表示を表現する。移動対象の強調、水平挿入線、周囲行の移動、移動不可理由、およびDesignで定義されたDnD異常終了時の短い通知をRow Reorderが所有する範囲で扱う。行・列共通の初回案内と再案内は扱わない。

##### State ownership

行DnD表示と一時的な終了通知に必要な状態だけを所有し、共通入口案内状態、Tableデータ、行DnD確定状態を所有しない。

##### Contract

DnD Interactionから行DnDの表示状態と、終了時の利用者向け通知要否を受け取り、現在のWordPress Editorで利用者へ表現する。終了要求では該当するDnD中だけの表示を解除し、通知対象の場合だけDesignで定義された異常終了メッセージを表示する。cancelまたは成立しないdropでは異常終了メッセージを表示しない。

##### Lifecycle

行DnDの各表示理由が成立した期間だけ有効となり、complete、cancel、継続不能、recoveryに応じて該当するDnD中の一時表示を破棄する。異常終了通知はDesignで定義された終了結果に対してだけ一時的に表示する。

##### Invariants

- 表示状態をTableデータの正本として扱わない。
- 無効な移動先を確定可能な挿入位置として表示しない。
- cancelまたは成立しないdropで異常終了メッセージを表示しない。
- 初回案内表示済み状態や行・列共通の入口案内状態を所有しない。
- Column Reorderの表示状態を共有しない。

#### Auto Scroll {#RESP_ROW_AUTO_SCROLL}

##### Responsibility

行DnD中に、移動継続に必要な縦方向の自動スクロールだけを判断・制御する。

##### State ownership

行DnDに必要な自動スクロール一時状態だけを所有する。

##### Contract

activeな行DnD、現在のEditor DOM Context、および現在のEditor Scroll Areaを利用し、必要な場合だけ縦方向へスクロールする。DnD終了時には自動スクロール状態を終了する。

通常のoperation boundaryへErrorを伝播できない非同期callback等を利用する場合、そのexecution boundaryは独自のlogやrecoveryを所有せず、元のoperation情報とErrorをDnD Interactionの共通中止経路へ渡す。

##### Lifecycle

active Session中だけ活動し、complete、cancel、継続不能、内部Error recoveryで終了する。

##### Invariants

- 横方向の自動スクロールを開始しない。
- Column Reorderのスクロール規則を抽象化して所有しない。
- 現在のEditor Scroll Areaを利用できない状態を内部Invariant違反として扱わない。
- execution boundaryで捕捉したErrorを独自に記録または回復しない。

## 6. Runtime View

### Row DnD start attempt {#RV_ROW_DND_START}

行並び替えが有効な状態で、開始位置から移動可能な行を確定してSessionを開始するか、正常に開始を拒否するまでを示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnDのstart operationと開始位置を渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在の対象Table情報を要求する。 |
| 3 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の対応Table Blockから行構造とTable同一性を取得する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_DND_INTERACTION | 開始位置から移動対象行を解決し、現在の行構造で移動可能かを判定する。成立した場合は開始時Table構造とともにSessionを開始する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | Session開始時は移動対象行のDnD表示を開始し、開始拒否時は必要な理由表示を要求する。 |

### Row DnD progress {#RV_ROW_DND_PROGRESS}

activeな行Session中に、Session開始時のTable構造を利用して現在位置から有効な移動先と必要な表示・自動スクロールを更新する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnDのprogress operationと現在位置を渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_DND_INTERACTION | Session開始時のTable構造に対して現在位置に対応する有効な行間を判定し、有効な移動先だけをSessionへ保持する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | 現在の移動先と周囲行の一時表示を更新する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 現在位置に応じた縦方向自動スクロールの更新を要求する。 |
| 5 | RESP_ROW_AUTO_SCROLL | EXT_SCROLL_AREA | 必要な場合だけ現在のEditor Scroll Areaを縦方向へスクロールする。 |

### Row DnD complete {#RV_ROW_DND_COMPLETE}

Sessionが保持する最終有効移動先を現在のTable構造へ再照合し、その移動が現在も成立する場合だけ行順を確定する。その後SessionとDnD中だけの一時状態を終了し、現在の行並び替えモードを維持する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnDのcomplete operationを渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在のTable同一性と行構造を要求する。 |
| 3 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の対応Table Blockから行構造とTable同一性を取得する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_DND_INTERACTION | Sessionの移動対象と最終有効移動先が現在のTable構造でも成立するか再照合する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在も成立することを確認できた場合だけ確定済み行移動の反映を要求する。 |
| 6 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | `tbody`の行順だけを確定結果として更新する。 |
| 7 | RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した行並び替えを1回のUndoで戻せる更新単位として維持する。 |
| 8 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を終了する。 |
| 9 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 行DnDの自動スクロール状態を終了する。 |
| 10 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | complete終了後も現在のTableで行並び替えモードを維持できる結果を渡す。 |

Step 4で現在のTable構造に対して移動が成立しない場合はStep 5以降の更新へ進まず、`RV_ROW_DND_EXTERNAL_ABORT`と同じ安全な中止へ合流する。

### Row DnD external change abort {#RV_ROW_DND_EXTERNAL_ABORT}

EditorやTableの外部状態変化によって継続できなくなった場合、またはcomplete時の再照合でSessionの最終移動先が現在のTable構造では成立しなくなった場合に、内部Errorとして扱わず、安全に行DnDを終了する。終了理由の内部分類とは別に、Design上の通知要否とReorder Mode継続可否を判断する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | complete時は現在の対象Table情報を要求する。 |
| 2 | RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | 現在のTable情報、または対象Tableが利用できない正常な不在を返す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_DND_INTERACTION | 現在構造では移動を確定できない場合、正常な確定不能結果として共通中止経路へ合流する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を解除し、安全な操作継続不能による終了としてDesignで定義された通知を要求する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 自動スクロール状態を終了する。 |
| 6 | RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | 入力方式固有のDnD一時状態を終了する。 |
| 7 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。 |

Editor contextの消失など、Table Integrationを経由しない外部環境変化でも、更新を開始せずStep 4以降と同じ安全な中止へ合流する。Reorder ModeはStep 7の結果が継続可能なら`row`を維持し、現在のTableに対するモード自体を継続できない場合だけ`edit`へ戻る。

### Row DnD internal failure recovery {#RV_ROW_DND_FAILURE_RECOVERY}

Row Reorder内部のErrorがstart、progress、complete、cancelのoperation boundaryへ伝播した場合、または通常のoperation boundaryへ伝播できないexecution boundaryで受け止められた場合に、同じ行専用共通中止経路でidleへ復帰する。内部Errorという分類とは別にDesign上の異常終了通知を行い、その後のReorder Mode継続可否を判断する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_AUTO_SCROLL | RESP_ROW_DND_INTERACTION | 通常のoperation boundaryへ伝播できないexecution boundaryで捕捉したErrorを、元のoperation情報とともに同じ共通中止経路へ渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | 共通中止経路としてDnD中だけの表示を解除し、Designで定義された異常終了通知を要求する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 共通中止経路として自動スクロール状態を終了する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | 共通中止経路として入力方式固有のDnD一時状態を終了する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。 |

通常のoperation boundaryへ直接伝播できるErrorもStep 2以降と同じ共通中止経路へ合流する。DnD Interactionは対象operationと元のErrorを一度だけ記録し、Sessionを破棄してidleへ戻る。execution boundaryや発生責務は独自の記録または回復を行わない。Reorder ModeはStep 5の結果が継続可能なら`row`を維持し、現在のTableに対するモード自体を継続できない場合だけ`edit`へ戻る。

## 8. Crosscutting Concepts

### 行専用責務境界

本書のTable Integration、Input Interaction、DnD Interaction、Reorder Presentation、Auto Scroll、Rediscovery DetectionはすべてRow Reorderだけを実現する責務である。

責務名から`Row`を省いても、Column Reorderとの共通責務を意味しない。Row / Columnの独立性は文書境界、Architecture Constraints、状態所有、Contract、Invariantで保証する。

### 外側のモード境界と案内境界

Reorder ModeとReorder GuidanceはRow Reorderの外側にある。Reorder ModeはTableツールバーの行・列入口、`edit | row | column`の排他状態、および`row | column`を関連付ける最小限のTable Identityを所有する。Reorder GuidanceはPC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態だけを所有する。

Reorder Modeは`row | column`中の対象Table編集を開始させず、通常編集と並び替えモードを排他的に成立させる。同じTable内では選択中モードを維持し、別Blockを選択した場合は`edit`へ戻る。Toolbar componentのunmount / remountはそれ自体ではLifecycle境界としない。

Row Reorderは通常編集時に行を移動しようとする操作の検出を所有できるが、その検出結果を列入口まで含む案内状態へ変換しない。Column Reorder側の検出状態や内部仕様にも依存しない。Row Reorderへ公開されるReorder Mode情報は、対象Tableで行並び替えが有効であることだけとする。

### 外部Contextの分類

Architecture Modelでは外部要素を同一の汎用要素として扱わず、WordPress Editorを`External System`、Supported Table Blockを`External Block`、WordPress Undoを`External Capability`、Editor Scroll Areaを`External Environment`として分類する。

この分類はStructurizr生成時のArchitecture Modelにも引き継がれ、内部Responsibilityと外部要素の境界を図上でも区別する。

### complete時の現在構造への再照合

progressで成立した移動先は、Session開始時のTable構造に対する結果であり、completeまで外部Table状態が不変であることを保証しない。

completeではSessionが保持する移動対象、最終有効移動先、Table同一性をTable Integrationから取得し直した現在のTable情報へ再照合し、その移動が現在も成立する場合だけTable Integrationの行更新境界へ確定済み行移動の反映を要求する。成立しない、または現在情報を安全に取得できない場合は外部環境変化による正常な中止として扱い、新しい並び替え結果を確定しない。

### 正常な不在と内部Error

Editor DOM Contextを解決できない、対象Tableが外部状態変化で存在しない、移動可能な行がない、有効な移動先がない、complete時に最終移動先が現在構造では成立しない、といった状態は成立し得る正常な結果として表現する。

一方、Row Reorderが所有するTable同一性の矛盾や、Contract上成立しないSession状態など、型だけでは防げないRow Reorder所有のInvariant違反はErrorとして扱う。

内部責務はErrorを`null`、silent return、fallback値へ変換しない。通常はErrorを行DnD operation boundaryへ伝播させ、回復責務を一箇所へ集約する。

### execution boundaryとError回復

非同期callback等、通常のstart、progress、complete、cancelのoperation boundaryへErrorを伝播できないexecution boundaryだけは、その場でErrorを受け止めてよい。

execution boundaryは独自のlog、retry、fallback、Session破棄、表示解除などを所有せず、元のoperation情報と元のErrorをDnD Interactionの同じ行専用共通中止経路へ渡す。DnD Interactionが一度だけ記録し、Sessionと一時状態を破棄してidleへ戻す。

### 安全な終了

正常cancel、成立しないdrop、外部環境変化による継続不能または確定不能、内部Error recoveryはいずれも、Row Reorder内の同じ中止処理原則に従ってSessionとDnD中だけの一時状態を破棄し、安全なidleへ戻す。

終了理由の内部分類と利用者向け通知要否は分離する。cancelまたは成立しないdropでは異常終了通知を行わず、安全な操作継続ができずDnDを終了した場合はDesignで定義された通知を行う。内部Errorだけがエラー記録の対象であり、外部環境変化を内部Errorとして記録しない。

DnD終了後、現在のTableで選択中のReorder Modeを安全に継続できる場合はそのモードを維持する。現在のTableに対するReorder Mode自体を安全に継続できない場合だけ`edit`へ戻る。Table更新がすでに成立している場合は終了処理で自動的に巻き戻さず、その時点のTable状態を後続操作の基準とする。

### Compatibility

Core TableとFlexible Table Blockの表現差はTable Integrationが吸収する。Editorのiframe / non-iframe差はEditor DOM Contextを通して扱い、Row Reorder本体がEditor方式を判定して分岐しない。

### Performance

Row Reorderは、対応Table Block本体の属性更新や再描画に要する時間そのものを性能保証せず、その前後に自身が追加する並び替え計算、状態更新、表示更新などのコストを抑える。

代表的な大規模Tableは最大保証規模ではなく、Row Reorder自身が原因となる新たな長時間停止を追加していないことを確認するストレステストとして扱う。

- DnD中にTableデータの行順を更新しない。
- 移動先変更時の表示更新は、実際に表示位置が変わる行を中心に扱う。
- 行構造情報はstart時に取得してSession開始時の制約として利用し、progress中は現在構造を都度取得しない。completeでは確定直前の現在構造を取得し直す。
- complete時の再照合は確定直前の現在構造を確認するために行い、DnD中の外部Table監視責務へ拡張しない。
- 大規模Tableを理由にRow / Column共通キャッシュや共通制約抽象化を導入しない。

## 9. Architecture Decisions

### AD-01 Row ReorderをColumn Reorderから独立させる

行と列では対象範囲、制約、移動先、更新、表示、自動スクロールの意味と変更理由が異なるため、実装類似性を理由とした共通並び替え抽象化を採用しない。

### AD-02 責務名へRowを重複させない

本書自体がRow ReorderのArchitecture境界であるため、Table IntegrationやDnD Interactionなどの責務名へ`Row`を付与しない。責務名の一致はColumn Reorderとの責務同一性または実装共有を意味せず、stable IDは行専用Architecture要素として識別できる形を維持する。

### AD-03 Reorder Modeを外側のTable単位排他境界として維持する

通常編集 / 行 / 列の排他状態、Tableツールバーの行・列入口、および選択中モードのTable単位Lifecycleは方向をまたいで一つである必要があるためReorder Modeが所有する。`row | column`は入口選択時のTable Identityへ関連付け、同じTable内では維持し、別Blockの選択または現在Tableでモード自体を安全に継続できない場合に`edit`へ戻す。Row Reorderへは対象Tableで行が有効であることだけを渡し、Row / Columnの内部実装を接続する共通Reorder責務にはしない。

### AD-04 共通入口案内をRow Reorder外へ置く

初回案内はPC / タッチごとに行・列をまとめて一度だけ表示し、再案内も行・列両方の入口を提示するため、表示済み状態と共通案内状態をReorder Guidanceが所有する。入口そのものと選択状態はReorder Modeが所有する。Row Reorderは行を移動しようとする操作の検出だけを所有し、Column Reorderとの共通並び替え抽象化は導入しない。

### AD-05 DnD Interactionを回復境界とする

行DnD SessionのLifecycleを所有する責務が、start、progress、complete、cancelのoperation boundaryで内部Errorを捕捉し、共通中止経路、エラー記録、idle復帰を所有する。通常のoperation boundaryへ伝播できないexecution boundaryはErrorを同じ共通中止経路へ渡すだけとし、独自のlogやrecoveryを所有しない。これにより各内部責務に回復責務を分散させない。

### AD-06 外部環境変化を内部Invariant違反として扱わない

Editor lifecycle、DOM availability、Supported Table Block availability、外部TableデータはRow Reorderの所有外で正当に変化し得るため、正常な不在または継続不能として扱う。progress後にTable構造が変化し、complete時に最終移動先が成立しなくなった場合も正常な確定不能として扱う。runtime assertionはRow Reorderが所有する値レベルのInvariantに限定する。

### AD-07 complete時に現在構造へ再照合する

progress時にSession開始時のTable構造に対して成立した最終移動先を確定時まで有効とみなさず、completeで現在のTable構造を取得し直して移動対象と最終移動先を再照合する。現在も成立することを確認できた場合だけTable Integrationの行更新境界へ進み、成立しない場合は新しい並び替え結果を確定せず正常に終了する。

### AD-08 Failure / Recoveryを回復パターンごとに分離する

異常系Process Flowを一つの大きなViewへ集約せず、外部環境変化、Session開始前の内部failure、active DnD中の内部failure、Table更新failureに分ける。これにより、エラー記録の有無、Sessionの有無、更新後のrollback禁止など、回復意味の違いを図から判別できるようにする。利用者向け通知要否はこの内部分類とは別に扱う。

## 10. Quality Requirements

- **Performance**: 対応Table Block本体の属性更新・再描画性能は保証対象とせず、Row Reorder自身が追加する並び替え計算、状態更新、表示更新などによって対象Table本来の更新コストを大きく悪化させない責務分離とLifecycleを採用する。代表的な大規模Tableでは、Row Reorder自身が新たな長時間停止を追加していないことをストレステストで確認する。
- **Compatibility**: WordPress 6.8以上のBlock Editorにおけるiframe / non-iframe差と、Core Table / Flexible Table Block差を、利用者向け行並び替えの正しさへ漏らさない。
- **Reliability / Robustness**: 外部環境変化またはRow Reorder内部Errorが発生しても、TableやWordPress Editorを不正な状態にせず、行DnD一時状態を破棄して安全なidleへ戻る。現在のTableでReorder Modeを安全に継続できる場合は選択中モードを維持し、継続できない場合だけ通常編集へ戻る。complete時は現在のTable構造で成立する移動だけを確定し、成立済み更新は終了処理で自動的に巻き戻さない。

## 11. Risks and Technical Debt

- Column ReorderのArchitectureが後から作成された際、責務名が同じでも、それだけを理由にRow Reorderとの共通実装へ統合しないよう継続して確認する必要がある。
- Reorder ModeはTableツールバー入口、排他状態、最小限のTable Identityだけを所有する境界であり、方向固有のTable構造、DnD Session、制約判定を取り込む共通Reorder責務へ拡張しないよう確認する必要がある。
- Reorder Guidanceは行・列共通の入口案内状態だけを所有する境界であり、入口選択状態、方向固有のDnD状態や制約判定を取り込む共通Reorder責務へ拡張しないよう確認する必要がある。
- stable IDの`ROW`は独立したArchitecture要素の識別に使用するものであり、Responsibilityの表示名や共通抽象化を意味しない。
- Performance最適化で状態やキャッシュを追加する場合も、外部Table状態の監視やRow / Column共通制約キャッシュへ責務を拡張しないよう所有境界を再確認する必要がある。

## 12. Glossary

- **Reorder Mode境界**: Tableツールバーの行・列並び替え入口、`edit | row | column`の排他状態、および`row | column`が有効なTableを識別するための最小限のTable Identityを所有し、各方向へその方向が有効であることだけを渡す外側の境界。
- **Reorder Guidance境界**: PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列両方の入口を提示する初回案内・再案内状態を所有するRow Reorder外側の境界。
- **Row Reorder**: `tbody`の行並び替えだけを所有する独立したArchitecture境界。本書の方向固有Responsibility全体を含む。
- **Rediscovery Detection**: 通常編集時に行を移動しようとする反復操作が成立したことだけを検出し、共通案内状態を所有せずReorder Guidanceへ通知する行専用責務。
- **行DnD Session**: 一回の行DnDに必要な移動対象、対象Table同一性、Session開始時のTable構造、現在の移動先、一時状態を保持する行専用状態。progressでは開始時のTable構造を移動先判定に利用し、Sessionの最終移動先はcomplete時の現在構造への再照合を省略する根拠にはならない。
- **正常な不在**: 外部環境変化や利用者操作上、正当に発生し得る「現在利用できない」「対象が成立しない」「現在は確定できない」という結果。
- **runtime invariant**: 型だけでは保証できず、かつRow Reorder自身が所有する値レベルの成立条件。
- **execution boundary**: 非同期callback等により通常のoperation boundaryへErrorを伝播できない実行境界。独自のlogやrecoveryを所有せず、元のoperation情報とErrorを共通中止経路へ渡す。
- **共通中止経路**: Row Reorder内のstart、progress、complete、cancelの各operation boundaryと、必要なexecution boundaryが合流し、DnD InteractionがSessionと一時状態を破棄してsafe idleへ戻す行専用の回復経路。Row / Column間の共通実装を意味しない。