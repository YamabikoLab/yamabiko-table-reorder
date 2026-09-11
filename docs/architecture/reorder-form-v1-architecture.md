# Reorder Form v1 Architecture

## 1. Introduction and Goals

本書は、Reorder Form（RF）v1を実現するための内部責務、境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

入力は`docs/requirements/reorder-form-v1-requirements.md`、`docs/design/reorder-form-v1-design.md`、`docs/design/reorder-v1-design.md`、および既存のRow / Column Reorder v1 Architectureとする。RFはDnDの補助機能ではなく、対応Tableの行または列をフォーム指定から直接並び替える独立した操作手段として扱う。

RF Architectureは一つの文書で全体Lifecycleを扱う。一方、RowとColumnの位置意味、構造制約、Table更新は方向固有責務として分離し、既存のRow / Column実装独立方針を維持する。

Architecture上の責務はソースファイル構成を写したものではない。実装単位が変わっても維持すべき責務、依存方向、状態所有、Contractを定義する。

## 2. Architecture Constraints

- RFは一つの入口と一つの入力Lifecycleを持ち、Row / ColumnをRF Interaction内の選択として扱う。
- Row / Columnの方向固有ResolutionとTable Integrationは分離し、方向固有処理を新しいshared reorder abstractionへ統合しない。
- Reorder Modeは`edit | row | column`の排他状態を維持し、RFを新しい`form`方向として所有しない。
- RF開始時は、同一Tableで有効なRow / Column Reorder Modeを終了してからRFを開始する。
- RF表示中は、同一Tableに対するRow / Column DnDを同時に有効にしない。RF終了時に以前のDnDモードを自動復元しない。
- WordPress Reorder IntegrationはTableツールバー入口、RF入力画面、Reorder Mode / RF Interactionの排他接続を所有し、RF入力状態や方向固有移動意味を所有しない。
- RF InteractionはRFのopen / close、対象Table Identity、選択方向、利用者入力、入力画面へ返すための一時状態を所有する。
- RF Interactionは入力成立に必要な最小Table情報だけを方向固有Table Integrationから取得する。Rowでは現在行数、Columnでは論理列Identity・列番号・利用可能な見出し表示値を利用する。
- RF Input Interpretationは利用者入力とRF Interactionから渡された現在の入力範囲を内部で解釈可能な値へ変換する。Table構造制約、Table更新、UI表示状態は所有しない。
- Row RF Resolutionは`tbody`の行指定と`above | below`を、移動前Table基準の行移動候補へ解決する。
- Column RF ResolutionはTable全体の論理列指定と`left | right`を、移動前Table基準の列移動候補へ解決する。
- RFで指定する移動先は、移動元を除去した後のindexではなく、並び替え前Table上の対象行または対象列そのものを識別する。
- 入力中の構造判定は要求時点のTableを基準とし、移動対象、移動先、結合セル制約、およびno-opを方向固有Resolutionで解決する。
- 結合セルによる拒否理由の位置情報はRF UI固有情報として生成しない。方向固有Table Integration / Resolutionが、DnDでも再利用可能な構造診断として提供できる境界に置く。
- Table IntegrationはCore TableとFlexible Table Blockの保存表現差を吸収し、RFへ方向固有の入力情報、制約、診断、更新対象セル数、および確定済み移動の反映能力を提供する。
- RF Apply CoordinationはRFから解決済み候補を受け、通常反映または確認付き大規模反映のLifecycle、反映直前再照合、成功 / 失敗結果を所有する。
- 反映直前の再照合は方向固有Table Integrationを最終権威とする。入力中のResolution結果を再利用して現在Tableを推測しない。
- Reorder Apply PolicyはRow / Column / RFに共通する反映経路選択として、Table Integrationが算出した更新対象セル数だけから通常反映または確認付き大規模反映を選択する。
- RFは既存DnD InteractionやDnD Sessionを経由してTableを更新しない。
- 既存の方向固有Reorder ApplyはDnD Session終了後のLifecycleとして成立しているため、RFから名前だけで流用しない。本ArchitectureではRF固有のApply Coordinationを定義し、共通PolicyとWordPress Reorder Apply Integrationを再利用する。
- WordPress Reorder Apply Integrationは確認、反映中表示、editing surface restorationをRF Apply Coordinationへ接続できる共通Editor統合責務として扱う。
- 確認中はTableデータを変更しない。Continue後は方向固有Table Integrationが要求時点の現在Tableへ再照合し、現在も成立する場合だけ更新する。
- Cancel、no-op、入力不正、構造上の移動不可、再照合不成立、更新不能ではTableデータを変更しない。
- 成立した一回のRF並び替えは一回のWordPress更新および一回のUndo単位として扱う。
- 反映失敗後はRF入力を保持して入力画面へ戻し、対象Tableを再び編集可能にする。
- 反映成功後はRFを終了し、通常編集へ戻す。
- Reorder GuidanceとReorder Guidance Integrationは既存の共通Contractを維持し、RF入口選択だけを共通案内の終了条件へ追加する。
- Reorder Guidanceの操作環境は既存どおり`pc | touch`で区別し、Reorder Guidance IntegrationがEditor DOM ContextとWordPress Preferencesを利用して環境別の表示済み状態を扱う。
- 対象Table以外のブロック操作を、RFの確認または反映Lifecycleによって不必要に妨げない。
- Performanceの責任境界は、対応Table Block本体の再描画性能ではなく、RFが追加する入力解釈、構造解決、経路選択、Lifecycle管理のコストとする。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | 対応Tableのツールバー、RF入力画面、確認、反映中表示、通知、および通常編集環境を提供する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | Core TableまたはFlexible Table Blockとして、方向固有Table Integrationが構造取得と確定更新を行う対象を提供する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した一回のRF並び替えを一回のUndoで戻せる更新単位を提供する。 |
| EXT_WORDPRESS_PREFERENCES | WordPress Preferences | External Capability | PC / タッチごとの共通初回案内表示済み状態を永続化する。 |

RFはWordPress Editorから開始されるが、利用者入力の意味解釈、方向固有Resolution、Table Block保存表現、反映LifecycleをWordPress UIへ混在させない。対応Table Block固有の表現差は既存の方向固有Table Integrationで吸収する。

## 4. Solution Strategy

RFは、共通Reorder状態、WordPress接続、RF入力Lifecycle、入力解釈、方向固有Resolution、既存Table Integration、反映経路選択、RF Apply Coordinationを分離する。

WordPress Reorder IntegrationはRF入口を既存のRow / Column入口と同じ操作群へ接続する。RF開始時に同一TableのReorder Modeを`edit`へ戻し、その後RF Interactionを開始する。RFはReorder Modeの新しい方向として保持しないため、RF終了後も過去のRow / Columnモードは復元しない。

RF Interactionは対象Tableと利用者入力を所有する。RowではRow Table Integrationから現在行数を取得して入力範囲を成立させ、ColumnではColumn Table Integrationから最小列記述を取得して選択肢を成立させる。対応Table Blockの保存属性そのものはRFへ公開しない。

