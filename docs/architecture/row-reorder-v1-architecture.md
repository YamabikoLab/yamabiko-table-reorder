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
- DnD Engineは物理入力の継続、物理的なDnD状態、現在の物理入力位置、および自動スクロールの実行を担う。Row Reorderは現在の物理入力位置から対象Table内の移動先候補を解決して意味状態へ変換し、DnD Engine固有の物理状態を行DnD Sessionへ保持しない。
- 行DnDに必要な開始候補のDnD Engineへの接続は、行並び替えモード開始時にTable全体へ固定的に準備せず、そのDnDで必要になった時点だけ一時的に成立させる。移動先候補はDnD Engineへ登録せず、Row Reorderが現在の物理入力位置から解決する。
- DnD Engineが提供する標準の移動表示は利用せず、行DnD中の利用者向け表示はReorder Presentationが独立して所有する。
- completeではSessionが保持する最終有効移動先を現在のTable構造へ再照合し、その移動が現在も成立する場合だけDnD InteractionからTable Integrationへ確定済み行移動の反映を要求する。成立しない場合は外部環境変化による正常な中止へ合流する。
- Auto Scrollは行DnDに必要な縦方向と対象Tableに必要な範囲だけを許可し、物理的なスクロール検出・速度制御・実行はDnD Engineへ委ねる。列方向のための抽象化を持たない。
- 対応Table BlockやEditor環境の差は、Row Reorderの利用者向け挙動へ漏らさず、それぞれを所有する境界で吸収する。
- 正常な不在、外部環境変化による継続不能、内部仕様またはruntime invariant違反を区別する。
- 内部Errorは利用者向け通知の理由とせず、外部環境変化等についてDesignで定義される利用者向け通知要否とは分離する。
- 型で表現できる状態相関は型と状態モデルで保証し、runtime assertionへ戻さない。runtime assertionはRow Reorderが所有し、型だけでは保証できない値レベルのInvariantに限定する。
- 実装の単純さと保守性を、想定外のError発生後にRow Reorder全体を完全復旧することより優先する。
- Row Reorder内部のContractまたはruntime invariant違反はErrorとして扱う。
- 内部Errorは原則として握りつぶさず、正常な結果へ変換しない。
- Error処理のために通常処理の状態、戻り値、公開境界、Lifecycleを複雑化しない。
- 想定外のError発生後に、DnD Engine接続、一時表示、自動スクロール、Reorder Modeその他のRow Reorder全体の完全な状態復旧は保証しない。
- 外部環境変化による継続不能は内部Errorとして扱わず、通常の終了結果として扱う。
- Performanceの責任境界は、対応Table Block本体の属性更新・再描画性能ではなく、Row Reorder自身が追加する並び替え処理のコストとする。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | `QR-02`で保証対象とする編集環境を提供し、Row Reorderの入力と表示が存在する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | `FR-13`で定義されるCore TableまたはFlexible Table Blockであり、Table Integrationを介して行構造の取得と行順更新を行う対象。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | 行DnD中に縦方向へ自動スクロールする対象領域を提供する。 |
| EXT_DND_ENGINE | DnD Engine | External Library | 物理入力の継続、物理的なDnD状態、現在の物理入力位置、および自動スクロール実行を提供する。 |

Row ReorderはWordPress Editor、対応Table Block、WordPress Undo、Editor Scroll Area、およびDnD Engineと接続する。対応Table Blockの具体的な対象とEditor環境の保証範囲はRequirementsを正本とし、本書では再定義しない。

Editor DOM ContextはWordPress Editorの現在のeditor contextからDOM / Web APIを利用するためのcontextを解決する。Table IntegrationはSupported Table Blockとの差を吸収し、WordPress Undoの更新単位を壊さずに確定済み行移動を反映する。DnD EngineはRow Reorderの物理的なDnD進行を支え、Input Interaction、DnD Interaction、Reorder Presentation、Auto Scrollはそれぞれの責務に必要な境界だけを利用する。Auto Scrollは現在のEditor Scroll Areaに対する縦方向と許可範囲を決定し、物理的なスクロール実行はDnD Engineへ委ねる。

## 4. Solution Strategy

Row Reorderは、モード境界、共通入口案内境界、editor context、行の再案内候補検出、入力、Table Block差、DnD Engine、DnD Session、表示、自動スクロールを別責務または外部境界として扱う。移動対象判定と移動先判定はDnD InteractionのSession Lifecycleに含め、Table更新はTable Integrationの行更新境界として扱う。

Reorder ModeはTableツールバーの行・列入口と`edit | row | column`の排他状態を所有し、`row | column`を入口選択時のTable Identityへ関連付ける外側の境界である。選択中の入口の再選択では`edit`へ戻り、別方向の入口選択ではその方向へ切り替える。同じTable内では選択中のモードを維持し、別Blockを選択した場合は`edit`へ戻る。Toolbar componentのunmount / remountそのものはモード終了条件としない。Reorder Modeは行DnDのSessionや方向固有Table情報を所有せず、Row Reorderへは行DnDが有効であることだけを提供する。

Reorder Guidanceは初回案内と再案内でReorder Modeが所有する行・列の入口をまとめて案内する外側の境界であり、入口選択状態そのもの、行DnD Session、Column Reorder内部状態を所有しない。Editor DOM Contextは現在のWordPress Editorに属するDOM / Web API contextを必要な時点で解決する共有境界であり、Row Reorder固有状態を所有しない。

Rediscovery Detectionは通常編集時に行を移動しようとする反復操作だけを行側で検出し、案内表示の成立判断と表示状態はReorder Guidanceへ委ねる。

Input Interactionは行並び替えが有効な期間に入力方式固有の開始条件を判断し、開始候補だけを必要な時点でDnD Engineへ接続する。開始後の物理入力の継続、移動、終了、cancelの検出はDnD Engineへ委ねる。Input Interactionが所有する開始候補と入力方式固有の一時状態はInput Interaction自身が破棄し、DnD終了またはcancelはDnD EngineのLifecycleから検知してcleanupする。

