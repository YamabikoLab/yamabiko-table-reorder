# Reorder v1 アーキテクチャ設計書

## 1. Introduction and Goals

本書は、`docs/requirements/reorder-v1-requirements.md`、`docs/requirements/reorder-v1-quality-requirements.md`、`docs/design/reorder-v1-design.md`を入力として、Reorder v1を実現するための内部責務、責務間の境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

機能対象と対応するTable BlockはFunctional Requirementsに従い、対応するTable Blockの正本は`FR-13`とする。Performance、Compatibility、Reliability / Robustnessの品質保証範囲はQuality Requirementsの`QR-01`、`QR-02`、`QR-03`に従う。

Keyboard操作、ドラッグを必要としない操作、focus、announcement、支援技術への情報提供など、基本設計書で対象外としているアクセシビリティ設計は本書でも対象外とする。

本書では実装単位ではなく、正式v1の設計を成立させる責務とその協調を扱う。責務名およびIDはソースファイル、関数、クラスなどの実装識別子を意味しない。同じArchitecture責務を行並び替えと列並び替えがそれぞれ実現する場合も、そのことは実装共有を意味しない。

## 2. Architecture Constraints

- 行並び替えと列並び替えを同時に有効にしない。
- Editor DOM Contextは、行・列のどちらからも利用するEditor環境境界として共有する。
- Reorder Modeは、通常編集、行並び替え、列並び替えの排他状態を一つの責務として共有する。
- Table Integration、Input Interaction、DnD Interaction、Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Updateは、行並び替えと列並び替えでそれぞれ独立して実現できる責務とし、実装の類似だけを理由に共有抽象化を要求しない。
- PCとタッチ端末で、入力成立方法の違いを各方向のDnD Interaction以降へ持ち込まない。
- `FR-13`で定義される対応Table Block固有の構造取得およびデータ更新方法は、各方向のTable Integrationの境界内に隠蔽する。
- Table IntegrationはTableデータ、Table監視状態、DnD状態、Reorder Session、並び替え制約を所有しない。
- 行と列を束ねるTable構造表現をArchitecture上の前提としない。各方向のTable Integrationは、その方向の判定と更新に必要なTable情報だけを提供する。
- DnD開始試行では、各方向のReorder Target Resolutionが要求時点のTable情報から移動対象可否を判定し、そのDnDの移動先判定に必要な制約情報を導出する。
- 導出した制約情報は、その方向の成立したReorder Sessionが1回のDnD中だけ保持し、DnDをまたいで再利用しない。
- Reorder Sessionに行・列を識別するための方向値を保持することをArchitecture上の前提としない。方向は各実装境界で確定している。
- Drop Target ResolutionはDnD Interactionから渡された判定入力だけを利用し、Table全体の構造を参照または再解析しない。
- 行DnDの移動対象と構造保持範囲はTable本文の行とし、列DnDの移動対象と構造保持範囲はTable全体の列とする。
- 行並び替えでは縦結合、列並び替えでは横結合に由来する制約を扱う。結合範囲を越える移動自体は禁止せず、対象方向の結合を分断する移動だけを禁止する。
- `QR-01`のPerformanceを実現するため、Table全体を並び替え用の中間構造として常駐させず、セル数に比例する並び替え用中間オブジェクトをDnDをまたいで保持しない。
- DOM / Web APIを利用する責務は、`QR-02`で保証対象とするEditor環境の違いを直接扱わず、Editor DOM Contextが提供する現在のeditor contextを利用する。
- Editor DOM Contextが提供するcontextはeditor lifecycleをまたいで有効であることを前提にしない。
- DnD中はTable上の実際の行・列順序を変更しない。
- Tableデータを変更するのは、有効な移動先でDnDが完了した場合だけとする。
- 1回の成立した並び替えは1回のUndoで並び替え前へ戻せる更新とする。
- 並び替えで変更するのは行または列の位置だけとし、セルの内容、属性、装飾その他の保持すべき情報を維持する。
- 初回案内と再案内は通常のTable編集を妨げない。
- Reorder内部で正常に存在しない状態、外部環境の変化による処理不能、Reorder自身が成立させたContract / Invariantの不整合を同一の結果として扱わない。
- DnDを継続できない場合の復旧は、その方向のDnD Interactionが所有するabortへ合流し、Reorder SessionとDnDに属する一時状態を終了してDnD idleへ戻す。
- abortはReorder Mode自体を終了せず、すでに開始されたData Updateに対する自動retryまたはrollbackを担わない。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | `QR-02`で保証対象とする編集環境を提供する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | `FR-13`で定義される対応Table Block。各方向のTable Integrationを介して並び替え責務と接続する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | DnD中にTableまたは編集画面を必要な方向へ自動スクロールする対象領域を提供する。 |

YTRはWordPress Editor、`FR-13`で定義される対応Table Block、Undoの仕組み、およびTableや編集画面のスクロール領域と接続する。対応Table Blockの具体的な列挙と対応Editor環境の保証範囲は本書では再定義しない。

Editor DOM Contextは、現在のeditor contextに属する基準からDOM / Web APIを利用するためのcontextを解決する。この責務は行・列のどちらからも利用され、利用側へEditor環境ごとのbrowsing context差を持ち込まない。

Reorder Modeは通常編集、行並び替え、列並び替えの排他状態を所有し、選択されている方向の並び替えだけを開始可能にする。

その他の方向固有責務は、Architecture上では同じ責務名と協調関係で表すが、行並び替えと列並び替えがそれぞれ独立して実現する。Architecture図上の1つの責務要素は、行・列の共有実装を意味しない。

各方向のInput InteractionはWordPress編集環境から入力を受け、PCとタッチ端末の入力成立方法の違いをその方向の境界内で扱う。DnD Interactionへ渡した後は入力方式に依存しないDnD操作として扱う。

各方向のTable Integrationは、対応Table Block固有の構造取得およびデータ更新方法を隠蔽し、その方向のReorder Target ResolutionとData Updateに必要な情報と更新能力だけを提供する。行・列の両方を支える中間構造を要求しない。

