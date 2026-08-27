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
- DOM / Web API を利用する責務は、現在の editor が iframe か non-iframe かを直接判定せず、Editor DOM Context が提供する現在の editor context を利用する。
- Editor DOM Context が提供する context は editor lifecycle をまたいで有効であることを前提にしない。
- Table 構造に由来する並び替え制約の抽出は Reorder Constraint Resolution に集約し、Reorder Target Resolution と Drop Target Resolution は Table 全体の構造を直接解析しない。
- 同じ Table 構造が有効な間は抽出済みの制約情報を再利用し、DnD 開始試行や DnD 中の移動先判定ごとに Table 全体から再抽出しない。
- Table 全体を並び替え用の中間構造へ変換して保持せず、セル数に比例する並び替え用中間オブジェクトを常駐させない。
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

Core Table と Flexible Table Block の内部表現の違いにかかわらず、本書で定義する責務間では、行・列の開始対象、並び替え制約、移動対象判定、有効な移動先、確定した並び替えという同じ概念で扱う。

Table 構造の解析は Reorder Constraint Resolution に集約し、移動対象判定と移動先判定に必要な構造上の制約だけを抽出して提供する。Table 構造に由来する DnD 開始前の移動対象可否は Reorder Target Resolution、DnD 開始後の移動先可否は Drop Target Resolution が、その制約情報を利用して判定する。Input Interaction、DnD Interaction、Reorder Presentation、Data Update が構造解析を独自に行わない境界とする。

DnD Interaction は Reorder Constraint Resolution に直接依存せず、DnD の開始可否と進行は Reorder Target Resolution と Drop Target Resolution を通じて扱う。

Table の実データ更新は DnD の進行および Reorder Presentation から分離し、確定した並び替えだけを外部の Table データへ反映する。

First-use Guidance と Reorder Rediscovery は、WordPress の通常編集として成立する操作を尊重し、並び替え案内のために通常編集の成立を奪わない。

## 4. Solution Strategy

Reorder v1 は、editor DOM context の解決、並び替えモード、案内、入力解釈、DnD の共通進行、並び替え制約の抽出、開始対象判定、移動先判定、表示、自動スクロール、Table データ更新を別々の責務として扱う。

Editor DOM Context は、現在の editor context に属する基準から、その時点で DOM / Web API を利用するための context を解決し、必要とする責務へ提供する。利用側に iframe / non-iframe の違いを持ち込まず、context の永続性や並び替え状態を所有しない。

Reorder Mode は通常編集、行並び替え、列並び替えの現在状態を管理する。Input Interaction は、その状態のもとで PC とタッチ端末の入力差を吸収し、DnD の開始試行・進行・完了・キャンセルという共通の意味へ変換する。

DnD Interaction は、入力方式に依存せず、Input Interaction から受け取った開始対象と Reorder Mode が示す並び替え方向を組み合わせて DnD の開始と進行を統括する。開始試行時だけ Reorder Target Resolution に移動対象判定を要求し、移動可能な場合だけ Reorder Session を開始する。移動不可の場合は DnD を開始せず、その理由を Reorder Presentation へ渡す。

Reorder Constraint Resolution は、現在の Table 構造から、Reorder Target Resolution と Drop Target Resolution が必要とする移動不可対象・移動不可境界などの構造上の制約だけを抽出する。行では `rowspan`、列では `rowspan` / `colspan` に由来する必要な制約を扱い、Table 全体を並び替え用の中間構造へ変換・保持しない。同じ Table 構造が有効な間は抽出済みの制約情報を共有し、個々の判定結果とは Lifecycle を分離する。

Reorder Target Resolution は DnD 開始試行時に Reorder Constraint Resolution の制約情報から移動対象可否を判定し、Drop Target Resolution は DnD 開始後に同じ制約情報と現在の移動対象から有効な移動先を判定する。両責務は Table 全体を直接走査する責務を持たない。

Reorder Presentation は Table データとは分離して移動対象、挿入線、周囲の行・列の表示変化を扱い、Auto Scroll は並び替え方向に応じた一方向の自動スクロールを扱う。

有効な移動先で完了した場合だけ DnD Interaction が確定した並び替えを Data Update へ渡す。Data Update は確定結果を対象 Table に 1 回だけ反映する。キャンセルまたは無効な完了では Data Update を動作させない。

First-use Guidance は初回案内、Reorder Rediscovery は初回案内後の再案内を扱い、いずれも Reorder Mode や DnD の状態を所有しない。

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | 通常の Table 編集、行並び替え、列並び替えのどの状態にあるかを管理し、並び替え操作の有効範囲を決める。 |
| RESP_FIRST_USE_GUIDANCE | First-use Guidance | PC とタッチ端末ごとの初回案内の表示状態を管理し、並び替えの入口を利用者に案内する。 |
| RESP_REORDER_REDISCOVERY | Reorder Rediscovery | 通常編集状態で並び替えを試みていると考えられる操作の繰り返しを判定し、必要な場合だけ並び替えの入口を再案内する。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在の editor context に属する基準から、その時点で利用すべき DOM / Web API context を解決し、必要とする責務へ提供する。 |
| RESP_INPUT_INTERACTION | Input Interaction | PC とタッチ端末の入力固有の差を共通の DnD 進行から分離し、開始試行・進行・完了・キャンセルとして DnD Interaction へ渡す境界を担う。 |
| RESP_DND_INTERACTION | DnD Interaction | 入力方式と行・列に共通する DnD の開始可否判定と進行を統括し、確定可能な操作だけを Data Update へ渡す。 |
| RESP_REORDER_CONSTRAINT_RESOLUTION | Reorder Constraint Resolution | 現在の Table 構造から移動対象・移動先判定に必要な構造上の制約だけを抽出し、同じ Table 構造が有効な間は共有できる制約情報として提供する。 |
| RESP_REORDER_TARGET_RESOLUTION | Reorder Target Resolution | DnD 開始試行時に、Reorder Constraint Resolution が提供する制約情報から行または列を移動対象として選択できるかを判定し、移動不可の場合はその理由を提供する。 |
| RESP_DROP_TARGET_RESOLUTION | Drop Target Resolution | DnD 開始後の移動対象と Reorder Constraint Resolution が提供する制約情報から、現在の位置が有効な移動先かを判定する。 |
| RESP_REORDER_PRESENTATION | Reorder Presentation | 並び替えモード中の対象表示、移動不可理由、および DnD 中から確定・キャンセルまでの視覚フィードバックを Table データの更新から分離して扱う。 |
| RESP_AUTO_SCROLL | Auto Scroll | DnD 中に、行では縦方向、列では横方向だけを移動のための自動スクロール対象とする。 |
| RESP_DATA_UPDATE | Data Update | 確定した並び替えだけを Table に反映し、保持すべきセル情報と Undo 単位を維持する。 |

