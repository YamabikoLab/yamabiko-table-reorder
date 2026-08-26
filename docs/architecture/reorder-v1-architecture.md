# Reorder v1 アーキテクチャ設計書

## 責務一覧

| Responsibility | Summary |
| --- | --- |
| Reorder Mode | 通常の Table 編集、行並び替え、列並び替えのどの状態にあるかを管理し、並び替え操作の有効範囲を決める。 |
| First-use Guidance | PC とタッチ端末ごとの初回案内の表示状態を管理し、並び替えの入口を利用者に案内する。 |
| Reorder Rediscovery | 通常編集状態で並び替えを試みていると考えられる操作の繰り返しを判定し、必要な場合だけ並び替えの入口を再案内する。 |
| Input Interaction | PC とタッチ端末の入力固有の差を共通の DnD 進行から分離し、開始・進行・完了・キャンセルとして DnD Interaction へ渡す境界を担う。 |
| DnD Interaction | 入力方式と行・列に共通する DnD の進行を開始から完了またはキャンセルまで管理し、確定可能な操作だけを Data Update へ渡す。 |
| Drop Target Resolution | 移動対象と Table 構造から、現在の位置が有効な移動先かを判定する。 |
| Reorder Presentation | DnD 開始時から確定・キャンセルまでの移動対象と視覚フィードバックを Table データの更新から分離して扱う。 |
| Auto Scroll | DnD 中に、行では縦方向、列では横方向だけを移動のための自動スクロール対象とする。 |
| Data Update | 確定した並び替えだけを Table に反映し、保持すべきセル情報と Undo 単位を維持する。 |

## 1. 目的と対象

本書は、`docs/design/reorder-v1-design.md` を入力として、Reorder v1 を実現するための内部責務、責務間の境界、状態所有、Contract、依存関係、Lifecycle、Invariant を定義する。

対象は WordPress Core Table と Flexible Table Block の行・列 DnD とする。

Keyboard 操作、ドラッグを必要としない操作、focus、announcement、支援技術への情報提供など、基本設計書で対象外としているアクセシビリティ設計は本書でも対象外とする。

## 2. 全体アーキテクチャ

### 2.1 責務間の主要な協調

Reorder Mode は、通常の Table 編集、行並び替え、列並び替えのいずれが現在有効かを管理する。Input Interaction は、現在の並び替え状態のもとで PC とタッチ端末の入力固有の差を扱い、DnD の開始・進行・完了・キャンセルという共通の意味へ変換して DnD Interaction に渡す。

DnD Interaction は、入力方式に依存せず、Reorder Mode が示す並び替え方向に対して DnD を進行させる。行と列の違いも、移動対象と並び替え方向、および Drop Target Resolution と Data Update が扱う Table 構造の差として表現し、DnD Interaction の Lifecycle、destination 更新、commit、cancel の責務は共通とする。

DnD Interaction が開始すると、Reorder Presentation が現在の移動対象を示し、Drop Target Resolution が現在の移動先を判定する。Reorder Presentation は、移動対象、有効な移動先を示す挿入線、移動先の変化によって表示位置が変わる周囲の行・列を、Table 上の実データとは分離して表示する。Auto Scroll は、進行中の DnD の方向に応じて必要な一方向だけを自動スクロール対象とする。

DnD が有効な移動先で完了した場合だけ、DnD Interaction は確定した並び替えを Data Update に渡し、Reorder Presentation には確定結果を渡す。Data Update はその時点の確定結果だけを Table に反映し、Reorder Presentation は移動対象を最終位置へつなぐ表示を扱う。

キャンセル時は Data Update に何も渡さず、Reorder Presentation が移動対象を元の位置へ戻す表示を扱う。無効な移動先、または有効な位置で完了しなかった操作も Data Update には渡さない。

First-use Guidance は通常の Table 編集や DnD の進行とは独立して初回案内を扱う。Reorder Rediscovery は初回案内表示済みの通常編集状態で、並び替えを試みていると考えられる操作が繰り返された場合だけ再案内を成立させる。どちらも並び替えの入口そのものや Reorder Mode の状態は所有しない。

### 2.2 データと状態の流れ

