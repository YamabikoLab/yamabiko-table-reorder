# PLAN-736: Row Reorder DnD Interaction / Session Lifecycle implementation

## References

- Plan issue: [#736 DnD InteractionとSession Lifecycleを実装するための実装プラン作成](https://github.com/YamabikoLab/yamabiko-table-reorder/issues/736)
- Implementation issue: [#690 Phase 6: DnD Interaction and Session Lifecycle](https://github.com/YamabikoLab/yamabiko-table-reorder/issues/690)
- Interface issues:
  - [#731 Input Interaction向けIFを確定する](https://github.com/YamabikoLab/yamabiko-table-reorder/issues/731)
  - [#732 Reorder Presentation向けIFを確定する](https://github.com/YamabikoLab/yamabiko-table-reorder/issues/732)
  - [#733 Auto Scroll向けIFを確定する](https://github.com/YamabikoLab/yamabiko-table-reorder/issues/733)
- Requirements:
  - `docs/requirements/reorder-v1-requirements.md`
  - `docs/requirements/reorder-v1-quality-requirements.md`
- Design:
  - `docs/design/reorder-v1-design.md`
  - `docs/design/row-reorder-v1-design.md`
- Architecture: `docs/architecture/row-reorder-v1-architecture.md`
- Parent plan: `docs/plans/row-reorder-v1-plan.md`
- Repository and plan guidelines:
  - `AGENTS.md`
  - `docs/plans/AGENTS.md`
- Architecture guidelines: `docs/architecture/AGENTS.md`
- Source guidelines:
  - `src/AGENTS.md`
  - `src/reorder/AGENTS.md`
- Validation and test guidelines:
  - `docs/development/testing.md`
  - `docs/development/jest-test-guidelines.md`

## Goal

現在のformal v1実装を前提に、Issue #690と#731〜#733で確定したDnD Interaction側の実装を、Architecture前提の先行整合、既存境界の拡張、Zustand stateと公開Facade、operation / Session Lifecycle、テストへ分解し、実装者が順に着手できる状態にする。

## Scope

### Included

- DnD Interactionが所有する`start` / `progress` / `complete` / `cancel`とRow DnD Session
- DnD Interaction内の移動対象判定、移動先判定、complete時の現在構造への再照合
- `tableIdentity`から現在のTable基準要素とEditor DOM Contextへ到達する既存境界の拡張
- DnD終了結果をReorder Modeへ渡す既存境界の拡張
- Input Interaction、Reorder Presentation、Auto Scrollへ公開するDnD Interaction側の最小state / actions
- Presentation / Auto Scrollからのfailure ingressとDnD Interactionの共通中止経路
- 既存Table Integrationの行更新境界への直接接続と、関連JSDocの追従
- 上記を検証するfocused Jest test

### Not included

- Requirements / Designの変更
- このPlan内でのArchitecture決定またはArchitecture文書の代替
- Reorder Target Resolution、Drop Target Resolution、Data Updateの独立責務または独立module
- PC / Touch Input Interaction本体
- Reorder Presentation component、DOM表示、overlay、挿入線描画、文言、表示時間
- Auto Scroll本体、scroll処理、`requestAnimationFrame` loop、開始距離、速度、加速制御
- Row / Column共通Store、共通Session、共通座標resolver
- 新しい依存関係、生成物、E2E test

## Approach

まず、現在のArchitectureだけではSourceの接続方法を一意に決められない境界を別Issueで更新し、対応DSLの生成・検証とレビューを完了する。その後、既存のEditor DOM ContextとReorder Modeを最小限拡張し、DnD InteractionがWordPress Storeやglobal DOMを探索せずに現在のTableへ到達できる状態を作る。

DnD Interactionは`src/reorder/row-reorder/dnd-interaction.ts`に行専用のZustand vanilla storeを一つ置き、Sessionと通知状態の正本にする。Storeの内部state / actionsと、Input / Presentation / Auto Scroll向けの公開state / actionsを分け、各利用側には必要なprojection、読取・購読、操作だけをFacadeとして公開する。Store、Zustandの`getState()` / `setState()`、Session全体は公開しない。

実装は、現在DOMと終了境界、stateと`start` / `progress`、`complete` / `cancel` / recoveryの順に進める。移動対象と移動先の判定はDnD Interaction内のmodule-private関数として置き、別責務へ分割しない。Table Integrationは`start`と`complete`でだけ参照し、`progress`と`refreshDestination`はSession開始時の構造snapshotと要求時点のDOMだけを使用する。

## Architecture impact

Source実装の前に、`docs/architecture/row-reorder-v1-architecture.md`へStep 0の境界を反映する必要がある。Architecture更新はこのPlanとは別の承認可能な変更単位とし、`docs/architecture/AGENTS.md`に従って対応する`docs/architecture/row-reorder-v1-architecture.dsl`を再生成・検証する。更新が承認されるまではStep 1以降のSource実装を開始しない。

## Implementation steps

### Step 0: Architecture前提の先行整合

- Outcome:
  - DnD Interactionを既存Sourceへ接続するために不足している責務間境界がArchitectureで確定し、Source実装の入力として利用できる。
- Target files:
  - `docs/architecture/row-reorder-v1-architecture.md`
  - `docs/architecture/row-reorder-v1-architecture.dsl`
- Tasks:
  - DnD Interactionが`tableIdentity`から要求時点のTable基準要素とEditor DOM Contextを取得する依存関係をArchitectureで確定する。
  - Editor lifecycleに追従するTable基準要素の登録・解除境界と、DOM参照をSessionへ保持しない制約をArchitectureで確定する。
  - active Sessionの終了をInput Interactionへ通知し、入力方式固有の一時状態を破棄させる最小境界をArchitectureで確定する。
  - DnD終了後に評価した`canContinue`をReorder Modeへ渡す境界をArchitectureで確定する。
  - Reorder PresentationとAuto Scrollが同じ`reportFailure(error)`を利用しながら、DnD Interactionのfailure ingressでは呼び出し元を識別し、一つの回復境界で一度だけ記録する接続をArchitectureで確定する。
  - 更新後のArchitecture MarkdownからDSLを再生成し、生成・validation結果を同じ変更単位でレビューする。
- Validation:
  - Architecture Markdownの機械可読構造、責務、依存関係、Runtime View、DSLが整合することをArchitecture向けcheckで確認する。
  - 具体的なコマンドは`docs/development/testing.md`のArchitecture Markdown向け手順に従う。
- Completion criteria:
  - 上記5つの境界がPlanではなくArchitectureに記録され、対応DSLが再生成・検証済みである。
  - Architecture変更がレビューで承認され、Step 1以降が参照できる。

### Step 1: 現在のTable DOMとReorder Mode終了境界

- Outcome:
  - DnD Interactionが`tableIdentity`だけから現在のTable基準要素と同じbrowsing contextを取得でき、終了時の継続結果をReorder Modeへ渡せる。
- Target files:
  - `src/reorder/editor-dom-context.ts`
  - `src/reorder/editor-dom-context.test.ts`
  - `src/reorder/wordpress/components/block-list-block.tsx`
  - `src/reorder/wordpress/integration.test.tsx`
  - `src/reorder/wordpress/integration-state-transitions.test.tsx`
  - `src/reorder/reorder-mode.ts`
  - `src/reorder/reorder-mode.test.ts`
- Changes:
  - Editor DOM Contextへ、`tableIdentity`とTable wrapperの現在の基準要素を関連付ける登録・解除境界を追加する。登録ごとに識別可能なtokenまたは同等の登録単位を持たせ、新しいmountが正本になった後に古いcleanupが実行されても新しい登録を解除しない。
  - `ReorderModeBlockListBlock`の既存wrapperへcallback refを合成し、対応する`clientId`を`tableIdentity`として基準要素を登録する。Gutenbergから渡された既存のcallback refまたはobject refへの代入を維持し、新しいDOM階層は追加しない。
  - refの要素変更、unmount、remountで登録を更新・解除する。wrapperが再生成された場合は古いDOM参照を再利用しない。
  - Editor DOM Contextの読取境界は、指定した`tableIdentity`の最新登録が存在し、基準要素が接続中で、`ownerDocument.defaultView`を取得できる場合だけ、基準要素、`ownerDocument`、`defaultView`を同じcontextとして返す。
  - 登録不在、切断済み要素、`defaultView`不在では`null`を返す。過去の登録、global `document` / `window`、別iframeをfallbackとして使用しない。
  - Row Reorder向けReorder Mode境界へ`finishDnd(tableIdentity, canContinue)`を追加する。`canContinue === false`かつ同じTableの`row` modeである場合だけ`edit`へ戻し、`true`、`edit`、`column`、別Tableのmodeには影響させない。
- Tests:
  - `editor-dom-context.test.ts`でnon-iframeとiframeの`ownerDocument` / `defaultView`、登録不在、切断済み要素、再登録、stale cleanupを確認する。
  - React integration testで既存wrapper refが維持されること、mount / unmount / remountがEditor DOM Contextの登録へ反映されること、新しい登録が古いcleanupから保護されることを確認する。
  - `reorder-mode.test.ts`で`finishDnd`の同一Table / 別Table、`row` / `column` / `edit`、`canContinue`の組合せを確認する。
- Completion criteria:
  - DnD側がWordPress StoreやWordPress固有DOM探索へ依存せず、指定したTableの現在の基準要素、document、windowを取得できる。
  - iframe / non-iframe、remount、stale cleanup、基準要素不在が公開境界から検証されている。
  - DnD終了結果が他のTableまたはColumn Reorderのmodeを変更しない。

### Step 2: Zustand state、公開境界、start / progress

- Outcome:
  - DnD Interactionのstate ownershipと利用側別Facadeが成立し、現在のTable DOMと開始時構造snapshotを用いてSessionを開始・進行できる。
- Target files:
  - 新規`src/reorder/row-reorder/dnd-interaction.ts`
  - 新規`src/reorder/row-reorder/dnd-interaction.test.ts`
- Types and boundaries:
  - `Point`を`clientX` / `clientY`に対応する`x` / `y`の座標として定義する。
  - 内部`RowDndSession`に`tableIdentity`、`sourceRowIndex`、`destinationBoundaryIndex`、`currentPoint`、`structureAtStart`を持たせる。DOM要素、DOM計測値、Reorder Mode全体の状態は持たせない。
  - `RowDndPresentationNotice`を、単調増加する`id`を持つ`start-unavailable / merged-cells`、`terminated`、`null`として定義する。
  - 内部`RowDndState`と内部`RowDndActions`を別型で定義してからZustand store型へ合成する。Sessionと`presentationNotice`をStoreの正本とし、active状態と利用側projectionはそこから導出する。
  - `RowDndInput`に`start(tableIdentity, point): boolean`、`progress(point): void`、`complete(point): void`、`cancel(): void`を定義する。加えてInput cleanup用の`RowDndInputState`は`active: boolean`だけを持ち、その読取・購読境界を公開する。
  - `RowDndPresentationState`は、Sessionから`tableIdentity`、`sourceRowIndex`、`destinationBoundaryIndex`、`currentPoint`だけを投影したactive stateと`presentationNotice`を表す。`structureAtStart`は含めない。
  - `RowDndPresentationActions`に`dismissPresentationNotice(id)`と`reportFailure(error)`を定義する。
  - `RowDndAutoScrollState`はactive時の`tableIdentity`と`currentPoint`だけ、idle時は`null`とする。
  - `RowDndAutoScrollActions`に`refreshDestination()`と`reportFailure(error)`を定義する。
  - Input、Presentation、Auto Scrollの各Facadeは、用途別stateのsnapshot読取・購読と必要なactionsだけを公開する。Zustand store、Zustandの`getState()` / `setState()`、内部action、`RowDndSession`全体はexportしない。
- DOM resolution:
  - Step 1のEditor DOM Contextから指定Tableの現在のwrapperを取得し、そのwrapper内にある現在の`table`と対応する`tbody`を解決する。wrapper外や入れ子Tableの行を対象Tableの行として採用しない。
  - start座標では、同じcontextの`document.elementFromPoint(point.x, point.y)`から`closest('tr')`を求め、その行の親が対象`tbody`である場合だけ、`tbody`の直接の行集合に対する0-based `sourceRowIndex`へ変換する。
  - 移動先は、対象`tbody`の現在の直接の行集合から各`getBoundingClientRect()`を取得し、`point.y`を各行の中央と比較する。行中央より上ではその行の直前境界、すべての行中央より下では末尾境界を候補にする。
  - Pointが対象`tbody`外、DOM行数または候補境界が`structureAtStart.rowCount`の範囲外、候補が`blockedBoundaries`内、候補が`sourceRowIndex`または`sourceRowIndex + 1`のno-op境界である場合は`destinationBoundaryIndex`を`null`にする。
  - 移動対象行が結合範囲内かは、`sourceRowIndex`の直前または直後の境界が`blockedBoundaries`に含まれるかで判定し、行単位で移動できない行をSessionへ入れない。
- `start` lifecycle:
  - `rowReorderMode.isActive(tableIdentity)`、Step 1の現在DOM、`rowTableIntegration.getStructure(tableIdentity)`、開始座標から解決した`sourceRowIndex`を順に照合する。
  - row modeでない、現在DOMがない、Table Integrationが現在構造を提供できない、対象`tbody`の直接行でない、DOM行数と構造の`rowCount`が一致しない場合は、正常な開始不可としてSessionを作らず`false`を返す。
  - 移動対象が結合範囲内の場合はSessionを作らず、次の単調増加IDを持つ`start-unavailable / merged-cells` noticeを設定して`false`を返す。
  - 移動可能な場合だけ、`blockedBoundaries`を新しい配列へコピーした`structureAtStart`、開始時の`currentPoint`、`destinationBoundaryIndex: null`を持つSessionを作り、`true`を返す。Table Integrationから受け取った配列を参照共有しない。
- `progress` and refresh lifecycle:
  - `progress(point)`はactive Sessionがなければ正常なno-opとする。active時は`currentPoint`を更新し、要求時点のDOM矩形と`structureAtStart`から移動先を再計算する。
  - `progress`では`rowTableIntegration.getStructure()`を呼ばず、外部Table構造をSessionへ上書きしない。
  - `refreshDestination()`はactive Sessionの`currentPoint`を変更せず、scroll後の現在DOMから同じ移動先判定を再実行する。Session終了後に遅延して呼ばれた場合は正常なno-opとする。
  - active中に現在DOMを利用できなくなった場合は、Step 3の外部環境変化による共通終了へ合流できる呼出構造にする。
- Tests:
  - Jestのmodule isolationとWordPress境界mockを用い、公開Facadeだけから初期idle、start成功・拒否、Session投影、通知、active stateを観測する。
  - 行矩形と`elementFromPoint()`を明示的にmockし、先頭・中間・末尾境界、`tbody`外、別Table / 入れ子Tableの行、範囲外、blocked境界、移動元直前・直後のno-op境界を確認する。
  - `structureAtStart`がコピーされ、`progress`でTable Integrationを再読取せず、開始後にmockの外部構造を変更しても開始時snapshotを利用することを確認する。
  - iframeの`ownerDocument.elementFromPoint()`が使われ、global `document`へfallbackしないことを確認する。
  - `refreshDestination()`が同じPointと変更後のDOM矩形で移動先を更新し、終了後はno-opになることを確認する。
- Completion criteria:
  - start成功・各開始不可、Session生成、snapshot、progress、blocked / no-op境界、DOM不在、refreshが公開境界の観測結果で検証されている。
  - PresentationとAuto Scrollへ、Session全体や不要な更新を公開していない。

### Step 3: complete、cancel、通知、共通failure recovery

- Outcome:
  - 成立したcompleteだけが行更新を1回要求し、すべての終了経路が利用側のactive stateを残さず安全なidleへ収束する。
- Target files:
  - `src/reorder/row-reorder/dnd-interaction.ts`
  - `src/reorder/row-reorder/dnd-interaction.test.ts`
  - `src/reorder/row-reorder/table-integration.ts`
- `complete` lifecycle:
  - `complete(point)`は直前の`progress`結果を流用せず、drop時点のPoint、要求時点のDOM、`structureAtStart`から最終`destinationBoundaryIndex`を再解決する。
  - 最終境界が開始時構造に対して`null`、blocked、範囲外、またはno-opの場合は成立しないdropとして扱う。Table Integrationを再読取・更新せず、`terminated` noticeを設定せずに終了する。
  - 最終境界が開始時構造で有効な場合だけ`rowTableIntegration.getStructure(tableIdentity)`を再実行する。現在の`rowCount`と`blockedBoundaries`に対して`sourceRowIndex`、最終境界、no-op条件を再照合し、`structureAtStart`を現在構造の代わりに使わない。
  - 現在構造でも成立する場合だけ、`rowTableIntegration.applyRowMove({ clientId: tableIdentity, sourceRowIndex, destinationBoundaryIndex })`を1回呼ぶ。
  - `table-integration.ts`の`RowMove`と`applyRowMove`に残るData Update由来のJSDocを、DnD Interactionから現在構造へ再照合済みの移動を直接受け取る説明へ変更する。実装Contractと引数は変更しない。
  - 現在DOM / 現在構造の不在、現在構造での不成立、`applyRowMove()`の`false`は外部環境変化として記録せず、安全な終了へ合流する。更新が成立した後のfailureでも成立済み更新を自動的にrollbackしない。
- `cancel`, notice, and mode lifecycle:
  - `cancel()`はactive Sessionがなければ正常なno-opとし、active時もTable Integrationを呼ばずにSessionとDnD一時状態を破棄する。
  - `dismissPresentationNotice(id)`は現在のnotice IDが一致する場合だけ`null`へ戻す。古いtimer相当の呼出しで新しいnoticeを解除しない。
  - complete成功、通常cancel、成立しないdropでは`terminated`を設定せず、`rowReorderMode.finishDnd(tableIdentity, true)`へ合流する。
  - active操作を安全に継続できず終了した場合だけ`terminated` noticeを設定する。Reorder Modeへ渡す`canContinue`はStep 0で承認されたArchitectureの判定境界に従い、終了理由そのものをReorder Modeへ公開しない。
  - すべてのactive終了経路でInput向けactive stateをinactive、Presentation向けSession projectionとAuto Scroll向けstateをidleへ変化させる。noticeはDnD active stateと分離し、dismissまで保持できる。
- Common failure recovery:
  - `start`、`progress`、`complete`、`cancel`、`refreshDestination`のoperation boundaryで捕捉した内部Errorを、module-privateの共通中止関数へ渡す。
  - PresentationとAuto Scrollの公開Facadeには同じ`reportFailure(error: Error)`シグネチャを提供する。各Facadeは内部共通中止関数へ渡す際だけ発生元を`presentation`または`auto-scroll`として付与し、利用側へ内部source引数を要求しない。
  - 共通中止関数はoperationまたはfailure ingressの発生元と元のErrorを一つの記録箇所で一度だけ記録する。throw側、Facade、個別actionでは重複記録せず、回復済みErrorをWordPress Editor全体へ再throwしない。
  - 共通中止関数はSessionとDnD一時状態を破棄し、active操作を終了した場合にだけ必要な`terminated` noticeとReorder Modeの`canContinue`結果を反映してidleへ戻す。Session開始前の内部failureではactive DnD終了通知を生成しない。
  - 外部環境変化、通常の開始不可、成立しないdrop、cancelは内部Error用の記録経路へ入れない。
- End-state matrix:

  | 終了経路 | `applyRowMove` | Error記録 | `terminated` | Reorder Mode |
  | --- | --- | --- | --- | --- |
  | complete成功 | 1回 | なし | なし | `canContinue: true` |
  | cancel / 成立しないdrop | 呼ばない | なし | なし | `canContinue: true` |
  | active中の外部環境変化・更新不能 | 成立条件を満たさなければ呼ばない | なし | あり | Step 0で確定した継続可否 |
  | Session開始前の内部failure | 呼ばない | 1回 | なし | DnD終了として変更しない |
  | active中の内部failure | 新たに呼ばない。成立済み更新は戻さない | 1回 | あり | Step 0で確定した継続可否 |

- Tests:
  - drop時Pointからの最終境界再解決と、開始時構造に対する不成立では`getStructure()`の再読取も`applyRowMove()`も起きないことを確認する。
  - 現在構造の行数、blocked境界、移動元、移動先、no-opを再照合し、すべて成立したcompleteだけが`applyRowMove()`を正しい引数で1回呼ぶことを確認する。
  - 現在DOM / 構造の不在、構造変化による不成立、更新不能、cancelで行更新が起きず、安全なidleへ戻ることを確認する。
  - complete成功、cancel、成立しないdrop、外部環境変化、各operationの内部Error、Presentation / Auto Scroll別の`reportFailure`について、notice、Error記録回数、`finishDnd`引数、各公開stateの消去を確認する。
  - 連続noticeに単調増加IDが付くことと、古いIDによる`dismissPresentationNotice()`が新しいnoticeを消さないことを確認する。
  - failureを投げた箇所と共通中止経路で同じErrorが重複記録されず、外部環境変化は記録されないことを確認する。
  - Production exportをテスト都合で増やさず、module isolation、依存境界mock、Facadeのsnapshot / subscription結果から内部state遷移を検証する。
- Completion criteria:
  - 現在構造で再照合できたcompleteだけが1回の行更新を要求する。
  - 全終了経路で終了済みSessionの値がInput / Presentation / Auto Scroll向けactive stateに残らない。
  - 通知ID競合、発生元別failure ingress、一度だけの記録、外部環境変化との区別がfocused testで検証されている。

## Decisions and validation questions

### Decide before implementation

1. Step 0のArchitecture更新を承認し、Table基準要素、Input cleanup、Reorder Mode継続結果、failure ingressの責務間境界をSource実装の前提として確定する。
2. Step 0でArchitecture上の公開情報が変わった場合は、Step 2のFacade型とStep 3の`canContinue`判定箇所を着手前に追従させる。PlanだけでArchitectureとの差を埋めない。

### Validate during implementation

1. WordPressの既存wrapper refがcallback refとobject refのどちらでも合成・cleanupできることをReact integration testで確認する。型またはruntime上の差が判明した場合も、新しいwrapper DOMは追加しない。
2. iframe / non-iframe、Table remount、stale cleanupで常に現在登録だけが返ることをDOM testで確認する。以前のcontextへのfallbackは採用しない。
3. Zustandの利用側別購読が、projectionに含まれない内部stateの変更を利用側へ公開しないことをsubscription testで確認する。
4. DOM矩形とPointから先頭・中間・末尾境界を一貫して解決できることをfocused testで確認する。Production用のresolver exportは追加しない。

## Test Plan

- `editor-dom-context.test.ts`と既存React integration testで、iframe / non-iframe、Table remount、stale cleanup、基準要素不在、既存wrapper refの維持を確認する。
- `reorder-mode.test.ts`で、同じTableのrow modeだけが`finishDnd(tableIdentity, false)`によって`edit`へ戻り、他のmodeとTableが維持されることを確認する。
- `dnd-interaction.test.ts`で、start成功・開始不可・結合行通知・Session projection・開始時構造snapshot・progress・`refreshDestination`を確認する。
- DOM testでは行矩形と`elementFromPoint()`を明示的にmockし、先頭・中間・末尾・`tbody`外・別Table / 入れ子Table・blocked / no-op境界・iframeの`ownerDocument`を扱う。
- completeではdrop時Pointの再解決、現在構造での再照合、成功時だけの1回の行更新、成立しないdrop、現在構造の不在・変化、更新不能を確認する。
- complete成功、cancel、成立しないdrop、外部環境変化、各operationの内部failureについて、更新有無、notice、Error記録、Reorder Mode継続結果、全利用側active stateの消去を確認する。
- `presentationNotice`の単調増加ID、連続通知のID競合、`dismissPresentationNotice`、Presentation / Auto Scroll別の`reportFailure`、一度だけの記録を確認する。
- Production exportをテスト都合で増やさず、Jestのmodule isolation、WordPress境界mock、公開Facadeのsnapshot / subscription結果から検証する。

## Issue breakdown

- [ ] Architecture前提の先行整合: Step 0を独立したArchitecture変更Issueとして実施し、DSL生成・検証とレビューを完了する。
- [ ] [#690](https://github.com/YamabikoLab/yamabiko-table-reorder/issues/690): Step 1〜3を実装し、#731〜#733のDnD Interaction側境界とfocused Jest testを完成させる。

Step 1〜3は同じIssue #690内で順に実施する。Step 1の既存境界変更を先に成立させた後で新規DnD Interactionを接続し、Reorder Presentation本体とAuto Scroll本体は親Planの後続Phaseへ残す。

## Validation

Issue #736のPlan文書変更では、documentation-only変更として次を実行する。

- `git diff --check origin/main...HEAD`

将来のStep 0ではArchitecture Markdown向けvalidationを、Step 1〜3のSource実装完了時は次を実行する。適用範囲と詳細は`docs/development/testing.md`を正本とする。

- `npm test`
- `npm run build`
- `git diff --check origin/main...HEAD`

## Completion criteria

- Step 0のArchitecture前提がSource実装から分離され、承認前にStep 1以降を開始しない順序が明示されている。
- 対象ファイル、追加・変更する型 / state / actions / Facade、既存境界との接続、実装順序、主要テスト、各Stepの完了条件が特定されている。
- start成功・開始不可、Session生成、progress、開始時構造snapshot、complete再照合、成功時だけの行更新、成立しないdrop、cancel、外部変化、内部failure recoveryのテスト方針が含まれている。
- `presentationNotice`、通知ID競合、Presentation / Auto Scroll別の`reportFailure`、一度だけの記録、`refreshDestination`、終了後のstate消去がテスト対象になっている。
- Reorder Target Resolution、Drop Target Resolution、Data Updateを独立責務として再導入せず、Row / Column共通抽象化を追加していない。
- Reorder Presentation本体とAuto Scroll本体が後続Phaseのscopeとして維持されている。

## Notes

- `tableIdentity`は現在のWordPress Block `clientId`であり、Table wrapper登録と`applyRowMove.clientId`で同じ値を使用する。
- `demo/`と`prototype-final`の実装は、このformal v1実装のsource structureまたはinteraction判定の根拠にしない。
- 今回のIssue #736ではPlan文書だけを変更し、Architecture、TypeScript、test、依存関係、生成DSLは変更しない。
