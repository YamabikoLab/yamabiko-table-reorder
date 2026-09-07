# Row Reorder v1 Architecture

## 1. Introduction and Goals

本書は、正式v1の行並び替えを実現するための内部責務、境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

入力は`docs/design/reorder-v1-design.md`および`docs/design/row-reorder-v1-design.md`とし、利用者向け設計を行専用の責務モデルへ落とし込む。

本書はRow Reorderだけを対象とする。Column Reorderの方向固有状態や行固有仕様を共有しない。一方、正式v1 Row Reorderの現在実装で成立している責務境界と、Column Reorder Architectureで整理済みの共通境界を参照し、WordPress接続、DnD Engine接続、物理位置から論理移動先への変換、DnD Session状態を分離する。

Architecture上の責務はソースファイル構成を写したものではない。実装単位が変わっても維持すべき責務、依存方向、状態所有を定義する。

## 2. Architecture Constraints

- Row ReorderとColumn Reorderは独立した実装とし、両者の間に方向固有状態または共通の並び替え抽象化を導入しない。
- Reorder ModeはWordPress UIを所有せず、`edit | row | column`の排他状態と対象Table Identity、およびTable単位のLifecycleだけを所有する。
- WordPress Reorder IntegrationはTableツールバー入口、現在Tableとの接続、通常編集開始の抑止、およびRow DnD Engine Integrationの有効化を所有する。
- Reorder Guidanceは現在表示中の共通案内状態だけを所有する。PC / タッチごとの初回案内表示済み状態、操作環境判定、WordPress preferencesへの永続化はReorder Guidance Integrationが所有する。
- Editor DOM Contextは現在のeditor contextを要求時点で解決し、以前のcontextへfallbackしない。
- Input InteractionはPC / タッチの開始入力条件、`tbody`直下行からの開始候補解決、第一段階Reorder Target Resolution、および開始可能候補のDnD Engineへの一時登録だけを扱う。Reorder ModeまたはEditor DOM Contextを直接参照しない。
- Row DnD Engine IntegrationはDnD Engine固有の物理LifecycleをRow Reorderへ接続し、第二段階Reorder Target Resolution、Destination Resolution、DnD Interactionへの橋渡し、およびそのDnDだけの接続一時状態を所有する。
- Destination ResolutionはDnD Engineの物理入力位置とDnD開始時のTable配置を論理的な行間境界へ変換する。`rowspan`等の構造制約による移動可否判定は所有しない。
- Destination ResolutionはDnD InteractionのSession開始条件ではない。DnD開始時に解決境界を成立させられない場合でもSessionは開始でき、最初の進行時に解決境界を成立させられる。
- Reorder Target Resolutionはactive DnD成立前に、Input Interactionによる第一段階とRow DnD Engine Integrationによる第二段階の二回、要求時点のTable制約からReorder Targetの成立可否を解決する。
- Reorder Target自体は移動する行だけを表し、開始時制約や開始不可理由を含めない。
- 第二段階で開始可能と解決した行制約をDnD InteractionのSession開始時制約として引き継ぐ。
- DnD InteractionはDnD Engine固有のイベント、座標、計測結果を保持せず、Destination Resolutionで解決済みの論理行間境界だけを受け取る。
- `progress`ではSession開始時制約を基準に論理行間境界の有効性を判定し、Table Integrationから現在構造を取得し直さない。
- `complete`では現在のTable構造を取得し直し、Reorder Targetと最終移動先が現在も成立する場合だけTable Integrationへ確定済み行移動を要求する。
- 行DnD中はTableデータを並べ替えず、確定時だけTable Integrationを通じて行順を更新する。
- Table IntegrationはCore Table / Flexible Table Block差を吸収し、Row Reorderへ行並び替えに必要な最小限の行制約だけを公開する。
- Table Integrationは1回の成立した行移動を1回のWordPress更新およびUndo単位として反映する。
- DnD Engineが提供する標準の移動表示は利用せず、行DnD中の利用者向け表示はReorder Presentationが独立して所有する。
- Reorder Presentationは操作可能 / 移動不可表示の意味をReorder Target Resolutionから受け取り、`rowspan`等の開始可否判定を重複して所有しない。表示用判定は実際のDnD開始可否の権威にはしない。
- 行DnDの自動スクロールはDnD Engineの機能として扱い、縦方向だけを有効にする。
- 対応Table Block固有の保存表現はTable Integration、WordPress固有のUIとpreferences永続化はWordPress Integration境界、DnD Engine固有のLifecycleとイベントはRow DnD Engine IntegrationまたはDestination Resolutionで吸収する。
- 正常な利用不能、cancel、外部環境変化による継続不能、内部Contractまたはruntime invariant違反を区別する。
- 内部Errorは原則として握りつぶさず正常結果へ変換しない。内部Errorそのものを利用者向け通知理由としない。
- 外部環境変化による継続不能は内部Errorとして扱わず、安全な終了結果として扱う。
- Performanceの責任境界は、対応Table Block本体の属性更新・再描画性能ではなく、Row Reorder自身が追加する並び替え処理のコストとする。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | 対応Tableのツールバー、既存Block wrapper、入力、および行DnD表示が存在する編集環境を提供する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | Core TableまたはFlexible Table Blockとして、Table Integrationが行制約取得と行順更新を行う対象を提供する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_WORDPRESS_PREFERENCES | WordPress Preferences | External Capability | PC / タッチごとの初回案内表示済み状態を永続化する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | 行DnD中に縦方向へ自動スクロールする対象領域を提供する。 |
| EXT_DND_ENGINE | DnD Engine | External Library | 物理DnDの開始候補登録、開始・移動・終了Lifecycle、物理入力情報、および自動スクロールを提供する。 |