Table構造に由来するDnD開始前の移動対象可否と、そのDnD中に使用する構造上の制約情報は各方向のReorder Target ResolutionがDnD開始試行時に解決する。行ではTable本文の行と縦結合、列ではTable全体の列と横結合を対象とする。

各方向のDnD Interactionは成立したReorder Sessionに移動対象、制約情報、現在の移動先を保持し、Drop Target Resolutionへ判定に必要な値だけを渡す。Drop Target ResolutionはReorder Session自体やTable全体の構造には依存しない。

Tableの実データ更新はDnDの進行およびReorder Presentationから分離し、確定した並び替えだけをData UpdateがTable Integrationを通じて対象Tableへ反映する。

First-use GuidanceとReorder Rediscoveryは、WordPressの通常編集として成立する操作を尊重し、並び替え案内のために通常編集の成立を奪わない。

## 4. Solution Strategy

Reorder v1は、editor DOM contextの解決、並び替えモード、外部Table Blockとのデータ境界、案内、入力解釈、DnD進行、開始対象と制約情報の解決、移動先判定、表示、自動スクロール、Tableデータ更新を別々のArchitecture責務として扱う。

Editor DOM ContextとReorder Modeは両方向で共有する。その他の方向固有責務は、同じArchitecture責務名を用いながら、行並び替えと列並び替えで独立して実現する。

Table Integrationは、行では行並び替えに必要なTable情報と行順更新能力を、列では列並び替えに必要なTable情報と列順更新能力を提供する。両方向のための統合的なTable表現は提供しない。

Input Interactionは、各方向についてPCとタッチ端末の入力差を吸収し、開始試行、進行、完了、キャンセルという入力方式に依存しない意味へ変換する。Input Interactionは並び替え方向をDnD Interactionへ渡さず、対応する方向の実装境界が方向を確定する。

DnD Interactionは、対応する方向がReorder Modeで有効な場合に、その方向のDnDの開始と進行を統括する。開始試行時に同じ方向のReorder Target Resolutionへ解決を要求し、移動可能な場合だけ、移動対象と制約情報を含むReorder Sessionを開始する。

Reorder Target ResolutionはDnD開始試行時に同じ方向のTable Integrationから現在のTable情報を取得する。行ではTable本文の行と縦結合に必要な情報、列ではTable全体の列と横結合に必要な情報だけを利用して、移動対象と制約情報を導出する。

DnD InteractionはReorder Sessionに保持した移動対象、制約情報、現在位置を同じ方向のDrop Target Resolutionへ渡す。Drop Target Resolutionはその入力だけから有効な移動先を判定し、Table IntegrationやTable全体の構造を再参照しない。

Reorder PresentationはTableデータとは分離して移動対象、挿入線、周囲の行または列の表示変化を扱う。Auto Scrollは行では縦方向、列では横方向の自動スクロールを扱う。

有効な移動先で完了した場合だけDnD Interactionが確定した並び替えをData Updateへ渡す。Data Updateは行ではTable本文の行順、列ではTable全体の列順を1つの更新単位として同じ方向のTable Integrationへ反映要求する。

各方向のDnD Interactionへ入る1回の開始試行・進行・完了・キャンセルを、その方向のReorder operation boundaryとする。外部環境の変化または内部不整合により処理を継続できない場合は、その方向のDnD Interactionが同じabort Contractへ合流させる。

### Process Flow Views

Process Flow ViewはArchitecture責務間の処理進行を示す。行・列で同じ責務構成を使うため図は1組とするが、各Edgeは共有実装を意味しない。

#### Reorder End-to-End {#PV_REORDER_END_TO_END kind=normal}

選択されている方向の入力から確定更新までの主要な処理進行を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_INPUT_INTERACTION | normal | WordPress Editorの入力が選択されている方向のInput Interactionへ入る。 |
| RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | normal | 入力方式固有の解釈から、その方向のDnD処理へ進む。 |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | normal | DnD開始試行から、その方向の移動対象と制約情報の解決へ進む。 |
| RESP_REORDER_TARGET_RESOLUTION | RESP_DROP_TARGET_RESOLUTION | normal | 解決された移動対象と制約情報を前提に、その方向の移動先判定へ進む。 |
| RESP_DROP_TARGET_RESOLUTION | RESP_DATA_UPDATE | normal | 有効な移動先でDnDが完了した場合、その方向の確定更新へ進む。 |
| RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | normal | 確定した並び替えを、その方向のTable更新境界へ渡す。 |
| RESP_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | normal | 対応Table Blockへ、そのBlock固有の方法でTableデータを反映する。 |

#### Reorder Input Failure and Recovery {#PV_REORDER_INPUT_FAILURE_RECOVERY kind=failure-recovery}

activeなDnD中にInput Interactionが処理を継続できなくなった場合の復旧進行を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | failure | 継続不能をその方向のReorder operation boundaryへ返す。 |
| RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | recovery | abortとしてDnD表示の一時状態を終了する。 |
| RESP_DND_INTERACTION | RESP_AUTO_SCROLL | recovery | abortとして自動スクロールの一時状態を終了する。 |
| RESP_DND_INTERACTION | RESP_INPUT_INTERACTION | recovery | abortとして入力解釈の一時状態を終了する。 |

#### Reorder Drop Target Failure and Recovery {#PV_REORDER_DROP_TARGET_FAILURE_RECOVERY kind=failure-recovery}

activeなDnD中にDrop Target Resolutionで内部Contract / Invariant不整合が検出された場合の復旧進行を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_DROP_TARGET_RESOLUTION | RESP_DND_INTERACTION | failure | 内部不整合をその方向のReorder operation boundaryへ返す。 |
| RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | recovery | abortとしてDnD表示の一時状態を終了する。 |
| RESP_DND_INTERACTION | RESP_AUTO_SCROLL | recovery | abortとして自動スクロールの一時状態を終了する。 |
| RESP_DND_INTERACTION | RESP_INPUT_INTERACTION | recovery | abortとして入力解釈の一時状態を終了する。 |

#### Reorder Data Update Failure and Recovery {#PV_REORDER_DATA_UPDATE_FAILURE_RECOVERY kind=failure-recovery}

