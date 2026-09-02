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
- Reorder Guidance境界はPC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列の入口をまとめて提示する共通案内状態をRow Reorderの外側で所有する。
- Row Reorderは`tbody`の行だけを移動対象とし、行順以外のTable内容を変更しない。
- 行DnD中はTableデータを並べ替えず、確定した場合だけDnD InteractionがTable Integrationの行更新境界を利用して行順を更新する。
- DnD Interactionはstartで移動対象の成立可否を判定し、成立しない行ではSessionを開始しない。
- progressではSession開始時に取得した行構造上の制約を利用し、有効な移動先だけをSessionへ保持する。progressのために現在のTable構造を都度取得しない。
- completeではSessionが保持する移動対象と最終有効移動先を現在のTable構造へ再照合し、その移動が現在も成立する場合だけTable Integrationへ行順更新を要求する。成立しない場合は外部環境変化による正常な中止へ合流する。
- Auto Scrollは行DnDに必要な縦方向だけを扱い、列方向のための抽象化を持たない。
- 対応Table BlockやEditor環境の差は、Row Reorderの利用者向け挙動へ漏らさず、それぞれを所有する境界で吸収する。
- 正常な不在、外部環境変化による継続不能、内部仕様またはruntime invariant違反を区別する。
- DnD終了理由の内部Error / 外部環境変化という内部分類と、Design上の利用者向け通知要否は分離する。cancelまたは成立しないdropでは通知せず、安全な操作継続ができずDnDを終了した場合はDesignで定義された通知対象として扱う。
- 型で表現できる状態相関は型と状態モデルで保証し、runtime assertionへ戻さない。runtime assertionはRow Reorderが所有し、型だけでは保証できない値レベルのInvariantに限定する。
- 内部エラーはRow Reorder内部で局所的に握り潰さず、DnDのstart、progress、complete、cancelのoperation boundaryまで伝播させる。
- 通常のoperation boundaryへErrorを伝播できない非同期callback等のexecution boundaryだけはErrorを受け止めてよい。その境界は独自の記録や回復を行わず、元のoperation情報とErrorをDnD Interactionの同じ行専用共通中止経路へ渡す。
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

Editor DOM ContextはWordPress Editorの現在のeditor contextからDOM / Web APIを利用するためのcontextを解決する。Table IntegrationはSupported Table Blockとの差を吸収し、行構造取得と確定済み行移動の更新境界を提供する。Auto Scrollは現在のEditor Scroll Areaだけを対象とする。

## 4. Solution Strategy

Row Reorderは、モード境界、共通入口案内境界、editor context、行の再案内候補検出、入力、Table Block差、DnD Session、表示、自動スクロールを独立したArchitecture責務として扱う。

Reorder Target ResolutionとDrop Target Resolutionは独立したArchitecture責務とせず、移動対象判定、開始時構造に基づく移動先判定、およびcomplete時の現在構造への再照合をDnD InteractionのSession Lifecycleに含める。Data Updateも独立責務とせず、DnD Interactionが確定時にTable Integrationの行更新境界を直接利用する。

DnD Interactionは行DnDのoperation boundaryとSession Lifecycleを所有する。Sessionは移動対象行、対象Table同一性、Session開始時の行構造、現在の有効移動先、DnD中の一時状態だけを保持し、列方向を識別する状態を持たない。progressは開始時構造を用いて移動先を更新し、completeでは現在構造を取得し直して再照合してから確定する。

正常な処理進行と異常時の回復は別のProcess Flow Viewで表現する。異常系は、外部環境変化、Session開始前の内部failure、active DnD中の内部failure、Table更新時のfailureに分ける。

### Process Flow Views

#### Row Reorder End-to-End {#PV_ROW_REORDER_END_TO_END kind=normal}

WordPress Editorの入力から行DnDを開始し、complete時にも現在のTable構造で成立することを確認できた行移動だけを対応Table Blockへ反映する主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_ROW_INPUT_INTERACTION | normal | WordPress Editorの入力が行並び替えの入力境界へ入る。 |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | normal | 入力方式固有の解釈から行DnDのstart、progress、complete、cancelへ進む。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | normal | start時の行構造取得、complete時の現在構造再照合、および成立した行移動の更新へ進む。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | normal | 対応Table Blockから行構造を取得し、確定時には`tbody`の行順だけを反映する。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | normal | 成立した行並び替えを1回のUndoで戻せる更新単位として維持する。 |

