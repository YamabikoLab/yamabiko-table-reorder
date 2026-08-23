# Editor Environment

## はじめに

WordPress では、エディターを iframe 内で動かす取り組みが段階的に進められてきました。WordPress 7.1 では、その流れの中で投稿エディターも常に iframe 内で動作するようになります。

[Iframed Editor Changes in WordPress 7.1](https://make.wordpress.org/core/2026/08/03/iframed-editor-changes-in-wordpress-7-1/) では、この変更の背景と、ブロックやエディター拡張を iframe 内でも正しく動かすための考え方が分かりやすく整理されています。

iframe 内の編集領域には、管理画面とは別の `document` と `window` があります。そのため、エディター内部の要素を扱うときは、グローバルな `document` / `window` ではなく、対象要素の `ownerDocument` や `defaultView` から適切な context を取得することが重要になります。

この考え方を前提に、今回の PoC ではもう一つ設計上の問いを立てました。

> [!IMPORTANT]
> iframe / non-iframe の違いを正しく扱いながら、その違いを各機能が毎回意識しなくてもよい形にできないか？

これは WordPress 7.1 だけのための対応ではありません。

Table Reorder はこれまでも iframe / non-iframe の両方で動作してきました。今回検証したのは、その **editor browsing context の違いを、製品コードの中でどのように扱うと分かりやすく保てるか** です。

Table Reorder を実際の題材として試した結果、**今回の PoC では、その違いを小さな境界へ集約しながら、iframe / non-iframe の両方を正常に動かすことができました。**

## 1. iframe / non-iframe 対応で見えてきた課題

iframe editor を扱うときは、「どの `document` と `window` を使うべきか」を正しく判断する必要があります。

たとえば、エディター内のボタンや表を操作したいとします。

non-iframe では、編集領域が管理画面と同じ `document` にあります。一方、iframe では編集領域が別の `document` にあります。

そのため、対象となる DOM 要素がどの document に属しているかを基準に、適切な context を利用する必要があります。

WordPress の公式記事では、この違いを安全に扱うための方法が示されています。各機能がその考え方に沿って実装すれば、iframe 内でも正しく動作できます。

### ここで考えたいこと

Table Reorder の PoC で着目したのは、**その判断を製品コードのどこに置くか**です。

同じ種類の判断を複数の機能がそれぞれ持つようになると、たとえば次のような形になります。

<img width="1448" height="1086" alt="iframe-problem" src="https://github.com/user-attachments/assets/cdb02345-d9fa-4f7a-8f4f-a3dab6d59ad4" />

```text
並べ替え機能
  ├─ iframe / non-iframe を判定する
  ├─ 正しい document を探す
  ├─ 正しい window を探す
  └─ 本来の並べ替え処理を書く

別の機能
  ├─ iframe / non-iframe を判定する
  ├─ 正しい document を探す
  ├─ 正しい window を探す
  └─ 本来の機能を書く
```

これは間違った実装という意味ではありません。

ただ、機能が増えるにつれて **editor browsing context をどう解決するかという知識が、製品コードの複数箇所へ広がっていく可能性があります。**

そこで今回の PoC では、その知識を一か所へまとめられないかを試しました。

### イメージで捉えると

WordPress の編集画面の中に、もう一つ別の「作業部屋」があると考えると分かりやすくなります。

機能を作るたびに、開発者が毎回、

> [!WARNING]
> 今いるのは外の部屋か、中の部屋か？

を確認することもできます。

今回試したのは、その確認を各機能で繰り返すのではなく、**「今使うべき作業部屋はどこか」を案内する役割を一か所にまとめる**方法です。

### 公式プラクティスを正しく適用するために

WordPress の公式記事では、この違いを安全に扱うための方法が示されています。この考え方自体は正しく、対象となる DOM 要素の `ownerDocument` や `defaultView` を使うことで、その要素が属する browsing context を正しく扱えます。

ただし、実際の機能では **その前提を正しく扱わないと、別の browsing context を参照してしまう場合があります。**

たとえば、処理の起点となる要素は管理画面側の document にある一方で、実際に操作したい block は iframe 内にあるかもしれません。その場合、起点となる要素の `ownerDocument` だけを使って対象 block を探しても見つかりません。

また、一度取得した iframe の `document` や `window` を保持し続けると、iframe が再生成されたあとに古い browsing context を参照してしまう可能性もあります。

つまり、公式プラクティスが危険なのではありません。**公式プラクティスを正しく適用するためには、「今どの editor browsing context を使うべきか」という判断も正しく行う必要があります。**

Table Reorder の PoC では、この判断を各機能に任せるのではなく、Editor Environment へ集約できないかを試しました。

<img width="1484" height="1060" alt="problems" src="https://github.com/user-attachments/assets/b6e0289a-946d-4da1-8cc0-ddeb24c3d7ca" />

### WordPress / Gutenberg の実例から見える設計上のポイント

iframe を利用するエディターでは、browsing context や iframe lifecycle によって、通常の DOM 操作ではあまり意識しない状態が発生することがあります。

WordPress / Gutenberg でも、こうしたケースへの対応が重ねられてきました。

> [!CAUTION]
> * **iframe の unmount 後は `contentWindow` が利用できないことがある**

  * Site Editor では、preview iframe の unmount 後に cleanup が実行された際、すでに iframe が DOM から外れていたため `contentWindow` が `null` となるケースがありました。
  * iframe の lifecycle をまたぐ処理では、参照している browsing context がまだ有効かどうかを考慮する必要があることが分かります。
  * [Gutenberg PR #59992: Block Editor: fix crash when unmounting an editor iframe](https://github.com/WordPress/gutenberg/pull/59992)

> [!CAUTION]
> * **エディターの browsing context は操作の途中で変わることがある**

  * non-iframe で動作している投稿エディターでも、Patterns タブを開いて Zoom Out が有効になることで、iframe として動作するケースがありました。
  * これは、**一度判定した editor context が、その後も同じとは限らない**ことを示しています。
  * [Gutenberg Issue #66671: Zoom out: Pattern inserter always forces iframe editor](https://github.com/WordPress/gutenberg/issues/66671)

> [!CAUTION]
> * **DOM 要素が残っていても、その browsing context が有効とは限らない**

  * WordPress 7.0 では、iframe の teardown / recreation の途中で、以前の iframe に属していた DOM 要素が一時的に残り、その `ownerDocument.defaultView` がすでに `null` になっているケースがありました。
  * DOM 要素そのものが存在していても、その `document` / `window` が現在も利用可能とは限らないことが分かります。
  * [Gutenberg Issue #79118: Block editor crashes on pattern insertion](https://github.com/WordPress/gutenberg/issues/79118)

> [!IMPORTANT]
> これらは、Editor Environment が過去の個別の問題をそのまま解決する、という意味ではありません。
> 
> 重要なのは、これらの実例から、
> 
> * editor context は途中で変化する可能性がある
> * iframe の lifecycle によって古い context が無効になることがある
> * DOM 要素が存在していても、その browsing context が有効とは限らない
> 
> という性質が見えてくることです。
> 
> Editor Environment は、こうした性質を前提として、**その時点で利用すべき editor browsing context を都度解決するための小さな境界**として設計しています。


## 2. 解決策: Editor Environment

今回の PoC では、iframe / non-iframe の違いを判断する役割を **Editor Environment** という小さな境界へ集約しました。

考え方は単純です。

<img width="1448" height="1086" alt="solution-editor-environment" src="https://github.com/user-attachments/assets/9562c7a9-38d6-4549-8d02-ae17360c42c4" />

```text
Before

製品コード
  ├─ iframe / non-iframe を判断する
  ├─ document を選ぶ
  ├─ window を選ぶ
  └─ 本来の機能を書く


After

製品コード
      |
      v
Editor Environment
      |
      ├─ iframe / non-iframe を判断する
      └─ 正しい document / window を返す
```

製品コードは、iframe の構造を直接調べません。

必要になったときに Editor Environment から「現在のエディターで使うべき `document` と `window`」を受け取ります。

> [!IMPORTANT]
> 今回の実装で Editor Environment が提供するものは、この2つだけです。

```ts
type EditorEnvironment = {
	document: Document;
	window: Window;
};
```

当初は `root` や `scrollContainer` まで必要になる可能性も考えていましたが、実際に試したところ、そこまで抽象化する必要はありませんでした。

### Editor Environment の仕様

> [!IMPORTANT]
> Editor Environment は、**現在のエディターで利用すべき browsing context を解決するための境界**です。
> 
> 仕様は次のとおりです。

* **現在のエディターで使うべき `document` と `window` を返す**

  * 呼び出し側は iframe / non-iframe の違いを判断する必要がありません。

* **non-iframe と iframe の両方に対応する**

  * 対象ブロックが通常の document に存在すれば、その context を利用します。
  * 存在しない場合は editor iframe 内を探索します。

* **対象ブロックが存在する context だけを有効とする**

  * iframe が存在するだけでは採用しません。
  * 対象となるブロックが、その document 内に実際に存在することを確認します。

* **`document` と `window` は同じ browsing context の組み合わせで返す**

  * 異なる context の `document` と `window` が混ざることを防ぎます。

* **正しい context を解決できない場合は `null` を返す**

  * 不完全な状態を推測で補わず、安全に処理を中止できるようにします。

* **解決結果は保持しない**

  * 呼び出されるたびに、その resolve 時点での current editor context を解決します。
  * 返される `document` / `window` は、resolve 時点で current な browsing context を表します。
  * 返却済みの `document` / `window` が、その後の iframe teardown / recreation をまたいで current であり続けることは保証しません。
  * editor context が変化し得る場合は、必要に応じて再度 resolve します。

* **担当するのは editor context の探索だけ**

  * `focus()`、スクロール、DOM traversal などの標準 Web API はラップしません。
  * Editor Environment が引き受けるのは、**「現在どの browsing context を使うべきかを判断する責務」だけ**です。

> [!IMPORTANT]
> つまり Editor Environment は、  
> **対象ブロックが存在する現在の editor browsing context を安全に解決し、その `document` と `window` を返す。解決できない場合は `null` を返し、解決結果は保持しない。**  
> という小さな仕様を持つ境界です。

<img width="1448" height="1086" alt="editor-environment-spec" src="https://github.com/user-attachments/assets/fbf83f46-d79d-4c1a-9cd7-682f4f310f7d" />

### PoC の結果

**この方式で iframe / non-iframe の両方が正常に動作しました。**

さらに、iframe 固有の処理を1か所へ集約しても、既存の controller、drag UI、キーボード操作、タッチ操作、フォーカス、スクロール処理を書き換える必要はありませんでした。

これは今回の PoC で特に重要な結果です。

### イメージで捉えると

各機能が自分で「どの部屋にいるか」を調べるのをやめて、入口に案内係を置いた形です。

```text
機能
  ↓
「今使うべき編集画面はどこ？」
  ↓
Editor Environment
  ↓
「こちらです」
```

機能側は、案内された場所で本来の仕事をすればよくなります。

## 3. この仕組みで何が嬉しいのか

Editor Environment の目的は、単に iframe 対応コードを別ファイルへ移すことではありません。

### 「iframe 対応 = 全コードの書き換え」ではない

今回の PoC で一番大きな成果は、次の一点です。

> **iframe 対応の知識を、わずか1ファイル（`editor-environment.ts`）だけに完全に幽閉できる。**

ここでいう「iframe 対応の知識」とは、iframe / non-iframe の違いを判断し、現在使うべき editor `document` / `window` を解決するための知識です。

少なくとも今回の Table Reorder では、WordPress 7.1 でエディターが iframe 化されても、既存の製品コード全体を iframe 対応へ書き換える必要はありませんでした。

実際に変更が必要だった既存 production module は `table-context.ts` の1つだけです。既存の controller、drag UI、キーボード操作、タッチ操作、フォーカス、スクロール処理は、そのまま動かすことができました。

つまり、

```text
iframe 化
  ↓
既存機能をすべて iframe 対応へ書き換える
```

のではなく、

```text
iframe 化
  ↓
iframe 対応の知識を editor-environment.ts に幽閉する
  ↓
既存の製品コードは、本来の機能に集中する
```

という形にできます。

### 機能を書くコードを、本来の仕事へ集中させられる

たとえば行の並べ替えを実装するとき、本来考えたいのは次のようなことです。

- どの行を移動するか
- どこへ移動するか
- キーボードでどう操作するか
- タッチ操作をどう扱うか
- フォーカスをどこへ戻すか
- スクロールをどう扱うか

ここへ「iframe かどうか」を混ぜる必要がなくなります。

各機能を実装するたびに「今は iframe か」「どの `document` を使うか」を考えるのではなく、Editor Environment に問い合わせればよくなります。

目指しているのは、次の変化です。

> [!IMPORTANT]
> **「iframe 対応を書くコード」から、「普通の機能を書くコード」へ寄せる**

開発者は iframe / non-iframe の違いではなく、ドラッグ＆ドロップやキーボード操作など、その機能本来の問題に集中できます。

### editor context の変化による影響を狭くできる

将来、WordPress のエディター内部構造や browsing context の扱いが変わった場合でも、editor context の解決に関する知識が1か所にまとまっていれば、まず Editor Environment を確認できます。

製品コード全体から iframe / non-iframe の判定箇所を探し回る必要を減らせます。

### テストの責務を分けやすくなる

「並べ替え機能が正しいか」と「正しい editor context を取得できるか」は、別の問題です。

Editor Environment を境界にすることで、将来的には次のように整理しやすくなります。

```text
製品機能のテスト
  └─ 並べ替え、キーボード、タッチ、フォーカスなど

Editor Environment のテスト
  └─ iframe / non-iframe、lifecycle など
```

ただし、今回の PoC だけを理由に iframe / non-iframe の E2E をすぐ削除するものではありません。テスト構成の整理は、PoC の成果を踏まえた次の検討事項です。

### Web API は普通に使える

Editor Environment は、Web ブラウザーそのものを隠すための仕組みではありません。

次のような標準 Web API は、これまで通り必要な場所で直接使います。

- `ownerDocument`
- `defaultView`
- `focus()`
- `getBoundingClientRect()`
- `getComputedStyle()`
- `Selection`
- `Range`
- observers
- DOM traversal
- scrolling

重要なのは、`ownerDocument` や `defaultView` を禁止することではありません。

**「現在のエディターがどの browsing context なのかを探す責務」だけを Editor Environment に集める**ことです。

## 4. Table Reorder とは

今回の PoC では、Yamabiko Table Reorder を実証用の製品コードとして使用しました。

Table Reorder は、WordPress の表の行を並べ替えるためのプラグインです。

<img width="1240" height="724" alt="yamabiko-table-reorder" src="https://github.com/user-attachments/assets/55a3d312-188e-4780-810d-74d82a653c63" />

マウスだけでなく、タッチ操作やキーボード操作でも利用できるように実装されています。

行の並べ替えでは、単にデータの順番を変更するだけではありません。

実際には、次のようなブラウザー機能と深く関わります。

- DOM 要素の探索
- ドラッグ＆ドロップ
- pointer / touch interaction
- keyboard interaction
- focus
- scroll
- 一時的な DOM 操作と cleanup

そのため、iframe の影響を受けやすい機能が複数含まれています。

つまり Table Reorder は、

> [!NOTE]
> Editor Environment が実際の製品コードでも成立するか

を試す題材として適していました。

## 5. Table Reorder で何を変更したのか

PoC 前は、`table-context.ts` が2つの責務を持っていました。

```text
table-context.ts
  ├─ iframe / non-iframe の editor context を探す
  └─ Table block / table / tbody を探す
```

PoC 後は、次のように分離しました。

```text
Table Reorder
      |
      v
table-context.ts
      |
      | Table 固有の DOM を解決
      v
editor-environment.ts
      |
      | 現在の document / window を解決
      v
iframe / non-iframe editor
```

`editor-environment.ts` は editor browsing context の discovery だけを担当します。

`table-context.ts` は、解決済みの `document` の中から Table block、`table`、`tbody` を探すことだけに集中します。

この分離によって、Table Reorder の他の実装へ iframe 固有処理を広げずに済みました。

## 6. PoC の成果を数字で見る

今回の結果は、単に「動いた」という感想だけではなく、いくつかの数字で確認できます。

| 指標                                                             | 結果                        |
| ---------------------------------------------------------------- | --------------------------- |
| WordPress 7.1 iframe E2E                                         | PASS                        |
| WordPress 6.8.3 non-iframe E2E                                   | PASS                        |
| ローカル iframe 確認                                             | PASS                        |
| ローカル non-iframe 確認                                         | PASS                        |
| iframe 固有知識を持つ production module                          | 1 (`editor-environment.ts`) |
| Editor Environment 外の `contentDocument` / `contentWindow` 参照 | 0                           |
| 変更が必要だった既存 production module                           | 1 (`table-context.ts`)      |
| Editor Environment が公開する capability                         | 2 (`document`, `window`)    |
| 新しく追加した browser API wrapper                               | 0                           |
| Editor Environment 対応のため変更が必要だった既存 consumer       | 0                           |
| iframe 再生成の focused test                                     | PASS                        |

この中で特に重要なのは、コードの行数ではありません。

次の3点です。

1. **iframe 固有の知識を1つの production module に集約できた**
2. **既存 consumer を Editor Environment 対応に書き換える必要がなかった**
3. **普通の Web API を包む新しい wrapper を増やさずに済んだ**

つまり、小さな境界を追加しただけで、既存の製品コードの大部分はそのまま動きました。

## 7. iframe 固有コードが漏れていないか確認する方法

production code に iframe 固有処理が増えていないかは、次の検索で確認できます。

```bash
rg 'contentDocument|contentWindow|iframe\[name="editor-canvas"\]' src \
  --glob '*.ts' \
  --glob '*.tsx' \
  --glob '!**/*.test.*'
```

現在の期待結果は `src/editor-environment.ts` だけです。

`contentDocument` / `contentWindow` の直接利用だけを見る場合は、次の検索を使えます。

```bash
rg -l 'contentDocument|contentWindow' src \
  --glob '*.ts' \
  --glob '*.tsx' \
  --glob '!**/*.test.*'
```

こちらも期待結果は `src/editor-environment.ts` だけです。

これは `ownerDocument` / `defaultView` の通常利用まで禁止するためのチェックではありません。

目的は、**editor browsing-context discovery が再び製品コード全体へ広がっていないかを見ること**です。

## 8. iframe の作り直しにも古い context を残さない

iframe は、エディターの lifecycle の中で破棄・再生成される可能性があります。

もし Editor Environment が古い `document` や `window` をずっと cache してしまうと、すでに使われていない iframe を参照し続ける危険があります。

今回の resolver は stateless にしました。

呼び出されるたびに、現在の editor context を解決します。

focused test では次を確認しています。

1. 最初の iframe を解決する
2. その iframe を削除する
3. 新しい iframe を作る
4. もう一度解決する
5. 古い iframe ではなく、新しい iframe の `document` / `window` が返ることを確認する

このテストは PASS しています。

一方で、Gutenberg 自身に実ブラウザー上で iframe teardown / recreation を強制する専用 E2E は、今回の PoC にはまだ含めていません。

これは今後さらに lifecycle coverage を強化する場合の候補です。

## 9. 検証結果

GitHub Actions:

- https://github.com/YamabikoLab/yamabiko-table-reorder/actions/runs/32609568439

この CI では、次を含む検証が成功しました。

- Node.js quality checks
- production build
- PHP checks
- WordPress 7.1 iframe E2E
- WordPress 6.8.3 non-iframe E2E

さらにローカル環境でも、iframe / non-iframe の両方で Table Reorder の正常動作を確認しました。

## 10. この PoC で分かったこと

今回の実験から、少なくとも Table Reorder では、次のことが確認できました。

> [!IMPORTANT]
> iframe / non-iframe の detection、discovery、lifecycle concern を小さな境界へ集約しても、残りの製品コードはほぼそのまま通常の Web コードとして動かせる。

これは、Editor Environment を「Web を隠す abstraction」として作る必要がないことも示しています。

今回成立した境界は、もっと小さなものです。

> [!NOTE]
> **どの editor context を使うべきかだけを案内する薄い boundary**

Editor Environment が iframe を知っています。

Table Reorder の並べ替えロジック、キーボード処理、タッチ処理、フォーカス処理、スクロール処理などは、その事実を知る必要がありません。

今回の PoC の中心的な成果はここにあります。

## 11. この PoC だけではまだ分からないこと

今回の結果だけで、次のことまで決定したわけではありません。

- non-iframe E2E を削除できるか
- Editor Environment を standalone package にすべきか
- 他の WordPress プラグインでも同じ abstraction がそのまま有効か
- WordPress / Gutenberg の public API として成立するか
- 将来必要な capability が増えても、この境界を小さく保てるか

これらは、今回得られた結果を基準にして次に検討できます。

特に重要なのは、今後 capability が必要になるたびに Editor Environment を巨大化させないことです。

Editor Environment の役割は、あくまで editor context の案内役です。

## まとめ

iframe editor を扱うには、適切な editor `document` / `window` を参照する必要があります。

WordPress の公式記事では、そのための考え方と実装上のポイントが整理されています。今回の PoC はその知見を前提として、**iframe / non-iframe の違いを製品コードのどこで扱うとよいか**を検証したものです。

Table Reorder で試した結果、iframe 固有の discovery を Editor Environment という1つの薄い境界へ集約しながら、既存の製品コードの大部分を変更せず、iframe / non-iframe の両方で正常に動かすことができました。

```text
製品コード
  |
  | 普通の DOM / Web API を使う
  v
本来の機能
  |
  | editor context が必要なときだけ問い合わせる
  v
Editor Environment
  |
  | iframe / non-iframe の違いを吸収する
  v
WordPress Editor
```

目指しているのは、iframe をなくすことではありません。

**iframe が存在していても、製品コードの大部分は iframe を知らなくてよい状態にすること**です。

今回の PoC は、その方向が Table Reorder の実製品コードで成立することを示しました。

## References

- [Iframed Editor Changes in WordPress 7.1](https://make.wordpress.org/core/2026/08/03/iframed-editor-changes-in-wordpress-7-1/)
- Issue #430: PoC: isolate editor browsing context behind an Editor Environment
- PR #441: PoC implementation
- `docs/plans/table-reorder/editor-environment-poc-plan.md`: PoC implementation plan
- `src/editor-environment.ts`: editor browsing-context boundary
- `src/table-context.ts`: Table-specific DOM resolution