Data UpdateでTable更新を継続または確認できなくなった場合の復旧進行を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_DATA_UPDATE | RESP_DND_INTERACTION | failure | 更新失敗をその方向のReorder operation boundaryへ返す。 |
| RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | recovery | abortとしてDnD表示の一時状態を終了する。 |
| RESP_DND_INTERACTION | RESP_AUTO_SCROLL | recovery | abortとして自動スクロールの一時状態を終了する。 |
| RESP_DND_INTERACTION | RESP_INPUT_INTERACTION | recovery | abortとして入力解釈の一時状態を終了する。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | 通常のTable編集、行並び替え、列並び替えの排他状態を管理する共有責務。 |
| RESP_FIRST_USE_GUIDANCE | First-use Guidance | 初回に並び替え機能と入口を認識できるようにする。 |
| RESP_REORDER_REDISCOVERY | Reorder Rediscovery | 通常編集状態で並び替えを試みる操作の繰り返しから、必要な再案内を成立させる。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のeditor contextで利用すべきDOM / Web API contextを解決する共有責務。 |
| RESP_TABLE_INTEGRATION | Table Integration | 対応Table Block固有のTable情報取得とデータ更新方法を方向固有責務から隠蔽する。 |
| RESP_INPUT_INTERACTION | Input Interaction | 各方向についてPCとタッチ端末の入力差を吸収し、DnD操作へ変換する。 |
| RESP_DND_INTERACTION | DnD Interaction | 各方向のDnD開始・進行・完了・キャンセルとReorder SessionのLifecycleを統括する。 |
| RESP_REORDER_TARGET_RESOLUTION | Reorder Target Resolution | 各方向のDnD開始対象可否と、そのDnDで必要な制約情報を解決する。 |
| RESP_DROP_TARGET_RESOLUTION | Drop Target Resolution | 各方向のDnD中の有効な移動先を、渡された判定入力だけから判定する。 |
| RESP_REORDER_PRESENTATION | Reorder Presentation | 各方向の移動不可理由、移動対象、移動先、周囲の表示変化をTable更新から分離して扱う。 |
| RESP_AUTO_SCROLL | Auto Scroll | 行では縦方向、列では横方向の自動スクロールを扱う。 |
| RESP_DATA_UPDATE | Data Update | 各方向の確定した並び替えを1つの更新単位としてTableへ反映する。 |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_FIRST_USE_GUIDANCE | EXT_WORDPRESS_EDITOR | 初回案内の表示契機となる編集環境の状態を必要とする。 |
| RESP_FIRST_USE_GUIDANCE | RESP_EDITOR_DOM_CONTEXT | 案内表示でDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_REORDER_REDISCOVERY | EXT_WORDPRESS_EDITOR | 通常編集と並び替え試行候補を区別する編集環境の情報を必要とする。 |
| RESP_REORDER_REDISCOVERY | RESP_EDITOR_DOM_CONTEXT | 再案内判定でDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_REORDER_REDISCOVERY | RESP_FIRST_USE_GUIDANCE | 初回案内済みであることを再案内判定の前提として必要とする。 |
| RESP_REORDER_REDISCOVERY | RESP_REORDER_MODE | 通常編集状態でだけ再案内判定を行うため、現在の並び替え状態を必要とする。 |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のeditor contextを解決するため、現在のWordPress Editorを必要とする。 |
| RESP_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有のTable情報取得とデータ更新を行うために必要とする。 |
| RESP_INPUT_INTERACTION | EXT_WORDPRESS_EDITOR | PCまたはタッチ端末の入力をDnD操作へ変換するため、編集環境の入力を必要とする。 |
| RESP_INPUT_INTERACTION | RESP_EDITOR_DOM_CONTEXT | 入力解釈でDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_INPUT_INTERACTION | RESP_REORDER_MODE | 対応する並び替え方向が有効かを確認するため、現在の並び替え状態を必要とする。 |
| RESP_DND_INTERACTION | RESP_REORDER_MODE | 対応する並び替え方向が有効な状態であることを必要とする。 |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | DnDを開始できる移動対象と、そのDnDで利用する制約情報の解決能力を必要とする。 |
| RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | 開始済みDnDの現在位置が有効な移動先かを判定する能力を必要とする。 |
| RESP_DND_INTERACTION | RESP_DATA_UPDATE | 確定した並び替えをTableデータへ反映する能力を必要とする。 |
| RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | その方向の移動対象判定と制約情報導出に必要な現在のTable情報を必要とする。 |
| RESP_REORDER_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 表示処理でDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_REORDER_PRESENTATION | RESP_DND_INTERACTION | 移動不可理由とDnD進行結果を表示状態へ反映するために必要とする。 |
| RESP_AUTO_SCROLL | RESP_DND_INTERACTION | activeなDnDとDnD終了状態を自動スクロール判断に必要とする。 |
| RESP_AUTO_SCROLL | RESP_EDITOR_DOM_CONTEXT | 自動スクロールでDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_AUTO_SCROLL | EXT_SCROLL_AREA | DnD中に必要な方向へスクロールできる外部領域を必要とする。 |
| RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定した並び替えを対応Table Block固有の方法で反映する能力を必要とする。 |
| RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 成立した1回の並び替えを1回で戻せる更新単位を維持するため、Undoの仕組みを必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA RESP_REORDER_MODE RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_EDITOR_DOM_CONTEXT RESP_TABLE_INTEGRATION RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_DATA_UPDATE |
| DV_EDITOR_INTERACTION | Editor Interaction | EXT_WORDPRESS_EDITOR RESP_EDITOR_DOM_CONTEXT RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_INPUT_INTERACTION RESP_REORDER_MODE |
| DV_DND_CORE | DnD | RESP_REORDER_MODE RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION |
| DV_TABLE_STRUCTURE | Table Structure | EXT_SUPPORTED_TABLE_BLOCK RESP_TABLE_INTEGRATION RESP_REORDER_TARGET_RESOLUTION |
| DV_DND_FEEDBACK | DnD Feedback | RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_EDITOR_DOM_CONTEXT EXT_SCROLL_AREA |
| DV_DATA_UPDATE | Data Update | RESP_DND_INTERACTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

