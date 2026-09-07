# Row Reorder v1 Architecture

## 1. Introduction and Goals

本書は、正式v1の行並び替えを実現するための内部責務、境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

入力は`docs/design/reorder-v1-design.md`および`docs/design/row-reorder-v1-design.md`とし、利用者向け設計を行専用の責務モデルへ落とし込む。

本書はRow Reorderだけを対象とする。Column Reorderの方向固有状態や責務は共有しない。一方、共通状態責務、WordPress接続、DnD Engine接続、物理位置から論理移動先への変換、DnD Session状態の分離は、現在の正式v1実装で成立している境界として記述する。

Architecture上の責務はソースファイル構成を写したものではない。実装単位が変わっても維持すべき責務、依存方向、状態所有を定義する。

## 2. Architecture Constraints

- Row ReorderとColumn Reorderは独立した方向固有実装とし、両者の方向固有状態を共有しない。
- Reorder ModeはWordPress UIを所有せず、`edit | row | column`の排他状態、対象Table Identity、およびTable単位のLifecycleだけを所有する。
- WordPress Reorder IntegrationはTableツールバー入口、通常編集抑止、現在TableとReorder Modeの接続、およびRow DnD Engine Integrationの有効化を所有する。
- Reorder Guidanceは現在表示中の共通案内状態だけを所有する。PC / タッチごとの表示済み状態、操作環境判定、WordPress Preferencesへの永続化はReorder Guidance Integrationが所有する。
- Editor DOM Contextは現在のeditor contextを要求時点で解決し、以前のcontextへfallbackしない。
- Input Interactionは行DnDの開始入力と第一段階Reorder Target Resolutionだけを扱い、Reorder Mode、Editor DOM Context、DnD Interactionの状態やLifecycleを直接参照しない。
- Row DnD Engine IntegrationはDnD Engine固有のLifecycleをRow Reorderへ接続し、第二段階Reorder Target Resolution、Destination Resolution、DnD Interactionへの橋渡しを所有する。
- DnD Engine IntegrationをDnD Engineへの唯一の窓口としない。Input Interactionによる開始候補登録とReorder Presentationによる必要な物理DnD情報の利用は、各責務からDnD Engineへ直接依存してよい。
- Destination ResolutionはDnD Engineの物理入力位置と対象TableのDnD開始時配置を論理的な行間境界へ変換する。`rowspan`等の構造制約に対してその境界へ移動できるかの判定は所有しない。
- Destination Resolutionの成立はRow DnD Session開始の前提ではない。DnD開始時に解決境界を成立させられない場合でもSessionを開始でき、後続のmoveで再び解決境界の成立を試みられる。
- Reorder Target Resolutionはactive DnD成立前に、Input Interactionによる第一段階とRow DnD Engine Integrationによる第二段階の二回、要求時点のTable制約からReorder Targetの成立可否を解決する。
- Reorder Target自体は移動する`tbody`の行だけを表し、開始時制約や開始不可理由を含めない。
- 第二段階で開始可能と解決した行制約をDnD InteractionのSession開始時制約として引き継ぐ。
- DnD InteractionはDnD Engine固有の物理入力位置を保持・解釈せず、Destination Resolutionで解決済みの論理行間境界だけを受け取る。
- `progress`ではSession開始時制約を基準に論理行間境界の有効性を判定し、Table Integrationから現在構造を取得し直さない。
- `complete`では現在のTable構造を取得し直し、Reorder Targetと最終移動先が現在も成立する場合だけTable Integrationへ確定済み行移動を要求する。
- 行DnD中はTableデータを並べ替えず、確定時だけ行順を更新する。
- Table Integrationは指定されたTable Identityに対して現在行制約と確定済み行移動の反映能力を提供する。Table Identity自体の所有または発行は行わない。
- Table IntegrationはCore TableとFlexible Table Blockの保存表現差を吸収し、Row Reorderへ行並び替えに必要な最小限の制約だけを公開する。
- 成立した1回の行移動は1回のWordPress更新および1回のUndo単位として扱う。
- DnD Engineが提供する標準の移動表示は利用せず、行DnD中の利用者向け表示はReorder Presentationが独立して所有する。
- 行DnDの自動スクロールはDnD Engineの機能として扱い、縦方向だけを有効にする。
- Reorder Presentationは操作可能・移動不可表示のためにReorder Target Resolutionを利用できるが、その表示判定をDnD開始可否の権威にはしない。
- 正常な利用不能、cancel、成立しないdrop、外部環境変化による継続不能、内部Contractまたはruntime invariant違反を区別する。
- 内部Errorは原則として握りつぶさず正常結果へ変換しない。内部Errorそのものを利用者向け通知理由としない。
- 外部環境変化による継続不能は内部Errorとして扱わず、安全な終了結果として扱う。
- Performanceの責任境界は、対応Table Block本体の属性更新・再描画性能ではなく、Row Reorder自身が追加する並び替え処理のコストとする。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | 対応Tableのツールバー、編集面、入力、および行DnD表示が存在する編集環境を提供する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | Core TableまたはFlexible Table Blockとして、Table Integrationが行制約取得と行順更新を行う対象を提供する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_WORDPRESS_PREFERENCES | WordPress Preferences | External Capability | PC / タッチごとの初回案内表示済み状態を永続化する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | 行DnD中に縦方向へ自動スクロールする対象領域を提供する。 |
| EXT_DND_ENGINE | DnD Engine | External Library | 物理DnDの開始候補登録、開始・移動・終了Lifecycle、物理入力情報、および自動スクロールを提供する。 |

