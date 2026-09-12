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

## Goal

RF Interactionを、React component lifecycleから独立した一つのRF Session状態責務として実装できるよう、Phase 4で採用する状態管理方式、公開操作境界、状態表現、Apply Coordinationとの接続境界を確定する。

本Planは`RESP_RF_INTERACTION`のArchitecture Contractを変更しない。Architectureで定義済みのopen / close、対象Table Identity、方向、入力保持、現在結果、Apply要求、成功 / 失敗復帰を、現在のsource規約へ具体的に写像する。

## Scope

### Included

- `zustand/vanilla`を利用したRF Session状態管理
- RF Interactionの公開操作境界
- 対象Table Identityを伴う状態遷移
- Row / Column方向別入力保持
- Input Interpretation / Resolution接続
- 現在表示SnapshotとApply可否の派生
- Apply要求時の方向固有candidateの内部引き渡し
- Apply成功 / 失敗 / 大規模反映Cancel後のRF Interaction側Lifecycle境界
- React mount / unmount / remountから独立したSession維持

### Not included

- RF Apply Coordinationが所有する通常反映 / 確認付き大規模反映Lifecycle
- `confirming | applying | restoring`の詳細状態管理
- WordPress Toolbar / Popover / Reorder Mode排他接続
- React componentやHookの具体的なUI実装
- Table構造解析や方向固有Resolutionの再実装
- Row / Column candidateを一つの共通Move Typeへ統合する変更

## Approach

### Zustand vanilla Storeを状態正本にする

RF SessionはReact componentのmount / unmount / remountを越えて維持される共有observable stateであるため、`zustand/vanilla`を利用したStoreを状態正本とする。

これは`src/AGENTS.md`のZustand state management方針に従う。component-local React stateをRF Sessionの正本にせず、状態遷移はStore所有actionだけから行う。

Zustandは実装手段であり、Storeそのものや`getState()` / `setState()`をRF Interactionの公開Contractにはしない。公開境界はArchitecture上のRF Interaction責務と実際の製品利用から決める。

### 公開操作境界

概念上のRF Interaction公開IFは次とする。実装時の識別子はsource規約に合わせて調整してよいが、意味境界は広げない。

```ts
export type RfDirection = 'row' | 'column';

export type RfInteraction = {
	open: ( tableIdentity: string ) => void;
	close: ( tableIdentity: string ) => void;
	selectDirection: (
		tableIdentity: string,
		direction: RfDirection
	) => void;
	updateRowInput: (
		tableIdentity: string,
		input: RowRfFormInput
	) => void;
	updateColumnInput: (
		tableIdentity: string,
		input: ColumnRfFormInput
	) => void;
	getSnapshot: ( tableIdentity: string ) => RfInteractionSnapshot;
	requestApply: ( tableIdentity: string ) => void;
};
```

すべての状態変更要求に対象Table Identityを伴わせる。これにより、別TableやReact再生成前の古いcomponentから遅れて届いた操作要求で現在Sessionを上書きしない。

### open / close

`open(tableIdentity)`はclosed状態から対象TableのSessionを初期Row方向で開始する。

同じTableのSessionがすでにopenの場合、再openでは方向・入力・現在Sessionを初期化しない。React remount等による同一Tableの再接続をSession終了条件にしないためである。

別Tableでopenされた場合は、既存Sessionを終了し、新しいTableを初期Row方向・初期入力で開始する。同時にopenできるRF Sessionは一つだけとする。

`close(tableIdentity)`は指定Tableが現在Session対象の場合だけ終了する。別Tableまたは終了済みSessionからの古いclose要求は無視する。RF入力画面のCancelはTableを更新せず、このcloseと同じSession終了意味として扱う。

### 方向切替と方向別入力保持

SessionはRow / Columnそれぞれの入力値を保持する。

方向切替時は切替前方向の入力値自体は保持するが、Input Interpretation / Resolution結果を切替後方向の現在結果へ持ち越さない。切替先方向では保持済み入力と要求時点の現在Table情報を使い、改めてInterpretation / Resolutionする。

### 入力更新と現在結果

