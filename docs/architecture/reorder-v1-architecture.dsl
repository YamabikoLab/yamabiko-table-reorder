// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "QR-02で保証対象とする編集環境を提供する。" {
			tags "External Context,External System"
		}
		EXT_SUPPORTED_TABLE_BLOCK = element "Supported Table Block" "External Block" "FR-13で定義される対応Table Block。Table Integrationを介してReorder coreと接続する。" {
			tags "External Context,External Block"
		}
		EXT_WORDPRESS_UNDO = element "WordPress Undo" "External Capability" "成立した1回の並び替えを1回のUndoで戻せる更新単位を提供する。" {
			tags "External Context,External Capability"
		}
		EXT_SCROLL_AREA = element "Editor Scroll Area" "External Environment" "DnD中にTableまたは編集画面を必要な方向へ自動スクロールする対象領域を提供する。" {
			tags "External Context,External Environment"
		}

		RESP_REORDER_MODE = element "Reorder Mode" "Responsibility" "通常のTable編集、行並び替え、列並び替えのどの状態にあるかを管理し、現在のモードに応じたDnD開始可否を提供する。" {
			tags "Responsibility"
		}
		RESP_FIRST_USE_GUIDANCE = element "First-use Guidance" "Responsibility" "PCとタッチ端末ごとの初回案内の表示状態を管理し、並び替えの入口を利用者に案内する。" {
			tags "Responsibility"
		}
		RESP_REORDER_REDISCOVERY = element "Reorder Rediscovery" "Responsibility" "通常編集状態で並び替えを試みていると考えられる操作の繰り返しを判定し、必要な場合だけ並び替えの入口を再案内する。" {
			tags "Responsibility"
		}
		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在のeditor contextに属する基準から、その時点で利用すべきDOM / Web API contextを解決し、必要とする責務へ提供する。" {
			tags "Responsibility"
		}
		RESP_TABLE_INTEGRATION = element "Table Integration" "Responsibility" "対応Table BlockとReorder coreの境界を担い、Block固有のTable構造取得およびデータ更新方法をReorder coreから隠蔽する。" {
			tags "Responsibility"
		}
		RESP_INPUT_INTERACTION = element "Input Interaction" "Responsibility" "PCとタッチ端末の入力固有の差を共通のDnD進行から分離し、開始試行・進行・完了・キャンセルとしてDnD Interactionへ渡す境界を担う。" {
			tags "Responsibility"
		}
		RESP_DND_INTERACTION = element "DnD Interaction" "Responsibility" "入力方式と行・列に共通するDnDをReorder operation boundaryとして統括し、成立したReorder Sessionを管理して、確定または安全な終了へ導く。" {
			tags "Responsibility"
		}
		RESP_REORDER_TARGET_RESOLUTION = element "Reorder Target Resolution" "Responsibility" "DnD開始試行時、行では共通Table structure上のbody section、列ではTable全体から移動対象を解決し、対応する構造保持に必要な制約情報を導出する。" {
			tags "Responsibility"
		}
		RESP_DROP_TARGET_RESOLUTION = element "Drop Target Resolution" "Responsibility" "DnD Interactionから渡された判定入力だけを使い、行ではbody section内の行間、列ではTable全体の列間から有効な移動先を判定する。" {
			tags "Responsibility"
		}
		RESP_REORDER_PRESENTATION = element "Reorder Presentation" "Responsibility" "移動不可理由、およびDnD開始後の現在の移動対象から確定・キャンセル・abortまでの視覚フィードバックをTableデータ更新から分離して扱う。" {
			tags "Responsibility"
		}
		RESP_AUTO_SCROLL = element "Auto Scroll" "Responsibility" "DnD中に、行では縦方向、列では横方向だけを移動のための自動スクロール対象とし、DnD終了時に一時状態を破棄する。" {
			tags "Responsibility"
		}
		RESP_DATA_UPDATE = element "Data Update" "Responsibility" "確定した並び替えを1つの更新単位としてTableに反映し、保持すべきセル情報とUndo単位を維持する。" {
			tags "Responsibility"
		}

		DEP_001 = RESP_FIRST_USE_GUIDANCE -> EXT_WORDPRESS_EDITOR "初回案内の表示契機となる編集環境の状態を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_002 = RESP_FIRST_USE_GUIDANCE -> RESP_EDITOR_DOM_CONTEXT "初回案内でDOM / Web APIを利用するため、現在のeditor contextを必要とする。" {
			tags "Structural Dependency"
		}
		DEP_003 = RESP_REORDER_REDISCOVERY -> EXT_WORDPRESS_EDITOR "通常編集と並び替え試行候補を区別する編集環境の情報を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_004 = RESP_REORDER_REDISCOVERY -> RESP_EDITOR_DOM_CONTEXT "再案内判定でDOM / Web APIを利用するため、現在のeditor contextを必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_REORDER_REDISCOVERY -> RESP_FIRST_USE_GUIDANCE "初回案内が表示済みであることを再案内判定の前提として必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_REORDER_REDISCOVERY -> RESP_REORDER_MODE "通常編集状態でだけ再案内判定を行うため、現在の並び替え状態を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_EDITOR_DOM_CONTEXT -> EXT_WORDPRESS_EDITOR "現在のeditor contextを解決するため、現在のWordPress Editorを必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "FR-13で定義される対応Table Block固有の構造取得およびデータ更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_INPUT_INTERACTION -> EXT_WORDPRESS_EDITOR "PCまたはタッチ端末の入力を共通のDnD意味へ変換するため、編集環境の入力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_INPUT_INTERACTION -> RESP_EDITOR_DOM_CONTEXT "入力解釈でDOM / Web APIを利用するため、現在のeditor contextを必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_INPUT_INTERACTION -> RESP_REORDER_MODE "並び替えモード中の入力を解釈するため、現在の並び替え状態を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_DND_INTERACTION -> RESP_REORDER_MODE "DnD開始時に使用する現在の並び替え方向を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_DND_INTERACTION -> RESP_REORDER_TARGET_RESOLUTION "DnDを開始できる移動対象と、そのDnDで利用する制約情報の解決能力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_DND_INTERACTION -> RESP_DROP_TARGET_RESOLUTION "開始済みDnDの現在位置が有効な移動先かを判定する能力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_DND_INTERACTION -> RESP_DATA_UPDATE "確定した並び替えをTableデータへ反映し、その結果をReorder operation boundaryへ返す能力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_REORDER_TARGET_RESOLUTION -> RESP_TABLE_INTEGRATION "移動対象判定と制約情報導出に使用する現在の共通Table structureを必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_REORDER_PRESENTATION -> RESP_EDITOR_DOM_CONTEXT "表示処理でDOM / Web APIを利用するため、現在のeditor contextを必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_REORDER_PRESENTATION -> RESP_DND_INTERACTION "移動不可理由、DnDの進行状態、確定結果、キャンセル結果、abort結果を表示状態へ反映するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_AUTO_SCROLL -> RESP_DND_INTERACTION "activeなDnD、並び替え方向、およびDnD終了状態を自動スクロール判断に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_AUTO_SCROLL -> RESP_EDITOR_DOM_CONTEXT "自動スクロールでDOM / Web APIを利用するため、現在のeditor contextを必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = RESP_AUTO_SCROLL -> EXT_SCROLL_AREA "DnD中に移動方向へスクロールできる外部領域を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_022 = RESP_DATA_UPDATE -> RESP_TABLE_INTEGRATION "確定した並び替えを対応Table Block固有の方法で反映する能力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_023 = RESP_DATA_UPDATE -> EXT_WORDPRESS_UNDO "成立した1回の並び替えを1回で戻せる更新単位を維持するため、Undoの仕組みを必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_INPUT_INTERACTION "WordPress Editorの入力がYTRの共通Reorder処理へ入る。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_END_TO_END,ProcessFlowEdge_normal"
		}
		PF_002 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "入力方式固有の解釈から、共通のDnD処理へ進む。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_END_TO_END,ProcessFlowEdge_normal"
		}
		PF_003 = RESP_DND_INTERACTION -> RESP_REORDER_TARGET_RESOLUTION "DnD開始試行から、移動対象と制約情報の解決へ進む。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_END_TO_END,ProcessFlowEdge_normal"
		}
		PF_004 = RESP_REORDER_TARGET_RESOLUTION -> RESP_DROP_TARGET_RESOLUTION "解決された移動対象と制約情報を前提に、開始後の移動先判定へ進む。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_END_TO_END,ProcessFlowEdge_normal"
		}
		PF_005 = RESP_DROP_TARGET_RESOLUTION -> RESP_DATA_UPDATE "有効な移動先でDnDが完了した場合、確定した並び替えの反映へ進む。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_END_TO_END,ProcessFlowEdge_normal"
		}
		PF_006 = RESP_DATA_UPDATE -> RESP_TABLE_INTEGRATION "確定した並び替えを対応Table Block固有の更新境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_END_TO_END,ProcessFlowEdge_normal"
		}
		PF_007 = RESP_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "FR-13で定義される対応Table Blockへ、そのBlock固有の方法でTableデータを反映する。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_END_TO_END,ProcessFlowEdge_normal"
		}
		PF_008 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "[failure] 外部環境の変化などによりactiveなReorder操作を継続できない状態をReorder operation boundaryへ合流させる。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_INPUT_FAILURE_RECOVERY,ProcessFlowEdge_failure"
		}
		PF_009 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "[recovery] 共通abortとしてDnD表示の一時状態を終了する。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_INPUT_FAILURE_RECOVERY,ProcessFlow_PV_REORDER_DROP_TARGET_FAILURE_RECOVERY,ProcessFlow_PV_REORDER_DATA_UPDATE_FAILURE_RECOVERY,ProcessFlowEdge_recovery"
		}
		PF_010 = RESP_DND_INTERACTION -> RESP_AUTO_SCROLL "[recovery] 共通abortとして自動スクロールの一時状態を終了する。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_INPUT_FAILURE_RECOVERY,ProcessFlow_PV_REORDER_DROP_TARGET_FAILURE_RECOVERY,ProcessFlow_PV_REORDER_DATA_UPDATE_FAILURE_RECOVERY,ProcessFlowEdge_recovery"
		}
		PF_011 = RESP_DND_INTERACTION -> RESP_INPUT_INTERACTION "[recovery] 共通abortとして入力解釈の一時状態を終了する。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_INPUT_FAILURE_RECOVERY,ProcessFlow_PV_REORDER_DROP_TARGET_FAILURE_RECOVERY,ProcessFlow_PV_REORDER_DATA_UPDATE_FAILURE_RECOVERY,ProcessFlowEdge_recovery"
		}
		PF_012 = RESP_DROP_TARGET_RESOLUTION -> RESP_DND_INTERACTION "[failure] DnD進行中に検出されたReorder内部のContract / Invariant不整合をReorder operation boundaryへ合流させる。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_DROP_TARGET_FAILURE_RECOVERY,ProcessFlowEdge_failure"
		}
		PF_013 = RESP_DATA_UPDATE -> RESP_DND_INTERACTION "[failure] Table更新を継続または確認できない結果をReorder operation boundaryへ返し、共通abortへ合流させる。" {
			tags "Process Flow,ProcessFlow_PV_REORDER_DATA_UPDATE_FAILURE_RECOVERY,ProcessFlowEdge_failure"
		}

		RT_001 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "開始対象を含むDnD開始試行をReorder operation boundaryへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.1" "開始対象を含むDnD開始試行をReorder operation boundaryへ渡す。"
				"runtime.RV_DND_START_IMMOVABLE.step.1" "開始対象を含むDnD開始試行をReorder operation boundaryへ渡す。"
			}
		}
		RT_002 = RESP_REORDER_MODE -> RESP_DND_INTERACTION "現在の並び替え方向を提供する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.2" "現在の並び替え方向を提供する。"
				"runtime.RV_DND_START_IMMOVABLE.step.2" "現在の並び替え方向を提供する。"
			}
		}
		RT_003 = RESP_DND_INTERACTION -> RESP_REORDER_TARGET_RESOLUTION "開始対象と並び替え方向に対する移動対象解決を要求する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.3" "開始対象と並び替え方向に対する移動対象解決を要求する。"
				"runtime.RV_DND_START_IMMOVABLE.step.3" "開始対象と並び替え方向に対する移動対象解決を要求する。"
			}
		}
		RT_004 = RESP_REORDER_TARGET_RESOLUTION -> RESP_TABLE_INTEGRATION "対象Tableの要求時点の共通Table structureを要求する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.4" "対象Tableの要求時点の共通Table structureを要求する。"
				"runtime.RV_DND_START_IMMOVABLE.step.4" "対象Tableの要求時点の共通Table structureを要求する。"
			}
		}
		RT_005 = RESP_REORDER_TARGET_RESOLUTION -> RESP_DND_INTERACTION "移動対象と、そのDnDで利用する制約情報が解決されたことを通知する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.5" "移動対象と、そのDnDで利用する制約情報が解決されたことを通知する。"
			}
		}
		RT_006 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "DnDが開始した現在の移動対象と進行状態を提供し、移動対象表示を開始させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.6" "DnDが開始した現在の移動対象と進行状態を提供し、移動対象表示を開始させる。"
			}
		}
		RT_007 = RESP_DND_INTERACTION -> RESP_AUTO_SCROLL "activeなDnDと並び替え方向を提供する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.7" "activeなDnDと並び替え方向を提供する。"
				"runtime.RV_DND_PROGRESS.step.5" "activeなDnDと並び替え方向を提供する。"
			}
		}
		RT_008 = RESP_REORDER_TARGET_RESOLUTION -> RESP_DND_INTERACTION "開始不可であることと、提供可能な理由を通知する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_IMMOVABLE.step.5" "開始不可であることと、提供可能な理由を通知する。"
			}
		}
		RT_009 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "利用者へ示す理由がある場合は、DnDを開始せず一時表示するために渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_IMMOVABLE.step.6" "利用者へ示す理由がある場合は、DnDを開始せず一時表示するために渡す。"
			}
		}
		RT_010 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "現在位置に対応するDnD進行情報をReorder operation boundaryへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.1" "現在位置に対応するDnD進行情報をReorder operation boundaryへ渡す。"
			}
		}
		RT_011 = RESP_DND_INTERACTION -> RESP_DROP_TARGET_RESOLUTION "現在の移動対象、並び替え方向、制約情報、現在位置を渡し、行ではbody section内の行間、列ではTable全体の列間について移動先判定を要求する。" {
			tags "Runtime Interaction,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.2" "現在の移動対象、並び替え方向、制約情報、現在位置を渡し、行ではbody section内の行間、列ではTable全体の列間について移動先判定を要求する。"
			}
		}
		RT_012 = RESP_DROP_TARGET_RESOLUTION -> RESP_DND_INTERACTION "対象範囲の構造保持条件を満たす有効な移動先、または有効な移動先なしという正常な判定結果を通知する。" {
			tags "Runtime Interaction,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.3" "対象範囲の構造保持条件を満たす有効な移動先、または有効な移動先なしという正常な判定結果を通知する。"
			}
		}
		RT_013 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "移動対象と現在の有効な移動先を提供し、挿入線と必要な周囲の表示変化を更新させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.4" "移動対象と現在の有効な移動先を提供し、挿入線と必要な周囲の表示変化を更新させる。"
			}
		}
		RT_014 = RESP_AUTO_SCROLL -> EXT_SCROLL_AREA "行では縦方向、列では横方向に必要な自動スクロールを行う。" {
			tags "Runtime Interaction,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.6" "行では縦方向、列では横方向に必要な自動スクロールを行う。"
			}
		}
		RT_015 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "DnD完了をReorder operation boundaryへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT"
			properties {
				"runtime.RV_DND_COMMIT.step.1" "DnD完了をReorder operation boundaryへ渡す。"
			}
		}
		RT_016 = RESP_DND_INTERACTION -> RESP_DATA_UPDATE "移動対象と有効な移動先を含む確定済みの並び替えを渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT"
			properties {
				"runtime.RV_DND_COMMIT.step.2" "移動対象と有効な移動先を含む確定済みの並び替えを渡す。"
			}
		}
		RT_017 = RESP_DATA_UPDATE -> RESP_TABLE_INTEGRATION "確定済みの並び替えを1つの更新単位として反映するよう要求する。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT,Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.RV_DND_COMMIT.step.3" "確定済みの並び替えを1つの更新単位として反映するよう要求する。"
				"runtime.RV_DATA_UPDATE_FAILURE.step.3" "確定済みの並び替えを1つの更新単位として反映するよう要求する。"
			}
		}
		RT_018 = RESP_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Block固有の方法で行または列の位置を更新する。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT"
			properties {
				"runtime.RV_DND_COMMIT.step.4" "対応Table Block固有の方法で行または列の位置を更新する。"
			}
		}
		RT_019 = RESP_DATA_UPDATE -> EXT_WORDPRESS_UNDO "成立した1回の並び替えを1回のUndoで戻せる更新単位として成立させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT"
			properties {
				"runtime.RV_DND_COMMIT.step.5" "成立した1回の並び替えを1回のUndoで戻せる更新単位として成立させる。"
			}
		}
		RT_020 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT"
			properties {
				"runtime.RV_DND_COMMIT.step.6" "確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。"
			}
		}
		RT_021 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "activeなReorder Sessionに対するDnDキャンセルをReorder operation boundaryへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_CANCEL"
			properties {
				"runtime.RV_DND_CANCEL.step.1" "activeなReorder Sessionに対するDnDキャンセルをReorder operation boundaryへ渡す。"
			}
		}
		RT_022 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "cancel結果を提供し、移動対象を元の位置へ戻す表示を完了させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_CANCEL"
			properties {
				"runtime.RV_DND_CANCEL.step.2" "cancel結果を提供し、移動対象を元の位置へ戻す表示を完了させる。"
			}
		}
		RT_023 = RESP_DND_INTERACTION -> RESP_AUTO_SCROLL "現在のDnDが終了したことを提供し、自動スクロールの一時状態を終了させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_CANCEL"
			properties {
				"runtime.RV_DND_CANCEL.step.3" "現在のDnDが終了したことを提供し、自動スクロールの一時状態を終了させる。"
			}
		}
		RT_024 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "abort結果を提供し、DnD中だけの表示状態を破棄させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_ABORT"
			properties {
				"runtime.RV_DND_ABORT.step.1" "abort結果を提供し、DnD中だけの表示状態を破棄させる。"
			}
		}
		RT_025 = RESP_DND_INTERACTION -> RESP_AUTO_SCROLL "abort結果を提供し、DnDに属する自動スクロール状態を終了させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_ABORT"
			properties {
				"runtime.RV_DND_ABORT.step.2" "abort結果を提供し、DnDに属する自動スクロール状態を終了させる。"
			}
		}
		RT_026 = RESP_DND_INTERACTION -> RESP_INPUT_INTERACTION "現在のDnDが終了したことを提供し、入力解釈の一時状態を次の操作へ持ち越さないようにする。" {
			tags "Runtime Interaction,Runtime_RV_DND_ABORT"
			properties {
				"runtime.RV_DND_ABORT.step.3" "現在のDnDが終了したことを提供し、入力解釈の一時状態を次の操作へ持ち越さないようにする。"
			}
		}
		RT_027 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "有効な移動先でのDnD完了をReorder operation boundaryへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.RV_DATA_UPDATE_FAILURE.step.1" "有効な移動先でのDnD完了をReorder operation boundaryへ渡す。"
			}
		}
		RT_028 = RESP_DND_INTERACTION -> RESP_DATA_UPDATE "確定済みの並び替えを渡す。" {
			tags "Runtime Interaction,Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.RV_DATA_UPDATE_FAILURE.step.2" "確定済みの並び替えを渡す。"
			}
		}
		RT_029 = RESP_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Blockへの外部更新を開始する。" {
			tags "Runtime Interaction,Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.RV_DATA_UPDATE_FAILURE.step.4" "対応Table Blockへの外部更新を開始する。"
			}
		}
		RT_030 = RESP_TABLE_INTEGRATION -> RESP_DATA_UPDATE "外部状態の変化などにより更新を完了または確認できない結果を返す。" {
			tags "Runtime Interaction,Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.RV_DATA_UPDATE_FAILURE.step.5" "外部状態の変化などにより更新を完了または確認できない結果を返す。"
			}
		}
		RT_031 = RESP_DATA_UPDATE -> RESP_DND_INTERACTION "更新失敗結果をReorder operation boundaryへ返す。" {
			tags "Runtime Interaction,Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.RV_DATA_UPDATE_FAILURE.step.6" "更新失敗結果をReorder operation boundaryへ返す。"
			}
		}
		RT_032 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "共通abortとしてDnD中だけの表示状態を破棄させる。" {
			tags "Runtime Interaction,Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.RV_DATA_UPDATE_FAILURE.step.7" "共通abortとしてDnD中だけの表示状態を破棄させる。"
			}
		}
		RT_033 = RESP_DND_INTERACTION -> RESP_AUTO_SCROLL "共通abortとしてDnDに属する自動スクロール状態を終了させる。" {
			tags "Runtime Interaction,Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.RV_DATA_UPDATE_FAILURE.step.8" "共通abortとしてDnDに属する自動スクロール状態を終了させる。"
			}
		}
		RT_034 = RESP_DND_INTERACTION -> RESP_INPUT_INTERACTION "共通abortとして入力解釈の一時状態を次の操作へ持ち越さないよう終了させる。" {
			tags "Runtime Interaction,Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.RV_DATA_UPDATE_FAILURE.step.9" "共通abortとして入力解釈の一時状態を次の操作へ持ち越さないよう終了させる。"
			}
		}
	}

	views {
		custom "DV_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA RESP_REORDER_MODE RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_EDITOR_DOM_CONTEXT RESP_TABLE_INTEGRATION RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_DATA_UPDATE
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_EDITOR_INTERACTION" {
			title "Structural Dependencies - Editor Interaction"
			include EXT_WORDPRESS_EDITOR RESP_EDITOR_DOM_CONTEXT RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_INPUT_INTERACTION RESP_REORDER_MODE
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_DND_CORE" {
			title "Structural Dependencies - DnD Core"
			include RESP_REORDER_MODE RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_TABLE_STRUCTURE" {
			title "Structural Dependencies - Table Structure"
			include EXT_SUPPORTED_TABLE_BLOCK RESP_TABLE_INTEGRATION RESP_REORDER_TARGET_RESOLUTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_DND_FEEDBACK" {
			title "Structural Dependencies - DnD Feedback"
			include RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_EDITOR_DOM_CONTEXT EXT_SCROLL_AREA
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_DATA_UPDATE" {
			title "Structural Dependencies - Data Update"
			include RESP_DND_INTERACTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "PV_REORDER_END_TO_END" {
			title "Process Flow - Reorder End-to-End"
			include EXT_WORDPRESS_EDITOR RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK
			exclude "relationship.tag!=ProcessFlow_PV_REORDER_END_TO_END"
			autoLayout lr
		}

		custom "PV_REORDER_INPUT_FAILURE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - Reorder Input Failure and Recovery"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL
			exclude "relationship.tag!=ProcessFlow_PV_REORDER_INPUT_FAILURE_RECOVERY"
			autoLayout lr
		}

		custom "PV_REORDER_DROP_TARGET_FAILURE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - Reorder Drop Target Failure and Recovery"
			include RESP_DROP_TARGET_RESOLUTION RESP_DND_INTERACTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_INPUT_INTERACTION
			exclude "relationship.tag!=ProcessFlow_PV_REORDER_DROP_TARGET_FAILURE_RECOVERY"
			autoLayout lr
		}

		custom "PV_REORDER_DATA_UPDATE_FAILURE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - Reorder Data Update Failure and Recovery"
			include RESP_DATA_UPDATE RESP_DND_INTERACTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_INPUT_INTERACTION
			exclude "relationship.tag!=ProcessFlow_PV_REORDER_DATA_UPDATE_FAILURE_RECOVERY"
			autoLayout lr
		}

		custom "RV_DND_START_MOVABLE" {
			title "Runtime - DnD start with movable target"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_TARGET_RESOLUTION RESP_TABLE_INTEGRATION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL
			exclude "relationship.tag!=Runtime_RV_DND_START_MOVABLE"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006;7=RT_007"
			}
			autoLayout lr
		}

		custom "RV_DND_START_IMMOVABLE" {
			title "Runtime - DnD start without movable target"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_TARGET_RESOLUTION RESP_TABLE_INTEGRATION RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_008;6=RT_009"
			}
			autoLayout lr
		}

		custom "RV_DND_PROGRESS" {
			title "Runtime - DnD progress"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_DROP_TARGET_RESOLUTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL EXT_SCROLL_AREA
			exclude "relationship.tag!=Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.steps" "1=RT_010;2=RT_011;3=RT_012;4=RT_013;5=RT_007;6=RT_014"
			}
			autoLayout lr
		}

		custom "RV_DND_COMMIT" {
			title "Runtime - DnD commit"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_COMMIT"
			properties {
				"runtime.steps" "1=RT_015;2=RT_016;3=RT_017;4=RT_018;5=RT_019;6=RT_020"
			}
			autoLayout lr
		}

		custom "RV_DND_CANCEL" {
			title "Runtime - DnD cancel"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL
			exclude "relationship.tag!=Runtime_RV_DND_CANCEL"
			properties {
				"runtime.steps" "1=RT_021;2=RT_022;3=RT_023"
			}
			autoLayout lr
		}

		custom "RV_DND_ABORT" {
			title "Runtime - DnD abort"
			include RESP_DND_INTERACTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_INPUT_INTERACTION
			exclude "relationship.tag!=Runtime_RV_DND_ABORT"
			properties {
				"runtime.steps" "1=RT_024;2=RT_025;3=RT_026"
			}
			autoLayout lr
		}

		custom "RV_DATA_UPDATE_FAILURE" {
			title "Runtime - Data Update failure after update start"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL
			exclude "relationship.tag!=Runtime_RV_DATA_UPDATE_FAILURE"
			properties {
				"runtime.steps" "1=RT_027;2=RT_028;3=RT_017;4=RT_029;5=RT_030;6=RT_031;7=RT_032;8=RT_033;9=RT_034"
			}
			autoLayout lr
		}

		styles {
			element "External Context" {
				background #f8fafc
				color #344054
				stroke #667085
			}
			element "External System" {
				shape RoundedBox
				border solid
			}
			element "External Block" {
				shape Component
				background #eef4ff
				stroke #6172f3
			}
			element "External Capability" {
				shape Hexagon
				background #f4f3ff
				stroke #7f56d9
			}
			element "External Environment" {
				shape Box
				background #f2f4f7
				stroke #98a2b3
				border dashed
			}
			relationship "ProcessFlowEdge_normal" {
				style solid
			}
			relationship "ProcessFlowEdge_failure" {
				color #b42318
				style dashed
				thickness 3
			}
			relationship "ProcessFlowEdge_recovery" {
				color #b54708
				style dotted
				thickness 3
			}
		}
	}
}