RF Input InterpretationはRF Interactionから現在の入力範囲と利用者入力を受け、Rowの1-based位置番号を範囲内の0-based位置へ変換する。Columnでは現在の選択肢から選ばれた論理列Identityを内部指定として扱う。Table構造上の移動可否は判断しない。

Row RF Resolutionは解釈済み行指定と上下指定を移動前Table基準の行間境界へ変換し、Row Table Integrationの現在構造から移動対象、移動先、結合セル制約、no-opを解決する。Column RF Resolutionも同様に、論理列指定と左右指定を移動前Table基準の列間境界へ変換し、Column Table Integrationの現在構造へ照合する。

方向固有Table IntegrationはRFのためにTableデータそのものを公開しない。Rowでは現在行数、行制約、構造診断、更新対象セル数、確定行移動を提供する。Columnではこれらに加えてRFの列選択肢を成立させる最小限の列記述を提供する。結合セルによる拒否理由は、PresentationがTableを再解析せず、DnDとRFの双方から同じ方向固有診断意味を利用できる形で提供する。

有効で実際に並び順が変わる候補について、RF Apply Coordinationは対応Table Integrationへ現在候補の再照合と更新対象セル数取得を要求し、Reorder Apply Policyへ反映経路選択を要求する。通常反映ではTable Integrationが更新要求時点でも候補成立を最終確認し、成立する場合だけ一回の確定更新を行う。

確認付き大規模反映では、RF Apply Coordinationが候補とRF Lifecycleを保持して`confirming`へ進む。WordPress Reorder Apply Integrationが確認UIを接続し、CancelではTableを変更せず入力を保持したRFへ戻る。Continueでは反映中表示を先に成立させた後、方向固有Table Integrationが現在Tableへ再照合し、成立する場合だけ更新する。更新後または更新不能時はediting surface restorationを経て、成功ならRFを終了し、失敗なら入力を保持したRFへ戻る。

Reorder GuidanceとReorder Guidance Integrationは既存の共通責務を維持する。Editor DOM Contextから現在の操作環境を解決し、WordPress PreferencesにPC / タッチ別の表示済み状態を保持する。RFは新しい案内状態を作らず、RF入口選択を既存共通案内の終了条件へ追加するだけとする。

### Process Flow Views

#### RF Reorder End-to-End {#PV_RF_REORDER_END_TO_END kind=normal}

RF開始から入力成立、方向固有の指定解決、反映経路選択、確定更新へ進む主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | normal | 対応TableのRF入口操作がWordPress接続境界へ入る。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | normal | RF開始前に同一Tableの方向固有Reorder Modeを終了する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | normal | 対象Table IdentityとともにRF入力Lifecycleを開始する。 |
| RESP_RF_INTERACTION | RESP_ROW_TABLE_INTEGRATION | normal | Row入力の表示範囲に必要な現在行数を取得する。 |
| RESP_RF_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | normal | Column入力の選択肢に必要な最小列記述を取得する。 |
| RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | normal | 現在の入力範囲と利用者入力を内部で解釈可能な指定へ変換する。 |
| RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | normal | Row選択時の解釈済み指定を行移動候補として解決する。 |
| RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | normal | Column選択時の解釈済み指定を列移動候補として解決する。 |
| RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | normal | 現在のtbody行制約と構造診断から行移動候補を解決する。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | normal | 現在の論理列制約と構造診断から列移動候補を解決する。 |
| RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | normal | 成立し並び順が変わる解決済み候補の反映を要求する。 |
| RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | normal | Row候補の現在Table再照合、更新対象セル数取得、確定更新を要求する。 |
| RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | normal | Column候補の現在Table再照合、更新対象セル数取得、確定更新を要求する。 |
| RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | normal | 再照合済み候補の更新対象セル数から反映経路を選択する。 |
| RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | normal | 確定結果をRF Lifecycleへ返し、成功時はRF終了、失敗時は入力画面復帰へ進める。 |

#### RF Large Apply {#PV_RF_LARGE_APPLY kind=normal}

確認付き大規模反映に選択された候補が、確認、反映中表示、現在Table再照合、editing surface restorationへ進む処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | normal | `confirming`または`applying`状態をWordPress Editor表示接続へ公開する。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | normal | 確認UI、反映中表示、およびediting surface restorationを対象Tableへ接続する。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | normal | Continue、Cancel、反映表示成立、表示復帰完了をRF Apply Lifecycleへ返す。 |
| RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | normal | RowのContinue後に現在Tableへ再照合し、成立時だけ確定更新する。 |
| RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | normal | ColumnのContinue後に現在Tableへ再照合し、成立時だけ確定更新する。 |
| RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | normal | 大規模反映の成功または失敗をRF入力Lifecycleへ返す。 |

#### RF Rejection and Recovery {#PV_RF_REJECTION_RECOVERY kind=failure-recovery}

入力不正、構造上の移動不可、no-op、確認Cancel、反映時再照合不成立、更新不能からTableを変更せずRFへ復帰する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_RF_INPUT_INTERPRETATION | RESP_RF_INTERACTION | recovery | 未入力または有効に解釈できない入力をTable更新なしで現在入力状態へ反映する。 |
| RESP_ROW_TABLE_INTEGRATION | RESP_RF_ROW_RESOLUTION | failure | Row候補を成立させない現在構造または結合セル診断を返す。 |
| RESP_RF_ROW_RESOLUTION | RESP_RF_INTERACTION | recovery | Rowの構造拒否またはno-opを入力画面の現在結果へ返す。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_COLUMN_RESOLUTION | failure | Column候補を成立させない現在構造または結合セル診断を返す。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_RF_INTERACTION | recovery | Columnの構造拒否またはno-opを入力画面の現在結果へ返す。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | recovery | 確認Cancelまたはediting surface restoration完了をRF Apply Lifecycleへ返す。 |
| RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | failure | Rowの反映直前再照合不成立または更新不能を返す。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | failure | Columnの反映直前再照合不成立または更新不能を返す。 |
| RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | recovery | Tableを変更しない失敗結果を入力保持したRFへ返す。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | edit / row / columnの排他状態、対象Table Identity、およびTable単位のモードLifecycleを所有する共通状態責務。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | 現在どのTableへどの操作環境の共通入口案内を表示しているかという一時状態を所有する共通状態責務。 |
| RESP_REORDER_APPLY_POLICY | Reorder Apply Policy | Table Integrationが算出した更新対象セル数だけから通常反映か確認付き大規模反映かを選択する共通方針責務。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のEditor DOM基準から、その表示環境に属するDOM / Web API contextを要求時点で解決する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | WordPress Reorder Integration | TableツールバーのRow / Column / RF入口、RF入力画面、Reorder ModeとRFの排他、および現在TableをWordPress Editorへ接続する。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | WordPress Reorder Apply Integration | Reorder Apply状態をWordPress Editorの確認、反映中表示、editing surface restorationへ接続する。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | Reorder Guidance Integration | 初回案内の表示契機、操作環境判定、WordPress Preferences永続化、およびRow / Column / RF入口選択による案内終了を接続する。 |
| RESP_RF_INTERACTION | RF Interaction | RFのopen / close、対象Table、方向、利用者入力、入力保持、および成功 / 失敗後の入力Lifecycleを所有する。 |
| RESP_RF_INPUT_INTERPRETATION | RF Input Interpretation | RFの利用者入力と現在入力範囲を方向固有Resolutionが解釈できる内部指定へ変換し、入力自体の有効性を判定する。 |
| RESP_RF_ROW_RESOLUTION | Row RF Resolution | `tbody`行のRF指定を現在Tableへ照合し、移動前基準の候補、構造拒否、no-opを解決する。 |
| RESP_RF_COLUMN_RESOLUTION | Column RF Resolution | 論理列のRF指定を現在Tableへ照合し、移動前基準の候補、構造拒否、no-opを解決する。 |
| RESP_RF_APPLY_COORDINATION | RF Apply Coordination | RF候補の反映経路選択、確認付き反映、Table Integrationによる反映直前再照合、成功 / 失敗、editing surface restorationまでのLifecycleを所有する。 |
| RESP_ROW_TABLE_INTEGRATION | Row Table Integration | 対応Tableの現在行数、行制約、構造診断、更新対象セル数、反映直前再照合、確定済み行移動、およびUndo境界を提供する。 |
| RESP_COLUMN_TABLE_INTEGRATION | Column Table Integration | 対応Tableの論理列制約、RF用列記述、構造診断、更新対象セル数、反映直前再照合、確定済み列移動、およびUndo境界を提供する。 |