通常のTable編集、行並び替え、列並び替えのいずれが現在有効かを管理する。並び替えの入口から状態を切り替え、利用者が現在のモードを確認できる状態を提供する。

##### State ownership

通常、行並び替え、列並び替えの現在状態を所有する。DnDの進行状態、移動対象、移動先、Reorder Session、Tableデータは所有しない。

##### Contract

「行を並び替え」「列を並び替え」の選択と並び替えモード終了を受け取り、現在の並び替え状態をInput InteractionとDnD Interactionへ提供する。

通常状態ではDnDを有効にしない。行並び替えモードでは行DnDを開始可能な状態を提供し、列並び替えモードでは列DnDを開始可能な状態を提供する。個々の開始対象が対象範囲に含まれるか、実際に移動対象として成立するかは判定せず、対応するReorder Target Resolutionが保証する。

DnD InteractionがabortによりDnD idleへ復帰しても、Reorder Mode自体は暗黙に変更しない。並び替えモードの切り替えまたは終了はReorder Mode自身のLifecycleとして扱う。

##### Lifecycle

通常状態から開始する。行または列の入口が選択されると対応する並び替えモードへ移行する。別方向の入口が選択された場合は選択された側へ切り替わり、終了時は通常状態へ戻る。

DnDの完了、キャンセル、abortはReorder SessionのLifecycleを終了するが、それだけを理由にReorder Modeを終了しない。

##### Invariants

- 同時に有効な並び替えモードは1つだけとする。
- 通常状態では行・列のDnDを有効にしない。
- 行並び替えモードでは列DnD、列並び替えモードでは行DnDを有効にしない。
- 個々の行または列の移動対象成立可否を所有しない。
- DnD Sessionの復旧によってReorder Modeを暗黙に変更しない。

#### First-use Guidance {#RESP_FIRST_USE_GUIDANCE}

##### Responsibility

初めて利用する人が行・列を並び替えられることと、その入口を認識できるようにする。

##### State ownership

PCとタッチ端末それぞれの初回案内表示済み状態と、現在の案内表示状態を所有する。Reorder Mode、Reorder Rediscovery、DnD状態は所有しない。

##### Contract

基本設計で定義された表示契機に基づき、未表示の操作環境で並び替え入口を案内する。入口選択または案内終了で表示済みとする。通常のTable編集を案内のために成立しなくしない。

##### Lifecycle

未表示から表示へ移行し、入口選択または案内終了で表示済みとなる。PCとタッチ端末の表示済み状態は独立して扱う。

##### Invariants

- 初回案内は通常のTable編集を妨げない。
- PCとタッチ端末で定義された表示契機の違いを維持する。
- Reorder Rediscoveryの再案内判定状態を所有しない。

#### Reorder Rediscovery {#RESP_REORDER_REDISCOVERY}

##### Responsibility

初回案内表示済みの利用者が並び替えを試みていると判断できる操作を繰り返した場合に、通常編集を妨げず必要な再案内を成立させる。

##### State ownership

再案内判定に必要な一時的履歴と抑制状態を所有する。初回案内表示済み状態、Reorder Mode、DnD状態、Tableデータは所有しない。

##### Contract

通常編集状態で、通常編集として成立しない並び替え試行候補を受け取り、基本設計で定義された条件を満たす場合だけ再案内を成立させる。

##### Lifecycle

初回案内表示済みかつ通常編集状態で候補が現れたときだけ判定状態を持ち、再案内成立または判定系列終了で破棄する。

##### Invariants

- 一度だけの短いドラッグから再案内を成立させない。
- 通常編集として成立する操作を再案内の根拠にしない。
- 並び替えモード中は再案内判定を行わない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のeditor contextに属する基準から、その時点でDOM / Web APIを利用するために必要なeditor DOM contextを解決し、必要とする責務へ提供する。

##### State ownership

並び替え状態、Reorder Mode、Reorder Session、Tableデータ、移動対象、移動先、Presentation状態を所有しない。解決したcontextをeditor lifecycleをまたぐ永続状態として所有しない。

##### Contract

DOM / Web APIを必要とする責務が現在のeditor contextを利用する時点で、その時点で利用すべきeditor DOM contextを解決して提供する。安全に提供できない場合は以前のcontextを代替として提供せず、不在結果を返す。

具体的なDOM要素、Web API property、探索方法、識別子はArchitectureのContractとして固定しない。

##### Lifecycle

現在のeditor contextが必要な時点で解決する。editor lifecycleが変化した場合は改めて解決し、以前に解決したcontextを後続lifecycleへ持ち越さない。

##### Invariants

- 提供するcontextは解決に用いた基準と同じ現在のeditor contextに属する。
- 利用側へEditor環境ごとのbrowsing context差の判定を要求しない。
- editor lifecycleをまたいだcontextの永続性を保証しない。
- Reorder Modeや方向固有責務の状態・判定を所有しない。

#### Table Integration {#RESP_TABLE_INTEGRATION}

##### Responsibility

対応Table Block固有のTable情報取得とデータ更新方法を、その方向の並び替え責務から隠蔽する。行並び替えと列並び替えは、それぞれ独立したTable Integrationとしてこの責務を実現する。

##### State ownership

状態を所有しない。Tableデータ、DnD状態、Reorder Session、制約情報を要求間で保持しない。

##### Contract

行並び替えでは、要求時点のTableからTable本文の行と縦結合に関する判定に必要な情報を提供し、確定した行順変更を対象Tableへ反映する。

列並び替えでは、要求時点のTableからTable全体の列と横結合に関する判定に必要な情報を提供し、確定した列順変更を対象Tableへ反映する。

各方向は相手方向のための情報を提供する必要を持たず、両方向を束ねるTable表現をContractとしない。

現在のTableを安全に利用できない、または現在の外部状態では更新できない場合は、不完全な情報や更新成功を返さず、呼び出し側が開始不可またはabortを判断できる結果を返す。

##### Lifecycle

要求ごとに対象Tableの現在データを利用する。取得結果やTableデータを後続要求へ持ち越さず、Tableの追加・削除・構造変更を監視しない。

##### Invariants

