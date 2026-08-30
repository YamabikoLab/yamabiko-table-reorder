# Row Reorder v1 Architecture

## 1. Introduction and Goals

本書は、正式v1の行並び替えを実現するための内部責務、境界、状態所有、内部仕様、依存関係、Lifecycle、Invariantを定義する。

入力は`docs/design/reorder-v1-design.md`および`docs/design/row-reorder-v1-design.md`とし、利用者向け設計を行専用の責務モデルへ落とし込む。

本書はRow Reorderだけを対象とする。Column Reorderの状態、責務、内部仕様は定義せず、Row Reorderから参照しない。

通常編集、行並び替え、列並び替えのモード選択と排他状態はRow Reorderの外側にあるReorder Mode境界が所有する。Row Reorderは、行並び替えが有効であることだけを受け取り、その有効期間における行DnDの状態とLifecycleを所有する。

## 2. Architecture Constraints

- Row ReorderとColumn Reorderは独立した実装とし、両者の間に共通の並び替え抽象化を導入しない。
- Reorder Mode境界は通常編集、行並び替え、列並び替えの排他状態だけを所有し、Row ReorderへColumn Reorderの内部状態、責務、内部仕様を公開しない。
- Row Reorderは`tbody`の行だけを移動対象とし、行順以外のTable内容を変更しない。
- 行DnD中はTableデータを並べ替えず、確定した場合だけData Updateが行順を更新する。
- 行方向の自動スクロールは縦方向だけを扱い、列方向のための抽象化を持たない。
- 対応Table BlockやEditor環境の差は、Row Reorderの利用者向け挙動へ漏らさず、それぞれを所有する境界で吸収する。
- 正常な不在、外部環境変化による継続不能、内部仕様またはruntime invariant違反を区別する。
- 型で表現できる状態相関は型と状態モデルで保証し、runtime assertionへ戻さない。runtime assertionはRow Reorderが所有し、型だけでは保証できない値レベルのInvariantに限定する。
- 内部エラーはRow Reorder内部で局所的に握り潰さず、DnDのstart、progress、complete、cancelの操作境界まで伝播させる。
- 操作境界で内部エラーを捕捉した場合は、Row Reorder内の共通中止経路へ合流し、Sessionと一時状態を破棄して安全なidleへ戻す。同じエラーを複数箇所で記録しない。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | Row Reorderが動作し、入力、表示、Table編集状態が存在する編集環境。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Component | Core TableまたはFlexible Table Blockとして存在し、Row Reorderが行情報を取得・更新する対象。 |

## 4. Solution Strategy

Row Reorderは、入力方式、Table Block差、行制約、DnD状態、表示、更新を別責務として分離し、DnD Interactionを行操作のLifecycle中心とする。

Reorder Mode境界はRow Reorderを有効化する外側の境界であり、行DnDの状態を所有しない。Editor DOM Contextは、現在の編集環境に属するDOM/Web API参照を必要な時点で解決する共有境界であり、Row Reorder固有状態を所有しない。

Row ReorderのSessionは行専用であり、移動対象行、開始時に確定したTable同一性と構造上の前提、現在の移動先、DnD中の一時状態を保持する。列方向を識別する状態は持たない。

### Process Flow Views

#### Row Reorder End-to-End {#PV_ROW_REORDER_END_TO_END kind=normal}

行並び替えが有効な状態から、行DnDの開始、進行、確定またはキャンセルまでの主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_REORDER_MODE | RESP_ROW_INPUT_INTERACTION | normal | 行並び替えが有効である状態が行入力境界へ適用される。 |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | normal | 行DnDの開始・進行・完了・キャンセル操作が行DnD境界へ進む。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_REORDER_TARGET_RESOLUTION | normal | DnD開始処理が移動対象行の成立判定へ進む。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DROP_TARGET_RESOLUTION | normal | DnD進行処理が現在の有効な移動先判定へ進む。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | normal | 行DnD状態が移動対象、移動先、周囲の表示へ反映される。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | normal | 行DnD進行処理が必要な縦方向スクロール判断へ進む。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DATA_UPDATE | normal | 確定した行移動だけがTableデータ更新へ進む。 |
| RESP_ROW_DATA_UPDATE | EXT_SUPPORTED_TABLE_BLOCK | normal | 確定した行順が対応Table Blockへ反映される。 |