### Ownership Boundaries

| ID | Name | Includes |
| --- | --- | --- |
| BOUNDARY_REORDER_COMMON | Reorder Common | RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_REORDER_APPLY_POLICY |
| BOUNDARY_EDITOR_INTEGRATION | Editor Integration | RESP_EDITOR_DOM_CONTEXT |
| BOUNDARY_WORDPRESS_REORDER | WordPress Reorder Integration | RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION |
| BOUNDARY_REORDER_FORM | Reorder Form | RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION |
| BOUNDARY_ROW_REORDER | Row Reorder | RESP_ROW_TABLE_INTEGRATION |
| BOUNDARY_COLUMN_REORDER | Column Reorder | RESP_COLUMN_TABLE_INTEGRATION |
| BOUNDARY_WORDPRESS_EXTERNAL | WordPress External | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のEditor DOM基準と同じ表示環境のcontextを解決するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | Tableツールバー、RF入力画面、現在TableのWordPress側Lifecycleへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | RF開始時の方向固有モード終了とRow / Column入口との排他を接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | RF入口から対象TableのRF Lifecycleを開始・終了し、RF表示状態をEditorへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 確認UI、反映中表示、更新後のediting surfaceをWordPress Editorへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | RFの確認付き反映状態をEditor表示へ接続し、Continue / Cancel / 表示復帰完了をLifecycleへ返すために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_EDITOR | 初回案内の表示契機とWordPress Editor上の表示位置を接続するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_PREFERENCES | PC / タッチごとの初回案内表示済み状態を永続化するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_EDITOR_DOM_CONTEXT | 現在のEditor DOMに対する操作環境を解決するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_GUIDANCE | 現在の共通入口案内状態を開始・終了するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_MODE | Row / Column入口選択を共通案内終了条件として扱うために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_RF_INTERACTION | RF入口選択を共通案内終了条件として扱うために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 現在の入力範囲と利用者入力を安全に解釈し、入力自体の有効性を判断するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | Row選択時の指定を現在Tableへ照合し、行移動候補を解決するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | Column選択時の指定を現在Tableへ照合し、列移動候補を解決するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 成立した解決済み候補を反映し、成功 / 失敗結果をRF Lifecycleへ反映するために必要とする。 |
| RESP_RF_INTERACTION | RESP_ROW_TABLE_INTEGRATION | Row入力範囲に必要な現在のtbody行数を取得するために必要とする。 |
| RESP_RF_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | Column入力選択肢に必要な最小列記述を取得するために必要とする。 |
| RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 要求時点のtbody行制約と構造診断から行移動候補を解決するために必要とする。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 要求時点の論理列制約と構造診断から列移動候補を解決するために必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 再照合済み候補の更新対象セル数から通常反映か確認付き大規模反映かを選択するために必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Row候補の更新対象セル数取得、反映直前再照合、確定行移動に必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Column候補の更新対象セル数取得、反映直前再照合、確定列移動に必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有のtbody構造取得と行順更新を行うために必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した一回の行移動を一回のUndo単位として維持するために必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有の論理列構造取得、列記述取得、列順更新を行うために必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 成立した一回の列移動を一回のUndo単位として維持するために必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_RF_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_REORDER_APPLY_POLICY RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION |
| DV_RF_EDITOR_INTEGRATION | Editor Integration | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION |
| DV_RF_RESOLUTION | RF Resolution | EXT_SUPPORTED_TABLE_BLOCK RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION |
| DV_RF_APPLY | RF Apply | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

通常編集、行並び替え、列並び替えの排他状態と、その並び替えモードが有効なTableを所有する。RF状態は所有しない。

##### State ownership

`edit | row | column`の排他状態と、`row | column`が関連付くTable Identityを所有する。RF open状態、RF入力、Table内容、方向固有制約を所有しない。

##### Contract

WordPress Reorder Integrationから入口選択、現在Table観測、RF開始前のモード終了を受ける。RF開始時は同一Tableに対する`row | column`状態を`edit`へ遷移させる。

##### Lifecycle

既存の`edit ↔ row | column`Lifecycleを維持する。RF開始は新しいモードへ遷移する操作ではなく、必要なら`edit`へ戻す操作として扱う。RF終了時に過去モードを復元しない。

##### Invariants

- 同時に有効な方向固有モードは一つだけとする。
- RFを`form`方向として保持しない。
- RF入力状態やRF Apply Lifecycleを所有しない。
- 過去のRF開始前モードを復元用状態として保持しない。

#### Reorder Guidance {#RESP_REORDER_GUIDANCE}

##### Responsibility

現在表示中の初回共通案内について、対象Tableと操作環境だけを共通状態として所有する。

##### State ownership

現在表示中の案内のTable Identityと`pc | touch`だけを所有する。PC / タッチごとの永続的な表示済み状態、WordPress Preferences、Reorder Mode、RF Sessionは所有しない。

##### Contract

Reorder Guidance Integrationから案内開始・終了を受け、現在表示中の共通案内状態だけを更新する。別Tableからの終了要求で現在の案内を誤って終了しない。

##### Lifecycle

