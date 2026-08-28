# Reorder v1 アーキテクチャ設計書

## 1. Introduction and Goals

本書は、`docs/design/reorder-v1-design.md` を入力として、Reorder v1 を実現するための内部責務、責務間の境界、状態所有、Contract、依存関係、Lifecycle、Invariant を定義する。

対象は WordPress Core Table と Flexible Table Block の行・列 DnD とする。

Keyboard 操作、ドラッグを必要としない操作、focus、announcement、支援技術への情報提供など、基本設計書で対象外としているアクセシビリティ設計は本書でも対象外とする。

本書では、実装単位ではなく、正式 v1 の設計を成立させる責務とその協調を扱う。責務名および ID はソースファイル、関数、クラスなどの実装識別子を意味しない。

## 2. Architecture Constraints

- 行並び替えと列並び替えを同時に有効にしない。
- PC とタッチ端末で、入力成立方法の違いを DnD Interaction 以降へ持ち込まない。
- WordPress Core Table と Flexible Table Block で、利用者から見た操作と結果の方針を変えない。
- Reorder core は具体的な Table plugin に依存せず、Table plugin 固有の Table 構造取得およびデータ更新方法を Table Repository の境界内に隠蔽する。
- 対応する Table plugin の追加・削除によって Reorder core の責務を変更しない。
- Table Repository は Table データ、共通 Table structure、監視状態、DnD 状態、Reorder Session、並び替え制約を所有しない。
- DnD 開始試行では、Reorder Target Resolution がその時点の共通 Table structure から移動対象可否を判定し、その DnD の移動先判定に必要な制約情報を導出する。
- 導出した制約情報は成立した Reorder Session が 1 回の DnD 中だけ保持し、DnD をまたいで再利用しない。
- Drop Target Resolution は DnD Interaction から渡された判定入力だけを利用し、Table 全体の構造を参照または再解析しない。
- 行並び替えでは縦結合、列並び替えでは横結合に由来する制約を扱う。結合範囲を越える移動自体は禁止せず、対象方向の結合を分断する移動だけを禁止する。
- Table 全体を並び替え用の中間構造として常駐させず、セル数に比例する並び替え用中間オブジェクトを DnD をまたいで保持しない。
- DOM / Web API を利用する責務は、現在の editor が iframe か non-iframe かを直接判定せず、Editor DOM Context が提供する現在の editor context を利用する。
- Editor DOM Context が提供する context は editor lifecycle をまたいで有効であることを前提にしない。
- DnD 中は Table 上の実際の行・列順序を変更しない。
- Table データを変更するのは、有効な移動先で DnD が完了した場合だけとする。
- 1 回の成立した並び替えは 1 回の Undo で並び替え前へ戻せる更新とする。
- 並び替えで変更するのは行または列の位置だけとし、セルの内容、属性、装飾その他の保持すべき情報を維持する。
- 初回案内と再案内は通常の Table 編集を妨げない。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | YTR が動作する編集環境と PC・タッチ端末の入力状態を提供する。 |
| EXT_CORE_TABLE | WordPress Core Table | External Block | YTR が行・列の並び替えを行う対象 Table の一つ。 |
| EXT_FLEXIBLE_TABLE_BLOCK | Flexible Table Block | External Block | YTR が行・列の並び替えを行う対象 Table の一つ。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した 1 回の並び替えを 1 回の Undo で戻せる更新単位を提供する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | DnD 中に Table または編集画面を必要な方向へ自動スクロールする対象領域を提供する。 |

YTR は WordPress の編集環境、対象 Table、Undo の仕組み、および Table や編集画面のスクロール領域と接続する。

現在の editor で DOM / Web API を利用する責務は、現在の editor context に属する基準から Editor DOM Context が解決した context を利用する。利用側は iframe / non-iframe の違いを直接扱わず、Editor DOM Context は具体的な DOM 要素、Web API property、探索方法、識別子を Architecture の Contract として固定しない。

Input Interaction を WordPress 編集環境の入力と共通 Reorder 処理の境界とし、PC とタッチ端末の入力固有の差をその境界の内側で扱う。DnD Interaction 以降は入力方式に依存しない共通概念だけを扱う。WordPress Editor から受ける入力と、DOM / Web API を利用するための editor context の解決は別の責務境界として扱う。

Core Table と Flexible Table Block を含む外部 Table plugin 固有の構造取得およびデータ更新方法は Table Repository が吸収する。Reorder core は具体的な Table plugin を直接扱わず、構造参照では要求時点の共通 Table structure を利用し、確定した並び替えの反映では Table Repository を更新境界として利用する。

Table 構造に由来する DnD 開始前の移動対象可否と、その DnD 中に使用する構造上の制約情報は Reorder Target Resolution が DnD 開始試行時に解決する。DnD 開始後の移動先可否は Drop Target Resolution が、DnD Interaction から渡された制約情報と現在の操作状態を利用して判定する。

DnD Interaction は成立した Reorder Session に制約情報を保持し、Drop Target Resolution へ判定に必要な値だけを渡す。Drop Target Resolution は Reorder Session 自体や Table 全体の構造には依存しない。

Table の実データ更新は DnD の進行および Reorder Presentation から分離し、確定した並び替えだけを Data Update が Table Repository を通じて対象 Table へ反映する。

First-use Guidance と Reorder Rediscovery は、WordPress の通常編集として成立する操作を尊重し、並び替え案内のために通常編集の成立を奪わない。

## 4. Solution Strategy

Reorder v1 は、editor DOM context の解決、外部 Table plugin とのデータ境界、並び替えモード、案内、入力解釈、DnD の共通進行、開始対象と制約情報の解決、移動先判定、表示、自動スクロール、Table データ更新を別々の責務として扱う。

Editor DOM Context は、現在の editor context に属する基準から、その時点で DOM / Web API を利用するための context を解決し、必要とする責務へ提供する。利用側に iframe / non-iframe の違いを持ち込まず、context の永続性や並び替え状態を所有しない。

Table Repository は、外部 Table plugin と Reorder core の境界を担い、plugin 固有の Table 構造取得およびデータ更新方法を Reorder core から隠蔽する。構造参照では要求時点の共通 Table structure を提供し、更新では確定した並び替えを plugin 固有の方法で対象 Table へ反映する。Table データや共通 Table structure を状態として保持せず、Table の追加・削除・構造変更も監視しない。

Reorder Mode は通常編集、行並び替え、列並び替えの現在状態を管理する。Input Interaction は、その状態のもとで PC とタッチ端末の入力差を吸収し、DnD の開始試行・進行・完了・キャンセルという共通の意味へ変換する。

DnD Interaction は、入力方式に依存せず、Input Interaction から受け取った開始対象と Reorder Mode が示す並び替え方向を組み合わせて DnD の開始と進行を統括する。開始試行時に Reorder Target Resolution へ解決を要求し、移動可能な場合だけ、移動対象とその DnD で利用する制約情報を含む Reorder Session を開始する。移動不可の場合は DnD を開始せず、その理由を Reorder Presentation へ渡す。