DnD InteractionはDnD Engineが提供するDnD進行をRow Reorderの意味へ変換し、行DnDのSession Lifecycleを所有する。active DnD成立前の開始試行境界では現在のTable構造を取得して移動対象の開始可否を判定し、開始可能な場合だけ物理的なDnD成立へ進ませる。物理的なDnD開始成立後のstartでRow DnD Sessionを開始し、開始可否判定時に確認したTable構造をSession開始時の行制約として保持する。progressではDnD Engineが示す現在の物理入力位置から対象Table内の移動先候補と行間の挿入位置を解決し、Session開始時のTable構造を利用して有効な移動先を判定する。Table Integrationから現在構造を取得し直さない。Sessionは移動対象行、対象Table同一性、開始時に成立した行制約、現在の有効移動先だけを意味状態として保持し、DnD Engine固有の物理状態、入力位置、表示位置、外部参照、計測結果を保持しない。completeでは現在のTable構造を取得し直し、Sessionの移動対象と最終有効移動先を現在構造へ再照合してから、成立する場合だけTable Integrationの行更新境界を直接利用して確定する。物理的なDnD終了後は、現在のTableで行並び替えモードを安全に継続できるかという結果だけをReorder Modeへ渡し、Reorder Modeが`row`維持または`edit`復帰を決定する。Row Reorder内部のContractまたはruntime invariant違反によるErrorは通常の継続不能結果へ変換しない。

Reorder PresentationはDnD InteractionからRow Reorderの意味状態だけを受け取り、DnD Engineの物理状態が表示に必要な場合はDnD InteractionのSessionへ取り込まず直接その境界を利用する。DnD Engine標準の移動表示には依存せず、実Tableの行順をDnD中に変更しない独自の一時表示として表現する。

Auto Scrollはactiveな行DnDに対して縦方向と対象Tableに必要な許可範囲を決定し、物理的なスクロール検出、速度制御、実行はDnD Engineへ委ねる。

正常な処理進行と、外部環境変化による正常な継続不能・確定不能はProcess Flow Viewで表現する。内部ErrorはRow Reorder内に専用のFailure / Recovery Flowを持たない。

### Process Flow Views

#### Row Reorder End-to-End {#PV_ROW_REORDER_END_TO_END kind=normal}

WordPress Editorの入力からDnD Engineを介して行DnDを開始し、complete時にも現在のTable構造で成立することを確認できた行移動だけを対応Table Blockへ反映する主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_ROW_INPUT_INTERACTION | normal | WordPress Editorの入力が行並び替えの入力境界へ入る。 |
| RESP_ROW_INPUT_INTERACTION | EXT_DND_ENGINE | normal | 入力方式固有の開始条件が成立した開始候補を物理的なDnD開始境界へ接続する。 |
| EXT_DND_ENGINE | RESP_ROW_DND_INTERACTION | normal | active DnD成立前の開始試行と、成立後のstart、progress、complete、cancelをRow Reorderの意味へ解釈する境界へ渡す。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | normal | 開始可否判定時の行構造取得とcomplete時の現在構造取得・確定済み行移動の反映へ進む。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | normal | 対応Table Blockから行構造を取得し、確定時は`tbody`の行順だけを反映する。 |

このViewは主要な処理進行だけを示す。Reorder Guidance、Rediscovery Detection、Presentation、Auto Scrollなどの補助責務やRuntime Interactionの往復はRuntime ViewとDependenciesで表現する。

#### External Environment Change and Recovery {#PV_ROW_EXTERNAL_CHANGE_RECOVERY kind=failure-recovery}

EditorまたはTableの外部状態変化によってactiveな行DnDを継続または確定できなくなった場合に、内部Errorとして扱わず、通常の終了経路として安全に行DnDを終了する処理方向を示す。終了後のReorder Mode継続可否と利用者向け通知要否は、内部Errorとは別に判断する。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | failure | 現在のEditor contextを利用できないなど、外部環境変化による継続不能を通常の終了結果として渡す。 |
| RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | failure | 対象Tableが現在利用できない、または更新開始前に現在更新できないなど、外部Table状態の変化による継続不能・確定不能を通常の結果として返す。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | recovery | DnD中だけの表示状態を解除し、安全な操作継続不能による終了ではDesignで定義された通知を要求する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | recovery | 行DnDの自動スクロール一時状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | recovery | DnD終了後に現在のTableで行並び替えモードを安全に継続できるかを外側のモード境界へ渡す。 |

このViewの`failure`はProcess Flow Edgeの分類であり、内部Errorを意味しない。外部環境変化は正常に起こり得る継続不能または確定不能として扱い、内部Errorとして扱わない。

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | Tableツールバーの行・列入口、`edit | row | column`の排他状態、および選択中モードのTable単位Lifecycleを所有する外側の境界。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態を所有する外側の境界。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のWordPress Editorに属するDOM / Web API contextを必要な時点で解決する。 |
| RESP_ROW_REDISCOVERY_DETECTION | Rediscovery Detection | 通常編集時の反復操作から行を移動しようとする意図が成立したことだけを検出し、外側の案内境界へ通知する。 |
| RESP_ROW_INPUT_INTERACTION | Input Interaction | PCとタッチ端末の開始条件を解釈し、DnD開始候補と入力方式固有の一時状態を所有してDnD Engineへ接続する。 |
| RESP_ROW_TABLE_INTEGRATION | Table Integration | 対応Table Blockとの差を吸収し、行並び替えに必要なTable同一性、現在構造、行更新境界、およびWordPress Undoとの境界を提供する。 |
| RESP_ROW_DND_INTERACTION | DnD Interaction | DnD Engineの物理的なDnD進行をRow Reorderの意味状態へ変換し、行DnD Session、開始可否判定、移動先判定、確定、中止のLifecycleを所有する。 |
| RESP_ROW_PRESENTATION | Reorder Presentation | Row Reorderの意味状態と必要な物理的DnD情報から、行DnD中の独立した視覚フィードバックとDesignで定義された通知を表現する。 |
| RESP_ROW_AUTO_SCROLL | Auto Scroll | 行DnD中に許可する縦方向と対象Tableに必要なスクロール範囲を決定し、物理的な実行をDnD Engineへ委ねる。 |