このViewは主要な処理進行だけを示す。Reorder Guidance、Rediscovery Detection、Presentation、Auto Scrollなどの補助責務やRuntime Interactionの往復はRuntime ViewとDependenciesで表現する。

#### External Environment Change and Recovery {#PV_ROW_EXTERNAL_CHANGE_RECOVERY kind=failure-recovery}

EditorまたはTableの外部状態変化によってactiveな行DnDを継続または確定できなくなった場合に、内部エラーとして扱わず共通中止経路へ合流し、安全に行DnDを終了する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | failure | 現在のEditor contextを利用できないなど、外部環境変化による継続不能をoperation boundaryへ合流させる。 |
| RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | failure | 対象Tableが現在利用できない、またはcomplete時の現在構造では確定できない結果をoperation boundaryへ返す。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | recovery | DnD中だけの表示状態を解除し、安全な操作継続不能による終了ではDesignで定義された通知を要求する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | recovery | 行DnDの自動スクロール一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | recovery | 入力方式固有のDnD一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | recovery | DnD終了後に現在のTableで行並び替えモードを安全に継続できるかを外側のモード境界へ渡す。 |

#### Start Failure and Recovery {#PV_ROW_START_FAILURE_RECOVERY kind=failure-recovery}

Session開始前のstart処理でRow Reorder内部のContractまたはInvariant違反が検出された場合に、Errorをstart operation boundaryへ伝播し、Sessionを成立させずidleへ戻る処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | failure | start処理中に検出されたRow Reorder所有のContractまたはInvariant違反をoperation boundaryへ伝播する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | recovery | startに属する入力一時状態を破棄し、Sessionを開始せずidleへ戻る。 |

移動対象が成立しない通常結果はこのViewのfailureに含めない。

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

#### Table Update Failure and Recovery {#PV_ROW_TABLE_UPDATE_FAILURE_RECOVERY kind=failure-recovery}

complete時の現在構造への再照合が成立した後、Table Integrationの内部Errorにより更新処理を安全に継続できなくなった場合に、Errorをoperation boundaryへ戻し、開始済み更新をretryまたはrollbackせず安全にDnDを終了する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | failure | 行順更新中に検出された内部Errorをcomplete operation boundaryへ伝播する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | recovery | DnD中だけの表示状態を解除し、異常終了としてDesignで定義された通知を要求する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | recovery | 自動スクロール一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | recovery | 入力方式固有のDnD一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | recovery | DnD終了後に現在のTableで行並び替えモードを安全に継続できるかを外側のモード境界へ渡す。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | Tableツールバーの行・列入口、`edit | row | column`の排他状態、および選択中モードのTable単位Lifecycleを所有する外側の境界。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態を所有する外側の境界。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のWordPress Editorに属するDOM / Web API contextを必要な時点で解決する。 |
| RESP_ROW_REDISCOVERY_DETECTION | Rediscovery Detection | 通常編集時の反復操作から行を移動しようとする意図が成立したことだけを検出し、外側の案内境界へ通知する。 |
| RESP_ROW_INPUT_INTERACTION | Input Interaction | PCとタッチ端末の入力固有差を行DnDのstart、progress、complete、cancelへ変換する。 |
| RESP_ROW_TABLE_INTEGRATION | Table Integration | 対応Table Blockとの差を吸収し、行並び替えに必要なTable同一性、現在構造、行更新境界を提供する。 |
| RESP_ROW_DND_INTERACTION | DnD Interaction | 行DnDのSession、移動対象・移動先判定、operation boundary、確定、中止、回復Lifecycleを所有する。 |
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
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | DnD終了後のモードLifecycle判断をReorder Modeの責務として成立させるために必要とする。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | start時の行構造取得、complete時の現在構造再照合、および成立した行移動の更新に必要とする。 |
| RESP_ROW_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 現在のeditor contextで行DnDの表示を行うために必要とする。 |
| RESP_ROW_PRESENTATION | RESP_ROW_DND_INTERACTION | active DnD状態、移動不可理由、終了時の表示解除、およびDesign上の通知要否を表示状態へ反映するために必要とする。 |
| RESP_ROW_AUTO_SCROLL | RESP_ROW_DND_INTERACTION | activeな行DnD状態と終了状態を自動スクロール判断に必要とする。 |
| RESP_ROW_AUTO_SCROLL | RESP_EDITOR_DOM_CONTEXT | 現在のeditor contextでスクロール対象を扱うために必要とする。 |
| RESP_ROW_AUTO_SCROLL | EXT_SCROLL_AREA | 行DnD中に縦方向へスクロールできる外部領域を必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_ROW_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_REDISCOVERY_DETECTION RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL |
| DV_ROW_EDITOR_INTERACTION | Editor Interaction | EXT_WORDPRESS_EDITOR RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_REDISCOVERY_DETECTION RESP_ROW_INPUT_INTERACTION |
| DV_ROW_DND_CORE | DnD Core | EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_REORDER_MODE RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION |
| DV_ROW_FEEDBACK | DnD Feedback | EXT_SCROLL_AREA RESP_EDITOR_DOM_CONTEXT RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

