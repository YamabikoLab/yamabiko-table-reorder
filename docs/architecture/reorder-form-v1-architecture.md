# Reorder Form v1 Architecture

## 1. Introduction and Goals

本書は、Reorder Form（RF）v1を実現するための内部責務、境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

RFはDnDの補助機能ではなく、対応Tableの行または列をフォーム指定から直接並び替える独立した操作手段である。ArchitectureはRF全体を一つの文書で扱う一方、Row / Columnの位置意味、構造制約、確定更新は方向固有責務として分離する。

本書は現在の実装構造を写すものではない。source file、function、hook、component、Store、DOM手順等が変化しても維持すべき責務、状態所有、Contract、依存方向、Lifecycle、InvariantをArchitectureの正本とする。

## 2. Architecture Constraints

- RFは一つの入口と一つの入力Lifecycleを持ち、Row / ColumnをRF Interaction内の選択として扱う。
- Row / Columnの方向固有ResolutionとTable Integrationは分離し、方向固有処理を新しいshared reorder abstractionへ統合しない。
- Reorder Modeは`edit | row | column`の排他状態を維持し、RFを新しい方向として所有しない。
- RF開始時は同一TableのRow / Column Reorder Modeを終了し、RF終了時に以前のDnDモードを自動復元しない。
- RF open中は同一TableのRow / Column DnDを同時に活動させない。
- RF SessionはPresentation instanceの寿命ではなく、対象Tableと利用者操作Lifecycleに結び付く。同じ対象Tableの表示境界が再生成されても、それだけではRF Sessionを終了しない。
- RF Interactionは対象Table、選択方向、利用者入力、現在評価、および未提示のApply結果を所有する。Table構造、方向固有制約、更新対象セル数、WordPress表示状態は所有しない。
- RF open中に対象Tableが変化した場合、保持中の入力を現在Tableへ再評価する。過去のTable snapshotを成立保証として扱わない。
- RF Input Interpretationは入力成立性のみを扱い、Table構造制約、no-op、確定更新を所有しない。
- Row / Column RF Resolutionは要求時点の現在Tableへ指定を照合し、成立候補、no-op、構造拒否、利用不能を区別する。候補はApply時点の成立保証ではない。
- RFで扱う行・列位置は要求時点のcurrent logical positionであり、永続Row / Column Identityではない。
- Table IntegrationはCore TableとFlexible Table Blockの保存表現差を吸収し、方向固有の構造解釈、診断、Apply再照合、および確定更新の最終権威を持つ。
- RF Apply CoordinationはApply要求時に現在Tableへ候補を再照合し、Reorder Apply Policyにより通常反映または確認付き大規模反映を選択する。
- 通常反映でも、確定更新に成功した場合はWordPress側の表示復帰が完了するまでApply Lifecycleを終了しない。
- 確認付き大規模反映では確認、反映中表示、確定更新、表示復帰を一つのLifecycleとして調停する。
- WordPress Reorder Apply Integrationは確認、反映中表示、表示復帰を接続するが、Move意味、Table構造、候補成立性を再解釈しない。
- Row / Column / RFのactive Apply Lifecycleは同時に高々一つとする。WordPress Reorder Apply Integrationは複数Lifecycleの優先順位付けや仲裁を所有しない。
- Cancel、not-ready、no-op、構造拒否、利用不能、Apply再照合不成立、更新不能ではTableデータを変更しない。
- 成立した一回のRF並び替えは一回のWordPress更新および一回のUndo単位とする。
- Apply成功後はRFを終了する。Apply失敗では入力を保持したRFへ戻る。確認CancelはApply failureとは区別する。
- success / failureはPresentationへ一度だけ引き渡せるまでRF Interactionが保持する。Presentation instanceを結果の正本にしない。
- 対象Table以外のブロック操作をRFの確認または反映Lifecycleによって不必要に妨げない。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | 対応Tableの入口、RF入力画面、確認、反映中表示、通知、および通常編集環境を提供する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | Core TableまたはFlexible Table Blockとして、方向固有Table Integrationが構造取得と確定更新を行う対象を提供する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した一回のRF並び替えを一回のUndoで戻せる更新単位を提供する。 |
| EXT_WORDPRESS_PREFERENCES | WordPress Preferences | External Capability | PC / タッチごとの共通初回案内表示済み状態を永続化する。 |

RFはWordPress Editorから開始されるが、入力意味、方向固有Resolution、Table保存表現、Apply LifecycleをWordPress UIへ混在させない。対応Table Block固有の表現差は方向固有Table Integrationで吸収する。

## 4. Solution Strategy

RFは、共通Reorder状態、WordPress接続、RF Interaction、入力解釈、方向固有Resolution、方向固有Table Integration、共通Apply Policy、RF Apply Coordinationを分離する。

RF Interactionは対象Tableと利用者入力を所有し、入力時および対象Table変更時に現在Tableを基準として入力成立性とResolution結果を再評価する。Row / Column RF Resolutionは、解釈済み指定を要求時点のcurrent logical positionとして扱い、現在Tableへ安全に照合できない場合は候補を推測せず利用不能として返す。