### Relationships

| Source | Destination | Description |
| --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_FIRST_USE_GUIDANCE | 初回案内の表示契機となる編集環境の状態を提供する。 |
| EXT_WORDPRESS_EDITOR | RESP_REORDER_REDISCOVERY | 通常編集として成立した操作と並び替え試行候補を区別するための情報を提供する。 |
| EXT_WORDPRESS_EDITOR | RESP_EDITOR_DOM_CONTEXT | 現在の editor context に属する基準を通じて、解決対象となる編集環境を提供する。 |
| EXT_WORDPRESS_EDITOR | RESP_INPUT_INTERACTION | PC またはタッチ端末の入力を提供する。DOM / Web API context の解決は提供しない。 |
| EXT_CORE_TABLE | RESP_REORDER_CONSTRAINT_RESOLUTION | 現在の Core Table 構造と、その構造が変化したことを制約情報の有効性境界として提供する。 |
| EXT_FLEXIBLE_TABLE_BLOCK | RESP_REORDER_CONSTRAINT_RESOLUTION | 現在の Flexible Table Block 構造と、その構造が変化したことを制約情報の有効性境界として提供する。 |
| RESP_EDITOR_DOM_CONTEXT | RESP_FIRST_USE_GUIDANCE | 初回案内で DOM / Web API を利用する時点の editor context を提供する。 |
| RESP_EDITOR_DOM_CONTEXT | RESP_REORDER_REDISCOVERY | 再案内判定で DOM / Web API を利用する時点の editor context を提供する。 |
| RESP_EDITOR_DOM_CONTEXT | RESP_INPUT_INTERACTION | 入力解釈で DOM / Web API を利用する時点の editor context を提供する。 |
| RESP_EDITOR_DOM_CONTEXT | RESP_REORDER_PRESENTATION | 表示処理で DOM / Web API を利用する時点の editor context を提供する。 |
| RESP_EDITOR_DOM_CONTEXT | RESP_AUTO_SCROLL | 自動スクロールで DOM / Web API を利用する時点の editor context を提供する。 |
| RESP_REORDER_MODE | RESP_FIRST_USE_GUIDANCE | 並び替え入口の選択による案内終了を伝える。 |
| RESP_REORDER_MODE | RESP_REORDER_REDISCOVERY | 並び替えモード中は再案内判定を行わないための現在状態を提供する。 |
| RESP_REORDER_MODE | RESP_INPUT_INTERACTION | 現在の並び替え状態を提供する。 |
| RESP_REORDER_MODE | RESP_DND_INTERACTION | DnD 開始試行で使用する並び替え方向を提供する。 |
| RESP_REORDER_MODE | RESP_REORDER_PRESENTATION | 並び替えモード中に表示する対象方向を提供する。 |
| RESP_FIRST_USE_GUIDANCE | RESP_REORDER_REDISCOVERY | 初回案内が完了済みであることを再案内判定の前提として提供する。 |
| RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnD の開始試行、進行、完了、キャンセルを共通の意味で渡す。 |
| RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | DnD 開始試行時に開始対象と並び替え方向に対する移動対象判定を要求する。 |
| RESP_REORDER_TARGET_RESOLUTION | RESP_REORDER_CONSTRAINT_RESOLUTION | 現在の Table 構造に対応する移動対象判定用の制約情報を要求する。 |
| RESP_REORDER_CONSTRAINT_RESOLUTION | RESP_REORDER_TARGET_RESOLUTION | 同じ Table 構造が有効な間に再利用できる移動対象判定用の制約情報を提供する。 |
| RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 移動可能かどうかと、移動不可の場合の理由を返す。 |
| RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | active な DnD 中に現在位置に対応する移動先判定を要求する。 |
| RESP_DROP_TARGET_RESOLUTION | RESP_REORDER_CONSTRAINT_RESOLUTION | 現在の Table 構造に対応する移動先判定用の制約情報を要求する。 |
| RESP_REORDER_CONSTRAINT_RESOLUTION | RESP_DROP_TARGET_RESOLUTION | 同じ Table 構造が有効な間に再利用できる移動先判定用の制約情報を提供する。 |
| RESP_DROP_TARGET_RESOLUTION | RESP_DND_INTERACTION | 有効な移動先、または有効な移動先なしを返す。 |
| RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 移動不可理由、DnD の進行状態、確定結果、キャンセル結果を提供する。 |
| RESP_DND_INTERACTION | RESP_AUTO_SCROLL | active な DnD と並び替え方向を提供する。 |
| RESP_DND_INTERACTION | RESP_DATA_UPDATE | 有効な移動先で完了した確定済みの並び替えだけを渡す。 |
| RESP_AUTO_SCROLL | EXT_SCROLL_AREA | 行では縦方向、列では横方向の必要な自動スクロールを行う。 |
| RESP_DATA_UPDATE | EXT_CORE_TABLE | Core Table の行または列の位置を確定結果に従って更新する。 |
| RESP_DATA_UPDATE | EXT_FLEXIBLE_TABLE_BLOCK | Flexible Table Block の行または列の位置を確定結果に従って更新する。 |
| RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 1 回の成立した並び替えを 1 回で戻せる更新単位として反映する。 |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

通常の Table 編集、行並び替え、列並び替えのいずれが現在有効かを管理する。並び替えの入口から状態を切り替え、利用者が現在のモードを確認できる状態を提供する。

##### State ownership

通常、行並び替え、列並び替えの現在状態を所有する。DnD の進行状態、移動対象、移動先、Table データは所有しない。

##### Contract

「行を並び替え」「列を並び替え」の選択と並び替えモード終了を受け取り、現在の並び替え状態を Input Interaction、DnD Interaction、Reorder Presentation へ提供する。