WordPress固有のUI接続と永続化はRow Reorderの意味責務から分離する。DnD Engine固有のLifecycleはRow DnD Engine Integrationが接続し、物理位置から論理移動先への変換はDestination Resolutionへ分離する。DnD Interactionへは行DnDの意味状態だけを渡す。

## 4. Solution Strategy

Row Reorderは、共通状態、WordPress接続、入力、開始対象解決、DnD Engine接続、物理位置から論理境界への変換、DnD Session、Table Block差、表示を別責務として扱う。

Reorder Modeは排他状態とTable単位Lifecycleだけを所有し、WordPress Reorder IntegrationがTableツールバー入口、現在Table、通常編集抑止をReorder Modeへ接続する。Reorder Guidanceは現在表示中の案内状態だけを所有し、Reorder Guidance IntegrationがEditor環境、WordPress Preferences、Reorder Modeとの接続を所有する。

Input InteractionはWordPress Reorder IntegrationからRow DnD Engine Integrationを通じて有効化され、入力方式固有の開始条件を判断する。開始候補はReorder Target Resolutionで第一段階解決し、開始可能な場合だけDnD Engineへ一時的に登録する。Designで通知対象となる開始拒否理由はInput InteractionからReorder Presentationへ渡す。

Row DnD Engine IntegrationはDnD Engineのactive DnD成立直前にReorder Target Resolutionの第二段階を要求する。第二段階が成立した場合だけ解決済みReorder Targetと開始時制約をDnD Interactionへ渡してSessionを開始する。Destination Resolutionの解決境界は同じDnDに属する一時状態として接続するが、その成立をSession開始条件にはしない。

Destination ResolutionはDnD Engineの物理入力位置をDnD開始時のTable配置に対する論理行間境界へ変換する。スクロールによる対象Table全体の現在位置変化には追従する一方、Presentationによる行の見かけ上の移動を論理移動先判定へ混入させない。`rowspan`等による移動可否は判断しない。

DnD InteractionはDestination Resolutionで解決済みの論理行間境界をSession開始時制約へ照合し、有効な移動先だけを意味状態として保持する。`complete`では現在構造へ再照合し、成立する場合だけTable Integrationへ行移動を要求する。

Reorder PresentationはDnD Interactionの意味状態と必要なDnD Engine物理情報を表示へ変換する。行並び替えモード中の操作可能・移動不可表示ではReorder Target Resolutionを利用して構造判定を重複させないが、実際のDnD開始では第一段階・第二段階の解決結果を権威とする。

### Process Flow Views

#### Row Reorder End-to-End {#PV_ROW_REORDER_END_TO_END kind=normal}

WordPress Editorの入力が共通統合境界からRow DnD境界へ入り、第一段階Target Resolution、DnD Engineへの一時登録、第二段階Target Resolution、物理位置から論理境界への変換、DnD Session、確定更新へ進む主要な処理方向を示す。Process Flowの行順はRuntime順序を定義しない。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | normal | 対応Tableの選択、ツールバー操作、対応Tableの編集面上の入力がWordPress接続境界へ入る。 |
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

物理DnDのcancel、またはcomplete時の現在Tableを安全に利用できない場合に、新しい行順を確定せずSessionを終了する処理方向を示す。

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
| RESP_REORDER_MODE | Reorder Mode | `edit | row | column`の排他状態、対象Table Identity、およびTable単位のモードLifecycleを所有する共通状態責務。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | 現在どのTableへどの操作環境の共通入口案内を表示しているかという一時状態だけを所有する共通状態責務。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のEditor DOM基準から、その表示環境に属するDOM / Web API contextを要求時点で解決する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | WordPress Reorder Integration | Tableツールバー入口、通常編集抑止、現在TableとReorder Mode、および方向固有DnD境界をWordPress Editorへ接続する。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | Reorder Guidance Integration | 初回案内の表示契機、操作環境判定、WordPress Preferences永続化、Reorder Mode選択による案内終了を接続する。 |
| RESP_ROW_INPUT_INTERACTION | Input Interaction | PC / タッチの開始条件を解釈し、開始候補を第一段階Target Resolutionで事前解決して、開始可能な候補だけをDnD Engineへ登録する。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | DnD Engine Integration | DnD Engineの物理Lifecycleを第二段階Target Resolution、Destination Resolution、DnD Interactionへ接続し、そのDnDだけの接続一時状態を所有する。 |
| RESP_ROW_DESTINATION_RESOLUTION | Destination Resolution | DnD Engineの物理入力位置をDnD開始時のTable配置に対する論理行間境界へ変換する。 |
| RESP_ROW_TABLE_INTEGRATION | Table Integration | 指定された対応Tableの現在行制約取得、確定済み行移動、およびWordPress Undo境界を提供する。 |
| RESP_ROW_TARGET_RESOLUTION | Reorder Target Resolution | active DnD成立前に現在行制約から移動行の開始可否を二段階で解決し、開始可能時は開始時制約を返す。 |
| RESP_ROW_DND_INTERACTION | DnD Interaction | 解決済みReorder Targetから始まる行DnD Session、論理移動先の有効性、確定、cancel、終了後モード解決を所有する。 |
| RESP_ROW_PRESENTATION | Reorder Presentation | 操作可否、開始不可、移動対象、水平挿入位置、周囲行移動、終了通知をRow Reorderの独立表示として表現する。 |

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
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_PRESENTATION | 第一段階でDesign上の開始拒否理由が返った場合に利用者向け通知へ接続するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_INPUT_INTERACTION | DnD Engine境界の配下で行開始入力を有効化し、開始候補登録を接続するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | EXT_DND_ENGINE | 物理DnDの開始前、開始、移動、終了Lifecycleを受け取るために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_TARGET_RESOLUTION | active DnD成立直前の第二段階開始可否を解決するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DESTINATION_RESOLUTION | 物理DnD移動を論理行間境界へ変換するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | 解決済み開始情報、論理移動先、終了種別を行DnD Sessionへ接続するために必要とする。 |
| RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_PRESENTATION | 同じDnD Engine境界で独立したRow Reorder表示を活動させるために必要とする。 |
| RESP_ROW_DESTINATION_RESOLUTION | EXT_DND_ENGINE | 現在の物理入力位置を論理行間境界へ変換するためにDnD Engineの移動情報を必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有の行構造取得と行順更新を行うために必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した1回の行移動を1回のUndo単位として維持するために必要とする。 |
| RESP_ROW_TARGET_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 要求時点の現在行制約から移動行の開始可否と開始時制約を解決するために必要とする。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | complete時の現在構造再照合、確定済み行移動、終了後の対象Table継続可否確認に必要とする。 |
| RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | Session終了後に対象Tableで行並び替えを安全に継続できるかだけを現在モードへ反映するために必要とする。 |
| RESP_ROW_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 現在のEditor DOM contextで一時表示を配置するために必要とする。 |
| RESP_ROW_PRESENTATION | EXT_DND_ENGINE | 移動対象表示等に必要な物理DnD情報をSessionへ複製せず利用するために必要とする。 |
| RESP_ROW_PRESENTATION | RESP_ROW_TARGET_RESOLUTION | 操作可能・移動不可表示で開始可否の意味を重複判定せず利用するために必要とする。 |
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

