# Reorder v1 アーキテクチャ設計書

## 1. Introduction and Goals

本書は、`docs/requirements/reorder-v1-requirements.md`、`docs/requirements/reorder-v1-quality-requirements.md`、`docs/design/reorder-v1-design.md`を入力として、Reorder v1を実現するための内部責務、責務間の境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

機能対象と対応するTable BlockはFunctional Requirementsに従い、対応するTable Blockの正本は`FR-13`とする。Performance、Compatibility、Reliability / Robustnessの品質保証範囲はQuality Requirementsの`QR-01`、`QR-02`、`QR-03`に従い、本書ではそれらを実現するArchitecture上の責務と境界だけを定義する。

Keyboard操作、ドラッグを必要としない操作、focus、announcement、支援技術への情報提供など、基本設計書で対象外としているアクセシビリティ設計は本書でも対象外とする。

本書では、実装単位ではなく、正式v1の設計を成立させる責務とその協調を扱う。責務名およびIDはソースファイル、関数、クラスなどの実装識別子を意味しない。

## 2. Architecture Constraints

- 行並び替えと列並び替えを同時に有効にしない。
- PCとタッチ端末で、入力成立方法の違いをDnD Interaction以降へ持ち込まない。
- `FR-13`で定義される対応Table Blockの違いによってReorder coreの責務を変更しない。
- Reorder coreは具体的なTable Blockに依存せず、Table Block固有のTable構造取得およびデータ更新方法をTable Integrationの境界内に隠蔽する。
- Table IntegrationはTableデータ、共通Table structure、監視状態、DnD状態、Reorder Session、並び替え制約を所有しない。
- DnD開始試行では、Reorder Target Resolutionがその時点の共通Table structureから移動対象可否を判定し、そのDnDの移動先判定に必要な制約情報を導出する。
- 導出した制約情報は成立したReorder Sessionが1回のDnD中だけ保持し、DnDをまたいで再利用しない。
- Drop Target ResolutionはDnD Interactionから渡された判定入力だけを利用し、Table全体の構造を参照または再解析しない。
- 行DnDの移動対象と構造保持範囲は共通Table structure上のbody sectionとし、列DnDの移動対象と構造保持範囲はTable全体とする。
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
- DnDを継続できない場合の復旧はDnD Interactionを中心とする共通abortへ合流し、Reorder SessionとDnDに属する一時状態を終了してDnD idleへ戻す。
- abortはReorder Mode自体を終了せず、すでに開始されたData Updateに対する自動retryまたはrollbackを担わない。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | `QR-02`で保証対象とする編集環境を提供する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | `FR-13`で定義される対応Table Block。Table Integrationを介してReorder coreと接続する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | DnD中にTableまたは編集画面を必要な方向へ自動スクロールする対象領域を提供する。 |

YTRはWordPress Editor、`FR-13`で定義される対応Table Block、Undoの仕組み、およびTableや編集画面のスクロール領域と接続する。対応Table Blockの具体的な列挙と対応Editor環境の保証範囲は本書では再定義しない。

現在のeditorでDOM / Web APIを利用する責務は、現在のeditor contextに属する基準からEditor DOM Contextが解決したcontextを利用する。利用側はEditor環境ごとのbrowsing context差を直接扱わず、Editor DOM Contextは具体的なDOM要素、Web API property、探索方法、識別子をArchitectureのContractとして固定しない。

Input InteractionをWordPress編集環境の入力と共通Reorder処理の境界とし、PCとタッチ端末の入力固有の差をその境界の内側で扱う。DnD Interaction以降は入力方式に依存しない共通概念だけを扱う。WordPress Editorから受ける入力と、DOM / Web APIを利用するためのeditor contextの解決は別の責務境界として扱う。

対応Table Block固有の構造取得およびデータ更新方法はTable Integrationが吸収する。Reorder coreは具体的なTable Blockを直接扱わず、構造参照では要求時点の共通Table structureを利用し、確定した並び替えの反映ではTable Integrationを更新境界として利用する。外部Table Block固有のsection表現はTable Integrationが共通Table structureのhead / body / footへ適応し、Reorder coreはその共通表現だけを扱う。

Table構造に由来するDnD開始前の移動対象可否と、そのDnD中に使用する構造上の制約情報はReorder Target ResolutionがDnD開始試行時に解決する。行DnDでは共通Table structure上のbody sectionの行、列DnDではTable全体の列を対象とし、それぞれ同じ範囲の構造保持に必要な制約情報を導出する。DnD開始後の移動先可否はDrop Target Resolutionが、DnD Interactionから渡された制約情報と現在の操作状態を利用して判定する。

DnD Interactionは成立したReorder Sessionに制約情報を保持し、Drop Target Resolutionへ判定に必要な値だけを渡す。Drop Target ResolutionはReorder Session自体やTable全体の構造には依存しない。

Tableの実データ更新はDnDの進行およびReorder Presentationから分離し、確定した並び替えだけをData UpdateがTable Integrationを通じて対象Tableへ反映する。

First-use GuidanceとReorder Rediscoveryは、WordPressの通常編集として成立する操作を尊重し、並び替え案内のために通常編集の成立を奪わない。

## 4. Solution Strategy

Reorder v1は、editor DOM contextの解決、外部Table Blockとのデータ境界、並び替えモード、案内、入力解釈、DnDの共通進行、開始対象と制約情報の解決、移動先判定、表示、自動スクロール、Tableデータ更新を別々の責務として扱う。

Editor DOM Contextは、現在のeditor contextに属する基準から、その時点でDOM / Web APIを利用するためのcontextを解決し、必要とする責務へ提供する。利用側に`QR-02`で対象となるEditor環境差を持ち込まず、contextの永続性や並び替え状態を所有しない。

Table Integrationは、`FR-13`で定義される対応Table BlockとReorder coreの境界を担い、Block固有のTable構造取得およびデータ更新方法をReorder coreから隠蔽する。構造参照では要求時点の共通Table structureを提供し、更新では確定した並び替えをBlock固有の方法で対象Tableへ反映する。Tableデータや共通Table structureを状態として保持せず、Tableの追加・削除・構造変更も監視しない。

Reorder Modeは通常編集、行並び替え、列並び替えの現在状態を管理する。Input Interactionは、その状態のもとでPCとタッチ端末の入力差を吸収し、DnDの開始試行・進行・完了・キャンセルという共通の意味へ変換する。

DnD Interactionは、入力方式に依存せず、Input Interactionから受け取った開始対象とReorder Modeが示す並び替え方向を組み合わせてDnDの開始と進行を統括する。開始試行時にReorder Target Resolutionへ解決を要求し、移動可能な場合だけ、移動対象とそのDnDで利用する制約情報を含むReorder Sessionを開始する。移動不可の場合はDnDを開始せず、その理由をReorder Presentationへ渡す。

Reorder Target ResolutionはDnD開始試行時にTable Integrationからその時点の共通Table structureを取得し、行DnDではbody sectionの行だけ、列DnDではTable全体の列を移動対象として解決する。同時に、行DnDではbody section、列DnDではTable全体の構造保持に必要な制約情報を導出する。制約情報のLifecycleは所有せず、移動可能な場合に移動対象の解決結果と制約情報をDnD Interactionへ提供する。

DnD InteractionはReorder Sessionに保持した現在の移動対象、並び替え方向、制約情報、現在位置をDrop Target Resolutionへ判定入力として渡す。Drop Target Resolutionはその入力だけから、行DnDではbody section内の行間、列DnDではTable全体の列間について有効な移動先を判定し、Table Integration、Table全体の構造、Reorder Session自体には依存しない。

Reorder PresentationはTableデータとは分離して移動対象、挿入線、周囲の行・列の表示変化を扱い、Auto Scrollは並び替え方向に応じた一方向の自動スクロールを扱う。

有効な移動先で完了した場合だけDnD Interactionが確定した並び替えをData Updateへ渡す。Data Updateは、行DnDではbody sectionの行順だけ、列DnDではTable全体の列順だけを変更する確定結果をTable Integrationへ1つの更新単位として反映要求し、Table Integrationが対象Table Block固有の方法でデータへ反映する。キャンセルまたは無効な完了ではData Updateを動作させない。

DnD Interactionへ入る1回の開始試行・進行・完了・キャンセルをReorder operation boundaryとする。この境界内で外部環境の変化または内部不整合により処理を継続できない場合は、個別責務ごとの独自復旧を増やさず、DnD Interactionを中心とする共通abortへ合流する。別の実行タイミングで継続する処理についても、同じReorder Sessionに属する限り復旧方針を分岐させない。

abortは通常のcancelとは区別する。cancelは正常に開始されたactiveなDnDを利用者操作として終了するContractであり、abortは外部環境変化または内部不整合から現在のDnDを安全に終了するContractとする。abortはactiveなReorder Sessionの存在を前提にせず、Reorder SessionとDnDに属する一時状態を終了してDnD idleへ戻すが、Reorder Mode自体は変更しない。

Data Update開始後に処理を継続できなくなった場合、abortはすでに開始された更新に対する自動retryまたはrollbackを行わず、新たなData Updateも開始しない。その時点のTable状態を外部状態として尊重し、DnDの一時状態だけを終了する。

First-use Guidanceは初回案内、Reorder Rediscoveryは初回案内後の再案内を扱い、いずれもReorder ModeやDnDの状態を所有しない。

### Process Flow Views

#### Reorder End-to-End {#PV_REORDER_END_TO_END}

WordPress Editorから並び替え入力を受け取り、共通Reorder処理で移動対象と移動先を解決し、確定した並び替えを対応Table Blockへ反映するまでの主要な処理進行を示す。