WordPress固有のUI接続とpreferences永続化はRow Reorderの意味責務から分離する。DnD Engine固有のイベントはRow DnD Engine IntegrationとDestination Resolutionで吸収し、DnD Interactionへは行DnDの意味状態だけを渡す。

## 4. Solution Strategy

Row Reorderは、共通状態、WordPress接続、入力、開始対象解決、DnD Engine接続、物理位置から論理境界への変換、DnD Session、Table Block差、表示を別責務として扱う。

Reorder Modeは排他状態とTable単位Lifecycleだけを所有し、WordPress Reorder IntegrationがTableツールバー入口と現在TableをReorder Modeへ接続する。Reorder Guidanceは現在表示中の案内状態だけを所有し、Reorder Guidance IntegrationがEditor環境、WordPress preferences、Reorder Modeとの接続を所有する。

Input InteractionはWordPress Reorder IntegrationからRow DnD Engine Integrationを通じて有効化され、入力方式固有の開始条件を判断する。開始候補はReorder Target Resolutionで第一段階解決し、開始可能な場合だけDnD Engineへ一時登録する。Designで通知対象となる開始拒否理由はInput InteractionからReorder Presentationへ渡す。

Row DnD Engine IntegrationはDnD Engineのactive DnD成立直前にReorder Target Resolutionの第二段階を要求する。第二段階が成立した場合だけ解決済みReorder Targetと開始時制約をDnD Interactionへ渡し、物理DnDの開始・移動・終了をRow Reorderの意味境界へ接続する。DnD開始時にDestination Resolutionを成立させられない場合でもSession開始を妨げず、最初の進行時に解決境界を成立させる。

Destination ResolutionはDnD Engineの物理入力位置をDnD開始時のTable配置に対する論理行間境界へ変換する。スクロールによる対象Table全体の現在位置変化には追従してよいが、Presentationによる行の見かけ上の移動を論理移動先判定へ混入させない。`rowspan`等による移動可否は判断しない。

DnD InteractionはDestination Resolutionで解決済みの論理行間境界をSession開始時制約へ照合し、有効な移動先だけを意味状態として保持する。`complete`では現在構造へ再照合し、成立する場合だけTable Integrationへ確定済み行移動を要求する。

### Process Flow Views

#### Row Reorder End-to-End {#PV_ROW_REORDER_END_TO_END kind=normal}

WordPress Editorの入力が共通統合境界からRow DnD境界へ入り、第一段階Target Resolution、DnD Engineへの一時登録、第二段階Target Resolution、物理位置から論理境界への変換、DnD Session、確定更新へ進む主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | normal | 対応Tableの選択、ツールバー操作、既存Block wrapper上の入力がWordPress接続境界へ入る。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ROW_DND_ENGINE_INTEGRATION | normal | 対象TableのRow Reorder有効状態をDnD Engine接続境界へ反映する。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_INPUT_INTERACTION | normal | 有効なRow DnD境界から開始入力処理へ進む。 |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_TARGET_RESOLUTION | normal | 開始候補を第一段階の現在制約で事前解決する。 |
| RESP_ROW_INPUT_INTERACTION | EXT_DND_ENGINE | normal | 第一段階で開始可能な候補だけを物理DnD開始候補として一時登録する。 |
| EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | normal | active DnD成立前後の物理LifecycleをRow Reorder接続境界へ通知する。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_TARGET_RESOLUTION | normal | active DnD成立直前に同じReorder Targetを第二段階の現在制約で再解決する。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DESTINATION_RESOLUTION | normal | active DnDの物理移動を論理行間境界の解決へ進める。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | normal | 解決済み開始情報、論理行間境界、終了種別を行DnD Sessionへ渡す。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | normal | complete時に現在構造の再照合と確定済み行移動の反映へ進む。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | normal | 現在行制約を取得し、確定時は`tbody`の行順を反映する。 |

#### External Environment Change and Recovery {#PV_ROW_EXTERNAL_CHANGE_RECOVERY kind=failure-recovery}