解決済み候補は入力時点の候補にすぎない。RF Apply CoordinationはApply要求時に方向固有Table Integrationへ再照合と更新対象セル数取得を要求し、Reorder Apply Policyで反映経路を選択する。Table Integrationは確定更新直前にも現在Tableを最終確認する。

通常反映では一回の確定更新後、RF Apply Coordinationが表示復帰待ちを所有し、WordPress Reorder Apply Integrationが更新後のediting surfaceを再成立させる。表示復帰完了後にだけApply成功を確定し、RF Interactionへ返す。

確認付き大規模反映では、RF Apply Coordinationが確認待ち、反映準備、表示復帰までを所有する。確認中はTableを変更しない。Continue後は反映中表示を成立させてから現在Tableを再照合し、成立する場合だけ確定更新する。成功・失敗とも表示復帰完了後に結果を確定する。CancelはTableを変更せず入力画面へ戻る。

WordPress Reorder Apply Integrationは、RF Apply Coordinationが公開したApply状態、確認表示に必要な最小summary、および表示復帰位置をEditor Presentationへ接続する。内部boundaryやTable構造から利用者向けMove意味を再構成しない。

### Process Flow Views

#### RF Reorder End-to-End {#PV_RF_REORDER_END_TO_END kind=normal}

RF開始から現在Table上の指定解決、Apply経路選択、確定更新、表示復帰、結果通知へ進む主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | normal | 対応TableのRF操作がWordPress接続境界へ入る。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | normal | RF開始前に同一Tableの方向固有Reorder Modeを終了する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | normal | 対象TableとともにRF入力Lifecycleを開始・表示接続する。 |
| RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | normal | 現在の入力範囲 / 選択肢と利用者入力を内部指定へ解釈する。 |
| RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | normal | Row指定を要求時点の現在Tableへ解決する。 |
| RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | normal | Column指定を要求時点の現在Tableへ解決する。 |
| RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | normal | Row構造と診断を現在Tableから取得する。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | normal | Column構造と診断を現在Tableから取得する。 |
| RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | normal | 成立した候補の反映を要求する。 |
| RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | normal | 更新対象セル数から反映経路を選択する。 |
| RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | normal | Row候補の再照合と確定更新を要求する。 |
| RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | normal | Column候補の再照合と確定更新を要求する。 |
| RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | normal | Apply状態と表示復帰要求をWordPress表示接続へ公開する。 |
| RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | normal | 表示復帰後に確定したsuccess / failureをRF Lifecycleへ返す。 |

#### RF Rejection and Recovery {#PV_RF_REJECTION_RECOVERY kind=failure-recovery}

現在Tableで指定を安全に解決できない場合、構造拒否、no-op、Cancel、Apply再照合不成立、更新不能から安定したRF状態へ戻る処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_TABLE_INTEGRATION | RESP_RF_ROW_RESOLUTION | failure | Row指定を現在Tableへ安全に解決できない、または構造制約に抵触することを返す。 |
| RESP_RF_ROW_RESOLUTION | RESP_RF_INTERACTION | recovery | Rowの利用不能、構造拒否、no-opを現在RF状態へ返す。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_COLUMN_RESOLUTION | failure | Column指定を現在Tableへ安全に解決できない、または構造制約に抵触することを返す。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_RF_INTERACTION | recovery | Columnの利用不能、構造拒否、no-opを現在RF状態へ返す。 |
| RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | failure | Row候補のApply再照合不成立または更新不能を返す。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | failure | Column候補のApply再照合不成立または更新不能を返す。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | recovery | Cancelまたは表示復帰完了をRF Apply Lifecycleへ返す。 |
| RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | recovery | Tableを不完全に変更しないfailure、またはTable未変更のCancelをRFへ返す。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | edit / row / columnの排他状態と対象Tableを所有する共通状態責務。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | 現在どのTableへどの操作環境の共通入口案内を表示しているかという一時状態を所有する。 |
| RESP_REORDER_APPLY_POLICY | Reorder Apply Policy | 更新対象セル数から通常反映か確認付き大規模反映かを選択する共通方針責務。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のEditor DOM基準から同じ表示環境のDOM / Web API contextを要求時点で解決する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | WordPress Reorder Integration | Row / Column / RF入口、RF入力画面、現在Table、および相互排他をWordPress Editorへ接続する。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | WordPress Reorder Apply Integration | Reorder Apply状態を確認、反映中表示、表示復帰へ接続する。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | Reorder Guidance Integration | 共通初回案内をEditor環境、Preferences、および各Reorder入口へ接続する。 |
| RESP_RF_INTERACTION | RF Interaction | RF Session、対象Table、方向、利用者入力、現在評価、Apply要求、および未提示のApply結果を所有する。 |
| RESP_RF_INPUT_INTERPRETATION | RF Input Interpretation | 利用者入力と現在入力範囲 / 選択肢を解釈し、方向固有Resolution向け内部指定を生成する。 |
| RESP_RF_ROW_RESOLUTION | Row RF Resolution | Row指定を現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。 |
| RESP_RF_COLUMN_RESOLUTION | Column RF Resolution | Column指定を現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。 |
| RESP_RF_APPLY_COORDINATION | RF Apply Coordination | RF候補の再照合、反映経路選択、確認、確定更新、表示復帰、結果確定までのLifecycleを所有する。 |
| RESP_ROW_TABLE_INTEGRATION | Row Table Integration | 現在のRow構造、診断、Apply評価、および確定行移動の最終権威を提供する。 |
| RESP_COLUMN_TABLE_INTEGRATION | Column Table Integration | 現在のColumn構造、RF用列記述、診断、Apply評価、および確定列移動の最終権威を提供する。 |

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
| RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | Reorder入口、RF入力画面、現在TableのEditor接続に必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | RF開始時のDnDモード終了と入口排他に必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | RF Sessionと現在表示状態をEditorへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 確認、反映中表示、表示復帰をEditorへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | RF Apply状態、確認summary、表示復帰位置を利用するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_EDITOR | 初回案内をEditorへ接続するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_PREFERENCES | 操作環境別の案内済み状態を永続化するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_EDITOR_DOM_CONTEXT | 現在の操作環境を解決するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_GUIDANCE | 現在の共通案内状態を開始・終了するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_MODE | Row / Column入口選択を案内終了条件として扱うために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_RF_INTERACTION | RF入口選択を案内終了条件として扱うために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 現在入力を内部指定へ解釈するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | Row指定を現在Tableへ解決するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | Column指定を現在Tableへ解決するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 成立候補を反映しApply結果を受けるために必要とする。 |
| RESP_RF_INTERACTION | RESP_ROW_TABLE_INTEGRATION | Row入力範囲を現在Tableから取得するために必要とする。 |
| RESP_RF_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | Column入力選択肢を現在Tableから取得するために必要とする。 |
| RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 現在のRow構造と診断を利用するために必要とする。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 現在のColumn構造と診断を利用するために必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から反映経路を選択するために必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Row候補のApply評価と確定更新に必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Column候補のApply評価と確定更新に必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在のtbody構造取得と行順更新に必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 一回の成立した行移動を一回のUndo単位として維持するために必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在の論理列構造取得と列順更新に必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 一回の成立した列移動を一回のUndo単位として維持するために必要とする。 |

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