Tableツールバーの「行を並び替え」「列を並び替え」の入口、入口選択、および`edit | row | column`の排他状態を所有する。Row Reorderへは行並び替えが有効であることだけを提供する。

##### State ownership

`edit | row | column`の排他状態と、`row | column`が現在どのTableに対して有効かを識別するための最小限のTable Identityを所有する。Table内容、行・列構造、移動対象、移動先、行DnD Sessionは所有しない。

##### Contract

Tableツールバーの入口選択を受け取り、行または列のモードを選択したTable Identityへ関連付ける。行DnD終了時は、Row Reorderから現在のTableで行並び替えモードを安全に継続できるかという結果だけを受け取る。

##### Lifecycle

`edit`から開始する。入口選択により`row`または`column`へ移行する。同じTable内では現在のモードを維持し、別Blockを選択した場合は`edit`へ戻る。DnDのcomplete、cancel、成立しないdropだけではReorder Modeを終了しない。

##### Invariants

- 同時に有効なモードは一つだけとする。
- `row | column`は必ず一つのTable Identityへ関連付ける。
- DnD SessionのLifecycleを所有しない。

#### Reorder Guidance {#RESP_REORDER_GUIDANCE}

##### Responsibility

初めて利用する人への案内と通常編集時の再案内について、Reorder Modeが所有する「行を並び替え」と「列を並び替え」の入口をまとめて提示する外側の案内境界を所有する。

##### State ownership

PCとタッチ端末ごとの初回案内表示済み状態、現在の共通入口案内状態、および案内抑制状態を所有する。入口の選択状態、行DnD Sessionは所有しない。

##### Contract

設計で定義された初回案内条件と方向固有の再案内候補を受け取り、必要な場合だけ行・列両方の入口を確認できる共通案内を提示する。

##### Lifecycle

初回案内は各操作環境で未表示の状態から表示契機により案内状態となり、いずれかの入口選択または案内終了で表示済みとなる。

##### Invariants

- 初回案内と再案内では行・列両方の入口をまとめて提示する。
- 行または列固有のDnD Sessionを共通案内状態として保持しない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のWordPress Editorに属する基準から、その時点でDOM / Web APIを利用するためのeditor contextを解決する。

##### State ownership

解決したcontextをeditor lifecycleをまたぐ永続状態として所有しない。

##### Contract

現在のeditor contextを安全に提供できる場合だけ、そのcontextを必要な責務へ提供する。現在のcontextを解決できない場合は、以前のcontextへfallbackせず正常な不在を返す。

##### Lifecycle

DOM / Web APIを必要とする時点で現在のeditor contextを解決する。Editor lifecycleが変化した場合は現在の基準から解決し直す。

##### Invariants

- 現在のWordPress Editorとは異なるcontextをfallbackとして提供しない。
- iframe / non-iframeというEditor方式を利用側へ判定させない。

#### Rediscovery Detection {#RESP_ROW_REDISCOVERY_DETECTION}

##### Responsibility

通常編集時に、行を移動しようとする操作が短時間に繰り返されたと判断できる場合に、その行固有の再案内候補だけを検出する。

##### State ownership

