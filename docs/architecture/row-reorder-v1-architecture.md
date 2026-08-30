# Row Reorder v1 アーキテクチャ設計書

## 1. Introduction and Goals

本書は、`docs/requirements/reorder-v1-requirements.md`、`docs/requirements/reorder-v1-quality-requirements.md`、`docs/design/reorder-v1-design.md`を入力として、正式v1の行並び替えを実現するための内部責務、責務間の境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

本書は行並び替えだけを対象とする。対応Table Blockの正本は`FR-13`、Performance、Compatibility、Reliability / Robustnessの品質保証範囲は`QR-01`、`QR-02`、`QR-03`とする。

DOM / Web APIを利用するためのEditor環境差の解決は`editor-dom-context.md`で定義するEditor DOM Contextを利用する。

Keyboard操作、ドラッグを必要としない操作、focus、announcement、支援技術への情報提供など、基本設計書で対象外としているアクセシビリティ設計は本書でも対象外とする。

本書では実装単位ではなく、行並び替えを成立させるArchitecture上の責務と協調を扱う。責務名およびIDはソースファイル、関数、クラスなどの実装識別子を意味しない。

## 2. Architecture Constraints

- PCとタッチ端末で、入力成立方法の違いをDnD Interaction以降へ持ち込まない。
- `FR-13`で定義される対応Table Blockの違いはTable Integrationの境界内に隠蔽する。
- Table IntegrationはTableデータ、DnD状態、Reorder Session、並び替え制約を要求間で保持しない。
- DnD開始試行では、Reorder Target Resolutionが要求時点のTable情報から移動対象可否を判定し、そのDnDで必要な行制約情報を導出する。
- 導出した行制約情報は、成立したReorder Sessionが1回のDnD中だけ保持し、DnDをまたいで再利用しない。
- Drop Target ResolutionはDnD Interactionから渡された判定入力だけを利用し、Table全体の構造を再解析しない。
- 行DnDの移動対象と構造保持範囲はTableのbody section内とする。
- 行並び替えでは縦結合に由来する制約を扱う。結合範囲を越える移動自体は禁止せず、縦結合を分断する移動だけを禁止する。
- `QR-01`のPerformanceを実現するため、Table全体を並び替え用の中間構造として常駐させず、セル数に比例する並び替え用中間オブジェクトをDnDをまたいで保持しない。
- DOM / Web APIを利用する責務はEditor DOM Contextが提供する現在のeditor contextを利用する。
- Editor DOM Contextが提供するcontextはeditor lifecycleをまたいで有効であることを前提にしない。
- DnD中はTable上の実際の行順序を変更しない。
- Tableデータを変更するのは、有効な移動先でDnDが完了した場合だけとする。
- 1回の成立した行並び替えは1回のUndoで並び替え前へ戻せる更新とする。
- 並び替えで変更するのは行の位置だけとし、セルの内容、属性、装飾その他の保持すべき情報を維持する。
- 初回案内と再案内は通常のTable編集を妨げない。
- Reorder内部で正常に存在しない状態、外部環境の変化による処理不能、Reorder自身が成立させたContract / Invariantの不整合を同一の結果として扱わない。
- DnDを継続できない場合の復旧はDnD Interactionを中心とするabortへ合流し、Reorder SessionとDnDに属する一時状態を終了してidleへ戻す。
- abortはReorder Mode自体を終了せず、すでに開始されたData Updateに対する自動retryまたはrollbackを担わない。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | 行並び替えの入力、表示、およびEditor lifecycleを提供する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | `FR-13`で定義される対応Table Block。Table Integrationを介して行並び替えと接続する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | 行DnD中に縦方向へ自動スクロールする対象領域を提供する。 |
| EXT_EDITOR_DOM_CONTEXT | Editor DOM Context | External Architecture | 現在のEditorでDOM / Web APIを利用するためのcontextを提供する。 |

行並び替えArchitectureは、WordPress Editor、対応Table Block、Undo、Scroll Area、Editor DOM Contextと接続する。対応Table Blockの具体的な列挙とEditor環境の保証範囲は本書では再定義しない。