Row入力更新では要求時点の現在行数をRow Table Integrationから取得し、RF Input Interpretationへ渡す。Column入力更新では要求時点の最小列記述をColumn Table Integrationから取得する。

Input Interpretationが`not-ready`の場合は方向固有Resolutionへ進めない。`ready`の場合だけ対応するRow / Column RF Resolutionを要求する。

現在表示結果は、Input InterpretationとResolutionを接続した結果として次の粒度を表現する。

- `not-ready`
- `no-op`
- `rejected`と方向固有`blockingMergedRange`
- `unavailable`
- `resolved`

`canApply`は独立stateとして保持せず、現在結果が`resolved`の場合だけ`true`となる派生値にする。

### 表示Snapshot

Presentation / WordPress Integrationへは、対象Tableから見た現在表示状態だけを公開する。

概念上のSnapshotは次の状態を表現できるものとする。

```ts
type RfInteractionSnapshot =
	| { status: 'closed' }
	| {
			status: 'open';
			direction: 'row';
			input: RowRfFormInput;
			rowCount: number | null;
			result: RfRowCurrentResult;
			canApply: boolean;
	  }
	| {
			status: 'open';
			direction: 'column';
			input: ColumnRfFormInput;
			columns: readonly ColumnInputDescriptor[];
			result: RfColumnCurrentResult;
			canApply: boolean;
	  }
	| {
			status: 'applying';
			direction: 'row' | 'column';
	  };
```

Row / Column Resolutionが返すcandidate自体はPresentation向けSnapshotへ公開しない。candidateはRF InteractionからRF Apply Coordinationへ渡す内部境界の値に限定する。

Rowの現在行数とColumnの現在列記述は、現在Tableから要求時点で取得する情報であり、永続的なSession snapshotとして保持しない。

### Apply要求

`requestApply(tableIdentity)`は、現在SessionのTable Identityが一致し、現在結果が`resolved`の場合だけ成立する。

`not-ready` / `no-op` / `rejected` / `unavailable`ではApply Lifecycleを開始しない。

Apply要求時は解決済みの方向固有candidateをUIへ経由させず、RF Apply Coordinationへ内部的に渡す。

```ts
type RfApplyRequest =
	| {
			direction: 'row';
			candidate: RowRfMoveCandidate;
	  }
	| {
			direction: 'column';
			candidate: ColumnRfMoveCandidate;
	  };
```

Row / Column candidateは方向固有Typeのまま維持する。

Phase 4ではRF Interaction側のApply要求と粗い`applying`状態、成功 / 失敗 / Cancel後の復帰境界までを成立させる。通常反映 / 確認付き大規模反映の詳細LifecycleはPhase 5のRF Apply Coordinationが所有する。

Apply成功ではSessionを終了する。Apply失敗または大規模反映CancelではTableを不完全に変更せず、方向別入力を保持したopen Sessionへ戻る。

RF Apply Coordinationが所有する`confirming | applying | restoring`をRF Interactionへ重複保持しない。

## Architecture impact

新しいArchitecture責務は追加しない。

`RESP_RF_INTERACTION`の既存Contractを次の実装方針へ写像する。

- 一つのopen RF SessionをZustand vanilla Storeで表現する。
- Store内部APIをArchitecture境界として公開しない。
- Session状態の正本と現在Table情報を分離する。
- Presentationへ方向固有candidateを公開しない。
- Apply Coordinationの詳細LifecycleをRF Interactionへ重複所有しない。

Architecture文書の責務、依存関係、Lifecycle、Invariantは変更しない。

## Implementation phases

### Phase 1: Session Storeと公開操作境界

- Outcome: closedまたは一つのRF SessionをReact lifecycleから独立して所有できる。
- Tasks:
  - `zustand/vanilla` Storeを作成する。
  - `open` / `close` / `selectDirection`とTable Identity guardを実装する。
  - Row / Column方向別入力を保持する。
  - Store内部APIを外部公開しないRF Interaction facadeを用意する。
- Validation:
  - 同一Table再open、別Table open、別Table close、一Session制約、方向切替、入力保持をfocused store testで確認する。

### Phase 2: Input Interpretation / Resolution接続