通常編集、Row DnD、Column DnDの排他状態と対象Tableを所有する。RF状態は所有しない。

##### State ownership

`edit | row | column`と方向固有モードが関連付くTable Identityを所有する。RF Session、RF入力、Apply Lifecycleを所有しない。

##### Contract

WordPress Reorder Integrationから入口選択とRF開始前のモード終了を受ける。RF開始時は同一Tableの方向固有モードを`edit`へ戻す。

##### Lifecycle

既存の`edit ↔ row | column`Lifecycleを維持する。RF終了時に過去モードを復元しない。

##### Invariants

- 同時に有効な方向固有モードは一つだけとする。
- RFを新しいReorder Mode方向として保持しない。

#### Reorder Guidance {#RESP_REORDER_GUIDANCE}

##### Responsibility

現在表示中の共通入口案内について対象Tableと操作環境だけを所有する。

##### State ownership

現在表示中のTable Identityと操作環境を所有する。永続的な表示済み状態やRF Sessionは所有しない。

##### Contract

Reorder Guidance Integrationから案内開始・終了を受け、現在表示中状態だけを更新する。

##### Lifecycle

利用者による案内終了、Row / Column入口選択、またはRF入口選択で終了する。

##### Invariants

- 永続状態を所有しない。
- Row / Column / RF固有状態を共通案内状態へ保持しない。

#### Reorder Apply Policy {#RESP_REORDER_APPLY_POLICY}

##### Responsibility

更新対象セル数から通常反映または確認付き大規模反映を選択する。

##### State ownership

状態を所有しない。Table構造、方向固有Move、Apply Lifecycleを保持しない。

##### Contract

RF Apply Coordinationから更新対象セル数を受け、共通性能Policyに従って反映経路を返す。

##### Lifecycle

一回のApply評価ごとに同期的に経路を選択する。

##### Invariants

- RF固有または方向固有のMove意味を解釈しない。
- Apply状態を所有しない。
- 閾値を利用者向け固定要件として扱わない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のEditor DOM基準から同じ表示環境のDOM / Web API contextを解決する。

##### State ownership

解決結果をEditor lifecycleをまたぐ正本として保持しない。

##### Contract

現在の基準要素と同じ表示環境のcontextを安全に提供できる場合だけ返す。

##### Lifecycle

DOM / Web APIを必要とする時点で解決する。

##### Invariants

- iframe / non-iframeというEditor方式を利用側へ判定させない。
- 異なるEditor contextへfallbackしない。

#### WordPress Reorder Integration {#RESP_WORDPRESS_REORDER_INTEGRATION}

##### Responsibility

Row / Column / RFの入口、RF入力画面、現在Table、および相互排他をWordPress Editorへ接続する。

##### State ownership

WordPress接続に必要な一時参照だけを扱い、Reorder Mode状態、RF Interaction状態、方向固有Table制約を重複所有しない。

##### Contract

RF入口選択時は同一TableのReorder Modeを終了してRF Interactionを開始する。RF Interactionの現在状態を入力画面へ反映し、利用者入力をRF Interactionへ接続する。Row / Column入口へ切り替える場合はRFを終了してから方向固有モードへ進む。