| From | To | Meaning |
| --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_INPUT_INTERACTION | WordPress Editorの入力がYTRの共通Reorder処理へ入る。 |
| RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 入力方式固有の解釈から、共通のDnD処理へ進む。 |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | DnD開始試行から、移動対象と制約情報の解決へ進む。 |
| RESP_REORDER_TARGET_RESOLUTION | RESP_DROP_TARGET_RESOLUTION | 解決された移動対象と制約情報を前提に、開始後の移動先判定へ進む。 |
| RESP_DROP_TARGET_RESOLUTION | RESP_DATA_UPDATE | 有効な移動先でDnDが完了した場合、確定した並び替えの反映へ進む。 |
| RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定した並び替えを対応Table Block固有の更新境界へ渡す。 |
| RESP_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | `FR-13`で定義される対応Table Blockへ、そのBlock固有の方法でTableデータを反映する。 |

このViewは主要な処理の進行方向だけを示し、補助的な責務、Runtime Interactionの往復、異常時の復旧経路は表さない。

#### Reorder Failure and Recovery {#PV_REORDER_FAILURE_RECOVERY}

activeなReorder Session中に外部環境の変化またはReorder内部のContract / Invariant不整合によって処理を継続できなくなった場合に、個別責務で独自に復旧せず、Reorder operation boundaryへ集約して共通abortからDnD idleへ戻る主要な復旧進行を示す。正常な不在やDnD開始前の開始不可はこのViewに含めない。

| From | To | Meaning |
| --- | --- | --- |
| RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 外部環境の変化などによりactiveなReorder操作を継続できない状態をReorder operation boundaryへ合流させる。 |
| RESP_DROP_TARGET_RESOLUTION | RESP_DND_INTERACTION | DnD進行中に検出されたReorder内部のContract / Invariant不整合をReorder operation boundaryへ合流させる。 |
| RESP_DATA_UPDATE | RESP_DND_INTERACTION | Table更新を継続または確認できない結果をReorder operation boundaryへ返し、共通abortへ合流させる。 |
| RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 共通abortとしてDnD表示の一時状態を終了する。 |
| RESP_DND_INTERACTION | RESP_AUTO_SCROLL | 共通abortとして自動スクロールの一時状態を終了する。 |
| RESP_DND_INTERACTION | RESP_INPUT_INTERACTION | 共通abortとして入力解釈の一時状態を終了する。 |

このViewは復旧の主要な収束先を示すものであり、具体的なError検出、throw / catch、log、cleanupの実装順序は規定しない。abortによってReorder Mode自体は変更しない。

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | 通常のTable編集、行並び替え、列並び替えのどの状態にあるかを管理し、現在のモードに応じたDnD開始可否を提供する。 |
| RESP_FIRST_USE_GUIDANCE | First-use Guidance | PCとタッチ端末ごとの初回案内の表示状態を管理し、並び替えの入口を利用者に案内する。 |
| RESP_REORDER_REDISCOVERY | Reorder Rediscovery | 通常編集状態で並び替えを試みていると考えられる操作の繰り返しを判定し、必要な場合だけ並び替えの入口を再案内する。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のeditor contextに属する基準から、その時点で利用すべきDOM / Web API contextを解決し、必要とする責務へ提供する。 |
| RESP_TABLE_INTEGRATION | Table Integration | 対応Table BlockとReorder coreの境界を担い、Block固有のTable構造取得およびデータ更新方法をReorder coreから隠蔽する。 |
| RESP_INPUT_INTERACTION | Input Interaction | PCとタッチ端末の入力固有の差を共通のDnD進行から分離し、開始試行・進行・完了・キャンセルとしてDnD Interactionへ渡す境界を担う。 |
| RESP_DND_INTERACTION | DnD Interaction | 入力方式と行・列に共通するDnDをReorder operation boundaryとして統括し、成立したReorder Sessionを管理して、確定または安全な終了へ導く。 |
| RESP_REORDER_TARGET_RESOLUTION | Reorder Target Resolution | DnD開始試行時、行では共通Table structure上のbody section、列ではTable全体から移動対象を解決し、対応する構造保持に必要な制約情報を導出する。 |
| RESP_DROP_TARGET_RESOLUTION | Drop Target Resolution | DnD Interactionから渡された判定入力だけを使い、行ではbody section内の行間、列ではTable全体の列間から有効な移動先を判定する。 |
| RESP_REORDER_PRESENTATION | Reorder Presentation | 移動不可理由、およびDnD開始後の現在の移動対象から確定・キャンセル・abortまでの視覚フィードバックをTableデータ更新から分離して扱う。 |
| RESP_AUTO_SCROLL | Auto Scroll | DnD中に、行では縦方向、列では横方向だけを移動のための自動スクロール対象とし、DnD終了時に一時状態を破棄する。 |
| RESP_DATA_UPDATE | Data Update | 確定した並び替えを1つの更新単位としてTableに反映し、保持すべきセル情報とUndo単位を維持する。 |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_FIRST_USE_GUIDANCE | EXT_WORDPRESS_EDITOR | 初回案内の表示契機となる編集環境の状態を必要とする。 |
| RESP_FIRST_USE_GUIDANCE | RESP_EDITOR_DOM_CONTEXT | 初回案内でDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_REORDER_REDISCOVERY | EXT_WORDPRESS_EDITOR | 通常編集と並び替え試行候補を区別する編集環境の情報を必要とする。 |
| RESP_REORDER_REDISCOVERY | RESP_EDITOR_DOM_CONTEXT | 再案内判定でDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_REORDER_REDISCOVERY | RESP_FIRST_USE_GUIDANCE | 初回案内が表示済みであることを再案内判定の前提として必要とする。 |
| RESP_REORDER_REDISCOVERY | RESP_REORDER_MODE | 通常編集状態でだけ再案内判定を行うため、現在の並び替え状態を必要とする。 |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のeditor contextを解決するため、現在のWordPress Editorを必要とする。 |
| RESP_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | `FR-13`で定義される対応Table Block固有の構造取得およびデータ更新を行うために必要とする。 |
| RESP_INPUT_INTERACTION | EXT_WORDPRESS_EDITOR | PCまたはタッチ端末の入力を共通のDnD意味へ変換するため、編集環境の入力を必要とする。 |
| RESP_INPUT_INTERACTION | RESP_EDITOR_DOM_CONTEXT | 入力解釈でDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_INPUT_INTERACTION | RESP_REORDER_MODE | 並び替えモード中の入力を解釈するため、現在の並び替え状態を必要とする。 |
| RESP_DND_INTERACTION | RESP_REORDER_MODE | DnD開始時に使用する現在の並び替え方向を必要とする。 |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | DnDを開始できる移動対象と、そのDnDで利用する制約情報の解決能力を必要とする。 |
| RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | 開始済みDnDの現在位置が有効な移動先かを判定する能力を必要とする。 |
| RESP_DND_INTERACTION | RESP_DATA_UPDATE | 確定した並び替えをTableデータへ反映し、その結果をReorder operation boundaryへ返す能力を必要とする。 |
| RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 移動対象判定と制約情報導出に使用する現在の共通Table structureを必要とする。 |
| RESP_REORDER_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 表示処理でDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_REORDER_PRESENTATION | RESP_DND_INTERACTION | 移動不可理由、DnDの進行状態、確定結果、キャンセル結果、abort結果を表示状態へ反映するために必要とする。 |
| RESP_AUTO_SCROLL | RESP_DND_INTERACTION | activeなDnD、並び替え方向、およびDnD終了状態を自動スクロール判断に必要とする。 |
| RESP_AUTO_SCROLL | RESP_EDITOR_DOM_CONTEXT | 自動スクロールでDOM / Web APIを利用するため、現在のeditor contextを必要とする。 |
| RESP_AUTO_SCROLL | EXT_SCROLL_AREA | DnD中に移動方向へスクロールできる外部領域を必要とする。 |
| RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定した並び替えを対応Table Block固有の方法で反映する能力を必要とする。 |
| RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 成立した1回の並び替えを1回で戻せる更新単位を維持するため、Undoの仕組みを必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA RESP_REORDER_MODE RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_EDITOR_DOM_CONTEXT RESP_TABLE_INTEGRATION RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_DATA_UPDATE |
| DV_EDITOR_INTERACTION | Editor Interaction | EXT_WORDPRESS_EDITOR RESP_EDITOR_DOM_CONTEXT RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_INPUT_INTERACTION RESP_REORDER_MODE |
| DV_DND_CORE | DnD Core | RESP_REORDER_MODE RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION |
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

通常状態ではDnDを有効にしない。行並び替えモードでは行DnDを開始可能な状態を提供し、列並び替えモードでは列DnDを開始可能な状態を提供する。個々の開始対象が共通Table structure上の対象範囲に含まれるか、実際に移動対象として成立するかは判定せず、Reorder Target Resolutionが保証する。

DnD InteractionがabortによりDnD idleへ復帰しても、Reorder Mode自体は暗黙に変更しない。並び替えモードの切り替えまたは終了はReorder Mode自身のLifecycleとして扱う。

##### Lifecycle

通常状態から開始する。行または列の入口が選択されると対応する並び替えモードへ移行する。別方向の入口が選択された場合は選択された側へ切り替わり、終了時は通常状態へ戻る。

DnDの完了、キャンセル、abortはReorder SessionのLifecycleを終了するが、それだけを理由にReorder Modeを終了しない。

##### Invariants

- 同時に有効な並び替えモードは1つだけとする。
- 通常状態では行・列のDnDを有効にしない。
- 行並び替えモードでは列DnD、列並び替えモードでは行DnDを有効にしない。
- 共通Table structure上の対象範囲を判定しない。
- 個々の行または列の移動対象成立可否を所有しない。
- DnD Sessionの復旧によってReorder Modeを暗黙に変更しない。