### Ownership Boundaries

| ID | Name | Includes |
| --- | --- | --- |
| BOUNDARY_REORDER_COMMON | Reorder Common | RESP_REORDER_MODE RESP_REORDER_GUIDANCE |
| BOUNDARY_EDITOR_INTEGRATION | Editor Integration | RESP_EDITOR_DOM_CONTEXT |
| BOUNDARY_ROW_REORDER | Row Reorder | RESP_ROW_REDISCOVERY_DETECTION RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL |
| BOUNDARY_WORDPRESS_INTEGRATION | WordPress Integration | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA |

Reorder ModeとReorder Guidanceは行・列に共通するReorder Common境界に含める。Editor DOM Contextは現在のWordPress Editorとの共有接点を担うEditor Integration境界に含める。Row Reorder境界には行専用責務だけを含め、DnD Engineは独立した外部ライブラリ境界として含めない。WordPress Integration境界はWordPress Editorとその編集・更新環境に属する外部接点をまとめ、内部責務とは混在させない。

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
| RESP_ROW_INPUT_INTERACTION | EXT_WORDPRESS_EDITOR | PCまたはタッチ端末の開始入力を判断するために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | RESP_EDITOR_DOM_CONTEXT | 入力開始時の現在のeditor contextを利用するために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | RESP_REORDER_MODE | 行並び替えが有効な期間だけ行入力を受理するために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | EXT_DND_ENGINE | 開始条件が成立した行だけを物理的なDnD開始候補へ接続し、DnD終了またはcancelを検知して自身の一時状態を終了するために必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有の行構造取得と行順更新を行うために必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した1回の行並び替えを1回のUndoで戻せる更新単位を維持するために必要とする。 |
| RESP_ROW_DND_INTERACTION | EXT_DND_ENGINE | active DnD成立前の開始試行、成立後の物理的なDnD進行、および現在の物理入力位置をRow Reorderの意味状態へ変換するために必要とする。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | DnD Interactionがモード状態を所有せず、DnD終了後のモードLifecycle判断をReorder Modeの責務として成立させるために必要とする。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 開始可否判定時の行構造取得、complete時の現在構造への再照合、および確定した行移動の反映に必要とする。 |
| RESP_ROW_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 現在のeditor contextで行DnDの表示を行うために必要とする。 |
| RESP_ROW_PRESENTATION | EXT_DND_ENGINE | 行DnDの表示に必要な物理的なDnD情報をSessionへ取り込まず利用するために必要とする。 |
| RESP_ROW_PRESENTATION | RESP_ROW_DND_INTERACTION | 現在の有効な移動先、移動不可理由、終了時の表示解除、およびDesign上の通知要否を表示状態へ反映するために必要とする。 |
| RESP_ROW_AUTO_SCROLL | RESP_ROW_DND_INTERACTION | activeな行DnD状態と終了状態を自動スクロール判断に必要とする。 |
| RESP_ROW_AUTO_SCROLL | RESP_EDITOR_DOM_CONTEXT | 現在のeditor contextでスクロール許可範囲を扱うために必要とする。 |
| RESP_ROW_AUTO_SCROLL | EXT_SCROLL_AREA | 行DnD中に縦方向へスクロールできる外部領域を必要とする。 |
| RESP_ROW_AUTO_SCROLL | EXT_DND_ENGINE | 許可した縦方向と範囲内で物理的な自動スクロールを実行する境界として必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_ROW_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_REDISCOVERY_DETECTION RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL |
| DV_ROW_EDITOR_INTERACTION | Editor Interaction | EXT_WORDPRESS_EDITOR EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_REDISCOVERY_DETECTION RESP_ROW_INPUT_INTERACTION |
| DV_ROW_DND_CORE | DnD Core | EXT_SUPPORTED_TABLE_BLOCK EXT_DND_ENGINE RESP_REORDER_MODE RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION |
| DV_ROW_FEEDBACK | DnD Feedback | EXT_SCROLL_AREA EXT_DND_ENGINE RESP_EDITOR_DOM_CONTEXT RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL |
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

PCとタッチ端末の入力方式固有のDnD開始条件を判断し、開始候補を物理的なDnD開始境界へ接続する。DnD開始後の物理入力の継続、移動、終了、cancelの検出はDnD Engineへ委ねる。

##### State ownership

入力方式固有の開始前一時状態と、その開始試行に必要なDnD Engine接続だけを所有する。行DnD Session、移動対象の構造制約判定、移動先判定、DnD Engineが所有するactive DnDの物理状態、Tableデータを所有しない。

##### Contract

Reorder Modeから対象Tableで行並び替えが有効であることを受け取り、その期間だけ行DnD開始入力を受理する。開始条件が成立した場合は、その開始試行に必要な開始候補だけをDnD Engineへ一時的に接続する。入力開始の不成立、DnD Engineが示すDnD終了またはcancel、モード終了、外部環境変化では、自身が所有する入力方式固有の一時状態と開始候補接続を破棄する。

現在のEditor contextを利用できない場合は内部Errorへ変換せず、開始しない、またはactiveな操作を安全に終了できる継続不能結果としてDnD Interactionへ渡す。Input Interaction自身が所有する一時状態の破棄方法をDnD Interactionへ公開せず、DnD Interactionからcleanup終了要求を受けない。

##### Lifecycle