Reorder Target Resolution は DnD 開始試行時に Table Repository からその時点の共通 Table structure を取得し、開始対象が移動対象として成立するかを判定する。同時に、その DnD 中の移動先判定で必要となる制約情報を導出する。制約情報の Lifecycle は所有せず、移動可能な場合に移動対象の解決結果と制約情報を DnD Interaction へ提供する。

DnD Interaction は Reorder Session に保持した現在の移動対象、並び替え方向、制約情報、現在位置を Drop Target Resolution へ判定入力として渡す。Drop Target Resolution はその入力だけから有効な移動先を判定し、Table Repository、Table 全体の構造、Reorder Session 自体には依存しない。

Reorder Presentation は Table データとは分離して移動対象、挿入線、周囲の行・列の表示変化を扱い、Auto Scroll は並び替え方向に応じた一方向の自動スクロールを扱う。

有効な移動先で完了した場合だけ DnD Interaction が確定した並び替えを Data Update へ渡す。Data Update は確定結果を Table Repository へ 1 回だけ反映要求し、Table Repository が対象 Table plugin 固有の方法でデータへ反映する。キャンセルまたは無効な完了では Data Update を動作させない。

First-use Guidance は初回案内、Reorder Rediscovery は初回案内後の再案内を扱い、いずれも Reorder Mode や DnD の状態を所有しない。

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | 通常の Table 編集、行並び替え、列並び替えのどの状態にあるかを管理し、並び替え操作の有効範囲を決める。 |
| RESP_FIRST_USE_GUIDANCE | First-use Guidance | PC とタッチ端末ごとの初回案内の表示状態を管理し、並び替えの入口を利用者に案内する。 |
| RESP_REORDER_REDISCOVERY | Reorder Rediscovery | 通常編集状態で並び替えを試みていると考えられる操作の繰り返しを判定し、必要な場合だけ並び替えの入口を再案内する。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在の editor context に属する基準から、その時点で利用すべき DOM / Web API context を解決し、必要とする責務へ提供する。 |
| RESP_TABLE_INTEGRATION | Table Repository | 外部 Table plugin と Reorder core の境界を担い、Table plugin 固有の Table 構造取得およびデータ更新方法を Reorder core から隠蔽する。 |
| RESP_INPUT_INTERACTION | Input Interaction | PC とタッチ端末の入力固有の差を共通の DnD 進行から分離し、開始試行・進行・完了・キャンセルとして DnD Interaction へ渡す境界を担う。 |
| RESP_DND_INTERACTION | DnD Interaction | 入力方式と行・列に共通する DnD の開始可否判定と進行を統括し、成立した Reorder Session の状態を管理して、確定可能な操作だけを Data Update へ渡す。 |
| RESP_REORDER_TARGET_RESOLUTION | Reorder Target Resolution | DnD 開始試行時に現在の共通 Table structure から移動対象可否を判定し、その DnD で利用する構造上の制約情報を導出する。 |
| RESP_DROP_TARGET_RESOLUTION | Drop Target Resolution | DnD Interaction から渡された移動対象、並び替え方向、制約情報、現在位置から、現在の位置が有効な移動先かを判定する。 |
| RESP_REORDER_PRESENTATION | Reorder Presentation | 並び替えモード中の対象表示、移動不可理由、および DnD 中から確定・キャンセルまでの視覚フィードバックを Table データの更新から分離して扱う。 |
| RESP_AUTO_SCROLL | Auto Scroll | DnD 中に、行では縦方向、列では横方向だけを移動のための自動スクロール対象とする。 |
| RESP_DATA_UPDATE | Data Update | 確定した並び替えだけを Table に反映し、保持すべきセル情報と Undo 単位を維持する。 |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_FIRST_USE_GUIDANCE | EXT_WORDPRESS_EDITOR | 初回案内の表示契機となる編集環境の状態を必要とする。 |
| RESP_FIRST_USE_GUIDANCE | RESP_EDITOR_DOM_CONTEXT | 初回案内で DOM / Web API を利用するため、現在の editor context を必要とする。 |
| RESP_REORDER_REDISCOVERY | EXT_WORDPRESS_EDITOR | 通常編集と並び替え試行候補を区別する編集環境の情報を必要とする。 |
| RESP_REORDER_REDISCOVERY | RESP_EDITOR_DOM_CONTEXT | 再案内判定で DOM / Web API を利用するため、現在の editor context を必要とする。 |
| RESP_REORDER_REDISCOVERY | RESP_FIRST_USE_GUIDANCE | 初回案内が表示済みであることを再案内判定の前提として必要とする。 |
| RESP_REORDER_REDISCOVERY | RESP_REORDER_MODE | 通常編集状態でだけ再案内判定を行うため、現在の並び替え状態を必要とする。 |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在の editor context を解決するため、現在の WordPress Editor を必要とする。 |
| RESP_TABLE_INTEGRATION | EXT_CORE_TABLE | Core Table 固有の構造取得およびデータ更新を行うために必要とする。 |
| RESP_TABLE_INTEGRATION | EXT_FLEXIBLE_TABLE_BLOCK | Flexible Table Block 固有の構造取得およびデータ更新を行うために必要とする。 |
| RESP_INPUT_INTERACTION | EXT_WORDPRESS_EDITOR | PC またはタッチ端末の入力を共通の DnD 意味へ変換するため、編集環境の入力を必要とする。 |
| RESP_INPUT_INTERACTION | RESP_EDITOR_DOM_CONTEXT | 入力解釈で DOM / Web API を利用するため、現在の editor context を必要とする。 |
| RESP_INPUT_INTERACTION | RESP_REORDER_MODE | 並び替えモード中の入力を解釈するため、現在の並び替え状態を必要とする。 |
| RESP_DND_INTERACTION | RESP_REORDER_MODE | DnD 開始時に使用する現在の並び替え方向を必要とする。 |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | DnD を開始できる移動対象と、その DnD で利用する制約情報の解決能力を必要とする。 |
| RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | 開始済み DnD の現在位置が有効な移動先かを判定する能力を必要とする。 |
| RESP_DND_INTERACTION | RESP_DATA_UPDATE | 確定した並び替えを Table データへ反映する能力を必要とする。 |
| RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 移動対象判定と制約情報導出に使用する現在の共通 Table structure を必要とする。 |
| RESP_REORDER_PRESENTATION | RESP_REORDER_MODE | 並び替えモード中に表示する対象方向を決めるため、現在の並び替え状態を必要とする。 |
| RESP_REORDER_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 表示処理で DOM / Web API を利用するため、現在の editor context を必要とする。 |
| RESP_REORDER_PRESENTATION | RESP_DND_INTERACTION | 移動不可理由、DnD の進行状態、確定結果、キャンセル結果を表示するために必要とする。 |
| RESP_AUTO_SCROLL | RESP_DND_INTERACTION | active な DnD と並び替え方向を自動スクロール判断に必要とする。 |
| RESP_AUTO_SCROLL | RESP_EDITOR_DOM_CONTEXT | 自動スクロールで DOM / Web API を利用するため、現在の editor context を必要とする。 |
| RESP_AUTO_SCROLL | EXT_SCROLL_AREA | DnD 中に移動方向へスクロールできる外部領域を必要とする。 |
| RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定した並び替えを対象 Table plugin 固有の方法で反映する能力を必要とする。 |
| RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 成立した 1 回の並び替えを 1 回で戻せる更新単位を維持するため、Undo の仕組みを必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_CORE_TABLE EXT_FLEXIBLE_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA RESP_REORDER_MODE RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_EDITOR_DOM_CONTEXT RESP_TABLE_INTEGRATION RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_DATA_UPDATE |
| DV_EDITOR_INTERACTION | Editor Interaction | EXT_WORDPRESS_EDITOR RESP_EDITOR_DOM_CONTEXT RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_INPUT_INTERACTION RESP_REORDER_MODE |
| DV_DND_CORE | DnD Core | RESP_REORDER_MODE RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION |
| DV_TABLE_STRUCTURE | Table Structure | EXT_CORE_TABLE EXT_FLEXIBLE_TABLE_BLOCK RESP_TABLE_INTEGRATION RESP_REORDER_TARGET_RESOLUTION |
| DV_DND_FEEDBACK | DnD Feedback | RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_EDITOR_DOM_CONTEXT EXT_SCROLL_AREA |
| DV_DATA_UPDATE | Data Update | RESP_DND_INTERACTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION EXT_CORE_TABLE EXT_FLEXIBLE_TABLE_BLOCK EXT_WORDPRESS_UNDO |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

