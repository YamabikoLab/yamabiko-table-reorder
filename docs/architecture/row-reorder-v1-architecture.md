# Row Reorder v1 アーキテクチャ設計書

## 1. Introduction and Goals

本書は、`docs/requirements/reorder-v1-requirements.md`、`docs/requirements/reorder-v1-quality-requirements.md`、`docs/design/reorder-v1-design.md`を入力として、行並び替えを実現するための内部責務、責務間の境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

本Architectureは行並び替えだけを対象とし、列並び替えを成立させるための共通化を行わない。列並び替えは`column-reorder-v1-architecture.md`を独立した正本とする。

DOM / Web APIを利用するためのEditor環境差の解決だけは`editor-dom-context.md`を共有Architectureとして利用する。

機能対象は主に`FR-01`、`FR-03`〜`FR-17`のうち行並び替えに適用される要件とし、対応Table Blockは`FR-13`を正本とする。品質保証範囲は`QR-01`、`QR-02`、`QR-03`を正本とする。

## 2. Architecture Constraints

- 行並び替えは列並び替えから独立したArchitectureとして成立させる。
- 列並び替えとの共通Reorder abstraction、共通Table structure、共通Session、共通Target / Destination typeを導入しない。
- PCとタッチ端末で、入力成立方法の違いをRow DnD Interaction以降へ持ち込まない。
- `FR-13`で定義される対応Table Blockの違いはRow Table Integrationの境界内に隠蔽する。
- Row Table IntegrationはTableデータ、DnD状態、Row Reorder Session、行制約を所有しない。
- DnD開始試行では、Row Reorder Target Resolutionがその時点のTable情報から移動対象可否を判定し、そのDnDで必要な行制約情報を導出する。
- 導出した行制約情報は成立したRow Reorder Sessionが1回のDnD中だけ保持し、DnDをまたいで再利用しない。
- Row Drop Target ResolutionはRow DnD Interactionから渡された判定入力だけを利用し、Table全体の構造を再解析しない。
- 行DnDの移動対象と構造保持範囲は`tbody`内とする。
- 行並び替えでは縦結合に由来する制約を扱う。結合範囲を越える移動自体は禁止せず、縦結合を分断する移動だけを禁止する。
- DnD中はTable上の実際の行順序を変更しない。
- Tableデータを変更するのは、有効な移動先でDnDが完了した場合だけとする。
- 1回の成立した行並び替えは1回のUndoで並び替え前へ戻せる更新とする。
- 並び替えで変更するのは行の位置だけとし、セルの内容、属性、装飾その他の保持すべき情報を維持する。
- 初回案内と再案内は通常のTable編集を妨げない。
- DOM / Web APIを利用する責務は`editor-dom-context.md`のEditor DOM Contextを利用する。
- DnDを継続できない場合の復旧はRow DnD Interactionを中心とするabortへ合流し、Row Reorder SessionとDnDに属する一時状態を終了してidleへ戻す。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | 行並び替えの入力、表示、およびEditor lifecycleを提供する。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | `FR-13`で定義される対応Table Block。Row Table Integrationを介して行並び替えと接続する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。 |
| EXT_SCROLL_AREA | Editor Scroll Area | External Environment | 行DnD中に縦方向へ自動スクロールする対象領域を提供する。 |
| EXT_EDITOR_DOM_CONTEXT | Editor DOM Context | External Architecture | 現在のEditorでDOM / Web APIを利用するためのcontextを提供する。 |

行並び替えArchitectureは、WordPress Editor、対応Table Block、Undo、Scroll Area、Editor DOM Contextと接続する。列並び替えArchitectureとは接続しない。

## 4. Solution Strategy

行並び替えは、行並び替えモード、行向けTable境界、入力解釈、DnD進行、開始対象と制約情報の解決、移動先判定、表示、自動スクロール、Tableデータ更新、案内を別々の責務として扱う。

Row Table Integrationは、対応Table Blockから行並び替えに必要な現在情報だけを取得し、行制約判定に必要な情報を提供する。列制約を支えるための中間表現は持たない。

Row Reorder Target ResolutionはDnD開始試行時に`tbody`の対象行を解決し、`rowspan`に由来する開始可否とDnD中に必要な行制約情報を導出する。