案内開始で一時状態を生成し、利用者による案内終了、Row / Column入口選択、またはRF入口選択をReorder Guidance Integrationが検出した時点で終了する。

##### Invariants

- 永続的な表示済み状態を所有しない。
- Row / Column / RF固有状態を共通案内状態へ保持しない。
- 同じTable・同じ操作環境の案内を重複開始しない。

#### Reorder Apply Policy {#RESP_REORDER_APPLY_POLICY}

##### Responsibility

Row / Column / RFに共通する反映経路選択として、方向固有Table Integrationが算出した今回の更新対象セル数だけから通常反映または確認付き大規模反映のどちらを利用するか判断する。

##### State ownership

状態を所有しない。Table構造、RF入力、方向、移動元・移動先、Apply Lifecycle、WordPress表示状態を保持しない。

##### Contract

RF Apply Coordinationから更新対象セル数を受け、共通の性能上のPolicyに従って通常反映または確認付き大規模反映を返す。Table構造やRF指定の意味を解釈しない。

##### Lifecycle

一回の再照合済み候補について同期的に経路を選択し、結果を次の操作へ持ち越さない。

##### Invariants

- RF固有または方向固有の移動意味を所有しない。
- Apply状態を所有しない。
- Table Integrationが算出していない値から更新範囲を推測しない。
- 閾値を利用者向け固定要件として扱わない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のEditor DOMに属する基準要素から、その表示環境でDOM / Web APIを利用するためのcontextを解決する。

##### State ownership

解決結果をeditor lifecycleをまたぐcacheとして所有しない。Reorder Mode、Guidance、RF Session、Tableデータを所有しない。

##### Contract

現在の基準要素と同じ表示環境のcontextを安全に提供できる場合だけ返す。解決できない場合は以前のcontextまたは別Editor contextへfallbackしない。

##### Lifecycle

DOM / Web APIを必要とする時点で現在の基準要素から解決する。

##### Invariants

- iframe / non-iframeというEditor方式を利用側へ判定させない。
- 現在の基準とは異なるcontextをfallbackとして提供しない。
- context利用不能をRF内部Errorへ変換しない。

#### WordPress Reorder Integration {#RESP_WORDPRESS_REORDER_INTEGRATION}

##### Responsibility

Row / Column / RFの入口、RF入力画面、現在Table、および相互排他をWordPress Editorへ接続する。

##### State ownership

WordPress統合に必要な一時参照だけを扱い、Reorder Mode状態、RF Interaction状態、方向固有Table制約を重複所有しない。

##### Contract

対応TableのツールバーへRow / Column / RF入口を接続する。RF入口選択時は同一TableのReorder Modeを終了してからRF Interactionを開始する。RF Interactionの現在状態を入力画面へ反映し、利用者入力をRF Interactionへ接続する。RF表示中に同一TableのRow / Column DnDを同時に活動させず、Row / Column入口へ切り替える場合はRFを終了してから方向固有モードへ進む。

##### Lifecycle

対応TableのWordPress統合境界が存在する間、現在のReorder ModeとRF Interaction状態を反映する。統合境界の再生成だけをRFまたはReorder Mode終了条件にしない。

##### Invariants

- 排他状態をWordPress UIだけの別正本として所有しない。
- RFをReorder Modeの新方向として偽装しない。
- RF入力値または方向固有移動意味を別正本として所有しない。
- RF終了時に過去のRow / Columnモードを自動復元しない。

#### WordPress Reorder Apply Integration {#RESP_WORDPRESS_REORDER_APPLY_INTEGRATION}

##### Responsibility

RFを含むReorder Apply状態をWordPress Editorの確認UI、反映中表示、および更新後のediting surface restorationへ接続する。

##### State ownership

WordPress表示接続に必要な一時状態だけを扱い、RF Apply Coordination状態、確定済み移動意図、Table制約、RF入力を別正本として所有しない。

##### Contract

RF Apply Coordinationが`confirming`の場合は対象Tableの通常表示を維持したまま確認UIを提示し、Continue / Cancelを返す。`applying`では重いTable更新より先に対象Tableの編集を一時的に抑止して必要な反映中表示を成立させる。更新処理後はediting surfaceを再成立させ、表示復帰完了をRF Apply Coordinationへ返す。

##### Lifecycle

RF Apply Coordinationが確認付き反映Lifecycleにある期間だけApply表示接続を成立させる。Cancelでは確認表示を終了してRF入力へ戻し、Continueでは反映表示、更新、editing surface restorationを経て結果確定へ進む。

##### Invariants

- RF / Row / Column固有の移動意味や構造制約判定を所有しない。
- 確認UIや表示復帰だけでTableデータ更新またはUndo履歴を追加しない。
- 対象Table以外のブロック操作を不必要に妨げない。
- React固有のmount / unmount方式をArchitecture契約にしない。

#### Reorder Guidance Integration {#RESP_REORDER_GUIDANCE_INTEGRATION}

##### Responsibility

初回共通案内をWordPress Editor、Editor DOM Context、WordPress Preferences、Reorder Mode、およびRF入口へ接続する。

##### State ownership

PC / タッチごとの表示済み状態はWordPress Preferencesへ永続化し、自身は永続状態の別copyを所有しない。現在表示中状態はReorder Guidanceに委ねる。RF入力状態を所有しない。

##### Contract

現在のEditor DOMから操作環境を解決し、その操作環境で未表示の場合だけReorder Guidanceを開始する。利用者が案内を閉じる、Row / Column入口を選択する、またはRF Interactionが開始された場合は該当操作環境を表示済みとして保存して案内を終了する。

##### Lifecycle

案内の表示基準を現在のEditor環境で解決できる時点で表示条件を評価する。Row / Column DnDまたはRFが活動中に新しい案内を開始しない。

##### Invariants

- PC / タッチの表示済み状態を分離する。
- WordPress Preferencesの永続状態をReorder Guidance本体へ持ち込まない。
- Editor DOMを解決できない場合は誤った操作環境を推測して案内を開始しない。
- RFだけ別の初回案内永続状態を作らない。

#### RF Interaction {#RESP_RF_INTERACTION}

##### Responsibility

一つの対象Tableに対するRF入力Lifecycleを所有し、open / close、Row / Column選択、利用者入力、入力中の解決結果、Cancel、Apply要求、成功後終了、失敗後復帰を管理する。

##### State ownership

closedまたは一つのopen RF Sessionを所有する。open Sessionは対象Table Identity、現在方向、方向ごとの現在入力、および入力画面へ戻すために必要な一時状態を保持できる。Table構造、方向固有制約、更新対象セル数、Apply Policy、WordPress表示状態は保持しない。

##### Contract

WordPress Reorder Integrationから対象Table Identityを受けてRFを開始する。初期方向はRowとする。Row入力ではRow Table Integrationから現在行数を取得し、表示範囲と入力検証範囲としてRF Input Interpretationへ渡す。Column入力ではColumn Table Integrationから最小列記述を取得し、現在の選択肢として扱う。

