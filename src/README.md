# YTR v1 source

`src/`には、正式v1の責務ごとに製品コードを配置します。ファイル数を減らすことよりも、どの責務がどこにあり、どの共通仕様を介して協調するかを追いやすくすることを優先します。

過去の試作版と同じ構成を維持するための互換層は置きません。過去の実装を参照する必要がある場合は`prototype-final`タグを利用し、正式v1の責務境界は現在のアーキテクチャ文書を基準にします。

```text
src/
├── AGENTS.md
├── README.md
├── index.tsx
├── messages.ts
├── reorder/
│   ├── reorder-mode.ts
│   ├── dnd-interaction.ts
│   ├── drop-target-resolution.ts
│   ├── drop-target-rules.ts
│   ├── data-update.ts
│   ├── data-update-rules.ts
│   ├── table-block-adapter.ts
│   └── table-structure.ts
├── row-reorder/
│   ├── drop-target-resolution.ts
│   └── data-update.ts
└── column-reorder/
    ├── drop-target-resolution.ts
    └── data-update.ts
```

- `reorder/`は、行・列で共有する操作状態、並び替え操作、移動先判定、データ更新、テーブル保存形式の変換、テーブル構造を所有します。対応テーブル固有の保存形式は変換境界へ閉じ込め、共通処理へブロック別の条件分岐を持ち込みません。行・列に固有の規則は、それぞれの機能へ委ねます。
- `row-reorder/`は、rowspanを壊さない移動先判定やテーブル本体の行順更新など、行並び替えだけが持つ責務を所有します。
- `column-reorder/`は、colspanを壊さない移動先判定や、テーブル全体で同じ列移動を適用する責務を所有します。
- `index.tsx`や`messages.ts`のようにプラグイン全体へ属する責務は、並び替え機能の内部へ無理に含めず`src/`直下に置きます。

テストは検証対象の責務と同じディレクトリへ配置します。新しいディレクトリや共通化は、正式v1で独立した責務または共有する理由が明確になった場合にだけ追加します。