通常状態では DnD を有効にせず、行並び替えでは行、列並び替えでは列を DnD の開始候補として扱える状態を提供する。個々の行または列が実際に移動対象として成立するかは判定しない。

##### Dependencies

Input Interaction、DnD Interaction、Reorder Presentation は現在の並び替え状態を Reorder Mode に依存する。First-use Guidance と Reorder Rediscovery は入口が選択されたことを自身の案内終了条件または再案内停止条件として扱うが、案内状態を Reorder Mode に持たせない。

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

##### Dependencies

Table へのポインター進入、Table のフォーカス、セル編集開始という編集環境側の状態に依存する。DOM / Web API を利用する場合は Editor DOM Context が提供する現在の editor context に依存する。入口の選択は Reorder Mode への切り替えと同時に First-use Guidance の終了条件になる。Reorder Rediscovery の再案内判定とは一時状態を共有しない。

##### Lifecycle

対象の操作環境で未表示の状態から、操作環境に応じた表示契機によって表示状態になる。入口選択または案内を閉じる操作で表示を終了し、その操作環境を表示済みとする。

PC では表示中に Table からポインターが外れても、それだけでは表示状態を終了しない。

##### Invariants

- PC とタッチ端末の表示済み状態を独立して扱う。
- PC とタッチ端末で定義された表示契機の違いを維持する。
- 初回案内は通常のセル編集を妨げない。
- PC ではポインター離脱だけを初回案内終了条件にしない。
- 案内終了後も並び替え入口そのものの利用可否を変更しない。

#### Reorder Rediscovery {#RESP_REORDER_REDISCOVERY}

##### Responsibility

初回案内表示済みの利用者が並び替え機能を忘れている可能性がある場合に、通常編集を妨げず、並び替えを試みていると判断できる操作の繰り返しから必要な再案内だけを成立させる。

##### State ownership

同じ行または列の付近で繰り返された並び替え試行候補の一時的な履歴と、同じ状況で過度に再案内しないための抑制状態を所有する。初回案内表示済み状態、Reorder Mode、DnD 状態、Table データは所有しない。

##### Contract

通常編集状態で、セル内容の編集、文字選択、通常スクロールなどとして成立しない、行または列を移動しようとする操作候補を受け取る。

同じ行または列の付近で短時間に操作候補が繰り返され、並び替えを試みていると判断できる場合だけ再案内を成立させる。一度だけの短いドラッグや通常の編集操作からは再案内を成立させない。

再案内が成立した場合は、並び替えの入口を確認できる案内を表示するための状態を提供する。同じ状況で案内を過度に繰り返さない。

##### Dependencies

通常編集として成立した操作かどうかを区別できる編集環境側の情報に依存する。DOM / Web API を利用する場合は Editor DOM Context が提供する現在の editor context に依存する。First-use Guidance の初回案内が表示済みであることを前提とする。Reorder Mode が並び替えモードにある間は再案内判定を行わない。

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

並び替え状態、Reorder Mode、DnD Session、Table データ、移動対象、移動先、Presentation 状態を所有しない。解決した editor DOM context を editor lifecycle をまたぐ永続状態として所有しない。

##### Contract

DOM / Web API を必要とする責務が現在の editor context を利用する時点で、現在の editor context に属する基準をもとに、その時点で利用すべき editor DOM context を解決して提供する。

利用側は、現在の editor が iframe か non-iframe かを判定せず、Editor DOM Context が提供する context を利用する。

context の解決に使用する具体的な DOM 要素、Web API property、探索方法、識別子はこの Contract では固定しない。現在の editor context を解決できない場合に、以前の editor lifecycle で得た context を代替として提供しない。

##### Dependencies

現在の WordPress Editor と、現在の editor context に属する基準に依存する。DOM / Web API を利用する First-use Guidance、Reorder Rediscovery、Input Interaction、Reorder Presentation、Auto Scroll は Editor DOM Context が提供する context に依存する。

Reorder Mode、DnD Interaction、Reorder Constraint Resolution、Reorder Target Resolution、Drop Target Resolution、Data Update の状態や判定には依存しない。

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

#### Input Interaction {#RESP_INPUT_INTERACTION}

##### Responsibility

PC とタッチ端末の入力固有の差を、共通の DnD Interaction から分離して扱う。並び替えモード中の入力を DnD の開始試行・進行・完了・キャンセルという共通の意味へ変換し、入力方式に依存しない DnD Interaction へ渡す。

##### State ownership

入力を DnD として解釈するために必要な一時状態だけを所有する。Reorder Mode、移動対象の成立可否と移動不可理由、移動対象、現在の移動先、確定可能性、Table データ、Presentation 状態は所有しない。

##### Contract

Reorder Mode から現在の並び替え状態を受け取り、WordPress 編集環境から PC またはタッチ端末の入力を受け取る。

現在の並び替えモードで DnD の開始を試みる入力が成立した場合は、開始対象を開始試行として DnD Interaction へ渡す。開始対象が移動可能かどうかは Input Interaction では判定せず、並び替え方向も DnD Interaction へ提供しない。

DnD が開始された後は、進行、完了、キャンセルとして解釈した入力を DnD Interaction へ渡す。DnD Interaction へ渡す Contract には、PC とタッチ端末ごとの入力成立方法そのものを含めない。

##### Dependencies

Reorder Mode と WordPress 編集環境の入力に依存する。DOM / Web API を利用する場合は Editor DOM Context が提供する現在の editor context に依存する。DnD の開始試行と共通進行は DnD Interaction に渡し、Reorder Constraint Resolution、Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Update には直接依存しない。

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

#### DnD Interaction {#RESP_DND_INTERACTION}

##### Responsibility

Input Interaction から受け取る DnD の開始試行と、開始後の DnD を入力方式および行・列に共通する 1 つの並び替え操作として統括する。開始試行では Reorder Target Resolution の判定に基づいて DnD の開始または非開始を決め、開始後は移動対象、現在の移動先、確定可能性、完了結果を保持し、有効な移動先で完了した場合だけ確定した並び替えを Data Update へ渡す。

##### State ownership