##### Lifecycle

対象TableのEditor接続が存在する間、現在のReorder ModeとRF Interactionを表示へ接続する。同じ対象Tableの表示境界の再生成だけではRF Sessionを終了しない。

##### Invariants

- 排他状態をWordPress UIだけの別正本として所有しない。
- RF入力や方向固有Move意味を別正本として所有しない。
- RF終了時に過去のDnDモードを自動復元しない。

#### WordPress Reorder Apply Integration {#RESP_WORDPRESS_REORDER_APPLY_INTEGRATION}

##### Responsibility

RFを含むReorder Apply状態をWordPress Editorの確認、反映中表示、および表示復帰へ接続する。

##### State ownership

表示接続に必要な一時状態だけを扱い、RF Apply Coordination、Move candidate、Table構造、RF入力を別正本として所有しない。

##### Contract

確認待ちではRF Apply Coordinationが公開する最小summaryを利用して確認UIを提示する。反映準備では重いTable更新より先に対象Tableの競合編集を抑止し、必要な反映中表示を成立させる。通常反映または大規模反映の確定更新後は、RF Apply Coordinationが公開する最終位置を利用してediting surfaceを再成立させ、表示復帰完了を返す。

##### Lifecycle

確認付き大規模反映では確認から反映準備、表示復帰までを接続する。通常反映では確定更新後の表示復帰を接続する。表示復帰完了後にだけRF Apply Coordinationが結果を確定できる。

##### Invariants

- RF / Row / Column固有のMove意味、候補成立性、Table構造を再解釈しない。
- 内部boundaryから確認用Move意味を再構成しない。
- 複数のactive Apply Lifecycleを仲裁または優先順位付けしない。
- 確認や表示復帰だけでTable更新またはUndo履歴を追加しない。
- 対象Table以外の操作を不必要に妨げない。
- 具体的なPresentation実装方式をArchitecture契約にしない。

#### Reorder Guidance Integration {#RESP_REORDER_GUIDANCE_INTEGRATION}

##### Responsibility

共通初回案内をWordPress Editor、Editor DOM Context、WordPress Preferences、Reorder Mode、およびRF入口へ接続する。

##### State ownership

永続的な表示済み状態はWordPress Preferencesへ委ね、現在表示中状態はReorder Guidanceへ委ねる。

##### Contract

現在の操作環境で未表示の場合だけReorder Guidanceを開始する。案内終了または各Reorder入口選択時に現在の操作環境を表示済みとして保存する。

##### Lifecycle

表示条件を現在のEditor環境で評価し、Row / Column DnDまたはRFが活動中に新しい案内を開始しない。

##### Invariants

- RFだけ別の初回案内永続状態を作らない。
- WordPress Preferencesの永続状態をReorder Guidanceへ持ち込まない。

#### RF Interaction {#RESP_RF_INTERACTION}

##### Responsibility

一つの対象Tableに対するRF Sessionを所有し、open / close、方向選択、利用者入力、現在評価、Apply要求、Apply結果の一度だけの引き渡しを管理する。

##### State ownership

closedまたは一つのopen RF Sessionを所有する。open Sessionは対象Table Identity、現在方向、方向ごとの入力、現在評価を保持する。success / failureはPresentationへ一度だけ引き渡されるまで未提示結果として保持できる。Table構造、更新対象セル数、WordPress表示状態は所有しない。

##### Contract

WordPress Reorder Integrationから対象Table Identityを受けてRFを開始する。Rowでは現在行数、Columnでは現在列記述を方向固有Table Integrationから取得してInput Interpretationへ渡す。入力が成立した場合だけ現在方向のResolutionを要求する。

RF open中に対象Tableが変化した場合、現在の入力範囲 / 選択肢を再取得し、保持中の入力を現在Tableへ再評価する。過去のResolution結果を現在Tableの成立保証として利用しない。

Resolutionが成立候補を返した場合だけApply要求を受理する。Apply中は同じSessionの入力変更や別Apply要求を受理しない。Apply成功ではRF Sessionを終了し、failureでは入力を保持したopen状態へ戻る。確認Cancelはfailure結果として通知せず、入力を保持したopen状態へ戻る。

##### Lifecycle

`closed → open(row) ↔ open(column) → applying`を主Lifecycleとする。successでは`closed`へ進み、failure / Cancelでは`open`へ戻る。not-ready、no-op、構造拒否、利用不能は`open`内の評価結果でありApply Lifecycleを開始しない。

##### Invariants

- open RF Sessionは同時に一つだけ存在する。
- RF Sessionは必ず対象Table Identityを持つ。
- RF Sessionの寿命をPresentation instanceの寿命に一致させない。
- RF open中に同一Tableの方向固有DnDを並行して活動させない。
- Table構造を永続snapshotとして保持しない。
- Table更新を直接行わない。
- success / failureを同じApplyについて複数回Presentationへ引き渡さない。
- Cancelをfailure通知として扱わない。

#### RF Input Interpretation {#RESP_RF_INPUT_INTERPRETATION}

##### Responsibility