#### Row Reorder Failure and Recovery {#PV_ROW_REORDER_FAILURE_RECOVERY kind=failure-recovery}

Row Reorder内部のエラーが操作境界へ伝播し、行専用の共通中止経路によって安全なidleへ回復する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | failure | Table Integrationで検出した内部仕様またはInvariant違反が行DnD操作境界へ伝播する。 |
| RESP_ROW_REORDER_TARGET_RESOLUTION | RESP_ROW_DND_INTERACTION | failure | 移動対象判定で検出した内部仕様またはInvariant違反が行DnD操作境界へ伝播する。 |
| RESP_ROW_DROP_TARGET_RESOLUTION | RESP_ROW_DND_INTERACTION | failure | 移動先判定で検出した内部仕様またはInvariant違反が行DnD操作境界へ伝播する。 |
| RESP_ROW_DATA_UPDATE | RESP_ROW_DND_INTERACTION | failure | 行更新で検出した内部仕様またはInvariant違反が行DnD操作境界へ伝播する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | recovery | 共通中止経路がDnD中だけの表示状態を解除する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | recovery | 共通中止経路が行DnDに伴う自動スクロール状態を終了する。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DND_INTERACTION | recovery | Sessionと行DnD一時状態を破棄し、安全なidleへ復帰する。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | 通常編集、行並び替え、列並び替えのモード選択と排他状態を所有する外側の境界。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在の基準要素と同じ編集環境に属するdocumentとwindowを解決する。 |
| RESP_ROW_INPUT_INTERACTION | Row Input Interaction | PC・タッチ入力を行DnDの操作へ変換し、入力方式固有状態を行DnD内部へ漏らさない。 |
| RESP_ROW_TABLE_INTEGRATION | Row Table Integration | 対応Table Blockから行並び替えに必要なTable同一性、現在構造、行更新境界を提供する。 |
| RESP_ROW_REORDER_TARGET_RESOLUTION | Row Reorder Target Resolution | DnD開始時に、入力位置から移動対象行を特定し、その行が移動可能か判定する。 |
| RESP_ROW_DROP_TARGET_RESOLUTION | Row Drop Target Resolution | DnD中に、現在位置から構造を保てる行間の移動先を判定する。 |
| RESP_ROW_DND_INTERACTION | Row DnD Interaction | 行DnDのSession、start・progress・complete・cancel、確定・中止・回復Lifecycleを所有する。 |
| RESP_ROW_DATA_UPDATE | Row Data Update | 確定した行移動を対応Table Blockの行順へ一度だけ反映する。 |
| RESP_ROW_PRESENTATION | Row Reorder Presentation | 行DnD中の移動対象、挿入位置、周囲の移動、移動不可理由、一時表示の状態を表現する。 |
| RESP_ROW_AUTO_SCROLL | Row Auto Scroll | 行DnD中に必要な縦方向の自動スクロールを判断・制御する。 |
| RESP_ROW_GUIDANCE | Row Guidance | 行並び替えの入口に関する初回案内をRow Reorderが所有する範囲で表現する。 |
| RESP_ROW_REDISCOVERY | Row Rediscovery | 通常編集時の反復操作から、行並び替え入口の再案内が必要な状態を管理する。 |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_ROW_INPUT_INTERACTION | RESP_REORDER_MODE | 行入力を受理できるのは行並び替えが有効な期間だけである。 |
| RESP_ROW_INPUT_INTERACTION | RESP_EDITOR_DOM_CONTEXT | 入力処理は対象要素と同じ現在のEditor DOM環境を必要とする。 |
| RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 入力を行DnDの操作へ変換するために行DnD境界を必要とする。 |
| RESP_ROW_REORDER_TARGET_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 移動対象行の成立判定には現在の行構造とTable同一性が必要である。 |
| RESP_ROW_DROP_TARGET_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 有効な行間判定には現在の行構造とTable同一性が必要である。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_REORDER_TARGET_RESOLUTION | Session開始前に移動可能な行を確定する必要がある。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DROP_TARGET_RESOLUTION | DnD進行中に現在の有効な移動先を確定する必要がある。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | Sessionが参照するTable同一性と現在構造を取得する必要がある。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | 行DnDの一時状態を利用者へ表現し、終了時に解除する必要がある。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 行DnD中に必要な縦方向スクロールを連動させる必要がある。 |
| RESP_ROW_DND_INTERACTION | RESP_ROW_DATA_UPDATE | 有効な移動先で確定した行移動だけをTableへ反映する必要がある。 |
| RESP_ROW_DATA_UPDATE | RESP_ROW_TABLE_INTEGRATION | 対応Table Block差を越えて行順を更新する境界が必要である。 |
| RESP_ROW_PRESENTATION | RESP_EDITOR_DOM_CONTEXT | 表示は現在のEditor DOM環境に属する表示境界を必要とする。 |
| RESP_ROW_AUTO_SCROLL | RESP_EDITOR_DOM_CONTEXT | 自動スクロールは現在のEditor DOM環境に属するスクロール対象を必要とする。 |
| RESP_ROW_GUIDANCE | RESP_REORDER_MODE | 案内終了や入口選択後の状態は外側のモード境界と整合する必要がある。 |
| RESP_ROW_REDISCOVERY | RESP_REORDER_MODE | 再案内は通常編集状態でのみ成立する。 |
| RESP_ROW_GUIDANCE | RESP_ROW_PRESENTATION | 初回案内をRow Reorderの表示境界へ反映する必要がある。 |
| RESP_ROW_REDISCOVERY | RESP_ROW_PRESENTATION | 再案内をRow Reorderの表示境界へ反映する必要がある。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_ROW_DND_CORE | Row DnD Core | RESP_REORDER_MODE RESP_EDITOR_DOM_CONTEXT RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_REORDER_TARGET_RESOLUTION RESP_ROW_DROP_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_DATA_UPDATE RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL EXT_SUPPORTED_TABLE_BLOCK |
| DV_ROW_GUIDANCE | Row Guidance | RESP_REORDER_MODE RESP_ROW_GUIDANCE RESP_ROW_REDISCOVERY RESP_ROW_PRESENTATION |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