active DnDの物理Lifecycleがcancelとなる場合、またはcomplete時の現在Tableが安全に利用できない場合に、新しい行順を確定せずSessionを終了する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | failure | 物理DnDがcancelまたは継続不能として終了する。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | recovery | 物理DnDの終了種別を行DnD Sessionのcancelへ接続する。 |
| RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | failure | complete時の現在Table利用不能または更新不能を安全な確定不能結果として返す。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | recovery | DnD中表示を終了し、Designで通知対象となる確定不能だけを一回性通知へ反映する。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | recovery | Session終了後に対象Tableで行並び替えを継続できるかだけを共通モード状態へ反映する。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | `edit / row / column`の排他状態、対象Table Identity、およびTable単位のモードLifecycleを所有する共通状態責務。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | 現在どのTableへどの操作環境の共通入口案内を表示しているかという一時状態だけを所有する共通状態責務。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のEditor DOM基準から、その表示環境に属するDOM / Web API contextを要求時点で解決する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | WordPress Reorder Integration | Tableツールバー入口、通常編集抑止、現在TableとReorder Mode、および方向固有DnD境界をWordPress Editorへ接続する。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | Reorder Guidance Integration | 初回案内の表示契機、操作環境判定、WordPress preferences永続化、Reorder Mode選択による案内終了を接続する。 |
| RESP_ROW_INPUT_INTERACTION | Input Interaction | PC / タッチの開始条件を解釈し、開始候補を第一段階Target Resolutionで事前解決して、開始可能な候補だけをDnD Engineへ登録する。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | DnD Engine Integration | DnD Engineの物理Lifecycleを第二段階Target Resolution、Destination Resolution、DnD Interactionへ接続し、そのDnDだけの接続一時状態を所有する。 |
| RESP_ROW_DESTINATION_RESOLUTION | Destination Resolution | DnD Engineの物理入力位置をDnD開始時のTable配置に対する論理行間境界へ変換する。 |
| RESP_ROW_TABLE_INTEGRATION | Table Integration | 指定された対応Tableの現在行制約取得、確定済み行移動、およびWordPress Undo境界を提供する。 |
| RESP_ROW_TARGET_RESOLUTION | Reorder Target Resolution | active DnD成立前に現在行制約から行の開始可否を二段階で解決し、開始可能時は開始時制約を返す。 |
| RESP_ROW_DND_INTERACTION | DnD Interaction | 解決済みReorder Targetから始まる行DnD Session、論理移動先の有効性、確定、cancel、終了後モード解決を所有する。 |
| RESP_ROW_PRESENTATION | Reorder Presentation | 開始不可、操作可能 / 移動不可、移動対象、水平挿入位置、周囲行移動、終了通知をRow Reorderの独立表示として表現する。 |

### Ownership Boundaries

| ID | Name | Includes |
| --- | --- | --- |
| BOUNDARY_REORDER_COMMON | Reorder Common | RESP_REORDER_MODE RESP_REORDER_GUIDANCE |
| BOUNDARY_EDITOR_INTEGRATION | Editor Integration | RESP_EDITOR_DOM_CONTEXT |
| BOUNDARY_WORDPRESS_REORDER | WordPress Reorder Integration | RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION |
| BOUNDARY_ROW_REORDER | Row Reorder | RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION |
| BOUNDARY_WORDPRESS_EXTERNAL | WordPress External | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES EXT_SCROLL_AREA |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のEditor DOM基準と同じ表示環境のcontextを解決するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | Tableツールバー、現在Tableの編集面、WordPress側Lifecycleへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | ツールバー選択、通常編集抑止、対象Table単位の現在モードを接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ROW_DND_ENGINE_INTEGRATION | 対象Tableの行並び替え有効状態を方向固有DnD境界へ接続するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_EDITOR | 初回案内の表示契機とWordPress Editor上の表示位置を接続するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_PREFERENCES | PC / タッチごとの初回案内表示済み状態を永続化するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_EDITOR_DOM_CONTEXT | 現在のEditor DOMに対する操作環境を解決するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_GUIDANCE | 現在の共通入口案内状態を開始・終了するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_MODE | いずれかの並び替え入口選択を案内終了条件として扱うために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_TARGET_RESOLUTION | 入力開始候補を第一段階の現在制約で解決するために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | EXT_DND_ENGINE | 開始可能な候補だけを物理DnD開始候補として一時登録するために必要とする。 |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_PRESENTATION | 第一段階でDesign上の開始拒否理由が返った場合に一回性の利用者向け通知へ接続するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_INPUT_INTERACTION | DnD Engine境界の配下で行開始入力を有効化し、開始候補登録を接続するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | EXT_DND_ENGINE | 物理DnDの開始前、開始、移動、終了Lifecycleを受け取るために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_TARGET_RESOLUTION | active DnD成立直前の第二段階開始可否を解決するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DESTINATION_RESOLUTION | 物理DnD移動を論理行間境界へ変換するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | 解決済み開始情報、論理移動先、終了種別を行DnD Sessionへ接続するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_PRESENTATION | 同じDnD Engine境界で独立したRow Reorder表示を活動させるために必要とする。 |
| RESP_ROW_DESTINATION_RESOLUTION | EXT_DND_ENGINE | 現在の物理入力位置を論理行間境界へ変換するためにDnD Engineの移動情報を必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有の行構造取得と行順更新を行うために必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した1回の行移動を1回のUndo単位として維持するために必要とする。 |
| RESP_ROW_TARGET_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 要求時点の現在行制約から行の開始可否と開始時制約を解決するために必要とする。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | complete時の現在構造再照合、確定済み行移動、終了後の対象Table継続可否確認に必要とする。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | Session終了後に対象Tableで行並び替えを安全に継続できるかだけを現在モードへ反映するために必要とする。 |
| RESP_ROW_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 現在のEditor DOM contextで一時表示を配置するために必要とする。 |
| RESP_ROW_PRESENTATION | EXT_DND_ENGINE | 移動対象表示等に必要な物理DnD情報をSessionへ複製せず利用するために必要とする。 |
| RESP_ROW_PRESENTATION | RESP_ROW_TARGET_RESOLUTION | 操作可能 / 移動不可表示で開始可否の意味を重複判定せず利用するために必要とする。 |
| RESP_ROW_PRESENTATION | RESP_ROW_DND_INTERACTION | active状態と現在の有効移動先を購読し、終了通知を受け取るために必要とする。 |
| EXT_DND_ENGINE | EXT_SCROLL_AREA | 行DnD中に縦方向の自動スクロールを実行する対象領域として必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_ROW_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES EXT_SCROLL_AREA EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION |
| DV_ROW_EDITOR_INTEGRATION | Editor Integration | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ROW_DND_ENGINE_INTEGRATION |
| DV_ROW_DND_CORE | DnD Core | EXT_DND_ENGINE RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION |
| DV_ROW_FEEDBACK | DnD Feedback | EXT_DND_ENGINE RESP_EDITOR_DOM_CONTEXT RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION |
| DV_ROW_DATA_UPDATE | Table Update | EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