DnD が進行中かどうか、行または列のどちらを扱っているか、開始後の移動対象、現在の有効な移動先、確定可能性、完了結果を所有する。移動対象として選択できるかという判定規則、入力方式固有の一時状態、並び替え制約、Table データ自体、視覚表示状態は所有しない。

##### Contract

Input Interaction から DnD の開始試行・進行・完了・キャンセルを受け取る。開始試行に含まれる開始対象と Reorder Mode が示す並び替え方向を Reorder Target Resolution に渡して移動対象判定を要求する。

Reorder Target Resolution が移動可能と判定した場合だけ、その対象を移動対象として共通の Reorder Session を開始する。移動不可と判定した場合は Reorder Session を開始せず、その理由を Reorder Presentation に提供する。

進行中は現在位置に応じた移動先判定を Drop Target Resolution に求め、その結果を操作状態として保持する。Reorder Presentation と Auto Scroll が必要とする進行状態を提供する。

完了時に有効な移動先がある場合だけ、移動対象と移動先を含む確定した並び替えを Data Update に渡し、Reorder Presentation に確定結果を提供する。

キャンセル時は Data Update に何も渡さず、Reorder Presentation にキャンセル結果を提供する。無効な完了では確定した並び替えを生成しない。

##### Dependencies

Input Interaction から入力方式に依存しない DnD の開始試行と進行を受け取る。開始対象は Input Interaction から受け取り、並び替え方向は Reorder Mode に依存して決める。Reorder Target Resolution に依存して開始対象が移動対象として成立するかを決め、Drop Target Resolution に依存して DnD 開始後の有効な移動先を決める。

Reorder Constraint Resolution には直接依存しない。Table 構造の解析と制約情報の取得は Reorder Target Resolution と Drop Target Resolution の境界内で扱う。

Reorder Presentation は移動不可理由と DnD Interaction の進行状態に依存し、Auto Scroll は active な DnD の進行状態に依存する。Data Update とは確定した並び替えだけを通じて接続する。

##### Lifecycle

並び替えモード中に Input Interaction から DnD の開始試行を受ける。Reorder Target Resolution が移動可能と判定した場合だけ active になり、完了またはキャンセルまで active を維持し、その間だけ移動対象と移動先を保持する。

移動不可と判定された場合は active にならず、理由を Reorder Presentation へ渡して開始試行を終了する。完了またはキャンセル時は結果を確定し、Data Update と Reorder Presentation に必要な結果を渡した後、次の DnD へ前回の操作状態を持ち越さない。

##### Invariants

- 通常の Table 編集状態から DnD の開始試行を成立させない。
- Reorder Target Resolution が移動可能と判定していない対象から DnD を開始しない。
- 移動不可な開始試行では Reorder Session を作らない。
- 移動対象判定の規則を自身で重複して所有しない。
- Reorder Constraint Resolution に直接依存しない。
- DnD 開始前に Drop Target Resolution を移動対象判定へ利用しない。
- 入力方式固有の状態を所有しない。
- 行と列で Lifecycle、destination 更新、commit、cancel の Contract を分岐させない。
- DnD 中に Table データを変更しない。
- 有効な移動先なしに確定した並び替えを生成しない。
- キャンセル時は Data Update へ更新要求を渡さない。
- 完了またはキャンセル後に前回の移動対象や移動先を次の DnD へ保持しない。
- Data Update へ渡す時点で並び替えは確定済みである。

#### Reorder Constraint Resolution {#RESP_REORDER_CONSTRAINT_RESOLUTION}

##### Responsibility

現在の Table 構造を解析し、Reorder Target Resolution と Drop Target Resolution が移動対象・移動先を判定するために必要な構造上の制約だけを抽出して提供する。

行では `rowspan`、列では `rowspan` / `colspan` に由来する移動不可対象・移動不可境界など、判定に必要な制約を扱う。Table 全体を並び替え用の中間構造へ変換・保持する責務は持たない。

##### State ownership

現在の Table 構造に対応して抽出した制約情報と、その制約情報がどの Table 構造に対して有効かという Lifecycle 境界を所有する。

Table データそのもの、セルごとの並び替え用中間オブジェクト、DnD Session、個々の開始試行の判定結果、個々の移動先判定結果は所有しない。

##### Contract

Core Table または Flexible Table Block の現在の Table 構造から、移動対象判定と移動先判定に必要な構造上の制約だけを抽出する。

Reorder Target Resolution には DnD 開始試行で必要な移動対象判定用の制約情報を提供し、Drop Target Resolution には DnD 開始後の移動先判定用の制約情報を提供する。同じ Table 構造が有効な間は、抽出済みの制約情報を両責務からの複数回の要求に対して再利用できる。

制約情報は Table 全体の並び替え用コピーではなく、構造上の制約を判定するために必要な情報だけとする。セル数に比例する並び替え用中間オブジェクトを Contract の前提にしない。

##### Dependencies

WordPress Core Table または Flexible Table Block の現在の Table 構造に依存する。Reorder Target Resolution と Drop Target Resolution は制約情報を Reorder Constraint Resolution に依存する。

DnD Interaction、Input Interaction、Reorder Presentation、Auto Scroll、Data Update の進行状態には依存せず、それらから直接判定要求を受け取らない。

##### Lifecycle

同じ Table 構造が有効な期間について、判定に必要な制約情報を 1 回抽出する。抽出済みの制約情報は、同じ Table 構造が有効な間、複数回の DnD 開始試行と DnD 中の移動先判定で再利用できる。

DnD ごと、開始試行ごと、現在位置の変化ごとに Table 全体から制約情報を再抽出しない。

並び替えの確定、行・列の追加または削除、セル結合状態の変更、Undo / Redo その他の経路によって Table 構造が変化した場合、以前の Table 構造に対応する制約情報は無効とする。新しい Table 構造に対して判定が必要になった場合は、新しい制約情報を抽出する。

個々の Reorder Target Resolution と Drop Target Resolution の判定結果の Lifecycle は制約情報から分離し、それらの判定結果を制約情報の代わりに再利用しない。

##### Invariants