Row DnD Interactionは入力方式に依存せず、開始・進行・完了・キャンセルを統括する。成立したDnDではRow Reorder Sessionが移動対象、行制約情報、現在位置などの一時状態を保持する。

Row Drop Target Resolutionは渡された判定入力だけから、`tbody`内の行間について有効な移動先を判定する。

Row Data Updateは有効な確定結果だけを対象Tableへ反映し、`tbody`の行順だけを1つの更新単位として変更する。

### Process Flow Views

#### Row Reorder End-to-End {#PV_ROW_REORDER_END_TO_END kind=normal}

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_ROW_INPUT_INTERACTION | normal | Editor入力が行並び替えの入力境界へ入る。 |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | normal | 入力差を吸収した行DnD操作が進行する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_REORDER_TARGET_RESOLUTION | normal | DnD開始試行時に移動対象可否と行制約情報を解決する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DROP_TARGET_RESOLUTION | normal | DnD進行中の移動先可否を判定する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DATA_UPDATE | normal | 有効な確定結果だけをTable更新へ進める。 |
| RESP_ROW_DATA_UPDATE | RESP_ROW_TABLE_INTEGRATION | normal | 確定した行並び替えを対応Table Blockへ反映する。 |

#### Row Reorder Failure and Recovery {#PV_ROW_REORDER_FAILURE_RECOVERY kind=failure-recovery}

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_REORDER_TARGET_RESOLUTION | RESP_ROW_DND_INTERACTION | failure | DnD開始を継続できない結果を返す。 |
| RESP_ROW_DROP_TARGET_RESOLUTION | RESP_ROW_DND_INTERACTION | failure | DnD進行を継続できない結果を返す。 |
| RESP_ROW_DATA_UPDATE | RESP_ROW_DND_INTERACTION | failure | 確定更新を完了できない結果を返す。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DND_INTERACTION | recovery | Row Reorder Sessionと一時状態を破棄してidleへ復帰する。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_ROW_REORDER_MODE | Row Reorder Mode | 通常編集と行並び替えの現在状態を管理する。 |
| RESP_ROW_TABLE_INTEGRATION | Row Table Integration | 対応Table Blockと行並び替えのTable情報・更新境界を担う。 |
| RESP_ROW_INPUT_INTERACTION | Row Input Interaction | PC / タッチ入力を行DnD操作へ変換する。 |
| RESP_ROW_REORDER_TARGET_RESOLUTION | Row Reorder Target Resolution | DnD開始対象可否と行制約情報を解決する。 |
| RESP_ROW_DROP_TARGET_RESOLUTION | Row Drop Target Resolution | 行DnD中の移動先可否を判定する。 |
| RESP_ROW_DND_INTERACTION | Row DnD Interaction | 行DnDの開始・進行・完了・キャンセルとSession lifecycleを統括する。 |
| RESP_ROW_DATA_UPDATE | Row Data Update | 確定した行並び替えを対象Tableへ反映する。 |
| RESP_ROW_REORDER_PRESENTATION | Row Reorder Presentation | 移動対象、移動先、周囲の行の表示変化、移動不可理由を扱う。 |
| RESP_ROW_AUTO_SCROLL | Row Auto Scroll | 行DnD中の縦方向Auto Scrollを扱う。 |
| RESP_ROW_FIRST_USE_GUIDANCE | Row First-use Guidance | 初回に行並び替え機能と入口を認識できるようにする。 |
| RESP_ROW_REORDER_REDISCOVERY | Row Reorder Rediscovery | 必要時に行並び替え機能を再発見できるようにする。 |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_REORDER_MODE | 行並び替えが有効な状態か確認するため。 |
| RESP_ROW_INPUT_INTERACTION | EXT_EDITOR_DOM_CONTEXT | 現在のEditorで入力に必要なDOM / Web API contextを利用するため。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_REORDER_TARGET_RESOLUTION | DnD開始対象可否と行制約情報を必要とするため。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DROP_TARGET_RESOLUTION | DnD進行中の移動先判定を必要とするため。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_REORDER_PRESENTATION | DnD状態と結果を利用者へ示すため。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DATA_UPDATE | 有効な確定結果をTableへ反映するため。 |
| RESP_ROW_REORDER_TARGET_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 要求時点のTable情報から行制約を解決するため。 |
| RESP_ROW_DATA_UPDATE | RESP_ROW_TABLE_INTEGRATION | 確定した行順変更を対応Table Blockへ反映するため。 |
| RESP_ROW_REORDER_PRESENTATION | EXT_EDITOR_DOM_CONTEXT | 現在のEditorで表示に必要なDOM / Web API contextを利用するため。 |
| RESP_ROW_AUTO_SCROLL | EXT_EDITOR_DOM_CONTEXT | 現在のEditorのスクロール領域を扱うため。 |
| RESP_ROW_AUTO_SCROLL | EXT_SCROLL_AREA | 縦方向Auto Scrollの対象領域を必要とするため。 |
| RESP_ROW_FIRST_USE_GUIDANCE | RESP_ROW_REORDER_MODE | 行並び替え入口の選択状態と通常編集状態を扱うため。 |
| RESP_ROW_REORDER_REDISCOVERY | RESP_ROW_REORDER_MODE | 通常編集状態だけで再案内判定を行うため。 |