1. Reorder Mode が通常、行並び替え、列並び替えの現在状態を保持する。
2. 通常編集状態では、First-use Guidance が操作環境ごとの初回案内を扱い、初回案内表示済みの場合は Reorder Rediscovery が再案内のための操作傾向を必要に応じて扱う。
3. 並び替えモード中の PC またはタッチ端末の入力を Input Interaction が受け取り、DnD の開始・進行・完了・キャンセルという共通の意味へ変換する。
4. DnD が開始されると、DnD Interaction が移動対象と進行中の操作状態を保持し、Reorder Presentation が現在の移動対象を表示する。
5. 進行中の入力は Input Interaction から DnD Interaction へ渡され、Drop Target Resolution が Table 構造と現在位置から有効な移動先、または有効な移動先なしを返す。
6. DnD Interaction が現在の移動先を操作状態として保持し、Reorder Presentation が移動対象、挿入線、表示位置が変わる周囲の行・列の表示に反映する。
7. Auto Scroll は進行中の並び替え方向だけを対象として自動スクロールを行う。
8. 有効な移動先で DnD が完了した場合だけ、DnD Interaction が確定した並び替えを Data Update に渡し、Reorder Presentation に確定結果を伝える。
9. Data Update が行または列の位置だけを変更し、1 回の並び替えを 1 回の Undo で戻せる更新として反映する。Reorder Presentation は確定後の配置へ自然につながる表示を完了する。
10. キャンセル時は Reorder Presentation が元の位置へ戻る表示を扱い、Data Update は動作しない。
11. 完了またはキャンセル後は Input Interaction と DnD に属する一時状態、および DnD 用の Presentation 状態を破棄する。

### 2.3 システム全体の状態所有

- 現在の通常、行並び替え、列並び替えの状態は Reorder Mode が所有する。
- PC とタッチ端末ごとの初回案内の表示済み状態は First-use Guidance が所有する。
- 再案内を判定するための直近の操作傾向と、同じ状況で過度に再案内しないための一時状態は Reorder Rediscovery が所有する。
- PC とタッチ端末の入力固有の解釈に必要な一時状態は Input Interaction が所有し、移動対象、移動先、確定可能性などの Reorder Session 状態は所有しない。
- 進行中の DnD、移動対象、現在の移動先、確定可能性、完了結果は DnD Interaction が所有する。
- 移動先の有効性そのものは Drop Target Resolution が判定し、永続的な Table 状態としては所有しない。
- DnD 中の移動対象、挿入線、周囲の行・列の表示変化、確定・キャンセル時の一時的な表示状態は Reorder Presentation が所有する。
- Table のデータは WordPress の対象ブロック側に存在し、YTR 内でその順序変更を行う責務は Data Update に限定する。

### 2.4 アーキテクチャ全体の Invariant

- PC とタッチ端末の入力固有の差を DnD Interaction 以降の共通処理へ持ち込まない。
- DnD Interaction の Lifecycle、destination 更新、commit、cancel の Contract は行と列で共通とする。
- DnD 中は Table 上の実際の行・列順序を変更しない。
- 有効な移動先で DnD が完了した場合だけ Table データを変更する。
- 無効な移動先では確定可能な挿入線を表示せず、並び替えを確定しない。
- 行並び替えと列並び替えを同時に有効にしない。
- Reorder Presentation の表示更新は Table データの更新責務を持たない。
- 移動先変更に伴う表示上の移動は、実際に表示位置が変わる行・列に限定し、無関係な行・列を一斉に移動させない。
- 行の DnD 中に自動スクロールする方向は縦方向だけとし、列の DnD 中は横方向だけとする。
- 並び替えで変更するのは行または列の位置だけとし、セルの内容、属性、装飾その他の保持すべき情報を維持する。
- 1 回の成立した並び替えは 1 回の Undo で並び替え前へ戻せる更新とする。
- 初回案内と再案内は通常の Table 編集を妨げない。
- WordPress Core Table と Flexible Table Block で、利用者から見た操作と結果の方針を変えない。

### 2.5 外部境界

本アーキテクチャは WordPress の編集環境、WordPress Core Table、Flexible Table Block、Undo の仕組み、および Table や編集画面のスクロール領域と接続する。

Input Interaction を WordPress 編集環境の入力と共通 Reorder 処理の境界とし、PC とタッチ端末の入力固有の差をその境界の内側で扱う。DnD Interaction 以降は入力方式に依存しない共通概念だけを扱う。