- 対応Table Block固有の構造表現やデータ操作方法を方向固有責務へ漏らさない。
- 行向けTable Integrationは列並び替えのための情報を提供しない。
- 列向けTable Integrationは行並び替えのための情報を提供しない。
- 移動対象判定、制約情報導出、移動先判定を所有しない。
- DnD状態またはReorder Sessionを所有しない。
- 1回の確定した並び替えを複数の独立した部分更新として扱わない。

#### Input Interaction {#RESP_INPUT_INTERACTION}

##### Responsibility

各方向についてPCとタッチ端末の入力成立方法の違いを吸収し、その方向のDnD Interactionが扱う開始試行・進行・完了・キャンセルへ変換する。行並び替えと列並び替えは、それぞれ独立したInput Interactionとしてこの責務を実現する。

##### State ownership

入力をDnDとして解釈するために必要な一時状態だけを所有する。Reorder Session、移動対象可否、移動先、Tableデータ、Presentation状態は所有しない。

##### Contract

Reorder Modeから対応する方向が有効かを確認し、WordPress編集環境からPCまたはタッチ端末の入力を受け取る。DnD開始を試みる入力が成立した場合は開始対象を同じ方向のDnD Interactionへ渡す。

DnD開始後は進行、完了、キャンセルとして解釈した入力を渡す。DnD Interactionへ渡すContractにPCとタッチ端末ごとの入力成立方法を含めず、行・列を識別する方向値も渡さない。

##### Lifecycle

対応する並び替えモード中に対象入力を受けたときだけ一時状態を持ち、完了、キャンセル、abort、開始不可、またはDnD不成立で不要な状態を破棄する。

##### Invariants

- PCとタッチ端末の入力固有差をDnD InteractionのContractへ持ち込まない。
- 行・列を識別する値をDnD Interactionへ渡すことを前提にしない。
- 移動対象可否や移動先を判定しない。
- Tableデータを変更しない。

#### DnD Interaction {#RESP_DND_INTERACTION}

##### Responsibility

各方向のDnD開始・進行・完了・キャンセルとReorder SessionのLifecycleを統括する。行並び替えと列並び替えは、それぞれ独立したDnD Interactionとしてこの責務を実現する。

##### State ownership

成立した1回のDnDに対応する、その方向のReorder Sessionを所有する。Reorder Sessionは移動対象、そのDnDで利用する制約情報、現在の移動先を保持する。現在の有効な移動先は存在しないことが正常にあり得るため任意状態とする。

Reorder Sessionに方向値を保持することを必須としない。方向はDnD Interactionの実装境界で確定している。

##### Contract

Input Interactionから開始試行・進行・完了・キャンセルを受け取る。開始時はReorder Modeで対応方向が有効であることを前提として、同じ方向のReorder Target Resolutionへ開始対象の解決を要求する。

移動可能な場合だけReorder Sessionを開始する。進行中は移動対象、制約情報、現在位置を同じ方向のDrop Target Resolutionへ渡し、有効な移動先をSessionに保持する。

完了時に有効な移動先がある場合だけ確定した並び替えを同じ方向のData Updateへ渡す。cancelではData Updateへ渡さない。

外部環境変化または内部Contract / Invariant不整合によって継続できない場合は、その方向のabortとしてSessionとDnD一時状態を終了し、DnD idleへ戻す。abortはReorder Modeを変更せず、開始済み更新のretryまたはrollbackを開始しない。

##### Lifecycle

移動可能な開始対象でSessionを開始し、完了、キャンセル、abortまでactiveを維持する。終了時はSessionと制約情報を破棄し、次のDnDへ持ち越さない。

##### Invariants

- 各方向のDnD Interactionが所有するactiveなReorder Sessionは1つだけとする。
- Reorder Sessionには移動対象と制約情報が必ず存在する。
- Reorder Sessionへ行・列を識別する方向値を要求しない。
- 移動不可な開始試行ではReorder Sessionを作らない。
- DnDをまたぐconstraint cache、structure revision、cache invalidationを所有しない。
- DnD中にTableデータを変更しない。
- 有効な移動先なしに確定した並び替えを生成しない。
- 完了、キャンセル、abort後に前回のSession状態を保持しない。

#### Reorder Target Resolution {#RESP_REORDER_TARGET_RESOLUTION}

##### Responsibility

DnD開始試行時に、その方向のTable Integrationが提供する現在のTable情報から移動対象可否を判定し、そのDnDで必要な制約情報を導出する。行並び替えと列並び替えは、それぞれ独立したReorder Target Resolutionとしてこの責務を実現する。

##### State ownership

状態を所有しない。Table情報や制約情報を要求間で保持しない。

##### Contract

行ではTable本文の行だけを移動対象候補とし、縦結合に由来する移動対象可否と構造保持に必要な制約情報を導出する。横結合だけを理由に開始不可としない。

列ではTable全体の列だけを移動対象候補とし、横結合に由来する移動対象可否と構造保持に必要な制約情報を導出する。縦結合だけを理由に開始不可としない。

開始対象が成立しない場合は正常な開始不可として理由を返す。Table情報を安全に取得できない場合も内部Invariant違反とは扱わず、開始しないための利用不可結果を返す。

##### Lifecycle

DnD開始試行ごとに実行し、結果を返した時点で終了する。次の開始試行では現在のTable情報から改めて解決する。

##### Invariants

- DnD開始後の移動先判定を担わない。
- Table Block固有の構造表現を直接扱わない。
- 行では縦結合、列では横結合に必要な情報だけを扱う。
- 結合範囲を越えること自体を禁止する制約にはしない。
- 制約情報をDnDをまたいで再利用しない。
- Tableデータを変更しない。

#### Drop Target Resolution {#RESP_DROP_TARGET_RESOLUTION}

##### Responsibility

開始済みDnDに対して、同じ方向のDnD Interactionから渡された移動対象、制約情報、現在位置だけを入力として有効な移動先を判定する。行並び替えと列並び替えは、それぞれ独立したDrop Target Resolutionとしてこの責務を実現する。

##### State ownership

状態を所有しない。Reorder Session、Table情報、制約情報のLifecycleを所有しない。