Table Integrationは対応Table Block固有のTable情報取得とデータ更新方法を境界内に隠蔽する。行並び替え側は、行の移動対象判定と構造保持に必要な情報だけを扱う。

Table構造に由来するDnD開始前の移動対象可否と、そのDnD中に使用する行制約情報はReorder Target Resolutionが開始試行時に解決する。DnD開始後の移動先可否はDrop Target Resolutionが、DnD Interactionから渡された行制約情報と現在の操作状態を利用して判定する。

Tableの実データ更新はDnD進行およびPresentationから分離し、確定した行並び替えだけをData UpdateがTable Integrationを通じて対象Tableへ反映する。

First-use GuidanceとReorder Rediscoveryは、WordPressの通常編集として成立する操作を尊重し、案内のために通常編集の成立を奪わない。

## 4. Solution Strategy

行並び替えは、Reorder Mode、Table Integration、Input Interaction、DnD Interaction、Reorder Target Resolution、Drop Target Resolution、Data Update、Reorder Presentation、Auto Scroll、First-use Guidance、Reorder Rediscoveryを独立したArchitecture責務として扱う。

Reorder Modeは通常編集と行並び替えの現在状態を管理する。Input Interactionはその状態のもとでPCとタッチ端末の入力差を吸収し、DnDの開始試行・進行・完了・キャンセルへ変換する。

DnD Interactionは入力方式に依存せず、行DnDの開始と進行を統括する。開始試行時にReorder Target Resolutionへ解決を要求し、移動可能な場合だけ、移動対象とそのDnDで利用する行制約情報を含むReorder Sessionを開始する。

Reorder Target ResolutionはDnD開始試行時にTable Integrationから要求時点のTable情報を取得し、body section内の対象行と縦結合に由来する制約を解決する。

DnD InteractionはReorder Sessionに保持した移動対象、行制約情報、現在位置をDrop Target Resolutionへ判定入力として渡す。Drop Target Resolutionはその入力だけからbody section内の有効な行間を判定する。

Reorder PresentationはTableデータとは分離して移動対象、挿入位置、周囲の行の表示変化、移動不可理由を扱う。Auto Scrollは行DnD中に必要な縦方向の自動スクロールを扱う。

有効な移動先で完了した場合だけDnD Interactionが確定した行並び替えをData Updateへ渡す。Data Updateはbody sectionの行順だけを変更する確定結果をTable Integrationへ1つの更新単位として反映要求する。キャンセルまたは無効な完了ではData Updateを動作させない。

DnD Interactionへ入る1回の開始試行・進行・完了・キャンセルをReorder operation boundaryとする。この境界内で処理を継続できない場合は、個別責務ごとの独自復旧を増やさず、DnD Interactionのabortへ合流する。

### Process Flow Views

#### Reorder End-to-End {#PV_REORDER_END_TO_END kind=normal}

行並び替えの入力から確定更新までの主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_INPUT_INTERACTION | normal | Editor入力が行並び替えの入力境界へ入る。 |
| RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | normal | 入力差を吸収した行DnD操作が進行する。 |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | normal | DnD開始試行時に移動対象可否と行制約情報を解決する。 |
| RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | normal | DnD進行中の移動先可否を判定する。 |
| RESP_DND_INTERACTION | RESP_DATA_UPDATE | normal | 有効な確定結果だけをTable更新へ進める。 |
| RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | normal | 確定した行並び替えを対応Table Blockへ反映する。 |

#### Reorder Failure and Recovery {#PV_REORDER_FAILURE_RECOVERY kind=failure-recovery}