Core Table と Flexible Table Block の内部表現の違いにかかわらず、本書で定義する責務間では、行・列の移動対象、Table 構造、有効な移動先、確定した並び替えという同じ概念で扱う。

Table の実データ更新は DnD の進行および Reorder Presentation から分離し、確定した並び替えだけを外部の Table データへ反映する境界とする。

First-use Guidance と Reorder Rediscovery は、WordPress の通常編集として成立する操作を尊重し、並び替え案内のために通常編集の成立を奪わない境界とする。

### 2.6 Lifecycle と context 境界

Reorder Mode が通常状態にある間は Input Interaction から DnD Interaction への開始を成立させない。行または列の並び替えモードへ入った後に、その方向の DnD を開始できる。

Input Interaction の入力固有の一時状態は、その入力を DnD の開始・進行・完了・キャンセルとして扱うために必要な期間だけ有効とする。DnD が完了またはキャンセルされた場合、または DnD として成立しなかった場合は、次の操作へ不要な入力状態を持ち越さない。

Reorder Presentation は DnD 開始時に有効になり、移動対象、移動先、周囲の表示変化を扱う。完了またはキャンセル時の表示遷移が終わった後に DnD 用の一時状態を破棄する。

DnD に属する状態は 1 回の操作中だけ有効とする。完了またはキャンセル時に、移動対象、移動先、確定可能性、DnD 用 Presentation、自動スクロールに関する一時状態を次の DnD へ持ち越さない。

並び替えモードを切り替えた場合は、以後の DnD を切り替え後の方向として扱う。並び替えモードを終了した場合は通常の Table 編集へ戻る。

First-use Guidance の表示済み状態は DnD の Lifecycle とは分離し、利用者について PC とタッチ端末でそれぞれ一度だけ表示するという基本設計の境界を維持する。

Reorder Rediscovery の判定用状態は通常編集状態でのみ有効とし、並び替えモードへ入った場合や、同じ操作傾向として扱えない状態へ変わった場合は次の判定へ不要な履歴を持ち越さない。

### 2.7 規模と Performance に関する制約

次のいずれかを満たす Table を大規模 Table として扱う。

- 400 行以上
- 12 列以上
- 2,000 セル以上

Reorder v1 が想定する現実的な最大規模は、1,000 行、20 列、20,000 セルとする。

この規模でも、Reorder Mode、First-use Guidance、Reorder Rediscovery、Input Interaction、DnD Interaction、Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Update の責務分離を保ち、行・列の DnD を実用的に利用できることをアーキテクチャ上の制約とする。

正式 v1 の Interaction と Presentation は、Table 全体の行数・列数に比例する常駐状態や常駐 UI を並び替え成立の前提にしない。大規模 Table でも、全対象について個別の Interaction 状態を保持し続ける構造を要求しない。

DnD の進行中は、現在の移動対象、現在位置、移動先判定、実際に表示位置が変わる範囲など、その操作に必要な情報を中心に処理する。移動先が変わるたびに Table 全体を走査または再評価することを共通 Contract の前提にしない。

Drop Target Resolution に必要な状態評価と Reorder Presentation の表示更新は責務として分離し、表示更新が再び Table 全体の状態評価を要求する循環を DnD の進行経路に作らない。

DnD 中は Table 上の実際の順序を変更せず、destination と必要な Presentation 状態だけを更新する。Reorder Presentation は、ドラッグ中の移動対象、移動先、実際に表示位置が変わる行・列を中心に表示更新の対象を限定し、無関係な行・列まで一斉に表示更新や移動の対象へ含めない。

1 回の有効な DnD の確定に対して、Data Update が logical な並び替えを反映する機会は 1 回だけとする。DnD の進行中や destination の変更ごとに Table データ更新を発生させない。

これらは実装方式を固定するものではない。virtualization、pooling、event delegation その他の具体的な実現方法は implementation で選択し、本書では上記の責務境界と制約だけを Contract とする。

## 3. 責務詳細

### 3.1 Reorder Mode

#### 責務

通常の Table 編集、行並び替え、列並び替えのいずれが現在有効かを管理する。並び替えの入口から状態を切り替え、利用者が現在のモードを確認できる状態を提供する。

#### 状態所有

通常、行並び替え、列並び替えの現在状態を所有する。DnD の進行状態、移動対象、移動先、Table データは所有しない。