通常編集、行並び替え、列並び替えのうち、その時点で有効な状態を一つだけ所有する。Row Reorderへは行並び替えが有効かどうかという境界情報だけを提供する。

##### State ownership

モード選択と排他状態を所有する。行DnD Session、移動対象、移動先、Table構造、行表示状態は所有しない。

##### Contract

行並び替えが有効な期間をRow Reorderへ提供する。Column Reorderの内部状態や内部仕様は提供しない。

##### Invariants

- 通常編集、行並び替え、列並び替えは同時に複数有効にならない。
- Row Reorderの内部状態をモード状態として保持しない。
- Row ReorderとColumn Reorderを共通DnD実装へ統合する境界にならない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在の基準要素と同じEditor表示環境に属するdocumentとwindowを解決する。

##### State ownership

解決結果を長期保持せず、Editor再生成後も有効であるという状態を所有しない。

##### Contract

現在の基準要素を受け取り、その要素から解決できる現在のdocumentとwindowを提供する。現在のwindowを解決できない場合は正常な不在として扱う。

##### Invariants

- 別のdocumentやwindowを代替値として使用しない。
- iframe / non-iframeをRow Reorder側の分岐条件として公開しない。

#### Row Input Interaction {#RESP_ROW_INPUT_INTERACTION}

##### Responsibility

PC・タッチそれぞれの入力を、Row DnD Interactionが理解する行DnD操作へ変換する。

##### State ownership

入力方式に必要な一時状態だけを所有する。Row DnD Session、移動対象、移動先、Table更新状態は所有しない。

##### Contract

行並び替えが有効な期間だけ入力を受理し、start、progress、complete、cancelの意味へ変換してRow DnD Interactionへ渡す。

##### Lifecycle

行並び替えの有効化に伴って入力を受理できる状態となり、無効化またはEditor環境の終了で入力方式固有状態を破棄する。

##### Invariants

- 列並び替え入力を処理しない。
- 入力方式の違いをRow DnD Sessionの状態モデルへ持ち込まない。

#### Row Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility

対応Table Blockの差を吸収し、行並び替えに必要なTable同一性、現在の行構造、行更新境界を提供する。

##### State ownership

DnD Sessionや入力状態を所有しない。外部TableデータをReorder独自の永続状態として複製しない。

##### Contract

現在の対応Tableについて、行制約判定と更新に必要な情報を同一Table由来の情報として提供する。対応Tableが現在存在しない、または外部環境変化によって取得できない場合は正常な不在として扱う。

##### Lifecycle

必要な操作時点で現在のTable情報を取得し、外部Table状態が継続して不変であることを前提にしない。

##### Invariants

- 行並び替えに不要な列専用構造を内部仕様として要求しない。
- Row Reorderが所有するTable同一性に矛盾する値を内部で生成しない。
- 外部Tableの消失やEditor lifecycle変化を内部Invariant違反としてassertしない。

#### Row Reorder Target Resolution {#RESP_ROW_REORDER_TARGET_RESOLUTION}

##### Responsibility

DnD開始試行時だけ、入力位置から`tbody`の移動対象行を解決し、その行が行単位で移動可能かを判定する。

##### State ownership

判定結果をSession外で保持せず、進行中DnD状態を所有しない。

##### Contract

開始位置と現在のTable情報を受け取り、移動可能な行、または開始できない正常な結果と理由を提供する。

##### Lifecycle

start操作の開始判定時にだけ使用し、Session開始後の移動先判定には使用しない。

##### Invariants

- `tbody`外の行を移動対象として成立させない。
- `rowspan`等により行単位の移動で構造を保てない行を移動対象として成立させない。
- 移動不可という正常な結果を内部エラーへ変換しない。

#### Row Drop Target Resolution {#RESP_ROW_DROP_TARGET_RESOLUTION}

##### Responsibility

行DnD中の現在位置から、`tbody`内で構造を保てる行間だけを有効な移動先として判定する。

##### State ownership

現在の移動先をSession外で所有しない。

##### Contract

行Sessionと現在の位置・Table情報を受け取り、有効な移動先または現在は確定できない正常な結果を提供する。

##### Lifecycle

Session開始後のprogress中に利用し、complete時にはSessionが保持する最終有効移動先の確定可否を支える。

##### Invariants

- `tbody`外を移動先として成立させない。
- 行移動後にTable構造を壊す位置を有効な移動先として成立させない。
- 有効な移動先がない状態を内部エラーとして扱わない。

#### Row DnD Interaction {#RESP_ROW_DND_INTERACTION}

##### Responsibility

行DnDのSessionと、start、progress、complete、cancelの操作境界を所有する。Session開始、移動先更新、確定、正常中止、外部環境変化による終了、内部エラーからの回復を一つの行専用Lifecycleとして管理する。

##### State ownership

activeな行DnD Sessionを所有する。Sessionは移動対象行、対象Table同一性、開始後に必要な行制約上の前提、現在の有効移動先、DnD一時状態を保持する。列方向やColumn Reorderの状態は保持しない。

##### Contract

startでは移動可能な行が成立した場合だけSessionを開始する。progressでは現在の移動先、表示、自動スクロールを更新する。completeでは有効な最終移動先がある場合だけData Updateへ確定を要求する。cancelまたは継続不能ではTableデータを新たに確定せず終了する。

内部責務から伝播したErrorは操作境界で捕捉し、対象操作と元のErrorを一度だけ記録した後、Row Reorder内の共通中止経路へ合流する。

##### Lifecycle

idleからstart成功時にactiveとなる。progressはactive Sessionだけを更新する。complete成功、cancel、外部環境変化による正常終了、内部エラー回復のいずれでもSessionとDnD中だけの一時状態を破棄してidleへ戻る。

Table更新がすでに成立した後で継続不能になった場合は、回復処理によって成立済み更新を自動的に巻き戻さない。

##### Invariants

- active Sessionは同時に一つだけ存在する。
- Sessionが参照する移動対象とTable同一性は同じ行DnD開始から成立した値である。
- completeは有効な移動先がある場合だけ新しい行順を確定する。
- cancel、開始拒否、外部環境変化による終了は新しい行順を確定しない。
- 操作境界で回復を所有した内部エラーをEditor全体へ再throwしない。
- 内部エラーと正常な中止を同じログ対象として扱わない。