通常編集、行並び替え、列並び替えの排他状態と、その並び替えモードが有効なTableを所有する。WordPress UI自体は所有しない。

##### State ownership

`edit | row | column`の排他状態と、`row | column`が関連付くTable Identityを所有する。Table内容、方向固有制約、DnD Session、ツールバー表示状態、WordPress Editor状態を所有しない。

##### Contract

外側のWordPress Reorder Integrationから入口選択、現在Table観測、Table非アクティブ化を受ける。同じTableの選択中入口を再選択した場合は`edit`へ戻し、別方向を選択した場合は方向を切り替える。方向固有DnD終了後は、そのSession対象Tableで次の並び替えを安全に受けられるかという結果だけを受け取る。

##### Lifecycle

`edit`から入口選択により`row`または`column`へ移行する。別Tableが操作対象になった場合は`edit`へ戻る。ツールバー統合境界の再生成だけでは状態を終了しない。complete、cancel、成立しないdropだけでも終了しない。

##### Invariants

- 同時に有効なモードは一つだけとする。
- `row | column`は必ず一つのTable Identityへ関連付ける。
- WordPress UIと方向固有DnD Sessionを所有しない。
- 過去のDnD終了結果で、すでに別モードまたは別Tableへ遷移した現在状態を上書きしない。

#### Reorder Guidance {#RESP_REORDER_GUIDANCE}

##### Responsibility

現在表示中の初回共通案内について、対象Tableと操作環境だけを共通状態として所有する。

##### State ownership

現在表示中の案内のTable Identityと`pc | touch`だけを所有する。PC / タッチごとの永続的な表示済み状態、WordPress preferences、Reorder Mode、DnD Sessionは所有しない。

##### Contract

Reorder Guidance Integrationから案内開始・終了を受け、現在表示中の共通案内状態だけを更新する。別Tableからの終了要求で現在の案内を誤って終了しない。

##### Lifecycle

案内開始で一時状態を生成し、利用者による案内終了またはいずれかのReorder入口選択をReorder Guidance Integrationが検出した時点で終了する。

##### Invariants

- 永続的な表示済み状態を所有しない。
- 行または列固有状態を共通案内状態へ保持しない。
- 同じTable・同じ操作環境の案内を重複開始しない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のEditor DOMに属する基準要素から、その表示環境でDOM / Web APIを利用するためのcontextを解決する。

##### State ownership

解決結果をeditor lifecycleをまたぐcacheとして所有しない。Reorder Mode、Guidance、DnD Session、Tableデータを所有しない。

##### Contract

現在の基準から利用可能なcontextだけを返し、解決できない場合は以前のcontextへfallbackせず正常な不在を返す。

##### Lifecycle

DOM / Web APIを必要とする要求ごとに現在の基準から解決する。

##### Invariants