入力変更時はRF Input Interpretationを利用し、必要な指定が解釈可能になった場合だけ現在方向のResolutionを要求する。Resolutionが成立し、no-opでない場合だけRF Apply Coordinationへ解決済み候補の反映を要求する。

方向変更時は切り替え前方向の入力エラー・構造拒否結果を現在表示へ持ち越さない。CancelではTableを更新せずRFを終了する。Apply成功ではRFを終了し、Apply失敗または大規模反映Cancelでは入力を保持したRFへ戻る。

##### Lifecycle

`closed → open(row) ↔ open(column) → applying → closed`を主Lifecycleとする。入力不正、構造拒否、no-opは`open`内の結果でありApply Lifecycleを開始しない。大規模反映Cancelまたは反映失敗では`open`へ戻る。

##### Invariants

- open RF Sessionは同時に一つだけ存在する。
- RF Sessionは必ず対象Table Identityを持つ。
- RF open中に同一Tableの方向固有DnDを並行して活動させない。
- 方向切り替え前のエラー・構造拒否結果を切り替え後方向の結果として表示しない。
- Table構造をSessionの永続snapshotとして保持しない。
- Supported Table Blockの保存表現を直接解釈しない。
- Table更新を直接行わない。

#### RF Input Interpretation {#RESP_RF_INPUT_INTERPRETATION}

##### Responsibility

RFの利用者入力とRF Interactionから渡された現在の入力範囲を方向固有Resolutionが扱える内部指定へ変換し、入力自体が未完成、有効、または有効に解釈不能かを判定する。

##### State ownership

状態を所有しない。利用者入力、エラー表示、Table構造、方向固有制約を保持しない。

##### Contract

Rowでは利用者向け1-based位置番号と現在の有効行数を受け、`1`から現在行数までの整数だけを内部の0-based位置へ変換する。ColumnではRF Interactionが現在の列記述から選択した論理列Identityを内部位置として受ける。未入力と不正入力を区別し、初期未入力だけを理由にエラー表示を要求しない。

##### Lifecycle

入力変更ごとに現在値と現在入力範囲を独立して解釈し、以前の解釈結果を次回判定へ持ち越さない。

##### Invariants

- Table Integrationを直接参照しない。
- Table構造上の移動可否を判定しない。
- 1-based表示値と0-based内部位置の境界を方向固有Resolutionへ漏らさない。
- 解釈不能入力から移動候補を推測しない。
- 入力値をTableデータとして扱わない。

#### Row RF Resolution {#RESP_RF_ROW_RESOLUTION}

##### Responsibility

解釈済みRow指定を要求時点の`tbody`構造へ照合し、並び替え前Table基準の確定可能な行移動候補、構造拒否、no-opを解決する。

##### State ownership

状態を所有しない。Table構造、入力、解決結果を要求間でcacheしない。

##### Contract

移動元行、移動先行、`above | below`を受け、Row Table Integrationから現在行制約と必要な構造診断を取得する。移動先行は並び替え前Table上の対象行として扱い、上下指定を移動前基準の行間境界へ変換する。入力解釈後にTable行数が変化している場合を含め、要求時点で移動元・移動先が実在することを現在制約へ照合する。結合セル制約により成立しない場合は、最初に確認されたblocking merged rangeを含む構造拒否結果を返す。実際の行順が変わらない指定はno-opとして返す。

##### Lifecycle

必要なRow指定が揃うたびに要求時点の現在Tableへ解決する。以前の解決結果を次回入力またはApply時の確定権威として持ち越さない。

##### Invariants

- `tbody`以外の行をRow RF対象にしない。
- 移動先行を移動元除去後indexとして解釈しない。
- `rowspan`等で構造を保持できない候補をresolvedにしない。
- no-opを確定候補として返さない。
- 拒否理由のためにPresentationへTable再解析を要求しない。
- Apply直前再照合の最終権威にならない。
- Column固有の論理列処理を共有しない。

#### Column RF Resolution {#RESP_RF_COLUMN_RESOLUTION}

##### Responsibility

解釈済みColumn指定を要求時点のTable全体の論理列構造へ照合し、並び替え前Table基準の確定可能な列移動候補、構造拒否、no-opを解決する。

##### State ownership

状態を所有しない。Table構造、列記述、入力、解決結果を要求間でcacheしない。

##### Contract

移動元列、移動先列、`left | right`を受け、Column Table Integrationから現在の論理列制約と必要な構造診断を取得する。移動先列は並び替え前Table上の対象列として扱い、左右指定を移動前基準の列間境界へ変換する。入力選択肢取得後にTable列構造が変化している場合を含め、要求時点で移動元・移動先が実在することを現在制約へ照合する。結合セル制約により成立しない場合は、最初に確認されたblocking merged rangeを含む構造拒否結果を返す。実際の列順が変わらない指定はno-opとして返す。

##### Lifecycle

必要なColumn指定が揃うたびに要求時点の現在Tableへ解決する。以前の解決結果を次回入力またはApply時の確定権威として持ち越さない。

##### Invariants

- Table全体で整合する論理列だけをColumn RF対象にする。
- 移動先列を移動元除去後indexとして解釈しない。
- `colspan` / `rowspan`を含む構造を保持できない候補をresolvedにしない。
- no-opを確定候補として返さない。
- 拒否理由のためにPresentationへTable再解析を要求しない。
- Apply直前再照合の最終権威にならない。
- Row固有処理を共有しない。

#### RF Apply Coordination {#RESP_RF_APPLY_COORDINATION}

##### Responsibility

RFで解決済みの方向固有候補について、現在Table再照合、更新対象セル数取得、反映経路選択、通常反映、確認付き大規模反映、成功 / 失敗結果、editing surface restoration完了までのRF固有Lifecycleを所有する。

##### State ownership

通常反映では長期状態を所有しない。確認付き大規模反映中だけ、一つの対象Table、方向、解決済み候補、および`confirming | applying | restoring`のLifecycle状態を所有できる。RF入力値、Table構造snapshot、WordPress表示状態は所有しない。

##### Contract

RF Interactionから方向固有の解決済み候補を一つ受ける。対応するTable Integrationへ現在候補の再照合と更新対象セル数取得を要求し、現在も成立する場合だけReorder Apply Policyで経路を選択する。現在Tableへ成立しない場合はTableを変更せず失敗結果を返す。

通常反映では、方向固有Table Integrationを最終権威として更新要求時点でも候補成立を確認し、成立する場合だけ一回の確定更新を要求する。確認付き大規模反映ではTableを更新せず`confirming`へ進む。CancelではTableを変更せずRF Interactionへ復帰結果を返す。ContinueではWordPress Reorder Apply Integrationが反映表示を成立させた後、方向固有Table Integrationへ現在候補の再照合と一回の確定更新を要求する。更新成否にかかわらずediting surface restoration後にRF Interactionへ成功または失敗を返す。