#### Row Data Update {#RESP_ROW_DATA_UPDATE}

##### Responsibility

Row DnD Interactionが確定した行移動を、対応Table Blockの`tbody`行順へ一度だけ反映する。

##### State ownership

DnD Sessionや確定前の候補を所有しない。

##### Contract

確定済みの移動対象と移動先、および対象Tableの同一性を受け取り、セル内容・属性・装飾その他の保持対象を変えずに行順だけを更新する。

##### Lifecycle

completeで有効な確定要求が生じた場合だけ活動する。更新後のTableを独自に保持し続けない。

##### Invariants

- `tbody`の行順以外を並び替え結果として変更しない。
- 一つの確定操作を複数回適用しない。
- 対象Table同一性がRow Reorderのruntime invariantを満たさない場合は成功扱いにしない。

#### Row Reorder Presentation {#RESP_ROW_PRESENTATION}

##### Responsibility

行並び替えに必要な利用者向け一時表示を表現する。移動対象の強調、水平挿入線、周囲行の移動、移動不可理由、初回案内、再案内をRow Reorderが所有する範囲で扱う。

##### State ownership

表示に必要な一時状態だけを所有し、Tableデータと行DnD確定状態を所有しない。

##### Contract

Row DnD Interaction、Guidance、Rediscoveryから表示状態を受け取り、現在のEditor環境で利用者へ表現する。終了要求ではDnD中だけの表示をすべて解除する。

##### Lifecycle

各表示理由が成立した期間だけ有効となり、完了、キャンセル、継続不能、回復、案内終了に応じて該当する一時表示を破棄する。

##### Invariants

- 表示状態をTableデータの正本として扱わない。
- 無効な移動先を確定可能な挿入位置として表示しない。

#### Row Auto Scroll {#RESP_ROW_AUTO_SCROLL}

##### Responsibility

行DnD中に、移動継続に必要な縦方向の自動スクロールだけを判断・制御する。

##### State ownership

行DnDに必要な自動スクロール一時状態だけを所有する。

##### Contract

activeな行DnDと現在のEditor DOM環境を受け取り、必要な場合だけ縦方向へスクロールする。DnD終了時には自動スクロール状態を終了する。

##### Lifecycle

active Session中だけ活動し、complete、cancel、継続不能、内部エラー回復で終了する。

##### Invariants

- 横方向の自動スクロールを開始しない。
- Column Reorderのスクロール規則を抽象化して所有しない。

#### Row Guidance {#RESP_ROW_GUIDANCE}

##### Responsibility

行並び替え機能を初めて利用する人に対し、Row Reorderが所有する入口案内の表示状態を管理する。

##### State ownership

行入口の案内に必要な表示済み状態を所有する。通常編集 / 行 / 列の排他状態は所有しない。

##### Contract

案内条件が成立した場合にPresentationへ案内表示を要求し、入口選択または案内終了により表示済み状態へ移行する。

##### Invariants

- モード排他状態をRow Guidance自身で複製しない。
- Column Reorder内部状態を案内条件として参照しない。

#### Row Rediscovery {#RESP_ROW_REDISCOVERY}

##### Responsibility

通常編集時に行を移動しようとする操作が繰り返されたと判断できる場合に、行並び替え入口の再案内状態を管理する。

##### State ownership

再案内判定に必要な短期状態だけを所有する。

##### Contract

通常編集状態で観測した操作から再案内が必要かを判定し、必要な場合にPresentationへ再案内を要求する。

##### Lifecycle

通常編集状態でだけ判定を行い、行並び替えが有効になった場合や再案内条件が失われた場合は短期状態を破棄する。

##### Invariants

- 一度だけの短いドラッグや通常の編集操作を再案内成立として扱わない。
- Row ReorderのDnD Sessionを所有しない。

## 6. Runtime View

### Row DnD start attempt {#RV_ROW_DND_START}