##### Contract

行ではTable本文内の行間、列ではTable全体の列間を移動先候補として扱う。対象方向の結合を分断しない場合だけ有効な移動先を返す。該当しない場合は有効な移動先なしという正常な結果を返す。

Table全体の構造を参照または再解析せず、渡された制約情報を再導出しない。

##### Lifecycle

DnD中の判定要求ごとに実行する。完了、キャンセル、abort後に判定結果を保持しない。

##### Invariants

- DnD開始前の移動対象可否を判定しない。
- Reorder Session自体に依存しない。
- Table Integrationを利用しない。
- 行では縦結合、列では横結合を分断する位置を有効な移動先として返さない。
- 有効な移動先が存在しない状態を内部不整合として扱わない。
- Tableデータを変更しない。

#### Reorder Presentation {#RESP_REORDER_PRESENTATION}

##### Responsibility

各方向について移動不可理由、DnD開始後の移動対象、現在の有効な移動先、周囲の表示変化、確定・キャンセル・abortの視覚フィードバックをTableデータ更新から分離して扱う。

##### State ownership

DnD中だけ必要な表示状態と移動不可理由の一時表示を所有する。Tableデータ、移動対象可否、移動先可否、DnD確定判断は所有しない。

##### Contract

行では行の移動対象と水平の挿入線、列では列の移動対象と垂直の挿入線を扱う。移動先変更に伴って実際に表示位置が変わる行または列だけを表示上移動させる。

確定時は最終位置へつなぎ、cancel時は元の位置へ戻し、abort時はDnD用の一時表示を破棄する。PCとタッチ端末で現在の移動対象を示す方針を変えない。

##### Lifecycle

DnD開始または移動不可結果で必要な表示を開始し、確定、キャンセル、abortでDnD用状態を終了する。

##### Invariants

- 表示更新によってTable上の実際の行・列順序を変更しない。
- 並び替えモードへ入っただけで全行・全列の対象表示を開始しない。
- 無効な移動先に確定可能な挿入線を表示しない。
- Tableデータ更新を所有しない。

#### Auto Scroll {#RESP_AUTO_SCROLL}

##### Responsibility

各方向のDnD中に必要な一方向の自動スクロールを扱う。

##### State ownership

DnDに属する一時的な自動スクロール状態だけを所有する。

##### Contract

行では縦方向、列では横方向だけを自動スクロール対象とする。DnD終了時にその方向の自動スクロールを終了する。

##### Lifecycle

DnD中に必要な場合だけ有効となり、完了、キャンセル、abortで終了する。

##### Invariants

- 行DnD中は横方向、列DnD中は縦方向を自動スクロールしない。
- DnD終了後に前回の自動スクロール状態を保持しない。
- Tableデータ更新や移動先判定を所有しない。

#### Data Update {#RESP_DATA_UPDATE}

##### Responsibility

確定済みの並び替えを、その方向のTable Integrationを通じて対象Tableへ反映する。行並び替えと列並び替えは、それぞれ独立したData Updateとしてこの責務を実現する。

##### State ownership

確定した並び替えをTableへ反映する責務を所有する。DnD進行状態、Presentation、制約、移動対象判定、移動先判定は所有しない。

##### Contract

行ではTable本文の行順だけ、列ではTable全体の列順だけを変更する確定結果をTable Integrationへ1つの更新単位として渡す。セル内容、属性、装飾その他の保持すべき情報を維持し、成立した更新は1回のUndoで戻せる単位とする。

更新を開始できない、または更新結果を完了・確認できない場合は、その結果をDnD Interactionへ返す。開始済み更新への自動retryまたはrollbackは行わない。

##### Lifecycle

確定済みの並び替えを受け取ったときだけ動作する。移動不可、キャンセル、無効なDnDでは動作しない。

##### Invariants

- 確定していないDnDからTableデータを変更しない。
- 1回の確定した並び替えを複数回または複数の独立した部分更新として反映しない。
- 行ではTable本文の行順だけ、列ではTable全体の列順だけを変更する。
- Table Integration以外を介して対象Tableを直接更新しない。
- 更新失敗時のDnD復旧またはReorder Mode変更を所有しない。

## 6. Runtime View

### DnD start with movable target {#RV_DND_START_MOVABLE}

選択されている方向で移動可能な対象からDnD開始が試みられ、Reorder Sessionが成立するまでの協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 開始対象を含むDnD開始試行を同じ方向のDnD Interactionへ渡す。 |
| 2 | RESP_REORDER_MODE | RESP_DND_INTERACTION | 対応する並び替え方向が現在有効であることを提供する。 |
| 3 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | 同じ方向の開始対象に対する移動対象解決を要求する。 |
| 4 | RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 同じ方向の判定に必要な現在のTable情報を要求する。 |
| 5 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 移動対象と、そのDnDで利用する制約情報を通知する。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | DnD開始状態を提供し、移動対象表示を開始させる。 |
| 7 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | activeなDnD状態を提供する。 |

### DnD start without movable target {#RV_DND_START_IMMOVABLE}

開始対象が移動対象として成立しない、または現在の外部Table状態から安全に開始できない場合の協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 開始対象を含むDnD開始試行を同じ方向のDnD Interactionへ渡す。 |
| 2 | RESP_REORDER_MODE | RESP_DND_INTERACTION | 対応する並び替え方向が現在有効であることを提供する。 |
| 3 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | 同じ方向の開始対象に対する移動対象解決を要求する。 |
| 4 | RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 同じ方向の判定に必要な現在のTable情報を要求する。 |
| 5 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 開始不可であることと、提供可能な理由を通知する。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | DnDを開始せず、必要な理由を一時表示するために渡す。 |

### DnD progress {#RV_DND_PROGRESS}

開始済みDnDの進行に応じて、Sessionに保持された制約情報から移動先、表示、自動スクロールを更新する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 現在位置に対応するDnD進行情報を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | 移動対象、制約情報、現在位置を渡し、同じ方向の移動先判定を要求する。 |
| 3 | RESP_DROP_TARGET_RESOLUTION | RESP_DND_INTERACTION | 有効な移動先、または有効な移動先なしという判定結果を通知する。 |
| 4 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 移動対象と現在の移動先を提供し、表示を更新させる。 |
| 5 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | activeなDnD状態を提供する。 |
| 6 | RESP_AUTO_SCROLL | EXT_SCROLL_AREA | 行では縦方向、列では横方向に必要な自動スクロールを行う。 |