WordPress Reorder Integrationから入口選択、現在Table観測、Table非アクティブ化を受ける。同じTableの選択中入口を再選択した場合は`edit`へ戻し、別方向を選択した場合は方向を切り替える。方向固有DnD終了後は、そのSession対象Tableで次の並び替えを安全に受けられるかという結果だけを受け取る。

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

現在表示中の案内のTable Identityと`pc | touch`だけを所有する。PC / タッチごとの永続的な表示済み状態、WordPress Preferences、Reorder Mode、DnD Sessionは所有しない。

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

現在の基準要素と同じ表示環境のcontextを安全に提供できる場合だけ返す。解決できない場合は以前のcontextまたは別Editor contextへfallbackしない。

##### Lifecycle

DOM / Web APIを必要とする時点で現在の基準要素から解決する。

##### Invariants

- iframe / non-iframeというEditor方式を利用側へ判定させない。
- 現在の基準とは異なるcontextをfallbackとして提供しない。
- context利用不能をRow Reorder内部Errorへ変換しない。

#### WordPress Reorder Integration {#RESP_WORDPRESS_REORDER_INTEGRATION}

##### Responsibility

Reorder Modeと方向固有DnD境界をWordPress EditorのTableツールバー、現在Tableの編集面、通常編集開始へ接続する。

##### State ownership

WordPress統合Lifecycleに必要な一時参照だけを扱い、Reorder Mode状態、行DnD Session、Table制約を重複所有しない。

##### Contract

対応Tableのツールバー入口をReorder Modeの状態変更へ接続する。現在Tableに対するモードを購読し、`row`の場合だけRow DnD Engine Integrationを有効化する。`row | column`では通常編集開始を抑止し、`edit`ではWordPress本来の編集入力へ戻す。

##### Lifecycle

対応TableのWordPress統合境界が存在する間、現在モードを反映する。WordPress統合境界の再生成だけをモード終了条件にしない。

##### Invariants

- Reorder Mode状態をWordPress側へ別正本として複製しない。
- 行・列の排他をWordPress UI側だけで独自管理しない。
- WordPress Editorの表示構造を方向固有状態の正本にしない。

#### Reorder Guidance Integration {#RESP_REORDER_GUIDANCE_INTEGRATION}

##### Responsibility

初回共通案内をWordPress Editor、Editor DOM Context、WordPress Preferences、Reorder Modeへ接続する。

##### State ownership

PC / タッチごとの表示済み状態はWordPress Preferencesへ永続化し、自身は永続状態の別copyを所有しない。現在表示中状態はReorder Guidanceに委ねる。

##### Contract

現在のEditor DOMから操作環境を解決し、その操作環境で未表示の場合だけReorder Guidanceを開始する。利用者が案内を閉じる、またはいずれかのReorder入口を選択した場合は該当操作環境を表示済みとして保存して案内を終了する。

##### Lifecycle

案内の表示基準を現在のEditor環境で解決できる時点で表示条件を評価する。並び替えモード中に新しい案内を開始しない。

##### Invariants

- PC / タッチの表示済み状態を分離する。
- WordPress Preferencesの永続状態をReorder Guidance本体へ持ち込まない。
- Editor DOMを解決できない場合は誤った操作環境を推測して案内を開始しない。

#### Input Interaction {#RESP_ROW_INPUT_INTERACTION}

##### Responsibility

PC / タッチの入力方式固有の行DnD開始条件を判断し、開始候補を第一段階Reorder Target Resolutionで事前解決したうえで、開始可能な候補だけをDnD Engineへ一時登録する。

##### State ownership