#### First-use Guidance {#RESP_FIRST_USE_GUIDANCE}

##### Responsibility

初めて利用する人が行・列を並び替えられることと、その入口を認識できるようにする。案内表示中は行・列の両方の入口を強調する。

##### State ownership

利用者についてPCとタッチ端末それぞれの初回案内表示済み状態と、現在の初回案内表示状態を所有する。Reorder Mode、Reorder Rediscovery、DnDの状態は所有しない。

##### Contract

PCではTableへのポインター進入、Tableのフォーカス、またはセル編集開始を受け取り、その操作環境で未表示なら初回案内を表示する。

タッチ端末ではTableのフォーカスまたはセル編集開始を受け取り、その操作環境で未表示なら初回案内を表示する。

行または列の並び替え入口が選択された場合、または案内が閉じられた場合に案内と入口の強調を終了し、その操作環境を表示済みとして扱う。PCではTableからポインターが外れたことだけを案内終了条件にしない。

##### Lifecycle

対象の操作環境で未表示の状態から、操作環境に応じた表示契機によって表示状態になる。入口選択または案内を閉じる操作で表示を終了し、その操作環境を表示済みとする。

PCでは表示中にTableからポインターが外れても、それだけでは表示状態を終了しない。

##### Invariants

- PCとタッチ端末の表示済み状態を独立して扱う。
- PCとタッチ端末で定義された表示契機の違いを維持する。
- 初回案内は通常のセル編集を妨げない。
- PCではポインター離脱だけを初回案内終了条件にしない。
- 案内終了後も並び替え入口そのものの利用可否を変更しない。
- Reorder Rediscoveryの再案内判定と一時状態を共有しない。

#### Reorder Rediscovery {#RESP_REORDER_REDISCOVERY}

##### Responsibility

初回案内表示済みの利用者が並び替え機能を忘れている可能性がある場合に、通常編集を妨げず、並び替えを試みていると判断できる操作の繰り返しから必要な再案内だけを成立させる。

##### State ownership

同じ行または列の付近で繰り返された並び替え試行候補の一時的な履歴と、同じ状況で過度に再案内しないための抑制状態を所有する。初回案内表示済み状態、Reorder Mode、DnD状態、Tableデータは所有しない。

##### Contract

通常編集状態で、セル内容の編集、文字選択、通常スクロールなどとして成立しない、行または列を移動しようとする操作候補を受け取る。

同じ行または列の付近で短時間に操作候補が繰り返され、並び替えを試みていると判断できる場合だけ再案内を成立させる。一度だけの短いドラッグや通常の編集操作からは再案内を成立させない。

再案内が成立した場合は、並び替えの入口を確認できる案内を表示するための状態を提供する。同じ状況で案内を過度に繰り返さない。

##### Lifecycle

初回案内表示済みかつ通常編集状態で、並び替え試行候補が現れた場合に判定用の一時状態を持つ。同じ行または列の付近で継続する候補だけを同じ判定系列として扱う。

再案内成立、通常編集として成立する操作への移行、並び替えモードへの移行、または同じ判定系列として扱えない状態への変化に応じて、不要な判定用状態を破棄する。

##### Invariants

- 一度だけの短いドラッグから再案内を成立させない。
- セル内容の編集、文字選択、通常スクロールとして成立する操作を再案内の根拠にしない。
- 並び替えモード中は再案内判定を行わない。
- 再案内によって通常のTable編集を妨げない。
- 同じ状況で再案内を過度に繰り返さない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のeditor contextに属する基準から、その時点でDOM / Web APIを利用するために必要なeditor DOM contextを解決し、必要とする責務へ提供する。利用側が`QR-02`で対象となるEditor環境差を直接扱わなくてよい境界を担う。

##### State ownership

並び替え状態、Reorder Mode、Reorder Session、Tableデータ、移動対象、移動先、Presentation状態を所有しない。解決したeditor DOM contextをeditor lifecycleをまたぐ永続状態として所有しない。

##### Contract

DOM / Web APIを必要とする責務が現在のeditor contextを利用する時点で、現在のeditor contextに属する基準をもとに、その時点で利用すべきeditor DOM contextを解決して提供する。

現在のeditor contextを安全に提供できない場合は、以前のeditor lifecycleで得たcontextを代替として提供せず、利用側が現在の操作を開始しない、またはactiveな操作をabortできる不在結果として境界へ返す。

contextの解決に使用する具体的なDOM要素、Web API property、探索方法、識別子はこのContractでは固定しない。

##### Lifecycle

DOM / Web APIを利用する責務が現在のeditor contextを必要とする時点で、その時点のeditor lifecycleに対してcontextを解決する。提供したcontextがeditor lifecycleの変化後も有効であることは保証せず、新しいlifecycleでは現在のeditor contextに対して改めて解決する。

以前に解決したcontextを、後続のeditor lifecycleに自動的に持ち越さない。

##### Invariants

- 提供するcontextは、解決に用いた基準と同じ現在のeditor contextに属する。
- DOM / Web APIを利用する責務へEditor環境ごとのbrowsing context差の判定を要求しない。
- editor lifecycleをまたいだcontextの永続性を保証しない。
- 以前のeditor lifecycleで得たcontextを現在のcontextとして再利用しない。
- 現在のcontextを安全に提供できない状態をReorder内部のInvariant違反として扱わない。
- 並び替え状態、Tableデータ、移動対象、移動先を所有しない。
- 具体的なDOM要素、Web API property、探索方法、識別子をArchitectureの必須Contractとして固定しない。
- Table Integration、Reorder Mode、DnD Interaction、Reorder Target Resolution、Drop Target Resolution、Data Updateの状態や判定に依存しない。

#### Table Integration {#RESP_TABLE_INTEGRATION}

##### Responsibility

`FR-13`で定義される対応Table BlockとReorder coreの境界を担い、Block固有のTable構造取得およびデータ更新方法をReorder coreから隠蔽する。

##### State ownership

状態を所有しない。Tableデータ、共通Table structure、DnD状態、Reorder Session、制約情報を保持しない。

##### Contract

対応可能なTableについて、要求時点のBlock固有構造をReorder coreが利用する共通Table structureへ適応して提供する。外部Table Block固有のsection表現は、共通Table structureのhead / body / footとして提供する。

現在のTableが利用できない、外部データを安全に共通Table structureへ適応できない、または現在の外部状態では更新できない場合は、不完全な構造や更新成功を返さず、呼び出し側が開始不可またはabortを判断できる境界結果を返す。これら外部状態の不在や変化自体をReorder内部のInvariant違反として扱わない。

確定した並び替えの反映を要求された場合は、Block固有の方法で対象Tableのデータへ反映する。1回の確定した並び替えを複数の独立した部分更新へ分割せず、1つの外部更新単位として扱う。

確定した並び替えを反映する際は、行または列の位置だけを変更し、セルの内容、属性、装飾その他の保持すべき情報を維持する。

`FR-13`の対象外であるTableに対してReorder core向けの共通Table structureまたは更新能力を提供しない。

##### Lifecycle

要求時に対象Tableの現在データを利用して構造取得または更新を行う。取得した構造やTableデータを後続の要求へ持ち越さず、Tableの追加・削除・構造変更を監視しない。

更新開始後に外部環境の変化などによって処理を完了できない場合は、その結果をData Updateへ返し、DnDのrollbackやretryをTable Integration自身のLifecycleとして開始しない。

##### Invariants

- 対応Table Block固有の構造表現やデータ操作方法をReorder core側へ漏らさない。
- Reorder固有の移動対象判定、制約情報の導出、移動先判定を行わない。
- DnD状態またはReorder Sessionを所有しない。
- 共通Table structureやTableデータを永続的に保持しない。
- 対応不能なTableに対して不完全な共通Table structureを提供しない。
- 1回の確定した並び替えを複数の独立した部分更新として扱わない。
- Reorder coreは具体的な対応Table Blockを前提としない。

#### Input Interaction {#RESP_INPUT_INTERACTION}

##### Responsibility

PCとタッチ端末の入力固有の差を、共通のDnD Interactionから分離して扱う。並び替えモード中の入力をDnDの開始試行・進行・完了・キャンセルという共通の意味へ変換し、入力方式に依存しないDnD Interactionへ渡す。

##### State ownership

入力をDnDとして解釈するために必要な一時状態だけを所有する。Reorder Mode、移動対象の成立可否と移動不可理由、移動対象、現在の移動先、確定可能性、Tableデータ、Presentation状態は所有しない。

##### Contract

Reorder Modeから現在の並び替え状態を受け取り、WordPress編集環境からPCまたはタッチ端末の入力を受け取る。

現在の並び替えモードでDnDの開始を試みる入力が成立した場合は、開始対象を開始試行としてDnD Interactionへ渡す。開始対象が移動可能かどうかはInput Interactionでは判定せず、並び替え方向もDnD Interactionへ提供しない。

DnDが開始された後は、進行、完了、キャンセルとして解釈した入力をDnD Interactionへ渡す。DnD Interactionへ渡すContractには、PCとタッチ端末ごとの入力成立方法そのものを含めない。

DnD Interactionが現在のDnDをabortした場合は、そのDnDに属する入力解釈の一時状態を次の操作へ持ち越さない。

##### Lifecycle

並び替えモード中に対象となる入力を受けたときだけ、一時的な入力解釈状態を持つ。開始試行が移動可能な対象に対して成立してDnDが開始された場合は、完了、キャンセル、またはabortまで共通の進行情報をDnD Interactionへ渡す。

