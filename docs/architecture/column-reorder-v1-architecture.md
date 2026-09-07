# Column Reorder v1 Architecture

## 1. Introduction and Goals

本書は、正式v1の列並び替えを実現するための内部責務、境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

入力は`docs/design/reorder-v1-design.md`および`docs/design/column-reorder-v1-design.md`とし、利用者向け設計を列専用の責務モデルへ落とし込む。

本書はColumn Reorderだけを対象とする。Row Reorderの状態、責務、Contractは定義せず、Column Reorderから参照しない。

通常編集、行並び替え、列並び替えの入口、モード選択、排他状態、および選択中の並び替えモードが有効なTableの識別はColumn Reorderの外側にあるReorder Mode境界が所有する。初回案内の表示済み状態と、行・列の入口をまとめて提示する案内状態はColumn Reorderの外側にあるReorder Guidance境界が所有する。Column Reorderは、列並び替えが有効であることだけを受け取り、その有効期間における列DnDの状態とLifecycleを所有する。

責務名はArchitecture上の概念名とし、列専用であることを責務名へ重複して付与しない。本書に定義するTable Integration、Reorder Target Resolution、DnD InteractionなどはすべてColumn Reorderの責務であり、Row Reorder側に同名の責務が存在しても共通実装または共有状態を意味しない。

## 2. Architecture Constraints

- Row ReorderとColumn Reorderは独立した実装とし、両者の間に共通の並び替え抽象化または方向固有状態の共有を導入しない。
- Reorder Mode境界はTableツールバーの行・列並び替え入口、`edit | row | column`の排他状態、および`row | column`が有効なTableを識別するための最小限のTable Identityを所有する。Table内容、行・列構造、移動対象、移動先、DnD Sessionその他の方向固有Table情報は所有しない。
- `edit`では通常のTable編集を許可し、`row | column`では対象Tableの内容編集を開始させない。通常編集と並び替えモードの排他はReorder Modeが所有する。
- Reorder Guidance境界はPC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列の入口をまとめて提示する共通案内状態をColumn Reorderの外側で所有する。
- 本書の責務名がRow ReorderのArchitectureと同一であっても、責務の同一性、実装共有、状態共有を意味しない。
- Column Reorderは対応Table全体の論理列を移動対象とし、列順以外のTable内容を変更しない。
- 論理列は`thead`、`tbody`、`tfoot`を通じて同じTable全体の列位置を表し、sectionごとに別の移動対象として扱わない。
- Reorder Target Resolutionはactive DnD成立前に、Input Interactionが開始候補をDnD Engineへ接続する前と、DnD Engineがactive DnDを成立させる直前の二段階で現在のTable制約からReorder Targetの成立可否を解決し、その結果を開始試行を越えて共有状態として保持しない。
- Reorder Target自体は移動する論理列だけを表し、開始時制約や開始不可理由をReorder Targetへ含めない。
- 第二段階で開始可能と解決した列制約を開始時制約としてDnD Interactionへ引き継ぎ、active DnD Session中の移動先判定はその開始時制約を基準にする。`progress`ごとにTable Integrationから現在構造を取得し直さない。
- 列DnD中はTableデータを並べ替えず、`complete`時に現在のTable構造へ再照合し、成立する場合だけTable Integrationの列更新境界を利用して列順を更新する。
- Table Integrationは1回の成立した列移動をTable全体への1回の確定済み更新として反映する。`thead`、`tbody`、`tfoot`を部分的に個別確定せず、WordPress Undo上も1回のUndo単位とする。
- DnD Engineは物理入力の継続、物理的なDnD状態、現在の物理入力位置、および自動スクロールの実行を担う。Column Reorderは現在の物理入力位置から対象Table内の移動先候補を解決して意味状態へ変換し、DnD Engine固有の物理状態を列DnD Sessionへ保持しない。
- 列DnDに必要な開始候補のDnD Engineへの接続は、列並び替えモード開始時にTable全体へ固定的に準備せず、そのDnDで必要になった時点だけ一時的に成立させる。移動先候補はDnD Engineへ登録せず、Column Reorderが現在の物理入力位置から解決する。
- DnD Engineが提供する標準の移動表示は利用せず、列DnD中の利用者向け表示はReorder Presentationが独立して所有する。
- 列DnDの自動スクロールはDnD Engineの機能として扱い、列の移動に必要な横方向だけを有効にする。Column Reorderに独立した自動スクロール責務または状態を持たせない。
- 対応Table BlockやEditor環境の差は、Column Reorderの利用者向け挙動へ漏らさず、それぞれを所有する境界で吸収する。
- 正常な不在、外部環境変化による継続不能、内部仕様またはruntime invariant違反を区別する。
- 内部Errorは利用者向け通知の理由とせず、外部環境変化等についてDesignで定義される利用者向け通知要否とは分離する。
- 型で表現できる状態相関は型と状態モデルで保証し、runtime assertionへ戻さない。runtime assertionはColumn Reorderが所有し、型だけでは保証できない値レベルのInvariantに限定する。
- 実装の単純さと保守性を、想定外のError発生後にColumn Reorder全体を完全復旧することより優先する。
- Column Reorder内部のContractまたはruntime invariant違反はErrorとして扱う。
- 内部Errorは原則として握りつぶさず、正常な結果へ変換しない。
- 外部環境変化による継続不能は内部Errorとして扱わず、通常の終了結果として扱う。
- Performanceの責任境界は、対応Table Block本体の属性更新・再描画性能ではなく、Column Reorder自身が追加する並び替え処理のコストとする。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | `QR-02`で保証対象とする編集環境を提供し、Column Reorderの入力と表示が存在する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | `FR-13`で定義されるCore TableまたはFlexible Table Blockであり、Table Integrationを介してTable全体の列構造取得と列順更新を行う対象。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の列並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | 列DnD中に横方向へ自動スクロールする対象領域を提供する。 |
| EXT_DND_ENGINE | DnD Engine | External Library | 物理入力の継続、物理的なDnD状態、現在の物理入力位置、および自動スクロール実行を提供する。 |