一回の開始入力を解釈するための局所的な入力状態だけを扱う。Reorder Mode、Editor DOM Context、DnD Session、第二段階解決結果、移動先、Table制約の正本を所有しない。

##### Contract

Row DnD Engine Integrationから有効化された入力境界として開始入力を受ける。対象Tableと`tbody`行の開始候補をReorder Target Resolutionへ渡し、`resolved`の場合だけDnD Engineへ登録する。Designで利用者へ示す`rejected`理由の場合はReorder Presentationへ通知する。通常の`unavailable`では通知しない。

##### Lifecycle

Row DnD境界が有効な期間だけ開始入力を受ける。一回の開始試行で第一段階解決と必要なDnD Engine登録を行い、DnD終了、モード無効化、接続境界終了では次の操作へ持ち越さない。

##### Invariants

- DnD Interactionを直接開始・終了しない。
- Reorder ModeやEditor DOM Contextを直接参照しない。
- 第一段階で開始可能と解決されていない候補をDnD Engineへ登録しない。
- 開始不可の構造判定をInput Interaction内で重複実装しない。

#### DnD Engine Integration {#RESP_ROW_DND_ENGINE_INTEGRATION}

##### Responsibility

DnD Engineの物理LifecycleをRow Reorderの意味責務へ接続する。第二段階Target Resolution、Destination Resolution、DnD Interactionへの橋渡しと、そのDnDにだけ必要な一時接続状態の破棄を所有する。

##### State ownership

active DnD成立前に第二段階で解決した開始情報、当該DnDのDestination Resolution境界、および一時的なDnD Engine接続参照だけを接続状態として保持できる。行DnD Sessionの正本、Table制約の永続cache、Presentation状態は所有しない。

##### Contract

物理DnD成立直前にDnD Engineが示す開始対象をReorder Target Resolutionで再解決する。第二段階が`resolved`でなければ物理DnDを成立させず、一時接続状態を破棄する。

物理DnD開始時は解決済みTargetと開始時制約をDnD Interactionへ渡してSessionを開始する。Destination Resolution境界は開始時Table配置から成立を試みるが、成立しなくてもSession開始を妨げない。moveではDestination Resolution境界が未成立なら再び成立を試み、解決済みの論理行間境界または`null`だけをDnD Interactionへ渡す。endではcancelかcompleteかをDnD Interactionへ通知する。

##### Lifecycle

TableのDnD接続境界として安定して存在し、Row Reorderが有効な期間だけInput Interactionを活動させる。一回のDnD開始前に第二段階解決結果を一時保持し、startでSessionへ引き渡す。Destination Resolution境界はstartまたは最初のmoveで成立できる。DnD終了、モード無効化、接続境界終了では次の操作へ持ち越せない一時状態を破棄する。

##### Invariants

- 第一段階の解決結果だけでactive DnDを開始しない。
- 第二段階解決結果をDnD Sessionと重複する長期状態として保持しない。
- Destination Resolution境界の成立をSession開始の前提にしない。
- DnD Engine固有イベントをDnD Interactionの公開状態として持ち込まない。
- 一回の物理DnDと一つのRow DnD Sessionを対応させる。
- Input InteractionとReorder PresentationのDnD Engine直接依存を不要に迂回させない。

#### Destination Resolution {#RESP_ROW_DESTINATION_RESOLUTION}

##### Responsibility

active DnD中の現在の物理入力位置を、DnD開始時のTable配置に対する論理行間境界へ変換する。

##### State ownership

一回のDnDで移動先解決に必要な対象Tableの表示参照と開始時の論理行境界計測だけを一時的に保持できる。Tableデータ、構造制約、DnD Session、Presentationによる表示変位は所有しない。

##### Contract

DnD開始時の移動対象から対象Tableと論理行境界の配置を確定する。moveごとにDnD Engineの現在物理位置を受け、スクロールによるTable自体の現在位置変化を反映しつつ、DnD開始時の論理行境界に対応する0-based行間境界または`null`を返す。対象Table外の位置から移動先を推測しない。

##### Lifecycle

active DnD開始時に生成を試み、成立した場合はDnD中のmoveで再利用し、DnD終了時に破棄する。開始時に成立できない場合は後続moveから再び生成を試みる。

##### Invariants

- Table構造上その境界へ移動できるかを判定しない。
- Presentationで動いた行の見かけ上の位置を論理境界の正本にしない。
- DnD Engineの物理イベントをDnD Interactionへそのまま渡さない。
- `progress`ごとにSupported Table Blockの行構造を取得しない。

#### Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility

指定されたSupported Table Blockとの差を吸収し、Row Reorderへ現在の行制約と、再照合済みの確定済み行移動を反映する境界を提供する。

##### State ownership

Table Identity、DnD Session、入力状態を所有しない。外部Tableデータや算出済み制約を監視用の永続状態として複製しない。

##### Contract

呼び出し側からTable Identityを受け、その要求時点の対応Tableから`tbody`行数と`rowspan`により分断できない0-based行間境界を判断できるRow Reorder用制約を返す。対応Tableを安全に解釈できない場合は正常な利用不能を返す。

DnD Interactionから再照合済みの移動元行と移動先境界を受け、要求時点のTableでも更新範囲が成立する場合だけ`tbody`の行順を一つの確定済み更新として反映する。セル内容・属性その他の保持対象は変更しない。更新要求時点で安全に反映できない場合は部分更新せず利用不能結果を返す。

##### Lifecycle

各要求時点のSupported Table Blockを直接参照して制約取得または更新を行う。独自のTable監視、retry、rollbackを開始しない。