行を移動しようとする反復操作の成立判定に必要な短期状態だけを所有する。行DnD Sessionは所有しない。

##### Contract

通常編集状態で観測した操作から、行を移動しようとする反復操作が成立したかを判定し、成立した場合はReorder Guidanceへ通知する。

##### Lifecycle

通常編集状態でだけ判定を行い、行並び替えまたは列並び替えが有効になった場合は短期状態を破棄する。

##### Invariants

- 一度だけの短いドラッグや通常の編集操作を行移動意図の成立として扱わない。
- Column Reorderの内部状態を判定に利用しない。

#### Input Interaction {#RESP_ROW_INPUT_INTERACTION}

##### Responsibility

PCとタッチ端末の入力固有の差を、行DnDのstart、progress、complete、cancelという共通のoperationへ変換する。

##### State ownership

入力方式固有の一時状態だけを所有する。行DnD Session、移動対象判定、移動先判定、Tableデータを所有しない。

##### Contract

Reorder Modeから対象Tableで行並び替えが有効であることを受け取り、その期間だけ行DnD入力を受理する。開始位置およびDnD中の現在位置をDnD Interactionへ渡し、移動対象行や移動先を解決しない。

##### Lifecycle

行並び替えが有効な期間にだけ活動する。DnD終了、モード終了、外部環境変化、内部failure recoveryで入力方式固有の一時状態を破棄する。

##### Invariants

- 列DnDを開始しない。
- PCとタッチ固有の状態をDnD InteractionへSession状態として持ち込まない。

#### Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility

Supported Table Blockとの差を吸収し、行並び替えに必要なTable同一性、現在の行構造、行更新境界を提供する。

##### State ownership

DnD Sessionや入力状態を所有しない。外部TableデータをRow Reorder独自の永続状態として複製しない。

##### Contract

現在の対応Tableについて、行制約判定と更新に必要な情報を同一Table由来の情報として提供する。対応Tableが現在存在しない、外部Table状態を安全に取得できない、または現在更新できない場合は正常な不在または更新不能結果として返す。

確定済みの移動対象と移動先、および対象Tableの同一性を受け取り、セル内容・属性・装飾その他の保持対象を変えずに行順だけを更新する。1回の成立した行並び替えをWordPress Undo上の1回の更新単位として維持する。

##### Lifecycle

要求時点のSupported Table Blockから現在情報を取得または更新する。外部Table状態が継続して不変であることを前提にせず、取得した情報を外部状態監視用の永続状態として保持しない。更新不能時に独自のretryまたはrollbackを開始しない。

##### Invariants

- 行並び替えに不要な列専用構造をContractとして要求しない。
- 対応外Blockへ不完全な行構造または更新能力を提供しない。
- `tbody`の行順以外を並び替え結果として変更しない。
- 一つの確定操作を複数回適用しない。
- 1回の成立した行並び替えを複数の独立したUndo単位へ分割しない。

#### DnD Interaction {#RESP_ROW_DND_INTERACTION}

##### Responsibility

行DnDのSessionとstart、progress、complete、cancelのoperation boundaryを所有する。移動対象判定、開始時構造に対する移動先判定、complete時の現在構造への再照合、確定、正常中止、外部環境変化による終了、内部Errorからの回復を一つの行専用Lifecycleとして管理する。

##### State ownership

activeな行DnD Sessionを所有する。Sessionは移動対象行、対象Table同一性、Session開始時に取得した行構造、現在の有効移動先、現在位置、DnD一時状態を保持する。列方向やColumn Reorderの状態は保持しない。Reorder Modeの`edit | row | column`状態または対象Table Identityは所有しない。

##### Contract

startでは開始位置とTable Identityを受け取り、Table Integrationから現在の行構造を取得する。開始位置から解決した移動対象がその構造で成立する場合だけSessionを開始し、開始時の行構造をSessionへ保持する。移動対象として成立しない場合は正常に開始を拒否する。

progressでは現在位置を受け取り、Session開始時の行構造に対して成立する移動先だけをSessionへ保持する。progressのためにTable Integrationから現在構造を都度取得しない。

