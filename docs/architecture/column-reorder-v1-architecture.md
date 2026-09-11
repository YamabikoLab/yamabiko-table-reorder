# Column Reorder v1 Architecture

## 1. Introduction and Goals

本書は、正式v1の列並び替えを実現するための内部責務、境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

入力は`docs/design/reorder-v1-design.md`および`docs/design/column-reorder-v1-design.md`とし、利用者向け設計を列専用の責務モデルへ落とし込む。

本書はColumn Reorderだけを対象とする。Row Reorderの方向固有状態や列固有仕様を共有しない。一方、正式v1 Row Reorderで実装を通じて成立している責務境界、特にWordPress接続、DnD Engine接続、物理位置から論理移動先への変換、DnD Session状態の分離は、Column Reorderの責務分割を定める参照モデルとする。列固有要件が異なる場合だけColumn側で責務の意味を変更する。

Architecture上の責務はソースファイル構成を写したものではない。実装単位が変わっても維持すべき責務、依存方向、状態所有を定義する。

## 2. Architecture Constraints

- Row ReorderとColumn Reorderは独立した実装とし、両者の間に方向固有状態または共通の並び替え抽象化を導入しない。
- RequirementsおよびDesignに反しない範囲では、正式v1 Row Reorderで成立している責務境界と依存方向をColumn Reorderの参照モデルとする。
- Reorder ModeはWordPress UIを所有せず、`edit | row | column`の排他状態と対象Table Identity、およびTable単位のLifecycleだけを所有する。
- WordPress Reorder IntegrationはTableツールバー入口、通常編集抑止、現在TableとReorder Modeの接続、およびColumn DnD Engine Integrationの有効化を所有する。
- Reorder Apply PolicyはRow / Column共通の反映経路選択だけを所有し、Table構造や方向固有の移動意味、反映Lifecycleを所有しない。
- WordPress Reorder Apply Integrationは確認付き大規模反映のEditor表示接続とediting surface restorationを所有し、通常のReorder Mode / DnD接続を所有しない。
- Column Reorder Applyは確認付き大規模反映の方向固有Lifecycleと確定済み列移動意図だけを所有し、DnD Sessionとは独立して状態を管理する。
- Reorder Guidanceは現在表示中の共通案内状態だけを所有する。PC / タッチごとの初回案内表示済み状態、操作環境判定、WordPress preferencesへの永続化はReorder Guidance Integrationが所有する。
- Editor DOM Contextは現在のeditor contextを要求時点で解決し、以前のcontextへfallbackしない。
- Input Interactionは列DnDの開始入力と第一段階Reorder Target Resolutionだけを扱い、Reorder Mode、Editor DOM Context、DnD Interactionの状態やLifecycleを直接参照しない。
- Column DnD Engine IntegrationはDnD Engine固有のLifecycleをColumn Reorderへ接続し、第二段階Reorder Target Resolution、Destination Resolution、DnD Interactionへの橋渡し、および対象Tableの水平自動スクロールを所有する。
- Destination ResolutionはDnD Engineの物理入力位置と対象TableのDnD開始時配置を論理的な列間境界へ変換する。Table構造上その境界へ移動できるかの判定は所有しない。
- Reorder Target Resolutionはactive DnD成立前に、Input Interactionによる第一段階とColumn DnD Engine Integrationによる第二段階の二回、要求時点のTable制約からReorder Targetの成立可否を解決する。
- Reorder Target自体は移動する論理列だけを表し、開始時制約や開始不可理由を含めない。
- 第二段階で開始可能と解決した列制約をDnD InteractionのSession開始時制約として引き継ぐ。
- DnD InteractionはDnD Engine固有の物理入力位置を保持せず、Destination Resolutionで解決済みの論理列間境界だけを受け取る。
- `progress`ではSession開始時制約を基準に論理列間境界の有効性を判定し、Table Integrationから現在構造を取得し直さない。
- `complete`では現在のTable構造を取得し直し、Reorder Targetと最終移動先が現在も成立する場合だけTable Integrationへ確定済み列移動を要求する。
- 列DnD中はTableデータを並べ替えない。
- Table Integrationは指定されたTable Identityに対して現在列制約と確定済み列移動の反映能力を提供する。Table Identity自体の所有または発行は行わない。
- Table Integrationは1回の成立した列移動を`thead`、`tbody`、`tfoot`を含むTable全体への1回の更新として反映し、WordPress Undo上も1回のUndo単位とする。
- DnD Engineが提供する標準の移動表示は利用せず、列DnD中の利用者向け表示はReorder Presentationが独立して所有する。
- Reorder PresentationはEditor表示方式に応じて周囲列移動を提供するかを決定し、non-iframe EditorではPerformance fallbackとして周囲列移動を省略する。移動対象、垂直挿入位置、DnD Interactionの意味状態、確定処理は維持する。
- 列DnDの自動スクロールはDnD Engine標準機能へ委ねず、Column DnD Engine Integrationが対象Tableの横スクロール領域と現在の物理入力位置を一回のDnDへ接続して横方向だけを進行する。
- 対応Table Block固有の保存表現はTable Integration、WordPress固有のUIと永続化はWordPress Integration境界、DnD Engine固有のLifecycleとイベントはColumn DnD Engine IntegrationまたはDestination Resolutionで吸収する。
- 正常な利用不能、cancel、外部環境変化による継続不能、内部Contractまたはruntime invariant違反を区別する。
- 内部Errorは原則として握りつぶさず正常結果へ変換しない。内部Errorそのものを利用者向け通知理由としない。
- 外部環境変化による継続不能は内部Errorとして扱わず、安全な終了結果として扱う。
- Performanceの責任境界は、対応Table Block本体の属性更新・再描画性能ではなく、Column Reorder自身が追加する並び替え処理のコストとする。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | 対応Tableのツールバー、既存Block wrapper、入力、および列DnD表示が存在する編集環境を提供する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | Core TableまたはFlexible Table Blockとして、Table Integrationが列制約取得と列順更新を行う対象を提供する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の列並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_WORDPRESS_PREFERENCES | WordPress Preferences | External Capability | PC / タッチごとの初回案内表示済み状態を永続化する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | 列DnD中にColumn DnD Engine Integrationが横方向へ自動スクロールする対象領域を提供する。 |
| EXT_DND_ENGINE | DnD Engine | External Library | 物理DnDの開始候補登録、開始・移動・終了Lifecycle、および物理入力情報を提供する。 |

WordPress固有のUI接続と永続化はColumn Reorderの意味責務から分離する。DnD Engine固有のイベントはColumn DnD Engine IntegrationとDestination Resolutionで吸収し、DnD Interactionへは列DnDの意味状態だけを渡す。

## 4. Solution Strategy

Column Reorderは、共通状態、WordPress接続、入力、開始対象解決、DnD Engine接続、物理位置から論理境界への変換、DnD Session、Table Block差、表示を別責務として扱う。

Reorder Modeは排他状態とTable単位Lifecycleだけを所有し、WordPress Reorder IntegrationがTableツールバー入口と既存Block wrapperをReorder Modeへ接続する。Reorder Guidanceは現在表示中の案内状態だけを所有し、Reorder Guidance IntegrationがEditor環境、WordPress preferences、Reorder Modeとの接続を所有する。

Input InteractionはWordPress Reorder IntegrationからColumn DnD Engine Integrationを通じて有効化され、入力方式固有の開始条件を判断する。開始候補はReorder Target Resolutionで第一段階解決し、開始可能な場合だけDnD Engineへ一時的に登録する。Designで通知対象となる開始拒否理由はInput InteractionからReorder Presentationへ渡す。

Column DnD Engine IntegrationはDnD Engineのactive DnD成立直前にReorder Target Resolutionの第二段階を要求する。第二段階が成立した場合だけ解決済みReorder Targetと開始時制約をDnD Interactionへ渡し、DnD開始時にDestination ResolutionをそのDnDの論理配置へ接続する。同じDnDの対象Tableに対する横スクロール領域を固定し、DnD Engineが変換した位置ではなく対象Editor環境と同じ座標系の現在物理入力位置から水平自動スクロールを判断する。実際にスクロールした場合は、ポインターが停止していても最新の物理入力位置からDestination Resolutionを再要求して現在の論理移動先へ追従させる。