### DnD commit {#RV_DND_COMMIT}

有効な移動先でDnDが完了し、対応Table Blockへ1つの更新単位として反映する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnD完了を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DATA_UPDATE | 移動対象と有効な移動先を含む確定済みの並び替えを渡す。 |
| 3 | RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定済みの並び替えを1つの更新単位として反映するよう要求する。 |
| 4 | RESP_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有の方法で行または列の位置を更新する。 |
| 5 | RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 成立した1回の並び替えを1回のUndoで戻せる更新単位として成立させる。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 確定結果を提供し、確定表示を完了させる。 |

### DnD cancel {#RV_DND_CANCEL}

開始済みDnDが利用者操作としてキャンセルされる協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | activeなDnDに対するキャンセルを渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | cancel結果を提供し、移動対象を元の位置へ戻す表示を完了させる。 |
| 3 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | DnD終了を提供し、自動スクロールの一時状態を終了させる。 |

Data UpdateへのInteractionは発生しない。Reorder Modeは変更しない。

### DnD abort {#RV_DND_ABORT}

外部環境の変化または内部不整合によって現在のDnDを継続できない場合の安全終了を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | abort結果を提供し、DnD表示状態を破棄させる。 |
| 2 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | abort結果を提供し、自動スクロール状態を終了させる。 |
| 3 | RESP_DND_INTERACTION | RESP_INPUT_INTERACTION | DnD終了を提供し、入力解釈の一時状態を終了させる。 |

abort自身は新たなData Updateを開始せず、Reorder Modeを変更しない。

### Data Update failure after update start {#RV_DATA_UPDATE_FAILURE}

外部更新開始後に処理を完了または確認できなくなった場合に、開始済み更新のretry / rollbackを行わずabortへ合流する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 有効な移動先でのDnD完了を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DATA_UPDATE | 確定済みの並び替えを渡す。 |
| 3 | RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定済みの並び替えを反映するよう要求する。 |
| 4 | RESP_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Blockへの外部更新を開始する。 |
| 5 | RESP_TABLE_INTEGRATION | RESP_DATA_UPDATE | 更新を完了または確認できない結果を返す。 |
| 6 | RESP_DATA_UPDATE | RESP_DND_INTERACTION | 更新失敗結果を返す。 |
| 7 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | abortとしてDnD表示状態を破棄させる。 |
| 8 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | abortとして自動スクロール状態を終了させる。 |
| 9 | RESP_DND_INTERACTION | RESP_INPUT_INTERACTION | abortとして入力解釈の一時状態を終了させる。 |

## 8. Crosscutting Concepts

### State ownership

- Reorder Modeが通常編集、行並び替え、列並び替えの排他状態を所有する。
- Editor DOM Contextは現在のeditor DOM contextを必要な時点で解決し、editor lifecycleをまたぐ永続状態として所有しない。
- 各方向のTable IntegrationはTable情報やTableデータを要求間で保持しない。
- 各方向のInput InteractionはPCとタッチ端末の入力解釈に必要な一時状態だけを所有する。
- 各方向のReorder Target Resolutionは制約情報を導出するが、そのLifecycleを所有しない。
- 各方向のDnD Interactionは、その方向のReorder Sessionとして移動対象、制約情報、現在の移動先を所有する。Sessionに方向値を持たせることを要求しない。
- 各方向のDrop Target Resolutionは移動先を判定するが、Sessionや制約情報を状態として所有しない。
- 各方向のReorder PresentationとAuto ScrollはDnDに属する表示・スクロールの一時状態だけを所有する。
- Data Updateは確定した並び替えを反映する責務を所有するが、Tableデータの永続的な所有者にはならない。

### Failure classification and recovery boundary

Reorderが扱う処理不能状態は、正常な不在、外部環境の変化による処理不能、内部Contract / Invariant不整合を区別する。

開始前に安全に処理できない場合はDnDを開始しない。開始後に継続できない場合は、その方向のDnD Interactionが所有するabortへ合流し、DnD一時状態を終了する。

### Architecture-wide invariants

- Editor DOM ContextとReorder Modeは行・列で共有する。
- その他の方向固有責務は、Architecture上の同じ責務名や図上の同じ位置を、共有実装の根拠にしない。
- 行並び替えと列並び替えの間に、両方向を束ねるTable構造、Reorder Session、Target、Destinationの共有抽象化を要求しない。
- Table Integrationに直接依存する方向固有責務はReorder Target ResolutionとData Updateに限定する。
- PCとタッチ端末の入力固有差を各方向のDnD Interaction以降へ持ち込まない。
- 行の移動対象と構造保持範囲はTable本文、列の移動対象と構造保持範囲はTable全体とする。
- 行では縦結合、列では横結合に由来する制約を扱い、対象方向の結合を分断する移動を禁止する。
- DnD開始後のDrop Target ResolutionはTable全体を再解析しない。
- DnD中はTable上の実際の行・列順序を変更しない。
- 有効な移動先でDnDが完了した場合だけTableデータを変更する。
- 行では縦方向、列では横方向だけをDnD中の自動スクロール対象とする。
- 完了、キャンセル、abort後はDnD一時状態を次のDnDへ持ち越さない。
- abortによってReorder Modeを変更しない。

### Lifecycle and context boundaries

Editor DOM Contextが提供するcontextは、その時点のeditor lifecycleに属するものとして扱う。

Reorder Modeが通常状態にある間は行・列どちらのDnDも開始しない。行または列の並び替えモードへ入った後に、対応する方向のInput InteractionとDnD Interactionが動作する。

各方向のReorder Target Resolutionは開始試行ごとに現在のTable情報から制約情報を導出する。移動可能な場合だけ同じ方向のDnD InteractionがReorder Sessionを開始する。

DnDに属する状態は1回の成立した操作中だけ有効とし、完了、キャンセル、abortで破棄する。次の開始試行では現在のTable情報から改めて制約情報を導出する。