行DnDを継続できない場合に、operation boundaryへ失敗を集約してidleへ復帰する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | failure | DnD開始を継続できない結果を境界へ返す。 |
| RESP_DROP_TARGET_RESOLUTION | RESP_DND_INTERACTION | failure | DnD進行を継続できない結果を境界へ返す。 |
| RESP_DATA_UPDATE | RESP_DND_INTERACTION | failure | 確定更新を完了できない結果を境界へ返す。 |
| RESP_DND_INTERACTION | RESP_DND_INTERACTION | recovery | Reorder Sessionと一時状態を破棄してidleへ復帰する。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | 通常編集と行並び替えの現在状態を管理する。 |
| RESP_TABLE_INTEGRATION | Table Integration | 対応Table Blockと行並び替えのTable情報・更新境界を担う。 |
| RESP_INPUT_INTERACTION | Input Interaction | PC / タッチ入力を行DnD操作へ変換する。 |
| RESP_REORDER_TARGET_RESOLUTION | Reorder Target Resolution | DnD開始対象可否と行制約情報を解決する。 |
| RESP_DROP_TARGET_RESOLUTION | Drop Target Resolution | 行DnD中の移動先可否を判定する。 |
| RESP_DND_INTERACTION | DnD Interaction | 行DnDの開始・進行・完了・キャンセルとReorder SessionのLifecycleを統括する。 |
| RESP_DATA_UPDATE | Data Update | 確定した行並び替えを対象Tableへ反映する。 |
| RESP_REORDER_PRESENTATION | Reorder Presentation | 移動対象、移動先、周囲の行の表示変化、移動不可理由を扱う。 |
| RESP_AUTO_SCROLL | Auto Scroll | 行DnD中の縦方向Auto Scrollを扱う。 |
| RESP_FIRST_USE_GUIDANCE | First-use Guidance | 初回に行並び替え機能と入口を認識できるようにする。 |
| RESP_REORDER_REDISCOVERY | Reorder Rediscovery | 必要時に行並び替え機能を再発見できるようにする。 |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_REORDER_MODE | EXT_WORDPRESS_EDITOR | 通常編集と行並び替えの入口をEditor環境内で管理するため。 |
| RESP_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Blockの現在情報と更新能力を利用するため。 |
| RESP_INPUT_INTERACTION | EXT_WORDPRESS_EDITOR | Editorから行並び替え入力を受け取るため。 |
| RESP_INPUT_INTERACTION | RESP_REORDER_MODE | 行並び替えが有効な状態かを必要とするため。 |
| RESP_INPUT_INTERACTION | EXT_EDITOR_DOM_CONTEXT | 現在のEditorで入力に必要なDOM / Web API contextを利用するため。 |
| RESP_DND_INTERACTION | RESP_REORDER_MODE | DnD開始時に行並び替えが有効な状態を必要とするため。 |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | DnD開始対象可否と行制約情報を必要とするため。 |
| RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | DnD進行中の移動先判定を必要とするため。 |
| RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | DnD状態と結果を利用者へ示すため。 |
| RESP_DND_INTERACTION | RESP_AUTO_SCROLL | DnD中の必要な自動スクロールを成立させるため。 |
| RESP_DND_INTERACTION | RESP_DATA_UPDATE | 有効な確定結果をTableへ反映するため。 |
| RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 要求時点のTable情報から移動対象と行制約を解決するため。 |
| RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定した行順変更を対応Table Blockへ反映するため。 |
| RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 1回の成立した行並び替えを1回のUndoで戻せる更新単位にするため。 |
| RESP_REORDER_PRESENTATION | EXT_WORDPRESS_EDITOR | 行並び替えの状態をEditor上で利用者へ示すため。 |
| RESP_REORDER_PRESENTATION | EXT_EDITOR_DOM_CONTEXT | 現在のEditorで表示に必要なDOM / Web API contextを利用するため。 |
| RESP_AUTO_SCROLL | EXT_EDITOR_DOM_CONTEXT | 現在のEditorでスクロール対象を扱うため。 |
| RESP_AUTO_SCROLL | EXT_SCROLL_AREA | 縦方向Auto Scrollの対象領域を必要とするため。 |
| RESP_FIRST_USE_GUIDANCE | RESP_REORDER_MODE | 通常編集と行並び替えへの移行状態を必要とするため。 |
| RESP_FIRST_USE_GUIDANCE | EXT_WORDPRESS_EDITOR | 初回案内をEditor上の通常操作と両立させるため。 |
| RESP_FIRST_USE_GUIDANCE | EXT_EDITOR_DOM_CONTEXT | 現在のEditorで案内表示に必要なcontextを利用するため。 |
| RESP_REORDER_REDISCOVERY | RESP_REORDER_MODE | 通常編集状態だけで再案内判定を行うため。 |
| RESP_REORDER_REDISCOVERY | EXT_WORDPRESS_EDITOR | 通常編集として成立する操作との区別にEditor環境を必要とするため。 |
| RESP_REORDER_REDISCOVERY | EXT_EDITOR_DOM_CONTEXT | 現在のEditorで再案内判定に必要なcontextを利用するため。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_DND_CORE | DnD Core | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA EXT_EDITOR_DOM_CONTEXT RESP_REORDER_MODE RESP_TABLE_INTEGRATION RESP_INPUT_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_DND_INTERACTION RESP_DATA_UPDATE RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL |
| DV_GUIDANCE | Guidance | EXT_WORDPRESS_EDITOR EXT_EDITOR_DOM_CONTEXT RESP_REORDER_MODE RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