##### Invariants

- Table Identityを発行または所有しない。
- 行並び替えに不要な列専用構造を公開しない。
- `tbody`の行順以外を並び替え結果として変更しない。
- 1回の成立した行移動を複数のUndo単位へ分割しない。
- Supported Table Block固有の保存表現を他のRow Reorder責務へ漏らさない。

#### Reorder Target Resolution {#RESP_ROW_TARGET_RESOLUTION}

##### Responsibility

active DnD成立前に、要求時点のTable制約に対してReorder Targetが`tbody`の一行として単独移動可能かを解決し、開始可能な場合は同じ解決結果として開始時制約を返す。行並び替えモード中の操作可否表示でも同じ判定Contractを提供する。

##### State ownership

開始試行を越える共有状態、DnD Session、入力状態、表示状態、Tableデータを所有しない。Presentationが同一表示判定中に利用する一回の制約snapshotは、DnD開始可否の権威となる共有状態にはしない。

##### Contract

Reorder Targetを受け取り、Table Integrationから指定Tableの要求時点の行制約を取得する。対象行が存在し、`rowspan`により単独移動できない範囲に含まれず、行単位の移動対象として成立する場合は`resolved`としてReorder Targetと開始時制約を返す。`rowspan`による開始不可はDesign上の`rejected`理由を返す。Tableまたは対象行を安全に解釈できない場合は`unavailable`を返す。

Presentationから操作可否表示用の解決を要求された場合も同じ制約判定を提供する。ただし表示用の解決結果は開始可否の権威ではなく、実際の開始時は第一段階と第二段階で現在制約から解決し直す。

##### Lifecycle

Input Interactionから第一段階、DnD Engine Integrationから第二段階をそれぞれ独立した要求として受ける。Presentation向けの表示判定は表示Lifecycle内だけで利用し、開始試行を越える共有状態へ昇格させない。

##### Invariants

- Reorder Targetへ開始時制約や拒否理由を埋め込まない。
- 第一段階と第二段階で同じ解決Contractを使う。
- `rowspan`により単独移動できない行を`resolved`にしない。
- Presentationへ構造制約判定を重複実装させない。
- 表示判定だけを根拠にactive DnDを成立させない。
- 判定のためにTableデータを変更しない。

#### DnD Interaction {#RESP_ROW_DND_INTERACTION}

##### Responsibility

第二段階で解決済みのReorder Targetから始まるRow DnD Sessionを所有し、論理行間境界の有効性、complete、cancel、外部Table変化による確定不能、およびSession終了後のReorder Mode解決を管理する。

##### State ownership

idleまたは一つのactive Sessionを所有する。active Sessionは対象Table Identity、移動元行、第二段階で得た開始時制約、現在の有効な論理移動先だけを保持する。DnD Engineの物理入力位置、物理イベント、表示参照、計測結果、自動スクロール状態を保持しない。

##### Contract

`start`では第二段階で`resolved`となったReorder Targetと開始時制約を受けてactive Sessionを開始する。Destination Resolution境界が成立済みであることは要求しない。

`progress`ではDestination Resolutionで解決済みの0-based論理行間境界または`null`を受け、Session開始時制約に対して構造を保て、かつ実際に行順が変化する境界だけを現在の有効移動先として保持する。現在のTable構造を取得し直さない。

`complete`では有効移動先がある場合でもTable Integrationから現在制約を取得し直し、移動元と移動先が現在も成立する場合だけ確定済み行移動を要求する。現在構造で成立しない、Table利用不能、更新不能の場合は新しい行順を確定せず安全終了し、Designで通知対象となる場合だけReorder Presentationへ一回性終了通知を発行する。

`cancel`または有効移動先のないdropはTableを更新せず正常終了する。Sessionを破棄した後、Table Integrationから対象Tableの現在利用可否を取得し直し、Reorder Modeへ「次の行並び替えを安全に受けられるか」だけを渡す。

##### Lifecycle

idleから`start`でactiveとなり、`progress`で有効移動先だけを更新する。`complete`または`cancel`ではSessionを破棄してidleへ戻す。Session終了後に現在Tableの継続可否を解決する。

##### Invariants

- active Sessionは同時に一つだけ存在する。
- Session開始時制約は同じ開始試行の第二段階Target Resolution結果である。
- 物理入力位置、表示参照、計測結果をSessionへ保持しない。
- Destination Resolution境界の成立状態をSessionへ保持しない。
- `progress`では現在Table構造を再取得しない。
- `complete`は現在構造への再照合なしに確定しない。
- cancel、有効移動先なし、現在構造での確定不能では新しい行順を確定しない。
- Reorder Mode状態そのものをSessionへ複製しない。

#### Reorder Presentation {#RESP_ROW_PRESENTATION}

##### Responsibility

Row Reorderの開始可否、active DnD意味状態、および必要なDnD Engine物理情報から、操作可能・移動不可状態、移動対象行、水平挿入位置、周囲行移動、開始拒否、終了通知を独立した表示として表現する。

##### State ownership

表示と一回性通知に必要な一時状態だけを所有する。Tableデータ、DnD Session、Target Resolution結果の正本、DnD Engine物理状態を所有しない。

##### Contract

Input InteractionからDesign上の開始拒否理由を一回性通知として受ける。行並び替えモード中の操作可能・移動不可表示ではReorder Target Resolutionを利用し、`rowspan`等の構造制約を重複判定しない。DnD Interactionのactive状態と現在有効移動先を購読し、DnD Engineの物理情報は表示に必要な時点だけ利用する。