### Responsibility Details

#### Row Reorder Mode {#RESP_ROW_REORDER_MODE}

##### Responsibility
通常編集と行並び替えの現在状態を管理する。

##### State ownership
現在が通常編集か行並び替えかという状態だけを所有する。DnD SessionやTable情報は所有しない。

##### Contract
行並び替え入口の選択と終了を受け取り、行並び替えが有効かを入力責務へ提供する。

##### Lifecycle
通常編集から開始し、行並び替え入口の選択で行並び替え状態へ移行し、終了で通常編集へ戻る。

##### Invariants
- 列方向を表す状態を所有しない。
- DnDの完了、キャンセル、abortだけを理由に暗黙に終了しない。

#### Row Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility
対応Table Block固有の構造取得・更新方法を行並び替えから隠蔽する。

##### State ownership
状態を所有しない。Tableデータや行制約情報を要求間で保持しない。

##### Contract
要求時点のTableから行並び替えに必要な現在情報を提供し、確定した行順変更を1つの更新単位として反映する。

##### Lifecycle
要求ごとに現在のTableを利用する。Table変更を監視せず、取得結果を後続要求へ持ち越さない。

##### Invariants
- 列制約のための情報を提供しない。
- 行・列共通Table structureを提供しない。
- 移動対象可否や移動先判定を所有しない。

#### Row Input Interaction {#RESP_ROW_INPUT_INTERACTION}

##### Responsibility
PCとタッチ端末の入力差を吸収し、行DnDの開始・進行・完了・キャンセルへ変換する。

##### State ownership
入力成立に必要な一時状態だけを所有する。Row Reorder Sessionを所有しない。

##### Contract
行並び替えモード中の入力を受け取り、成立した行DnD操作をRow DnD Interactionへ提供する。

##### Lifecycle
入力開始からDnDへの引き渡しまたは通常操作として終了するまで有効となる。

##### Invariants
- 列入力を解釈しない。
- DnD開始前の通常編集・通常スクロールを不必要に妨げない。

#### Row Reorder Target Resolution {#RESP_ROW_REORDER_TARGET_RESOLUTION}

##### Responsibility
DnD開始試行時に`tbody`の対象行が移動可能かを判定し、そのDnDで必要な行制約情報を導出する。

##### State ownership
状態を所有しない。

##### Contract
開始対象と要求時点のTable情報を受け取り、移動可能な行と行制約情報、または開始不可理由を返す。

##### Lifecycle
DnD開始試行ごとに実行し、結果を返した時点で終了する。

##### Invariants
- `rowspan`に由来する行制約だけを扱う。
- 列制約や`colspan`だけを理由とする開始不可を導出しない。

#### Row Drop Target Resolution {#RESP_ROW_DROP_TARGET_RESOLUTION}

##### Responsibility
行DnD中の現在位置と行制約情報から、有効な移動先を判定する。

##### State ownership
状態を所有しない。