#### Contract

「行を並び替え」「列を並び替え」の選択と並び替えモード終了を受け取り、現在の並び替え状態を Input Interaction と DnD Interaction へ提供する。

通常状態では DnD を有効にせず、行並び替えでは行、列並び替えでは列を DnD 対象として扱える状態を提供する。

#### 依存関係

Input Interaction と DnD Interaction は現在の並び替え状態を Reorder Mode に依存する。First-use Guidance と Reorder Rediscovery は入口が選択されたことを自身の案内終了条件として扱うが、案内状態を Reorder Mode に持たせない。

#### Lifecycle

通常状態から開始する。行または列の入口が選択されると対応する並び替えモードへ移行する。別方向の入口が選択された場合は選択された側へ切り替わり、終了時は通常状態へ戻る。

#### Invariant

- 同時に有効な並び替えモードは 1 つだけとする。
- 通常状態では行・列の DnD を有効にしない。
- 行並び替えモードでは列 DnD、列並び替えモードでは行 DnD を有効にしない。

### 3.2 First-use Guidance

#### 責務

初めて利用する人が行・列を並び替えられることと、その入口を認識できるようにする。案内表示中は行・列の両方の入口を強調する。

#### 状態所有

利用者について PC とタッチ端末それぞれの初回案内表示済み状態と、現在の初回案内表示状態を所有する。Reorder Mode、Reorder Rediscovery、DnD の状態は所有しない。

#### Contract

PC では Table へのポインター進入、Table のフォーカス、またはセル編集開始を受け取り、その操作環境で未表示なら初回案内を表示する。

タッチ端末では Table のフォーカスまたはセル編集開始を受け取り、その操作環境で未表示なら初回案内を表示する。

行または列の並び替え入口が選択された場合、または案内が閉じられた場合に案内と入口の強調を終了し、その操作環境を表示済みとして扱う。PC では Table からポインターが外れたことだけを案内終了条件にしない。

#### 依存関係

Table へのポインター進入、Table のフォーカス、セル編集開始という編集環境側の状態に依存する。入口の選択は Reorder Mode への切り替えと同時に、First-use Guidance の終了条件になる。Reorder Rediscovery の再案内判定とは状態を共有しない。

#### Lifecycle

対象の操作環境で未表示の状態から、操作環境に応じた表示契機によって表示状態になる。入口選択または案内を閉じる操作で表示を終了し、その操作環境を表示済みとする。

PC では表示中に Table からポインターが外れても、それだけでは表示状態を終了しない。

#### Invariant

- PC とタッチ端末の表示済み状態を独立して扱う。
- PC とタッチ端末で定義された表示契機の違いを維持する。
- 初回案内は通常のセル編集を妨げない。
- PC ではポインター離脱だけを初回案内終了条件にしない。
- 案内終了後も並び替え入口そのものの利用可否を変更しない。

### 3.3 Reorder Rediscovery

#### 責務

初回案内表示済みの利用者が並び替え機能を忘れている可能性がある場合に、通常編集を妨げず、並び替えを試みていると判断できる操作の繰り返しから必要な再案内だけを成立させる。

#### 状態所有

同じ行または列の付近で繰り返された並び替え試行候補の一時的な履歴と、同じ状況で過度に再案内しないための抑制状態を所有する。初回案内表示済み状態、Reorder Mode、DnD 状態、Table データは所有しない。

#### Contract

通常編集状態で、セル内容の編集、文字選択、通常スクロールなどとして成立しない、行または列を移動しようとする操作候補を受け取る。

同じ行または列の付近で短時間に操作候補が繰り返され、並び替えを試みていると判断できる場合だけ再案内を成立させる。一度だけの短いドラッグや通常の編集操作からは再案内を成立させない。

再案内が成立した場合は、並び替えの入口を確認できる案内を表示するための状態を提供する。同じ状況で案内を過度に繰り返さない。

#### 依存関係

通常編集として成立した操作かどうかを区別できる編集環境側の情報に依存する。First-use Guidance の初回案内が表示済みであることを前提とする。Reorder Mode が並び替えモードにある間は再案内判定を行わない。

#### Lifecycle

初回案内表示済みかつ通常編集状態で、並び替え試行候補が現れた場合に判定用の一時状態を持つ。同じ行または列の付近で継続する候補だけを同じ判定系列として扱う。