操作可否表示の判定はDnD開始可否を確定しない。実際の開始試行ではInput InteractionとDnD Engine Integrationが現在制約による第一段階・第二段階解決を要求する。

##### Lifecycle

操作可否表示は行並び替えモード中の対象行に対して一時的に成立する。開始拒否通知はDesignで定義された期間だけ表示する。active DnD表示はDnD InteractionのSession開始と終了に追従する。cancelまたは成立しないdropでは異常終了通知を表示しない。安全に確定できない終了でDesignが通知を要求する場合だけ短い終了通知を表示する。

##### Invariants

- 表示状態をTableデータまたはDnD Sessionの正本にしない。
- 開始可否や構造上の移動可否をPresentation独自に再実装しない。
- 操作可否表示の解決結果をDnD開始可否の権威にしない。
- DnD中の表示のために実Tableの行順を変更しない。
- DnD Engine標準の移動表示とRow Reorder独自表示を重ねて利用しない。
- Column Reorderの表示状態を共有しない。

## 6. Runtime View

### Row DnD start attempt {#RV_ROW_DND_START}

第一段階で開始可能な行だけをDnD Engineへ登録し、active DnD成立直前に第二段階で再解決してからRow DnD Sessionを開始する。Destination Resolutionの成立はSession開始の前提にしない。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 対象Tableの既存編集面で開始入力が発生する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ROW_DND_ENGINE_INTEGRATION | 対象Tableの行並び替え有効状態と開始入力接続を方向固有DnD境界へ反映する。 |
| 3 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_INPUT_INTERACTION | 行開始入力を入力境界へ渡す。 |
| 4 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_TARGET_RESOLUTION | 開始候補を第一段階の現在制約で解決する。 |
| 5 | RESP_ROW_TARGET_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 指定Tableの現在行制約を要求する。 |
| 6 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 要求時点の対応Tableから行制約を取得する。 |
| 7 | RESP_ROW_TARGET_RESOLUTION | RESP_ROW_INPUT_INTERACTION | `resolved`、Design上の`rejected`、または`unavailable`を返す。 |
| 8 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_PRESENTATION | 第一段階がDesign上の`rejected`の場合だけ開始不可理由を通知する。 |
| 9 | RESP_ROW_INPUT_INTERACTION | EXT_DND_ENGINE | 第一段階が`resolved`の場合だけ開始候補を一時登録する。 |
| 10 | EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | active DnD成立直前の開始通知を渡す。 |
| 11 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_TARGET_RESOLUTION | 同じReorder Targetを第二段階の現在制約で再解決する。 |
| 12 | RESP_ROW_TARGET_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 第二段階の現在行制約を要求する。 |
| 13 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 要求時点の対応Tableから行制約を取得する。 |
| 14 | RESP_ROW_TARGET_RESOLUTION | RESP_ROW_DND_ENGINE_INTEGRATION | 第二段階の解決結果を返す。 |
| 15 | RESP_ROW_DND_ENGINE_INTEGRATION | EXT_DND_ENGINE | 第二段階が`resolved`でなければ物理DnD開始を成立させない。 |
| 16 | EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | 第二段階成立後の物理DnD startを通知する。 |
| 17 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | 解決済みReorder Targetと開始時制約でRow DnD Sessionを開始する。 |
| 18 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | active状態への遷移を表示購読へ反映する。 |

Destination Resolution境界はこのDnDの開始時配置から成立を試みてよいが、成立できない場合でもStep 17のSession開始を妨げない。必要なら`RV_ROW_DND_PROGRESS`の最初のmoveで成立を再試行する。

### Row DnD progress {#RV_ROW_DND_PROGRESS}

DnD Engineの物理位置をDestination Resolutionで論理行間境界へ変換してから、DnD InteractionがSession開始時制約へ照合する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | 現在の物理DnD移動を通知する。 |
| 2 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DESTINATION_RESOLUTION | 現在の物理入力位置から論理行間境界を要求する。未成立なら当該DnDの解決境界を再び成立させる。 |
| 3 | RESP_ROW_DESTINATION_RESOLUTION | RESP_ROW_DND_ENGINE_INTEGRATION | 0-based論理行間境界または`null`を返す。 |
| 4 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | 解決済み論理行間境界を現在Sessionへ渡す。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | 開始時制約に対して成立した現在の有効移動先を表示購読へ反映する。 |
| 6 | RESP_ROW_PRESENTATION | EXT_DND_ENGINE | 移動対象表示に必要な物理DnD情報を必要な時点だけ利用する。 |
| 7 | EXT_DND_ENGINE | EXT_SCROLL_AREA | 必要な場合だけ縦方向へ自動スクロールする。 |

### Row DnD complete {#RV_ROW_DND_COMPLETE}

物理DnD終了をDnD Engine IntegrationがDnD Interactionへ接続し、現在Tableへ再照合できた場合だけ`tbody`の行順を一回で更新する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | cancelされていない物理DnD endを通知する。 |
| 2 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | active Sessionのcompleteを要求する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在の行制約を要求する。 |
| 4 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 要求時点の対応Tableから現在行制約を取得する。 |
| 5 | RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | 現在行制約または利用不能結果を返す。 |
| 6 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在も移動元と移動先が成立し行順が変化する場合だけ確定済み行移動を要求する。 |
| 7 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | `tbody`の行順を一回の更新として反映する。 |
| 8 | RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した行移動を一回のUndo単位として成立させる。 |
| 9 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | Session終了を表示購読へ反映する。 |
| 10 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | Session破棄後、対象Tableが次の行並び替えを安全に受けられるか現在状態を取得し直す。 |
| 11 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 対象Tableの継続可否だけを現在モードへ反映する。 |