completeではdrop時点の位置から最終移動先を解決し、Table Integrationから現在の行構造を取得し直す。Sessionの移動対象と最終有効移動先が現在構造でも成立する場合だけ、Table Integrationの行更新境界へ確定済み行移動の反映を要求する。再照合できない、現在は成立しない、または成立しないdropの場合は新しい行順を確定しない。

cancelまたはその他の継続不能でもTableデータを新たに確定せず終了する。内部責務から伝播したErrorはoperation boundaryで捕捉し、対象operationと元のErrorを一度だけ記録した後、共通中止経路へ合流する。

##### Lifecycle

idleからstart成功時にactiveとなる。progressはactive Sessionだけを更新する。completeでは現在構造への再照合が成立した場合だけ更新へ進み、再照合が成立しない場合は正常に中止する。complete成功、cancel、外部環境変化による正常終了、内部Error recoveryのいずれでもSessionとDnD中だけの一時状態を破棄してidleへ戻る。

##### Invariants

- active Sessionは同時に一つだけ存在する。
- 移動対象として成立しない行ではSessionを開始しない。
- progressで有効な移動先を判定する構造はSession開始時に取得した行構造とする。
- progressのために外部Tableの現在構造を都度取得しない。
- Sessionが保持する最終有効移動先だけを根拠にcompleteを確定しない。
- completeは移動対象、最終移動先、Table同一性が現在のTable構造でも成立することを確認できた場合だけ新しい行順を確定する。
- cancel、開始拒否、成立しないdrop、外部環境変化による終了は新しい行順を確定しない。
- Reorder Modeの排他状態または対象Table IdentityをSession状態として所有しない。
- 同じ内部Errorを複数箇所で記録しない。

#### Reorder Presentation {#RESP_ROW_PRESENTATION}

##### Responsibility

行並び替えに必要な利用者向け一時表示を表現する。移動対象の強調、水平挿入線、周囲行の移動、移動不可理由、およびDesignで定義されたDnD異常終了時の短い通知を扱う。

##### State ownership

行DnD表示と一時的な終了通知に必要な状態だけを所有し、Tableデータ、行DnD確定状態を所有しない。

##### Contract

DnD Interactionが所有する表示用状態からactive DnD、移動対象、現在の有効移動先、移動不可理由、および終了時の通知要否を受け取り、現在のWordPress Editorで利用者へ表現する。

##### Lifecycle

行DnDの各表示理由が成立した期間だけ有効となり、complete、cancel、継続不能、recoveryに応じて該当するDnD中の一時表示を破棄する。

##### Invariants

- 表示状態をTableデータの正本として扱わない。
- 無効な移動先を確定可能な挿入位置として表示しない。
- cancelまたは成立しないdropで異常終了メッセージを表示しない。

#### Auto Scroll {#RESP_ROW_AUTO_SCROLL}

##### Responsibility

行DnD中に、移動継続に必要な縦方向の自動スクロールだけを判断・制御する。

##### State ownership

行DnDに必要な自動スクロール一時状態だけを所有する。

##### Contract

activeな行DnDに必要な最小限の状態、現在のEditor DOM Context、および現在のEditor Scroll Areaを利用し、必要な場合だけ縦方向へスクロールする。scrollによって表示上の行位置が変化した場合は、DnD Interactionへ現在位置に対する移動先の再解決を要求する。

##### Lifecycle

active Session中だけ活動し、complete、cancel、継続不能、内部Error recoveryで終了する。

##### Invariants

- 横方向の自動スクロールを開始しない。
- Column Reorderのスクロール規則を抽象化して所有しない。
- execution boundaryで捕捉したErrorを独自に記録または回復しない。

## 6. Runtime View

### Row DnD start attempt {#RV_ROW_DND_START}

行並び替えが有効な状態で、開始位置から移動可能な行を確定してSessionを開始するか、正常に開始を拒否するまでを示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnDのstart operation、対象Table Identity、開始位置を渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在の対象Tableの行構造を要求する。 |
| 3 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の対応Table Blockから行構造を取得する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | 移動対象が成立した場合はDnD表示を開始し、成立しない場合は必要な理由表示を要求する。 |

DnD Interactionは開始位置から移動対象行を解決し、Step 2で取得した行構造で移動可能な場合だけSessionを開始する。Session開始時にはこの行構造を開始時構造として保持する。