再案内成立、通常編集として成立する操作への移行、並び替えモードへの移行、または同じ判定系列として扱えない状態への変化に応じて、不要な判定用状態を破棄する。

#### Invariant

- 一度だけの短いドラッグから再案内を成立させない。
- セル内容の編集、文字選択、通常スクロールとして成立する操作を再案内の根拠にしない。
- 並び替えモード中は再案内判定を行わない。
- 再案内によって通常の Table 編集を妨げない。
- 同じ状況で再案内を過度に繰り返さない。

### 3.4 Input Interaction

#### 責務

PC とタッチ端末の入力固有の差を、共通の DnD Interaction から分離して扱う。並び替えモード中の入力を DnD の開始・進行・完了・キャンセルという共通の意味へ変換し、入力方式に依存しない DnD Interaction へ渡す。

#### 状態所有

入力を DnD として解釈するために必要な一時状態だけを所有する。Reorder Mode、移動対象、現在の移動先、確定可能性、Table データ、Presentation 状態は所有しない。

#### Contract

Reorder Mode から現在の並び替え方向を受け取り、WordPress 編集環境から PC またはタッチ端末の入力を受け取る。

現在の並び替えモードで DnD を開始できる操作が成立した場合は、開始対象と並び替え方向を DnD Interaction へ渡す。DnD 開始後は、進行、完了、キャンセルとして解釈した入力を DnD Interaction へ渡す。

DnD Interaction へ渡す Contract には、PC とタッチ端末ごとの入力成立方法そのものを含めない。

#### 依存関係

Reorder Mode と WordPress 編集環境の入力に依存する。DnD の共通進行は DnD Interaction に渡し、Drop Target Resolution、Reorder Presentation、Auto Scroll、Data Update には直接依存しない。

#### Lifecycle

並び替えモード中に対象となる入力を受けたときだけ、一時的な入力解釈状態を持つ。DnD が開始された場合は完了またはキャンセルまで共通の進行情報を DnD Interaction へ渡す。

DnD が完了またはキャンセルされた場合、または入力が DnD として成立しなかった場合は、次の操作へ不要な入力状態を持ち越さない。

#### Invariant

- PC とタッチ端末の入力固有の差を DnD Interaction の状態や Contract に持ち込まない。
- 移動先の有効性を判定しない。
- Table データを変更しない。
- Reorder Presentation の表示状態を所有しない。
- Table の全行・全列について個別の常駐 Interaction 状態を持つことを前提にしない。

### 3.5 DnD Interaction

#### 責務

Input Interaction から受け取る DnD を、入力方式および行・列に共通する 1 つの並び替え操作として、開始から完了またはキャンセルまで管理する。移動対象、現在の移動先、確定可能性、完了結果を保持し、有効な移動先で完了した場合だけ確定した並び替えを Data Update へ渡す。

#### 状態所有

DnD が進行中かどうか、行または列のどちらを扱っているか、移動対象、現在の有効な移動先、確定可能性、完了結果を所有する。入力方式固有の一時状態、Table データ自体、視覚表示状態は所有しない。

#### Contract

Input Interaction から DnD の開始・進行・完了・キャンセルを受け取る。Reorder Mode から現在の並び替え方向を受け取り、その方向で DnD を開始できる対象に対して共通の Reorder Session を開始する。

進行中は現在位置に応じた移動先判定を Drop Target Resolution に求め、その結果を操作状態として保持する。Reorder Presentation と Auto Scroll が必要とする進行状態を提供する。

完了時に有効な移動先がある場合だけ、移動対象と移動先を含む確定した並び替えを Data Update に渡し、Reorder Presentation に確定結果を提供する。

キャンセル時は Data Update に何も渡さず、Reorder Presentation にキャンセル結果を提供する。無効な完了では確定した並び替えを生成しない。

#### 依存関係

Input Interaction から入力方式に依存しない DnD の進行を受け取る。Reorder Mode に依存して並び替え方向を決める。対象 Table の構造に依存して DnD を開始できる対象を扱う。Drop Target Resolution に依存して有効な移動先を決める。Reorder Presentation と Auto Scroll は DnD Interaction の進行状態に依存する。Data Update とは確定した並び替えだけを通じて接続する。

#### Lifecycle