##### Contract
Row DnD Interactionから判定入力を受け取り、`tbody`内の有効な行間または無効結果を返す。

##### Lifecycle
DnD進行中の判定要求ごとに実行する。

##### Invariants
- Table全体の構造を再解析しない。
- 列方向の移動先を扱わない。

#### Row DnD Interaction {#RESP_ROW_DND_INTERACTION}

##### Responsibility
行DnDの開始・進行・完了・キャンセルとRow Reorder SessionのLifecycleを統括する。

##### State ownership
成立したDnD中だけ、移動対象、行制約情報、現在位置、現在の移動先などの一時状態を所有する。

##### Contract
Row Input Interactionから行DnD操作を受け取り、対象解決、移動先判定、表示、確定更新へ進行させる。

##### Lifecycle
開始可能な対象でSessionを開始し、完了、キャンセル、abortでSessionを破棄してidleへ戻る。

##### Invariants
- 列方向を表すkindやunionを所有しない。
- SessionをDnD間で再利用しない。
- Failure / Recoveryは共通abort pathへ合流する。

#### Row Data Update {#RESP_ROW_DATA_UPDATE}

##### Responsibility
有効な確定結果だけを対象Tableへ反映する。

##### State ownership
状態を所有しない。

##### Contract
確定した移動元と移動先を受け取り、`tbody`の行順だけを1回の更新単位として変更する。

##### Lifecycle
有効なDnD完了時だけ動作する。

##### Invariants
- キャンセル・無効完了では更新しない。
- セル内容・属性・装飾を保持する。
- 1回の行並び替えを1回のUndoで戻せる単位とする。

#### Row Reorder Presentation {#RESP_ROW_REORDER_PRESENTATION}

##### Responsibility
行DnDの移動対象、移動先、周囲の行の位置変化、移動不可理由を利用者へ示す。

##### State ownership
表示に必要な一時状態を所有する。Tableデータは所有しない。

##### Contract
DnD状態・対象解決結果・移動先結果を受け取り、Designで定義された行向け表示を提供する。

##### Lifecycle
DnD開始または移動不可結果で必要な表示を開始し、終了・cancel・abortに合わせて一時表示を終了する。

##### Invariants
- DnD中にTableの実際の行順を変更しない。
- 列表示を扱わない。

#### Row Auto Scroll {#RESP_ROW_AUTO_SCROLL}

##### Responsibility
行DnD中に必要な縦方向Auto Scrollを扱う。

##### State ownership
Auto Scrollに必要な一時状態だけを所有する。

##### Contract
行DnDの現在位置とscroll areaを利用し、必要な場合だけ縦方向へscrollを進行させる。

##### Lifecycle
行DnD中だけ有効となり、完了・cancel・abortで終了する。

##### Invariants
- 横方向Auto Scrollを扱わない。
- DnD終了後にscroll処理を継続しない。

#### Row First-use Guidance {#RESP_ROW_FIRST_USE_GUIDANCE}

##### Responsibility
初めて利用する人が行並び替え機能と入口を認識できるようにする。

##### State ownership
PCとタッチ端末それぞれの初回案内表示済み状態と現在の表示状態を所有する。

##### Contract
Designで定義された表示契機に基づき、未表示の操作環境で行並び替え入口を案内する。

##### Lifecycle
未表示から表示へ移行し、入口選択または案内終了で表示済みとなる。

##### Invariants
- 通常のTable編集を妨げない。
- 列並び替え案内の状態を共有しない。

#### Row Reorder Rediscovery {#RESP_ROW_REORDER_REDISCOVERY}

##### Responsibility
初回案内表示済みでも、行を移動しようとする操作が繰り返された場合に行並び替え機能を再発見できるようにする。

##### State ownership
再案内判定に必要な一時的履歴と抑制状態を所有する。

##### Contract
通常編集として成立しない行移動試行候補を受け取り、Designで定義された条件を満たす場合だけ再案内を成立させる。

##### Lifecycle
通常編集状態で候補が現れたときだけ判定状態を持ち、再案内成立または判定系列終了で破棄する。

##### Invariants
- 一度だけの短いドラッグから再案内を成立させない。
- 行並び替えモード中は再案内判定を行わない。