通常編集と行並び替えの現在状態を管理する。

##### State ownership

現在が通常編集か行並び替えかという状態を所有する。Reorder Session、Table情報、Presentation状態は所有しない。

##### Contract

行並び替え入口の選択と並び替えモード終了を受け取り、現在の並び替え状態をInput InteractionとDnD Interactionへ提供する。

通常状態では行DnDを有効にしない。行並び替え状態ではDnDを開始可能な状態を提供する。個々の開始対象が実際に移動可能かは判定せず、Reorder Target Resolutionが保証する。

DnD Interactionがabortによりidleへ復帰しても、Reorder Mode自体は暗黙に変更しない。

##### Lifecycle

通常状態から開始する。行並び替え入口が選択されると行並び替え状態へ移行し、終了時は通常状態へ戻る。

DnDの完了、キャンセル、abortはReorder Sessionを終了するが、それだけを理由にReorder Modeを終了しない。

##### Invariants

- 通常状態では行DnDを有効にしない。
- 個々の行の移動対象成立可否を所有しない。
- Reorder Sessionの復旧によってReorder Modeを暗黙に変更しない。

#### Table Integration {#RESP_TABLE_INTEGRATION}

##### Responsibility

`FR-13`で定義される対応Table Blockと行並び替えの境界を担い、Block固有のTable情報取得およびデータ更新方法を行並び替えの内部責務から隠蔽する。

##### State ownership

状態を所有しない。Tableデータ、取得したTable情報、DnD状態、Reorder Session、行制約情報を要求間で保持しない。

##### Contract

対応可能なTableについて、要求時点の現在状態から行並び替えに必要なTable情報を提供する。

現在のTableが利用できない、外部データを安全に解釈できない、または現在の外部状態では更新できない場合は、不完全な情報や更新成功を返さず、呼び出し側が開始不可またはabortを判断できる境界結果を返す。これら外部状態の不在や変化自体をReorder内部のInvariant違反として扱わない。

確定した行並び替えの反映を要求された場合は、Block固有の方法で対象Tableのbody sectionの行順へ反映する。1回の確定した行並び替えを複数の独立した部分更新へ分割しない。

確定した行並び替えを反映する際は行の位置だけを変更し、セルの内容、属性、装飾その他の保持すべき情報を維持する。

##### Lifecycle

要求時に対象Tableの現在データを利用して情報取得または更新を行う。取得結果やTableデータを後続の要求へ持ち越さず、Tableの追加・削除・構造変更を監視しない。

更新開始後に外部環境の変化などによって処理を完了できない場合は、その結果をData Updateへ返し、rollbackやretryを自身のLifecycleとして開始しない。

##### Invariants

- 対応Table Block固有の構造表現やデータ操作方法を他の行並び替え責務へ漏らさない。
- 移動対象判定、行制約情報の導出、移動先判定を行わない。
- DnD状態またはReorder Sessionを所有しない。
- 取得したTable情報やTableデータを要求間で保持しない。
- 対応不能なTableに対して不完全な情報を提供しない。
- 1回の確定した行並び替えを複数の独立した部分更新として扱わない。