- iframe / non-iframe差を利用側へ判定させない。
- 過去のEditor contextへfallbackしない。
- context不在を内部Errorとして扱わない。

#### WordPress Reorder Integration {#RESP_WORDPRESS_REORDER_INTEGRATION}

##### Responsibility

WordPress EditorのTableツールバー、現在Table、通常編集開始、Reorder Mode、および方向固有DnD境界を接続する。

##### State ownership

WordPress統合に必要な現在Table観測と接続状態だけを所有する。Reorder Modeの意味状態、行DnD Session、行制約を所有しない。

##### Contract

Tableツールバー選択をReorder Modeへ渡し、現在Tableと選択モードが一致する場合だけ対応する方向固有DnD境界を有効化する。`row | column`では対象Tableの通常編集開始を抑止する。現在の操作対象が別Tableへ移った場合はReorder ModeへTable非アクティブ化を伝える。

##### Lifecycle

WordPress EditorのBlock wrapperとツールバーのLifecycleに追従して接続を更新するが、UI componentのunmount / remountだけをReorder Mode終了条件にはしない。

##### Invariants

- Reorder Modeの排他状態を複製しない。
- Row / Column固有Sessionを所有しない。
- WordPress UI責務をReorder Modeへ押し戻さない。

#### Reorder Guidance Integration {#RESP_REORDER_GUIDANCE_INTEGRATION}

##### Responsibility

初回案内の表示契機、操作環境判定、WordPress preferences永続化、Reorder Mode選択、およびReorder Guidanceの一時状態を接続する。

##### State ownership

PC / タッチごとの初回案内表示済み状態はWordPress preferencesを正本として扱う。現在表示中案内の意味状態はReorder Guidanceに委ね、複製しない。

##### Contract

現在のEditor環境とpreferencesから初回案内が必要か判断し、必要な場合だけReorder Guidanceを開始する。利用者が案内を閉じる、またはいずれかのReorder入口を選択した場合は案内を終了し、その操作環境の表示済み状態をpreferencesへ永続化する。

##### Lifecycle

Editor上の対象Tableと操作環境に応じて案内開始を評価し、案内終了またはReorder Mode選択で表示済み状態を確定する。

##### Invariants

- 永続的な表示済み状態をReorder Guidanceへ持たせない。
- PC / タッチの表示済み状態を相互に混同しない。
- 行または列固有DnD状態を保持しない。

#### Input Interaction {#RESP_ROW_INPUT_INTERACTION}

##### Responsibility

PC / タッチの開始入力条件を判断し、`tbody`直下行から開始候補を解決し、第一段階Reorder Target Resolutionを通過した候補だけをDnD Engineへ一時登録する。

##### State ownership

入力方式固有の開始前一時状態と、その開始試行に必要なDnD Engine開始候補接続だけを所有する。Reorder Mode、Editor DOM Context、active DnD Session、Destination Resolution状態を所有しない。

##### Contract

外側から対象Table IdentityとRow Reorder有効状態を受ける。開始条件が成立した場合は候補をReorder Target Resolutionへ渡し、開始可能な場合だけDnD Engineへ一時登録する。Design上の開始拒否理由はReorder Presentationへ渡す。

##### Lifecycle

Row DnD Engine Integrationによって有効化されている期間だけ開始入力を受理する。開始試行終了、物理DnD終了、モード無効化で自身の一時状態と開始候補接続を破棄する。

##### Invariants

- Reorder ModeとEditor DOM Contextへ直接依存しない。
- 開始可能と解決されていない候補をDnD Engineへ登録しない。
- 行DnD Sessionまたは物理DnD状態を所有しない。

#### DnD Engine Integration {#RESP_ROW_DND_ENGINE_INTEGRATION}

##### Responsibility

DnD Engine固有の物理LifecycleをRow Reorderへ接続し、第二段階Reorder Target Resolution、Destination Resolution、DnD Interaction、およびReorder Presentationを一回の行DnDへ結び付ける。

##### State ownership

一回の物理DnDだけに属するDnD Engine接続状態と、Destination Resolutionを成立させるための一時参照だけを所有する。Reorder Targetの意味状態、開始時制約、現在の有効移動先はDnD Interactionへ渡し、自身の長期状態として所有しない。

##### Contract

active DnD成立直前に同じReorder Targetを第二段階Reorder Target Resolutionへ渡す。開始可能な場合だけReorder Targetと開始時制約をDnD Interactionへ渡してSessionを開始する。物理移動ではDestination Resolutionへ物理入力を渡し、解決済み論理行間境界だけをDnD Interactionへ渡す。cancel / completeをDnD Interactionへ接続する。行DnDではDnD Engineの自動スクロールを縦方向だけ有効にする。

DnD開始時にDestination Resolutionを成立させられない場合でもSession開始を妨げず、最初の物理移動時に解決境界を成立させられる。

##### Lifecycle