行並び替えが有効な状態で、開始位置から移動可能な行を確定してSessionを開始するか、正常に開始を拒否するまでを示す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnDのstart操作と開始位置を渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在の対象Table情報を要求する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_REORDER_TARGET_RESOLUTION | 開始位置から移動対象行の解決と移動可否判定を要求する。 |
| 4 | RESP_ROW_REORDER_TARGET_RESOLUTION | RESP_ROW_DND_INTERACTION | 移動可能な行、または開始できない正常な理由を通知する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | Session開始時は移動対象行のDnD表示を開始し、開始拒否時は必要な理由表示を要求する。 |

### Row DnD progress {#RV_ROW_DND_PROGRESS}

activeな行Session中に、現在位置から有効な移動先と必要な表示・自動スクロールを更新する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnDのprogress操作と現在位置を渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在も利用可能な対象Table情報を要求する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_DROP_TARGET_RESOLUTION | 現在位置に対応する有効な行間の判定を要求する。 |
| 4 | RESP_ROW_DROP_TARGET_RESOLUTION | RESP_ROW_DND_INTERACTION | 有効な移動先、または現在は確定できない正常な結果を通知する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | 現在の移動先と周囲行の一時表示を更新する。 |
| 6 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 現在位置に応じた縦方向自動スクロールの更新を要求する。 |

### Row DnD complete {#RV_ROW_DND_COMPLETE}

有効な最終移動先がある場合だけ行順を確定し、その後SessionとDnD中だけの一時状態を終了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_INPUT_INTERACTION | RESP_ROW_DND_INTERACTION | 行DnDのcomplete操作を渡す。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_DATA_UPDATE | 有効な最終移動先がある場合だけ確定済み行移動の反映を要求する。 |
| 3 | RESP_ROW_DATA_UPDATE | EXT_SUPPORTED_TABLE_BLOCK | `tbody`の行順だけを確定結果として更新する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を終了する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 行DnDの自動スクロール状態を終了する。 |

### Row DnD external change abort {#RV_ROW_DND_EXTERNAL_ABORT}

EditorやTableの外部状態変化によって継続できなくなった場合に、内部エラーとして扱わず、安全に行DnDを終了する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_DND_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在の対象Table情報を要求する。 |
| 2 | RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | 対象Tableが現在利用できないという正常な不在を通知する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を解除する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 自動スクロール状態を終了する。 |

### Row DnD failure and recovery {#RV_ROW_DND_FAILURE_RECOVERY}

Row Reorder内部のErrorがstart、progress、complete、cancelの操作境界へ伝播した場合に、記録を一度だけ行い、同じ行専用中止経路でidleへ復帰する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_TABLE_INTEGRATION | RESP_ROW_DND_INTERACTION | 内部仕様またはruntime invariant違反のErrorを操作境界へ伝播する。 |
| 2 | RESP_ROW_DND_INTERACTION | RESP_ROW_DND_INTERACTION | 操作境界が対象操作と元のErrorを一度だけ記録し、共通中止経路へ合流する。 |
| 3 | RESP_ROW_DND_INTERACTION | RESP_ROW_PRESENTATION | DnD中だけの表示を解除する。 |
| 4 | RESP_ROW_DND_INTERACTION | RESP_ROW_AUTO_SCROLL | 自動スクロール状態を終了する。 |
| 5 | RESP_ROW_DND_INTERACTION | RESP_ROW_DND_INTERACTION | Sessionと行DnD一時状態を破棄し、安全なidleへ戻る。 |

## 8. Crosscutting Concepts

### 行専用状態境界

Row Reorder内部で扱う移動対象、移動先、Session、更新要求はすべて行として確定した意味を持つ。方向未確定のunionやRow / Column共通SessionをRow Reorder内部へ導入しない。

### 正常な不在と内部エラー

Editor DOM Contextを解決できない、対象Tableが外部状態変化で存在しない、移動可能な行がない、有効な移動先がない、といった状態は成立し得る正常な結果として表現する。

一方、Row Reorderが所有するTable同一性の矛盾や、内部仕様上成立しないSession状態など、型だけでは防げないRow Reorder所有のInvariant違反はErrorとして扱う。

内部責務はErrorを`null`、silent return、fallback値へ変換しない。Errorは行DnD操作境界へ伝播させ、回復責務を一箇所へ集約する。

### 安全な終了

