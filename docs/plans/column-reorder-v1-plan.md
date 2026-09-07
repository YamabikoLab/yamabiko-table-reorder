# PLAN-839: Column Reorder v1 implementation

## References

- Parent issue: #839
- Requirements:
  - `docs/requirements/reorder-v1-requirements.md`
  - `docs/requirements/reorder-v1-quality-requirements.md`
- Design:
  - `docs/design/reorder-v1-design.md`
  - `docs/design/column-reorder-v1-design.md`
- Architecture: `docs/architecture/column-reorder-v1-architecture.md`
- Plan guidelines:
  - `docs/plans/AGENTS.md`
  - `docs/plans/TEMPLATE.md`
- Source guidelines:
  - `src/AGENTS.md`
  - `src/reorder/AGENTS.md`
- Validation: `docs/development/testing.md`

## Goal

確定済みのColumn Reorder v1 Architectureを、現在の`main`からレビュー可能な実装単位へ分け、依存関係に沿って実装・検証できる順序を定める。

## Scope

### Included

- Column Reorder v1 Architectureを実装するための実装順序とIssue単位
- 現在の`main`に存在する共通Reorder基盤を前提としたColumn Reorder固有実装
- Table Integration、Reorder Target Resolution、Destination Resolution、DnD Interaction、DnD Engine Integration、Input Interaction、Reorder Presentationの列固有実装
- WordPress Reorder IntegrationへのColumn DnD接続と列入口の公開
- Core Table / Flexible Table Block、iframe / non-iframe、PC / touch、Undo、結合セル、横Auto Scrollを含む横断validation
- QR-01の責任境界に沿った大規模Tableの性能確認

### Not included

- Requirements / Design / Architectureの再定義
- Row Reorder固有実装の変更
- Row / Column間の方向固有状態または共通Reorder抽象化の導入
- Keyboard操作など、Column Reorder v1の現行Requirements / Designで対象外としているアクセシビリティ実装
- Column Reorder公開後のversion更新やrelease作業

## Current implementation gap

現在の`main`では、Reorder Mode、Reorder Guidance、Editor DOM Context、WordPress側の共通Reorder接続、およびRow Reorder v1が実装済みである。ToolbarにはColumn Reorder入口と`column`状態への接続も存在するが、公開前のためCSSで非表示となっている。

一方、`src/reorder/column-reorder/`は存在せず、Column Reorder Architectureで定義された列固有のTable Integration、Reorder Target Resolution、Destination Resolution、DnD Interaction、DnD Engine Integration、Input Interaction、Reorder Presentationは未実装である。WordPress Reorder Integrationも、`column`モードを実際のColumn DnD Engine Integrationへ接続する経路をまだ持たない。

したがって、共通Reorder基盤は現在の実装を再利用し、列固有責務だけを独立して追加する。Row Reorderの責務分割や実装上の知見は参照してよいが、列実装をRow実装へ依存させたり、見た目が似ていることを理由に方向共通化したりしない。

## Approach

Column Reorder固有処理は`src/reorder/column-reorder/`配下へ独立して実装する。実装順序は、外側の入力や表示より先に、列構造と意味状態を扱う境界を成立させる。

最初にTable Integrationを実装し、Core Table / Flexible Table Blockの保存表現差を吸収して、要求時点の列制約取得とTable全体への確定済み列移動を提供する。続いてReorder Target Resolutionを実装し、`colspan`を含む開始不可判定をTable Integrationの現在制約から解決する。

次にDestination ResolutionとDnD Interactionを実装する。Destination ResolutionはDnD開始時の列配置から物理位置を論理列間境界へ変換し、DnD Interactionは第二段階で解決済みのTargetと開始時制約からSessionを開始する。`progress`では開始時制約だけで移動先の有効性を判断し、`complete`時だけ現在Tableを再照合して確定済み移動へ進む。

意味責務が成立した後、DnD Engine IntegrationとPC / touch Input Interactionを接続する。入力開始時の第一段階Target Resolutionとactive DnD成立直前の第二段階Target Resolutionを分離したまま実装し、DnD Engine固有イベントをDnD Interactionへ漏らさない。Auto ScrollはDnD Engineの機能として横方向だけを有効にする。

その後Reorder Presentationを実装し、開始不可通知、移動対象列、垂直挿入線、周囲列の移動表示、確定・cancel・安全終了時の表示Lifecycleを接続する。最後にWordPress Reorder IntegrationへColumn DnD Engine Integrationを組み込み、既存の共通Reorder Mode / Guidanceと接続して列入口を公開する。