Destination ResolutionはDnD Engineの物理入力位置をDnD開始時のTable配置に対する論理列間境界へ変換する。スクロールによる対象Table全体の現在位置変化には追従してよいが、Presentationによる列の見かけ上の移動を論理移動先判定へ混入させない。結合セル制約による移動可否は判断しない。

DnD InteractionはDestination Resolutionで解決済みの論理列間境界をSession開始時制約へ照合し、有効な移動先だけを意味状態として保持する。`complete`では現在構造へ再照合し、成立する場合はTable Integrationから更新対象セル数を取得してReorder Apply Policyへ反映経路の選択を要求する。通常反映ではTable Integrationへ確定済み列移動を要求し、確認付き大規模反映ではDnD Sessionを終了してからColumn Reorder Applyへ確定済み移動意図を引き渡す。

Column Reorder Applyは`confirming`以降の方向固有Lifecycleを所有する。確認中はTableを変更せず、Continue後の反映開始時に現在構造をTable Integrationへ再照合し、現在も成立する場合だけ確定済み列移動を要求する。Cancelまたは再照合不成立ではTableを変更しない。

WordPress Reorder Apply IntegrationはRow / ColumnのReorder Apply状態をWordPress Editor表示へ接続する。重いTable更新より先に対象Tableの通常編集表示を一時的に退避して反映中表示を成立させ、更新後の編集表示が再成立した後に方向固有Reorder Apply Lifecycleを完了する。

Reorder Presentationは現在のEditor DOM Contextから表示環境を確認し、iframe Editorでは周囲列移動を提供する。non-iframe Editorでは大規模TableでのDnD中の追加Layoutコストを避けるため周囲列移動を省略し、移動対象と垂直挿入位置を維持する。このfallbackはPresentationだけに閉じ、Destination Resolution、DnD Interaction、drop/applyの意味を変更しない。

### Process Flow Views

#### Column Reorder End-to-End {#PV_COLUMN_REORDER_END_TO_END kind=normal}

WordPress Editorの入力が共通統合境界からColumn DnD境界へ入り、第一段階Target Resolution、DnD Engineへの一時登録、第二段階Target Resolution、物理位置から論理境界への変換、DnD Session、Table全体の確定更新へ進む主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | normal | 対応Tableの選択、ツールバー操作、既存Block wrapper上の入力がWordPress接続境界へ入る。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_COLUMN_DND_ENGINE_INTEGRATION | normal | 対象TableのColumn Reorder有効状態をDnD Engine接続境界へ反映する。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_INPUT_INTERACTION | normal | 有効なColumn DnD境界から開始入力処理へ進む。 |
| RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_TARGET_RESOLUTION | normal | 開始候補を第一段階の現在制約で事前解決する。 |
| RESP_COLUMN_INPUT_INTERACTION | EXT_DND_ENGINE | normal | 第一段階で開始可能な候補だけを物理DnD開始候補として一時登録する。 |
| EXT_DND_ENGINE | RESP_COLUMN_DND_ENGINE_INTEGRATION | normal | active DnD成立前後の物理LifecycleをColumn Reorder接続境界へ通知する。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_TARGET_RESOLUTION | normal | active DnD成立直前に同じReorder Targetを第二段階の現在制約で再解決する。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DESTINATION_RESOLUTION | normal | active DnDの物理移動を論理列間境界の解決へ進める。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | normal | 解決済み開始情報、論理列間境界、終了種別を列DnD Sessionへ渡す。 |
| RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | normal | complete時に現在構造の再照合と確定済み列移動の反映へ進む。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | normal | 現在列制約を取得し、確定時はTable全体の列順を反映する。 |

#### Large Column Reorder Apply {#PV_COLUMN_LARGE_REORDER_APPLY kind=normal}

DnD complete後に更新対象セル数から確認付き大規模反映へ分岐し、DnD Session終了後の方向固有Apply Lifecycle、WordPress表示接続、現在Table再照合、確定更新へ進む主要な処理方向を示す。Process Flowの行順はRuntime順序を定義しない。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_COLUMN_DND_INTERACTION | RESP_REORDER_APPLY_POLICY | normal | Table Integrationが算出した更新対象セル数から反映経路の選択へ進む。 |
| RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_REORDER_APPLY | normal | 確認付き大規模反映ではDnD Session終了後に確定済み移動意図を方向固有Apply Lifecycleへ引き渡す。 |
| RESP_COLUMN_REORDER_APPLY | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | normal | 方向固有Apply状態をWordPress Editorの確認・反映中・表示復帰へ接続する。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | normal | 確認UI、反映中表示、更新後の編集表示をWordPress Editor上に成立させる。 |
| RESP_COLUMN_REORDER_APPLY | RESP_COLUMN_TABLE_INTEGRATION | normal | Continue後に現在構造を再照合し、成立する場合だけ確定済み列移動を要求する。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | normal | 現在構造を取得し、成立した確定移動だけを対応Tableへ反映する。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | normal | 成立した1回の列移動を1回のUndo単位として成立させる。 |

#### External Environment Change and Recovery {#PV_COLUMN_EXTERNAL_CHANGE_RECOVERY kind=failure-recovery}

active DnDの物理Lifecycleがcancelとなる場合、またはcomplete時の現在Tableが安全に利用できない場合に、新しい列順を確定せずSessionを終了する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_DND_ENGINE | RESP_COLUMN_DND_ENGINE_INTEGRATION | failure | 物理DnDがcancelまたは継続不能として終了する。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | recovery | 物理DnDの終了種別を列DnD Sessionのcancelへ接続する。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | failure | complete時の現在Table利用不能または更新不能を安全な確定不能結果として返す。 |
| RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | recovery | DnD中表示を終了し、Designで通知対象となる確定不能だけを一回性通知へ反映する。 |
| RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | recovery | Session終了後に対象Tableで列並び替えを継続できるかだけを共通モード状態へ反映する。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | `edit | row | column`の排他状態、対象Table Identity、およびTable単位のモードLifecycleを所有する共通状態責務。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | 現在どのTableへどの操作環境の共通入口案内を表示しているかという一時状態だけを所有する共通状態責務。 |
| RESP_REORDER_APPLY_POLICY | Reorder Apply Policy | Table Integrationが算出した更新対象セル数だけから通常反映か確認付き大規模反映かを選択する共通方針責務。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のEditor DOM基準から、その表示環境に属するDOM / Web API contextを要求時点で解決する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | WordPress Reorder Integration | Tableツールバー入口、通常編集抑止、現在TableとReorder Mode、および方向固有DnD境界をWordPress Editorへ接続する。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | WordPress Reorder Apply Integration | 方向固有Reorder Apply状態をWordPress Editorの確認、反映中表示、editing surface restorationへ接続する。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | Reorder Guidance Integration | 初回案内の表示契機、操作環境判定、WordPress preferences永続化、Reorder Mode選択による案内終了を接続する。 |
| RESP_COLUMN_INPUT_INTERACTION | Input Interaction | PC / タッチの開始条件を解釈し、開始候補を第一段階Target Resolutionで事前解決して、開始可能な候補だけをDnD Engineへ登録する。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | DnD Engine Integration | DnD Engineの物理Lifecycleを第二段階Target Resolution、Destination Resolution、DnD Interactionへ接続し、そのDnDだけの接続一時状態と対象Tableの水平自動スクロールを所有する。 |
| RESP_COLUMN_DESTINATION_RESOLUTION | Destination Resolution | DnD Engineの物理入力位置をDnD開始時のTable配置に対する論理列間境界へ変換する。 |
| RESP_COLUMN_TABLE_INTEGRATION | Table Integration | 指定された対応Tableの現在列制約取得、Table全体の確定済み列移動、およびWordPress Undo境界を提供する。 |
| RESP_COLUMN_TARGET_RESOLUTION | Reorder Target Resolution | active DnD成立前に現在列制約から論理列の開始可否を二段階で解決し、開始可能時は開始時制約を返す。 |
| RESP_COLUMN_DND_INTERACTION | DnD Interaction | 解決済みReorder Targetから始まる列DnD Session、論理移動先の有効性、確定、cancel、終了後モード解決を所有する。 |
| RESP_COLUMN_REORDER_APPLY | Reorder Apply | DnD Session終了後の確認付き大規模反映について、確定済み列移動意図、確認、反映開始、現在構造再照合、表示復帰完了までの方向固有Lifecycleを所有する。 |
| RESP_COLUMN_PRESENTATION | Reorder Presentation | 開始不可、移動対象、垂直挿入位置、Editor表示方式に応じた周囲列移動、終了通知をColumn Reorderの独立表示として表現する。 |