DnDが完了、キャンセル、abortされた場合、開始試行が移動不可で終了した場合、または入力がDnDとして成立しなかった場合は、次の操作へ不要な入力状態を持ち越さない。

##### Invariants

- PCとタッチ端末の入力固有の差をDnD Interactionの状態やContractに持ち込まない。
- DOM / Web APIを利用するためにEditor環境差を直接判定しない。
- DnD Interactionへ並び替え方向を提供しない。
- 移動対象として選択できるかを判定しない。
- 移動先の有効性を判定しない。
- Tableデータを変更しない。
- Reorder Presentationの表示状態を所有しない。
- Tableの全行・全列について個別の常駐Interaction状態を持つことを前提にしない。
- Table Integration、Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Updateに直接依存しない。
- DnD Interactionとの実装上の結合方式をArchitectureのContractとして固定しない。
- DnD終了後に前回の入力解釈状態を保持しない。

#### DnD Interaction {#RESP_DND_INTERACTION}

##### Responsibility

Input Interactionから受け取るDnDの開始試行と、開始後のDnDを入力方式および行・列に共通する1つの並び替え操作として統括する。DnD Interactionへ入る開始試行・進行・完了・キャンセルの1回ごとの処理をReorder operation boundaryとし、正常な完了だけでなく、外部環境変化またはReorder内部の不整合によって処理を継続できない場合の安全な終了も統括する。

開始試行ではReorder Target Resolutionの判定に基づいてDnDの開始または非開始を決め、開始後はReorder Sessionに移動対象、並び替え方向、制約情報、現在の移動先を保持し、有効な移動先で完了した場合だけ確定した並び替えをData Updateへ渡す。

##### State ownership

成立した1回のDnDに対応するReorder Sessionを所有する。同時にactiveなReorder Sessionは1つだけとする。

activeなReorder Sessionは、行または列のどちらを扱っているかを示す並び替え方向、移動対象、そのDnDで利用する制約情報を必須状態として保持する。現在の有効な移動先は存在しないことが正常にあり得るため、active中でも任意状態とする。

移動対象として選択できるかという判定規則、制約情報の導出規則、入力方式固有の一時状態、Tableデータ自体、視覚表示状態は所有しない。DnDをまたぐ制約情報のcacheは所有しない。

##### Contract

Input InteractionからDnDの開始試行・進行・完了・キャンセルを受け取る。開始試行に含まれる開始対象とReorder Modeが示す並び替え方向をReorder Target Resolutionに渡して移動対象解決を要求する。

Reorder Target Resolutionが移動可能と判定した場合だけ、返された移動対象と制約情報を含むReorder Sessionを開始し、DnDが開始した現在の移動対象と進行状態をReorder Presentationに提供する。開始対象が正常に利用不可である場合はReorder Sessionを開始せず、その理由をReorder Presentationに提供する。

進行中はReorder Sessionから現在の移動対象、並び替え方向、制約情報を取り出し、現在位置とともにDrop Target Resolutionへ渡して移動先判定を求める。有効な移動先が存在しないという結果は正常な操作状態として扱い、内部不整合またはabort理由にはしない。判定結果はReorder Sessionの現在状態として保持し、Reorder PresentationとAuto Scrollが必要とする進行状態を提供する。

完了時に有効な移動先がある場合だけ、移動対象と移動先を含む確定した並び替えをData Updateに渡す。完了時に有効な移動先が存在しない場合は異常とは扱わず、確定した並び替えを生成しない。

cancelは、正常に開始されたactiveなReorder Sessionに対する利用者操作としての終了を表す。cancelではData Updateに何も渡さず、Reorder Presentationにキャンセル結果を提供する。

abortは、外部環境の変化またはReorder内部のContract / Invariant不整合によって現在の操作を継続できない場合の安全な終了を表す。abortはactiveなReorder Sessionの存在を前提とせず、存在するReorder SessionとDnDに属する一時状態を終了し、activeなReorder Sessionが存在しないDnD idle状態へ戻す。abort自身は新たなData Updateを開始せず、Reorder Modeを変更しない。

Data Updateを開始した後に更新処理を完了または確認できなくなった場合も同じabort Contractへ合流する。ただし、abortはすでに開始された更新へ自動retryまたはrollbackを要求せず、その時点のTable状態を外部状態として尊重してDnDだけを終了する。

Reorder内部で正常に存在しない状態は、その責務のContractで不在結果として扱う。現在のEditor、Table、外部データなどReorder外部の変化により継続できない場合は開始不可またはabortとして扱う。activeなReorder SessionなどReorder自身が成立させた状態の矛盾は正常な不在へ読み替えず、operation boundaryから共通abortへ合流させる。

別の実行タイミングで継続する処理であっても、同じReorder Sessionに属する処理不能を独自の復旧規則で扱わず、同じabort Contractへ合流させる。

##### Lifecycle

並び替えモード中にInput InteractionからDnDの開始試行を受ける。Reorder Target Resolutionが移動可能と判定した場合だけReorder Sessionを開始し、完了、キャンセル、またはabortまでactiveを維持する。その間だけ移動対象、並び替え方向、制約情報、移動先などを保持する。

移動不可と判定された場合はactiveにならず、理由をReorder Presentationへ渡して開始試行を終了する。

completeおよびcancelはactiveなReorder Sessionに対してだけ成立する。progressもactiveなReorder SessionのLifecycle中だけ成立する。

正常完了またはcancel時は必要な結果を渡した後、Reorder Sessionとその制約情報を破棄する。abort時は現在のReorder operationがどの段階にあるかにかかわらず、存在するReorder SessionとDnDに属する一時状態を終了し、DnD idleへ戻す。次のDnD開始試行では、その時点の共通Table structureから新しい制約情報が導出される。

##### Invariants

- 同時にactiveなReorder Sessionは1つだけとする。
- activeなReorder Sessionには並び替え方向、移動対象、制約情報が必ず存在する。
- activeなReorder Sessionの並び替え方向と移動対象の種別は一致する。
- 有効な移動先が存在する場合、その種別はactiveなReorder Sessionの並び替え方向と一致する。
- progress、complete、cancelはactiveなReorder Sessionに対してだけ成立する。
- Reorder Target Resolutionが移動可能と判定していない対象からDnDを開始しない。
- 移動不可な開始試行ではReorder Sessionを作らない。
- Reorder Target Resolutionが提供した制約情報を成立したReorder Sessionの外へ持ち越さない。
- DnDをまたぐconstraint cache、structure revision、cache invalidationを所有しない。
- Drop Target ResolutionへReorder Session自体を渡さず、判定に必要な値だけを渡す。
- DnD開始前にDrop Target Resolutionを移動対象判定へ利用しない。
- 入力方式固有の状態を所有しない。
- 行と列でLifecycle、destination更新、commit、cancel、abortのContractを分岐させない。
- DnD中にTableデータを変更しない。
- 有効な移動先なしに確定した並び替えを生成しない。
- 確定した並び替えはactiveなReorder Sessionの有効な移動先からだけ生成する。
- cancel時はData Updateへ更新要求を渡さない。
- abort自身は新たなData Updateを開始しない。
- abortは開始済みData Updateのretryまたはrollbackを担わない。
- 完了、キャンセル、abort後に前回のReorder Session状態を次のDnDへ保持しない。
- Data Updateへ渡す時点で並び替えは確定済みである。
- Reorder Sessionの復旧によってReorder Modeを変更しない。
- Table Integrationに直接依存しない。

#### Reorder Target Resolution {#RESP_REORDER_TARGET_RESOLUTION}

##### Responsibility

DnD開始試行時に、Table Integrationが提供する現在の共通Table structureから、行DnDではbody sectionの行だけ、列DnDではTable全体の列を移動対象として選択できるか判定する。同時に、行DnDではbody section、列DnDではTable全体の構造保持に必要な制約情報を導出する。

行では縦結合、列では横結合に由来する移動対象可否と、対象方向の結合を分断しない移動先判定に必要な制約を扱う。結合範囲を越える移動自体は制限しない。

##### State ownership

永続的なDnD状態、Tableデータ、共通Table structure、制約情報のLifecycleを所有しない。現在の開始試行について、開始対象、並び替え方向、現在の共通Table structureを入力として扱う。

##### Contract

DnD Interactionから開始対象と行または列の並び替え方向に対応する解決要求を受け取り、Table Integrationへ対象Tableの現在の共通Table structureを要求する。

行DnDでは共通Table structure上のbody sectionの行だけ、列DnDではTable全体の列だけを移動対象候補として扱う。共通Table structureを取得でき、開始対象が対象範囲内で移動対象として成立する場合は、移動対象の解決結果と、そのDnD中の移動先判定で利用する制約情報を返す。行DnDの制約情報はbody section、列DnDの制約情報はTable全体の構造保持に必要な情報として導出する。

開始対象が移動対象として成立しない場合は正常な開始不可として理由を返す。現在の共通Table structureを外部状態から安全に取得できない場合もReorder内部のInvariant違反とは扱わず、DnD Interactionが開始しないための利用不可結果を返す。

制約情報を導出するが、そのLifecycleは所有しない。個々の開始試行を越えて制約情報や判定結果を保持しない。

##### Lifecycle

DnD InteractionからDnD開始試行に対応する解決要求を受けたときだけ、その時点の共通Table structureから判定と制約情報導出を行う。並び替えモードへ入った時点では全行・全列の移動可否を事前判定しない。

移動可能な場合に提供した制約情報はDnD Interactionが開始するReorder Sessionに引き継がれ、Reorder Target Resolution自体は保持しない。次のDnD開始試行では、その時点の共通Table structureから改めて導出する。

##### Invariants