### Row DnD cancel or invalid drop {#RV_ROW_DND_CANCEL}

cancel、有効移動先がないdrop、または行順が変化しないdropではTableを更新せずSessionを終了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_ROW_DND_ENGINE_INTEGRATION | cancelまたは物理DnD endを通知する。 |
| 2 | RESP_ROW_DND_ENGINE_INTEGRATION | RESP_ROW_DND_INTERACTION | cancelまたはcompleteという物理終了種別をSessionへ渡す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中表示を終了し、異常終了通知を要求しない。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | Session破棄後、対象Tableが次の行並び替えを安全に受けられるか現在状態を取得し直す。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 対象Tableの継続可否だけを現在モードへ反映する。 |

### Row DnD current-state recovery {#RV_ROW_CURRENT_STATE_RECOVERY}

complete時に現在Tableを安全に再照合または更新できない場合は、新しい行順を確定せずSessionを終了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | complete時の現在行制約または確定済み行移動の反映を要求する。 |
| 2 | RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | 現在Table利用不能または更新不能を安全な確定不能結果として返す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | Sessionを終了し、Designで通知対象となる場合だけ一回性終了通知を発行する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | Session破棄後の対象Table利用可否を取得し直す。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_REORDER_MODE | 対象Tableで次の行並び替えを安全に受けられるかだけを現在モードへ反映する。 |

## 8. Crosscutting Concepts

### Integration boundaries

共通状態責務、WordPress Integration、DnD Engine Integration、Row Reorderの意味責務を分離する。WordPress固有UI、WordPress Preferences、DnD Engine固有イベント、物理座標はDnD Interactionの意味状態へ直接持ち込まない。

DnD Engine IntegrationはDnD Engine固有Lifecycleの接続責務であり、DnD Engineへの唯一の窓口ではない。Input Interactionは開始可能候補をDnD Engineへ直接登録し、Reorder Presentationは表示に必要な物理DnD情報をDnD Engineから直接利用できる。

### Table identity and current structure

Table IdentityはReorder Modeと行DnD Sessionが対象Tableを照合するために外側から渡される識別値であり、Table Integrationが発行または所有しない。Table Integrationは指定されたTable Identityに対する要求時点の制約と更新能力を提供する。

### Physical-to-logical destination separation

Destination Resolutionは物理入力位置を論理行間境界へ変換するだけとし、DnD Interactionはその論理境界をSession開始時制約へ照合する。この分離により、DnD Engineや物理配置情報をDnD Sessionへ持ち込まず、Presentationによる見かけ上の行移動を論理移動先へ混入させない。

Destination Resolution境界の成立はSession開始条件ではない。開始時に対象配置を確定できない場合は、Sessionを開始した後の最初のmoveで再び成立を試みる。

### Target resolution and presentation

Reorder Target Resolutionは第一段階・第二段階の開始可否判定だけでなく、行並び替えモード中の操作可能・移動不可表示でも同じ構造制約判定を提供する。Presentationは`rowspan`等の判定を重複実装しない。

表示判定は利用者向け事前表示のためのsnapshotであり、DnD開始可否を確定しない。実際の開始時は第一段階と第二段階で現在制約から解決し直す。

### Session snapshot and current-state revalidation

第二段階Target Resolutionで得た行制約をSession開始時制約とする。`progress`では開始時制約を使い、外部Table構造を毎回取得しない。`complete`では現在構造を取得し直し、現在状態だけを最終確定の基準とする。

### Atomic row update

1回の成立した行移動は`tbody`行順への1回の更新として扱う。途中状態を確定せず、WordPress Undo上も1回のUndo単位とする。

### Error and recovery boundary

開始前の通常利用不能、物理DnDのcancel、有効移動先なしは正常終了であり異常通知を要求しない。complete時の外部Table変化等で安全に確定できない場合は内部Errorへ変換せず安全終了し、Designで通知対象となる場合だけ通知する。内部Contractまたはruntime invariant違反はErrorとして扱い、正常結果へ変換しない。

### Compatibility

Core TableとFlexible Table Blockの保存表現差はTable Integrationが吸収する。Editorのiframe / non-iframe差はEditor DOM ContextとWordPress Integration境界で吸収し、Row Reorderの意味責務へEditor方式を持ち込まない。

### Performance

行並び替えモード開始時にTable全体の開始候補をDnD Engineへ固定登録しない。移動先候補をDnD Engineへ登録せず、Destination Resolutionが開始時の論理行配置から必要な境界だけを解決する。

`progress`ではTable Integrationから現在構造を取得し直さず、Destination Resolutionの論理境界とSession開始時制約で移動先を判断する。実Tableの行順はDnD中に変更せず、確定時だけ更新する。

## 9. Architecture Decisions