正常キャンセル、外部環境変化による継続不能、内部エラー回復はいずれも、Row Reorder内の同じ中止処理原則に従ってSessionとDnD中だけの一時状態を破棄し、利用者が現在のTable状態から編集を継続できるidleへ戻す。

ただし内部エラーだけがエラー記録の対象であり、正常な中止を内部エラーとして記録しない。

### Compatibility

Core TableとFlexible Table Blockの表現差はRow Table Integrationが吸収する。Editorのiframe / non-iframe差は、現在の基準要素から解決するEditor DOM Contextを通して扱い、Row Reorder本体がEditor方式を判定して分岐しない。

### Performance

想定最大1,000行、20列、20,000セルのTableでも操作応答性を損なわないことを前提とする。

- DnD中にTableデータの行順を更新しない。
- 移動先変更時の表示更新は、実際に表示位置が変わる行を中心に扱う。
- 行構造情報は責務上必要な時点で取得し、EditorやTableの外部状態を永続的に監視する責務を追加しない。
- 大規模Tableを理由にRow / Column共通キャッシュや共通制約抽象化を導入しない。

## 9. Architecture Decisions

### AD-01 Row ReorderをColumn Reorderから独立させる

行と列では対象範囲、制約、移動先、更新、表示、自動スクロールの意味と変更理由が異なるため、実装類似性を理由とした共通並び替え抽象化を採用しない。

### AD-02 Reorder Modeを外側の排他境界として維持する

通常編集 / 行 / 列の排他状態は方向をまたいで一つである必要があるため、Reorder Modeが所有する。ただしRow Reorderへは行が有効であることだけを渡し、Row / Columnの内部実装を接続する共通Reorder責務にはしない。

### AD-03 Row DnD Interactionを回復境界とする

行DnD SessionのLifecycleを所有する責務が、start、progress、complete、cancelの操作境界で内部エラーを捕捉し、共通中止経路、エラー記録、idle復帰を所有する。これにより各内部責務に独自のcatch、log、recoveryを分散させない。

### AD-04 外部環境変化を内部Invariant違反として扱わない

Editor lifecycle、DOM availability、Table Block availability、外部TableデータはReorderの所有外で正当に変化し得るため、正常な不在または継続不能として扱う。runtime assertionはRow Reorderが所有する値レベルのInvariantに限定する。

## 10. Quality Requirements

- **Performance**: 想定最大1,000行、20列、20,000セルまで、行DnD中の視覚フィードバックと操作応答性を維持する責務分離とLifecycleを採用する。
- **Compatibility**: WordPress 6.8以上のBlock Editorにおけるiframe / non-iframe差と、Core Table / Flexible Table Block差を、利用者向け行並び替えの正しさへ漏らさない。
- **Reliability / Robustness**: 外部環境変化またはRow Reorder内部エラーが発生しても、TableやEditorを不正な状態にせず、行DnD一時状態を破棄して安全なidleへ戻り、その後の編集を継続できる。

## 11. Risks and Technical Debt

- Column ReorderのArchitectureが後から作成された際、責務名や処理形状が似ていても、それだけを理由にRow Reorderとの共通実装へ統合しないよう継続して確認する必要がある。
- Performance最適化で状態やキャッシュを追加する場合も、外部Table状態の監視やRow / Column共通制約キャッシュへ責務を拡張しないよう、所有境界を再確認する必要がある。

## 12. Glossary

- **Reorder Mode境界**: 通常編集、行並び替え、列並び替えの排他状態を所有し、各方向へ有効状態だけを渡す外側の境界。
- **Row Reorder**: `tbody`の行並び替えだけを所有する独立した責務群。
- **Row DnD Session**: 一回の行DnDに必要な移動対象、対象Table同一性、現在の移動先、一時状態を保持する行専用状態。
- **正常な不在**: 外部環境変化や利用者操作上、正当に発生し得る「現在利用できない」「対象が成立しない」という結果。
- **runtime invariant**: 型だけでは保証できず、かつRow Reorder自身が所有する値レベルの成立条件。
- **共通中止経路**: Row Reorder内のstart、progress、complete、cancelの各操作境界が合流し、Sessionと一時状態を破棄してsafe idleへ戻す行専用の回復経路。Row / Column間の共通実装を意味しない。