- DnD開始試行時の移動対象成立可否と、そのDnDで使う制約情報の導出だけを担い、DnD開始後の移動先判定を担わない。
- Table Block固有の構造表現を直接扱わず、Table Integrationが提供する共通Table structureを利用する。
- 並び替えモード中の対象表示のために利用しない。
- 行DnDでは共通Table structure上のbody sectionの行だけを移動対象候補として扱う。
- 列DnDではTable全体の列だけを移動対象候補として扱う。
- 行では縦結合によって一体化された範囲の一部を移動対象として返さず、横結合だけを理由に移動不可と判定しない。
- 列では横結合によって一体化された範囲の一部を移動対象として返さず、縦結合だけを理由に移動不可と判定しない。
- 行ではbody sectionの構造、列ではTable全体の構造を保持し、縦結合または横結合を分断する移動先を許可しないための制約情報を導出する。
- 結合範囲を越えること自体を禁止する制約情報にはしない。
- 制約情報のLifecycleを所有しない。
- DnDをまたぐ制約情報を再利用しない。
- 移動対象解決によってTableデータを変更しない。
- 外部Table状態を安全に取得できないこと自体をReorder内部のInvariant違反として扱わない。
- Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Updateに依存しない。

#### Drop Target Resolution {#RESP_DROP_TARGET_RESOLUTION}

##### Responsibility

開始済みの行または列DnDに対して、DnD Interactionから渡された移動対象、並び替え方向、制約情報、現在位置を入力として、行DnDではbody section内の行間、列DnDではTable全体の列間から有効な移動先を判定する。対象方向の結合を分断する位置は有効な移動先として返さない。

##### State ownership

永続的なDnD状態、Tableデータ、共通Table structure、制約情報のLifecycleを所有しない。現在の判定入力だけを扱い、Reorder Session自体は所有または参照しない。

##### Contract

activeなDnD Interactionから現在の移動対象、行または列の方向、そのDnDで利用する制約情報、現在位置を受け取る。

行DnDではbody section内の行間、列DnDではTable全体の列間を移動先候補として扱う。行DnDではbody section、列DnDではTable全体の構造を保ち、対象方向の結合を分断しない場合だけ有効な移動先を返す。現在位置が対象範囲内の有効な移動先に対応しない場合は、有効な移動先なしという正常な結果を返す。

Table全体の構造を参照または再解析せず、DnD開始前の開始対象に対する判定結果は返さない。

##### Lifecycle

DnD Interactionがactiveの間に必要に応じて判定を行う。現在位置が変化して判定を繰り返す場合も、Reorder Sessionに保持された同じ制約情報をDnD Interactionから判定入力として受け取り、Table全体を再解析しない。

DnDが開始していない間は移動先判定を行わず、完了、キャンセル、abort後に個々の判定結果や制約情報を独立した状態として保持しない。

##### Invariants

- DnD開始後の移動先だけを判定する。
- DnD開始前の移動対象成立可否を判定しない。
- Reorder Session自体に依存しない。
- Table IntegrationやTable全体の構造を参照しない。
- 渡された制約情報を再導出しない。
- 行DnDではbody section内の行間だけを移動先候補として扱う。
- 列DnDではTable全体の列間を移動先候補として扱う。
- 行DnDではbody sectionの構造、列DnDではTable全体の構造を保持する移動先だけを有効とする。
- 行DnDでは縦結合、列DnDでは横結合を分断する位置を有効な移動先として返さない。
- 結合範囲を越えることだけを理由に移動先を無効としない。
- 有効な移動先が存在しない状態を内部不整合として扱わない。
- 移動先判定によってTableデータを変更しない。
- Reorder Target Resolution、Reorder Presentation、Data Updateに直接依存しない。

#### Reorder Presentation {#RESP_REORDER_PRESENTATION}

##### Responsibility

移動不可な対象からDnD開始が試みられた場合はその理由を示す。DnD開始後は現在の移動対象、現在の有効な移動先、移動先変更に伴って表示位置が変わる周囲の行・列を、Table上の実際の順番を変更せずに表示する。

確定時は移動対象を最終位置へ自然につなぎ、cancel時は元の位置へ戻す表示を扱う。abort時は、現在のTable状態を変更せず、DnDに属する一時的な表示状態を破棄する。

##### State ownership

移動不可理由の一時表示、進行中のDnDに対応する現在の移動対象の表示状態、挿入線、表示位置が変わる周囲の行・列の一時的な表示状態、確定・cancel時の表示遷移状態を所有する。

Tableデータ、移動対象成立可否の判定規則、並び替え制約、移動先の有効性、DnDの開始判断と確定判断は所有しない。

##### Contract

DnD InteractionからDnD開始後の現在の移動対象を受け取り、その移動対象を視覚的に示す。この方針はPCとタッチ端末で共通とする。並び替えモードへ入っただけでは全行・全列の対象表示を開始しない。

DnD Interactionから移動不可な開始試行の理由を受け取った場合は、その理由を利用者が確認できる一時的なフィードバックとして表示する。この表示によってDnDを開始した状態にはしない。

DnD Interactionから開始後の移動対象と現在の有効な移動先を受け取り、行では水平、列では垂直の挿入線として移動先を表現する。有効な移動先が変われば挿入線も追従する。

移動先が変わった場合は、移動対象が入る空間を空けるために実際に表示位置が変わる周囲の行・列だけを表示上移動させる。

ドラッグ中の移動対象は元のTable上での大きさとセルの配置関係を保つ。行ではTableの横方向、列ではTableの縦方向から不必要にはみ出さない表示範囲を保ち、その制約によってAuto Scrollを妨げない。

DnD Interactionから確定結果を受け取った場合は移動対象を最終位置へ自然につなぐ。cancel結果を受け取った場合は移動対象を元の位置へ戻す。

abort結果を受け取った場合は、移動対象の強調、挿入線、周囲の行・列の表示変化などDnD中だけの表示状態を終了する。abortによってTableデータを元へ戻す表示責務は持たず、その時点のTable状態と整合する表示へ戻る。

##### Lifecycle

移動不可な対象から開始が試みられた場合はDnD Interactionから受け取った理由の一時表示を開始し、利用者が内容を確認できる時間だけ表示した後に終了する。

DnD開始時に現在の移動対象表示とDnD用の表示状態を有効にし、進行中は移動対象、挿入線、必要な周囲の表示変化を更新する。確定またはcancel時は対応する表示遷移を完了させた後、移動対象表示を含むDnD用の一時状態を破棄する。

abort時は、通常の確定またはcancelの表示遷移完了を前提にせず、DnD用の一時状態を安全に破棄する。

DnDがactiveでなく、移動不可理由の一時表示も行っていない間は、行・列の対象表示状態を持たない。

##### Invariants

- Presentationの更新によってTable上の実際の行・列順序を変更しない。
- DOM / Web APIを利用するためにEditor環境差を直接判定しない。
- 並び替えモードへ入っただけで全行・全列の対象表示を開始しない。
- 移動対象表示のためにReorder Target Resolutionを直接利用しない。
- 移動不可理由を表示するためにDnDを開始しない。
- 移動不可理由の表示は一時的なフィードバックとし、次のDnDの進行状態として保持しない。
- PCとタッチ端末で現在の移動対象を示す方針を変えない。
- 行の移動先は水平の挿入線、列の移動先は垂直の挿入線で示す。
- 無効な移動先に確定可能な挿入線を表示しない。
- 移動先変更時に表示上移動させるのは、実際に表示位置が変わる行・列だけとする。
- 移動先変更に合わせて無関係な行・列を一斉に移動させない。
- ドラッグ中の行は空セルを含んでも行全体の横幅や各セル幅を保つ。
- ドラッグ中の列は空セルを含んでも列全体の幅や各セル高さを保つ。
- ドラッグ中の行はTableの横方向、列はTableの縦方向から不必要にはみ出さない。
- 表示範囲の制約によって必要なAuto Scrollを妨げない。
- 確定、cancel、abortの表示処理によってTableデータ更新の責務を持たない。
- abort後に前回のDnD用表示状態を保持しない。
- Reorder ModeとTable Integrationに直接依存しない。

#### Auto Scroll {#RESP_AUTO_SCROLL}

##### Responsibility

Tableが画面内に収まらない場合でも、進行中のDnDの移動方向に沿って並び替えを継続できるようにする。

##### State ownership

DnD中に現在自動スクロールの対象となる方向と、そのDnDに属する一時的な自動スクロール状態を扱う。Reorder Mode、移動対象、移動先、Tableデータは所有しない。

##### Contract

DnD Interactionから進行中の並び替え方向を受け取る。行DnDでは縦方向、列DnDでは横方向だけを自動スクロール対象とする。

DnDを開始していない通常状態、および移動不可な開始試行では、この方向制限を通常のTableや編集画面のスクロールへ適用しない。

DnD Interactionが現在のDnDを完了、cancel、abortした場合は、そのDnDに属する自動スクロールを終了する。

##### Lifecycle

DnD中に必要な場合だけ有効になる。移動不可な開始試行では有効にならない。DnDの完了、cancel、abortで終了し、方向制限や一時状態を次のDnDへ持ち越さない。

別の実行タイミングで自動スクロール処理が継続する場合でも、現在のReorder Sessionを継続できない状態は独自の復旧にせず、DnD Interactionの共通abortへ合流する。

##### Invariants

- DOM / Web APIを利用するためにEditor環境差を直接判定しない。
- 行DnD中は横方向を自動スクロールしない。
- 列DnD中は縦方向を自動スクロールしない。
- activeなDnD中だけ移動方向に応じた自動スクロール制約を適用する。
- 完了、cancel、abort後に前回の自動スクロール状態を保持しない。
- Table Integration、Reorder Target Resolution、Drop Target Resolution、Data Updateの責務を担わない。