Column ReorderはWordPress Editor、対応Table Block、WordPress Undo、Editor Scroll Area、およびDnD Engineと接続する。対応Table Blockの具体的な対象とEditor環境の保証範囲はRequirementsを正本とし、本書では再定義しない。

Editor DOM ContextはWordPress Editorの現在のeditor contextからDOM / Web APIを利用するためのcontextを解決する。Table IntegrationはSupported Table Blockとの差を吸収し、Table全体の列構造と1回の確定済み更新を提供する。Reorder Target Resolutionはactive DnD成立前に現在列制約から論理列の成立可否を解決する。DnD EngineはColumn Reorderの物理的なDnD進行と、列DnD中の横方向の自動スクロールを担う。

## 4. Solution Strategy

Column Reorderは、モード境界、共通入口案内境界、editor context、入力、Table Block差、開始対象解決、DnD Engine、DnD Session、表示を別責務または外部境界として扱う。移動対象の開始可否はReorder Target Resolution、Session開始後の移動先判定はDnD Interaction、Table全体への列更新はTable Integrationが所有する。

Table IntegrationはTable全体を一つの列構造として解釈できる情報を提供し、`colspan`により単独移動できない論理列と、結合セルを分断せずTable構造を保てる列間の挿入可能境界をColumn Reorder側で判断できる境界を形成する。対応Table Block固有の属性表現やsectionごとの保存形式は他責務へ漏らさない。

Input Interactionは列並び替えが有効な期間に入力方式固有の開始条件を判断し、開始候補をReorder Target Resolutionへ渡して現在の開始可否を事前解決する。開始可能な候補だけを必要な時点でDnD Engineへ接続する。

Reorder Target Resolutionはactive DnD成立前に二段階でTable Integrationから現在の列制約を取得し、Reorder TargetがTable全体で列単位の移動対象として成立するかを解決する。第二段階が成立した場合だけReorder Targetとその開始試行で利用する開始時制約をDnD Interactionへ引き継ぐ。

DnD Interactionは第二段階で解決された開始時制約をSession中の基準として保持する。`progress`では現在の物理入力位置をTable全体の列間挿入位置へ変換し、開始時制約で構造を保てる位置だけを有効な移動先とする。`complete`では現在のTable構造を取得し直し、移動対象と最終移動先が現在も成立する場合だけTable Integrationへ1回の確定済み列移動を要求する。

Reorder Presentationは移動対象列、垂直挿入線、実際に位置が変わる周囲列の移動、開始不可理由、およびDesignで定義された通知を表現する。ドラッグ中の列は元Tableの列幅とセル高さの配置関係を維持し、Tableの縦方向から不必要にはみ出さない表示を行う。

自動スクロールは独立責務とせず、DnD Engineの機能として列DnDでは横方向だけを有効にする。

### Process Flow Views

#### Column Reorder End-to-End {#PV_COLUMN_REORDER_END_TO_END kind=normal}

WordPress Editorの入力から開始対象を事前解決し、開始可能な候補だけをDnD Engineへ接続する。active DnD成立直前に現在制約で再解決してから列DnDを開始し、complete時にも現在のTable構造で成立することを確認できた列移動だけをTable全体へ反映する主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_COLUMN_INPUT_INTERACTION | normal | WordPress Editorの入力が列並び替えの入力境界へ入る。 |
| RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_TARGET_RESOLUTION | normal | 入力開始候補を現在制約で事前解決し、DnD Engineへ接続可能か確認する。 |
| RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | normal | active DnD成立前の各解決時点で現在列制約を取得し、Reorder Targetの成立可否を解決する。 |
| RESP_COLUMN_TARGET_RESOLUTION | EXT_DND_ENGINE | normal | 第一段階で開始可能な候補だけを物理的なDnD開始境界へ進め、第二段階では開始可否結果を物理DnD成立へ反映する。 |
| EXT_DND_ENGINE | RESP_COLUMN_TARGET_RESOLUTION | normal | active DnD成立直前にReorder Targetを現在制約で再解決する。 |
| RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_DND_INTERACTION | normal | 第二段階で開始可能な場合だけReorder Targetと開始時制約をSession開始境界へ渡す。 |
| RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | normal | complete時の現在構造取得と確定済み列移動の反映へ進む。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | normal | 対応Table BlockからTable全体の列構造を取得し、確定時はTable全体の列順を1回で反映する。 |