- Table 全体を並び替え用の中間構造へ変換・保持しない。
- セル数に比例する並び替え用中間オブジェクトを生成・保持することを Contract の前提にしない。
- 同じ Table 構造が有効な間は、DnD 開始試行や移動先判定ごとに Table 全体から制約情報を再抽出しない。
- Table 構造が変化した後に、以前の構造から抽出した制約情報を再利用しない。
- Reorder Target Resolution と Drop Target Resolution の個々の判定結果を所有しない。
- DnD Interaction へ直接制約情報を提供しない。
- Table データを変更しない。

#### Reorder Target Resolution {#RESP_REORDER_TARGET_RESOLUTION}

##### Responsibility

DnD 開始試行時に、現在の並び替え方向で開始対象となる行または列を移動対象として選択できるかを Reorder Constraint Resolution が提供する制約情報から判定する。移動できない対象では、その理由を DnD Interaction が利用できる判定結果として提供する。

行では `rowspan` によって複数行にまたがる結合範囲の一部となる行を移動対象にしない。`colspan` は行全体の移動を妨げないため、`colspan` だけを理由に行を移動不可にしない。

列では `colspan` によって複数列にまたがる結合範囲の一部となる列を移動対象にしない。`rowspan` は列全体の移動対象可否だけを理由に制限しない。

##### State ownership

永続的な DnD 状態、Table データ、制約情報の Lifecycle を所有しない。現在の判定に必要な開始対象、並び替え方向、Reorder Constraint Resolution が提供する制約情報を入力として扱い、移動可能かどうかと、移動不可の場合の理由を判定結果として提供する。

##### Contract

DnD Interaction から開始対象と行または列の並び替え方向に対応する判定要求を受け取り、Reorder Constraint Resolution から現在の Table 構造に対応する制約情報を受け取る。

移動対象として成立する場合は移動可能であることを返す。成立しない場合は移動不可であることと、DnD Interaction が Reorder Presentation へ渡せる理由を返す。

Table 全体の構造を直接走査して制約を再構築せず、並び替えモード中の対象表示のための判定要求は受け取らない。

##### Dependencies

DnD Interaction から受け取る開始対象と並び替え方向、および Reorder Constraint Resolution が提供する現在の Table 構造に対応する制約情報に依存する。DnD Interaction は開始可否の判定結果に依存する。Reorder Presentation とは直接依存しない。

対象 Table の構造解析、Drop Target Resolution、Auto Scroll、Data Update には依存せず、Table 変更を要求しない。

##### Lifecycle

DnD Interaction から DnD 開始試行に対応する判定要求を受けたときだけ判定する。並び替えモードへ入った時点では全行・全列の移動可否を事前判定しない。判定結果を独立した Reorder Session 状態として保持せず、次の開始試行へ以前の判定結果を持ち越さない。

Reorder Constraint Resolution が提供する制約情報の Lifecycle はこの判定結果から分離し、同じ Table 構造に対する次の開始試行で制約情報が再利用されることを妨げない。

##### Invariants

- DnD 開始試行時の移動対象成立可否だけを判定し、DnD 開始後の移動先判定を担わない。
- Table 全体を直接走査して並び替え制約を抽出しない。
- 並び替えモード中の対象表示のために利用しない。
- 行では `rowspan` によって一体化された範囲の一部を移動対象として返さない。
- 行では `colspan` だけを理由に移動不可と判定しない。
- 列では `colspan` によって一体化された範囲の一部を移動対象として返さない。
- 列では `rowspan` だけを理由に移動不可と判定しない。
- 移動不可の場合は DnD Interaction が利用できる理由を判定結果に含める。
- 移動対象判定によって Table データを変更しない。

#### Drop Target Resolution {#RESP_DROP_TARGET_RESOLUTION}

##### Responsibility

開始済みの行または列 DnD に対して、現在位置が Table 構造を保てる有効な移動先かを、Reorder Constraint Resolution が提供する制約情報と現在の移動対象から判定する。結合セルなどにより構造が成立しなくなる位置は有効な移動先として返さない。

##### State ownership

永続的な DnD 状態、Table データ、制約情報の Lifecycle を所有しない。現在の判定に必要な移動対象、並び替え方向、Reorder Constraint Resolution が提供する制約情報、現在位置を入力として扱う。移動対象として選択できるかという開始前判定は所有しない。

##### Contract

active な DnD Interaction から現在の移動対象、行または列の方向、現在位置に対応する判定要求を受け取り、Reorder Constraint Resolution から現在の Table 構造に対応する制約情報を受け取る。

Table 構造を保てる場合は有効な行間または列間を返し、成立しない場合は有効な移動先なしを返す。Table 全体を直接走査して制約を再構築せず、DnD 開始前の開始対象に対する判定結果は返さない。

##### Dependencies

Reorder Constraint Resolution が提供する現在の Table 構造に対応する制約情報に依存する。active な DnD Interaction は判定結果に依存する。対象 Table の構造解析と Reorder Target Resolution の移動対象判定を代替せず、Reorder Presentation と Data Update に直接 Table 変更を要求しない。

##### Lifecycle

DnD Interaction が active の間に必要に応じて判定を行う。現在位置が変化して判定を繰り返す場合も、同じ Table 構造が有効な間は Reorder Constraint Resolution が提供する抽出済みの制約情報を利用し、移動先判定ごとに Table 全体から再抽出しない。

DnD が開始していない間は移動先判定を行わず、完了またはキャンセル後に個々の判定結果を独立した状態として保持しない。制約情報そのものの Lifecycle は個々の判定結果から分離する。

##### Invariants

- DnD 開始後の移動先だけを判定する。
- DnD 開始前の移動対象成立可否を判定しない。
- Table 全体を直接走査して並び替え制約を抽出しない。
- Table 構造が成立しなくなる位置を有効な移動先として返さない。
- 行 DnD では行間、列 DnD では列間を移動先として扱う。
- 移動先判定によって Table データを変更しない。

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

##### Dependencies

Reorder Mode の現在状態に依存してモード中の対象表示を行う。DOM / Web API を利用する場合は Editor DOM Context が提供する現在の editor context に依存する。Reorder Constraint Resolution と Reorder Target Resolution には直接依存しない。移動不可理由は DnD Interaction 経由で受け取り、DnD 開始後の移動先の有効性は Drop Target Resolution の結果を DnD Interaction 経由で受け取る。

Auto Scroll とは互いの責務を侵食せず、移動対象の表示範囲制約によって必要な自動スクロールを妨げない。Data Update には Table 変更を要求しない。

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