Row Reorderが有効な期間にInput InteractionとReorder PresentationをDnD Engine境界へ接続する。物理DnDごとに第二段階解決、Session開始、進行、cancel / completeを接続し、終了時にそのDnDだけの接続一時状態を破棄する。

##### Invariants

- 第二段階Reorder Target Resolutionを省略してactive Sessionを開始しない。
- Destination ResolutionをSession開始の必須前提にしない。
- DnD Engine固有状態をDnD InteractionのSessionへ保存しない。
- Input InteractionとReorder PresentationのDnD Engine直接依存を機械的に集約しない。

#### Destination Resolution {#RESP_ROW_DESTINATION_RESOLUTION}

##### Responsibility

DnD Engineの物理入力位置を、DnD開始時の対象Table配置に対する論理的な行間境界へ変換する。

##### State ownership

一回のDnDに対する論理判定基準となる開始時Table配置を所有できる。行構造制約、Reorder Target、現在の有効移動先、DnD Sessionを所有しない。

##### Contract

物理入力位置から対象Table内の論理行間境界を返す。スクロールによるTable全体の現在位置変化には追従するが、Presentationによる見かけ上の行移動を論理判定基準へ混入させない。物理入力から論理境界を安全に解決できない場合は正常な不在を返す。

##### Lifecycle

物理DnD開始時に解決境界を成立させられる場合はその時点で開始時Table配置を固定する。開始時に成立しない場合は最初の進行時に成立させる。DnD終了時に一時状態を破棄する。

##### Invariants

- `rowspan`等の構造制約による移動可否を判定しない。
- Presentationによる視覚的な行移動を移動先判定へ混入させない。
- DnD Interactionの意味状態を所有しない。

#### Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility

Supported Table Blockとの差を吸収し、指定されたTable Identityに対する現在行制約、確定済み行移動、およびWordPress Undo境界を提供する。

##### State ownership

DnD Sessionや入力状態を所有しない。外部TableデータをRow Reorder独自の永続状態として複製しない。

##### Contract

Reorder Target Resolutionへ要求時点の現在行制約を提供する。DnD Interactionのcompleteでは現在構造の再照合に必要な行制約を提供し、成立を確認済みの行移動だけを`tbody`の行順更新として反映する。Core Table / Flexible Table Block差をこの境界で吸収し、Row Reorderへ列専用構造やBlock固有表現を漏らさない。

##### Lifecycle

要求時点のSupported Table Blockから現在情報を取得または更新する。外部Table状態を監視する永続cacheは持たない。

##### Invariants

- 行並び替えに不要な列専用構造を公開しない。
- `tbody`の行順以外を並び替え結果として変更しない。
- 一つの確定済み行移動を複数の独立したUndo単位へ分割しない。

#### Reorder Target Resolution {#RESP_ROW_TARGET_RESOLUTION}

##### Responsibility

active DnD成立前に現在の行制約に対してReorder Targetが行単位の移動対象として成立するかを二段階で解決する。

##### State ownership

開始試行を越える共有状態、DnD Session、入力状態、表示状態、Tableデータを所有しない。

##### Contract

第一段階ではInput Interactionから、第二段階ではRow DnD Engine Integrationから同じ意味のReorder Targetを受ける。要求時点のTable Integrationから現在制約を取得し、開始可能な場合はReorder Targetと開始時制約を返す。`rowspan`等により移動できない場合はDesignで利用者へ提示できる開始不可理由を返す。

##### Lifecycle

各開始試行で第一段階を解決し、active DnD成立直前に第二段階を現在制約から解決し直す。解決結果は開始試行終了後に保持しない。

##### Invariants

- Reorder Targetへ開始時制約や開始不可理由を含めない。
- 第一段階だけを根拠にactive Sessionを開始しない。
- 表示用の事前判定を実際のDnD開始可否の権威として再利用しない。

#### DnD Interaction {#RESP_ROW_DND_INTERACTION}

##### Responsibility

解決済みReorder Targetから始まる行DnD Sessionを所有し、解決済み論理行間境界の有効性判定、complete時再照合、確定、cancel、および終了後のモード継続可否通知を管理する。

##### State ownership

active SessionはReorder Target、対象Table Identity、第二段階で得た開始時制約、および現在の有効移動先だけを所有する。DnD Engine固有イベント、座標、計測結果を保持しない。

##### Contract

startでは第二段階で解決済みのReorder Targetと開始時制約を受ける。progressではDestination Resolutionで解決済みの論理行間境界を受け、Session開始時制約で有効な場合だけ現在移動先として保持する。completeではTable Integrationから現在構造を取得し直してReorder Targetと最終移動先を再照合し、現在も成立して実際に行順が変化する場合だけ確定済み行移動を要求する。

##### Lifecycle

idleからstartでactiveとなる。progressで意味状態だけを更新し、completeまたはcancelで終了する。外部環境変化により安全に継続できない場合は新しい行順を確定せず終了する。

##### Invariants