#### External Environment Change and Recovery {#PV_COLUMN_EXTERNAL_CHANGE_RECOVERY kind=failure-recovery}

EditorまたはTableの外部状態変化によってactiveな列DnDを継続または確定できなくなった場合に、内部Errorとして扱わず、通常の終了経路として安全に列DnDを終了する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_DND_INTERACTION | failure | 現在のEditor contextを利用できないなど、外部環境変化による継続不能を通常の終了結果として渡す。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | failure | 対象Tableが現在利用できない、または更新開始前に現在更新できないなど、外部Table状態の変化による継続不能・確定不能を通常の結果として返す。 |
| RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | recovery | DnD中だけの表示状態を解除し、安全な操作継続不能による終了ではDesignで定義された通知を要求する。 |
| RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | recovery | DnD終了後に現在のTableで列並び替えモードを安全に継続できるかを外側のモード境界へ渡す。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | Tableツールバーの行・列入口、`edit | row | column`の排他状態、および選択中モードのTable単位Lifecycleを所有する外側の境界。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態を所有する外側の境界。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のWordPress Editorに属するDOM / Web API contextを必要な時点で解決する。 |
| RESP_COLUMN_INPUT_INTERACTION | Input Interaction | PCとタッチ端末の開始条件を解釈し、開始候補をReorder Target Resolutionで事前解決して、開始可能な候補だけをDnD Engineへ接続する。 |
| RESP_COLUMN_TABLE_INTEGRATION | Table Integration | 対応Table Blockとの差を吸収し、列並び替えに必要なTable同一性、Table全体の現在列構造、列更新境界、およびWordPress Undoとの境界を提供する。 |
| RESP_COLUMN_TARGET_RESOLUTION | Reorder Target Resolution | active DnD成立前に現在の列制約から論理列の成立可否を二段階で解決し、開始可能な場合はそのDnDで利用する開始時制約を導出する。 |
| RESP_COLUMN_DND_INTERACTION | DnD Interaction | DnD Engineの物理的なDnD進行をColumn Reorderの意味状態へ変換し、列DnD Session、移動先判定、確定、中止のLifecycleを所有する。 |
| RESP_COLUMN_PRESENTATION | Reorder Presentation | Column Reorderの意味状態と必要な物理的DnD情報から、列DnD中の独立した視覚フィードバックとDesignで定義された通知を表現する。 |

### Ownership Boundaries

| ID | Name | Includes |
| --- | --- | --- |
| BOUNDARY_REORDER_COMMON | Reorder Common | RESP_REORDER_MODE RESP_REORDER_GUIDANCE |
| BOUNDARY_EDITOR_INTEGRATION | Editor Integration | RESP_EDITOR_DOM_CONTEXT |
| BOUNDARY_COLUMN_REORDER | Column Reorder | RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION |
| BOUNDARY_WORDPRESS_INTEGRATION | WordPress Integration | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_REORDER_MODE | EXT_WORDPRESS_EDITOR | WordPress Editor上のTableツールバー入口、通常編集と行・列並び替えの排他、および対象Table単位のモードLifecycleを扱うために必要とする。 |
| RESP_REORDER_GUIDANCE | EXT_WORDPRESS_EDITOR | 初回案内の表示契機、および行・列の入口をまとめて提示する編集環境を必要とする。 |
| RESP_REORDER_GUIDANCE | RESP_EDITOR_DOM_CONTEXT | 共通入口案内を現在のeditor contextで表現するために必要とする。 |
| RESP_REORDER_GUIDANCE | RESP_REORDER_MODE | Reorder Modeが所有する行・列入口の案内と、入口選択による案内終了を整合させるために必要とする。 |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のeditor contextを解決するために現在のWordPress Editorを必要とする。 |
| RESP_COLUMN_INPUT_INTERACTION | EXT_WORDPRESS_EDITOR | PCまたはタッチ端末の開始入力を判断するために必要とする。 |
| RESP_COLUMN_INPUT_INTERACTION | RESP_EDITOR_DOM_CONTEXT | 入力開始時の現在のeditor contextを利用するために必要とする。 |
| RESP_COLUMN_INPUT_INTERACTION | RESP_REORDER_MODE | 列並び替えが有効な期間だけ列入力を受理するために必要とする。 |
| RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_TARGET_RESOLUTION | 入力開始候補を現在制約で事前解決し、開始可能な列だけをDnD Engineへ接続するために必要とする。 |
| RESP_COLUMN_INPUT_INTERACTION | EXT_DND_ENGINE | 開始可能と解決された列だけを物理的なDnD開始候補へ接続し、DnD終了またはcancelを検知して自身の一時状態を終了するために必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有のTable全体の列構造取得と列順更新を行うために必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した1回の列並び替えを1回のUndoで戻せる更新単位を維持するために必要とする。 |
| RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | active DnD成立前の各解決時点で現在列制約を取得し、論理列が列単位の移動対象として成立するか解決するために必要とする。 |
| RESP_COLUMN_DND_INTERACTION | EXT_DND_ENGINE | 物理的なDnD開始成立後の進行と現在の物理入力位置をColumn ReorderのSession意味状態へ変換するために必要とする。 |
| RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | DnD Interactionがモード状態を所有せず、DnD終了後のモードLifecycle判断をReorder Modeの責務として成立させるために必要とする。 |
| RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | complete時の現在構造への再照合、および確定したTable全体の列移動の反映に必要とする。 |
| RESP_COLUMN_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 現在のeditor contextで列DnDの表示を行うために必要とする。 |
| RESP_COLUMN_PRESENTATION | EXT_DND_ENGINE | 列DnDの表示に必要な物理的なDnD情報をSessionへ取り込まず利用するために必要とする。 |
| RESP_COLUMN_PRESENTATION | RESP_COLUMN_TARGET_RESOLUTION | Designで利用者へ提示する開始不可理由を、制約判定を重複させず表示へ反映するために必要とする。 |
| RESP_COLUMN_PRESENTATION | RESP_COLUMN_DND_INTERACTION | 現在の有効な移動先、終了時の表示解除、およびDesign上の終了通知要否を表示状態へ反映するために必要とする。 |
| EXT_DND_ENGINE | EXT_SCROLL_AREA | 列DnD中に横方向の自動スクロールを実行する対象領域として必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_COLUMN_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION |
| DV_COLUMN_EDITOR_INTERACTION | Editor Interaction | EXT_WORDPRESS_EDITOR EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TARGET_RESOLUTION |
| DV_COLUMN_DND_CORE | DnD Core | EXT_SUPPORTED_TABLE_BLOCK EXT_DND_ENGINE RESP_REORDER_MODE RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION |
| DV_COLUMN_FEEDBACK | DnD Feedback | EXT_SCROLL_AREA EXT_DND_ENGINE RESP_EDITOR_DOM_CONTEXT RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION |
| DV_COLUMN_DATA_UPDATE | Table Update | EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_COLUMN_DND_INTERACTION RESP_COLUMN_TABLE_INTEGRATION |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