利用者入力と現在入力範囲 / 選択肢を方向固有Resolutionが扱える内部指定へ変換する。

##### State ownership

状態を所有しない。利用者入力、Table構造、方向固有制約を保持しない。

##### Contract

Rowでは利用者向け行番号と配置位置を受け、現在行範囲へ安全に変換できる場合だけ内部位置を返す。Columnでは選択されたcurrent logical positionが現在列選択肢に存在する場合だけ内部指定を返す。未入力、不正値、現在選択肢に存在しない指定はResolutionへ進めない状態へ集約する。

##### Lifecycle

入力変更または現在入力範囲 / 選択肢変更ごとに独立して解釈する。

##### Invariants

- Table Integrationを直接参照しない。
- Table構造上の移動可否やno-opを判定しない。
- 解釈不能入力からMove candidateを推測しない。

#### Row RF Resolution {#RESP_RF_ROW_RESOLUTION}

##### Responsibility

解釈済みRow指定を要求時点の現在`tbody`へ照合し、成立候補、no-op、構造拒否、利用不能を解決する。

##### State ownership

状態を所有しない。Table構造、入力、解決結果を要求間でcacheしない。

##### Contract

移動元、移動先、配置位置をcurrent logical positionとして受け、Row Table Integrationの現在構造へ照合する。現在Tableを安全に取得・解析できない、または現在位置として照合できない場合は利用不能を返す。並び順が変わらない場合はno-opを優先し、実際に移動する候補だけ構造制約を評価する。成立候補はApply時点の保証ではない。

##### Lifecycle

入力成立時および現在Table再評価時に要求時点のTableへ解決する。

##### Invariants

- `tbody`以外の行を対象にしない。
- 行位置を永続Identityとして追跡しない。
- no-opを成立候補として返さない。
- 利用不能時に候補を推測しない。
- Apply直前再照合の最終権威にならない。

#### Column RF Resolution {#RESP_RF_COLUMN_RESOLUTION}

##### Responsibility

解釈済みColumn指定を要求時点の現在論理列構造へ照合し、成立候補、no-op、構造拒否、利用不能を解決する。

##### State ownership

状態を所有しない。Table構造、列記述、入力、解決結果を要求間でcacheしない。

##### Contract

移動元、移動先、配置位置をcurrent logical positionとして受け、Column Table Integrationの現在構造へ照合する。現在Tableを安全に取得・解析できない、または現在位置として照合できない場合は利用不能を返す。並び順が変わらない場合はno-opを優先し、実際に移動する候補だけ構造制約を評価する。成立候補はApply時点の保証ではない。

##### Lifecycle

入力成立時および現在Table再評価時に要求時点のTableへ解決する。

##### Invariants

- Table全体で整合する論理列だけを対象にする。
- 列位置を永続Identityとして追跡しない。
- no-opを成立候補として返さない。
- 利用不能時に候補を推測しない。
- Apply直前再照合の最終権威にならない。

#### RF Apply Coordination {#RESP_RF_APPLY_COORDINATION}

##### Responsibility

RFで解決済みの候補について、現在Table再照合、更新対象セル数取得、反映経路選択、確認、確定更新、表示復帰、success / failure確定までのLifecycleを所有する。

##### State ownership

一つのactive RF Applyだけを保持できる。確認付き大規模反映では確認待ち、反映準備、表示復帰を保持し、通常反映では確定更新成功後の表示復帰を保持する。候補、対象Table、方向、確認表示用summary、表示復帰位置をLifecycle完了まで保持できる。RF入力値、Table構造snapshot、WordPress Presentation状態は所有しない。

##### Contract

RF Interactionから成立候補を受け、方向固有Table Integrationへ現在Table上のApply評価を要求する。成立する場合だけReorder Apply Policyで反映経路を選択する。

通常反映では方向固有Table Integrationへ一回の確定更新を要求する。更新成功時は表示復帰状態へ進み、WordPress Reorder Apply Integrationから表示復帰完了を受けた後にsuccessを確定する。更新不成立ではTableを不完全に変更せずfailureを返す。

確認付き大規模反映ではTableを変更せず確認待ちへ進み、確認UIへ必要な最小の利用者向けMove summaryを提供する。Continue後はWordPress側の反映準備完了後に現在Tableを再評価し、成立する場合だけ一回の確定更新を要求する。成功・失敗とも表示復帰完了後に結果を確定する。CancelではTableを変更せずCancel結果を返す。

##### Lifecycle

通常反映は`idle → apply → restoring → idle`を意味上のLifecycleとする。確定更新前に失敗した場合は表示復帰を必要とせずfailureへ戻れる。確認付き大規模反映は`idle → confirming → applying → restoring → idle`とし、Cancelは`confirming → idle`とする。

##### Invariants

- 一つのRF Apply Lifecycleで複数候補を同時に保持しない。
- 確認中はTableを変更しない。
- 通常 / 大規模のどちらもTable Integrationによる現在Table再照合なしに確定しない。
- successは確定更新成功だけでは確定せず、必要な表示復帰完了後に確定する。
- 確認用summaryは確定済みMove意味から生成し、WordPress Presentationへ候補再解釈を要求しない。
- DnD SessionまたはDnD InteractionをRF Apply Lifecycleへ持ち込まない。
- WordPress Presentationの具体的実装方式を所有しない。