通常の Table 編集、行並び替え、列並び替えのいずれが現在有効かを管理する。並び替えの入口から状態を切り替え、利用者が現在のモードを確認できる状態を提供する。

##### State ownership

通常、行並び替え、列並び替えの現在状態を所有する。DnD の進行状態、移動対象、移動先、Table データは所有しない。

##### Contract

「行を並び替え」「列を並び替え」の選択と並び替えモード終了を受け取り、現在の並び替え状態を Input Interaction、DnD Interaction、Reorder Presentation へ提供する。

通常状態では DnD を有効にせず、行並び替えでは行、列並び替えでは列を DnD の開始候補として扱える状態を提供する。個々の行または列が実際に移動対象として成立するかは判定しない。

##### Lifecycle

通常状態から開始する。行または列の入口が選択されると対応する並び替えモードへ移行する。別方向の入口が選択された場合は選択された側へ切り替わり、終了時は通常状態へ戻る。

##### Invariants

- 同時に有効な並び替えモードは 1 つだけとする。
- 通常状態では行・列の DnD を有効にしない。
- 行並び替えモードでは列 DnD、列並び替えモードでは行 DnD を有効にしない。
- 個々の行または列の移動対象成立可否を所有しない。

#### First-use Guidance {#RESP_FIRST_USE_GUIDANCE}

##### Responsibility

初めて利用する人が行・列を並び替えられることと、その入口を認識できるようにする。案内表示中は行・列の両方の入口を強調する。

##### State ownership

利用者について PC とタッチ端末それぞれの初回案内表示済み状態と、現在の初回案内表示状態を所有する。Reorder Mode、Reorder Rediscovery、DnD の状態は所有しない。

##### Contract

PC では Table へのポインター進入、Table のフォーカス、またはセル編集開始を受け取り、その操作環境で未表示なら初回案内を表示する。

タッチ端末では Table のフォーカスまたはセル編集開始を受け取り、その操作環境で未表示なら初回案内を表示する。

行または列の並び替え入口が選択された場合、または案内が閉じられた場合に案内と入口の強調を終了し、その操作環境を表示済みとして扱う。PC では Table からポインターが外れたことだけを案内終了条件にしない。

##### Lifecycle

対象の操作環境で未表示の状態から、操作環境に応じた表示契機によって表示状態になる。入口選択または案内を閉じる操作で表示を終了し、その操作環境を表示済みとする。

PC では表示中に Table からポインターが外れても、それだけでは表示状態を終了しない。

##### Invariants

- PC とタッチ端末の表示済み状態を独立して扱う。
- PC とタッチ端末で定義された表示契機の違いを維持する。
- 初回案内は通常のセル編集を妨げない。
- PC ではポインター離脱だけを初回案内終了条件にしない。
- 案内終了後も並び替え入口そのものの利用可否を変更しない。
- Reorder Rediscovery の再案内判定と一時状態を共有しない。

#### Reorder Rediscovery {#RESP_REORDER_REDISCOVERY}

##### Responsibility

初回案内表示済みの利用者が並び替え機能を忘れている可能性がある場合に、通常編集を妨げず、並び替えを試みていると判断できる操作の繰り返しから必要な再案内だけを成立させる。

##### State ownership

同じ行または列の付近で繰り返された並び替え試行候補の一時的な履歴と、同じ状況で過度に再案内しないための抑制状態を所有する。初回案内表示済み状態、Reorder Mode、DnD 状態、Table データは所有しない。

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
- 再案内によって通常の Table 編集を妨げない。
- 同じ状況で再案内を過度に繰り返さない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在の editor context に属する基準から、その時点で DOM / Web API を利用するために必要な editor DOM context を解決し、必要とする責務へ提供する。利用側が現在の editor の browsing context の違いを直接扱わなくてよい境界を担う。

##### State ownership

並び替え状態、Reorder Mode、Reorder Session、Table データ、移動対象、移動先、Presentation 状態を所有しない。解決した editor DOM context を editor lifecycle をまたぐ永続状態として所有しない。

##### Contract

DOM / Web API を必要とする責務が現在の editor context を利用する時点で、現在の editor context に属する基準をもとに、その時点で利用すべき editor DOM context を解決して提供する。

利用側は、現在の editor が iframe か non-iframe かを判定せず、Editor DOM Context が提供する context を利用する。

context の解決に使用する具体的な DOM 要素、Web API property、探索方法、識別子はこの Contract では固定しない。現在の editor context を解決できない場合に、以前の editor lifecycle で得た context を代替として提供しない。

##### Lifecycle

DOM / Web API を利用する責務が現在の editor context を必要とする時点で、その時点の editor lifecycle に対して context を解決する。提供した context が editor lifecycle の変化後も有効であることは保証せず、新しい lifecycle では現在の editor context に対して改めて解決する。

以前に解決した context を、後続の editor lifecycle に自動的に持ち越さない。

##### Invariants

- 提供する context は、解決に用いた基準と同じ現在の editor context に属する。
- DOM / Web API を利用する責務へ iframe / non-iframe の判定を要求しない。
- editor lifecycle をまたいだ context の永続性を保証しない。
- 以前の editor lifecycle で得た context を現在の context として再利用しない。
- 並び替え状態、Table データ、移動対象、移動先を所有しない。
- 具体的な DOM 要素、Web API property、探索方法、識別子を Architecture の必須 Contract として固定しない。
- Table Repository、Reorder Mode、DnD Interaction、Reorder Target Resolution、Drop Target Resolution、Data Update の状態や判定に依存しない。

#### Table Repository {#RESP_TABLE_INTEGRATION}

##### Responsibility

外部 Table plugin と Reorder core の境界を担い、Table plugin 固有の Table 構造取得およびデータ更新方法を Reorder core から隠蔽する。

##### State ownership

状態を所有しない。Table データ、共通 Table structure、DnD 状態、Reorder Session、制約情報を保持しない。

##### Contract

対応可能な Table について、要求時点の plugin 固有構造から Reorder core が利用する共通 Table structure を提供する。