### Row DnD progress {#RV_ROW_DND_PROGRESS}

activeな行Session中に、現在位置から開始時構造上で有効な移動先と必要な表示・自動スクロールを更新する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnDのprogress operationと現在位置を渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | Session開始時の行構造に対して成立した現在の有効移動先を表示状態へ反映する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 現在位置に応じた縦方向自動スクロールの更新を要求する。 |
| 4 | RESP_ROW_AUTO_SCROLL | EXT_SCROLL_AREA | 必要な場合だけ現在のEditor Scroll Areaを縦方向へスクロールする。 |

progressではTable Integrationから現在構造を取得し直さない。Auto ScrollでDOM上の行位置が変化した場合も、DnD InteractionはSessionが保持する現在位置と開始時構造の制約を用いて移動先を再解決する。

### Row DnD complete {#RV_ROW_DND_COMPLETE}

Sessionが保持する移動対象とdrop時点の最終有効移動先を現在のTable構造へ再照合し、その移動が現在も成立する場合だけ行順を確定する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnDのcomplete operationとdrop時点の位置を渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在の対象Tableの行構造を要求する。 |
| 3 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の対応Table Blockから行構造を取得する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在構造でも成立することを確認できた場合だけ確定済み行移動の反映を要求する。 |
| 5 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | `tbody`の行順だけを確定結果として更新する。 |
| 6 | RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した行並び替えを1回のUndoで戻せる更新単位として維持する。 |
| 7 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を終了する。 |
| 8 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 行DnDの自動スクロール状態を終了する。 |
| 9 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | complete終了後も現在のTableで行並び替えモードを維持できるかという結果を渡す。 |

現在のTable構造に対して移動対象または最終移動先が成立しない場合はStep 4以降の更新へ進まず、安全な中止へ合流する。

### Row DnD external change abort {#RV_ROW_DND_EXTERNAL_ABORT}

EditorやTableの外部状態変化によって継続できなくなった場合、またはcomplete時の再照合でSessionの移動が現在のTable構造では成立しなくなった場合に、内部Errorとして扱わず、安全に行DnDを終了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | complete時は現在の対象Table情報を要求する。 |
| 2 | RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | 現在のTable情報、または対象Tableが利用できない正常な不在を返す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を解除し、通知対象の場合だけDesignで定義された通知を要求する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 自動スクロール状態を終了する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | 入力方式固有のDnD一時状態を終了する。 |
| 6 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。 |

### Row DnD internal failure recovery {#RV_ROW_DND_FAILURE_RECOVERY}

Row Reorder内部のErrorがoperation boundaryへ伝播した場合、または通常のoperation boundaryへ伝播できないexecution boundaryで受け止められた場合に、同じ行専用共通中止経路でidleへ復帰する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_AUTO_SCROLL | RESP_ROW_DND_INTERACTION | execution boundaryで捕捉したErrorを元のoperation情報とともに共通中止経路へ渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を解除し、Designで定義された異常終了通知を要求する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 自動スクロール状態を終了する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_INPUT_INTERACTION | 入力方式固有のDnD一時状態を終了する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。 |

## 8. Crosscutting Concepts

### 行専用責務境界

本書のTable Integration、Input Interaction、DnD Interaction、Reorder Presentation、Auto Scroll、Rediscovery DetectionはすべてRow Reorderだけを実現する責務である。

Reorder Target Resolution、Drop Target Resolution、Data Updateは独立したArchitecture責務として定義しない。移動対象・移動先の判定と確定LifecycleはDnD Interactionが所有し、対応Table Blockへの行順更新はTable Integration境界を利用する。

### 外側のモード境界と案内境界

Reorder ModeとReorder GuidanceはRow Reorderの外側にある。Reorder ModeはTableツールバーの行・列入口、`edit | row | column`の排他状態、および`row | column`を関連付ける最小限のTable Identityを所有する。Reorder GuidanceはPC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態だけを所有する。

### progressの開始時構造

DnD Interactionはstartで取得した行構造をSession開始時の制約スナップショットとして保持する。progressではこの開始時構造に対して成立する移動先だけをSessionへ保持し、Table Integrationから現在構造を都度取得しない。

この開始時構造はcomplete時点の現在構造を意味しない。外部Table状態がDnD中に変化し得ることは、complete時の現在構造への再照合で扱う。