#### Input Interaction {#RESP_INPUT_INTERACTION}

##### Responsibility

PCとタッチ端末の入力差を吸収し、行DnDの開始試行・進行・完了・キャンセルへ変換する。

##### State ownership

入力成立に必要な一時状態だけを所有する。Reorder Session、移動対象、移動先、Tableデータは所有しない。

##### Contract

行並び替え状態でEditor入力を受け取り、成立した行DnD操作をDnD Interactionへ提供する。

PCとタッチ端末それぞれの入力成立条件をこの境界内で扱い、DnD Interactionには入力方式固有の意味を要求しない。

DnD開始前に通常編集または通常スクロールとして成立すべき操作は、その成立を不必要に妨げない。

##### Lifecycle

入力開始からDnD Interactionへの引き渡し、通常操作としての成立、または入力キャンセルまで一時状態を保持する。Editor lifecycleの変化によって現在のcontextを利用できなくなった場合は、その入力系列を終了する。

##### Invariants

- PCとタッチ端末の入力成立方法の違いをDnD Interactionへ持ち込まない。
- Reorder Sessionを所有しない。
- DnD開始前の通常編集・通常スクロールを不必要に妨げない。
- Editor DOM Contextのcontextをeditor lifecycleをまたいで保持しない。

#### Reorder Target Resolution {#RESP_REORDER_TARGET_RESOLUTION}

##### Responsibility

DnD開始試行時に、Tableのbody section内の対象行が移動可能かを判定し、そのDnDで必要な行制約情報を導出する。

##### State ownership

状態を所有しない。導出した行制約情報のLifecycleは所有しない。

##### Contract

開始対象と要求時点のTable情報を利用し、移動可能な行とそのDnDで必要な行制約情報、または開始不可理由を提供する。

縦結合に由来する構造保持上の制約を解決し、移動対象が成立しない場合はDnDを開始しないための理由を提供する。

##### Lifecycle

DnD開始試行ごとに現在のTable情報を用いて実行し、結果を返した時点で終了する。導出結果を次のDnDへ持ち越さない。

##### Invariants

- Tableのbody section内の行だけを移動対象として扱う。
- 縦結合に由来する行制約だけを扱う。
- 行制約情報をDnD間で保持しない。
- 移動先の現在位置に基づく判定を所有しない。

#### Drop Target Resolution {#RESP_DROP_TARGET_RESOLUTION}

##### Responsibility

行DnD中の現在位置と行制約情報から、body section内の有効な移動先を判定する。

##### State ownership

状態を所有しない。Reorder SessionやTable情報を保持しない。

##### Contract

DnD Interactionから移動対象、行制約情報、現在位置など判定に必要な値だけを受け取り、body section内の有効な行間または無効結果を返す。

Table Integrationへ追加情報を要求せず、DnD開始時に成立した行制約情報を利用して判定する。

##### Lifecycle

DnD進行中の判定要求ごとに実行し、結果を返した時点で終了する。

##### Invariants

- Table全体の構造を参照または再解析しない。
- Reorder Session自体を参照しない。
- body section外を移動先として成立させない。
- 縦結合を分断する移動先を成立させない。

#### DnD Interaction {#RESP_DND_INTERACTION}

##### Responsibility

行DnDの開始・進行・完了・キャンセルとReorder SessionのLifecycleを統括する。Reorder operation boundaryとして、DnD継続不能時のFailure / Recoveryを集約する。

##### State ownership

成立した1回のDnD中だけ、移動対象、行制約情報、現在位置、現在の移動先などのReorder SessionとDnD一時状態を所有する。

##### Contract

Input Interactionから行DnD操作を受け取り、開始試行ではReorder Target Resolutionへ移動対象解決を要求する。移動可能な場合だけReorder Sessionを開始し、進行中はDrop Target Resolution、Reorder Presentation、Auto Scrollへ必要な状態を提供する。

有効な移動先で完了した場合だけ、確定した行並び替えをData Updateへ渡す。キャンセルまたは無効な完了ではTable更新を開始しない。

operation boundary内で処理を継続できない場合はabortへ合流し、Reorder SessionとDnD一時状態を破棄してidleへ戻る。