- Row ReorderとColumn Reorderの方向固有状態を共有しない。
- Reorder Mode本体とWordPress UI接続を分離し、Reorder Modeは排他状態とTable単位Lifecycleだけを所有する。
- Reorder Guidance本体は現在表示中状態だけを所有し、初回案内表示済み状態とWordPress依存はReorder Guidance Integrationへ分離する。
- Input InteractionはReorder Mode、Editor DOM Context、DnD Interactionへ直接依存しない。
- DnD Engine Integrationを独立責務とし、第二段階Target Resolutionと物理DnD LifecycleからDnD Interactionへの接続を所有する。
- DnD Engine IntegrationをDnD Engineへの唯一の窓口にはせず、Input InteractionとReorder Presentationの責務上必要な直接依存を維持する。
- Destination Resolutionを独立責務とし、物理位置から論理行間境界への変換をDnD Interactionから分離する。
- Destination Resolutionの成立はDnD InteractionのSession開始条件としない。
- Row専用のDrop Target Resolution責務は設けない。Destination Resolutionは物理位置の意味変換だけを担い、構造制約に対する移動先の有効性はDnD Interactionが所有する。
- 開始拒否通知は第一段階解決結果を受けたInput InteractionからReorder Presentationへ渡す。
- Reorder Presentationは操作可能・移動不可表示のためにReorder Target Resolutionを再利用し、構造制約を重複実装しない。
- 操作可否表示はDnD開始可否の権威とせず、開始時は第一段階・第二段階の現在制約解決を必須とする。
- Reorder Targetは移動する`tbody`行だけを表し、開始時制約や開始不可理由を含めない。
- Session中の移動先判定は第二段階で得た開始時制約を基準とし、`progress`ごとに現在構造を取得し直さない。
- `complete`だけは現在構造へ再照合してから確定する。
- Table IntegrationはTable Identityを提供せず、指定Tableに対する現在制約と確定済み更新能力を提供する。
- 成立した1回の行移動を1回の確定済み更新・1回のUndo単位として扱う。
- 自動スクロールはDnD Engineの機能とし、行DnDでは縦方向だけを有効にする。
- DnD Engine標準の移動表示は利用せず、Reorder Presentationが独自表示を所有する。

## 10. Quality Requirements

- DnD InteractionはDnD Engine固有の物理イベント、表示参照、計測結果をSession状態へ保持しない。
- 大規模Tableでも`progress`ごとにSupported Table Blockの現在構造を再取得せず、Destination Resolutionの論理境界とSession開始時制約で移動先を判断する。
- Destination Resolutionは開始時の論理行配置を利用し、Presentationによる行の表示変位を移動先判定へ混入させない。
- DnD中は実Tableの行順を変更せず、表示更新と確定更新を分離する。
- 1回の成立した行移動は1回の更新境界を通り、部分確定や複数Undo単位を作らない。
- WordPress固有UI、WordPress Preferences、Supported Table Block固有表現、DnD Engine固有物理状態を、それぞれを所有する統合境界の外へ漏らさない。
- 操作可否表示のためのTarget Resolution再利用により、行ごとに構造制約取得を無制限に重複させない。

## 11. Risks and Technical Debt

- Row / Columnで責務名が同じでも、それだけを理由に方向固有実装を共通化しないよう継続して確認する必要がある。
- Destination Resolutionの具体的な計測戦略は実装詳細であり、Architectureへ固定しない。一方、物理位置から論理境界への変換と構造制約判定の責務分離は維持する。
- DnD Engineの具体APIやイベント名をDnD InteractionのContractへ漏らすと外部ライブラリへ強く固定されるため、DnD Engine IntegrationとDestination Resolutionの境界を維持する必要がある。
- Reorder Target Resolutionの表示用途を外部Table監視や共有cacheへ拡張しない。表示判定は開始可否の権威ではなく、実際の開始時には現在制約で解決し直す。
- Table更新自体は対応Table Blockの再描画性能に影響される。Row ReorderはDnD中の追加コストを抑えるが、外部Block本体の確定時再描画コストまでは所有しない。

## 12. Glossary

- **Reorder Mode**: 通常編集、行並び替え、列並び替えの排他状態と対象Table単位Lifecycleを所有する共通状態責務。
- **WordPress Reorder Integration**: Reorder Modeと方向固有DnD境界をWordPress Editorのツールバー、現在Table、通常編集抑止へ接続する責務。
- **Reorder Guidance**: 現在表示中の共通入口案内のTable Identityと操作環境だけを所有する共通状態責務。
- **Reorder Guidance Integration**: 初回案内をEditor環境、WordPress Preferences、Reorder Mode、Reorder Guidanceへ接続する責務。
- **DnD Engine Integration**: DnD Engine固有の物理LifecycleをRow ReorderのTarget Resolution、Destination Resolution、DnD Interactionへ接続する責務。DnD Engineへの唯一の窓口ではない。
- **Destination Resolution**: active DnDの物理入力位置をDnD開始時配置に対する論理行間境界へ変換する責務。構造制約上の移動可否は判定せず、その成立はSession開始の前提ではない。
- **Reorder Target**: 一つのDnD開始試行で移動対象となる`tbody`の行。開始時制約や開始不可理由は含まない。
- **Start Constraints**: Reorder Target Resolutionの第二段階で現在Tableから解決され、active DnD Session中の移動先判定基準として保持される行制約。
- **Insertion Boundary**: DnD開始時のTable配置に対して行を挿入する0-based行間位置。構造上有効かはDnD Interactionが開始時制約へ照合する。
- **Row DnD Session**: active DnD成立後からcompleteまたはcancelまで、DnD Interactionが所有する一回の行DnD意味状態。物理入力位置、表示参照、計測結果、Destination Resolution境界は保持しない。
- **正常な利用不能**: 外部環境変化や利用者操作上、正当に発生し得る「現在利用できない」「対象が成立しない」「現在は確定できない」という結果。
- **runtime invariant**: 型だけでは保証できず、かつRow Reorder自身が所有する値レベルの成立条件。