行並び替えが有効な期間にだけ活動する。開始試行時に必要な開始候補だけを準備し、DnDが成立しなかった場合はその開始試行の終了時に破棄する。active DnDが終了またはcancelされた場合はDnD EngineのLifecycleから検知し、自身の一時状態を破棄する。モード終了または外部環境変化でも同じ所有境界で破棄する。

##### Invariants

- 列DnDを開始しない。
- 行並び替えモード開始時にTable全体の開始候補を固定的に準備しない。
- PCとタッチ固有の状態をDnD InteractionへSession状態として持ち込まない。
- active DnDの物理状態、移動先判定、Auto Scrollを所有しない。
- DnD InteractionがInput Interaction所有の一時状態を直接破棄しない。
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

DnD Engineが提供する物理的なDnD進行をRow Reorderの意味へ変換し、行DnD Sessionを所有する。移動対象の開始可否判定、Session開始、現在の物理入力位置からの移動先判定と更新、現在構造への再照合、確定、正常中止、外部環境変化による終了を一つの行専用Lifecycleとして管理する。内部Errorの回復Lifecycleは所有しない。

##### State ownership

activeな行DnD Sessionを所有する。Sessionは移動対象行、対象Table同一性、開始可否判定時に確認してSession開始時に確定した行制約、現在の有効移動先だけをRow Reorderの意味状態として保持する。列方向やColumn Reorderの状態は保持しない。DnD Engineが所有する入力位置、物理的なDnD状態、自動スクロール状態、表示位置、外部参照、計測結果は保持しない。Sessionが保持する開始時行制約または移動先を外部Tableの現在構造そのものとして扱わない。Reorder Modeの`edit | row | column`状態または対象Table Identityは所有しない。

##### Contract

DnD Engineのactive DnD成立前の開始試行では、開始候補とTable Integrationから取得した現在のTable情報を用いて`tbody`の移動対象行を解決し、その行が行単位で移動可能かを判定する。`tbody`外、または`rowspan`等により行単位の移動で構造を保てない行では開始不能という正常な結果をDnD Engineへ返し、物理的なDnDもSessionも開始しない。開始可能な場合だけ物理的なDnD成立へ進み、DnD Engineから物理的なDnD開始成立を受けたstartでRow DnD Sessionを開始する。開始可否判定時に確認したTable構造をSession開始時の行制約として保持する。

progressではDnD Engineが示す現在の物理入力位置から対象Table内の移動先候補を解決し、行内の位置関係を行間の挿入位置へ変換する。Session開始時の行制約で有効な場合だけ現在の有効移動先として保持する。対象Table内に候補がない、構造制約により利用できない、または有効な移動先がない状態は`null`相当の意味状態として扱い、内部Errorにしない。progressのたびにTable Integrationから現在のTable構造を取得し直さない。DnD Engine固有の物理状態は必要な時点でRow Reorderの意味状態へ変換し、Sessionへ保持しない。

completeでは有効な最終移動先がある場合でも、Table Integrationから現在のTable情報を取得し直し、Sessionの移動対象、最終有効移動先、Table同一性が現在のTable構造でも成立することを再照合する。成立を確認でき、実際に行順が変化する場合だけTable Integrationの行更新境界へ確定済み行移動の反映を直接要求する。再照合できない、現在は成立しない、有効な最終移動先がない、または行順が変化しない場合はTableを更新せず終了する。cancelまたはその他の継続不能でもTableデータを新たに確定しない。

Row Reorder内部のContractまたはruntime invariant違反はErrorとして扱う。内部Errorを正常な不在、継続不能、確定不能として扱わず、内部Errorを理由とした利用者向け通知は要求しない。想定外のError発生後に、DnD Interactionが所有する一時状態を含むRow Reorder全体の完全な状態復旧は保証しない。外部環境変化による継続不能は内部Errorとして扱わない。

DnD終了時は、Input Interactionが所有する開始候補接続と入力方式固有の一時状態には関与せず、それらの終了はInput InteractionがDnD EngineのLifecycleを検知して自身で行う。正常な終了結果については、終了理由の内部分類とは別に利用者向け通知要否を決定する。cancelまたは成立しないdropでは通知を要求しない。

##### Lifecycle

idleでactive DnD成立前の開始試行を受け、開始不能な場合は物理的なDnDとSessionを成立させずidleを維持する。開始可能な場合だけ物理的なDnD成立へ進み、開始成立後のstartでactiveとなる。開始可否判定時に確認したTable構造をSession開始時の行制約として保持する。progressはactive Sessionだけを更新し、DnD Engineの現在の物理入力位置から対象Table内の移動先を解決して、Session開始時の行制約に対して有効な移動先だけを保持する。completeでは現在のTable構造を取得し直して移動対象と最終移動先を再照合し、成立して行順が変化する場合だけ更新へ進む。再照合が成立しない場合は正常に中止し、有効な移動先がない場合または行順が変化しない場合は正常終了する。complete成功、cancel、成立しないdrop、外部環境変化による正常終了ではSessionと自身が所有するDnD中だけの一時状態を破棄してidleへ戻る。

想定外の内部Errorは正常な終了結果と区別し、Row Reorder全体の完全復旧は保証しない。

complete成功、cancel、成立しないdropでは現在の行並び替えモードを維持できる結果をReorder Modeへ渡す。外部環境変化等により安全な操作継続ができず物理的なDnDを終了した場合は、終了後の現在Tableで行並び替えモード自体を安全に継続できるかを判定した結果をReorder Modeへ渡す。Table更新がすでに成立した後で継続不能になった場合は、成立済み更新を自動的に巻き戻さず、その時点のTable状態を後続判断の基準とする。

##### Invariants