Data Update開始後に継続できなくなった場合は、開始済み更新に追加のretryまたはrollbackを行わず、現在のTable状態を外部状態として扱う。

## 9. Architecture Decisions

### 共有する責務を限定する

Editor DOM ContextはEditor環境差の解決を、Reorder Modeは通常編集・行並び替え・列並び替えの排他状態を、それぞれ両方向をまたいで一つの責務として所有する必要があるため共有する。

それ以外の方向固有責務は、行並び替えと列並び替えが同じArchitecture責務モデルに従っていても、それぞれ独立して実現する。同じ責務名、同じ依存関係、同じ処理フロー、類似した実装は共有抽象化を導入する理由としない。

### 方向を実装境界で確定する

行・列の相関を汎用的な方向型や共通Sessionで維持せず、方向固有実装の境界によって方向を確定する。各方向のReorder Sessionはその方向の移動対象、制約情報、移動先だけを保持する。

### Table情報を方向ごとに扱う

Table Integrationは、行では行並び替えに必要なTable情報だけを、列では列並び替えに必要なTable情報だけを提供する。両方向を同時に支えるTable構造を導入しない。

## 10. Quality Requirements

### QR-01 Performance

大規模Tableの判定基準、想定最大規模、Performanceの保証範囲はQuality Requirementsの`QR-01`を正本とする。

Table全体の行数・列数・セル数に比例する並び替え用常駐状態を前提にしない。Reorder Target Resolutionが開始試行時に導出した制約情報は1回のDnD中だけReorder Sessionに保持し、Drop Target Resolutionの複数回判定で再利用する。

DnD中はTable上の実際の順序を変更せず、移動先と必要なPresentation状態だけを更新する。Data Updateは1回の有効な確定に対して1回だけTable Integrationへ反映要求する。

### QR-02 Compatibility

対応するTable Blockの正本は`FR-13`、対応するWordPress / Editor環境の正本は`QR-02`とする。

Table Block差は各方向のTable Integrationが吸収し、方向固有責務へBlock固有表現を漏らさない。Editor環境差はEditor DOM Contextが吸収する。

対応Table BlockやEditor環境の差によって、方向固有責務を一つの共有実装へ統合することをCompatibilityの前提にしない。

### QR-03 Reliability / Robustness

DnD Interactionは各方向のReorder operation boundaryとReorder Sessionを所有し、正常な不在、外部環境変化、内部Contract / Invariant不整合を区別する。

activeな操作を継続できない場合は、その方向のabortへ合流してDnD一時状態を終了する。Reorder Modeは別の共有状態所有者であるため、abortによって暗黙に終了しない。

Data UpdateとTable Integrationは1回の確定した並び替えを1つの更新単位として扱う。外部更新開始後に処理を完了または確認できなくなった場合は、開始済み更新の自動retryまたはrollbackをDnD復旧へ含めない。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| editor DOM context | 現在のeditorでDOM / Web APIを利用するために、その時点のeditor lifecycleに属するものとしてEditor DOM Contextが解決して提供するcontext。 |
| direction-specific Table information | 各方向のTable Integrationが要求時点の対応Table Blockから提供する、その方向の移動対象判定、制約導出、更新に必要なTable情報。行・列を束ねる表現を前提としない。 |
| reorder constraint information | DnD開始試行時に各方向のReorder Target Resolutionが現在のTable情報から導出し、その方向の成立したReorder Sessionが1回のDnD中だけ保持する制約情報。 |
| Reorder Session | 各方向のReorder Target Resolutionが移動可能と判定した後から、完了、cancel、abortまで、その方向のDnD Interactionが所有する1回のDnD状態。移動対象と制約情報を必須とし、destinationは存在しない場合がある。方向値を必須状態としない。 |
| Reorder operation boundary | 各方向のDnD Interactionへ入る1回の開始試行、進行、完了、キャンセルを、正常完了または安全終了まで統括するArchitecture上の操作境界。 |
| DnD idle | その方向でactiveなReorder Sessionが存在しないDnD状態。Reorder Modeの通常編集状態と同義ではない。 |
| start target | Input InteractionがDnD開始試行として同じ方向のDnD Interactionに渡す、利用者がドラッグ開始を試みた行または列。 |
| reorder target | Reorder Target Resolutionが移動可能と判定し、その方向のReorder Sessionで扱う行または列。 |
| destination | Drop Target ResolutionがDnD開始後に判定する、その方向の有効な移動先。activeなReorder Session中でも存在しない場合がある。 |
| committed reorder | 有効なdestinationでDnDが完了し、Data Updateに渡せる状態になった確定済みの並び替え。 |
| cancel | 正常に開始されたactiveなDnDを利用者操作として終了し、Tableデータを更新せずDnD一時状態を終了するContract。 |
| abort | 外部環境変化または内部不整合によって継続できないDnDを安全に終了し、DnD一時状態を破棄してDnD idleへ戻すContract。Reorder Modeの終了や開始済みData Updateのretry / rollbackは含まない。 |

### Related documents

- `docs/requirements/reorder-v1-requirements.md`
- `docs/requirements/reorder-v1-quality-requirements.md`
- `docs/design/reorder-v1-design.md`
- #490 Reorder v1アーキテクチャ設計書を作成する
- #493 DnDの視覚フィードバックを要件定義・基本設計に反映する
- #521 大規模Tableを前提に並び替え制約の計算方式を見直す
- #523 アーキテクチャ設計書をarc42ベースへ整理しStructurizr DSL自動生成を導入する
- #524 Architecture documentation rulesをarc42対応へ更新する
- #552 Table Integrationの責務設計をArchitecture上で確定する
- #553 Reorder Constraint Resolution廃止後の責務配置をArchitectureに反映する
- #556 外部Table pluginとの境界責務を再設計する
- #591 #589/#590の仕様をアーキテクチャ設計書へ反映する
- #607 Reorder v1 Quality Requirementsを定義する
- #608 #605の決定をDesign / Architecture / source guidelinesへ反映する
- #609 安全なReorder終了挙動を基本設計へ反映する