#### Data Update {#RESP_DATA_UPDATE}

##### Responsibility

DnD Interactionから受け取った確定済みの並び替えを、Table Integrationを通じて対象Tableに反映する。行DnDでは共通Table structure上のbody sectionの行順だけ、列DnDではTable全体の列順だけを変更し、セルの内容、属性、装飾その他の保持すべき情報を維持する。

##### State ownership

確定した並び替えをTableデータへ反映する責務を所有する。DnDの進行状態、Presentation、並び替え制約、移動対象判定、移動先判定は所有しない。Tableデータそのものの永続的な所有者にはならない。

##### Contract

DnD Interactionから、有効な移動先で完了した確定済みの並び替えだけを受け取る。

行DnDでは共通Table structure上のbody sectionの行順だけ、列DnDではTable全体の列順だけを変更する確定結果を、対象Tableへ反映するようTable Integrationに要求する。具体的なTable Blockのデータ構造や更新方法は扱わない。

1回の確定した並び替えを複数の独立した部分更新へ分割せず、Table Integrationへ1つの更新単位として反映要求する。成立した更新は1回のUndoで並び替え前へ戻せる単位とする。

更新を開始できない、または開始後に外部状態の変化などによって更新結果を完了または確認できない場合は、その結果をReorder operation boundaryへ返す。DnDのabort Contractは開始済み更新のretryまたはrollbackをData Updateへ要求しない。更新開始後に失敗した場合は、その時点のTable状態を外部状態として正とし、Data Updateから追加の更新を開始しない。

##### Lifecycle

確定済みの並び替えを受け取ったときだけ動作する。Table Integrationへの1つの反映要求を行い、その結果をReorder operation boundaryへ返した後にDnDの一時状態を保持しない。移動不可な開始試行、cancel、無効なDnDでは動作しない。

更新開始前に処理不能となった場合はTable Integrationへ新たな更新要求を行わない。更新開始後に処理不能となった場合は、すでに開始された更新に対する自動retryまたはrollbackをData UpdateのLifecycleとして開始しない。

##### Invariants

- 確定していないDnDからTableデータを変更しない。
- 1回の確定した並び替えを複数回Tableデータへ反映しない。
- 1回の確定した並び替えを複数の独立した部分更新へ分割しない。
- 行DnDで変更するのは共通Table structure上のbody sectionの行順だけとする。
- 列DnDで変更するのはTable全体の列順だけとする。
- セルの内容、属性、装飾その他の保持すべき情報を維持する。
- テキスト、画像、RichTextその他のセル内容の種類によって並び替えの扱いを変えない。
- 1回の成立した並び替えを1回のUndoで戻せる状態を維持する。
- 具体的なTable Blockのデータ構造や更新方法を扱わない。
- Table Integration以外を介して対象Tableを直接更新しない。
- Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scrollから直接更新要求を受け取らない。
- 更新失敗時のDnD Session復旧またはReorder Mode変更を所有しない。
- 開始済み更新への自動retryまたはrollbackをDnD復旧の一部として行わない。

## 6. Runtime View

### DnD start with movable target {#RV_DND_START_MOVABLE}

移動可能な対象からDnD開始が試みられ、その時点の共通Table structureから移動対象と制約情報を解決してactiveなReorder Sessionが成立し、現在の移動対象表示を開始するまでの協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 開始対象を含むDnD開始試行をReorder operation boundaryへ渡す。 |
| 2 | RESP_REORDER_MODE | RESP_DND_INTERACTION | 現在の並び替え方向を提供する。 |
| 3 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | 開始対象と並び替え方向に対する移動対象解決を要求する。 |
| 4 | RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 対象Tableの要求時点の共通Table structureを要求する。 |
| 5 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 移動対象と、そのDnDで利用する制約情報が解決されたことを通知する。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | DnDが開始した現在の移動対象と進行状態を提供し、移動対象表示を開始させる。 |
| 7 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | activeなDnDと並び替え方向を提供する。 |

### DnD start without movable target {#RV_DND_START_IMMOVABLE}

開始対象が移動対象として成立しない、または現在の外部Table状態から安全に開始できない場合に、Reorder Sessionを作らず開始試行を終了する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 開始対象を含むDnD開始試行をReorder operation boundaryへ渡す。 |
| 2 | RESP_REORDER_MODE | RESP_DND_INTERACTION | 現在の並び替え方向を提供する。 |
| 3 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | 開始対象と並び替え方向に対する移動対象解決を要求する。 |
| 4 | RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 対象Tableの要求時点の共通Table structureを要求する。 |
| 5 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 開始不可であることと、提供可能な理由を通知する。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 利用者へ示す理由がある場合は、DnDを開始せず一時表示するために渡す。 |

### DnD progress {#RV_DND_PROGRESS}

開始済みDnDの進行に応じて、Reorder Sessionに保持された制約情報をDnD Interactionから判定入力として渡し、行ではbody section、列ではTable全体の構造保持条件を使ってTable全体を再解析せずに移動先、表示、自動スクロールを更新する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 現在位置に対応するDnD進行情報をReorder operation boundaryへ渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | 現在の移動対象、並び替え方向、制約情報、現在位置を渡し、行ではbody section内の行間、列ではTable全体の列間について移動先判定を要求する。 |
| 3 | RESP_DROP_TARGET_RESOLUTION | RESP_DND_INTERACTION | 対象範囲の構造保持条件を満たす有効な移動先、または有効な移動先なしという正常な判定結果を通知する。 |
| 4 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 移動対象と現在の有効な移動先を提供し、挿入線と必要な周囲の表示変化を更新させる。 |
| 5 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | activeなDnDと並び替え方向を提供する。 |
| 6 | RESP_AUTO_SCROLL | EXT_SCROLL_AREA | 行では縦方向、列では横方向に必要な自動スクロールを行う。 |

### DnD commit {#RV_DND_COMMIT}

有効な移動先でDnDが完了し、Table Integrationを通じて`FR-13`で定義される対応Table Blockへ1つの更新単位として確定結果を反映してReorder Sessionを終了する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnD完了をReorder operation boundaryへ渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DATA_UPDATE | 移動対象と有効な移動先を含む確定済みの並び替えを渡す。 |
| 3 | RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定済みの並び替えを1つの更新単位として反映するよう要求する。 |
| 4 | RESP_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Block固有の方法で行または列の位置を更新する。 |
| 5 | RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 成立した1回の並び替えを1回のUndoで戻せる更新単位として成立させる。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。 |

### DnD cancel {#RV_DND_CANCEL}

開始済みDnDが利用者操作としてキャンセルされ、Tableデータを変更せず表示状態とReorder Sessionを終了する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | activeなReorder Sessionに対するDnDキャンセルをReorder operation boundaryへ渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | cancel結果を提供し、移動対象を元の位置へ戻す表示を完了させる。 |
| 3 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | 現在のDnDが終了したことを提供し、自動スクロールの一時状態を終了させる。 |

Data UpdateへのInteractionは発生しない。Reorder Modeは変更しない。

### DnD abort {#RV_DND_ABORT}

外部環境の変化またはReorder内部の不整合によって現在のDnDを継続できない場合に、正常なcancelとは別の安全終了としてReorder SessionとDnD一時状態を終了する協調を示す。別の実行タイミングで処理不能が判明した場合も、独自の復旧を行わずこの共通abortへ合流する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | abort結果を提供し、DnD中だけの表示状態を破棄させる。 |
| 2 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | abort結果を提供し、DnDに属する自動スクロール状態を終了させる。 |
| 3 | RESP_DND_INTERACTION | RESP_INPUT_INTERACTION | 現在のDnDが終了したことを提供し、入力解釈の一時状態を次の操作へ持ち越さないようにする。 |

abort自身は新たなData Updateを開始せず、Reorder Modeを変更しない。Reorder Sessionはこのシナリオの終了時にactiveではない。

### Data Update failure after update start {#RV_DATA_UPDATE_FAILURE}

確定済みの並び替えについて外部更新を開始した後に処理を完了または確認できなくなった場合に、更新のrollbackをDnD復旧へ持ち込まず、現在のTable状態を正として共通abortへ合流する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 有効な移動先でのDnD完了をReorder operation boundaryへ渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DATA_UPDATE | 確定済みの並び替えを渡す。 |
| 3 | RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定済みの並び替えを1つの更新単位として反映するよう要求する。 |
| 4 | RESP_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 対応Table Blockへの外部更新を開始する。 |
| 5 | RESP_TABLE_INTEGRATION | RESP_DATA_UPDATE | 外部状態の変化などにより更新を完了または確認できない結果を返す。 |
| 6 | RESP_DATA_UPDATE | RESP_DND_INTERACTION | 更新失敗結果をReorder operation boundaryへ返す。 |
| 7 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 共通abortとしてDnD中だけの表示状態を破棄させる。 |
| 8 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | 共通abortとしてDnDに属する自動スクロール状態を終了させる。 |
| 9 | RESP_DND_INTERACTION | RESP_INPUT_INTERACTION | 共通abortとして入力解釈の一時状態を次の操作へ持ち越さないよう終了させる。 |

このシナリオでは、abortから開始済み更新への自動retryまたはrollbackを行わない。更新済みか未更新かをDnD復旧側で上書きせず、その時点のTable状態を外部状態として扱う。

## 8. Crosscutting Concepts

### State ownership