- active Sessionは同時に一つだけ存在する。
- Sessionが参照する移動対象とTable同一性は同じ行DnD開始から成立した値である。
- SessionにはRow Reorderの意味状態だけを保持し、DnD Engine固有の物理状態、外部参照、計測結果を保持しない。
- 移動先解決のためにTable全体をDnD Engineの移動先候補として登録しない。
- `tbody`外の行を移動対象として成立させない。
- `rowspan`等により行単位の移動で構造を保てない行を移動対象として成立させない。
- progressではSession開始時に取得したTable構造を行制約の基準とし、現在のTable構造を都度取得して置き換えない。
- `tbody`外を移動先として成立させない。
- 行移動後にSession開始時のTable構造を壊す位置を有効な移動先として成立させない。
- Sessionが保持する最終有効移動先だけを根拠にcompleteを確定しない。
- completeは移動対象、最終移動先、Table同一性が現在のTable構造でも成立し、実際に行順が変化することを確認できた場合だけ新しい行順を確定する。
- complete時の再照合が成立しない場合は外部環境変化による正常な中止として扱い、新しい行順を確定しない。
- cancel、開始拒否、成立しないdrop、外部環境変化による終了は新しい行順を確定しない。
- Input Interactionが所有する開始候補接続と入力一時状態のLifecycleに関与しない。
- Reorder Modeの排他状態または対象Table IdentityをSession状態として所有しない。
- 内部Errorを理由とした利用者向け通知を要求しない。
- 外部環境変化による正常な中止を内部Errorとして扱わない。
- 想定外のError発生後にRow Reorder全体の完全な状態復旧を保証しない。

#### Reorder Presentation {#RESP_ROW_PRESENTATION}

##### Responsibility

行並び替えに必要な利用者向け一時表示を表現する。移動対象の強調、水平挿入線、周囲行の移動、移動不可理由、およびDesignで定義された通知をRow Reorderが所有する範囲で扱う。DnD Engine標準の移動表示は利用せず、行・列共通の初回案内と再案内は扱わない。

##### State ownership

行DnD表示と一時的な通知に必要な状態だけを所有し、共通入口案内状態、Tableデータ、行DnD確定状態、行DnD Session、DnD Engineの物理状態を所有しない。

##### Contract

DnD Interactionから現在の有効な移動先、移動不可理由、および終了時の利用者向け通知要否などRow Reorderの意味状態だけを受け取る。表示位置の決定に物理的なDnD情報が必要な場合はDnD Engine境界から必要な情報を利用し、DnD InteractionのSessionへ物理状態を要求しない。現在のWordPress Editorで、実Tableの行順をDnD中に変更しない一時表示として利用者へ表現する。終了要求では該当するDnD中だけの表示を解除し、通知対象の場合だけDesignで定義されたメッセージを表示する。内部Errorそのものを通知理由として扱わない。cancelまたは成立しないdropでは異常終了メッセージを表示しない。

##### Lifecycle

行DnDの各表示理由が成立した期間だけ有効となり、complete、cancel、継続不能に応じて該当するDnD中の一時表示を破棄する。通知はDesignで定義された終了結果に対してだけ一時的に表示する。

##### Invariants

- 表示状態をTableデータの正本として扱わない。
- DnD Engine標準の移動表示へ行DnDの表示責務を委ねない。
- DnD中の表示のために実Tableの行順を変更しない。
- DnD Engineの物理状態をDnD InteractionのSession経由で受け取らない。
- 無効な移動先を確定可能な挿入位置として表示しない。
- 内部Errorそのものを利用者向け通知理由として扱わない。
- cancelまたは成立しないdropで異常終了メッセージを表示しない。
- 初回案内表示済み状態や行・列共通の入口案内状態を所有しない。
- Column Reorderの表示状態を共有しない。

#### Auto Scroll {#RESP_ROW_AUTO_SCROLL}

##### Responsibility

行DnD中に、移動継続に必要な縦方向と対象Tableに必要な自動スクロール許可範囲を決定する。物理的なスクロール検出、速度制御、実行はDnD Engineへ委ねる。

##### State ownership

行DnDに必要な自動スクロール許可状態だけを所有する。DnD Engineが所有する物理的なスクロール進行は所有しない。

##### Contract

activeな行DnD、現在のEditor DOM Context、および現在のEditor Scroll Areaを利用し、対象Tableの並び替えに必要な範囲内で縦方向だけを許可する。許可された範囲内の物理的な自動スクロールはDnD Engineへ委ねる。DnD終了時には自動スクロール許可状態を終了する。

##### Lifecycle

active Session中だけ活動し、complete、cancel、継続不能で終了する。

##### Invariants

- 横方向の自動スクロールを許可しない。
- 対象Tableに必要な縦方向範囲を越える自動スクロールを許可しない。
- 物理的なスクロール検出、速度制御、実行を所有しない。
- Column Reorderのスクロール規則を抽象化して所有しない。
- 現在のEditor Scroll Areaを利用できない状態を内部Invariant違反として扱わない。

## 6. Runtime View

### Row DnD start attempt {#RV_ROW_DND_START}

行並び替えが有効な状態で、入力開始候補をDnD Engineへ接続し、active DnD成立前に移動対象の開始可否を判定する。開始可能な場合だけ物理的なDnD成立へ進み、その後Row DnD Sessionを開始する。開始不能な場合は物理的なDnDとSessionのどちらも成立させない。移動対象の解決と移動可否判定はDnD Interaction内部で行う。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | EXT_DND_ENGINE | 開始条件が成立した行だけをDnD開始候補として一時的に接続する。 |
| 2 | EXT_DND_ENGINE | RESP_ROW_DND_INTERACTION | active DnD成立前の開始試行と開始候補をRow Reorderの開始可否判定境界へ渡す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在の対象Table情報を要求する。 |
| 4 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の対応Table Blockから行構造とTable同一性を取得する。 |
| 5 | RESP_ROW_DND_INTERACTION | EXT_DND_ENGINE | 開始可否結果を返し、開始不能な場合は物理的なDnDを成立させない。 |
| 6 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | 開始不能な場合は、必要な理由表示を要求する。 |
| 7 | EXT_DND_ENGINE | RESP_ROW_DND_INTERACTION | 開始可能な場合だけ物理的なDnD開始成立をstart境界へ渡す。 |
| 8 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | Session開始時は移動対象行のDnD表示を開始する。 |