### Ownership Boundaries

| ID | Name | Includes |
| --- | --- | --- |
| BOUNDARY_REORDER_COMMON | Reorder Common | RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_REORDER_APPLY_POLICY |
| BOUNDARY_EDITOR_INTEGRATION | Editor Integration | RESP_EDITOR_DOM_CONTEXT |
| BOUNDARY_WORDPRESS_REORDER | WordPress Reorder Integration | RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION |
| BOUNDARY_COLUMN_REORDER | Column Reorder | RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_DESTINATION_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION RESP_COLUMN_REORDER_APPLY |
| BOUNDARY_WORDPRESS_EXTERNAL | WordPress External | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES EXT_SCROLL_AREA |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のEditor DOM基準と同じ表示環境のcontextを解決するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | Tableツールバー、現在Tableの編集面、WordPress側Lifecycleへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | ツールバー選択、通常編集抑止、対象Table単位の現在モードを接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_COLUMN_DND_ENGINE_INTEGRATION | 対象Tableの列並び替え有効状態を方向固有DnD境界へ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 確認UI、反映中表示、更新後の編集表示をWordPress Editorへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_COLUMN_REORDER_APPLY | 方向固有の確認付き大規模反映状態をEditor表示へ接続し、Continue / Cancel / 表示復帰完了をLifecycleへ返すために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_EDITOR | 初回案内の表示契機とWordPress Editor上の表示位置を接続するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_PREFERENCES | PC / タッチごとの初回案内表示済み状態を永続化するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_EDITOR_DOM_CONTEXT | 現在のEditor DOMに対する操作環境を解決するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_GUIDANCE | 現在の共通入口案内状態を開始・終了するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_MODE | いずれかの並び替え入口選択を案内終了条件として扱うために必要とする。 |
| RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_TARGET_RESOLUTION | 入力開始候補を第一段階の現在制約で解決するために必要とする。 |
| RESP_COLUMN_INPUT_INTERACTION | EXT_DND_ENGINE | 開始可能な候補だけを物理DnD開始候補として一時登録するために必要とする。 |
| RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_PRESENTATION | 第一段階でDesign上の開始拒否理由が返った場合に一回性の利用者向け通知へ接続するために必要とする。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_INPUT_INTERACTION | DnD Engine境界の配下で列開始入力を有効化し、開始候補登録を接続するために必要とする。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | EXT_DND_ENGINE | 物理DnDの開始前、開始、移動、終了Lifecycleを受け取るために必要とする。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | EXT_SCROLL_AREA | active Column DnD中に対象Tableを横方向だけ自動スクロールするために必要とする。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_TARGET_RESOLUTION | active DnD成立直前の第二段階開始可否を解決するために必要とする。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DESTINATION_RESOLUTION | 物理DnD移動と水平自動スクロール後の現在位置を論理列間境界へ変換するために必要とする。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | 解決済み開始情報、論理移動先、終了種別を列DnD Sessionへ接続するために必要とする。 |
| RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_PRESENTATION | 同じDnD Engine境界で独立したColumn Reorder表示を活動させるために必要とする。 |
| RESP_COLUMN_DESTINATION_RESOLUTION | EXT_DND_ENGINE | 現在の物理入力位置を論理列間境界へ変換するためにDnD Engineの移動情報を必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有の列構造取得と列順更新を行うために必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した1回の列移動を1回のUndo単位として維持するために必要とする。 |
| RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 要求時点の現在列制約から論理列の開始可否と開始時制約を解決するために必要とする。 |
| RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | complete時の現在構造再照合、確定済み列移動、終了後の対象Table継続可否確認に必要とする。 |
| RESP_COLUMN_DND_INTERACTION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から通常反映か確認付き大規模反映かを選択するために必要とする。 |
| RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_REORDER_APPLY | 確認付き大規模反映ではDnD Session終了後に確定済み移動意図を方向固有Apply Lifecycleへ引き渡すために必要とする。 |
| RESP_COLUMN_REORDER_APPLY | RESP_COLUMN_TABLE_INTEGRATION | Continue後の現在構造再照合、更新対象の成立確認、確定済み列移動の反映に必要とする。 |
| RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | Session終了後に対象Tableで列並び替えを安全に継続できるかだけを現在モードへ反映するために必要とする。 |
| RESP_COLUMN_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 現在のEditor DOM contextで一時表示を配置し、Editor表示方式に応じた周囲列移動方針を選択するために必要とする。 |
| RESP_COLUMN_PRESENTATION | EXT_DND_ENGINE | 移動対象表示等に必要な物理DnD情報をSessionへ複製せず利用するために必要とする。 |
| RESP_COLUMN_PRESENTATION | RESP_COLUMN_TARGET_RESOLUTION | 操作可能列の事前表示等で開始可否の意味を重複判定せず利用するために必要とする。 |
| RESP_COLUMN_PRESENTATION | RESP_COLUMN_DND_INTERACTION | active状態と現在の有効移動先を購読し、終了通知を受け取るために必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_COLUMN_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES EXT_SCROLL_AREA EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_DESTINATION_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_COLUMN_REORDER_APPLY |
| DV_COLUMN_EDITOR_INTEGRATION | Editor Integration | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_COLUMN_REORDER_APPLY |
| DV_COLUMN_DND_CORE | DnD Core | EXT_DND_ENGINE EXT_SCROLL_AREA RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_DESTINATION_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_REORDER_APPLY_POLICY RESP_COLUMN_REORDER_APPLY |
| DV_COLUMN_FEEDBACK | DnD Feedback | EXT_DND_ENGINE RESP_EDITOR_DOM_CONTEXT RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION |
| DV_COLUMN_DATA_UPDATE | Table Update | EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_DND_INTERACTION RESP_REORDER_APPLY_POLICY RESP_COLUMN_REORDER_APPLY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION |

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

#### Reorder Apply Policy {#RESP_REORDER_APPLY_POLICY}

##### Responsibility

Row / Columnに共通する反映経路選択として、Table Integrationが算出した今回の更新対象セル数だけから通常反映または確認付き大規模反映のどちらを利用するかを判断する。

##### State ownership

状態を所有しない。Table構造、移動元・移動先、方向固有Apply Lifecycle、WordPress表示状態を保持しない。

##### Contract

呼び出し側から更新対象セル数を受け、共通の性能上のPolicyに従って通常反映または確認付き大規模反映を返す。Table構造や列移動の意味を解釈しない。

##### Lifecycle

DnD completeで現在構造の再照合と更新対象セル数の算出が成立した後に、その1回の確定候補について同期的に経路を選択する。選択結果を次の操作へ持ち越さない。

##### Invariants

- Row / Column固有の移動意味を所有しない。
- 方向固有Reorder Apply状態を所有しない。
- Table Integrationが算出していない値から更新範囲を推測しない。
- 閾値を利用者向け固定要件として扱わない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のEditor DOMに属する基準要素から、その表示環境でDOM / Web APIを利用するためのcontextを解決する。

##### State ownership

解決結果をeditor lifecycleをまたぐcacheとして所有しない。Reorder Mode、Guidance、DnD Session、Tableデータを所有しない。

##### Contract

基準要素の現在の`ownerDocument`と対応する`window`を安全に提供できる場合だけcontextを返す。解決できない場合は以前のcontextまたは別Editor contextへfallbackしない。利用側は必要なPresentation方針を現在contextから要求時点で判断できるが、その表示方式をEditor DOM Context自身の別状態として保持しない。

##### Lifecycle

DOM / Web APIを必要とする時点で現在の基準要素から解決する。

##### Invariants

- iframe / non-iframeを独自の永続状態として保持しない。
- 現在の基準とは異なるcontextをfallbackとして提供しない。
- context利用不能をColumn Reorder内部Errorへ変換しない。

#### WordPress Reorder Integration {#RESP_WORDPRESS_REORDER_INTEGRATION}

##### Responsibility

Reorder Modeと方向固有DnD境界をWordPress EditorのTableツールバー、現在Tableの編集面、通常編集開始へ接続する。

##### State ownership

WordPress統合Lifecycleに必要な一時参照だけを扱い、Reorder Mode状態、列DnD Session、Table制約を重複所有しない。