確定した並び替えの反映を要求された場合は、Table plugin 固有の方法で対象 Table のデータへ反映する。

確定した並び替えを反映する際は、行または列の位置だけを変更し、セルの内容、属性、装飾その他の保持すべき情報を維持する。

対応できない Table では共通 Table structure を提供せず、更新も行わない。

##### Lifecycle

要求時に対象 Table の現在データを利用して構造取得または更新を行う。取得した構造や Table データを後続の要求へ持ち越さず、Table の追加・削除・構造変更を監視しない。

##### Invariants

- Table plugin 固有の構造表現やデータ操作方法を Reorder core 側へ漏らさない。
- Reorder 固有の移動対象判定、制約情報の導出、移動先判定を行わない。
- DnD 状態または Reorder Session を所有しない。
- 共通 Table structure や Table データを永続的に保持しない。
- 対応不能な Table に対して不完全な共通 Table structure を提供しない。
- Reorder core は具体的な Table plugin を前提としない。

#### Input Interaction {#RESP_INPUT_INTERACTION}

##### Responsibility

PC とタッチ端末の入力固有の差を、共通の DnD Interaction から分離して扱う。並び替えモード中の入力を DnD の開始試行・進行・完了・キャンセルという共通の意味へ変換し、入力方式に依存しない DnD Interaction へ渡す。

##### State ownership

入力を DnD として解釈するために必要な一時状態だけを所有する。Reorder Mode、移動対象の成立可否と移動不可理由、移動対象、現在の移動先、確定可能性、Table データ、Presentation 状態は所有しない。

##### Contract

Reorder Mode から現在の並び替え状態を受け取り、WordPress 編集環境から PC またはタッチ端末の入力を受け取る。

現在の並び替えモードで DnD の開始を試みる入力が成立した場合は、開始対象を開始試行として DnD Interaction へ渡す。開始対象が移動可能かどうかは Input Interaction では判定せず、並び替え方向も DnD Interaction へ提供しない。

DnD が開始された後は、進行、完了、キャンセルとして解釈した入力を DnD Interaction へ渡す。DnD Interaction へ渡す Contract には、PC とタッチ端末ごとの入力成立方法そのものを含めない。

##### Lifecycle

並び替えモード中に対象となる入力を受けたときだけ、一時的な入力解釈状態を持つ。開始試行が移動可能な対象に対して成立して DnD が開始された場合は、完了またはキャンセルまで共通の進行情報を DnD Interaction へ渡す。

DnD が完了またはキャンセルされた場合、開始試行が移動不可で終了した場合、または入力が DnD として成立しなかった場合は、次の操作へ不要な入力状態を持ち越さない。

##### Invariants

- PC とタッチ端末の入力固有の差を DnD Interaction の状態や Contract に持ち込まない。
- DOM / Web API を利用するために iframe / non-iframe の違いを直接判定しない。
- DnD Interaction へ並び替え方向を提供しない。
- 移動対象として選択できるかを判定しない。
- 移動先の有効性を判定しない。
- Table データを変更しない。
- Reorder Presentation の表示状態を所有しない。
- Table の全行・全列について個別の常駐 Interaction 状態を持つことを前提にしない。
- Table Repository、Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Update に直接依存しない。
- DnD Interaction との実装上の結合方式を Architecture の Contract として固定しない。

#### DnD Interaction {#RESP_DND_INTERACTION}

##### Responsibility

Input Interaction から受け取る DnD の開始試行と、開始後の DnD を入力方式および行・列に共通する 1 つの並び替え操作として統括する。開始試行では Reorder Target Resolution の判定に基づいて DnD の開始または非開始を決め、開始後は Reorder Session に移動対象、並び替え方向、制約情報、現在の移動先、確定可能性、完了結果を保持し、有効な移動先で完了した場合だけ確定した並び替えを Data Update へ渡す。

##### State ownership

成立した 1 回の DnD に対応する Reorder Session を所有する。Reorder Session には、行または列のどちらを扱っているか、移動対象、その DnD で利用する制約情報、現在の有効な移動先、確定可能性、完了結果を保持する。

移動対象として選択できるかという判定規則、制約情報の導出規則、入力方式固有の一時状態、Table データ自体、視覚表示状態は所有しない。DnD をまたぐ制約情報の cache は所有しない。

##### Contract

Input Interaction から DnD の開始試行・進行・完了・キャンセルを受け取る。開始試行に含まれる開始対象と Reorder Mode が示す並び替え方向を Reorder Target Resolution に渡して移動対象解決を要求する。

Reorder Target Resolution が移動可能と判定した場合だけ、返された移動対象と制約情報を含む Reorder Session を開始する。移動不可と判定した場合は Reorder Session を開始せず、その理由を Reorder Presentation に提供する。

進行中は Reorder Session から現在の移動対象、並び替え方向、制約情報を取り出し、現在位置とともに Drop Target Resolution へ渡して移動先判定を求める。その結果を Reorder Session の操作状態として保持する。Reorder Presentation と Auto Scroll が必要とする進行状態を提供する。

完了時に有効な移動先がある場合だけ、移動対象と移動先を含む確定した並び替えを Data Update に渡し、Reorder Presentation に確定結果を提供する。

キャンセル時は Data Update に何も渡さず、Reorder Presentation にキャンセル結果を提供する。無効な完了では確定した並び替えを生成しない。

##### Lifecycle

並び替えモード中に Input Interaction から DnD の開始試行を受ける。Reorder Target Resolution が移動可能と判定した場合だけ Reorder Session を開始し、完了またはキャンセルまで active を維持する。その間だけ移動対象、並び替え方向、制約情報、移動先などを保持する。

移動不可と判定された場合は active にならず、理由を Reorder Presentation へ渡して開始試行を終了する。完了またはキャンセル時は必要な結果を渡した後、Reorder Session とその制約情報を破棄する。次の DnD 開始試行では、その時点の共通 Table structure から新しい制約情報が導出される。

##### Invariants

- 通常の Table 編集状態から DnD の開始試行を成立させない。
- Reorder Target Resolution が移動可能と判定していない対象から DnD を開始しない。
- 移動不可な開始試行では Reorder Session を作らない。
- Reorder Target Resolution が提供した制約情報を成立した Reorder Session の外へ持ち越さない。
- DnD をまたぐ constraint cache、structure revision、cache invalidation を所有しない。
- Drop Target Resolution へ Reorder Session 自体を渡さず、判定に必要な値だけを渡す。
- DnD 開始前に Drop Target Resolution を移動対象判定へ利用しない。
- 入力方式固有の状態を所有しない。
- 行と列で Lifecycle、destination 更新、commit、cancel の Contract を分岐させない。
- DnD 中に Table データを変更しない。
- 有効な移動先なしに確定した並び替えを生成しない。
- キャンセル時は Data Update へ更新要求を渡さない。
- 完了またはキャンセル後に前回の Reorder Session 状態を次の DnD へ保持しない。
- Data Update へ渡す時点で並び替えは確定済みである。
- Table Repository に直接依存しない。

#### Reorder Target Resolution {#RESP_REORDER_TARGET_RESOLUTION}

##### Responsibility