Tableツールバーの「行を並び替え」「列を並び替え」の入口、入口選択、および`edit | row | column`の排他状態を所有する。Column Reorderへは列並び替えが有効であることだけを提供する。

##### State ownership

`edit | row | column`の排他状態と、`row | column`が現在どのTableに対して有効かを識別するための最小限のTable Identityを所有する。Table内容、行・列構造、移動対象、移動先、列DnD Session、Row Reorder内部状態は所有しない。

##### Contract

入口選択を選択時のTable Identityへ関連付ける。選択中の入口を再選択した場合は`edit`へ戻し、別方向の入口を選択した場合は同じTableに対する選択方向を切り替える。Column Reorderへは対象Tableで列並び替えが有効であることだけを提供する。

##### Lifecycle

`edit`から開始し、入口選択により`row`または`column`へ移行する。同じTable内では現在のモードを維持し、別Blockを選択した場合は`edit`へ戻る。DnDのcomplete、cancel、成立しないdropだけではReorder Modeを終了しない。

##### Invariants

- 同時に有効なモードは一つだけとする。
- `row | column`は必ず一つのTable Identityへ関連付ける。
- Column ReorderへRow Reorderの内部状態、責務、Contractを公開しない。
- Table内容、行・列構造、移動対象、移動先、DnD Sessionを所有しない。

#### Reorder Guidance {#RESP_REORDER_GUIDANCE}

##### Responsibility

初めて利用する人への案内について、Reorder Modeが所有する「行を並び替え」と「列を並び替え」の入口をまとめて提示する外側の案内境界を所有する。

##### State ownership

利用者についてPCとタッチ端末ごとの初回案内表示済み状態と、現在の共通入口案内状態を所有する。入口の選択状態、列DnD Session、Row Reorder内部状態は所有しない。

##### Contract

設計で定義された初回案内条件を受け取り、必要な場合だけ行・列両方の入口を確認できる共通案内を提示する。いずれかの入口選択または案内終了で、その操作環境では表示済みとして扱う。

##### Lifecycle

各操作環境で未表示の状態から表示契機により案内状態となり、入口選択または案内終了で表示済みとなる。

##### Invariants

- 初回案内では行・列両方の入口をまとめて提示する。
- 初回案内表示済み状態をRow ReorderとColumn Reorderへ重複して所有させない。
- 行または列固有のDnD Sessionや内部状態を共通案内状態として保持しない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のWordPress Editorに属する基準から、その時点でDOM / Web APIを利用するためのeditor contextを解決する。

##### State ownership

解決したcontextをeditor lifecycleをまたぐ永続状態として所有しない。Reorder Mode、Reorder Guidance、列DnD Session、Tableデータ、移動対象、移動先を所有しない。

##### Contract

現在のeditor contextを安全に提供できる場合だけ、そのcontextを必要な責務へ提供する。現在のcontextを解決できない場合は、以前のcontextへfallbackせず正常な不在を返す。

##### Lifecycle

DOM / Web APIを必要とする時点で現在のeditor contextを解決する。Editor lifecycleが変化した場合は現在の基準から解決し直す。