#### Row Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility

対応Table Block固有の保存表現差を吸収し、Row入力範囲、現在構造、構造診断、Apply評価、および確定行移動を提供する。

##### State ownership

Tableデータや解析結果を要求間の成立保証としてcacheしない。

##### Contract

要求時点の`tbody`構造を解釈し、RF入力範囲とResolution用制約を提供する。Apply評価では現在候補を再照合し、成立時に更新対象セル数と確定後位置を提供する。確定更新時も現在Tableを最終確認し、成立した行移動だけを一回のWordPress更新として反映する。

##### Lifecycle

入力範囲取得、Resolution、Apply評価、確定更新の各要求時点で現在Tableを参照する。

##### Invariants

- Table保存表現をRF責務へ公開しない。
- DnDとRFで異なるRow構造ルールを持たない。
- Apply時のRow構造成立性について最終権威を持つ。
- 一回の成立した行移動を一回のWordPress更新として反映する。

#### Column Table Integration {#RESP_COLUMN_TABLE_INTEGRATION}

##### Responsibility

対応Table Block固有の保存表現差を吸収し、RF用列記述、現在論理列構造、構造診断、Apply評価、および確定列移動を提供する。

##### State ownership

Tableデータや論理列解析結果を要求間の成立保証としてcacheしない。

##### Contract

要求時点のTableを論理列構造として解釈し、RF入力選択肢とResolution用制約を提供する。Apply評価では現在候補を再照合し、成立時に更新対象セル数と確定後位置を提供する。確定更新時も現在Tableを最終確認し、成立した列移動だけを一回のWordPress更新として反映する。

##### Lifecycle

列記述取得、Resolution、Apply評価、確定更新の各要求時点で現在Tableを参照する。

##### Invariants

- Table保存表現をRF責務へ公開しない。
- DnDとRFで異なるColumn構造ルールを持たない。
- Apply時のColumn構造成立性について最終権威を持つ。
- Row固有処理と共通抽象化しない。
- 一回の成立した列移動を一回のWordPress更新として反映する。

## 6. Runtime View

### RF open and direction switch {#RV_RF_OPEN_DIRECTION}

RF入口から同一TableのDnDモードを終了し、RF Sessionを開始して方向を切り替える。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者が対象TableのRF入口を選択する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | 同一Tableで方向固有モードが有効なら通常編集へ戻す。 |
| 3 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 対象TableでRF Sessionを開始する。 |
| 4 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 現在のRF入力状態を表示する。 |
| 5 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者がRow / Column方向を切り替える。 |
| 6 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在方向を切り替える。 |
| 7 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 新しい方向の現在状態を表示する。 |

### RF current-table reevaluation {#RV_RF_CURRENT_TABLE_REEVALUATION}

RF open中に対象Tableが変化した場合、保持中の入力を現在Table基準で再評価する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_SUPPORTED_TABLE_BLOCK | RESP_WORDPRESS_REORDER_INTEGRATION | 対象Tableの現在内容または構造が変化する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在Tableを基準とするRF評価更新を要求する。 |
| 3 | RESP_RF_INTERACTION | RESP_ROW_TABLE_INTEGRATION | Row選択時は現在行範囲を再取得する。 |
| 4 | RESP_RF_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | Column選択時は現在列記述を再取得する。 |
| 5 | RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 保持中の入力を現在範囲 / 選択肢へ再解釈する。 |
| 6 | RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | Rowのready指定を現在Tableへ再解決する。 |
| 7 | RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | Columnのready指定を現在Tableへ再解決する。 |
| 8 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 再評価後の実行可否と理由を表示する。 |

### RF resolution {#RV_RF_RESOLUTION}

成立した入力を要求時点の現在Tableへ照合し、Applyへ進めるかを解決する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者がRF入力を変更する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在入力をRF Sessionへ渡す。 |
| 3 | RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 現在入力を内部指定へ解釈する。 |
| 4 | RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | Rowのready指定を現在Tableへ解決する。 |
| 5 | RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 現在Row構造と診断を要求する。 |
| 6 | RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | Columnのready指定を現在Tableへ解決する。 |
| 7 | RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 現在Column構造と診断を要求する。 |
| 8 | RESP_RF_ROW_RESOLUTION | RESP_RF_INTERACTION | Rowの成立候補、no-op、構造拒否、利用不能を返す。 |
| 9 | RESP_RF_COLUMN_RESOLUTION | RESP_RF_INTERACTION | Columnの成立候補、no-op、構造拒否、利用不能を返す。 |
| 10 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 現在評価に応じて実行可否と理由を表示する。 |

### RF normal apply {#RV_RF_NORMAL_APPLY}