##### Lifecycle

idleから開始する。移動可能な開始対象が成立したときだけReorder Sessionを開始する。進行中は現在位置と移動先を更新し、完了、キャンセル、abortでSessionを破棄してidleへ戻る。

##### Invariants

- Reorder Sessionは1回の成立したDnDにだけ属する。
- DnD間でSessionまたは行制約情報を再利用しない。
- DnD中にTable上の実際の行順序を変更しない。
- 有効な完了だけをData Updateへ進める。
- Failure / Recoveryはoperation boundaryのabortへ合流する。
- abortによってReorder Modeを暗黙に終了しない。

#### Data Update {#RESP_DATA_UPDATE}

##### Responsibility

有効なDnD完了によって確定した行並び替えだけを、対象Tableのデータへ1つの更新単位として反映する。

##### State ownership

永続状態を所有しない。Reorder Session、Tableデータ、Presentation状態を保持しない。

##### Contract

確定した移動元と移動先を受け取り、Table Integrationを通じてbody sectionの行順だけを変更する。

1回の成立した行並び替えを1回のUndoで並び替え前へ戻せる更新単位として成立させる。

Table Integrationから更新不能結果を受けた場合は、独自にretryまたはrollbackを開始せず、operation boundaryが処理継続不能を扱える結果を返す。

##### Lifecycle

有効なDnD完了時だけ開始し、1回の更新要求が成功または失敗した時点で終了する。

##### Invariants

- キャンセルまたは無効な完了では動作しない。
- body sectionの行位置以外の保持すべき情報を変更しない。
- 1回の成立した行並び替えを複数の独立したUndo単位へ分割しない。
- 自動retryまたはrollbackを所有しない。

#### Reorder Presentation {#RESP_REORDER_PRESENTATION}

##### Responsibility

行DnDの移動対象、移動先、周囲の行の位置変化、移動不可理由を利用者へ示す。

##### State ownership

表示に必要な一時状態を所有する。Tableデータ、Reorder Session、行制約情報の正本は所有しない。

##### Contract

DnD状態、対象解決結果、移動先結果を受け取り、基本設計で定義された行並び替え表示を提供する。

移動不可の場合は、DnDを開始せずにその理由を利用者へ示せる表示状態を提供する。

##### Lifecycle

DnD開始または移動不可結果で必要な表示を開始し、完了、キャンセル、abort、または表示終了条件に合わせて一時表示を終了する。

##### Invariants

- DnD中にTableの実際の行順を変更しない。
- Tableデータを表示状態の正本として所有しない。
- Editor DOM Contextのcontextをeditor lifecycleをまたいで保持しない。

#### Auto Scroll {#RESP_AUTO_SCROLL}

##### Responsibility

行DnD中、現在位置に応じて必要な縦方向Auto Scrollを成立させる。

##### State ownership

Auto Scrollの進行に必要な一時状態だけを所有する。Reorder Session、Tableデータ、移動先判定は所有しない。

##### Contract

DnD Interactionから現在位置を受け取り、現在のEditor Scroll Areaに対して必要な場合だけ縦方向のAuto Scrollを進行させる。

##### Lifecycle

行DnD中だけ有効となり、完了、キャンセル、abort、またはscroll条件が成立しなくなった時点で終了する。

##### Invariants

- 縦方向だけをAuto Scrollの対象とする。
- DnD終了後にscroll処理を継続しない。
- Editor DOM ContextのcontextやScroll Areaをeditor lifecycleをまたいで有効とみなさない。

#### First-use Guidance {#RESP_FIRST_USE_GUIDANCE}

##### Responsibility

初めて利用する人が行を並び替えられることと、その入口を認識できるようにする。

##### State ownership

利用者についてPCとタッチ端末それぞれの初回案内表示済み状態と、現在の初回案内表示状態を所有する。Reorder Mode、Reorder Rediscovery、DnD状態は所有しない。

##### Contract

基本設計で定義された操作環境ごとの表示契機を受け取り、その操作環境で未表示なら行並び替えの入口を案内する。

