# Editor DOM Context アーキテクチャ設計書

## 1. Introduction and Goals

本書は、Yamabiko Table Reorder正式v1でDOM / Web APIを利用する各並び替えArchitectureに対して、現在のWordPress Editorに属するeditor DOM contextを提供する共有責務を定義する。

Editor DOM Contextは行並び替えと列並び替えのどちらにも利用されるが、並び替え方向、Table構造、DnD状態、表示状態、データ更新を扱わない。行並び替えと列並び替えのArchitectureは互いに独立し、本書だけを共有Architectureとして参照する。

対応Editor環境の保証範囲は`docs/requirements/reorder-v1-quality-requirements.md`の`QR-02`を正本とする。本書では、その保証範囲を実現する責務、境界、Lifecycle、Invariantだけを定義する。

## 2. Architecture Constraints

- DOM / Web APIを利用する側へEditor環境ごとのbrowsing context差の判定を持ち込まない。
- 提供するcontextがeditor lifecycleをまたいで有効であることを前提にしない。
- 以前のeditor lifecycleで得たcontextを現在のcontextとして代替利用しない。
- 現在のeditor contextを安全に解決できない状態は、並び替え内部のInvariant違反として扱わない。
- 行並び替えまたは列並び替えに固有の状態、規則、制約、データを所有しない。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | `QR-02`で保証対象とする編集環境と、その時点で利用可能なeditor contextを提供する。 |

Editor DOM Contextの境界は、現在のWordPress Editorから、その時点でDOM / Web APIを利用するために必要なcontextを解決するところまでとする。Table Block、Undo、DnD、並び替え方向、Presentationは本Architectureの境界外とする。

## 4. Solution Strategy

Editor DOM Contextは、DOM / Web APIを利用する責務がcontextを必要とする時点で、現在のeditor lifecycleに属する基準から利用すべきcontextを解決する。

解決したcontextを永続的な共有状態として扱わず、editor lifecycleが変化した場合は新しいlifecycleに対して改めて解決する。現在のcontextを安全に提供できない場合は、過去のcontextへfallbackせず、不在として境界へ返す。

この責務により、行並び替えArchitectureと列並び替えArchitectureは、対応Editor環境のbrowsing context差をそれぞれ独自に解釈しない。

### Process Flow Views

#### Editor DOM Context Resolution {#PV_EDITOR_DOM_CONTEXT_RESOLUTION kind=normal}

現在のEditorから、その時点で利用するeditor DOM contextを解決して利用側へ提供する処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_EDITOR_DOM_CONTEXT | normal | 現在のeditor lifecycleに属するcontext解決の基準が提供される。 |

#### Editor DOM Context Unavailability {#PV_EDITOR_DOM_CONTEXT_UNAVAILABILITY kind=failure-recovery}

現在のcontextを安全に提供できない場合に、過去のcontextへfallbackせず不在として扱う境界を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_EDITOR_DOM_CONTEXT | failure | 現在のeditor lifecycleでは安全なcontextを解決できない。 |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | recovery | 過去のcontextを代替せず、現在のcontextが利用できない状態として処理を終了する。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のeditor lifecycleに対してDOM / Web APIを利用するためのeditor DOM contextを解決して提供する。 |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のeditor lifecycleに属するcontextを解決するためにWordPress Editorの現在状態を必要とする。 |

### Responsibility Details

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のeditor contextに属する基準から、その時点でDOM / Web APIを利用するために必要なeditor DOM contextを解決し、必要とする並び替えArchitectureへ提供する。利用側が`QR-02`で対象となるEditor環境差を直接扱わなくてよい境界を担う。

##### State ownership

永続状態を所有しない。

並び替えモード、DnD状態、Reorder Session、Tableデータ、移動対象、移動先、Presentation状態を所有しない。解決したeditor DOM contextをeditor lifecycleをまたぐ状態として保持しない。

##### Contract

DOM / Web APIを必要とする利用側が現在のeditor contextを必要とする時点で、現在のeditor lifecycleに属する基準を受け取り、その時点で利用すべきeditor DOM contextを提供する。