#### Auto Scroll {#RESP_AUTO_SCROLL}

##### Responsibility

Table が画面内に収まらない場合でも、進行中の DnD の移動方向に沿って並び替えを継続できるようにする。

##### State ownership

DnD 中に現在自動スクロールの対象となる方向を扱う。Reorder Mode、移動対象、移動先、Table データは所有しない。

##### Contract

DnD Interaction から進行中の並び替え方向を受け取る。行 DnD では縦方向、列 DnD では横方向だけを自動スクロール対象とする。

DnD を開始していない通常状態、および移動不可な開始試行では、この方向制限を通常の Table や編集画面のスクロールへ適用しない。

##### Dependencies

DnD Interaction の active 状態と並び替え方向に依存する。DOM / Web API を利用する場合は Editor DOM Context が提供する現在の editor context に依存する。スクロール可能な Table または編集画面の領域と接続する。Reorder Presentation の表示範囲制約によって必要な自動スクロールが妨げられないことを前提とする。Reorder Constraint Resolution、Reorder Target Resolution、Drop Target Resolution、Data Update の責務を持たない。

##### Lifecycle

DnD 中に必要な場合だけ有効になる。移動不可な開始試行では有効にならない。DnD の完了またはキャンセルで終了し、方向制限を通常状態へ持ち越さない。

##### Invariants

- DOM / Web API を利用するために iframe / non-iframe の違いを直接判定しない。
- 行 DnD 中は横方向を自動スクロールしない。
- 列 DnD 中は縦方向を自動スクロールしない。
- active な DnD 中だけ移動方向に応じた自動スクロール制約を適用する。

#### Data Update {#RESP_DATA_UPDATE}

##### Responsibility

DnD Interaction から受け取った確定済みの並び替えを Table に反映する。行または列の位置だけを変更し、セルの内容、属性、装飾その他の保持すべき情報を維持する。

##### State ownership

確定した並び替えを Table データへ反映する責務を所有する。DnD の進行状態、Presentation、並び替え制約、移動対象判定、移動先判定は所有しない。Table データそのものの永続的な所有者にはならない。

##### Contract

DnD Interaction から、有効な移動先で完了した確定済みの並び替えだけを受け取る。

WordPress Core Table または Flexible Table Block の対象データに対し、移動した行または列の位置を変更する。セル内容の種類に依存せず、内容そのものは変更しない。

1 回の確定した並び替えを 1 回だけ Table データへ反映し、1 回の Undo で並び替え前へ戻せる更新とする。

##### Dependencies

DnD Interaction からの確定済みの並び替えにだけ依存する。WordPress Core Table または Flexible Table Block の Table データと Undo の仕組みに接続する。Reorder Constraint Resolution、Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scroll から直接更新要求を受け取らない。

##### Lifecycle

確定済みの並び替えを受け取ったときだけ動作する。更新を反映した後に DnD の一時状態を保持しない。移動不可な開始試行、キャンセル、無効な DnD では動作しない。

Data Update による並び替え確定で Table 構造が変化した後は、以前の構造に対応する Reorder Constraint Resolution の制約情報を次の判定へ再利用しない。

##### Invariants

- 確定していない DnD から Table データを変更しない。
- 1 回の確定した並び替えを複数回 Table データへ反映しない。
- 変更するのは行または列の位置だけとする。
- セルの内容、属性、装飾その他の保持すべき情報を維持する。
- テキスト、画像、RichText その他のセル内容の種類によって並び替えの扱いを変えない。
- 1 回の成立した並び替えを 1 回の Undo で戻せる状態を維持する。
- Core Table と Flexible Table Block で利用者から見た結果の方針を変えない。

## 6. Runtime View

### DnD start with movable target {#RV_DND_START_MOVABLE}

移動可能な対象から DnD 開始が試みられ、現在の Table 構造に対応する制約情報を利用して active な Reorder Session が成立するまでの協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 開始対象を含む DnD 開始試行を渡す。 |
| 2 | RESP_REORDER_MODE | RESP_DND_INTERACTION | 現在の並び替え方向を提供する。 |
| 3 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | 開始対象と並び替え方向に対する移動対象判定を要求する。 |
| 4 | RESP_REORDER_TARGET_RESOLUTION | RESP_REORDER_CONSTRAINT_RESOLUTION | 現在の Table 構造に対応する移動対象判定用の制約情報を要求する。 |
| 5 | RESP_REORDER_CONSTRAINT_RESOLUTION | RESP_REORDER_TARGET_RESOLUTION | 同じ Table 構造が有効な間に再利用できる制約情報を提供する。 |
| 6 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 移動可能であることを返す。 |
| 7 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | DnD が開始した移動対象と進行状態を提供する。 |
| 8 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | active な DnD と並び替え方向を提供する。 |

### DnD start with immovable target {#RV_DND_START_IMMOVABLE}

移動不可な対象から DnD 開始が試みられ、現在の Table 構造に対応する制約情報を利用して Reorder Session を作らず理由を表示するまでの協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 開始対象を含む DnD 開始試行を渡す。 |
| 2 | RESP_REORDER_MODE | RESP_DND_INTERACTION | 現在の並び替え方向を提供する。 |
| 3 | RESP_DND_INTERACTION | RESP_REORDER_TARGET_RESOLUTION | 開始対象と並び替え方向に対する移動対象判定を要求する。 |
| 4 | RESP_REORDER_TARGET_RESOLUTION | RESP_REORDER_CONSTRAINT_RESOLUTION | 現在の Table 構造に対応する移動対象判定用の制約情報を要求する。 |
| 5 | RESP_REORDER_CONSTRAINT_RESOLUTION | RESP_REORDER_TARGET_RESOLUTION | 同じ Table 構造が有効な間に再利用できる制約情報を提供する。 |
| 6 | RESP_REORDER_TARGET_RESOLUTION | RESP_DND_INTERACTION | 移動不可であることと理由を返す。 |
| 7 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | DnD を開始せず、移動不可理由を一時表示するために渡す。 |

### DnD progress {#RV_DND_PROGRESS}