並び替えモード中に Input Interaction から DnD の開始を受け取ると active になる。完了またはキャンセルまで active を維持し、その間だけ移動対象と移動先を保持する。

完了またはキャンセル時に結果を確定し、Data Update と Reorder Presentation に必要な結果を渡した後、次の DnD へ前回の操作状態を持ち越さない。

#### Invariant

- 通常の Table 編集状態から DnD を開始しない。
- 現在の並び替え方向で DnD を開始できない対象から操作を開始しない。
- 入力方式固有の状態を所有しない。
- 行と列で Lifecycle、destination 更新、commit、cancel の Contract を分岐させない。
- DnD 中に Table データを変更しない。
- 有効な移動先なしに確定した並び替えを生成しない。
- キャンセル時は Data Update へ更新要求を渡さない。
- 完了またはキャンセル後に前回の移動対象や移動先を次の DnD へ保持しない。
- Data Update へ渡す時点で並び替えは確定済みである。

### 3.6 Drop Target Resolution

#### 責務

進行中の行または列 DnD に対して、現在位置が Table 構造を保てる有効な移動先かを判定する。結合セルなどにより構造が成立しなくなる位置は有効な移動先として返さない。

#### 状態所有

永続的な DnD 状態や Table データを所有しない。現在の判定に必要な移動対象、並び替え方向、Table 構造、現在位置を入力として扱う。

#### Contract

DnD Interaction から現在の移動対象、行または列の方向、現在位置に対応する判定要求を受け取る。

Table 構造を保てる場合は有効な行間または列間を返し、成立しない場合は有効な移動先なしを返す。

#### 依存関係

対象 Table の構造情報に依存する。DnD Interaction は判定結果に依存する。Reorder Presentation と Data Update に直接 Table 変更を要求しない。

#### Lifecycle

DnD Interaction が active の間に必要に応じて判定を行う。DnD の完了またはキャンセル後に判定結果を独立した状態として保持しない。

#### Invariant

- Table 構造が成立しなくなる位置を有効な移動先として返さない。
- 行 DnD では行間、列 DnD では列間を移動先として扱う。
- 移動先判定によって Table データを変更しない。

### 3.7 Reorder Presentation

#### 責務

DnD 開始時に現在の移動対象を示し、DnD 中は現在の有効な移動先、移動先変更に伴って表示位置が変わる周囲の行・列を、Table 上の実際の順番を変更せずに表示する。

確定時は移動対象を最終位置へ自然につなぎ、キャンセル時は元の位置へ戻す表示を扱う。

#### 状態所有

進行中の DnD に対応する移動対象の表示状態、挿入線、表示位置が変わる周囲の行・列の一時的な表示状態、確定・キャンセル時の表示遷移状態を所有する。

Table データ、移動先の有効性、DnD の確定判断は所有しない。

#### Contract

DnD Interaction から DnD の開始と移動対象を受け取り、開始された移動対象を線で囲んで示す。この方針は PC とタッチ端末で共通とする。

DnD Interaction から現在の有効な移動先を受け取り、行では水平、列では垂直の挿入線として移動先を表現する。有効な移動先が変われば挿入線も追従する。

移動先が変わった場合は、移動対象が入る空間を空けるために実際に表示位置が変わる周囲の行・列だけを表示上移動させる。

ドラッグ中の移動対象は元の Table 上での大きさとセルの配置関係を保つ。行では Table の横方向、列では Table の縦方向から不必要にはみ出さない表示範囲を保ち、その制約によって Auto Scroll を妨げない。

DnD Interaction から確定結果を受け取った場合は移動対象を最終位置へ自然につなぐ。キャンセル結果を受け取った場合は移動対象を元の位置へ戻す。

#### 依存関係

DnD Interaction が提供する進行状態に依存する。移動先の有効性は Drop Target Resolution の結果を DnD Interaction 経由で受け取る。

Auto Scroll とは互いの責務を侵食せず、移動対象の表示範囲制約によって必要な自動スクロールを妨げない。Data Update には Table 変更を要求しない。

#### Lifecycle

DnD 開始時に DnD 用の表示状態を有効にし、進行中は移動対象、挿入線、必要な周囲の表示変化を更新する。

確定時またはキャンセル時は対応する表示遷移を完了させた後、DnD 用の一時状態を破棄する。

#### Invariant