各Phaseでは、その責務を単体または隣接境界と組み合わせたfocused testで先に確認する。実WordPress Editorを通るPlaywrightとQR-01の性能確認は、製品経路が成立した後の横断validationで行う。

実装中にRequirements / Design / Architectureの変更が必要になった場合はPlanまたは実装Issueで決定せず、該当する上位文書を先に更新してからPlanを追従させる。

## Implementation phases

### Phase 1: Column Table Integration

- Outcome: 後続PhaseがSupported Table Block固有表現へ依存せず、現在列制約と確定済み列移動を利用できる。
- Tasks:
  - `src/reorder/column-reorder/`の列固有実装境界を作成する。
  - Core Table / Flexible Table Blockから、論理列数、単独移動できない列、挿入できない列間境界を判断できるColumn Reorder用制約を取得するTable Integrationを実装する。
  - 再照合済みの列移動を`thead`、`tbody`、`tfoot`を含むTable全体へ一つの更新として反映する。
  - 対応Tableを安全に解釈できない場合と更新不能を部分更新せず正常な利用不能として返す。
- Validation:
  - Core Table / Flexible Table Blockの代表構造、`colspan` / `rowspan`、head / body / foot、データ保持、単一更新境界をfocused testで確認する。

### Phase 2: Reorder Target Resolution

- Outcome: Column Reorder開始候補を、要求時点の現在列制約から副作用なく解決できる。
- Tasks:
  - 論理列だけを表すReorder Targetと、開始時制約を含む解決結果を分離して実装する。
  - `colspan`で単独移動できない列をDesign上の開始拒否として扱う。
  - `rowspan`だけを理由に開始拒否しない。
  - Tableまたは対象列を安全に解釈できない場合を通常の利用不能として扱う。
- Validation:
  - `resolved` / `rejected` / `unavailable`の境界と、判定中にTableデータを変更しないことをfocused testで確認する。

### Phase 3: Destination Resolution

- Outcome: DnD Engineの物理入力位置を、DnD開始時Table配置に基づく0-based論理列間境界へ変換できる。
- Tasks:
  - DnD開始時に論理列境界の配置を計測し、そのDnDだけの一時状態として保持する。
  - move時の物理位置を論理列間境界または`null`へ変換する。
  - 横スクロールによるTable全体の位置変化へ追従しつつ、Presentationによる見かけ上の列移動を判定へ混入させない。
  - Table外の物理位置から移動先を推測しない。
- Validation:
  - 先頭・中間・末尾境界、Table外、横スクロール後、表示変位がある場合の境界解決をfocused testで確認する。

### Phase 4: DnD Interaction and Session Lifecycle

- Outcome: 第二段階で解決済みのTargetと開始時制約から、Column DnD Sessionの開始・進行・確定・cancel・安全終了を管理できる。
- Tasks:
  - Session stateと開始・progress・complete・cancelの結果表現を実装する。
  - `progress`ではSession開始時制約だけを使って論理列間境界の有効性を判定する。
  - `complete`では現在Tableの列制約を再取得し、Targetと最終移動先が現在も成立する場合だけTable Integrationへ確定済み列移動を要求する。
  - 外部Table変化による確定不能と内部Contract / runtime invariant違反を区別する。
  - Session終了後、対象TableでColumn Reorderを安全に継続できるかだけをReorder Modeへ反映する。
- Validation:
  - 有効移動、同位置相当、無効境界、cancel、complete時の外部変更、Table利用不能、内部Error伝播、終了後モード維持 / 終了をfocused testで確認する。

### Phase 5: DnD Engine Integration and PC Input

- Outcome: PCから開始した物理DnDが、二段階Target Resolutionを経てColumn DnD Sessionへ接続される。
- Tasks:
  - DnD Engine固有Lifecycleを列固有のDnD Engine Integrationへ閉じ込める。
  - PC入力開始時に第一段階Target Resolutionを行い、開始可能な候補だけをDnD Engineへ一時登録する。
  - active DnD成立直前に同じTargetを第二段階で再解決し、成立した場合だけDnD Interactionを開始する。
  - moveではDestination Resolutionが返した論理列間境界だけをDnD Interactionへ渡す。
  - endではDnD Engineの終了種別をColumn Reorderのcomplete / cancelへ変換する。