- Outcome: 現在入力から現在Tableを基準とするRF結果とApply可否を一意に解決できる。
- Tasks:
  - Row / Column入力更新を既存Input Interpretationへ接続する。
  - `ready`の場合だけ方向固有Resolutionへ進める。
  - 現在結果を`not-ready | no-op | rejected | unavailable | resolved`の意味へ接続する。
  - `canApply`を`resolved`から派生させる。
  - 方向切替後は切替先の現在Table情報で結果を再解決する。
- Validation:
  - 各結果状態、方向切替時の旧結果非継承、Table変化後の再解決をfocused responsibility testで確認する。

### Phase 3: SnapshotとApply境界

- Outcome: Presentationへ最小表示状態を公開し、Phase 5へ方向固有candidateを安全に渡せる。
- Tasks:
  - 対象Table視点のSnapshotを公開する。
  - candidateをPresentation向けSnapshotから除外する。
  - `requestApply`のTable Identity / `resolved` guardを実装する。
  - Apply成功 / 失敗 / Cancel結果をSession終了または入力保持復帰へ接続できる内部境界を用意する。
- Validation:
  - candidate非公開、Apply guard、成功終了、失敗 / Cancel復帰、React remount非依存をfocused testで確認する。

## Decisions and validation questions

### Decide before implementation

- RF Interactionの状態管理方式は`zustand/vanilla`に確定する。
- Zustand Storeは状態正本だが、Store内部APIはRF Interaction公開Contractにしない。
- `canApply`は独立stateにせず現在結果から派生させる。
- Presentation向けSnapshotへ方向固有candidateを公開しない。
- Row / Column candidateを共通Move Typeへ統合しない。

### Validate during implementation

- 現在Table情報をSnapshot取得時または入力更新時に解決する具体的な実装配置は、不要な再解析やReact再描画を増やさずArchitectureの「要求時点の現在Table」Contractを満たす形をfocused testと計測で確認する。
- Zustand selectorを追加するPhaseでは、各consumerが必要な状態だけを購読し、無関係なRF状態更新で不要な再描画を起こさないことを確認する。

## Issue breakdown

- [ ] #962 RF Phase 4: RF Interaction and Session lifecycleを実装する
- [ ] Phase 5でRF Apply Coordinationとの実接続を完成する
- [ ] Phase 7でReact / WordPress Integrationから公開Snapshot / 操作境界を利用する

## Validation

`docs/development/testing.md`を正本としてPhase 4に必要なfocused Jest validationを行う。

- Store lifecycle: open / close / same-table reopen / another-table open
- Direction lifecycle: Row / Column切替と方向別入力保持
- Interpretation / Resolution: 現在結果とApply可否
- Stale request guard: 別Table / 旧方向からの操作要求
- Apply boundary: candidate非公開、Apply guard、成功 / 失敗 / Cancel復帰
- Mount stability: React mount / unmount / remountをSession終了条件にしない

## Completion criteria

- `zustand/vanilla` Storeが一つのRF Session状態正本として成立する。
- React component lifecycleとRF Session lifecycleが分離されている。
- Store内部APIをRF Interaction公開IFへ漏らしていない。
- 同一Table再openで入力・方向を失わず、別Table開始では新しいSessionへ安全に切り替わる。
- Row / Column入力を方向別に保持し、現在方向だけをInterpretation / Resolutionへ接続できる。
- `not-ready` / `no-op` / `rejected` / `unavailable`ではApply不可、`resolved`の場合だけApply可能になる。
- Apply可否が独立stateを持たず、現在結果から一意に導出される。
- Presentationへ方向固有candidateを公開しない。
- Apply成功でSessionを終了し、失敗 / 大規模反映Cancelでは入力保持したopen Sessionへ戻れる。
- Phase 1〜3の既存責務を再実装していない。

## Notes

- 本PlanはPhase 4の具体的な実装方針を補足する。RF全体の実装順序とPhase境界は`docs/plans/reorder-form-v1-plan.md`を正本とする。
- Architecture上のContract変更が必要になった場合は、このPlanや#962だけで決定せず`docs/architecture/reorder-form-v1-architecture.md`を先に更新する。