##### Contract

対応Tableのツールバー入口をReorder Modeの状態変更へ接続する。現在Tableに対するモードを購読し、`column`の場合だけColumn DnD Engine Integrationを有効化する。`row | column`では通常編集開始を抑止し、`edit`ではWordPress本来の編集入力へ戻す。

##### Lifecycle

対応TableのWordPress統合境界が存在する間、現在モードを反映する。componentの再mountだけをモード終了条件にしない。

##### Invariants

- Reorder Mode状態をWordPress component内へ別正本として複製しない。
- 行・列の排他をWordPress UI側だけで独自管理しない。
- WordPress Editorの表示構造を方向固有状態の正本にしない。

#### WordPress Reorder Apply Integration {#RESP_WORDPRESS_REORDER_APPLY_INTEGRATION}

##### Responsibility

Row / Columnの方向固有Reorder Apply状態をWordPress Editorの確認UI、反映中表示、および更新後のediting surface restorationへ接続する。

##### State ownership

WordPress表示接続に必要な一時状態だけを扱い、方向固有Reorder Apply状態、確定済み移動意図、Table制約、Reorder Modeを別正本として所有しない。

##### Contract

`confirming`では対象Tableの通常編集表示を維持したまま確認UIを提示し、Continue / Cancelを方向固有Reorder Applyへ返す。`applying`では重いTable更新より先に対象Tableの通常編集表示を一時的に退避して反映中表示を成立させる。方向固有Reorder Applyの更新処理が終わった後は更新後のTable編集表示を再成立させ、表示復帰完了を方向固有Lifecycleへ返す。

##### Lifecycle

方向固有Reorder Applyがidle以外の期間だけApply表示接続を成立させる。確認、反映中表示、更新後の編集表示再成立を経て、表示復帰完了後に方向固有Reorder Applyをidleへ完了させる。

##### Invariants

- Row / Column固有の移動意味やTable制約判定を所有しない。
- 通常のReorder Mode / DnD接続を既存WordPress Reorder Integrationから奪わない。
- 確認UIや表示復帰だけでTableデータ更新またはUndo履歴を追加しない。
- React固有のmount / unmount方式をArchitecture契約にしない。

#### Reorder Guidance Integration {#RESP_REORDER_GUIDANCE_INTEGRATION}

##### Responsibility

初回共通案内をWordPress Editor、Editor DOM Context、WordPress preferences、Reorder Modeへ接続する。

##### State ownership

PC / タッチごとの表示済み状態はWordPress Preferencesへ永続化し、自身は永続状態の別copyを所有しない。現在表示中状態はReorder Guidanceに委ねる。

##### Contract

現在のEditor DOMから操作環境を解決し、その操作環境で未表示の場合だけReorder Guidanceを開始する。利用者が案内を閉じる、またはいずれかのReorder入口を選択した場合は該当操作環境を表示済みとして保存して案内を終了する。

##### Lifecycle

案内の表示基準を現在のEditor環境で解決できる時点で表示条件を評価する。並び替えモード中に新しい案内を開始しない。

##### Invariants

- PC / タッチの表示済み状態を分離する。
- WordPress preferencesの永続状態をReorder Guidance本体へ持ち込まない。
- Editor DOMを解決できない場合は誤った操作環境を推測して案内を開始しない。

#### Input Interaction {#RESP_COLUMN_INPUT_INTERACTION}

##### Responsibility

PC / タッチの入力方式固有の列DnD開始条件を判断し、開始候補を第一段階Reorder Target Resolutionで事前解決したうえで、開始可能な候補だけをDnD Engineへ一時登録する。

##### State ownership

一回の開始入力を解釈するための局所的な入力状態だけを扱う。Reorder Mode、Editor DOM Context、DnD Session、第二段階解決結果、移動先、Table制約の正本を所有しない。

##### Contract

Column DnD Engine Integrationから有効化された入力境界として開始入力を受ける。対象Tableと論理列の開始候補をReorder Target Resolutionへ渡し、`resolved`の場合だけDnD Engineへ登録する。Designで利用者へ示す`rejected`理由の場合は、その操作位置と理由をReorder Presentationの一回性通知へ渡す。通常の`unavailable`では通知しない。

##### Lifecycle

列DnD境界が有効な期間だけ開始入力を受ける。一回の開始試行で第一段階解決と必要なDnD Engine登録を行い、登録の長期LifecycleはColumn DnD Engine Integrationの終了処理に従う。

##### Invariants

- DnD Interactionを直接開始・終了しない。
- Reorder ModeやEditor DOM Contextを直接参照しない。
- 第一段階で開始可能と解決されていない候補をDnD Engineへ登録しない。
- 開始不可の構造判定をInput Interaction内で重複実装しない。

#### DnD Engine Integration {#RESP_COLUMN_DND_ENGINE_INTEGRATION}

##### Responsibility

DnD Engineの物理LifecycleをColumn Reorderの意味責務へ接続する。第二段階Target Resolution、Destination Resolution、DnD Interactionへの橋渡しと、active DnD中の対象Tableに対する水平自動スクロール、およびそのDnDにだけ必要な一時接続状態の破棄を所有する。

##### State ownership

active DnD成立前に第二段階で解決した開始情報、当該DnDのDestination Resolution境界、および一時的なDnD Engine接続参照を保持できる。active DnD中は対象Tableの横スクロール領域、現在の物理入力位置、水平自動スクロールの継続状態を一時接続状態として保持できる。列DnD Sessionの正本、Table制約の永続cache、Presentation状態は所有しない。

##### Contract

物理DnD成立直前にDnD Engineが示す開始対象をReorder Target Resolutionで再解決する。第二段階が`resolved`でなければ物理DnDを成立させず、一時接続状態を破棄する。

物理DnD開始時は解決済みTargetと開始時制約をDnD Interactionへ渡し、Destination Resolutionを開始時Table配置へ接続する。同じ開始対象から、当該DnDで利用する横スクロール領域を一つ確定する。

moveではDestination Resolutionが返した論理列間境界だけをDnD Interactionへ渡す。同時に、対象Editor環境と同じ座標系の現在物理入力位置が横スクロール領域の左右端にある場合だけ水平自動スクロールを進行する。縦方向の自動スクロールは開始しない。ポインターが端に留まる場合は水平スクロールを継続し、スクロール限界または端領域外では不要な継続を停止する。

水平自動スクロールによって対象Tableの画面位置が変化した場合は、最新の物理入力位置からDestination Resolutionを再要求し、再解決された論理列間境界をDnD Interactionへ渡す。DnD Engine標準のAuto ScrollはColumn Reorderでは利用しない。

endではcancelかcompleteかをDnD Interactionへ通知する。

##### Lifecycle

TableのDnD接続境界として安定して存在し、Column Reorderが有効な期間だけInput Interactionを活動させる。一回のDnD開始前に第二段階解決結果を一時保持し、startでSessionへ引き渡すと同時に横スクロール対象を確定する。active DnD中は現在物理入力位置を更新し、必要な期間だけ水平自動スクロールを進行する。DnD終了、モード無効化、接続境界終了では水平自動スクロールを停止し、次の操作へ持ち越せない一時状態を破棄する。

##### Invariants

- 第一段階の解決結果だけでactive DnDを開始しない。
- 第二段階解決結果をDnD Sessionと重複する長期状態として保持しない。
- DnD Engine固有イベントまたは水平自動スクロール状態をDnD Interactionの公開状態として持ち込まない。
- DnD Engine標準のAuto ScrollとColumn Reorderの水平自動スクロールを同時に利用しない。
- Column Reorderの自動スクロールで縦方向のスクロール位置を変更しない。
- 一回の物理DnDと一つのColumn DnD Session、および一つの対象Table横スクロール領域を対応させる。

#### Destination Resolution {#RESP_COLUMN_DESTINATION_RESOLUTION}

##### Responsibility

active DnD中の現在の物理入力位置を、DnD開始時のTable配置に対する論理列間境界へ変換する。

##### State ownership

一回のDnDで移動先解決に必要な対象Tableの表示参照と開始時の論理列境界計測だけを一時的に保持できる。Tableデータ、構造制約、DnD Session、Presentationによる表示変位は所有しない。

##### Contract