##### Lifecycle

通常反映は`request → revalidate → choose policy → apply → result`で完了する。確認付き大規模反映は`idle → confirming → applying → restoring → idle`をArchitecture上の意味として持つ。Cancelは`confirming → idle`、Continue後の再照合不成立または更新不能はTableを変更せず`applying → restoring → idle`へ進む。

##### Invariants

- 一つのApply Lifecycleで複数のRF候補を同時に保持しない。
- 確認中はTableを変更しない。
- 通常反映・確認付き反映のどちらも、方向固有Table Integrationによる反映直前の現在Table再照合なしに確定しない。
- 入力中のResolution結果を現在Table再照合の最終権威にしない。
- 再照合不成立または更新不能ではTableを変更しない。
- 成立した一回の移動を複数のWordPress更新またはUndo単位へ分割しない。
- DnD SessionまたはDnD InteractionをRF Apply Lifecycleへ持ち込まない。
- WordPress Editor表示の実装方式を所有しない。

#### Row Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility

対応Table Block固有の保存表現差を吸収し、RF Interaction / Row RF Resolution / RF Apply Coordinationへ現在の`tbody`行数、行制約、構造診断、更新対象セル数、反映直前再照合、および確定済み行移動の反映能力を提供する。

##### State ownership

Tableデータや解析結果を要求間でcacheしない。RF入力、RF Lifecycle、WordPress表示状態を所有しない。

##### Contract

指定Table Identityから要求時点の`tbody`行数と構造制約を取得する。構造拒否理由が結合セルの場合は、利用者が位置を識別できる最小の行・列範囲情報を方向固有診断として提供できる。解決済み候補について要求時点の現在Tableでも移動元・移動先・構造制約が成立するか再照合し、成立時は影響範囲の物理セル数を算出する。更新要求時点でも候補成立を最終確認し、成立した行移動だけを一回の属性更新として反映する。

##### Lifecycle

入力範囲取得、Resolution、更新対象セル数取得、反映直前再照合、確定更新の各要求時点で現在Tableを直接参照する。

##### Invariants

- 対応Table Block固有の属性名をRF責務へ公開しない。
- Tableデータ全体をRF UIへ公開しない。
- 構造診断をRF専用の表示文言として返さない。
- DnDとRFで異なる行構造ルールを持たない。
- Apply時の行構造成立性について最終権威を持つ。
- 一回の成立した行移動を一回のWordPress更新として反映する。

#### Column Table Integration {#RESP_COLUMN_TABLE_INTEGRATION}

##### Responsibility

対応Table Block固有の保存表現差を吸収し、RF Interaction / Column RF Resolution / RF Apply Coordinationへ現在の論理列制約、RF用列記述、構造診断、更新対象セル数、反映直前再照合、および確定済み列移動の反映能力を提供する。

##### State ownership

Tableデータや論理列解析結果を要求間でcacheしない。RF入力、RF Lifecycle、WordPress表示状態を所有しない。

##### Contract

指定Table Identityから要求時点のTable全体を同一論理列構造として解釈し、論理列数と構造制約を提供する。RF列選択肢には、論理列Identity、利用者向け列番号、および利用可能な場合の見出し表示値だけを最小列記述として提供する。構造拒否理由が結合セルの場合は、利用者が位置を識別できる最小の行・列範囲情報を方向固有診断として提供できる。解決済み候補について要求時点の現在Tableでも移動元・移動先・構造制約が成立するか再照合し、成立時は影響範囲の物理セル数を算出する。更新要求時点でも候補成立を最終確認し、成立した列移動だけを一回の属性更新として反映する。

##### Lifecycle

列選択肢取得、Resolution、更新対象セル数取得、反映直前再照合、確定更新の各要求時点で現在Tableを直接参照する。

##### Invariants

- Core Table / Flexible Table Block固有の保存表現をRF責務へ公開しない。
- RF列選択肢のためにTableデータ全体を公開しない。
- 構造診断をRF専用の表示文言として返さない。
- DnDとRFで異なる論理列構造ルールを持たない。
- Apply時の論理列構造成立性について最終権威を持つ。
- 一回の成立した列移動を一回のWordPress更新として反映する。
- Row固有処理と共通抽象化しない。

## 6. Runtime View

### RF open and direction switch {#RV_RF_OPEN_DIRECTION}

RF入口から同一TableのDnDモードを終了し、Row初期状態でRFを開始して、方向切り替えをRF Session内で処理する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者が対象TableのRF入口を選択する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | 同一Tableでrowまたはcolumnが有効なら`edit`へ終了する。 |
| 3 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 対象Table IdentityでRFを開始する。 |
| 4 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | Rowを初期方向とする現在RF状態を取得する。 |
| 5 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | Rowを初期方向とするRF入力画面を表示する。 |
| 6 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者がRow / Column方向を切り替える。 |
| 7 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在方向を切り替える。 |
| 8 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 新しい方向の入力状態を表示し、旧方向のエラー・構造拒否表示を終了する。 |

### RF row resolution {#RV_RF_ROW_RESOLUTION}

Row入力範囲を現在Tableから取得し、入力が揃った時点で移動前Table基準の行移動候補、構造拒否、no-opを解決する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在Tableの`tbody`行数を要求する。 |
| 2 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 要求時点の対応Tableから現在行数を取得する。 |
| 3 | RESP_ROW_TABLE_INTEGRATION | RESP_RF_INTERACTION | 現在行数を返す。 |
| 4 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者が移動元行、移動先行、上 / 下を入力する。 |
| 5 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在のRow入力をRF Sessionへ反映する。 |
| 6 | RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 現在行数とRow入力を解釈する。 |
| 7 | RESP_RF_INPUT_INTERPRETATION | RESP_RF_INTERACTION | 未完成、不正、または解釈済み0-based指定を返す。 |
| 8 | RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | 必要な指定が揃った場合だけRow候補の解決を要求する。 |
| 9 | RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 要求時点の`tbody`行制約と必要な構造診断を要求する。 |
| 10 | RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の対応TableからRow構造を解釈する。 |
| 11 | RESP_RF_ROW_RESOLUTION | RESP_RF_INTERACTION | resolved、blocking merged rangeを伴う構造拒否、またはno-opを返す。 |
| 12 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在の実行可否と理由状態を取得する。 |
| 13 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 現在結果に応じて実行可否と理由表示を更新する。 |

### RF column resolution {#RV_RF_COLUMN_RESOLUTION}

