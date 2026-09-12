# PLAN-962: RF Interaction and Session lifecycle

## References

- Parent issue: #936
- Implementation issue: #962
- Requirements: `docs/requirements/reorder-form-v1-requirements.md`
- Design: `docs/design/reorder-form-v1-design.md`
- Architecture: `docs/architecture/reorder-form-v1-architecture.md`
- Parent plan: `docs/plans/reorder-form-v1-plan.md`
- Phase 1: #932
- Phase 2: #933
- Phase 3: #937
- Phase 5: #963

## Goal

`RESP_RF_INTERACTION`の受理済みArchitectureを、React component lifecycleから独立したRF Session状態管理とReact購読境界へ実装する。

Phase 1〜3で実装済みのTable Integration、Input Interpretation、Row / Column Resolutionを接続し、Phase 5のRF Apply Coordinationへfresh candidateを渡せる状態までをPhase 4の成果とする。

## Implementation direction

### Session state

`src/reorder/reorder-form/responsibilities/interaction.ts`に`zustand/vanilla` Storeを置き、一つのRF Sessionを状態正本として所有する。

StoreにはSession継続に必要な対象Table Identity、現在方向、Row / Column入力、粗い`open | applying` Lifecycleを保持する。現在Tableに依存する行数、列記述、Resolution結果は要求時点で再評価した表示用cacheとして扱い、Table構造snapshotやcandidateの成立保証には使わない。

状態変更はStore actionからだけ行い、外部統合には`rfInteraction` facadeを公開する。

### Current-table evaluation

入力更新、方向切替、`notifyTableChanged()`、`requestApply()`は同じ現在Table基準の評価経路を利用する。

- Row: Row Table Integration → RF Input Interpretation → Row RF Resolution
- Column: Column Table Integration → RF Input Interpretation → Column RF Resolution

Input Interpretationが`not-ready`の場合はResolutionへ進めない。Table情報を取得できない場合は`unavailable`とする。

Presentation向け結果からcandidateを除外し、`canApply`はReact境界で`result.status === 'resolved'`から導出する。

### React subscription

`src/reorder/reorder-form/responsibilities/interaction-react.ts`に`useRfInteraction(tableIdentity)`を置く。

HookはZustand Storeを継続購読し、現在Session対象と一致するTableだけへ方向固有の表示状態を返す。別Tableには`closed`を返す。

Hookは状態観測だけを担当し、WordPress側のTable変更検知や`notifyTableChanged()`発火を行わない。

### Apply boundary

`requestApply()`では直前の表示結果を成立保証として使わず、保持入力を要求時点の現在Tableで再評価する。

fresh resolutionが`resolved`で、Phase 5のRF Apply Coordination受信境界が接続されている場合だけ`applying`へ進み、方向固有candidateを内部Apply要求として渡す。

Phase 5から返る結果は次へ接続する。

- success: Session終了
- failure: 方向別入力を保持してopenへ復帰
- cancelled: 方向別入力を保持してopenへ復帰

`applying`中はRF Interaction側の新しい命令・通知を無視する。

## Implementation units

### 1. RF Interaction Store

- `interaction.ts`を追加する。
- `open` / `close` / `selectDirection`を実装する。
- Row / Column入力を方向別に保持する。
- Table Identity guardと一Session制約を実装する。

### 2. Evaluation connection

- Phase 1〜3の既存IFを接続する。
- 現在方向の共通再評価経路を実装する。
- `notifyTableChanged()`を再評価の外部通知入口として実装する。
- candidateを表示状態へ含めない。

### 3. Apply handoff

- `requestApply()`でfresh resolutionを行う。
- Phase 5へ方向固有candidateを渡す内部接続境界を実装する。
- `applying`中の操作拒否とsuccess / failure / cancelled復帰を実装する。

### 4. React subscription

- `interaction-react.ts`を追加する。
- `useRfInteraction(tableIdentity)`を実装する。
- Row / Columnをdiscriminated unionで公開する。
- `canApply`を現在結果から派生させる。

### 5. Focused tests

- Store / responsibility testでSession lifecycle、方向別入力保持、Table変更再評価、fresh candidate、applying guard、Apply結果復帰を確認する。
- React Hook testで対象TableだけがStore更新を継続購読し、`notifyTableChanged()`後の表示状態へ追従することを確認する。

## Validation

`docs/development/testing.md`を正本として、TypeScript変更に適用されるNode.js checks、production build、repository checkを最終確認に用いる。

Phase 4のfocused Jestでは少なくとも次を確認する。

- same-table reopen / another-table open / guarded close
- Row / Column方向切替と方向別入力保持
- `not-ready | no-op | rejected | unavailable | resolved`と`canApply`
- stale Table / direction要求の無効化
- `notifyTableChanged()`による現在Table基準再評価
- Apply要求時のfresh candidate
- `applying`中の命令 / 通知 / 二重Apply無効化
- success / failure / cancelled後のLifecycle
- React mount / unmountから独立したStore状態
- `useRfInteraction(tableIdentity)`の継続購読と別Table隔離

## Issue breakdown

- [ ] #962 RF Phase 4: RF Interaction and Session lifecycleを実装する
- [ ] #963 RF Phase 5: RF Apply Coordinationを実装する
- [ ] Phase 7でWordPress RF entry / Popoverから`rfInteraction`と`useRfInteraction()`を接続する