DnD開始時の移動対象から対象Tableと論理列境界の配置を確定する。物理入力位置を受けるたびに、スクロールによるTable自体の現在位置変化を反映しつつ、DnD開始時の論理列境界に対応する0-based列間境界または`null`を返す。対象Table外の位置から移動先を推測しない。物理DnD moveだけでなく、水平自動スクロール後にDnD Engine Integrationから同じ最新物理入力位置で再要求された場合も同じContractで解決する。

##### Lifecycle

active DnD開始時に生成し、DnD中の物理入力位置解決で再利用し、DnD終了時に破棄する。開始時に成立できない場合は後続moveから再解決してよい。

##### Invariants

- Table構造上その境界へ移動できるかを判定しない。
- Presentationで動いた列の見かけ上の位置を論理境界の正本にしない。
- DnD Engineの物理イベントをDnD Interactionへそのまま渡さない。
- `progress`ごとにSupported Table Blockの列構造を取得しない。

#### Table Integration {#RESP_COLUMN_TABLE_INTEGRATION}

##### Responsibility

指定されたSupported Table Blockとの差を吸収し、Column Reorderへ現在のTable全体の列制約と、再照合済みの確定済み列移動をTable全体へ反映する境界を提供する。

##### State ownership

Table Identity、DnD Session、入力状態を所有しない。外部Tableデータや算出済み制約を監視用の永続状態として複製しない。

##### Contract

呼び出し側からTable Identityを受け、その要求時点の対応Tableから論理列数、`colspan`で単独移動できない列、結合セルを分断するため挿入できない列間境界を判断できるColumn Reorder用制約を返す。対応Tableを安全に解釈できない場合は正常な利用不能を返す。

DnD Interactionから再照合済みの移動元論理列と移動先境界を受け、要求時点のTableでも更新範囲が成立する場合だけ、`thead`、`tbody`、`tfoot`を含むTable全体の列順を一つの確定済み更新として反映する。更新要求時点で安全に反映できない場合は部分更新せず利用不能結果を返す。

確定候補となる列移動を受け、要求時点のTable構造から今回の更新対象セル数を算出して返す。安全に算出できない場合は反映経路を推測させず利用不能結果を返す。

##### Lifecycle

各要求時点のSupported Table Blockを直接参照して制約取得または更新を行う。独自のTable監視、retry、section単位rollbackを開始しない。

##### Invariants

- Table Identityを発行または所有しない。
- sectionごとに別の移動対象または別の確定を作らない。
- `thead`、`tbody`、`tfoot`を部分的に個別確定しない。
- 列順以外を並び替え結果として変更しない。
- 1回の成立した列移動を複数のUndo単位へ分割しない。
- Supported Table Block固有の保存表現を他のColumn Reorder責務へ漏らさない。

#### Reorder Target Resolution {#RESP_COLUMN_TARGET_RESOLUTION}

##### Responsibility

active DnD成立前に、要求時点のTable制約に対してReorder TargetがTable全体の論理列として単独移動可能かを解決し、開始可能な場合は同じ解決結果として開始時制約を返す。

##### State ownership

開始試行を越える共有状態、DnD Session、入力状態、表示状態、Tableデータを所有しない。

##### Contract

Reorder Targetを受け取り、Table Integrationから指定Tableの要求時点の列制約を取得する。対象列が存在し、`colspan`で単独移動できない範囲に含まれず、列単位の移動対象として成立する場合は`resolved`としてReorder Targetと開始時制約を返す。`colspan`による開始不可はDesign上の`rejected`理由を返す。Tableまたは対象列を安全に解釈できない場合は`unavailable`を返す。`rowspan`だけを開始拒否理由にしない。

##### Lifecycle

Input Interactionから第一段階、DnD Engine Integrationから第二段階をそれぞれ独立した要求として受ける。解決結果を共有状態として保持しない。

##### Invariants

- Reorder Targetへ開始時制約や拒否理由を埋め込まない。
- 第一段階と第二段階で同じ解決Contractを使う。
- `colspan`で単独移動できない列を`resolved`にしない。
- `rowspan`だけを理由に`rejected`にしない。
- 判定のためにTableデータを変更しない。

#### DnD Interaction {#RESP_COLUMN_DND_INTERACTION}

##### Responsibility

第二段階で解決済みのReorder Targetから始まるColumn DnD Sessionを所有し、論理列間境界の有効性、complete、cancel、外部Table変化による確定不能、およびSession終了後のReorder Mode解決を管理する。

##### State ownership

idleまたは一つのactive Sessionを所有する。active Sessionは対象Table Identity、移動元論理列、第二段階で得た開始時制約、現在の有効な論理移動先だけを保持する。DnD Engineの物理入力位置、物理イベント、表示参照、計測結果、自動スクロール状態を保持しない。

##### Contract

`start`では第二段階で`resolved`となったReorder Targetと開始時制約を受けてactive Sessionを開始する。

`progress`ではDestination Resolutionで解決済みの0-based論理列間境界または`null`を受け、Session開始時制約に対して構造を保て、かつ実際に列順が変化する境界だけを現在の有効移動先として保持する。現在のTable構造を取得し直さない。

`complete`では有効移動先がある場合でもTable Integrationから現在制約を取得し直し、移動元と移動先が現在も成立する場合だけ確定済み列移動を要求する。現在構造で成立しない、Table利用不能、更新不能の場合は新しい列順を確定せず安全終了し、Designで通知対象となる場合だけReorder Presentationへ一回性終了通知を発行する。

現在構造で確定候補が成立した場合は、Table Integrationから今回の更新対象セル数を取得し、Reorder Apply Policyで反映経路を選択する。通常反映ではTable Integrationへ確定済み列移動を要求する。確認付き大規模反映ではTableをまだ更新せず、DnD Sessionをidleへ終了した後に確定済み移動意図をColumn Reorder Applyへ引き渡す。

`cancel`または有効移動先のないdropはTableを更新せず正常終了する。Sessionを破棄した後、Table Integrationから対象Tableの現在利用可否を取得し直し、Reorder Modeへ「次の列並び替えを安全に受けられるか」だけを渡す。

##### Lifecycle

idleから`start`でactiveとなり、`progress`で有効移動先だけを更新する。`complete`または`cancel`では必ずSessionを破棄してidleへ戻す。Session終了後に現在Tableの継続可否を解決する。

##### Invariants

- active Sessionは同時に一つだけ存在する。
- Session開始時制約は同じ開始試行の第二段階Target Resolution結果である。
- 物理入力位置、表示参照、計測結果をSessionへ保持しない。
- `progress`では現在Table構造を再取得しない。
- `complete`は現在構造への再照合なしに確定しない。
- cancel、有効移動先なし、現在構造での確定不能では新しい列順を確定しない。
- Reorder Mode状態そのものをSessionへ複製しない。

#### Reorder Apply {#RESP_COLUMN_REORDER_APPLY}

##### Responsibility

確認付き大規模反映について、DnD Session終了後に受理した確定済み列移動意図、利用者確認、反映開始、現在構造再照合、editing surface restoration完了までの方向固有Lifecycleを所有する。

##### State ownership

idleでは移動意図を持たず、確認付き反映中だけ一つの確定済み列移動意図と現在のLifecycle状態を所有する。DnD Session、WordPress表示状態、Table制約のsnapshotを重複所有しない。

##### Contract

DnD Session終了後に確認付き大規模反映の移動意図を一つだけ受理して`confirming`へ進む。CancelではTableを変更せずidleへ戻る。Continueでは反映開始状態へ進み、WordPress Reorder Apply Integrationが反映中表示を成立させた後、Table Integrationから現在構造を再取得して移動元・移動先を再照合する。現在も成立する場合だけ確定済み列移動を要求し、成立しない場合はTableを変更しない。更新成否にかかわらずediting surface restorationを経て、その表示復帰完了後にidleへ戻る。

##### Lifecycle

`idle → confirming → applying → editing surface restoration → idle`をArchitecture上の意味として持つ。Cancelは`confirming → idle`、確認後の再照合不成立はTableを変更せず`applying → editing surface restoration → idle`へ進む。一つの確認付き反映が完了するまで別の同方向大規模反映要求を受理しない。

##### Invariants

- `confirming`は物理drag-end処理中ではなくDnD Session終了後に公開する。
- 確認中はTableデータを変更しない。
- Continue後も現在構造への再照合なしに確定しない。
- 再照合不成立ではTableを変更しない。
- 成立した1回の列移動を複数のWordPress更新またはUndo単位へ分割しない。
- WordPress Editor表示の実装方式を所有しない。