- Presentation の更新によって Table 上の実際の行・列順序を変更しない。
- DnD 開始時に現在の移動対象だけを線で囲んで示す。
- PC とタッチ端末で移動対象表示の方針を変えない。
- 行の移動先は水平の挿入線、列の移動先は垂直の挿入線で示す。
- 無効な移動先に確定可能な挿入線を表示しない。
- 移動先変更時に表示上移動させるのは、実際に表示位置が変わる行・列だけとする。
- 移動先変更に合わせて無関係な行・列を一斉に移動させない。
- ドラッグ中の行は空セルを含んでも行全体の横幅や各セル幅を保つ。
- ドラッグ中の列は空セルを含んでも列全体の幅や各セル高さを保つ。
- ドラッグ中の行は Table の横方向、列は Table の縦方向から不必要にはみ出さない。
- 表示範囲の制約によって必要な Auto Scroll を妨げない。
- 確定時とキャンセル時の表示遷移によって Table データ更新の責務を持たない。

### 3.8 Auto Scroll

#### 責務

Table が画面内に収まらない場合でも、進行中の DnD の移動方向に沿って並び替えを継続できるようにする。

#### 状態所有

DnD 中に現在自動スクロールの対象となる方向を扱う。Reorder Mode、移動対象、移動先、Table データは所有しない。

#### Contract

DnD Interaction から進行中の並び替え方向を受け取る。行 DnD では縦方向、列 DnD では横方向だけを自動スクロール対象とする。

DnD を開始していない通常状態では、この方向制限を通常の Table や編集画面のスクロールへ適用しない。

#### 依存関係

DnD Interaction の active 状態と並び替え方向に依存する。スクロール可能な Table または編集画面の領域と接続する。Reorder Presentation の表示範囲制約によって必要な自動スクロールが妨げられないことを前提とする。Drop Target Resolution や Data Update の責務を持たない。

#### Lifecycle

DnD 中に必要な場合だけ有効になる。DnD の完了またはキャンセルで終了し、方向制限を通常状態へ持ち越さない。

#### Invariant

- 行 DnD 中は横方向を自動スクロールしない。
- 列 DnD 中は縦方向を自動スクロールしない。
- DnD 中だけ移動方向に応じた自動スクロール制約を適用する。

### 3.9 Data Update

#### 責務

DnD Interaction から受け取った確定済みの並び替えを Table に反映する。行または列の位置だけを変更し、セルの内容、属性、装飾その他の保持すべき情報を維持する。

#### 状態所有

確定した並び替えを Table データへ反映する責務を所有する。DnD の進行状態、Presentation、移動先判定は所有しない。Table データそのものの永続的な所有者にはならない。

#### Contract

DnD Interaction から、有効な移動先で完了した確定済みの並び替えだけを受け取る。

WordPress Core Table または Flexible Table Block の対象データに対し、移動した行または列の位置を変更する。セル内容の種類に依存せず、内容そのものは変更しない。

1 回の確定した並び替えを 1 回だけ Table データへ反映し、1 回の Undo で並び替え前へ戻せる更新とする。

#### 依存関係

DnD Interaction からの確定済みの並び替えにだけ依存する。WordPress Core Table または Flexible Table Block の Table データと Undo の仕組みに接続する。Reorder Presentation や Auto Scroll から直接更新要求を受け取らない。

#### Lifecycle

確定済みの並び替えを受け取ったときだけ動作する。更新を反映した後に DnD の一時状態を保持しない。キャンセルや無効な DnD では動作しない。

#### Invariant

- 確定していない DnD から Table データを変更しない。
- 1 回の確定した並び替えを複数回 Table データへ反映しない。
- 変更するのは行または列の位置だけとする。
- セルの内容、属性、装飾その他の保持すべき情報を維持する。
- テキスト、画像、RichText その他のセル内容の種類によって並び替えの扱いを変えない。
- 1 回の成立した並び替えを 1 回の Undo で戻せる状態を維持する。
- Core Table と Flexible Table Block で利用者から見た結果の方針を変えない。

## 関連

- `docs/design/reorder-v1-design.md`
- #481 YTR 正式 v1 の並び替え仕様を再設計する
- #490 Reorder v1 アーキテクチャ設計書を作成する
- #493 DnD の視覚フィードバックを要件定義・基本設計に反映する