##### Invariants

- 現在のWordPress Editorとは異なるcontextをfallbackとして提供しない。
- iframe / non-iframeというEditor方式を利用側へ判定させない。
- 現在のcontextを解決できない状態をColumn Reorder内部のInvariant違反として扱わない。

#### Input Interaction {#RESP_COLUMN_INPUT_INTERACTION}

##### Responsibility

PCとタッチ端末の入力方式固有のDnD開始条件を判断し、開始候補をReorder Target Resolutionで事前解決したうえで、開始可能な候補を物理的なDnD開始境界へ接続する。DnD開始後の物理入力の継続、移動、終了、cancelの検出はDnD Engineへ委ねる。

##### State ownership

入力方式固有の開始前一時状態と、その開始試行に必要なDnD Engine接続だけを所有する。列DnD Session、構造制約判定、移動先判定、active DnDの物理状態、Tableデータを所有しない。

##### Contract

Reorder Modeから対象Tableで列並び替えが有効であることを受け取り、その期間だけ列DnD開始入力を受理する。開始条件が成立した場合は開始候補をReorder Target Resolutionへ渡し、現在制約で開始可能と解決された場合だけDnD Engineへ一時的に接続する。開始不可理由が定義された場合はReorder Presentationへ渡す。

##### Lifecycle

列並び替えが有効な期間にだけ活動する。開始試行では開始候補を事前解決し、開始可能な場合だけDnD Engineへ一時的に接続する。DnDが成立しなかった場合、DnD終了、cancel、モード終了、外部環境変化では自身の一時状態と接続を破棄する。

##### Invariants

- 行DnDを開始しない。
- 列並び替えモード開始時にTable全体の開始候補を固定的に準備しない。
- 開始可能と解決されていない候補をDnD Engineへ接続しない。
- active DnDの物理状態、移動先判定、自動スクロールを所有しない。

#### Table Integration {#RESP_COLUMN_TABLE_INTEGRATION}

##### Responsibility

Supported Table Blockとの差を吸収し、列並び替えに必要なTable同一性、Table全体の現在列構造、Table全体への列更新境界、およびWordPress Undoとの境界を提供する。

##### State ownership

DnD Sessionや入力状態を所有しない。外部TableデータをColumn Reorder独自の永続状態として複製しない。

##### Contract

現在の対応Tableについて、論理列の制約判定と更新に必要な情報を同一Table由来の情報として提供する。`thead`、`tbody`、`tfoot`を通じた論理列、`colspan`により単独移動できない列、およびTable全体の構造を保てる挿入境界を判断できる現在構造を提供する。

DnD Interactionから、現在構造で成立することを確認済みの移動対象、移動先、対象Table同一性を受け取る。セル内容・属性・装飾その他の保持対象を変えずにTable全体の列順だけを更新する。1回の成立した列移動は`thead`、`tbody`、`tfoot`を部分的に個別確定せず、Table全体への1回の確定済み更新として反映する。WordPress Undo上も1回の更新単位として維持する。

対応Tableが現在存在しない、外部Table状態を安全に取得できない、または更新開始前に現在更新できない場合は正常な不在または更新不能結果として返し、新しい列順を部分的に確定しない。

##### Lifecycle

要求時点のSupported Table Blockから現在情報を取得または更新する。取得した情報を外部状態監視用の永続状態として保持しない。確定済み列移動の更新不能時に独自のretryまたはsection単位rollbackを開始しない。

##### Invariants

- Table全体の論理列をsectionごとに別の移動対象として扱わない。
- `thead`、`tbody`、`tfoot`を一つの列移動で部分的に個別確定しない。
- 列順以外を並び替え結果として変更しない。
- 一つの確定済み列移動の反映要求を複数回適用しない。
- 1回の成立した列並び替えを複数の独立したUndo単位へ分割しない。
- Supported Table Block固有の列構造表現を他のColumn Reorder責務へ漏らさない。

#### Reorder Target Resolution {#RESP_COLUMN_TARGET_RESOLUTION}

##### Responsibility

active DnD成立前に、現在のTable制約に対してReorder TargetがTable全体の論理列として単独移動可能かを二段階で解決する。第二段階で開始可能な場合は、その開始試行でDnD Sessionへ引き継ぐ開始時制約を導出する。

##### State ownership

開始試行を越える共有状態、DnD Session、入力状態、表示状態、Tableデータを所有しない。第一段階と第二段階の解決結果を外部Table状態のcacheとして保持しない。

##### Contract

開始候補として識別された論理列を受け取り、Table Integrationから要求時点の列制約を取得する。対象が現在のTable全体の論理列として存在し、`colspan`による結合範囲に含まれず列単位で移動可能な場合は、Reorder Targetと開始時制約を解決結果として返す。`rowspan`だけを理由に開始不可とはしない。

第一段階で`colspan`により列単位で移動できない場合は、Designで利用者へ提示できる開始不可理由を解決結果として返す。現在Tableまたは対象列を安全に解釈できない場合は開始不可理由を生成せず正常な利用不能結果とする。第二段階で開始不能または利用不能となった場合はactive DnDを成立させない。