### complete時の現在構造への再照合

completeではSessionが保持する移動対象、drop時点の最終有効移動先、Table同一性を現在のTable情報へ再照合し、その移動が現在も成立する場合だけTable Integrationの行更新境界へ確定を要求する。成立しない、または現在情報を安全に取得できない場合は外部環境変化による正常な中止として扱い、新しい並び替え結果を確定しない。

### 正常な不在と内部Error

Editor DOM Contextを解決できない、対象Tableが外部状態変化で存在しない、移動可能な行がない、有効な移動先がない、complete時に最終移動先が現在構造では成立しない、といった状態は成立し得る正常な結果として表現する。

一方、Row Reorderが所有するTable同一性の矛盾や、Contract上成立しないSession状態など、型だけでは防げないRow Reorder所有のInvariant違反はErrorとして扱う。

### execution boundaryとError回復

非同期callback等、通常のstart、progress、complete、cancelのoperation boundaryへErrorを伝播できないexecution boundaryだけは、その場でErrorを受け止めてよい。

execution boundaryは独自のlog、retry、fallback、Session破棄、表示解除などを所有せず、元のoperation情報と元のErrorをDnD Interactionの同じ行専用共通中止経路へ渡す。DnD Interactionが一度だけ記録し、Sessionと一時状態を破棄してidleへ戻す。

### 安全な終了

正常cancel、成立しないdrop、外部環境変化による継続不能または確定不能、内部Error recoveryはいずれも、Row Reorder内の同じ中止処理原則に従ってSessionとDnD中だけの一時状態を破棄し、安全なidleへ戻す。

終了理由の内部分類と利用者向け通知要否は分離する。cancelまたは成立しないdropでは異常終了通知を行わず、安全な操作継続ができずDnDを終了した場合はDesignで定義された通知を行う。

### Compatibility

Core TableとFlexible Table Blockの表現差はTable Integrationが吸収する。Editorのiframe / non-iframe差はEditor DOM Contextを通して扱い、Row Reorder本体がEditor方式を判定して分岐しない。

### Performance

Row Reorderは、対応Table Block本体の属性更新や再描画に要する時間そのものを性能保証せず、その前後に自身が追加する並び替え計算、状態更新、表示更新などのコストを抑える。

- DnD中にTableデータの行順を更新しない。
- progressではSession開始時の行構造を利用し、現在のTable構造を都度取得しない。
- complete時の再照合は確定直前の現在構造を確認するために行い、DnD中の外部Table監視責務へ拡張しない。
- 大規模Tableを理由にRow / Column共通キャッシュや共通制約抽象化を導入しない。

## 9. Architecture Decisions

### AD-01 Row ReorderをColumn Reorderから独立させる

行と列では対象範囲、制約、移動先、更新、表示、自動スクロールの意味と変更理由が異なるため、実装類似性を理由とした共通並び替え抽象化を採用しない。

### AD-02 責務名へRowを重複させない

本書自体がRow ReorderのArchitecture境界であるため、Table IntegrationやDnD Interactionなどの責務名へ`Row`を付与しない。

### AD-03 Reorder Modeを外側のTable単位排他境界として維持する

通常編集 / 行 / 列の排他状態、Tableツールバーの行・列入口、および選択中モードのTable単位Lifecycleは方向をまたいで一つである必要があるためReorder Modeが所有する。

### AD-04 共通入口案内をRow Reorder外へ置く

初回案内はPC / タッチごとに行・列をまとめて一度だけ表示し、再案内も行・列両方の入口を提示するため、表示済み状態と共通案内状態をReorder Guidanceが所有する。

### AD-05 DnD Interactionを回復境界とする

行DnD SessionのLifecycleを所有する責務が、start、progress、complete、cancelのoperation boundaryで内部Errorを捕捉し、共通中止経路、エラー記録、idle復帰を所有する。

### AD-06 外部環境変化を内部Invariant違反として扱わない

Editor lifecycle、DOM availability、Supported Table Block availability、外部TableデータはRow Reorderの所有外で正当に変化し得るため、正常な不在または継続不能として扱う。

### AD-07 DnD Interactionへ対象・移動先判定と確定Lifecycleを統合する