行並び替え入口が選択された場合、または案内が閉じられた場合に案内を終了し、その操作環境を表示済みとして扱う。

##### Lifecycle

対象の操作環境で未表示の状態から、定義された表示契機によって表示状態になる。入口選択または案内を閉じる操作で表示を終了し、その操作環境を表示済みとする。

##### Invariants

- PCとタッチ端末の表示済み状態を独立して扱う。
- 初回案内は通常のセル編集を妨げない。
- 案内終了後も行並び替え入口そのものの利用可否を変更しない。
- Reorder Rediscoveryの再案内判定と一時状態を共有しない。

#### Reorder Rediscovery {#RESP_REORDER_REDISCOVERY}

##### Responsibility

初回案内表示済みの利用者が行並び替え機能を忘れている可能性がある場合に、通常編集を妨げず、行を移動しようとしていると判断できる操作の繰り返しから必要な再案内だけを成立させる。

##### State ownership

同じ行付近で繰り返された並び替え試行候補の一時的な履歴と、同じ状況で過度に再案内しないための抑制状態を所有する。初回案内表示済み状態、Reorder Mode、DnD状態、Tableデータは所有しない。

##### Contract

通常編集状態で、セル内容の編集、文字選択、通常スクロールなどとして成立しない、行を移動しようとする操作候補を受け取る。

同じ行付近で短時間に操作候補が繰り返され、行並び替えを試みていると判断できる場合だけ再案内を成立させる。一度だけの短いドラッグや通常の編集操作からは再案内を成立させない。

##### Lifecycle

初回案内表示済みかつ通常編集状態で、並び替え試行候補が現れた場合に判定用の一時状態を持つ。再案内成立、通常編集として成立する操作への移行、行並び替え状態への移行、または同じ判定系列として扱えない状態への変化に応じて不要な状態を破棄する。

##### Invariants

- 一度だけの短いドラッグから再案内を成立させない。
- セル内容の編集、文字選択、通常スクロールとして成立する操作を再案内の根拠にしない。
- 行並び替え状態では再案内判定を行わない。
- 再案内によって通常のTable編集を妨げない。
- 同じ状況で再案内を過度に繰り返さない。

## 6. Runtime View

### DnD start attempt {#RV_DND_START}

行DnD開始試行で、移動対象と行制約情報が成立してReorder Sessionが開始されるまでの協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 行DnD開始試行と開始対象を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | 移動可能な行と行制約情報の解決を要求する。 |
| 3 | RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 要求時点のTable情報を要求する。 |
| 4 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 移動対象と行制約情報が成立した結果を通知する。 |

### DnD progress {#RV_DND_PROGRESS}

成立したReorder Sessionを用いて、現在位置から移動先表示とAuto Scrollを更新する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnDの現在位置を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | 移動対象、行制約情報、現在位置に基づく移動先判定を要求する。 |
| 3 | RESP_DROP_TARGET_RESOLUTION | RESP_DND_INTERACTION | 現在の有効な移動先または無効結果を通知する。 |
| 4 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 現在の移動対象と移動先を表示へ反映する。 |
| 5 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | 現在位置に応じた縦方向Auto Scrollの進行を要求する。 |

### DnD complete {#RV_DND_COMPLETE}

有効な移動先で完了した行DnDを1回のTable更新として確定する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnD完了を通知する。 |
| 2 | RESP_DND_INTERACTION | RESP_DATA_UPDATE | 確定した移動元と移動先を渡す。 |
| 3 | RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | body sectionの行順変更を1つの更新単位として要求する。 |
| 4 | RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 成立した行並び替えを1回のUndoで戻せる更新単位として成立させる。 |
| 5 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 完了したDnDの一時表示を終了する。 |

### DnD Failure / Recovery {#RV_DND_FAILURE_RECOVERY}

DnDを継続できない場合に、operation boundaryへ失敗を集約しSessionと一時状態を破棄してidleへ戻る協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | DnD処理に必要な対象解決を要求する。 |
| 2 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 処理継続不能な結果を通知する。 |
| 3 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | activeな一時表示の終了を要求する。 |
| 4 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | activeなAuto Scrollの終了を要求する。 |
| 5 | RESP_DND_INTERACTION | RESP_DND_INTERACTION | Reorder SessionとDnD一時状態を破棄してidleへ復帰する。 |