##### Lifecycle

入力開始候補ごとに第一段階を解決し、開始可能な場合だけDnD Engineへの接続へ進める。active DnD成立直前に第二段階を現在のTable制約から解決し直し、開始可能な解決結果だけをDnD Interactionへ引き継ぐ。

##### Invariants

- Reorder Targetの意味を「移動する論理列」から拡張しない。
- 開始時制約や開始不可理由をReorder Targetへ含めない。
- 第一段階の解決結果だけを根拠にactive DnDを成立させない。
- `colspan`により単独移動で構造を保てない論理列を開始可能として解決しない。
- `rowspan`だけを開始不可理由として扱わない。
- 開始可否判定のためにTableデータを変更しない。

#### DnD Interaction {#RESP_COLUMN_DND_INTERACTION}

##### Responsibility

DnD Engineが提供する物理的なDnD進行をColumn Reorderの意味へ変換し、物理的なDnD開始成立後の列DnD Sessionを所有する。Session開始、現在の物理入力位置からの移動先判定と更新、現在構造への再照合、確定、正常中止、外部環境変化による終了を一つの列専用Lifecycleとして管理する。

##### State ownership

activeな列DnD Sessionを所有する。SessionはReorder Target、対象Table同一性、Reorder Target Resolutionの第二段階で確定した開始時列制約、現在の有効移動先だけをColumn Reorderの意味状態として保持する。DnD Engineが所有する入力位置、物理的なDnD状態、自動スクロール状態、表示位置、外部参照、計測結果は保持しない。

##### Contract

第二段階で開始可能と解決されたReorder Targetと開始時制約を受け取り、物理的なDnD開始成立を受けたstartでColumn DnD Sessionを開始する。

`progress`ではDnD Engineが示す現在の物理入力位置から対象Table全体の移動先候補を解決し、列内の位置関係を列間の挿入位置へ変換する。Session開始時の列制約で有効な場合だけ現在の有効移動先として保持する。結合セルを分断するなどTable全体の構造を壊す位置は有効な移動先としない。`progress`ごとにTable Integrationから現在のTable構造を取得し直さない。

`complete`では有効な最終移動先がある場合でも、Table Integrationから現在のTable情報を取得し直し、SessionのReorder Target、最終有効移動先、Table同一性が現在のTable構造でも成立することを再照合する。成立を確認でき、実際に列順が変化する場合だけTable IntegrationへTable全体の確定済み列移動の反映を要求する。再照合できない、現在は成立しない、有効な最終移動先がない、または列順が変化しない場合はTableを更新せず終了する。

cancelまたはその他の継続不能でもTableデータを新たに確定しない。外部環境変化による継続不能は内部Errorとして扱わない。

##### Lifecycle

idleから、第二段階で開始可能と解決された物理DnDのstartを受けてactiveとなる。Session開始時は解決結果の開始時制約を保持する。`progress`はactive Sessionだけを更新し、開始時制約に対して有効な移動先だけを保持する。`complete`では現在のTable構造を取得し直して再照合し、成立して列順が変化する場合だけ更新へ進む。complete成功、cancel、成立しないdrop、外部環境変化による正常終了ではSessionを破棄してidleへ戻る。

##### Invariants

- active Sessionは同時に一つだけ存在する。
- Sessionが参照するReorder Targetと開始時制約は同じ開始試行の第二段階Target Resolution結果から成立した値である。
- SessionにはColumn Reorderの意味状態だけを保持する。
- `progress`ではSession開始時に取得した列制約を基準とし、現在のTable構造を都度取得して置き換えない。
- 結合セルを分断するなどTable全体の構造を壊す位置を有効な移動先として成立させない。
- Sessionが保持する最終有効移動先だけを根拠に`complete`を確定しない。
- `complete`はReorder Target、最終移動先、Table同一性が現在のTable構造でも成立し、実際に列順が変化することを確認できた場合だけ新しい列順を確定する。
- cancel、成立しないdrop、外部環境変化による終了は新しい列順を確定しない。
- Reorder Modeの排他状態または対象Table IdentityをSession状態として所有しない。

#### Reorder Presentation {#RESP_COLUMN_PRESENTATION}

##### Responsibility

列並び替えに必要な利用者向け一時表示を表現する。移動対象列の強調、垂直挿入線、周囲列の移動、開始不可理由、およびDesignで定義された通知をColumn Reorderが所有する範囲で扱う。DnD Engine標準の移動表示は利用しない。

##### State ownership

列DnD表示と一時的な通知に必要な状態だけを所有し、Tableデータ、列DnD確定状態、列DnD Session、DnD Engineの物理状態を所有しない。

##### Contract

Reorder Target Resolutionの第一段階の解決結果からDesignで表示対象となる開始不可理由を受け取り、構造判定を重複させず利用者向け通知へ反映する。DnD Interactionから現在の有効な移動先と終了時の通知要否を受け取る。移動対象は元Tableの列幅とセル高さの配置関係を保ち、Tableの縦方向から不必要にはみ出さない一時表示とする。現在の有効移動先はTable全体の列間に垂直挿入線で示し、実際に位置が変わる周囲列だけを移動表示する。

