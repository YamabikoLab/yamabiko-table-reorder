# YTR v1 source

`src/`は、正式v1のArchitectureで定義した責務を実装へ割り当てるactive source boundaryです。ファイル数を減らすことよりも、どの責務がどこに属し、どのContractを通じて協調するのかを追いやすくすることを優先します。

Prototypeの構成を維持するための互換境界は置きません。過去の実装を参照する必要がある場合は`prototype-final`tagを利用し、正式v1の責務境界は現在のArchitectureから判断します。

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
│   └── table-structure.ts
├── row-reorder/
│   ├── drop-target-resolution.ts
│   └── data-update.ts
└── column-reorder/
    ├── drop-target-resolution.ts
    └── data-update.ts
```

- `reorder/`は、行・列で共有するReorder Mode、Reorder Session、Drop Target Resolution、Data Update、Table StructureのContractと共通ルールを所有します。行・列固有の判断はここへ混在させず、共通入口から各featureへ委譲します。
- `row-reorder/`は、rowspanを壊さない移動先判定やbodyの行順更新など、行並び替えだけが持つ責務を所有します。
- `column-reorder/`は、colspanを壊さない移動先判定や全sectionを同じlogical column移動として更新する責務を所有します。
- `index.tsx`や`messages.ts`のようにplugin全体へ属する責務は、Reorderのfeature境界へ無理に含めず`src/`直下に置きます。

テストは検証対象の責務と同じdirectoryへ配置します。新しいdirectoryや共通化は、正式v1で独立した責務または共有Contractが成立した場合にだけ追加します。