#### Reorder Presentation {#RESP_COLUMN_PRESENTATION}

##### Responsibility

Column Reorderの開始可否、active DnD意味状態、現在のEditor表示方式、および必要なDnD Engine物理情報から、移動対象列、垂直挿入位置、環境に応じた周囲列移動、開始拒否、終了通知を独立した表示として表現する。

##### State ownership

表示と一回性通知に必要な一時状態だけを所有する。Tableデータ、DnD Session、Target Resolution結果の正本、DnD Engine物理状態、Editor表示方式の永続状態を所有しない。

##### Contract

Input InteractionからDesign上の開始拒否理由と操作位置を一回性通知として受ける。操作可能列の事前表示等ではReorder Target Resolutionを利用し、構造制約を重複判定しない。DnD Interactionのactive状態と現在有効移動先を購読し、DnD Engineの物理情報は表示に必要な時点だけ利用する。

移動対象列は元Tableの列幅とセル高さの配置関係を保ち、Tableの縦方向から不必要にはみ出さない。現在の有効移動先はTable全体の列間に垂直挿入線で示す。iframe Editorでは実際に位置が変わる周囲列だけを移動表示する。non-iframe EditorではPerformance fallbackとして周囲列移動を成立させず、移動対象列と垂直挿入位置を維持する。この表示差によってDnD Interactionの有効移動先、drop後の列順、確定・cancelの意味を変更しない。

##### Lifecycle

開始拒否通知はDesignで定義された期間だけ表示する。active DnD表示はDnD InteractionのSession開始と終了に追従する。周囲列移動を提供するかはactive DnD開始時の現在Editor表示方式に従い、そのSession中に別の意味状態として保持しない。cancelまたは成立しないdropでは異常終了通知を表示しない。安全に確定できない終了でDesignが通知を要求する場合だけ短い終了通知を表示する。

##### Invariants

- 表示状態をTableデータまたはDnD Sessionの正本にしない。
- 開始可否や構造上の移動可否をPresentation独自に再実装しない。
- DnD中の表示のために実Tableの列順を変更しない。
- non-iframe Editorで周囲列移動を省略しても、移動対象、垂直挿入位置、DnD Interaction、drop/applyの意味を変更しない。
- DnD Engine標準の移動表示とColumn Reorder独自表示を重ねて利用しない。
- Row Reorderの表示状態を共有しない。

## 6. Runtime View

### Column DnD start attempt {#RV_COLUMN_DND_START}

第一段階で開始可能な列だけをDnD Engineへ登録し、active DnD成立直前に第二段階で再解決してからColumn DnD Sessionを開始する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 対象Tableの既存Block wrapper上で開始入力が発生する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_COLUMN_DND_ENGINE_INTEGRATION | 対象Tableの列並び替え有効状態と開始入力接続を方向固有DnD境界へ反映する。 |
| 3 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_INPUT_INTERACTION | 列開始入力を入力境界へ渡す。 |
| 4 | RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_TARGET_RESOLUTION | 開始候補を第一段階の現在制約で解決する。 |
| 5 | RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 指定Tableの現在列制約を要求する。 |
| 6 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 要求時点の対応Tableから列制約を取得する。 |
| 7 | RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_INPUT_INTERACTION | `resolved`、Design上の`rejected`、または`unavailable`を返す。 |
| 8 | RESP_COLUMN_INPUT_INTERACTION | RESP_COLUMN_PRESENTATION | 第一段階がDesign上の`rejected`の場合だけ理由と操作位置を通知する。 |
| 9 | RESP_COLUMN_INPUT_INTERACTION | EXT_DND_ENGINE | 第一段階が`resolved`の場合だけ開始候補を一時登録する。 |
| 10 | EXT_DND_ENGINE | RESP_COLUMN_DND_ENGINE_INTEGRATION | active DnD成立直前の開始通知を渡す。 |
| 11 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_TARGET_RESOLUTION | 同じReorder Targetを第二段階の現在制約で再解決する。 |
| 12 | RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 第二段階の現在列制約を要求する。 |
| 13 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 要求時点の対応Tableから列制約を取得する。 |
| 14 | RESP_COLUMN_TARGET_RESOLUTION | RESP_COLUMN_DND_ENGINE_INTEGRATION | 第二段階の解決結果を返す。 |
| 15 | RESP_COLUMN_DND_ENGINE_INTEGRATION | EXT_DND_ENGINE | 第二段階が`resolved`でなければ物理DnD開始を成立させない。 |
| 16 | EXT_DND_ENGINE | RESP_COLUMN_DND_ENGINE_INTEGRATION | 第二段階成立後の物理DnD startを通知する。 |
| 17 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DESTINATION_RESOLUTION | 当該DnDの開始時Table配置から移動先解決境界を生成する。 |
| 18 | RESP_COLUMN_DND_ENGINE_INTEGRATION | EXT_SCROLL_AREA | 当該DnDの対象Tableに対する横スクロール領域を一つ確定する。 |
| 19 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | 解決済みReorder Targetと開始時制約でColumn DnD Sessionを開始する。 |
| 20 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | active状態への遷移を表示購読へ反映する。 |

### Column DnD progress {#RV_COLUMN_DND_PROGRESS}

DnD Engineの物理位置をDestination Resolutionで論理列間境界へ変換してから、DnD InteractionがSession開始時制約へ照合する。現在の物理入力位置が対象Tableの横スクロール領域端にある場合はColumn DnD Engine Integrationが水平自動スクロールを進行し、スクロール後のTable位置でも同じ最新物理入力位置から移動先を再解決する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_COLUMN_DND_ENGINE_INTEGRATION | 現在の物理DnD移動と物理入力位置を通知する。 |
| 2 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DESTINATION_RESOLUTION | 現在の物理入力位置から論理列間境界を要求する。 |
| 3 | RESP_COLUMN_DESTINATION_RESOLUTION | RESP_COLUMN_DND_ENGINE_INTEGRATION | 0-based論理列間境界または`null`を返す。 |
| 4 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | 解決済み論理列間境界を現在Sessionへ渡す。 |
| 5 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | 開始時制約に対して成立した現在の有効移動先を表示購読へ反映する。 |
| 6 | RESP_COLUMN_PRESENTATION | EXT_DND_ENGINE | 移動対象表示に必要な物理DnD情報を必要な時点だけ利用する。 |
| 7 | RESP_COLUMN_DND_ENGINE_INTEGRATION | EXT_SCROLL_AREA | 現在の物理入力位置が対象領域の左右端にある場合だけ横方向へ自動スクロールする。 |
| 8 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DESTINATION_RESOLUTION | 実際に横スクロールした場合、最新の物理入力位置から現在Table位置に対する論理列間境界を再要求する。 |
| 9 | RESP_COLUMN_DESTINATION_RESOLUTION | RESP_COLUMN_DND_ENGINE_INTEGRATION | スクロール後のTable位置に追従した0-based論理列間境界または`null`を返す。 |
| 10 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | 再解決された論理列間境界を現在Sessionへ渡す。 |

### Column DnD complete {#RV_COLUMN_DND_COMPLETE}

物理DnD終了後に現在Tableへ再照合し、更新対象セル数をReorder Apply Policyへ渡す。通常反映と判定された場合だけ、このRuntime内で確定済み列移動を一回で更新する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_COLUMN_DND_ENGINE_INTEGRATION | cancelされていない物理DnD endを通知する。 |
| 2 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | active Sessionのcompleteを要求する。 |
| 3 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | 現在の列制約を要求する。 |
| 4 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 要求時点の対応Tableから現在列制約を取得する。 |
| 5 | RESP_COLUMN_TABLE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | 現在列制約または利用不能結果を返す。 |
| 6 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | 現在も移動元と移動先が成立する確定候補について更新対象セル数を要求する。 |
| 7 | RESP_COLUMN_TABLE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | 更新対象セル数または利用不能結果を返す。 |
| 8 | RESP_COLUMN_DND_INTERACTION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から反映経路の選択を要求する。 |
| 9 | RESP_REORDER_APPLY_POLICY | RESP_COLUMN_DND_INTERACTION | 通常反映または確認付き大規模反映を返す。 |
| 10 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | 通常反映の場合だけ確定済み列移動を要求する。 |
| 11 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 列順を一回の更新として反映する。 |
| 12 | RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した列移動を一回のUndo単位として成立させる。 |
| 13 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | DnD Session終了を表示購読へ反映する。 |
| 14 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | Session破棄後、対象Tableが次のcolumn並び替えを安全に受けられるか現在状態を取得し直す。 |
| 15 | RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | 対象Tableの継続可否だけを現在モードへ反映する。 |