Reorder Target ResolutionとDrop Target Resolutionを独立したArchitecture責務として維持せず、startでの移動対象判定、progressでの移動先判定、completeでの現在構造への再照合をDnD InteractionのSession Lifecycleとして扱う。これらは同じSession状態を基準に同じLifecycle理由で変更されるため、独立責務境界を設けない。

### AD-08 progressは開始時構造、completeは現在構造を使用する

progressはSession開始時に取得した行構造を制約の基準とし、外部Table構造を都度取得しない。completeでは現在のTable構造を取得し直し、移動対象と最終移動先が現在も成立する場合だけ確定する。これにより、DnD中の安定したSession判定と確定時の外部状態整合を分離する。

### AD-09 Data Updateを独立責務としない

確定済み行移動の反映だけを所有する中間責務を設けず、DnD InteractionがTable Integrationの行更新境界を直接利用する。対応Table Block固有の更新方法とWordPress Undoとの接続はTable Integration境界に留める。

### AD-10 Failure / Recoveryを回復パターンごとに分離する

異常系Process Flowを一つの大きなViewへ集約せず、外部環境変化、Session開始前の内部failure、active DnD中の内部failure、Table更新時のfailureに分ける。

## 10. Quality Requirements

- **Performance**: 対応Table Block本体の属性更新・再描画性能は保証対象とせず、Row Reorder自身が追加する並び替え計算、状態更新、表示更新などによって対象Table本来の更新コストを大きく悪化させない責務分離とLifecycleを採用する。
- **Compatibility**: WordPress 6.8以上のBlock Editorにおけるiframe / non-iframe差と、Core Table / Flexible Table Block差を、利用者向け行並び替えの正しさへ漏らさない。
- **Reliability / Robustness**: 外部環境変化またはRow Reorder内部Errorが発生しても、TableやWordPress Editorを不正な状態にせず、行DnD一時状態を破棄して安全なidleへ戻る。complete時は現在のTable構造で成立する移動だけを確定する。

## 11. Risks and Technical Debt

- Column ReorderのArchitectureが後から作成された際、責務名が同じでも、それだけを理由にRow Reorderとの共通実装へ統合しないよう継続して確認する必要がある。
- Reorder ModeはTableツールバー入口、排他状態、最小限のTable Identityだけを所有する境界であり、方向固有のTable構造、DnD Session、制約判定を取り込む共通Reorder責務へ拡張しないよう確認する必要がある。
- DnD Interactionへ判定Lifecycleを統合しても、対応Table Block固有表現やWordPress Editor Storeとの接続を取り込まず、Table Integration境界を維持する必要がある。
- Performance最適化で状態やキャッシュを追加する場合も、外部Table状態の監視やRow / Column共通制約キャッシュへ責務を拡張しないよう所有境界を再確認する必要がある。

## 12. Glossary

- **Reorder Mode境界**: Tableツールバーの行・列並び替え入口、`edit | row | column`の排他状態、および`row | column`が有効なTableを識別するための最小限のTable Identityを所有する外側の境界。
- **Reorder Guidance境界**: PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列両方の入口を提示する初回案内・再案内状態を所有するRow Reorder外側の境界。
- **Row Reorder**: `tbody`の行並び替えだけを所有する独立したArchitecture境界。
- **行DnD Session**: 一回の行DnDに必要な移動対象、対象Table同一性、Session開始時の行構造、現在の移動先、現在位置、一時状態を保持する行専用状態。開始時構造はcomplete時の現在構造を意味しない。
- **正常な不在**: 外部環境変化や利用者操作上、正当に発生し得る「現在利用できない」「対象が成立しない」「現在は確定できない」という結果。
- **runtime invariant**: 型だけでは保証できず、かつRow Reorder自身が所有する値レベルの成立条件。
- **execution boundary**: 非同期callback等により通常のoperation boundaryへErrorを伝播できない実行境界。独自のlogやrecoveryを所有せず、元のoperation情報とErrorを共通中止経路へ渡す。
- **共通中止経路**: Row Reorder内のstart、progress、complete、cancelの各operation boundaryと、必要なexecution boundaryが合流し、DnD InteractionがSessionと一時状態を破棄してsafe idleへ戻す行専用の回復経路。