開始済み DnD の進行に応じて、同じ Table 構造から抽出済みの制約情報を利用しながら移動先、表示、自動スクロールを更新する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | 現在位置に対応する DnD 進行情報を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DROP_TARGET_RESOLUTION | 現在の移動対象、並び替え方向、現在位置に対する移動先判定を要求する。 |
| 3 | RESP_DROP_TARGET_RESOLUTION | RESP_REORDER_CONSTRAINT_RESOLUTION | 現在の Table 構造に対応する移動先判定用の制約情報を要求する。 |
| 4 | RESP_REORDER_CONSTRAINT_RESOLUTION | RESP_DROP_TARGET_RESOLUTION | 同じ Table 構造が有効な間に再利用できる制約情報を提供する。 |
| 5 | RESP_DROP_TARGET_RESOLUTION | RESP_DND_INTERACTION | 有効な移動先、または有効な移動先なしを返す。 |
| 6 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 移動対象と現在の有効な移動先を提供し、挿入線と必要な周囲の表示変化を更新させる。 |
| 7 | RESP_DND_INTERACTION | RESP_AUTO_SCROLL | active な DnD と並び替え方向を提供する。 |
| 8 | RESP_AUTO_SCROLL | EXT_SCROLL_AREA | 行では縦方向、列では横方向に必要な自動スクロールを行う。 |

### DnD commit to Core Table {#RV_DND_COMMIT_CORE_TABLE}

有効な移動先で DnD が完了し、Core Table データへ 1 回だけ確定結果を反映する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnD 完了を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DATA_UPDATE | 移動対象と移動先を含む確定済みの並び替えを渡す。 |
| 3 | RESP_DATA_UPDATE | EXT_CORE_TABLE | Core Table の行または列の位置を更新する。 |
| 4 | RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 1 回の並び替えを 1 回の Undo で戻せる更新単位として成立させる。 |
| 5 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。 |

### DnD commit to Flexible Table Block {#RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK}

有効な移動先で DnD が完了し、Flexible Table Block データへ 1 回だけ確定結果を反映する協調を示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_INPUT_INTERACTION | RESP_DND_INTERACTION | DnD 完了を渡す。 |
| 2 | RESP_DND_INTERACTION | RESP_DATA_UPDATE | 移動対象と移動先を含む確定済みの並び替えを渡す。 |
| 3 | RESP_DATA_UPDATE | EXT_FLEXIBLE_TABLE_BLOCK | Flexible Table Block の行または列の位置を更新する。 |
| 4 | RESP_DATA_UPDATE | EXT_WORDPRESS_UNDO | 1 回の並び替えを 1 回の Undo で戻せる更新単位として成立させる。 |
| 5 | RESP_DND_INTERACTION | RESP_REORDER_PRESENTATION | 確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。 |

### DnD cancel {#RV_DND_CANCEL}

開始済み DnD がキャンセルされ、Table データを変更せず表示状態を終了する協調を示す。

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
- PC とタッチ端末の入力固有の解釈に必要な一時状態は Input Interaction が所有し、移動対象、移動先、確定可能性などの Reorder Session 状態は所有しない。
- 現在の Table 構造に対応する並び替え制約とその有効期間は Reorder Constraint Resolution が所有する。Table データそのものや個々の判定結果は所有しない。
- DnD 開始試行時に開始対象を移動対象として選択できるかと、移動不可の場合の理由は Reorder Target Resolution が判定し、永続的な DnD 状態や制約情報としては所有しない。
- 進行中の DnD、移動対象、現在の移動先、確定可能性、完了結果は DnD Interaction が所有する。移動不可な開始試行ではこれらの Reorder Session 状態を作らない。
- 移動先の有効性そのものは Drop Target Resolution が DnD 開始後に判定し、永続的な Table 状態や制約情報としては所有しない。
- 並び替えモード中の対象表示、移動不可理由の一時表示、DnD 中の移動対象、挿入線、周囲の行・列の表示変化、確定・キャンセル時の一時的な表示状態は Reorder Presentation が所有する。
- Table のデータは WordPress の対象ブロック側に存在し、YTR 内でその順序変更を行う責務は Data Update に限定する。

### Architecture-wide invariants

- DOM / Web API を利用する責務は Editor DOM Context が提供する現在の editor context を利用し、iframe / non-iframe の違いを直接判定しない。
- Editor DOM Context は現在の editor context に属する基準から context を解決し、editor lifecycle をまたいだ有効性を前提にしない。
- Editor DOM Context の context 解決と、Reorder Mode、DnD Session、Table データ、移動対象、移動先の状態所有を分離する。
- PC とタッチ端末の入力固有の差を DnD Interaction 以降の共通処理へ持ち込まない。
- DnD Interaction が Reorder Target Resolution に渡す並び替え方向は Reorder Mode の現在状態から得る。Input Interaction を並び替え方向の情報源にしない。
- DnD Interaction は DnD 開始前の移動対象判定を Reorder Target Resolution に委ね、開始後の移動先判定を Drop Target Resolution に委ねる。Reorder Constraint Resolution には直接依存しない。
- Reorder Constraint Resolution は Table 構造から移動対象・移動先判定に必要な制約だけを抽出し、Reorder Target Resolution と Drop Target Resolution は Table 全体の構造を直接解析しない。
- 同じ Table 構造が有効な間は抽出済みの制約情報を再利用し、個々の開始試行や移動先判定ごとに Table 全体から制約情報を再抽出しない。
- 並び替え確定、行・列の追加または削除、セル結合状態の変更、Undo / Redo その他の経路で Table 構造が変化した場合、以前の構造から抽出した制約情報を再利用しない。
- Table 全体を並び替え用の中間構造へ変換・保持せず、セル数に比例する並び替え用中間オブジェクトを常駐させない。
- 移動対象として成立しない行または列から DnD を開始しない。
- 行の移動対象判定では `rowspan` による移動不可を扱い、`colspan` だけを理由に不要な制限を掛けない。
- 列の移動対象判定では `colspan` による移動不可を扱い、`rowspan` だけを理由に不要な制限を掛けない。
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

Reorder Mode が通常状態にある間は Input Interaction から DnD Interaction への開始試行を成立させない。行または列の並び替えモードへ入った後に、その方向の DnD 開始を試行できる。