現在のeditor contextを安全に提供できない場合は、以前のeditor lifecycleで得たcontextを代替として提供せず、利用側が現在の操作を開始しない、またはactiveな操作を終了できる不在結果を返す。

contextの解決に使用する具体的なDOM要素、Web API property、探索方法、識別子はArchitectureのContractとして固定しない。

##### Lifecycle

利用側が現在のeditor contextを必要とする時点で、その時点のeditor lifecycleに対してcontextを解決する。

提供したcontextがeditor lifecycleの変化後も有効であることは保証しない。新しいlifecycleでは現在のeditor contextに対して改めて解決し、以前に解決したcontextを自動的に持ち越さない。

##### Invariants

- 提供するcontextは、解決に用いた基準と同じ現在のeditor contextに属する。
- 利用側へEditor環境ごとのbrowsing context差の判定を要求しない。
- editor lifecycleをまたいだcontextの永続性を保証しない。
- 以前のeditor lifecycleで得たcontextを現在のcontextとして再利用しない。
- 現在のcontextを安全に提供できない状態を内部Invariant違反として扱わない。
- 行並び替えまたは列並び替えに固有の状態、Tableデータ、移動対象、移動先を所有しない。
- 具体的なDOM要素、Web API property、探索方法、識別子をArchitectureの必須Contractとして固定しない。

## 6. Runtime View

### Editor DOM Contextを利用できる場合 {#RV_EDITOR_DOM_CONTEXT_AVAILABLE}

| Step | From | To | Interaction |
| --- | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_EDITOR_DOM_CONTEXT | 現在のeditor lifecycleに属するcontext解決の基準を提供する。 |
| 2 | RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のlifecycleで利用すべきeditor DOM contextを解決する。 |

### Editor DOM Contextを利用できない場合 {#RV_EDITOR_DOM_CONTEXT_UNAVAILABLE}

| Step | From | To | Interaction |
| --- | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_EDITOR_DOM_CONTEXT | 現在のeditor lifecycleでは安全なcontextを解決できない状態になる。 |
| 2 | RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 過去のcontextへfallbackせず、現在のcontextが利用できない状態として終了する。 |

## 8. Crosscutting Concepts

### Editor lifecycle

Editor DOM Contextが提供するcontextの有効性は、解決時点のeditor lifecycleに限定する。利用側もcontextの永続性を前提にせず、現在の操作で必要な時点のcontextを利用する。

### Architecture independence

Editor DOM Contextは行並び替えArchitectureと列並び替えArchitectureのどちらからも利用できるが、両Architectureを束ねるReorder抽象化ではない。方向固有の責務やContractを本Architectureへ持ち込まない。

## 9. Architecture Decisions

### Editor DOM Contextだけを共有Architectureとする

行並び替えと列並び替えの間で共有するArchitecture責務はEditor DOM Contextだけとする。

これにより、Editor環境差の解決は重複させず、一方でTable Integration、DnD、制約判定、更新、表示などの方向固有責務を共有抽象化へ引き上げない。

### Contextをcacheしない

解決したcontextをeditor lifecycleをまたぐcacheとして扱わない。現在のlifecycleで利用できない場合に過去のcontextへfallbackしないことで、staleなbrowsing contextを利用する状態を防ぐ。

## 10. Quality Requirements

- `QR-02`で保証対象とするEditor環境において、利用側が環境ごとのbrowsing context差を独自に扱わずDOM / Web APIを利用できる境界を提供する。
- editor lifecycleの変化によって過去のcontextが無効になった場合でも、そのcontextを現在のcontextとして再利用しない。
- context解決自体が並び替え方向固有の状態やTableデータを保持することで不要なLifecycle couplingを生まない。

## 11. Risks and Technical Debt

- WordPress Editor側のcontext構成が変化した場合、context解決方式の更新が必要になる可能性がある。ただし、その変更を行並び替えまたは列並び替えのArchitectureへ波及させないことを本境界で維持する。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| editor DOM context | 現在のeditor lifecycleでDOM / Web APIを利用するために必要なdocument / window等の実行context。具体的な取得方法はArchitectureでは固定しない。 |
| editor lifecycle | Editorのmount、unmount、remount、browsing context変更などにより、以前のDOM contextの有効性を継続して前提にできなくなる期間境界。 |