- active Sessionは同時に一つだけ存在する。
- progressでは現在構造を取得し直さずSession開始時制約を利用する。
- completeでは現在構造へ再照合せずに確定しない。
- DnD Engine固有状態をSessionへ保持しない。
- Destination Resolutionを所有しない。

#### Reorder Presentation {#RESP_ROW_PRESENTATION}

##### Responsibility

行並び替えに必要な利用者向け一時表示を表現する。開始不可、操作可能 / 移動不可、移動対象、水平挿入位置、周囲行移動、およびDesignで定義された終了通知を扱う。

##### State ownership

表示と一時通知に必要な状態だけを所有し、共通案内状態、Tableデータ、行DnD Session、DnD Engine物理状態を所有しない。

##### Contract

Reorder Target Resolutionの結果を利用して操作可能 / 移動不可表示と開始不可理由を表現するが、Presentation自身では構造制約を再判定しない。表示用判定は実際の開始権威とせず、実際の開始時には第一段階・第二段階で現在制約を解決し直す。DnD中はDnD Interactionの意味状態と、必要な場合だけDnD Engineの物理情報を利用して一時表示する。

##### Lifecycle

表示理由が成立している期間だけ活動し、DnD終了またはDesignで定義された表示期間終了時に一時状態を破棄する。

##### Invariants

- DnD中の表示のために実Tableの行順を変更しない。
- `rowspan`等の開始可否判定を重複して所有しない。
- DnD Engine標準の移動表示へ責務を委ねない。
- cancelまたは成立しないdropで異常終了メッセージを表示しない。

## 6. Runtime View

### Row DnD start {#RV_ROW_DND_START}

第二段階Reorder Target Resolutionが成立した場合に、解決済みReorder Targetと開始時制約でRow DnD Sessionを開始する。Destination Resolutionの成立はSession開始の前提としない。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | active DnD成立直前の物理Lifecycleを通知する。 |
| 2 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_TARGET_RESOLUTION | 同じReorder Targetを現在制約で第二段階解決する。 |
| 3 | RESP_ROW_TARGET_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 現在行制約を要求する。 |
| 4 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Blockから現在行制約を取得する。 |
| 5 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | 第二段階が成立した場合だけ解決済みReorder Targetと開始時制約でSessionを開始する。 |

### Row DnD progress {#RV_ROW_DND_PROGRESS}

物理入力位置をDestination Resolutionで論理行間境界へ変換し、その解決結果だけをDnD Interactionへ渡す。DnD開始時にDestination Resolutionを成立させられなかった場合は、最初の進行時に成立させる。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | 現在の物理DnD移動を通知する。 |
| 2 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DESTINATION_RESOLUTION | 物理入力位置を論理行間境界へ変換する。 |
| 3 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | 解決済み論理行間境界をprogressへ渡す。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | 現在の有効移動先に対応する表示意味を更新する。 |
| 5 | EXT_DND_ENGINE | EXT_SCROLL_AREA | 必要な場合だけ縦方向へ自動スクロールする。 |

### Row DnD complete {#RV_ROW_DND_COMPLETE}

completeでは現在構造へ再照合し、現在も成立して実際に行順が変化する場合だけ確定済み行移動を反映する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | 物理的なcompleteを通知する。 |
| 2 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | completeを行DnD Sessionへ渡す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在構造を取得してReorder Targetと最終移動先を再照合する。 |
| 4 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在行制約を取得する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在も成立し行順が変化する場合だけ確定済み行移動を要求する。 |
| 6 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | `tbody`の行順だけを更新する。 |
| 7 | RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した1回の行移動を1回のUndo単位として維持する。 |
| 8 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中表示を終了する。 |
| 9 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 対象Tableで行並び替えを継続できるかだけを通知する。 |

### Row DnD external change abort {#RV_ROW_DND_EXTERNAL_ABORT}

外部環境変化により安全に継続または確定できない場合は新しい行順を確定せずSessionを終了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | cancelまたは継続不能として物理DnDを終了する。 |
| 2 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | cancelまたは継続不能をSessionへ渡す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中表示を終了し、Designで通知対象の場合だけ一時通知を要求する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 対象Tableで行並び替えを継続できるかだけを通知する。 |

## 8. Crosscutting Concepts

### 開始可否の二段階解決

開始候補をDnD Engineへ登録する前の第一段階と、active DnD成立直前の第二段階で同じ意味のReorder Targetを現在制約から解決する。第一段階は不要な物理DnD開始を防ぎ、第二段階は入力開始後の外部Table変化を確認する。

### 物理DnDと意味状態の分離

DnD Engine固有のイベント、座標、計測結果はRow DnD Engine IntegrationまたはDestination Resolutionで解釈し、DnD Interactionへは解決済みReorder Target、開始時制約、論理行間境界、終了種別だけを渡す。

### complete時の現在構造への再照合

progressで有効だった移動先はSession開始時制約に対する結果である。completeでは現在構造へ再照合し、現在も成立する場合だけ新しい行順を確定する。