## 6. Runtime View

### 行DnD開始から確定まで {#RV_ROW_REORDER_COMPLETE}

| Step | Source | Target | Interaction |
| --- | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_ROW_INPUT_INTERACTION | 行並び替えモード中の入力が入る。 |
| 2 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnD開始試行を渡す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_REORDER_TARGET_RESOLUTION | 開始対象可否と行制約情報を要求する。 |
| 4 | RESP_ROW_REORDER_TARGET_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 要求時点のTable情報を取得する。 |
| 5 | RESP_ROW_REORDER_TARGET_RESOLUTION | RESP_ROW_DND_INTERACTION | 移動対象と行制約情報を返す。 |
| 6 | RESP_ROW_DND_INTERACTION | RESP_ROW_DROP_TARGET_RESOLUTION | DnD進行中の移動先を判定する。 |
| 7 | RESP_ROW_DND_INTERACTION | RESP_ROW_REORDER_PRESENTATION | 現在の移動対象・移動先を表示する。 |
| 8 | RESP_ROW_DND_INTERACTION | RESP_ROW_DATA_UPDATE | 有効な完了結果を渡す。 |
| 9 | RESP_ROW_DATA_UPDATE | RESP_ROW_TABLE_INTEGRATION | `tbody`の行順変更を反映する。 |

### 行DnD Failure / Recovery {#RV_ROW_REORDER_FAILURE_RECOVERY}

| Step | Source | Target | Interaction |
| --- | --- | --- | --- |
| 1 | RESP_ROW_DND_INTERACTION | RESP_ROW_REORDER_TARGET_RESOLUTION | DnD処理に必要な解決を要求する。 |
| 2 | RESP_ROW_REORDER_TARGET_RESOLUTION | RESP_ROW_DND_INTERACTION | 処理継続不能な結果を返す。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_DND_INTERACTION | Sessionと一時状態を破棄しidleへ復帰する。 |

## 8. Crosscutting Concepts

### Row-only ownership

行並び替えに必要な意味、型、規則、制約、Lifecycleは本Architectureだけで所有する。列並び替え側へ委譲せず、両方向を束ねる共通Reorder abstractionも設けない。

### Editor DOM Context

DOM / Web APIを利用する責務は`editor-dom-context.md`を利用し、Editor環境差を独自に判定しない。

### Failure / Recovery

内部Contract / Invariant違反と、Editor lifecycleやTable利用不能などの外部変化を区別する。DnD継続不能時はRow DnD Interactionのabort pathへ合流し、Sessionと一時状態を終了して安全なidleへ戻す。

## 9. Architecture Decisions

### 行並び替えを独立Architectureとする

行並び替えは列並び替えと独立した実装・Architectureとし、共通Reorder abstractionを導入しない。

類似した責務構成や処理が列並び替えにも存在しても、それだけを理由として共有責務へ抽出しない。

### 行向けTable情報だけを扱う

Row Table IntegrationとRow Reorder Target Resolutionは、行並び替えに必要なTable情報と`rowspan`由来の制約だけを扱う。列並び替えのための構造情報を同時に保持しない。

## 10. Quality Requirements

- `QR-01`のPerformanceを満たすため、DnD間でTable全体の大規模な中間構造を保持しない。
- `QR-02`のCompatibilityを満たすため、Editor環境差はEditor DOM Contextへ委譲し、対応Table Block差はRow Table Integrationへ閉じ込める。
- `QR-03`のReliability / Robustnessを満たすため、外部状態変化と内部Invariant違反を区別し、DnD継続不能時は安全なidleへ復帰する。

## 11. Risks and Technical Debt

- 将来Column Reorderと実装が類似して見える場合でも、共通化によって独立した変更理由が再結合されるリスクがある。Architecture decisionとして非共通化を維持する。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| Row Reorder Session | 1回の成立した行DnD中だけ保持する、移動対象・行制約・現在位置・移動先などの一時状態。 |
| 行制約情報 | `tbody`の有効な構造を維持するため、行DnD中の移動先判定に必要な情報。 |
| Row Table Integration | 対応Table Block固有の構造取得・更新方法を行並び替えから隠蔽する境界。 |