### Row DnD progress {#RV_ROW_DND_PROGRESS}

activeな行Session中に、DnD Engineの現在の物理入力位置をRow Reorderの意味へ変換し、Session開始時のTable構造を利用して有効な移動先と必要な表示・自動スクロールを更新する。移動先判定はDnD Interaction内部で行い、progressではTable Integrationから現在構造を取得し直さない。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_ROW_DND_INTERACTION | 現在の物理入力位置をprogress境界へ渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | 現在の有効な移動先とRow Reorderの表示意味を更新する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | active DnDに対する縦方向自動スクロール許可の更新を要求する。 |
| 4 | RESP_ROW_AUTO_SCROLL | EXT_DND_ENGINE | 対象Tableに必要な縦方向と許可範囲を提供する。 |
| 5 | EXT_DND_ENGINE | EXT_SCROLL_AREA | 許可範囲内で必要な場合だけ物理的な自動スクロールを実行する。 |

### Row DnD complete {#RV_ROW_DND_COMPLETE}

DnD Engineから受けた終了をRow Reorderのcompleteとして解釈し、Sessionが保持する最終有効移動先を現在のTable構造へ再照合する。その移動が現在も成立し、実際に行順が変化する場合だけ行順を確定する。その後SessionとDnD中だけの一時状態を終了し、現在の行並び替えモードを維持する。移動対象と最終移動先の再照合はDnD Interaction内部で行う。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_ROW_DND_INTERACTION | 物理的なDnD終了をcompleteまたはcancelとして解釈する境界へ渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | completeでは現在のTable同一性と行構造を要求する。 |
| 3 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の対応Table Blockから行構造とTable同一性を取得する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在も成立し、実際に行順が変化することを確認できた場合だけ確定済み行移動の反映を要求する。 |
| 5 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | `tbody`の行順だけを確定結果として更新する。 |
| 6 | RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した行並び替えを1回のUndoで戻せる更新単位として維持する。 |
| 7 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を終了する。 |
| 8 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 行DnDの自動スクロール許可状態を終了する。 |
| 9 | EXT_DND_ENGINE | RESP_ROW_INPUT_INTERACTION | DnD終了またはcancelのLifecycleを通知し、Input Interactionが自身の開始候補と入力一時状態を破棄する。 |
| 10 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | complete終了後も現在のTableで行並び替えモードを維持できる結果を渡す。 |

現在のTable構造に対して移動が成立しない場合はStep 4以降の更新へ進まず、`RV_ROW_DND_EXTERNAL_ABORT`と同じ安全な中止へ合流する。有効な最終移動先がない場合または行順が変化しない場合は更新せず正常終了する。

### Row DnD external change abort {#RV_ROW_DND_EXTERNAL_ABORT}

EditorやTableの外部状態変化によって継続できなくなった場合、またはcomplete時の再照合でSessionの最終移動先が現在のTable構造では成立しなくなった場合に、内部Errorとして扱わず、安全に行DnDを終了する。終了理由の内部分類とは別に、Design上の通知要否とReorder Mode継続可否を判断する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | complete時は現在の対象Table情報を要求する。 |
| 2 | RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | 現在のTable情報、または対象Tableが利用できない正常な不在を返す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を解除し、安全な操作継続不能による終了としてDesignで定義された通知を要求する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 自動スクロール許可状態を終了する。 |
| 5 | EXT_DND_ENGINE | RESP_ROW_INPUT_INTERACTION | DnD終了またはcancelのLifecycleを通知し、Input Interactionが自身の開始候補と入力一時状態を破棄する。 |
| 6 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。 |

Editor contextの消失など、Table Integrationを経由しない外部環境変化でも、更新を開始せずStep 3以降と同じ安全な中止へ合流する。Reorder ModeはStep 6の結果が継続可能なら`row`を維持し、現在のTableに対するモード自体を継続できない場合だけ`edit`へ戻る。

## 8. Crosscutting Concepts

### 行専用責務境界

本書のTable Integration、Input Interaction、DnD Interaction、Reorder Presentation、Auto Scroll、Rediscovery DetectionはすべてRow Reorderだけを実現する責務である。

責務名から`Row`を省いても、Column Reorderとの共通責務を意味しない。Row / Columnの独立性は文書境界、Architecture Constraints、状態所有、Contract、Invariantで保証する。

### 外側のモード境界と案内境界

Reorder ModeとReorder GuidanceはRow Reorderの外側にある。Reorder ModeはTableツールバーの行・列入口、`edit | row | column`の排他状態、および`row | column`を関連付ける最小限のTable Identityを所有する。Reorder GuidanceはPC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態だけを所有する。

Reorder Modeは`row | column`中の対象Table編集を開始させず、通常編集と並び替えモードを排他的に成立させる。同じTable内では選択中モードを維持し、別Blockを選択した場合は`edit`へ戻る。Toolbar componentのunmount / remountはそれ自体ではLifecycle境界としない。

Row Reorderは通常編集時に行を移動しようとする操作の検出を所有できるが、その検出結果を列入口まで含む案内状態へ変換しない。Column Reorder側の検出状態や内部仕様にも依存しない。Row Reorderへ公開されるReorder Mode情報は、対象Tableで行並び替えが有効であることだけとする。

### DnD Engine境界

DnD Engineにはdnd-kitを採用し、Architecture上は具体的なLifecycle名、入力検出機構、DnD対象の登録単位、移動先解決の具体的なDOM計測方法から独立した外部境界として扱う。