### 正常な不在と内部Error

Editor context不在、対象Table不在、Reorder Target不成立、有効な移動先なし、complete時の確定不能は正常な結果として扱う。一方、Row Reorderが所有するContractまたはruntime invariant違反はErrorとして扱い、正常結果へ変換しない。

### Compatibility

Core TableとFlexible Table Blockの差はTable Integrationが吸収する。Editorのiframe / non-iframe差はEditor DOM ContextとWordPress Integration境界で吸収し、Row Reorderの意味責務へ漏らさない。

### Performance

- 行並び替えモード開始時にTable全体の開始候補をDnD Engineへ固定登録しない。
- 移動先解決のためにTable全体をDnD Engineの移動先候補として登録しない。
- DnD中にTableデータの行順を更新しない。
- progressではSession開始時制約を利用し、現在構造を都度取得しない。
- complete時だけ現在構造を取得し直す。
- Reorder Target Resolution結果を開始試行を越えてcacheしない。

## 9. Architecture Decisions

### AD-01 Row ReorderをColumn Reorderから独立させる

行と列では制約、移動先、更新、表示、自動スクロールの意味と変更理由が異なるため、方向固有状態を共通化しない。

### AD-02 Reorder Modeを意味状態へ限定する

通常編集 / 行 / 列の排他状態とTable単位LifecycleはReorder Modeが所有するが、Tableツールバー、現在Table観測、通常編集抑止はWordPress Reorder Integrationへ分離する。

### AD-03 Reorder Guidanceの永続化を統合境界へ分離する

Reorder Guidanceは現在表示中の案内状態だけを所有し、PC / タッチごとの表示済み状態、操作環境判定、WordPress preferences永続化はReorder Guidance Integrationが所有する。

### AD-04 DnD Engine Integrationを物理Lifecycle接続境界として分離する

第二段階Target Resolution、Destination Resolution、DnD Interaction、cancel / completeの接続はDnD Engine固有Lifecycleと同じ変更理由を持つため、Row DnD Engine Integrationへ集約する。ただしInput Interactionの開始候補登録とReorder Presentationの物理情報利用は直接依存として残す。

### AD-05 Destination Resolutionを独立させる

物理入力位置から論理行間境界への変換は、Session意味状態や`rowspan`制約判定とは異なる変更理由を持つため独立責務とする。DnD開始時配置を論理判定基準とし、Presentationによる見かけ上の行移動を判定へ混入させない。

### AD-06 Destination ResolutionをSession開始条件にしない

active DnD成立時にDestination Resolutionを成立させられなくても、第二段階Target Resolutionが成立していればSessionは開始できる。解決境界は最初の進行時に成立させられる。

### AD-07 DnD Interactionを意味状態とSession Lifecycleへ限定する

DnD InteractionはDnD Engineの物理入力を解釈せず、Destination Resolutionで解決済みの論理行間境界だけを受け取る。物理イベント、座標、計測結果はSessionへ保持しない。

### AD-08 Reorder Target Resolutionを二段階で行う

第一段階は開始候補登録前、第二段階はactive DnD成立直前に現在制約を解決する。第二段階で得た開始時制約だけをactive Sessionへ引き継ぐ。

### AD-09 complete時に現在構造へ再照合する

progress時の有効移動先を確定時まで無条件に有効とみなさず、completeで現在構造へ再照合し、現在も成立する場合だけ更新する。

### AD-10 dnd-kitをDnD Engine境界として扱う

dnd-kit固有のLifecycle名、座標、計測方法を意味責務へ持ち込まず、Architecture上は外部DnD Engineとして扱う。行DnDでは縦方向の自動スクロールだけを有効にする。

## 10. Quality Requirements

- 代表的な大規模Tableでも、Row Reorder自身が原因となる継続的な長時間停止を追加しない。
- iframe / non-iframeのEditor差をRow Reorderの意味責務へ漏らさない。
- Core Table / Flexible Table Block差をTable Integration外へ漏らさない。
- 一つの成立した行移動を一つのWordPress更新およびUndo単位として扱う。

## 11. Risks and Technical Debt

- DnD EngineおよびWordPress Editorの外部Lifecycle変更は統合境界へ影響し得るため、意味責務へ漏れないよう境界を維持する必要がある。
- Destination Resolutionの物理計測は表示・スクロールと近接するため、Presentationの見かけ上の移動を論理判定へ混入させないInvariantを維持する必要がある。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| Reorder Target | 1回の行並び替えで移動する行。 |
| Row Reorder Constraints | 行の開始可否と移動先有効性を判断するための開始時制約。 |
| Destination | 論理的な行間境界として表される移動先。 |
| DnD Engine Integration | DnD Engine固有の物理LifecycleをRow Reorderの意味責務へ接続する境界。 |
| Destination Resolution | DnD Engineの物理入力位置を論理行間境界へ変換する責務。 |