- 現在の通常、行並び替え、列並び替えの状態はReorder Modeが所有する。
- PCとタッチ端末ごとの初回案内の表示済み状態はFirst-use Guidanceが所有する。
- 再案内を判定するための直近の操作傾向と、同じ状況で過度に再案内しないための一時状態はReorder Rediscoveryが所有する。
- 現在のeditor DOM contextはEditor DOM Contextが必要な時点で解決して提供し、editor lifecycleをまたぐ永続的なYTR状態として所有しない。
- Table IntegrationはTableデータ、共通Table structure、Tableごとの状態、監視状態、DnD状態、Reorder Session、制約情報を所有しない。
- PCとタッチ端末の入力固有の解釈に必要な一時状態はInput Interactionが所有し、移動対象、移動先などのReorder Session状態は所有しない。
- DnD開始試行時の移動対象可否と、そのDnDで使用する制約情報はReorder Target Resolutionが現在の共通Table structureから導出するが、制約情報のLifecycleは所有しない。
- 進行中のDnD、移動対象、並び替え方向、制約情報、現在の移動先はDnD InteractionがReorder Sessionとして所有する。移動不可な開始試行ではReorder Sessionを作らない。
- 移動先の有効性そのものはDrop Target ResolutionがDnD開始後に判定し、Reorder Session、Table構造、制約情報を状態として所有しない。
- 移動不可理由の一時表示、DnD開始後の現在の移動対象、挿入線、周囲の行・列の表示変化、確定・cancel時の一時的な表示状態はReorder Presentationが所有する。
- Tableのデータは外部の対応Table Block側に存在し、YTR内で確定した並び替えを反映する責務はData Updateが所有し、Block固有の反映方法はTable Integrationが提供する。

### Failure classification and recovery boundary

Reorderが扱う処理不能状態は、責務境界の意味に応じて次の3種類を区別する。

- **正常な不在**: その責務のContract上、値や対象が存在しないことが正常に起こり得る状態。通常編集時に並び替え方向が存在しないこと、現在位置に有効なdestinationが存在しないこと、DnD開始前に対象を安全に解決できないことなどは、成立するContract結果として扱う。
- **外部環境の変化による処理不能**: Editor context、対象Table、外部TableデータなどReorderが所有しない状態の変化によって現在の処理を継続できない状態。Reorder Session開始前であれば開始しない。activeなReorder Session中であれば共通abortへ移行する。
- **内部Contract / Invariantの不整合**: activeなReorder Sessionに必須状態が存在しないなど、Reorder自身が成立させた状態の矛盾。正常な不在へ読み替えず、そのoperationを継続せず共通abortへ移行する。

この分類は具体的な検出手段、Error表現、記録方法を規定しない。それらはimplementationの責務とし、Architectureでは責務境界から見た意味と復旧先だけを固定する。

### Reorder operation boundary

DnD Interactionへ入る1回の開始試行、進行、完了、キャンセルをReorder operation boundaryとする。DnD InteractionはReorder Sessionを所有するため、操作を継続できない結果を各内部責務から受け取った場合の復旧をこの境界へ集約する。

Reorder Target Resolution、Drop Target Resolution、Data Updateなど個々の責務は、自身のContract結果を境界へ返すが、DnD Session全体の復旧Lifecycleを所有しない。

別の実行タイミングで継続する処理が存在する場合でも、同じReorder Sessionに属する外部環境変化または内部不整合は独自の復旧規則を作らず、共通abort Contractへ合流する。処理の同期・非同期という実現方式によって、Reorder Sessionの最終状態や復旧方針を変えない。

### cancel and abort

cancelは正常に開始されたactiveなDnDを利用者操作として終了する。activeなReorder Sessionを前提とし、Tableデータを更新せず、cancel用の表示遷移を経てReorder SessionとDnD一時状態を終了する。

abortは外部環境変化または内部不整合から安全に復旧するための終了であり、activeなReorder Sessionの存在を前提にしない。abortは存在するReorder Session、Input InteractionのDnD入力一時状態、Reorder PresentationのDnD表示一時状態、Auto ScrollのDnD一時状態を終了し、activeなReorder Sessionが存在しないDnD idleへ戻す。

DnD idleはReorder Modeの通常編集状態を意味しない。Reorder ModeとDnD Interactionは別の状態を所有するため、abortによってReorder Mode自体を終了しない。

abort自身は新たなData Updateを開始しない。Data Updateがすでに開始されている場合は、その更新に対する自動retryまたはrollbackをabortの責務に含めない。

### Architecture-wide invariants

- DOM / Web APIを利用する責務はEditor DOM Contextが提供する現在のeditor contextを利用し、`QR-02`で保証対象とするEditor環境差を直接扱わない。
- Editor DOM Contextは現在のeditor contextに属する基準からcontextを解決し、editor lifecycleをまたいだ有効性を前提にしない。
- Editor DOM Contextのcontext解決と、Reorder Mode、Reorder Session、Tableデータ、移動対象、移動先の状態所有を分離する。
- Reorder coreは具体的な対応Table Blockに依存せず、Block固有の構造表現とデータ操作方法をTable Integrationの境界から他責務へ漏らさない。
- Table Integrationは外部Table Block固有のsection表現を共通Table structureのhead / body / footへ適応し、Reorder coreは外部側の表現へ依存しない。
- Table Integrationは状態、Table監視、Reorder固有の移動対象判定、制約情報導出、移動先判定を所有しない。
- Table Integrationに直接依存するYTR責務はReorder Target ResolutionとData Updateに限定する。
- PCとタッチ端末の入力固有の差をDnD Interaction以降の共通処理へ持ち込まない。
- DnD InteractionがReorder Target Resolutionに渡す並び替え方向はReorder Modeの現在状態から得る。Input Interactionを並び替え方向の情報源にしない。
- 行DnDの移動対象と構造保持範囲は共通Table structure上のbody section、列DnDの移動対象と構造保持範囲はTable全体とする。
- Reorder Target ResolutionはDnD開始試行ごとに要求時点の共通Table structureから、行ではbody sectionの行、列ではTable全体の列を移動対象として判定し、対応する範囲の構造保持に必要な制約情報を導出する。
- Reorder Target Resolutionは制約情報のLifecycleを所有せず、成立したReorder SessionがDnD完了、cancel、abortまで保持する。
- 制約情報をDnDをまたいで再利用せず、constraint cache、structure revision、cache invalidationをArchitectureの前提にしない。
- Drop Target ResolutionはDnD Interactionから渡された判定入力だけを利用し、行ではbody section内の行間、列ではTable全体の列間を移動先候補として扱う。Reorder Session自体、Table Integration、Table全体の構造には依存しない。
- 行並び替えでは縦結合、列並び替えでは横結合に由来する制約を扱い、対象方向の結合を分断する移動を禁止する。
- 結合範囲を越える移動自体は禁止しない。
- Table全体を並び替え用の中間構造としてDnDをまたいで保持せず、セル数に比例する並び替え用中間オブジェクトを常駐させない。
- 移動対象として成立しない行または列からDnDを開始しない。
- 行の移動対象判定では縦結合による移動不可を扱い、横結合だけを理由に不要な制限を掛けない。
- 列の移動対象判定では横結合による移動不可を扱い、縦結合だけを理由に不要な制限を掛けない。
- Reorder Target ResolutionはDnD開始試行時だけ移動対象判定を行い、並び替えモードへの移行だけを契機に全行・全列を事前判定しない。
- Reorder Presentationは並び替えモードへ入っただけでは全行・全列の対象表示を開始せず、DnD開始後の現在の移動対象だけを表示対象として扱う。
- Reorder PresentationはReorder ModeとReorder Target Resolutionを直接利用しない。
- Drop Target ResolutionはDnD開始前の移動対象判定を担わない。
- DnD InteractionのLifecycle、destination更新、commit、cancel、abortのContractは行と列で共通とする。
- activeなReorder Sessionは1つだけとし、必須状態の整合性を維持する。
- DnD中はTable上の実際の行・列順序を変更しない。
- 有効な移動先でDnDが完了した場合だけTableデータを変更する。
- 無効な移動先では確定可能な挿入線を表示せず、並び替えを確定しない。
- Reorder Presentationの表示更新はTableデータの更新責務を持たない。
- 移動先変更に伴う表示上の移動は、実際に表示位置が変わる行・列に限定し、無関係な行・列を一斉に移動させない。
- 行のDnD中に自動スクロールする方向は縦方向だけとし、列のDnD中は横方向だけとする。
- 完了、cancel、abort後はReorder SessionとそのDnDに属する一時状態を次のDnDへ持ち越さない。
- abortによってReorder Mode自体を変更しない。
- Data UpdateとTable Integrationは1回の確定した並び替えを1つの更新単位として扱う。
- Data Update開始後の失敗に対するretryまたはrollbackをDnD Session復旧の責務に含めない。

### Lifecycle and context boundaries

Editor DOM Contextが提供するcontextは、その時点のeditor lifecycleに属するものとして扱う。DOM / Web APIを利用する責務は、以前のeditor lifecycleで得たcontextの永続性を前提にせず、現在のeditor contextが必要な時点ではEditor DOM Contextを境界として扱う。Editor DOM Context自体も以前のcontextを現在のcontextとして持ち越さない。

Table Integrationは構造取得または更新を要求された時点で対象Tableの現在データを利用し、構造取得では共通Table structureを提供し、更新では確定した並び替えを対象Tableへ1つの更新単位として反映する。取得した構造やTableデータを次の要求へ持ち越さず、Tableの追加・削除・構造変更を監視せず、構造のrevisionやcache invalidationをLifecycleとして所有しない。

Reorder Modeが通常状態にある間はInput InteractionからDnD Interactionへの開始試行を成立させない。行または列の並び替えモードへ入った後に、その方向のDnD開始を試行できる。

Input Interactionの入力固有の一時状態は、その入力をDnDの開始試行・進行・完了・キャンセルとして扱うために必要な期間だけ有効とする。DnDが完了、cancel、abortされた場合、Reorder Target Resolutionにより開始不可と判定された場合、または入力がDnDとして成立しなかった場合は、次の操作へ不要な入力状態を持ち越さない。