##### Lifecycle

開始不可理由または列DnD中の各表示理由が成立した期間だけ有効となり、Designで定義された期間またはcomplete、cancel、継続不能に応じて該当する一時表示を破棄する。

##### Invariants

- 表示状態をTableデータの正本として扱わない。
- 開始可否または移動先の構造制約をPresentation内で重複判定しない。
- DnD中の表示のために実Tableの列順を変更しない。
- 無効な移動先を確定可能な垂直挿入位置として表示しない。
- 移動対象列の表示で列幅とセル高さの配置関係を不自然に崩さない。
- Row Reorderの表示状態を共有しない。

## 6. Runtime View

### Column DnD start attempt {#RV_COLUMN_DND_START}

列並び替えが有効な状態で、入力開始候補を現在制約で事前解決し、開始可能な候補だけをDnD Engineへ接続する。active DnD成立直前に同じ対象を現在制約で再解決し、第二段階も開始可能な場合だけColumn DnD Sessionを開始する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_TARGET_RESOLUTION | 入力開始候補を現在のTable制約で事前解決する。 |
| 2 | RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 第一段階の現在列制約を要求する。 |
| 3 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の対応Table BlockからTable全体の列構造を取得する。 |
| 4 | RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_PRESENTATION | `colspan`によりDesignの表示対象となる開始不可理由がある場合だけ理由を渡す。 |
| 5 | RESP_COLUMN_INPUT_INTERACTION | EXT_DND_ENGINE | 第一段階で開始可能な列だけをDnD開始候補として一時的に接続する。 |
| 6 | EXT_DND_ENGINE | RESP_COLUMN_TARGET_RESOLUTION | active DnD成立直前に同じReorder Targetを現在制約で再解決する。 |
| 7 | RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 第二段階の現在列制約を要求する。 |
| 8 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の対応Table BlockからTable全体の列構造を取得する。 |
| 9 | RESP_COLUMN_TARGET_RESOLUTION | EXT_DND_ENGINE | 第二段階の開始可否結果を返し、開始不能な場合は物理的なDnDを成立させない。 |
| 10 | EXT_DND_ENGINE | RESP_COLUMN_DND_INTERACTION | 第二段階で開始可能な場合だけ物理的なDnD開始成立と、解決済みReorder Target・開始時制約をstart境界へ渡す。 |
| 11 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | Session開始時は移動対象列のDnD表示を開始する。 |

### Column DnD progress {#RV_COLUMN_DND_PROGRESS}

activeな列Session中に、DnD Engineの現在位置をTable全体の列間挿入位置へ変換し、Session開始時制約で有効な移動先だけを保持して表示する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_COLUMN_DND_INTERACTION | 現在の物理入力位置を提供する。 |
| 2 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_DND_INTERACTION | 現在位置を論理的な列間挿入位置へ変換し、開始時制約でTable全体の構造を保てるか判定する。 |
| 3 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | 現在の有効移動先を表示状態へ反映する。 |
| 4 | RESP_COLUMN_PRESENTATION | EXT_DND_ENGINE | 移動対象表示に必要な物理的DnD情報を必要な時点で利用する。 |
| 5 | EXT_DND_ENGINE | EXT_SCROLL_AREA | 必要な場合だけ横方向へ自動スクロールする。 |

### Column DnD complete {#RV_COLUMN_DND_COMPLETE}

最終有効移動先がある場合でも、現在のTable全体の構造へ再照合し、現在も成立して列順が変化する場合だけTable全体を1回で更新する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_COLUMN_DND_INTERACTION | 物理的なDnD完了を通知する。 |
| 2 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | 現在のTable全体の列構造を要求する。 |
| 3 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在のTable全体の列構造を取得する。 |
| 4 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_DND_INTERACTION | Reorder Target、最終移動先、Table同一性を現在構造へ再照合する。 |
| 5 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | 現在も成立し列順が変化する場合だけ確定済み列移動の反映を要求する。 |
| 6 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | `thead`、`tbody`、`tfoot`を含むTable全体の列順を1回の確定済み更新として反映する。 |
| 7 | RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した列並び替えを1回のUndo単位として成立させる。 |
| 8 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | DnD中だけの表示を終了する。 |
| 9 | RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | 現在のTableで列並び替えモードを継続できる結果を渡す。 |

### Column DnD cancel or invalid drop {#RV_COLUMN_DND_CANCEL}

cancel、有効な移動先がないdrop、または列順が変化しないdropではTableを更新せず、DnD表示だけを終了して列並び替えモードを維持する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_COLUMN_DND_INTERACTION | cancelまたはDnD終了を通知する。 |
| 2 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | DnD中だけの表示を終了し、異常終了メッセージを要求しない。 |
| 3 | RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | 列並び替えモードを維持できる結果を渡す。 |

### Column DnD external change recovery {#RV_COLUMN_EXTERNAL_CHANGE_RECOVERY}