DnD 開始試行時に、Table Repository が提供する現在の共通 Table structure から、開始対象となる行または列を移動対象として選択できるかを判定する。同時に、その DnD 中の移動先判定で必要となる構造上の制約情報を導出する。

行では縦結合、列では横結合に由来する移動対象可否と、対象方向の結合を分断しない移動先判定に必要な制約を扱う。結合範囲を越える移動自体は制限しない。

##### State ownership

永続的な DnD 状態、Table データ、共通 Table structure、制約情報の Lifecycle を所有しない。現在の開始試行について、開始対象、並び替え方向、現在の共通 Table structure を入力として扱う。

##### Contract

DnD Interaction から開始対象と行または列の並び替え方向に対応する解決要求を受け取り、Table Repository へ対象 Table の現在の共通 Table structure を要求する。

共通 Table structure を取得でき、開始対象が移動対象として成立する場合は、移動対象の解決結果と、その DnD 中の移動先判定で利用する制約情報を返す。開始対象が成立しない場合、または現在の共通 Table structure を取得できない場合は、DnD Interaction が Reorder Presentation へ渡せる非開始の理由を含む結果を返す。

制約情報を導出するが、その Lifecycle は所有しない。個々の開始試行を越えて制約情報や判定結果を保持しない。

##### Lifecycle

DnD Interaction から DnD 開始試行に対応する解決要求を受けたときだけ、その時点の共通 Table structure から判定と制約情報導出を行う。並び替えモードへ入った時点では全行・全列の移動可否を事前判定しない。

移動可能な場合に提供した制約情報は DnD Interaction が開始する Reorder Session に引き継がれ、Reorder Target Resolution 自体は保持しない。次の DnD 開始試行では、その時点の共通 Table structure から改めて導出する。

##### Invariants

- DnD 開始試行時の移動対象成立可否と、その DnD で使う制約情報の導出だけを担い、DnD 開始後の移動先判定を担わない。
- Table plugin 固有の構造表現を直接扱わず、Table Repository が提供する共通 Table structure を利用する。
- 並び替えモード中の対象表示のために利用しない。
- 行では縦結合によって一体化された範囲の一部を移動対象として返さず、横結合だけを理由に移動不可と判定しない。
- 列では横結合によって一体化された範囲の一部を移動対象として返さず、縦結合だけを理由に移動不可と判定しない。
- 行では縦結合、列では横結合を分断する移動先を許可しないための制約情報を導出する。
- 結合範囲を越えること自体を禁止する制約情報にはしない。
- 制約情報の Lifecycle を所有しない。
- DnD をまたぐ制約情報を再利用しない。
- 移動対象解決によって Table データを変更しない。
- Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Update に依存しない。

#### Drop Target Resolution {#RESP_DROP_TARGET_RESOLUTION}

##### Responsibility

開始済みの行または列 DnD に対して、DnD Interaction から渡された移動対象、並び替え方向、制約情報、現在位置を入力として、現在位置が有効な移動先かを判定する。対象方向の結合を分断する位置は有効な移動先として返さない。

##### State ownership

永続的な DnD 状態、Table データ、共通 Table structure、制約情報の Lifecycle を所有しない。現在の判定入力だけを扱い、Reorder Session 自体は所有または参照しない。

##### Contract

active な DnD Interaction から現在の移動対象、行または列の方向、その DnD で利用する制約情報、現在位置を受け取る。

対象方向の結合を分断せず Table 構造を保てる場合は有効な行間または列間を返し、成立しない場合は有効な移動先なしを返す。Table 全体の構造を参照または再解析せず、DnD 開始前の開始対象に対する判定結果は返さない。

##### Lifecycle

DnD Interaction が active の間に必要に応じて判定を行う。現在位置が変化して判定を繰り返す場合も、Reorder Session に保持された同じ制約情報を DnD Interaction から判定入力として受け取り、Table 全体を再解析しない。

DnD が開始していない間は移動先判定を行わず、完了またはキャンセル後に個々の判定結果や制約情報を独立した状態として保持しない。

##### Invariants

- DnD 開始後の移動先だけを判定する。
- DnD 開始前の移動対象成立可否を判定しない。
- Reorder Session 自体に依存しない。
- Table Repository や Table 全体の構造を参照しない。
- 渡された制約情報を再導出しない。
- 行 DnD では縦結合、列 DnD では横結合を分断する位置を有効な移動先として返さない。
- 結合範囲を越えることだけを理由に移動先を無効としない。
- 行 DnD では行間、列 DnD では列間を移動先として扱う。
- 移動先判定によって Table データを変更しない。
- Reorder Target Resolution、Reorder Presentation、Data Update に直接依存しない。

#### Reorder Presentation {#RESP_REORDER_PRESENTATION}

##### Responsibility

並び替えモード中に現在の並び替え方向の対象を示し、移動不可な対象から DnD 開始が試みられた場合はその理由を示す。DnD 中は移動対象、現在の有効な移動先、移動先変更に伴って表示位置が変わる周囲の行・列を、Table 上の実際の順番を変更せずに表示する。

確定時は移動対象を最終位置へ自然につなぎ、キャンセル時は元の位置へ戻す表示を扱う。

##### State ownership

並び替えモード中の対象表示、移動不可理由の一時表示、進行中の DnD に対応する移動対象の表示状態、挿入線、表示位置が変わる周囲の行・列の一時的な表示状態、確定・キャンセル時の表示遷移状態を所有する。

Table データ、移動対象成立可否の判定規則、並び替え制約、移動先の有効性、DnD の開始判断と確定判断は所有しない。

##### Contract

Reorder Mode から現在の並び替え方向を受け取り、行並び替えモードでは行、列並び替えモードでは列を線で囲んで示す。個々の対象が移動可能かどうかは判定せず、対象表示のために Reorder Target Resolution を利用しない。この方針は PC とタッチ端末で共通とする。

DnD Interaction から移動不可な開始試行の理由を受け取った場合は、その理由を利用者が確認できる一時的なフィードバックとして表示する。この表示によって DnD を開始した状態にはしない。

DnD Interaction から開始後の移動対象と現在の有効な移動先を受け取り、行では水平、列では垂直の挿入線として移動先を表現する。有効な移動先が変われば挿入線も追従する。

移動先が変わった場合は、移動対象が入る空間を空けるために実際に表示位置が変わる周囲の行・列だけを表示上移動させる。

ドラッグ中の移動対象は元の Table 上での大きさとセルの配置関係を保つ。行では Table の横方向、列では Table の縦方向から不必要にはみ出さない表示範囲を保ち、その制約によって Auto Scroll を妨げない。

DnD Interaction から確定結果を受け取った場合は移動対象を最終位置へ自然につなぐ。キャンセル結果を受け取った場合は移動対象を元の位置へ戻す。

##### Lifecycle

並び替えモードへ入ると現在方向の対象表示を開始する。この時点では Reorder Target Resolution に移動対象判定を要求しない。移動不可な対象から開始が試みられた場合は DnD Interaction から受け取った理由の一時表示を開始し、利用者が内容を確認できる時間だけ表示した後に終了する。