通常反映を一回の確定更新として実行し、成功時は表示復帰完了後に結果を確定する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者が成立候補の並び替えを要求する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | Apply要求をRF Sessionへ渡す。 |
| 3 | RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 現在の成立候補を渡す。 |
| 4 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Rowの場合は現在TableでApply評価を要求する。 |
| 5 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Columnの場合は現在TableでApply評価を要求する。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から反映経路を要求する。 |
| 7 | RESP_REORDER_APPLY_POLICY | RESP_RF_APPLY_COORDINATION | 通常反映を返す。 |
| 8 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Rowの場合は現在Tableを最終確認して一回の確定更新を要求する。 |
| 9 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Columnの場合は現在Tableを最終確認して一回の確定更新を要求する。 |
| 10 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 更新成功時に表示復帰を要求し、最終位置を公開する。 |
| 11 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後の対象Table editing surfaceを再成立させる。 |
| 12 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 表示復帰完了を返す。 |
| 13 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | successを返す。更新不成立時はTableを不完全に変更せずfailureを返す。 |
| 14 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | successではRFを終了して一度だけ通知し、failureでは入力を保持したRFと一度だけの失敗通知を表示する。 |

### RF large apply continue {#RV_RF_LARGE_APPLY_CONTINUE}

確認付き大規模反映でContinueされた候補を、反映表示成立後に現在Tableへ再照合し、表示復帰完了後に結果を確定する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_REORDER_APPLY_POLICY | RESP_RF_APPLY_COORDINATION | 確認付き大規模反映を返す。 |
| 2 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 確認状態と確認用Move summaryを公開する。 |
| 3 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableを維持したまま確認UIを表示する。 |
| 4 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者がContinueを選択する。 |
| 5 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Continueを返す。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 反映準備状態を公開する。 |
| 7 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableの競合編集を抑止し、反映中表示を成立させる。 |
| 8 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 反映準備完了を返す。 |
| 9 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Rowの場合は現在Tableを再評価し、成立時だけ一回の確定更新を要求する。 |
| 10 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Columnの場合は現在Tableを再評価し、成立時だけ一回の確定更新を要求する。 |
| 11 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | success / failureにかかわらず表示復帰を要求する。 |
| 12 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後または未変更のediting surfaceを再成立させる。 |
| 13 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 表示復帰完了を返す。 |
| 14 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | successまたはfailureを返す。 |
| 15 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | successではRFを終了し、failureでは入力を保持したRFを表示する。 |

### RF large apply cancel {#RV_RF_LARGE_APPLY_CANCEL}

確認付き大規模反映をCancelした場合、Tableを変更せず入力を保持したRFへ戻る。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 確認状態と確認用Move summaryを公開する。 |
| 2 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 確認UIを表示する。 |
| 3 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者がCancelを選択する。 |
| 4 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Cancelを返す。 |
| 5 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | Table未変更のCancelを返す。 |
| 6 | RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | 入力を保持したRFへ戻る。failure通知は表示しない。 |

## 8. Crosscutting Concepts

### Current Table Authority

RFはTable snapshotや永続Row / Column IDを成立保証として保持しない。Input Interpretation、Resolution、Apply評価、確定更新はそれぞれ要求時点の現在Tableを正本とする。

Row / Column位置はcurrent logical positionとして扱う。入力後にTableが変化しても過去対象との同一性を内容比較等で追跡せず、現在位置として安全に解釈できるかを再評価する。現在Tableへ安全に照合できない場合は候補を推測しない。

### UI Position and Internal Position

利用者入力とTable構造判定では内部位置を正本とする。入力時の1-based位置はInput Interpretation境界で内部位置へ変換する。

一方、確認Presentation向けにはRF Apply Coordinationが確定済みMove意味から最小限の利用者向け位置summaryを公開できる。WordPress Reorder Apply Integrationは内部boundaryからMove意味を再構成しない。表示復帰位置は内部位置として扱う。

### Destination Target Semantics

移動先指定は並び替え前Table上の対象行・対象列を意味する。方向固有Resolutionが配置指定を移動前基準の境界へ変換し、移動元除去後indexを入力意味へ逆流させない。

### Resolution Outcome Boundary

方向固有Resolutionは、入力成立後の結果として成立候補、no-op、構造拒否、利用不能を区別する。利用不能は対象Table不在、現在構造解析不能、source / targetを現在位置として照合不能等をArchitecture上で集約した意味であり、内部原因を利用者向けContractへ細分化しない。

### Apply Revalidation and Restoration

Resolution結果はApply時の確定権威ではない。RF Apply CoordinationはApply要求時にTable Integrationへ現在候補の再評価を要求し、Table Integrationは確定更新直前にも現在Tableを最終確認する。

通常反映と確認付き大規模反映は、成功時に共通の表示復帰契約へ合流する。Table更新成功だけではRF Apply successを確定せず、必要な表示復帰完了後に結果を確定する。

### Reorder Apply Exclusivity

Row / Column / RFのactive Apply Lifecycleは同時に高々一つとする。製品入口の排他接続がこのInvariantを保証し、WordPress Reorder Apply Integrationは競合時の優先順位付け、fallback、仲裁を所有しない。

### Completion Outcome

RF Interactionはsuccess / failureをPresentationへ一度だけ引き渡せるまで保持する。Presentation instanceの再生成によって結果を失ったり重複通知したりしない。確認Cancelはfailure通知と同一視しない。

### Structural Rejection Diagnostics

結合セルによる構造拒否は方向固有Table Integrationから診断データとして提供し、PresentationがTableを再解析しない。診断はRF専用文言ではなく、方向固有構造から導かれる意味として扱う。