## 8. Crosscutting Concepts

### Editor DOM Context

DOM / Web APIを利用する責務は`editor-dom-context.md`で定義するEditor DOM Contextを利用し、Editor環境差を独自に判定しない。提供されたcontextをeditor lifecycleをまたいで有効とみなさない。

### Table information and constraint lifecycle

Table Integrationが提供するTable情報は要求時点の現在状態を表し、要求間で保持しない。Reorder Target Resolutionが導出した行制約情報は成立したReorder Sessionだけが1回のDnD中に保持し、DnD終了後は破棄する。

### Failure / Recovery

内部Contract / Invariant違反と、Editor lifecycleやTable利用不能などの外部状態変化を区別する。DnD継続不能時はDnD Interactionのoperation boundaryへ合流し、Reorder Sessionと一時状態を終了して安全なidleへ戻す。

個々の内部責務は、Contract / Invariant違反を正常な不在結果へ変換して処理を継続しない。外部状態の正常な不在または変化は内部Invariant違反として扱わない。

### DnD-time data stability

DnD中はTableの実際の行順を変更しない。移動中のPresentationは一時表示として扱い、有効な完了時だけData UpdateがTableデータを変更する。

## 9. Architecture Decisions

### DnD開始時に行制約を確定する

移動対象可否とDnD中に必要な行制約情報は、Reorder Target ResolutionがDnD開始試行時のTable情報から導出する。

これにより、Drop Target ResolutionはDnD中にTable全体を繰り返し解析せず、Reorder Sessionに保持された制約情報だけを利用して移動先を判定できる。

### Table Integrationを外部Table境界とする

対応Table Block固有の構造取得と更新方法はTable Integrationに閉じ込める。その他の責務は対応Table Block固有の表現を前提とせず、行並び替えに必要な意味だけを扱う。

### DnD中はTableデータを変更しない

DnD中の移動対象・移動先・周囲の行の変化はPresentationとして扱い、有効な完了時だけData Updateが実データを更新する。

これにより、キャンセルや無効な移動による不要なTable更新を避け、1回の成立した行並び替えを1つの更新単位として扱う。

## 10. Quality Requirements

- `QR-01`のPerformanceを満たすため、DnDをまたいでTable全体の大規模な中間構造を保持せず、Drop Target ResolutionでTable全体を繰り返し解析しない。
- `QR-02`のCompatibilityを満たすため、Editor環境差はEditor DOM Contextへ委譲し、対応Table Block差はTable Integrationへ閉じ込める。
- `QR-03`のReliability / Robustnessを満たすため、外部状態変化と内部Invariant違反を区別し、DnD継続不能時はoperation boundaryから安全なidleへ復帰する。
- 有効な1回の行並び替えを1回のUndoで戻せる更新単位とし、セルの内容、属性、装飾その他の保持すべき情報を維持する。

## 11. Risks and Technical Debt

- WordPress Editorまたは対応Table Blockの外部Contractが変化した場合、Editor DOM ContextまたはTable Integrationの境界調整が必要になる可能性がある。変更をその境界へ閉じ込め、DnD責務へ外部表現を波及させないことを維持する。
- 大規模Tableで行制約情報が過剰な中間表現へ成長すると、DnD開始時間やSession保持量が増える可能性がある。行並び替えに必要な制約だけを保持する境界を維持する。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| Reorder Session | 1回の成立した行DnD中だけ保持する、移動対象、行制約情報、現在位置、移動先などの一時状態。 |
| 行制約情報 | Tableのbody sectionの有効な構造を維持するため、行DnD中の移動先判定に必要な情報。 |
| operation boundary | 1回のDnD開始試行、進行、完了、キャンセルにおける失敗処理と復旧を集約するDnD Interactionの境界。 |
| Table Integration | 対応Table Block固有のTable情報取得と更新方法を行並び替えの内部責務から隠蔽する境界。 |