DnD 開始時に DnD 用の表示状態を有効にし、進行中は移動対象、挿入線、必要な周囲の表示変化を更新する。確定時またはキャンセル時は対応する表示遷移を完了させた後、DnD 用の一時状態を破棄する。

Reorder Mode が継続している場合はモード中の対象表示を維持し、モード終了時に対象表示と移動不可理由の一時表示も終了する。

##### Invariants

- Presentation の更新によって Table 上の実際の行・列順序を変更しない。
- DOM / Web API を利用するために iframe / non-iframe の違いを直接判定しない。
- 対象表示のために Reorder Target Resolution を利用しない。
- 移動不可理由を表示するために DnD を開始しない。
- 移動不可理由の表示は一時的なフィードバックとし、次の DnD の進行状態として保持しない。
- PC とタッチ端末で対象表示の方針を変えない。
- 行の移動先は水平の挿入線、列の移動先は垂直の挿入線で示す。
- 無効な移動先に確定可能な挿入線を表示しない。
- 移動先変更時に表示上移動させるのは、実際に表示位置が変わる行・列だけとする。
- 移動先変更に合わせて無関係な行・列を一斉に移動させない。
- ドラッグ中の行は空セルを含んでも行全体の横幅や各セル幅を保つ。
- ドラッグ中の列は空セルを含んでも列全体の幅や各セル高さを保つ。
- ドラッグ中の行は Table の横方向、列は Table の縦方向から不必要にはみ出さない。
- 表示範囲の制約によって必要な Auto Scroll を妨げない。
- 確定時とキャンセル時の表示遷移によって Table データ更新の責務を持たない。
- Table Repository に直接依存しない。

#### Auto Scroll {#RESP_AUTO_SCROLL}

##### Responsibility

Table が画面内に収まらない場合でも、進行中の DnD の移動方向に沿って並び替えを継続できるようにする。

##### State ownership

DnD 中に現在自動スクロールの対象となる方向を扱う。Reorder Mode、移動対象、移動先、Table データは所有しない。

##### Contract

DnD Interaction から進行中の並び替え方向を受け取る。行 DnD では縦方向、列 DnD では横方向だけを自動スクロール対象とする。

DnD を開始していない通常状態、および移動不可な開始試行では、この方向制限を通常の Table や編集画面のスクロールへ適用しない。

##### Lifecycle

DnD 中に必要な場合だけ有効になる。移動不可な開始試行では有効にならない。DnD の完了またはキャンセルで終了し、方向制限を通常状態へ持ち越さない。

##### Invariants

- DOM / Web API を利用するために iframe / non-iframe の違いを直接判定しない。
- 行 DnD 中は横方向を自動スクロールしない。
- 列 DnD 中は縦方向を自動スクロールしない。
- active な DnD 中だけ移動方向に応じた自動スクロール制約を適用する。
- Table Repository、Reorder Target Resolution、Drop Target Resolution、Data Update の責務を担わない。

#### Data Update {#RESP_DATA_UPDATE}

##### Responsibility

DnD Interaction から受け取った確定済みの並び替えを、Table Repository を通じて対象 Table に反映する。行または列の位置だけを変更し、セルの内容、属性、装飾その他の保持すべき情報を維持する。

##### State ownership

確定した並び替えを Table データへ反映する責務を所有する。DnD の進行状態、Presentation、並び替え制約、移動対象判定、移動先判定は所有しない。Table データそのものの永続的な所有者にはならない。

##### Contract

DnD Interaction から、有効な移動先で完了した確定済みの並び替えだけを受け取る。

確定した並び替えを対象 Table へ反映するよう Table Repository に要求する。具体的な Table plugin のデータ構造や更新方法は扱わない。

1 回の確定した並び替えを 1 回だけ Table データへ反映し、1 回の Undo で並び替え前へ戻せる更新とする。

##### Lifecycle

確定済みの並び替えを受け取ったときだけ動作する。Table Repository への反映要求を完了した後に DnD の一時状態を保持しない。移動不可な開始試行、キャンセル、無効な DnD では動作しない。

##### Invariants

- 確定していない DnD から Table データを変更しない。
- 1 回の確定した並び替えを複数回 Table データへ反映しない。
- 変更するのは行または列の位置だけとする。
- セルの内容、属性、装飾その他の保持すべき情報を維持する。
- テキスト、画像、RichText その他のセル内容の種類によって並び替えの扱いを変えない。
- 1 回の成立した並び替えを 1 回の Undo で戻せる状態を維持する。
- 具体的な Table plugin のデータ構造や更新方法を扱わない。
- Table Repository 以外を介して対象 Table を直接更新しない。
- Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scroll から直接更新要求を受け取らない。

## 6. Runtime View

### DnD start with movable target {#RV_DND_START_MOVABLE}

移動可能な対象から DnD 開始が試みられ、その時点の共通 Table structure から移動対象と制約情報を解決して active な Reorder Session が成立するまでの協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 開始対象を含む DnD 開始試行を渡す。 |
| 2 | RESP_REORDER_MODE | RESP_DND_INTERACTION | 現在の並び替え方向を提供する。 |
| 3 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | 開始対象と並び替え方向に対する移動対象解決を要求する。 |
| 4 | RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 対象 Table の要求時点の共通 Table structure を要求する。 |
| 5 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 移動対象と、その DnD で利用する制約情報が解決されたことを通知する。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | DnD が開始した移動対象と進行状態を提供する。 |
| 7 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | active な DnD と並び替え方向を提供する。 |

### DnD start with immovable target {#RV_DND_START_IMMOVABLE}

移動不可な対象から DnD 開始が試みられ、要求時点の共通 Table structure に基づく解決結果から Reorder Session を作らず理由を表示するまでの協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 開始対象を含む DnD 開始試行を渡す。 |
| 2 | RESP_REORDER_MODE | RESP_DND_INTERACTION | 現在の並び替え方向を提供する。 |
| 3 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | 開始対象と並び替え方向に対する移動対象解決を要求する。 |
| 4 | RESP_REORDER_TARGET_RESOLUTION | RESP_TABLE_INTEGRATION | 対象 Table の要求時点の共通 Table structure を要求する。 |
| 5 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 移動不可であることと理由を通知する。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | DnD を開始せず、移動不可理由を一時表示するために渡す。 |

### DnD progress {#RV_DND_PROGRESS}

開始済み DnD の進行に応じて、Reorder Session に保持された制約情報を DnD Interaction から判定入力として渡し、Table 全体を再解析せずに移動先、表示、自動スクロールを更新する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 現在位置に対応する DnD 進行情報を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | 現在の移動対象、並び替え方向、制約情報、現在位置を渡して移動先判定を要求する。 |
| 3 | RESP_DROP_TARGET_RESOLUTION | RESP_DND_INTERACTION | 有効な移動先、または有効な移動先なしという判定結果を通知する。 |
| 4 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 移動対象と現在の有効な移動先を提供し、挿入線と必要な周囲の表示変化を更新させる。 |
| 5 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | active な DnD と並び替え方向を提供する。 |
| 6 | RESP_AUTO_SCROLL | EXT_SCROLL_AREA | 行では縦方向、列では横方向に必要な自動スクロールを行う。 |

### DnD commit to Core Table {#RV_DND_COMMIT_CORE_TABLE}