Column選択肢を現在Tableから取得し、入力が揃った時点で移動前Table基準の列移動候補、構造拒否、no-opを解決する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | 現在TableのRF用列記述を要求する。 |
| 2 | RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在のTable全体を論理列構造として解釈する。 |
| 3 | RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_INTERACTION | 列Identity、列番号、利用可能な見出し表示値を返す。 |
| 4 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者が移動元列、移動先列、左 / 右を選択する。 |
| 5 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在のColumn入力をRF Sessionへ反映する。 |
| 6 | RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 現在のColumn入力を解釈する。 |
| 7 | RESP_RF_INPUT_INTERPRETATION | RESP_RF_INTERACTION | 未完成または解釈済み論理列指定を返す。 |
| 8 | RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | 必要な指定が揃った場合だけColumn候補の解決を要求する。 |
| 9 | RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 要求時点の論理列制約と必要な構造診断を要求する。 |
| 10 | RESP_RF_COLUMN_RESOLUTION | RESP_RF_INTERACTION | resolved、blocking merged rangeを伴う構造拒否、またはno-opを返す。 |
| 11 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在の実行可否と理由状態を取得する。 |
| 12 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 現在結果に応じて実行可否と理由表示を更新する。 |

### RF normal apply {#RV_RF_NORMAL_APPLY}

小規模な解決済み候補を、方向固有Table Integrationを最終権威として現在Tableへ再照合し、一回の更新として確定する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者が実行可能な指定で並び替えを要求する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在のApply要求をRF Lifecycleへ渡す。 |
| 3 | RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 現在方向の解決済み候補を渡す。 |
| 4 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Rowの場合は現在Table再照合と更新対象セル数を要求する。 |
| 5 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Columnの場合は現在Table再照合と更新対象セル数を要求する。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 現在も成立する候補の更新対象セル数から反映経路を選択する。 |
| 7 | RESP_REORDER_APPLY_POLICY | RESP_RF_APPLY_COORDINATION | 通常反映を返す。 |
| 8 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Rowの場合は更新要求時点でも成立性を最終確認し、一回の確定行移動を要求する。 |
| 9 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Columnの場合は更新要求時点でも成立性を最終確認し、一回の確定列移動を要求する。 |
| 10 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 成功またはTable未変更の失敗結果を返す。 |
| 11 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | Apply後のRF状態と結果を取得する。 |
| 12 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 成功時はRFを終了して完了通知を表示し、失敗時は入力を保持したRFを表示する。 |

### RF large apply continue {#RV_RF_LARGE_APPLY_CONTINUE}

確認付き大規模反映でContinueされた候補を、反映表示成立後に方向固有Table Integrationで現在Tableへ再照合して確定し、editing surface restoration後に結果をRFへ返す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_REORDER_APPLY_POLICY | RESP_RF_APPLY_COORDINATION | 確認付き大規模反映を返す。 |
| 2 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | `confirming`状態を公開する。 |
| 3 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableを維持したまま確認UIを表示する。 |
| 4 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者がContinueを選択する。 |
| 5 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Continueを返す。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | `applying`状態を公開する。 |
| 7 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableの編集を抑止し、必要な反映中表示を先に成立させる。 |
| 8 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 反映表示成立を返す。 |
| 9 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Rowの場合は現在Tableへ再照合し、更新要求時点でも成立する場合だけ一回の行更新を要求する。 |
| 10 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Columnの場合は現在Tableへ再照合し、更新要求時点でも成立する場合だけ一回の列更新を要求する。 |
| 11 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | editing surface restorationへ進む。 |
| 12 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後または未変更のTable editing surfaceを再成立させる。 |
| 13 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 表示復帰完了を返す。 |
| 14 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 成功またはTable未変更の失敗結果を返す。 |
| 15 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 大規模反映後のRF状態と結果を取得する。 |
| 16 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 成功時はRFを終了し、失敗時は入力を保持したRFを表示する。 |

### RF large apply cancel {#RV_RF_LARGE_APPLY_CANCEL}

確認付き大規模反映をCancelした場合、Tableを変更せず入力を保持したRFへ戻る。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | `confirming`状態を公開する。 |
| 2 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableを維持したまま確認UIを表示する。 |
| 3 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者がCancelを選択する。 |
| 4 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Cancelを返す。 |
| 5 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | Table未変更のcancel結果を返す。 |
| 6 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 入力保持されたRF状態を取得する。 |
| 7 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 入力内容を保持したRF入力画面を表示する。 |

## 8. Crosscutting Concepts

### UI Position and Internal Position

利用者向け位置番号は1-basedとし、内部の方向固有Resolutionでは0-based位置を扱う。RF Interactionが現在行数または列記述を取得し、RF Input Interpretationが利用者入力を現在の入力範囲へ照合して内部位置へ変換する。Table IntegrationやApply Coordinationへ利用者向け番号体系を持ち込まない。

### Destination Target Semantics

移動先番号または列選択は、並び替え前Table上の対象行・対象列を識別する。Row / Column RF Resolutionが`above | below`または`left | right`を移動前基準の境界へ変換し、移動元除去後indexをUI意味へ逆流させない。

### Current Table Revalidation

入力中のResolution結果はApply時の確定権威ではない。通常反映・確認付き大規模反映のどちらでも、RF Apply Coordinationは方向固有Table Integrationへ現在候補の再照合を要求する。Table Integrationが現在の移動元、移動先、構造制約、および更新要求時点の成立性について最終権威を持ち、現在も成立する場合だけ更新する。

### Structural Rejection Diagnostics

結合セルによる移動不可は単なるbooleanやblocked boundaryだけでPresentationへ渡さず、原因となる最初のmerged rangeを利用者が識別できる方向固有診断として解決可能にする。診断はRF専用文言を返さず、Row / Column DnDでも同じ構造意味を再利用できる境界に置く。

RowとColumnの診断実装は独立させる。診断情報の共通化を理由に方向固有Table解析をshared abstractionへ統合しない。

### Minimal Table Read Contract

RF InteractionはSupported Table Blockの保存属性を直接解釈しない。Rowでは現在行数、Columnでは論理列Identity・列番号・利用可能な見出し表示値など、入力成立に必要な最小情報だけを方向固有Table Integrationから受け取る。方向固有Resolutionは構造判定に必要な現在制約をTable Integrationから要求し、RF入力用情報をTable snapshotとして保持しない。

### No-op

移動元と移動先の指定が有効でも順序が変わらない場合は、方向固有Resolutionがno-opとして解決する。no-opはApply Coordinationへ渡さず、Table更新およびUndo履歴を発生させない。

### Apply Policy and Long-running Apply

RF Apply Coordinationは方向固有Table Integrationへ現在候補の再照合と更新対象セル数取得を要求する。現在も成立する候補について、共通Reorder Apply Policyだけが通常反映または確認付き大規模反映を選択する。RF InteractionやWordPress表示層は独自の閾値判定を持たない。

### Input Trust Boundary

RFの利用者入力は内部位置として利用する前に解釈・範囲検証する。Rowの現在行数とColumnの現在列記述はRF Interactionが方向固有Table Integrationから取得し、RF Input Interpretationへ入力検証条件として渡す。解釈不能値を推測して移動候補へ変換しない。WordPress Editor内入力であっても、内部Contract成立前の値として扱う。

### Guidance Environment Boundary