Input Interaction の入力固有の一時状態は、その入力を DnD の開始試行・進行・完了・キャンセルとして扱うために必要な期間だけ有効とする。DnD が完了またはキャンセルされた場合、Reorder Target Resolution により開始不可と判定された場合、または入力が DnD として成立しなかった場合は、次の操作へ不要な入力状態を持ち越さない。

Reorder Constraint Resolution の制約情報は、同じ Table 構造が有効な期間について 1 回抽出し、その期間中の複数回の DnD 開始試行と DnD 中の移動先判定で再利用できる。DnD Session の開始・完了・キャンセルだけを理由に制約情報を作り直さない。

並び替えの確定だけでなく、行・列の追加または削除、セル結合状態の変更、Undo / Redo など別経路によって Table 構造が変化した場合も、以前の構造に対応する制約情報を無効とする。新しい Table 構造に対して判定が必要になった時点で新しい制約情報を抽出する。

DnD Interaction は開始試行ごとに Reorder Target Resolution の判定を受け、移動可能な場合だけ active になる。移動不可の場合は active にならず、その理由を Reorder Presentation へ渡して開始試行を終了する。Reorder Target Resolution の個々の判定結果は次の開始試行へ持ち越さず、Reorder Constraint Resolution の制約情報の Lifecycle とは分離する。

Drop Target Resolution は active な DnD 中に必要に応じて移動先を判定する。同じ Table 構造が有効な間は Reorder Constraint Resolution の抽出済み制約情報を利用し、個々の判定結果は完了またはキャンセル後に独立した状態として保持しない。

Reorder Presentation は並び替えモードへ入ると現在方向の対象表示を開始する。この時点では Reorder Target Resolution に移動対象判定を要求しない。移動不可な開始試行では DnD Interaction から受け取った理由を一時的に表示する。DnD 開始後は移動対象、移動先、周囲の表示変化を扱い、完了またはキャンセル時の表示遷移が終わった後に DnD 用の一時状態を破棄する。並び替えモードが継続している場合は対象表示へ戻る。

DnD に属する状態は 1 回の成立した操作中だけ有効とする。完了またはキャンセル時に、移動対象、移動先、確定可能性、DnD 用 Presentation、自動スクロールに関する一時状態を次の DnD へ持ち越さない。

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

この規模でも、Editor DOM Context、Reorder Mode、First-use Guidance、Reorder Rediscovery、Input Interaction、DnD Interaction、Reorder Constraint Resolution、Reorder Target Resolution、Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Update の責務分離を保ち、行・列の DnD を実用的に利用できることをアーキテクチャ上の制約とする。

正式 v1 は、Table 全体の行数・列数・セル数に比例する並び替え用の常駐状態、常駐 UI、中間オブジェクトを並び替え成立の前提にしない。Table 全体を並び替え用の中間構造へ変換・保持せず、大規模 Table でもセル数に比例する並び替え用中間オブジェクトを常駐させる構造を要求しない。

Table 構造の解析は Reorder Constraint Resolution に集約し、同じ Table 構造が有効な期間について、移動対象判定と移動先判定に必要な制約情報を 1 回抽出する。抽出済みの制約情報は複数回の DnD 開始試行と DnD 中の移動先判定で共有し、DnD ごと、開始試行ごと、現在位置の変化ごとに Table 全体から再抽出しない。

Reorder Target Resolution は DnD 開始試行時だけ移動対象を判定し、個々の判定結果を次の開始試行へ再利用しない。並び替えモード中の対象表示のために全行・全列を事前判定したり、Presentation の表示更新から Reorder Target Resolution を再評価したりすることを共通 Contract の前提にしない。

DnD の進行中は、Drop Target Resolution が Reorder Constraint Resolution の抽出済み制約情報と現在の移動対象・現在位置を利用する。移動先が変わるたびに Table 全体を走査または再評価することを共通 Contract の前提にしない。

Drop Target Resolution に必要な状態評価と Reorder Presentation の表示更新は責務として分離し、表示更新が再び Table 全体の状態評価を要求する循環を DnD の進行経路に作らない。

DnD 中は Table 上の実際の順序を変更せず、destination と必要な Presentation 状態だけを更新する。Reorder Presentation は、ドラッグ中の移動対象、移動先、実際に表示位置が変わる行・列を中心に表示更新の対象を限定し、無関係な行・列まで一斉に表示更新や移動の対象へ含めない。

1 回の有効な DnD の確定に対して、Data Update が logical な並び替えを反映する機会は 1 回だけとする。DnD の進行中や destination の変更ごとに Table データ更新を発生させない。

これらは実装方式を固定するものではない。virtualization、pooling、event delegation その他の具体的な実現方法は implementation で選択し、本書では上記の責務境界と制約だけを Contract とする。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| editor DOM context | 現在の editor で DOM / Web API を利用するために、その時点の editor lifecycle に属するものとして Editor DOM Context が解決して提供する context。 |
| reorder constraint information | 現在の Table 構造から Reorder Constraint Resolution が抽出し、Reorder Target Resolution と Drop Target Resolution が共有して利用する、移動不可対象・移動不可境界などの構造上の制約情報。 |
| Reorder Session | Reorder Target Resolution が移動可能と判定した後から、完了またはキャンセルまで DnD Interaction が所有する 1 回の並び替え操作状態。 |
| start target | Input Interaction が DnD 開始試行として DnD Interaction に渡す、利用者がドラッグ開始を試みた行または列。 |
| reorder target | Reorder Target Resolution が移動可能と判定し、DnD Interaction が active な Reorder Session の移動対象として扱う行または列。 |
| destination | Drop Target Resolution が DnD 開始後に判定する有効な行間または列間。 |
| committed reorder | 有効な destination で DnD が完了し、Data Update に渡せる状態になった確定済みの並び替え。 |

### Related documents

- `docs/design/reorder-v1-design.md`
- #481 YTR 正式 v1 の並び替え仕様を再設計する
- #490 Reorder v1 アーキテクチャ設計書を作成する
- #493 DnD の視覚フィードバックを要件定義・基本設計に反映する
- #521 大規模Tableを前提に並び替え制約の計算方式を見直す
- #523 アーキテクチャ設計書を arc42 ベースへ整理し Structurizr DSL 自動生成を導入する
- #524 Architecture documentation rules を arc42 対応へ更新する