有効な移動先で DnD が完了し、Table Repository を通じて Core Table データへ 1 回だけ確定結果を反映して Reorder Session を終了する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnD 完了を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DATA_UPDATE | 移動対象と移動先を含む確定済みの並び替えを渡す。 |
| 3 | RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定済みの並び替えの反映を要求する。 |
| 4 | RESP_TABLE_INTEGRATION | EXT_CORE_TABLE | Core Table 固有の方法で行または列の位置を更新する。 |
| 5 | RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 1 回の並び替えを 1 回の Undo で戻せる更新単位として成立させる。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。 |

### DnD commit to Flexible Table Block {#RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK}

有効な移動先で DnD が完了し、Table Repository を通じて Flexible Table Block データへ 1 回だけ確定結果を反映して Reorder Session を終了する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnD 完了を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DATA_UPDATE | 移動対象と移動先を含む確定済みの並び替えを渡す。 |
| 3 | RESP_DATA_UPDATE | RESP_TABLE_INTEGRATION | 確定済みの並び替えの反映を要求する。 |
| 4 | RESP_TABLE_INTEGRATION | EXT_FLEXIBLE_TABLE_BLOCK | Flexible Table Block 固有の方法で行または列の位置を更新する。 |
| 5 | RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 1 回の並び替えを 1 回の Undo で戻せる更新単位として成立させる。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。 |

### DnD cancel {#RV_DND_CANCEL}

開始済み DnD がキャンセルされ、Table データを変更せず表示状態と Reorder Session を終了する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnD キャンセルを渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | キャンセル結果を提供し、移動対象を元の位置へ戻す表示を完了させる。 |

Data Update への Interaction は発生しない。

## 8. Crosscutting Concepts

### State ownership

- 現在の通常、行並び替え、列並び替えの状態は Reorder Mode が所有する。
- PC とタッチ端末ごとの初回案内の表示済み状態は First-use Guidance が所有する。
- 再案内を判定するための直近の操作傾向と、同じ状況で過度に再案内しないための一時状態は Reorder Rediscovery が所有する。
- 現在の editor DOM context は Editor DOM Context が必要な時点で解決して提供し、editor lifecycle をまたぐ永続的な YTR 状態として所有しない。
- Table Repository は Table データ、共通 Table structure、Table ごとの状態、監視状態、DnD 状態、Reorder Session、制約情報を所有しない。
- PC とタッチ端末の入力固有の解釈に必要な一時状態は Input Interaction が所有し、移動対象、移動先、確定可能性などの Reorder Session 状態は所有しない。
- DnD 開始試行時の移動対象可否と、その DnD で使用する制約情報は Reorder Target Resolution が現在の共通 Table structure から導出するが、制約情報の Lifecycle は所有しない。
- 進行中の DnD、移動対象、並び替え方向、制約情報、現在の移動先、確定可能性、完了結果は DnD Interaction が Reorder Session として所有する。移動不可な開始試行では Reorder Session を作らない。
- 移動先の有効性そのものは Drop Target Resolution が DnD 開始後に判定し、Reorder Session、Table 構造、制約情報を状態として所有しない。
- 並び替えモード中の対象表示、移動不可理由の一時表示、DnD 中の移動対象、挿入線、周囲の行・列の表示変化、確定・キャンセル時の一時的な表示状態は Reorder Presentation が所有する。
- Table のデータは WordPress の対象ブロック側に存在し、YTR 内で確定した並び替えを反映する責務は Data Update が所有し、Table plugin 固有の反映方法は Table Repository が提供する。

### Architecture-wide invariants

- DOM / Web API を利用する責務は Editor DOM Context が提供する現在の editor context を利用し、iframe / non-iframe の違いを直接判定しない。
- Editor DOM Context は現在の editor context に属する基準から context を解決し、editor lifecycle をまたいだ有効性を前提にしない。
- Editor DOM Context の context 解決と、Reorder Mode、Reorder Session、Table データ、移動対象、移動先の状態所有を分離する。
- Reorder core は具体的な Table plugin に依存せず、Table plugin 固有の構造表現とデータ操作方法を Table Repository の境界から他責務へ漏らさない。
- Table Repository は状態、Table 監視、Reorder 固有の移動対象判定、制約情報導出、移動先判定を所有しない。
- Table Repository に直接依存する YTR 責務は Reorder Target Resolution と Data Update に限定する。
- PC とタッチ端末の入力固有の差を DnD Interaction 以降の共通処理へ持ち込まない。
- DnD Interaction が Reorder Target Resolution に渡す並び替え方向は Reorder Mode の現在状態から得る。Input Interaction を並び替え方向の情報源にしない。
- Reorder Target Resolution は DnD 開始試行ごとに要求時点の共通 Table structure から移動対象を判定し、その DnD で使用する制約情報を導出する。
- Reorder Target Resolution は制約情報の Lifecycle を所有せず、成立した Reorder Session が DnD 完了またはキャンセルまで保持する。
- 制約情報を DnD をまたいで再利用せず、constraint cache、structure revision、cache invalidation を Architecture の前提にしない。
- Drop Target Resolution は DnD Interaction から渡された判定入力だけを利用し、Reorder Session 自体、Table Repository、Table 全体の構造に依存しない。
- 行並び替えでは縦結合、列並び替えでは横結合に由来する制約を扱い、対象方向の結合を分断する移動を禁止する。
- 結合範囲を越える移動自体は禁止しない。
- Table 全体を並び替え用の中間構造として DnD をまたいで保持せず、セル数に比例する並び替え用中間オブジェクトを常駐させない。
- 移動対象として成立しない行または列から DnD を開始しない。
- 行の移動対象判定では縦結合による移動不可を扱い、横結合だけを理由に不要な制限を掛けない。
- 列の移動対象判定では横結合による移動不可を扱い、縦結合だけを理由に不要な制限を掛けない。
- Reorder Target Resolution は DnD 開始試行時だけ移動対象判定を行い、並び替えモード中の対象表示のために全行・全列を事前判定しない。
- Reorder Presentation は Reorder Target Resolution を直接利用しない。
- Drop Target Resolution は DnD 開始前の移動対象判定を担わない。
- DnD Interaction の Lifecycle、destination 更新、commit、cancel の Contract は行と列で共通とする。
- DnD 中は Table 上の実際の行・列順序を変更しない。
- 有効な移動先で DnD が完了した場合だけ Table データを変更する。
- 無効な移動先では確定可能な挿入線を表示せず、並び替えを確定しない。
- Reorder Presentation の表示更新は Table データの更新責務を持たない。
- 移動先変更に伴う表示上の移動は、実際に表示位置が変わる行・列に限定し、無関係な行・列を一斉に移動させない。
- 行の DnD 中に自動スクロールする方向は縦方向だけとし、列の DnD 中は横方向だけとする。

### Lifecycle and context boundaries

Editor DOM Context が提供する context は、その時点の editor lifecycle に属するものとして扱う。DOM / Web API を利用する責務は、以前の editor lifecycle で得た context の永続性を前提にせず、現在の editor context が必要な時点では Editor DOM Context を境界として扱う。Editor DOM Context 自体も以前の context を現在の context として持ち越さない。