- Validation:
  - 第一段階拒否、第一段階後の構造変化による第二段階不成立、正常開始、move、complete、cancel、cleanupをintegration testで確認する。

### Phase 6: Touch Input and horizontal Auto Scroll

- Outcome: 通常スクロールを妨げずにtouch DnDを開始でき、active DnD中は横方向だけAuto Scrollできる。
- Tasks:
  - touch開始条件をInput Interactionへ接続し、PCと同じ二段階Target Resolution経路へ合流させる。
  - DnD未開始時のTable / Editorの通常スクロールを維持する。
  - active Column DnDではDnD EngineのAuto Scrollを横方向だけに限定する。
- Validation:
  - 通常touch scroll、touch DnD開始、開始拒否、横Auto Scroll、縦方向へAuto Scrollしないこと、cleanupをfocused / integration testで確認する。

### Phase 7: Reorder Presentation

- Outcome: Column Reorderの開始不可理由、移動対象、移動先、周囲列移動、終了状態をDesignどおり表示できる。
- Tasks:
  - `colspan`による開始拒否をTableツールバー下の一回性通知へ接続し、数秒後に終了させる。
  - active DnD中の移動対象列を、元Tableの列幅とセル高さの配置関係を保つ独立表示として実装する。
  - 現在の有効移動先を垂直挿入線で表示する。
  - 実際に位置が変わる周囲列だけを滑らかに移動表示する。
  - complete / cancel / 安全終了で一時表示を解放し、安全終了のうちDesignで通知対象となる場合だけ共通終了通知へ接続する。
- Validation:
  - 空セル、異なるセル高さ、head / body / foot、挿入線更新、周囲列変位、開始拒否通知、終了時cleanupをfocused React testで確認する。

### Phase 8: WordPress product composition and column entry publication

- Outcome: 現在のWordPress Editor製品経路でColumn Reorderを選択・実行でき、既存Row Reorderと排他的に共存する。
- Tasks:
  - WordPress Reorder Integrationで、現在Tableの`column`モードだけColumn DnD Engine Integrationを有効化する。
  - 既存Reorder Mode、Reorder Guidance、Editor DOM Context、通常編集抑止をそのまま共通基盤として接続する。
  - Column Reorder入口の暫定非表示を解除する。
  - `src/index.tsx`はthin entry pointのまま維持し、Column Reorder固有LifecycleをWordPress integration境界へ閉じ込める。
- Validation:
  - row / column排他、同じ入口の再選択、別Table選択、Toolbar再生成、通常編集抑止と復帰、Guidanceから両入口への導線をReact / WordPress integration testで確認する。

### Phase 9: Cross-cutting validation

- Outcome: Column Reorder v1がRequirements / Design / Architecture / Quality Requirementsの対象範囲で製品として成立していることを確認できる。
- Tasks:
  - focused Jestで保護済みの内部分岐を重複させず、実WordPress Editorで必要な主要契約をPlaywrightへ割り当てる。
  - Core Table / Flexible Table Block、iframe / non-iframe、PC / touch、結合セル、Undo、データ保持、横Auto Scroll、安全終了を横断確認する。
  - 1,000行×20列の代表的な大規模Tableで、対応Table Block本体の更新コストとYTR自身が追加する処理を区別してQR-01を確認する。
- Validation:
  - 実行コマンドと環境matrixは`docs/development/testing.md`を正本として、Column Reorder用のJest / Playwright / performance確認を実施する。

## Decisions and validation questions

### Decide before implementation

1. **Phase 1開始前: Column Reorderのsource配置**
   - `src/reorder/column-reorder/`配下で、現在のRow Reorderと同様に責務・integration・技術補助の配置を識別できる構成を決める。
   - Row Reorderの現行directory構成を機械的に複製せず、Column Architectureの責務と変更理由に基づいて配置する。

2. **Phase 1開始前: Table IntegrationのColumn制約表現**
   - Architectureが要求する論理列数、単独移動不可列、挿入不可境界を、後続責務がSupported Table Block表現を知らずに利用できるType / Resultとして確定する。

3. **Phase 3開始前: Column geometryの計測表現**
   - DnD開始時の列境界をどのDOM情報から取得し、横スクロール中にどの値を再利用・再取得するかを実装レベルで確定する。
   - Editor DOM Contextの責務を重複せず、global `document` / `window`へ依存しない。