RFは既存共通案内へ新しい入口として参加するだけであり、Guidanceの操作環境Contractを変更しない。Reorder Guidance IntegrationはEditor DOM Contextから現在の操作環境を解決し、WordPress PreferencesへPC / タッチ別の表示済み状態を保持する。RF入口選択時は現在の操作環境だけを表示済みにして共通案内を終了する。

### Undo Boundary

成立した一回のRF移動は方向固有Table Integrationが一回のWordPress属性更新として反映し、一回のUndo単位を維持する。確認、反映中表示、editing surface restoration、成功 / 失敗通知は追加のTableデータ更新を生成しない。

## 9. Architecture Decisions

### RF Architecture is Unified, Direction Logic is Separate

RFは一つの入口・入力画面・Lifecycleを持つためArchitecture文書をRow / Columnへ分割しない。一方、Row / Columnの位置意味、構造制約、Table更新は方向固有責務として維持する。文書統合を実装共通化の根拠にしない。

### RF is not a Reorder Mode Direction

Reorder Modeは既存の`edit | row | column`を維持する。RFはフォーム入力を伴う独立Workflowであり、方向固有DnDモードとはLifecycleが異なるため、`form`をReorder Modeへ追加しない。

### Reuse Table Integration, not DnD Interaction

RFは既存Row / Column Table Integrationの構造解釈・更新能力を再利用するが、DnD Session、物理入力、Destination Resolution、DnD Interactionを経由しない。RF固有Resolutionがフォーム指定を方向固有の候補へ直接変換する。

### RF Input Metadata Comes from Table Integration

RF InteractionがRowの現在行数とColumnの最小列記述を方向固有Table Integrationから取得し、RF Input Interpretationへ入力成立条件を渡す。RF Input Interpretation自身はTable Integrationへ依存せず、入力値の解釈と範囲検証だけを所有する。

### Apply Revalidation Uses Table Integration as Final Authority

方向固有Resolutionは入力中の構造解決とno-op判定を所有するが、Apply直前再照合の最終権威にはしない。RF Apply Coordinationは既存Reorder Applyと同じ責務境界に揃え、方向固有Table Integrationへ現在候補の再照合と確定更新を要求する。これによりResponsibility Details、Dependencies、Runtime Viewで再照合境界を一つにする。

### RF Owns its Apply Coordination

既存のRow / Column Reorder ApplyはDnD Session終了後の確認付き大規模反映として定義されている。RFは入力保持、Cancel後のフォーム復帰、成功時のRF終了、失敗時の再実行という固有Lifecycleを持つため、RF Apply Coordinationを独立責務とする。

共通Reorder Apply PolicyとWordPress Reorder Apply Integrationは重複させず再利用する。

### Shared Guidance Contract is Preserved

RFは既存Reorder Guidance / Reorder Guidance Integrationのstable IDとContractを維持する。操作環境、Editor DOM Context、PC / タッチ別Preferencesを削らず、RF入口選択だけを案内終了条件へ追加する。

### Structural Diagnostics are Reusable Capability

結合セル位置を示す拒否理由はRFだけのPresentation都合ではなく、方向固有Table構造から導かれる診断能力として扱う。これにより大規模TableでRow / Column DnDが移動不可理由を示す場合にも同じ診断意味を利用できる。

## 10. Quality Requirements

- **Correctness**: RF入力中の解決結果だけで更新せず、方向固有Table Integrationが反映直前の現在Tableへ再照合して成立する移動だけを確定する。
- **Data integrity**: 入力不正、構造拒否、no-op、Cancel、再照合不成立、更新不能ではTableデータを変更しない。
- **Consistency**: Row / Column DnDとRFは方向固有Table Integrationの同じ構造ルールと更新意味を利用する。
- **Usability**: 結合セルによる移動不可では、大規模Tableでも原因位置を識別できる構造診断をPresentationへ提供できる。
- **Responsiveness**: 更新対象セル数による共通Apply Policyを利用し、重い反映では確認と必要な反映中表示を適切なLifecycle境界で提供する。
- **Maintainability**: RF UI接続、入力解釈、方向固有Resolution、Table Integration、Apply Coordinationの責務を分離し、Row / Columnの方向固有実装を不用意に共通化しない。
- **Editor continuity**: RFの確認・反映中処理は対象Tableの競合編集を防ぎつつ、対象Table以外のブロック操作を不必要に妨げない。
- **Compatibility**: Core TableとFlexible Table Blockの保存表現差をTable Integration境界で吸収し、RF入力意味をBlock種別によって変更しない。
- **Guidance consistency**: RF追加によって既存のPC / タッチ別初回案内Contractを縮退させない。

## 11. Risks and Technical Debt

- 既存Row / Column Table Integrationは現在、RFが必要とするblocking merged range、RF入力用Row行数Contract、Column選択肢用の最小列記述、Apply Coordination向け再照合Contractをすべて同じ形で公開しているわけではない。実装時はTableデータ全体を公開せず、必要最小限の方向固有Contract拡張とする。
- 既存WordPress Reorder Apply IntegrationはDnD由来の方向固有Reorder Applyを主な利用者として成立している。RF Apply Coordinationを接続する際は、UI実装を複製せず、共通Editor統合Contractを保ったまま複数Apply sourceを扱えることを確認する。
- 結合セル診断をDnDへ適用する場合は、移動不可表示を過剰に更新しないPresentation方針が別途必要になる。診断能力と表示頻度を同じ責務へ混在させない。
- Column見出し表示はTable内容を利用者向けラベルへ投影するため、空見出し・重複見出し・結合セルを含む場合でも論理列Identityを失わないContractが必要になる。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| RF | Reorder Form。DnDを必要とせず、行または列と移動先を指定して並び替える独立した操作手段。 |
| RF Session | 一つの対象Tableに対してRFがopenしている間の入力Lifecycle。DnD Sessionとは別物。 |
| Reorder Mode | 通常編集、Row DnD、Column DnDの排他状態。RF状態は含まない。 |
| Row RF Resolution | Rowのフォーム指定を現在`tbody`構造へ照合し、候補、構造拒否、no-opへ解決する責務。 |
| Column RF Resolution | Columnのフォーム指定を現在論理列構造へ照合し、候補、構造拒否、no-opへ解決する責務。 |
| Move candidate | 方向固有Resolutionで入力時点の現在Tableに対して成立すると解決された、移動前Table基準の移動元と移動先境界。Apply時はTable Integrationが現在Tableへ再照合する。 |
| Blocking merged range | 指定移動を成立させない結合セルの行・列範囲を示す方向固有診断情報。Presentation文言そのものではない。 |
| Column descriptor | RF列選択肢を成立させるための論理列Identity、利用者向け列番号、利用可能な見出し表示値からなる最小情報。 |
| RF Apply Coordination | RF候補の通常反映・確認付き大規模反映・現在Table再照合・結果復帰を所有するLifecycle責務。 |