### Minimal Table Read Contract

RF InteractionはSupported Table Blockの保存表現を直接解釈しない。Rowでは現在行数、Columnでは論理列位置、利用者向け列番号、利用可能な見出し等、入力成立に必要な最小情報だけを方向固有Table Integrationから受け取る。

### No-op

指定が成立していても順序が変わらない場合は方向固有Resolutionがno-opとして解決する。no-opはApply Coordinationへ渡さず、Table更新およびUndo履歴を発生させない。

### Undo Boundary

成立した一回のRF移動は方向固有Table Integrationが一回のWordPress更新として反映し、一回のUndo単位を維持する。確認、反映中表示、表示復帰、成功 / 失敗通知は追加のTableデータ更新を生成しない。

## 9. Architecture Decisions

### RF Architecture is Unified, Direction Logic is Separate

RFは一つの入口・入力Lifecycleを持つためArchitecture文書をRow / Columnへ分割しない。一方、方向固有の位置意味、構造制約、Table更新は独立責務として維持する。

### RF is not a Reorder Mode Direction

Reorder Modeは既存の`edit | row | column`を維持する。RFはフォーム入力を伴う独立Workflowであり、方向固有DnDモードとはLifecycleが異なるため、新しいReorder Mode方向を追加しない。

### Reuse Table Integration, not DnD Interaction

RFはRow / Column Table Integrationの構造解釈・更新能力を再利用するが、DnD Session、物理入力、DnD Interactionを経由しない。

### Current Table is the Authority

RF入力中の候補は過去snapshotや永続Row / Column Identityとして扱わない。ResolutionとApplyは要求時点の現在Tableを正本とし、Table Integrationを確定更新の最終権威とする。

### RF Owns its Apply Coordination

RFは入力保持、確認Cancel後のフォーム復帰、通常反映を含む表示復帰、成功時終了、失敗時再実行というLifecycleを持つため、RF Apply Coordinationを独立責務とする。共通Reorder Apply PolicyとWordPress Reorder Apply Integrationは重複させず再利用する。

### WordPress Apply Integration Does Not Interpret Move Meaning

WordPress Reorder Apply IntegrationはApply状態をPresentationへ接続するだけとし、RF candidate、方向固有Table構造、Move成立性を再解釈しない。確認に必要な利用者向けsummaryと表示復帰位置はApply責務から受け取る。

### Completion Outcome Survives Presentation Re-creation

Apply結果の正本をPresentation instanceへ置かない。success / failureはRF Interactionが一度だけ引き渡せるまで保持し、Cancelは完了失敗通知と区別する。

## 10. Quality Requirements

- **Correctness**: Resolution結果だけで更新せず、Table IntegrationがApply時の現在Tableへ再照合して成立する移動だけを確定する。
- **Data integrity**: not-ready、no-op、構造拒否、利用不能、Cancel、再照合不成立、更新不能では不完全なTable変更を残さない。
- **Consistency**: Row / Column DnDとRFは方向固有Table Integrationの同じ構造ルールと更新意味を利用する。
- **Lifecycle correctness**: 通常 / 大規模のどちらも必要な表示復帰完了後にsuccessを確定する。
- **Notification consistency**: success / failureを一回だけ通知し、Cancelをfailure通知として扱わない。
- **Maintainability**: RF UI接続、Interaction、入力解釈、方向固有Resolution、Table Integration、Apply Coordinationを分離し、現在のsource tree形状へArchitectureを固定しない。
- **Editor continuity**: 対象Tableの競合編集を防ぎつつ、対象Table以外の操作を不必要に妨げない。
- **Compatibility**: Core TableとFlexible Table Blockの保存表現差をTable Integration境界で吸収する。

## 11. Risks and Technical Debt

- Row / Column / RFのApply Lifecycle排他は製品入口のInvariantに依存する。新しいReorder入口を追加する場合は、WordPress Reorder Apply Integrationへ仲裁責務を追加するのではなく、入口側で同Invariantを維持する必要がある。
- current logical positionは永続Identityではないため、RF open中の外部変更後に「以前選択した内容そのもの」を追跡するContractは持たない。将来その要件を追加する場合は、位置ベースContractとは別の設計判断が必要になる。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| RF | Reorder Form。DnDを必要とせず、行または列と移動先を指定して並び替える独立した操作手段。 |
| RF Session | 一つの対象Tableに対してRFがopenしている間の入力Lifecycle。Presentation instanceの寿命とは独立する。 |
| Reorder Mode | 通常編集、Row DnD、Column DnDの排他状態。RF状態は含まない。 |
| Current logical position | 要求時点の現在Table上の0-based論理位置。永続Row / Column Identityではない。 |
| Move candidate | 方向固有Resolutionで要求時点の現在Tableに成立すると解決された候補。Apply時はTable Integrationが現在Tableへ再照合する。 |
| Unavailable | 現在Tableまたは指定位置を安全にResolution対象として利用できず、候補を生成しない状態。 |
| RF Apply Coordination | RF候補の再照合、反映経路選択、確認、確定更新、表示復帰、結果確定を所有するLifecycle責務。 |