4. **Phase 4開始前: DnD Session stateの実装表現**
   - Reorder Target、開始時制約、現在の有効移動先、終了結果を、Architectureの状態所有を崩さない最小のstateとして確定する。

5. **Phase 5開始前: DnD Engine adapter構成**
   - 第一段階解決後の候補登録と第二段階解決を、DnD EngineのどのLifecycleへ接続するかを確定する。
   - Row Reorderの既存adapterは参考にしてよいが、Column ReorderからRow Reorderへ方向固有依存を作らない。

6. **Phase 7開始前: Column Presentationの描画方式**
   - 移動対象列、垂直挿入線、周囲列変位を、TableデータをDnD中に並べ替えず実現するReact / DOM / CSSの分担を確定する。
   - DnD Engine標準の移動表示へ依存しない。

7. **Phase 9開始前: Column Reorder validation matrix**
   - Requirements / Design / Architecture / Quality Requirementsの主要契約を、focused Jest、Playwright、performance確認のどこで保証するか確定する。
   - Row Reorder E2Eの単純な複製ではなく、列固有のTable全体更新、`colspan`、横Auto Scroll、列表示を優先する。

### Validate during implementation

1. **Column Table Integrationの構造解釈**
   - Evidence: Core Table / Flexible Table Blockの代表的な`colspan` / `rowspan`構造を使ったfocused test。
   - 実装中にArchitectureで表現できない列構造が見つかった場合は、Table Integration内で独自仕様を追加せずArchitectureへ戻す。

2. **Destination Resolutionの横スクロール追従**
   - Evidence: DnD開始後にTable位置が横方向へ変わっても、開始時の論理列境界へ正しく対応できるintegration test。

3. **touch入力と通常スクロールの競合**
   - Evidence: DnD未開始時のtouch scrollと、DnD成立後の列移動を実ブラウザで確認する。

4. **Column Presentationの大規模Tableコスト**
   - Evidence: 周囲列の移動表示や移動対象表示が、無関係な列・セルへ不要な更新を広げていないことをReact側の観測とperformance計測で確認する。

5. **Supported Table Block更新コストとの分離**
   - Evidence: `docs/development/testing.md`の方針に従い、通常のWordPress属性更新をbaselineとしてColumn Reorder自身の開始・進行・確定処理を分けて確認する。

## Issue breakdown

Planレビュー後、以下を原則として一つのレビュー可能な実装Issueへ分割する。実装中validationで境界変更が必要になった場合は、Architectureを変更しない範囲でIssue粒度を調整する。

- [ ] Phase 1: Column Table Integrationを実装する
- [ ] Phase 2: Column Reorder Target Resolutionを実装する
- [ ] Phase 3: Column Destination Resolutionを実装する
- [ ] Phase 4: Column DnD Interaction / Session Lifecycleを実装する
- [ ] Phase 5: Column DnD Engine IntegrationとPC Input Interactionを実装する
- [ ] Phase 6: Touch Input Interactionと横Auto Scrollを実装する
- [ ] Phase 7: Column Reorder Presentationを実装する
- [ ] Phase 8: WordPress product compositionとColumn Reorder入口公開を行う
- [ ] Phase 9: Column Reorder v1の横断validationを追加・実施する

## Validation

このPlan自体はdocumentation-only変更のため、repository validationは`docs/development/testing.md`に従い`git diff --check origin/main...HEAD`を対象とする。

後続実装では各Phaseのfocused testを先に実行し、製品経路成立後に必要なNode.js checks、production build、Playwright E2E、performance measurementを実施する。具体的なコマンドは`docs/development/testing.md`を正本とし、本Planでは重複して定義しない。

## Completion criteria

- Column Reorder v1 Architectureの各列固有責務が、実装PhaseとIssue breakdownへ対応付けられている。
- 現在の`main`に存在する共通Reorder基盤と、未実装のColumn Reorder固有責務の差分が明確になっている。
- Row ReorderとColumn Reorderの実装独立性を維持する実装順序になっている。
- 二段階Reorder Target Resolution、Destination Resolution、Session開始時制約、complete時再照合が実装順序へ反映されている。
- Column Reorder固有の`colspan`制約、Table全体更新、横Auto Scroll、Presentationが各Phaseへ割り当てられている。
- Core Table / Flexible Table Block、iframe / non-iframe、PC / touch、Undo、QR-01を含む横断validation方針が整理されている。
- 後続Issueを一つずつレビュー可能な単位として作成できる。