確認付き大規模反映と判定された場合、Step 10から12は実行せず、DnD Sessionを終了した後に`RV_COLUMN_LARGE_REORDER_CONFIRM`へ進む。

### Column large reorder confirmation {#RV_COLUMN_LARGE_REORDER_CONFIRM}

Reorder Apply Policyが確認付き大規模反映を選択した場合、物理DnDの表示とSessionを先に終了し、その後に方向固有Reorder Applyが確定済み移動意図を受理して確認状態を公開する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | DnD Session終了を表示購読へ反映し、物理DnD表示を終了する。 |
| 2 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | Session破棄後の対象Table利用可否を取得し直す。 |
| 3 | RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | 対象Tableの継続可否だけを現在モードへ反映する。 |
| 4 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_REORDER_APPLY | DnD Session終了後に確定済み列移動意図を確認付き大規模反映として引き渡す。 |
| 5 | RESP_COLUMN_REORDER_APPLY | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | `confirming`状態をWordPress表示接続へ公開する。 |
| 6 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableの通常編集表示を維持したまま確認UIを表示する。 |

### Column large reorder continue {#RV_COLUMN_LARGE_REORDER_CONTINUE}

利用者がContinueした後、反映中表示を先に成立させ、方向固有Reorder Applyが現在Tableを再照合して成立する場合だけ確定更新し、更新後の編集表示が再成立してからLifecycleを完了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者が確認UIでContinueを選択する。 |
| 2 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_COLUMN_REORDER_APPLY | 確認待ちの移動意図を反映開始へ進める。 |
| 3 | RESP_COLUMN_REORDER_APPLY | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | `applying`状態をWordPress表示接続へ公開する。 |
| 4 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableの通常編集表示を一時的に退避し、反映中表示を先に成立させる。 |
| 5 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_COLUMN_REORDER_APPLY | 反映中表示成立後に確定処理を進める。 |
| 6 | RESP_COLUMN_REORDER_APPLY | RESP_COLUMN_TABLE_INTEGRATION | 現在の列制約を取得し、保持中の移動元・移動先を再照合する。 |
| 7 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 要求時点の対応Tableから現在列制約を取得する。 |
| 8 | RESP_COLUMN_TABLE_INTEGRATION | RESP_COLUMN_REORDER_APPLY | 現在列制約または利用不能結果を返す。 |
| 9 | RESP_COLUMN_REORDER_APPLY | RESP_COLUMN_TABLE_INTEGRATION | 現在も成立する場合だけ確定済み列移動を要求する。 |
| 10 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 列順を一回の更新として反映する。 |
| 11 | RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した列移動を一回のUndo単位として成立させる。 |
| 12 | RESP_COLUMN_REORDER_APPLY | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | Table更新後にediting surface restorationへ進んだことを公開する。 |
| 13 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後のTable編集表示を再成立させる。 |
| 14 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_COLUMN_REORDER_APPLY | 表示復帰完了を通知して方向固有Apply Lifecycleをidleへ完了させる。 |

### Column large reorder cancel {#RV_COLUMN_LARGE_REORDER_CANCEL}

確認中にCancelした場合はTableデータを変更せず、確認UIを終了して方向固有Reorder Applyをidleへ戻す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者が確認UIでCancelを選択する。 |
| 2 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_COLUMN_REORDER_APPLY | 確認待ちの移動意図を破棄する。 |
| 3 | RESP_COLUMN_REORDER_APPLY | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | Tableを変更せずidleへ戻った状態を公開する。 |
| 4 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 確認UIを終了し、対象Tableの通常編集表示を維持する。 |

### Column large reorder revalidation failure {#RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE}

Continue後の現在Table再照合で移動が成立しなくなっている場合はTableを変更せず、表示復帰を経てLifecycleを完了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_COLUMN_REORDER_APPLY | RESP_COLUMN_TABLE_INTEGRATION | 反映直前の現在列制約を要求する。 |
| 2 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 要求時点の対応Tableから現在列制約を取得する。 |
| 3 | RESP_COLUMN_TABLE_INTEGRATION | RESP_COLUMN_REORDER_APPLY | 移動元または移動先が成立しない現在状態を返す。 |
| 4 | RESP_COLUMN_REORDER_APPLY | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | Tableを更新せずediting surface restorationへ進んだことを公開する。 |
| 5 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableの編集表示を再成立させる。 |
| 6 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_COLUMN_REORDER_APPLY | 表示復帰完了を通知して方向固有Apply Lifecycleをidleへ完了させる。 |

### Column DnD cancel or invalid drop {#RV_COLUMN_DND_CANCEL}

cancel、有効移動先がないdrop、または列順が変化しないdropではTableを更新せずSessionを終了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_DND_ENGINE | RESP_COLUMN_DND_ENGINE_INTEGRATION | cancelまたは物理DnD endを通知する。 |
| 2 | RESP_COLUMN_DND_ENGINE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | cancel、またはcomplete時の有効移動先なしとしてSession終了へ接続する。 |
| 3 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | DnD中表示を終了し、異常終了通知を要求しない。 |
| 4 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | Session破棄後、対象Tableが次の列並び替えを安全に受けられるか現在状態を取得し直す。 |
| 5 | RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | 対象Tableの継続可否だけを現在モードへ反映する。 |

### Column DnD current-state recovery {#RV_COLUMN_CURRENT_STATE_RECOVERY}

complete時に現在Tableを安全に再照合または更新できない場合は、新しい列順を確定せずSessionを終了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | complete時の現在列制約または確定済み列移動の反映を要求する。 |
| 2 | RESP_COLUMN_TABLE_INTEGRATION | RESP_COLUMN_DND_INTERACTION | 現在Table利用不能または更新不能を安全な確定不能結果として返す。 |
| 3 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_PRESENTATION | Sessionを終了し、Designで通知対象となる場合だけ一回性終了通知を発行する。 |
| 4 | RESP_COLUMN_DND_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | Session破棄後の対象Table利用可否を取得し直す。 |
| 5 | RESP_COLUMN_DND_INTERACTION | RESP_REORDER_MODE | 対象Tableで次の列並び替えを安全に受けられるかだけを現在モードへ反映する。 |

## 8. Crosscutting Concepts

### Integration boundaries

共通状態責務、WordPress Integration、DnD Engine Integration、Column Reorderの意味責務を分離する。WordPress固有UI、DnD Engine固有イベント、物理座標はDnD Interactionの意味状態へ直接持ち込まない。

### Table identity and current structure

Table IdentityはReorder Modeと方向固有DnD Sessionが対象Tableを照合するために外側から渡される識別値であり、Table Integrationが発行または所有しない。Table Integrationは指定されたTable Identityに対する要求時点の制約と更新能力を提供する。

### Logical columns and structural constraints

Column Reorderが扱う列は`thead`、`tbody`、`tfoot`を通じたTable全体の論理列である。`colspan`により単独移動できない論理列は開始対象として成立させない。移動先は結合セルを分断せずTable全体の構造を維持できる列間だけを成立させる。`rowspan`だけを開始拒否理由にしない。

### Physical-to-logical destination separation

Destination Resolutionは物理入力位置を論理列間境界へ変換するだけとし、DnD Interactionはその論理境界をSession開始時制約へ照合する。この分離により、DnD EngineやDOM geometryをDnD Sessionへ持ち込まず、Presentationによる見かけ上の列移動を論理移動先へ混入させない。水平自動スクロールでTable位置だけが変化した場合も、DnD Engine Integrationが同じ最新物理入力位置からDestination Resolutionを再要求し、この責務分離を維持したまま現在位置へ追従する。

### Presentation fallback by Editor environment

Reorder Presentationは現在のEditor DOM Contextを要求時点で利用し、周囲列移動を提供できる表示方式かを判断する。iframe Editorでは周囲列移動を提供し、non-iframe Editorでは大規模Tableでの実セル表示更新による追加Layoutコストを避けるため周囲列移動を省略する。non-iframeでも移動対象列と垂直挿入位置を維持し、このfallbackをDnD Interaction、Destination Resolution、Table Integration、Reorder Applyへ伝播させない。