Input Interactionは開始条件と開始候補の一時接続だけを所有し、開始後の物理的なDnD継続をDnD Engineへ委ねる。DnD Interactionはactive DnD成立前の開始可否判定と、成立後の現在の物理入力位置から対象Table内の移動先をRow Reorderの意味状態へ変換する責務を所有し、Sessionには移動対象、Table同一性、開始時行制約、現在の有効移動先だけを保持する。Reorder PresentationはRow Reorderの意味状態を表示へ変換し、必要な物理的DnD情報をSessionへ持ち込まない。Auto Scrollは縦方向と対象Tableに必要な許可範囲だけを決定し、物理的なスクロール実行をDnD Engineへ委ねる。

開始候補のDnD Engine接続は、行並び替えモード開始時にTable全体へ固定的に成立させず、そのDnDで必要になった時点だけ一時的に成立させる。Input Interactionが所有する開始候補はInput Interactionが破棄する。移動先候補はDnD Engineへ登録せず、DnD Interactionが現在の物理入力位置から対象Table内で解決する。DnD終了またはcancelはInput InteractionがDnD EngineのLifecycleから検知し、自身が所有する開始候補と入力一時状態を破棄する。

DnD Engine標準の移動表示は使用せず、行DnD中の視覚表現はReorder Presentationが独立して所有する。DnD中に実Tableの行順は変更せず、行順更新はcompleteで現在構造への再照合が成立した場合だけTable Integrationを介して行う。

### 外部Contextの分類

Architecture Modelでは外部要素を同一の汎用要素として扱わず、WordPress Editorを`External System`、Supported Table Blockを`External Block`、WordPress Undoを`External Capability`、Editor Scroll Areaを`External Environment`、DnD Engineを`External Library`として分類する。

この分類はStructurizr生成時のArchitecture Modelにも引き継がれ、内部Responsibilityと外部要素の境界を図上でも区別する。

### complete時の現在構造への再照合

progressで成立した移動先は、Session開始時のTable構造に対する結果であり、completeまで外部Table状態が不変であることを保証しない。

completeではSessionが保持する移動対象、最終有効移動先、Table同一性をTable Integrationから取得し直した現在のTable情報へ再照合し、その移動が現在も成立し、実際に行順が変化する場合だけTable Integrationの行更新境界へ確定済み行移動の反映を要求する。成立しない、または現在情報を安全に取得できない場合は外部環境変化による正常な中止として扱い、新しい並び替え結果を確定しない。有効な移動先がない場合または行順が変化しない場合は更新せず正常終了する。

### 正常な不在と内部Error

Editor DOM Contextを解決できない、対象Tableが外部状態変化で存在しない、移動可能な行がない、有効な移動先がない、complete時に最終移動先が現在構造では成立しない、といった状態は成立し得る正常な結果として表現する。

一方、Row Reorderが所有するTable同一性の矛盾や、Contract上成立しないSession状態など、型だけでは防げないRow Reorder所有のInvariant違反はErrorとして扱う。

内部責務はErrorを`null`、silent return、fallback値へ変換しない。

### 内部Error処理

実装の単純さと保守性を、想定外のError発生後にRow Reorder全体を完全復旧することより優先する。Error処理のために通常処理の状態、戻り値、公開境界、Lifecycleを複雑化しない。内部Errorを理由とした利用者向け通知は行わない。

想定外のError発生後に、DnD Engine接続、一時表示、自動スクロール、Reorder Modeその他のRow Reorder状態の完全復旧は保証しない。

### 安全な終了

正常cancel、成立しないdrop、外部環境変化による継続不能または確定不能は、Row Reorder内の通常の終了処理としてSessionとDnD中だけの一時状態を破棄し、安全なidleへ戻す。内部Errorはこれらの正常な終了結果と区別する。

正常な終了理由の分類と利用者向け通知要否は分離する。cancelまたは成立しないdropでは異常終了通知を行わず、外部環境変化等についてはDesignで定義された通知要否に従う。外部環境変化を内部Errorとして扱わない。

正常な物理的DnD終了後、現在のTableで選択中のReorder Modeを安全に継続できる場合はそのモードを維持する。現在のTableに対するReorder Mode自体を安全に継続できない場合だけ`edit`へ戻る。Table更新がすでに成立している場合は終了処理で自動的に巻き戻さず、その時点のTable状態を後続操作の基準とする。

### Compatibility

Core TableとFlexible Table Blockの表現差はTable Integrationが吸収する。Editorのiframe / non-iframe差はEditor DOM Contextを通して扱い、Row Reorder本体がEditor方式を判定して分岐しない。

### Performance

Row Reorderは、対応Table Block本体の属性更新や再描画に要する時間そのものを性能保証せず、その前後に自身が追加する並び替え計算、状態更新、表示更新などのコストを抑える。

代表的な大規模Tableは最大保証規模ではなく、Row Reorder自身が原因となる新たな長時間停止を追加していないことを確認するストレステストとして扱う。

- 行並び替えモード開始時にDnD EngineへTable全体の開始候補を固定的に接続しない。
- 移動先解決のためにTable全体をDnD Engineの移動先候補として登録しない。
- DnD中にTableデータの行順を更新しない。
- 移動先変更時の表示更新は、実際に表示位置が変わる行を中心に扱う。
- 行構造情報はactive DnD成立前の開始可否判定時に取得し、開始成立後のstartでSession開始時の制約として保持する。progress中は現在構造を都度取得しない。completeでは確定直前の現在構造を取得し直す。
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

### AD-05 Error処理を通常Lifecycleへ持ち込まない

実装の単純さと保守性を優先し、Row Reorder内部のContractまたはruntime invariant違反によるErrorを、正常な不在、継続不能、確定不能へ変換しない。内部Errorを理由とした利用者向け通知は行わず、Row Reorder全体の完全復旧は保証しない。

これにより、Error処理のための状態、戻り値、公開境界、Lifecycleを通常処理へ追加しない。Errorの捕捉位置、処理方法、記録方法などの具体的な実装方式はArchitectureの制約としない。

### AD-06 外部環境変化を内部Invariant違反として扱わない