Reorder Target Resolutionは開始試行ごとに、その時点の共通Table structureから、行ではbody sectionの行、列ではTable全体の列について移動対象可否を判定し、対応する範囲の構造保持に必要な制約情報を導出する。移動可能な場合だけDnD InteractionがReorder Sessionを開始し、制約情報をそのSessionに保持する。

Drop Target ResolutionはactiveなDnD中に必要に応じて、行ではbody section内の行間、列ではTable全体の列間について移動先を判定する。現在位置が変化してもTable全体を再解析せず、DnD InteractionがReorder Sessionから取り出した同じ制約情報を判定入力として利用する。個々の判定結果を完了、cancel、abort後に保持しない。

DnDに属する状態は1回の成立した操作中だけ有効とする。完了、cancel、abort時に、移動対象、並び替え方向、制約情報、移動先、DnD用Presentation、自動スクロール、入力解釈に関する一時状態を次のDnDへ持ち越さない。次の開始試行では現在の共通Table structureから改めて制約情報を導出する。

Reorder Presentationは、移動不可な開始試行ではDnD Interactionから受け取った理由を一時的に表示する。DnD開始後は現在の移動対象表示を開始し、移動先と周囲の表示変化を扱う。完了またはcancel時の表示遷移が終わった後にDnD用の一時状態を破棄し、abort時はその表示遷移完了を前提にせずDnD用の一時状態を破棄する。並び替えモードが継続していても全行・全列の対象表示へは移行しない。

abortによるDnD idle復帰とReorder ModeのLifecycleは分離する。行または列の並び替えモード中にabortした場合、現在のDnDだけを終了し、そのことだけを理由にReorder Modeを通常状態へ変更しない。

Data Update開始前にoperationを継続できなくなった場合は新たな更新を開始しない。Data Update開始後に継続できなくなった場合は、開始済み更新に追加のretryまたはrollbackを行わず、現在のTable状態を正としてDnD Sessionを終了する。

First-use Guidanceの表示済み状態はDnDのLifecycleとは分離し、利用者についてPCとタッチ端末でそれぞれ一度だけ表示するという基本設計の境界を維持する。

Reorder Rediscoveryの判定用状態は通常編集状態でのみ有効とし、並び替えモードへ入った場合や、同じ操作傾向として扱えない状態へ変わった場合は次の判定へ不要な履歴を持ち越さない。

## 10. Quality Requirements

### QR-01 Performance

大規模Tableの判定基準、想定最大規模、Performanceの保証範囲はQuality Requirementsの`QR-01`を正本とし、本書では数値を再定義しない。

`QR-01`の保証範囲でも、Editor DOM Context、Table Integration、Reorder Mode、First-use Guidance、Reorder Rediscovery、Input Interaction、DnD Interaction、Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Updateの責務分離を維持する。

Table全体の行数・列数・セル数に比例する並び替え用の常駐状態、常駐UI、中間オブジェクトを並び替え成立の前提にしない。Table Integrationが提供する共通Table structureとReorder Target Resolutionが導出する制約情報はDnDをまたぐ常駐cacheとせず、structure revisionやcache invalidationを必要とする設計を前提にしない。

DnD開始試行ではReorder Target Resolutionがその時点の共通Table structureから移動対象判定と制約情報導出を行う。成立したDnDでは、その制約情報をReorder Sessionに保持してDrop Target Resolutionの複数回の移動先判定に利用し、現在位置が変わるたびにTable全体を再解析しない。

Reorder Target ResolutionはDnD開始試行時だけ移動対象を判定する。並び替えモードへの移行だけを契機に全行・全列を事前判定したり、Presentationの表示更新からReorder Target Resolutionを再評価したりすることを共通Contractの前提にしない。

Drop Target Resolutionに必要な状態評価とReorder Presentationの表示更新は責務として分離し、表示更新が再びTable全体の状態評価を要求する循環をDnDの進行経路に作らない。

DnD中はTable上の実際の順序を変更せず、destinationと必要なPresentation状態だけを更新する。Reorder Presentationは、ドラッグ中の移動対象、移動先、実際に表示位置が変わる行・列を中心に表示更新の対象を限定し、無関係な行・列まで一斉に表示更新や移動の対象へ含めない。

1回の有効なDnDの確定に対して、Data Updateがlogicalな並び替えをTable Integrationへ反映要求する機会は1回だけとする。DnDの進行中やdestinationの変更ごとにTableデータ更新を発生させない。

これらは実装方式を固定するものではない。具体的な性能最適化手段はimplementationで選択し、本書では上記の責務境界と制約だけをContractとする。

### QR-02 Compatibility

対応するTable Blockの正本はFunctional Requirementsの`FR-13`、対応するWordPress / Editor環境の正本はQuality Requirementsの`QR-02`とし、本書では具体的な対象を再列挙しない。

Table Block差はTable Integrationが吸収し、Reorder coreは共通Table structureと共通更新Contractだけを扱う。対応Table Blockの追加・削除によってReorder coreの責務モデルを変更しない。

Editor環境差はEditor DOM Contextが吸収し、DOM / Web APIを利用する責務は現在のeditor contextだけを要求する。Editor環境差によってInput Interaction、DnD Interaction、Reorder Presentation、Auto Scrollなどへ環境固有のcontext解決規則を持ち込まない。

Compatibilityは具体的なBlockやEditor環境ごとにReorder coreを分岐させることではなく、差分を外部境界へ閉じ込め、同じReorder責務とContractを利用できることで実現する。

### QR-03 Reliability / Robustness

異常な状況でも安全にReorderを終了し、その後のTable編集を継続できるという品質上の結果はQuality Requirementsの`QR-03`と基本設計の安全な終了を正本とする。本書では、その結果を成立させる内部責務境界を定義する。

DnD InteractionはReorder operation boundaryとReorder Sessionを所有し、正常な不在、外部環境変化、内部Contract / Invariant不整合を区別する。activeな操作を継続できない場合は、原因となった個別責務ごとに異なる復旧状態を作らず、共通abortへ合流する。

共通abortではReorder SessionとDnDに属するInput Interaction、Reorder Presentation、Auto Scrollの一時状態を終了し、activeなReorder Sessionが存在しないDnD idleへ戻す。Reorder Modeは別の状態所有者であるため、abortによって暗黙に終了しない。

Data UpdateとTable Integrationは、1回の確定した並び替えを1つの更新単位として扱う。外部更新開始後に処理を完了または確認できなくなった場合、DnD復旧は開始済み更新の自動retryまたはrollbackを担わず、その時点のTable状態を正としてDnDを終了する。

別の実行タイミングで継続する処理を導入しても、外部環境変化または内部不整合に対して独立した復旧規則を作らず、同じReorder operation boundaryの復旧Contractへ合流する。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| editor DOM context | 現在のeditorでDOM / Web APIを利用するために、その時点のeditor lifecycleに属するものとしてEditor DOM Contextが解決して提供するcontext。 |
| common Table structure | Table Integrationが要求時点の対応Table Block固有構造から提供する、Reorder coreが共通に扱うTable構造表現。外部Block固有のsection表現をhead / body / footとして表し、Table Integrationはこれを状態として保持しない。 |
| body section | 共通Table structure上でTable本文に属するsection。行DnDの移動対象範囲と構造保持範囲になる。 |
| reorder constraint information | DnD開始試行時にReorder Target Resolutionが現在の共通Table structureから導出し、成立したReorder Sessionが1回のDnD中だけ保持する、移動対象・移動先判定に必要な構造上の制約情報。 |
| Reorder Session | Reorder Target Resolutionが移動可能と判定した後から、完了、cancel、abortまでDnD Interactionが所有する1回の並び替え操作状態。active時は並び替え方向、移動対象、制約情報を必須とし、destinationは存在しない場合がある。 |
| Reorder operation boundary | DnD Interactionへ入る1回の開始試行、進行、完了、キャンセルを、正常完了または安全終了まで統括するArchitecture上の操作境界。 |
| DnD idle | activeなReorder Sessionが存在しないDnD状態。Reorder Modeの通常編集状態と同義ではない。 |
| start target | Input InteractionがDnD開始試行としてDnD Interactionに渡す、利用者がドラッグ開始を試みた行または列。 |
| reorder target | Reorder Target Resolutionが移動可能と判定し、DnD InteractionがactiveなReorder Sessionの移動対象として扱う行または列。行DnDではbody sectionの行、列DnDではTable全体の列に限定する。 |
| destination | Drop Target ResolutionがDnD開始後に判定する有効な移動先。行DnDではbody section内の行間、列DnDではTable全体の列間に限定する。activeなReorder Session中でも存在しない場合がある。 |
| committed reorder | 有効なdestinationでDnDが完了し、Data Updateに渡せる状態になった確定済みの並び替え。 |
| cancel | 正常に開始されたactiveなDnDを利用者操作として終了し、Tableデータを更新せずReorder SessionとDnD一時状態を終了するContract。 |
| abort | 外部環境変化または内部不整合によって継続できないReorder操作を安全に終了し、Reorder SessionとDnD一時状態を破棄してDnD idleへ戻すContract。Reorder Modeの終了や開始済みData Updateのretry / rollbackは含まない。 |

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
- #556 外部Table pluginとReorder coreの境界責務を再設計する
- #591 #589/#590の仕様をアーキテクチャ設計書へ反映する
- #607 Reorder v1 Quality Requirementsを定義する
- #608 #605の決定をDesign / Architecture / source guidelinesへ反映する
- #609 安全なReorder終了挙動を基本設計へ反映する