### Horizontal auto scroll ownership

Column Reorderの水平自動スクロールはDnD Engine Integrationが所有する。対象Tableに対応する横スクロール領域を一回のDnDへ固定し、対象Editor環境と同じ座標系の現在物理入力位置が左右端領域にある場合だけ横方向へ進行する。DnD Engine標準のAuto Scrollは利用せず、縦方向のスクロールを開始しない。スクロール限界または端領域外では不要な継続を停止し、DnD終了時にはスクロール対象と物理入力位置を含む一時状態を破棄する。

### Session snapshot and current-state revalidation

第二段階Target Resolutionで得た列制約をSession開始時制約とする。`progress`では開始時制約を使い、外部Table構造を毎回取得しない。`complete`では現在構造を取得し直し、現在状態だけを最終確定の基準とする。

### Reorder apply routing and lifecycle

Table Integrationが現在構造から算出した更新対象セル数を共通Reorder Apply Policyへ渡し、通常反映と確認付き大規模反映を選択する。PolicyはTable構造や方向固有移動を解釈せず、方向固有Reorder Apply状態も所有しない。

確認付き大規模反映では、物理drag-end処理と確認UIを分離するため、DnD Sessionを終了してから方向固有Reorder Applyが移動意図を受理する。確認中はTableを変更せず、Continue後にも現在構造を再照合する。WordPress Reorder Apply IntegrationはEditor表示接続だけを担当し、Table更新の権威はTable Integrationに維持する。

### Atomic Table-wide update

1回の成立した列移動はTable全体への1回の更新として扱う。section単位の途中状態を確定せず、WordPress Undo上も1回のUndo単位とする。

### Error and recovery boundary

開始前の通常利用不能、物理DnDのcancel、有効移動先なしは正常終了であり異常通知を要求しない。complete時の外部Table変化等で安全に確定できない場合は内部Errorへ変換せず安全終了し、Designで通知対象となる場合だけ通知する。内部Contractまたはruntime invariant違反はErrorとして扱い、正常結果へ変換しない。

## 9. Architecture Decisions

- Reorder Apply PolicyをRow / Column共通の独立責務とし、更新対象セル数だけから反映経路を選択する。
- 確認付き大規模反映LifecycleはColumn Reorder Applyの方向固有責務とし、Row / Column間で状態を共有しない。
- WordPress Reorder Apply Integrationを通常のWordPress Reorder Integrationから分離し、確認・反映中表示・editing surface restorationだけを接続する。
- 確認付き大規模反映ではDnD Session終了後にconfirmingを公開し、物理drag-end処理と確認UIを分離する。
- Continue後も現在Table構造を再照合し、成立しない場合はTableを変更しない。
- Requirements / Designに反しない範囲では、正式v1 Row Reorderで成立している責務境界をColumn Reorderの参照モデルとする。
- Reorder Mode本体とWordPress UI接続を分離し、Reorder Modeは排他状態とTable単位Lifecycleだけを所有する。
- Reorder Guidance本体は現在表示中状態だけを所有し、初回案内表示済み状態とWordPress依存はReorder Guidance Integrationへ分離する。
- Input InteractionはReorder Mode、Editor DOM Context、DnD Interactionへ直接依存しない。
- DnD Engine Integrationを独立責務とし、第二段階Target Resolutionと物理DnD LifecycleからDnD Interactionへの接続を所有する。
- Destination Resolutionを独立責務とし、物理位置から論理列間境界への変換をDnD Interactionから分離する。
- Column専用のDrop Target Resolution責務は設けない。Destination Resolutionは物理位置の意味変換だけを担い、構造制約に対する移動先の有効性はDnD Interactionが所有する。
- 開始拒否通知は第一段階解決結果を受けたInput InteractionからReorder Presentationへ渡す。
- Reorder Targetは移動する論理列だけを表し、開始時制約や開始不可理由を含めない。
- Session中の移動先判定は第二段階で得た開始時制約を基準とし、`progress`ごとに現在構造を取得し直さない。
- `complete`だけは現在構造へ再照合してから確定する。
- Table IntegrationはTable Identityを提供せず、指定Tableに対する現在制約と確定済み更新能力を提供する。
- `thead`、`tbody`、`tfoot`を含むTable全体の列移動を1回の確定済み更新・1回のUndo単位として扱う。
- non-iframe EditorではReorder PresentationのPerformance fallbackとして周囲列移動を省略し、移動対象と垂直挿入位置を維持する。表示方式の差をDnD Interactionまたは確定結果の差にしない。
- Column Reorderの水平自動スクロールはDnD Engine標準機能へ委ねず、DnD Engine Integrationが対象Tableの横スクロール領域と現在物理入力位置を一回のDnDへ接続して所有する。

## 10. Quality Requirements

- DnD InteractionはDnD Engine固有の物理イベント、表示参照、計測結果、自動スクロール状態をSession状態へ保持しない。
- 大規模Tableでも`progress`ごとにSupported Table Blockの現在構造を再取得せず、Destination Resolutionの論理境界とSession開始時制約で移動先を判断する。
- non-iframe Editorでは実Tableセルへの周囲列移動を省略し、移動対象と垂直挿入位置を維持したままColumn Reorder自身が追加するDnD中のLayoutコストを抑える。
- 水平自動スクロール中も新しい物理moveを要求せず、実際にスクロールした時だけ最新の物理入力位置からDestination Resolutionを再要求して現在Table位置へ追従する。
- 水平自動スクロールは対象Tableの横方向だけを変更し、スクロール限界または端領域外で不要な継続処理を残さない。
- Presentationによる列の表示変位をDestination Resolutionの論理配置へ混入させない。
- DnD中は実Tableの列順を変更せず、表示更新と確定更新を分離する。
- 1回の成立した列移動はTable全体に対する1回の更新境界を通り、部分確定や複数Undo単位を作らない。
- WordPress固有UI、WordPress preferences、Supported Table Block固有表現、DnD Engine固有物理状態を、それぞれを所有する統合境界の外へ漏らさない。

## 11. Risks and Technical Debt

- Row Reorderの現行実装で成立した責務境界を参照するため、Row Architecture文書が実装より古い責務モデルを保持している間はRow / Column文書間に見かけ上の差が残る。Row Architectureは別作業で現行実装へ同期する必要がある。
- Columnの論理列配置計測は行と異なるため、Destination Resolutionの具体的な計測戦略はColumn実装時に検証が必要である。ただし物理位置→論理境界と構造制約判定の責務分離は維持する。
- Table全体の列更新自体は対応Table Blockの再描画性能に影響される。Column ReorderはDnD中の追加コストを抑えるが、外部Block本体の確定時再描画コストまでは所有しない。
- 列幅とセル高さを保持した移動対象表示は実装時の計測方法に依存し得るが、計測結果をDnD Sessionへ持ち込まない境界を維持する。

## 12. Glossary

- **Reorder Mode**: 通常編集、行並び替え、列並び替えの排他状態と対象Table単位Lifecycleを所有する共通状態責務。
- **DnD Engine Integration**: DnD Engine固有の物理LifecycleをColumn ReorderのTarget Resolution、Destination Resolution、DnD Interactionへ接続し、active DnD中の対象Tableに対する水平自動スクロールを所有する責務。
- **Destination Resolution**: active DnDの物理入力位置をDnD開始時配置に対する論理列間境界へ変換する責務。構造制約上の移動可否は判定しない。
- **Logical Column**: `thead`、`tbody`、`tfoot`を通じて同じTable全体の列位置を表す論理的な列。
- **Reorder Target**: 一つのDnD開始試行で移動対象となる論理列。開始時制約や開始不可理由は含まない。
- **Start Constraints**: Reorder Target Resolutionの第二段階で現在Tableから解決され、active DnD Session中の移動先判定基準として保持される列制約。
- **Insertion Boundary**: DnD開始時のTable配置に対して論理列を挿入する0-based列間位置。構造上有効かはDnD Interactionが開始時制約へ照合する。
- **Column DnD Session**: active DnD成立後からcompleteまたはcancelまで、DnD Interactionが所有する一回の列DnD意味状態。
- **Atomic Table-wide Update**: `thead`、`tbody`、`tfoot`を部分的に個別確定せず、一回の成立した列移動をTable全体への一回の更新として反映すること。