DnD中にEditorまたはTableの外部状態が変化し、安全に継続または確定できない場合は、新しい列順を確定せずDnDを終了する。現在のTableで列並び替えを継続できる場合はモードを維持し、継続できない場合だけ通常編集へ戻る。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_DND_INTERACTION | Editor contextの利用不能など外部環境変化による継続不能を通常の終了結果として渡す。 |
| 2 | RESP_COLUMN_TABLE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | 現在Tableの利用不能または更新不能を通常の終了結果として返す。 |
| 3 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | DnD中だけの表示を解除し、Designで通知対象となる場合だけ終了通知を要求する。 |
| 4 | RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | 現在Tableで列並び替えモードを安全に継続できるかという結果を渡す。 |

## 8. Crosscutting Concepts

### Table identity and current structure

Table IdentityはReorder Modeがモード対象を識別するための最小限の値と、Column ReorderがDnD対象Tableの同一性を確認する値を混同しない。Column Reorderは開始時制約を外部Tableの現在構造そのものとして扱わず、`complete`時には現在構造を取得し直す。

### Logical columns and structural constraints

Column Reorderが扱う列はTable全体の論理列である。`colspan`による結合範囲の内部にある列は単独移動対象として成立させない。移動先は、論理列を移動した後も`thead`、`tbody`、`tfoot`を含むTable全体で結合セルを分断せず構造を維持できる列間だけを成立させる。`rowspan`だけを理由に列の開始または移動を禁止しない。

### Session snapshot and current-state revalidation

第二段階のReorder Target Resolutionで得た列制約をSession開始時制約とする。`progress`ではこの開始時制約を使い、外部Table構造を毎回取得しない。`complete`では現在構造を取得し直し、開始時制約ではなく現在のTable構造を最終確定の基準とする。

### Atomic Table-wide update

1回の成立した列移動はTable全体への1回の更新として扱う。section単位の途中状態を利用者または他責務から観測可能にせず、WordPress Undo上も1回のUndo単位とする。

### Error and recovery boundary

外部環境変化による正常な継続不能と、Column Reorder内部のContractまたはruntime invariant違反を区別する。外部環境変化は安全な終了へ合流し、内部Errorは正常結果へ変換しない。内部Errorそのものを利用者向け通知理由としない。

## 9. Architecture Decisions

- Row ReorderとColumn Reorderは同名責務を持っても独立実装・独立状態とし、共通の並び替え抽象化を設けない。
- Reorder Target Resolutionはactive DnD成立前に二段階で現在制約を確認する。
- Reorder Targetは移動する論理列だけを表し、開始時制約や開始不可理由を含めない。
- Session中の移動先判定は第二段階で得た開始時制約を基準とし、`progress`ごとに現在構造を取得し直さない。
- `complete`だけは現在構造へ再照合してから確定する。
- Column Reorder専用のDrop Target Resolution責務は設けず、Session開始後の移動先判定はDnD Interactionが所有する。
- `thead`、`tbody`、`tfoot`を含むTable全体の列移動を1回の確定済み更新・1回のUndo単位として扱う。
- 自動スクロールはDnD Engineの機能とし、列DnDでは横方向だけを有効にする。

## 10. Quality Requirements

- 大規模Tableでも`progress`ごとにSupported Table Blockの現在構造を再取得せず、Session開始時制約を使って移動先を判断する。
- DnD中は実Tableの列順を変更せず、表示更新と確定更新を分離する。
- 移動先変更時は実際に表示位置が変わる周囲列だけを移動表示し、無関係な列を一斉に動かす必要のあるArchitectureを前提としない。
- 1回の成立した列移動はTable全体に対する1回の更新境界を通り、部分確定や複数Undo単位を作らない。
- 対応Table Block固有の列構造表現、Editor方式、DnD Engine固有の物理状態をColumn Reorderの意味状態へ漏らさない。

## 11. Risks and Technical Debt

- Table全体の論理列と結合セル制約の導出は、対応Table Blockごとの保存表現差を正しく吸収できない場合に構造破壊へつながるため、Table IntegrationのContract境界を維持する必要がある。
- 大規模TableではTable全体の列更新自体が対応Table Blockの再描画性能に影響される。Column ReorderはDnD中の追加コストを抑えるが、外部Block本体の確定時再描画コストまでは所有しない。
- 列幅とセル高さを保持した移動対象表示は実装時の計測方法に依存し得るが、Architectureでは計測結果をSession状態へ持ち込まない境界を維持する。

## 12. Glossary

- **Logical Column**: `thead`、`tbody`、`tfoot`を通じて同じTable全体の列位置を表す論理的な列。
- **Reorder Target**: 一つのDnD開始試行で移動対象となる論理列。開始時制約や開始不可理由は含まない。
- **Start Constraints**: Reorder Target Resolutionの第二段階で現在Tableから解決され、active DnD Session中の移動先判定基準として保持される列制約。
- **Insertion Boundary**: Table全体の構造を保ったまま論理列を挿入できる列間位置。
- **Column DnD Session**: active DnD成立後からcomplete、cancel、または継続不能による終了まで、Column Reorderが所有する一回の列DnD意味状態。
- **Atomic Table-wide Update**: `thead`、`tbody`、`tfoot`を部分的に個別確定せず、一回の成立した列移動をTable全体への一回の更新として反映すること。