Table Repository は構造取得または更新を要求された時点で対象 Table の現在データを利用し、構造取得では共通 Table structure を提供し、更新では確定した並び替えを対象 Table へ反映する。取得した構造や Table データを次の要求へ持ち越さず、Table の追加・削除・構造変更を監視せず、構造の revision や cache invalidation を Lifecycle として所有しない。

Reorder Mode が通常状態にある間は Input Interaction から DnD Interaction への開始試行を成立させない。行または列の並び替えモードへ入った後に、その方向の DnD 開始を試行できる。

Input Interaction の入力固有の一時状態は、その入力を DnD の開始試行・進行・完了・キャンセルとして扱うために必要な期間だけ有効とする。DnD が完了またはキャンセルされた場合、Reorder Target Resolution により開始不可と判定された場合、または入力が DnD として成立しなかった場合は、次の操作へ不要な入力状態を持ち越さない。

Reorder Target Resolution は開始試行ごとに、その時点の共通 Table structure から移動対象可否と制約情報を導出する。移動可能な場合だけ DnD Interaction が Reorder Session を開始し、制約情報をその Session に保持する。

Drop Target Resolution は active な DnD 中に必要に応じて移動先を判定する。現在位置が変化しても Table 全体を再解析せず、DnD Interaction が Reorder Session から取り出した同じ制約情報を判定入力として利用する。個々の判定結果を完了またはキャンセル後に保持しない。

DnD に属する状態は 1 回の成立した操作中だけ有効とする。完了またはキャンセル時に、移動対象、並び替え方向、制約情報、移動先、確定可能性、DnD 用 Presentation、自動スクロールに関する一時状態を次の DnD へ持ち越さない。次の開始試行では現在の共通 Table structure から改めて制約情報を導出する。

Reorder Presentation は並び替えモードへ入ると現在方向の対象表示を開始する。この時点では Reorder Target Resolution に移動対象判定を要求しない。移動不可な開始試行では DnD Interaction から受け取った理由を一時的に表示する。DnD 開始後は移動対象、移動先、周囲の表示変化を扱い、完了またはキャンセル時の表示遷移が終わった後に DnD 用の一時状態を破棄する。並び替えモードが継続している場合は対象表示へ戻る。

並び替えモードを切り替えた場合は、以後の DnD 開始試行、DnD、対象表示を切り替え後の方向として扱う。並び替えモードを終了した場合は通常の Table 編集へ戻り、モード中の対象表示も終了する。

First-use Guidance の表示済み状態は DnD の Lifecycle とは分離し、利用者について PC とタッチ端末でそれぞれ一度だけ表示するという基本設計の境界を維持する。

Reorder Rediscovery の判定用状態は通常編集状態でのみ有効とし、並び替えモードへ入った場合や、同じ操作傾向として扱えない状態へ変わった場合は次の判定へ不要な履歴を持ち越さない。

## 10. Quality Requirements

### Large Table performance

次のいずれかを満たす Table を大規模 Table として扱う。

- 400 行以上
- 12 列以上
- 2,000 セル以上

Reorder v1 が想定する現実的な最大規模は、1,000 行、20 列、20,000 セルとする。

この規模でも、Editor DOM Context、Table Repository、Reorder Mode、First-use Guidance、Reorder Rediscovery、Input Interaction、DnD Interaction、Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Update の責務分離を保ち、行・列の DnD を実用的に利用できることをアーキテクチャ上の制約とする。

正式 v1 は、Table 全体の行数・列数・セル数に比例する並び替え用の常駐状態、常駐 UI、中間オブジェクトを並び替え成立の前提にしない。Table Repository が提供する共通 Table structure と Reorder Target Resolution が導出する制約情報は DnD をまたぐ常駐 cache とせず、structure revision や cache invalidation を必要とする設計を前提にしない。

DnD 開始試行では Reorder Target Resolution がその時点の共通 Table structure から移動対象判定と制約情報導出を行う。成立した DnD では、その制約情報を Reorder Session に保持して Drop Target Resolution の複数回の移動先判定に利用し、現在位置が変わるたびに Table 全体を再解析しない。

Reorder Target Resolution は DnD 開始試行時だけ移動対象を判定する。並び替えモード中の対象表示のために全行・全列を事前判定したり、Presentation の表示更新から Reorder Target Resolution を再評価したりすることを共通 Contract の前提にしない。

Drop Target Resolution に必要な状態評価と Reorder Presentation の表示更新は責務として分離し、表示更新が再び Table 全体の状態評価を要求する循環を DnD の進行経路に作らない。

DnD 中は Table 上の実際の順序を変更せず、destination と必要な Presentation 状態だけを更新する。Reorder Presentation は、ドラッグ中の移動対象、移動先、実際に表示位置が変わる行・列を中心に表示更新の対象を限定し、無関係な行・列まで一斉に表示更新や移動の対象へ含めない。

1 回の有効な DnD の確定に対して、Data Update が logical な並び替えを Table Repository へ反映要求する機会は 1 回だけとする。DnD の進行中や destination の変更ごとに Table データ更新を発生させない。

これらは実装方式を固定するものではない。virtualization、pooling、event delegation その他の具体的な実現方法は implementation で選択し、本書では上記の責務境界と制約だけを Contract とする。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| editor DOM context | 現在の editor で DOM / Web API を利用するために、その時点の editor lifecycle に属するものとして Editor DOM Context が解決して提供する context。 |
| common Table structure | Table Repository が要求時点の Table plugin 固有構造から提供する、Reorder core が共通に扱う Table 構造表現。Table Repository はこれを状態として保持しない。 |
| reorder constraint information | DnD 開始試行時に Reorder Target Resolution が現在の共通 Table structure から導出し、成立した Reorder Session が 1 回の DnD 中だけ保持する、移動対象・移動先判定に必要な構造上の制約情報。 |
| Reorder Session | Reorder Target Resolution が移動可能と判定した後から、完了またはキャンセルまで DnD Interaction が所有する 1 回の並び替え操作状態。移動対象、並び替え方向、制約情報、現在の移動先などを含む。 |
| start target | Input Interaction が DnD 開始試行として DnD Interaction に渡す、利用者がドラッグ開始を試みた行または列。 |
| reorder target | Reorder Target Resolution が移動可能と判定し、DnD Interaction が active な Reorder Session の移動対象として扱う行または列。 |
| destination | Drop Target Resolution が DnD 開始後に判定する有効な行間または列間。 |
| committed reorder | 有効な destination で DnD が完了し、Data Update に渡せる状態になった確定済みの並び替え。 |

### Related documents

- `docs/design/reorder-v1-design.md`
- #490 Reorder v1 アーキテクチャ設計書を作成する
- #493 DnD の視覚フィードバックを要件定義・基本設計に反映する
- #521 大規模Tableを前提に並び替え制約の計算方式を見直す
- #523 アーキテクチャ設計書を arc42 ベースへ整理し Structurizr DSL 自動生成を導入する
- #524 Architecture documentation rules を arc42 対応へ更新する
- #552 Table Integration の責務設計を Architecture 上で確定する
- #553 Reorder Constraint Resolution 廃止後の責務配置を Architecture に反映する
- #556 Table IntegrationをTable Repositoryへ再設計する