Editor lifecycle、DOM availability、Supported Table Block availability、外部TableデータはRow Reorderの所有外で正当に変化し得るため、正常な不在または継続不能として扱う。progress後にTable構造が変化し、complete時に最終移動先が成立しなくなった場合も正常な確定不能として扱う。runtime assertionはRow Reorderが所有する値レベルのInvariantに限定する。

### AD-07 complete時に現在構造へ再照合する

progress時にSession開始時のTable構造に対して成立した最終移動先を確定時まで有効とみなさず、completeで現在のTable構造を取得し直して移動対象と最終移動先を再照合する。現在も成立し、実際に行順が変化することを確認できた場合だけTable Integrationの行更新境界へ進み、成立しない場合は新しい並び替え結果を確定せず正常に終了する。

### AD-08 内部ErrorをFailure / Recovery Viewとして扱わない

Failure / Recovery Viewは、外部環境変化のようにRow Reorderが通常処理として扱う継続不能または確定不能を表現する。内部ErrorはRow Reorder内に専用の回復Flowを持たないため、開始可否判定、active DnD、Table更新ごとの内部Error用Failure / Recovery Viewは定義しない。

### AD-09 dnd-kitをDnD Engine境界として採用する

既存Tableの行順をDnD中に変更せず物理的なDnD進行と自動スクロールを成立させられ、開始対象だけを必要時に接続するLifecycleでも代表的な大規模Tableで実用的に動作することをPoCと実ブラウザ確認で確認したため、dnd-kitをDnD Engineとして採用する。

Architecture上はdnd-kit固有のLifecycle名、DnD対象の具体的な登録単位、入力検出機構、移動先解決の具体的なDOM計測方法を内部責務へ持ち込まない。Input Interactionは開始条件、DnD InteractionはRow Reorderの意味状態とSessionおよび物理入力位置からの移動先判定、Reorder Presentationは独自表示、Auto Scrollは縦方向と許可範囲を所有し、物理的なDnD進行はDnD Engineへ委ねる。

## 10. Quality Requirements

- **Performance**: 対応Table Block本体の属性更新・再描画性能は保証対象とせず、Row Reorder自身が追加する並び替え計算、状態更新、表示更新などによって対象Table本来の更新コストを大きく悪化させない責務分離とLifecycleを採用する。代表的な大規模Tableでは、行並び替えモード開始時にTable全体のDnD候補を固定的に準備せず、Row Reorder自身が新たな長時間停止を追加していないことをストレステストで確認する。
- **Compatibility**: WordPress 6.8以上のBlock Editorにおけるiframe / non-iframe差と、Core Table / Flexible Table Block差を、利用者向け行並び替えの正しさへ漏らさない。
- **Reliability / Robustness**: 外部環境変化による正常な継続不能または確定不能では、新しい行順を確定せず通常の終了Lifecycleで安全にidleへ戻る。Row Reorder内部の想定外のErrorは正常な不在、継続不能、確定不能と区別し、想定外のError発生後のRow Reorder全体の完全復旧は保証せず、その保証のために通常処理を複雑化しない。complete時は現在のTable構造で成立する移動だけを確定し、成立済み更新は終了処理で自動的に巻き戻さない。

## 11. Risks and Technical Debt

- Column ReorderのArchitectureが後から作成された際、責務名が同じでも、それだけを理由にRow Reorderとの共通実装へ統合しないよう継続して確認する必要がある。
- Reorder ModeはTableツールバー入口、排他状態、最小限のTable Identityだけを所有する境界であり、方向固有のTable構造、DnD Session、制約判定を取り込む共通Reorder責務へ拡張しないよう確認する必要がある。
- Reorder Guidanceは行・列共通の入口案内状態だけを所有する境界であり、入口選択状態、方向固有のDnD状態や制約判定を取り込む共通Reorder責務へ拡張しないよう確認する必要がある。
- DnD Engineの具体APIや内部状態をRow ReorderのSession Contractへ漏らすとArchitectureが外部ライブラリ実装へ固定されるため、境界の抽象度を維持する必要がある。
- stable IDの`ROW`は独立したArchitecture要素の識別に使用するものであり、Responsibilityの表示名や共通抽象化を意味しない。
- Performance最適化で状態やキャッシュを追加する場合も、外部Table状態の監視やRow / Column共通制約キャッシュへ責務を拡張しないよう所有境界を再確認する必要がある。

## 12. Glossary

- **Reorder Mode境界**: Tableツールバーの行・列並び替え入口、`edit | row | column`の排他状態、および`row | column`が有効なTableを識別するための最小限のTable Identityを所有し、各方向へその方向が有効であることだけを渡す外側の境界。
- **Reorder Guidance境界**: PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列両方の入口を提示する初回案内・再案内状態を所有するRow Reorder外側の境界。
- **Row Reorder**: `tbody`の行並び替えだけを所有する独立したArchitecture境界。本書の方向固有Responsibility全体を含む。
- **DnD Engine**: 物理入力の継続、物理的なDnD状態、現在の物理入力位置、自動スクロール実行を提供する外部境界。Row Reorderはdnd-kitを採用するが、内部責務とSessionはdnd-kit固有のAPIや物理状態をContractにしない。
- **Rediscovery Detection**: 通常編集時に行を移動しようとする反復操作が成立したことだけを検出し、共通案内状態を所有せずReorder Guidanceへ通知する行専用責務。
- **行DnD Session**: 一回の行DnDに必要な移動対象、対象Table同一性、Session開始時の行制約、現在の有効な移動先だけを保持する行専用の意味状態。DnD Engine固有の物理状態、外部参照、計測結果は保持せず、progressでは開始時の行制約を移動先判定に利用し、Sessionの最終移動先はcomplete時の現在構造への再照合を省略する根拠にはならない。
- **正常な不在**: 外部環境変化や利用者操作上、正当に発生し得る「現在利用できない」「対象が成立しない」「現在は確定できない」という結果。
- **runtime invariant**: 型だけでは保証できず、かつRow Reorder自身が所有する値レベルの成立条件。
