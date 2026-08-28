// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "YTR が動作する編集環境と PC・タッチ端末の入力状態を提供する。" {
			tags "External Context"
		}
		EXT_CORE_TABLE = element "WordPress Core Table" "External Block" "YTR が行・列の並び替えを行う対象 Table の一つ。" {
			tags "External Context"
		}
		EXT_FLEXIBLE_TABLE_BLOCK = element "Flexible Table Block" "External Block" "YTR が行・列の並び替えを行う対象 Table の一つ。" {
			tags "External Context"
		}
		EXT_WORDPRESS_UNDO = element "WordPress Undo" "External Capability" "成立した 1 回の並び替えを 1 回の Undo で戻せる更新単位を提供する。" {
			tags "External Context"
		}
		EXT_SCROLL_AREA = element "Editor Scroll Area" "External Environment" "DnD 中に Table または編集画面を必要な方向へ自動スクロールする対象領域を提供する。" {
			tags "External Context"
		}

		RESP_REORDER_MODE = element "Reorder Mode" "Responsibility" "通常の Table 編集、行並び替え、列並び替えのどの状態にあるかを管理し、並び替え操作の有効範囲を決める。" {
			tags "Responsibility"
		}
		RESP_FIRST_USE_GUIDANCE = element "First-use Guidance" "Responsibility" "PC とタッチ端末ごとの初回案内の表示状態を管理し、並び替えの入口を利用者に案内する。" {
			tags "Responsibility"
		}
		RESP_REORDER_REDISCOVERY = element "Reorder Rediscovery" "Responsibility" "通常編集状態で並び替えを試みていると考えられる操作の繰り返しを判定し、必要な場合だけ並び替えの入口を再案内する。" {
			tags "Responsibility"
		}
		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在の editor context に属する基準から、その時点で利用すべき DOM / Web API context を解決し、必要とする責務へ提供する。" {
			tags "Responsibility"
		}
		RESP_TABLE_INTEGRATION = element "Table Integration" "Responsibility" "外部 Table plugin と Reorder core の境界を担い、Table plugin 固有の Table 構造取得およびデータ更新方法を Reorder core から隠蔽する。" {
			tags "Responsibility"
		}
		RESP_INPUT_INTERACTION = element "Input Interaction" "Responsibility" "PC とタッチ端末の入力固有の差を共通の DnD 進行から分離し、開始試行・進行・完了・キャンセルとして DnD Interaction へ渡す境界を担う。" {
			tags "Responsibility"
		}
		RESP_DND_INTERACTION = element "DnD Interaction" "Responsibility" "入力方式と行・列に共通する DnD の開始可否判定と進行を統括し、成立した Reorder Session の状態を管理して、確定可能な操作だけを Data Update へ渡す。" {
			tags "Responsibility"
		}
		RESP_REORDER_TARGET_RESOLUTION = element "Reorder Target Resolution" "Responsibility" "DnD 開始試行時に現在の共通 Table structure から移動対象可否を判定し、その DnD で利用する構造上の制約情報を導出する。" {
			tags "Responsibility"
		}
		RESP_DROP_TARGET_RESOLUTION = element "Drop Target Resolution" "Responsibility" "DnD Interaction から渡された移動対象、並び替え方向、制約情報、現在位置から、現在の位置が有効な移動先かを判定する。" {
			tags "Responsibility"
		}
		RESP_REORDER_PRESENTATION = element "Reorder Presentation" "Responsibility" "並び替えモード中の対象表示、移動不可理由、および DnD 中から確定・キャンセルまでの視覚フィードバックを Table データの更新から分離して扱う。" {
			tags "Responsibility"
		}
		RESP_AUTO_SCROLL = element "Auto Scroll" "Responsibility" "DnD 中に、行では縦方向、列では横方向だけを移動のための自動スクロール対象とする。" {
			tags "Responsibility"
		}
		RESP_DATA_UPDATE = element "Data Update" "Responsibility" "確定した並び替えだけを Table に反映し、保持すべきセル情報と Undo 単位を維持する。" {
			tags "Responsibility"
		}

		DEP_001 = RESP_FIRST_USE_GUIDANCE -> EXT_WORDPRESS_EDITOR "初回案内の表示契機となる編集環境の状態を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_002 = RESP_FIRST_USE_GUIDANCE -> RESP_EDITOR_DOM_CONTEXT "初回案内で DOM / Web API を利用するため、現在の editor context を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_003 = RESP_REORDER_REDISCOVERY -> EXT_WORDPRESS_EDITOR "通常編集と並び替え試行候補を区別する編集環境の情報を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_004 = RESP_REORDER_REDISCOVERY -> RESP_EDITOR_DOM_CONTEXT "再案内判定で DOM / Web API を利用するため、現在の editor context を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_REORDER_REDISCOVERY -> RESP_FIRST_USE_GUIDANCE "初回案内が表示済みであることを再案内判定の前提として必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_REORDER_REDISCOVERY -> RESP_REORDER_MODE "通常編集状態でだけ再案内判定を行うため、現在の並び替え状態を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_EDITOR_DOM_CONTEXT -> EXT_WORDPRESS_EDITOR "現在の editor context を解決するため、現在の WordPress Editor を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_TABLE_INTEGRATION -> EXT_CORE_TABLE "Core Table 固有の構造取得およびデータ更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_TABLE_INTEGRATION -> EXT_FLEXIBLE_TABLE_BLOCK "Flexible Table Block 固有の構造取得およびデータ更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_INPUT_INTERACTION -> EXT_WORDPRESS_EDITOR "PC またはタッチ端末の入力を共通の DnD 意味へ変換するため、編集環境の入力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_INPUT_INTERACTION -> RESP_EDITOR_DOM_CONTEXT "入力解釈で DOM / Web API を利用するため、現在の editor context を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_INPUT_INTERACTION -> RESP_REORDER_MODE "並び替えモード中の入力を解釈するため、現在の並び替え状態を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_DND_INTERACTION -> RESP_REORDER_MODE "DnD 開始時に使用する現在の並び替え方向を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_DND_INTERACTION -> RESP_REORDER_TARGET_RESOLUTION "DnD を開始できる移動対象と、その DnD で利用する制約情報の解決能力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_DND_INTERACTION -> RESP_DROP_TARGET_RESOLUTION "開始済み DnD の現在位置が有効な移動先かを判定する能力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_DND_INTERACTION -> RESP_DATA_UPDATE "確定した並び替えを Table データへ反映する能力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_REORDER_TARGET_RESOLUTION -> RESP_TABLE_INTEGRATION "移動対象判定と制約情報導出に使用する現在の共通 Table structure を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_REORDER_PRESENTATION -> RESP_REORDER_MODE "並び替えモード中に表示する対象方向を決めるため、現在の並び替え状態を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_REORDER_PRESENTATION -> RESP_EDITOR_DOM_CONTEXT "表示処理で DOM / Web API を利用するため、現在の editor context を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_REORDER_PRESENTATION -> RESP_DND_INTERACTION "移動不可理由、DnD の進行状態、確定結果、キャンセル結果を表示するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = RESP_AUTO_SCROLL -> RESP_DND_INTERACTION "active な DnD と並び替え方向を自動スクロール判断に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_022 = RESP_AUTO_SCROLL -> RESP_EDITOR_DOM_CONTEXT "自動スクロールで DOM / Web API を利用するため、現在の editor context を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_023 = RESP_AUTO_SCROLL -> EXT_SCROLL_AREA "DnD 中に移動方向へスクロールできる外部領域を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_024 = RESP_DATA_UPDATE -> RESP_TABLE_INTEGRATION "確定した並び替えを対象 Table plugin 固有の方法で反映する能力を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_025 = RESP_DATA_UPDATE -> EXT_WORDPRESS_UNDO "成立した 1 回の並び替えを 1 回で戻せる更新単位を維持するため、Undo の仕組みを必要とする。" {
			tags "Structural Dependency"
		}

		RT_001 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "開始対象を含む DnD 開始試行を渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.1" "開始対象を含む DnD 開始試行を渡す。"
				"runtime.RV_DND_START_IMMOVABLE.step.1" "開始対象を含む DnD 開始試行を渡す。"
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
		RT_004 = RESP_REORDER_TARGET_RESOLUTION -> RESP_TABLE_INTEGRATION "対象 Table の要求時点の共通 Table structure を要求する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.4" "対象 Table の要求時点の共通 Table structure を要求する。"
				"runtime.RV_DND_START_IMMOVABLE.step.4" "対象 Table の要求時点の共通 Table structure を要求する。"
			}
		}
		RT_005 = RESP_REORDER_TARGET_RESOLUTION -> RESP_DND_INTERACTION "移動対象と、その DnD で利用する制約情報が解決されたことを通知する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.5" "移動対象と、その DnD で利用する制約情報が解決されたことを通知する。"
			}
		}
		RT_006 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "DnD が開始した移動対象と進行状態を提供する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.6" "DnD が開始した移動対象と進行状態を提供する。"
			}
		}
		RT_007 = RESP_DND_INTERACTION -> RESP_AUTO_SCROLL "active な DnD と並び替え方向を提供する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.7" "active な DnD と並び替え方向を提供する。"
				"runtime.RV_DND_PROGRESS.step.5" "active な DnD と並び替え方向を提供する。"
			}
		}
		RT_008 = RESP_REORDER_TARGET_RESOLUTION -> RESP_DND_INTERACTION "移動不可であることと理由を通知する。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_IMMOVABLE.step.5" "移動不可であることと理由を通知する。"
			}
		}
		RT_009 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "DnD を開始せず、移動不可理由を一時表示するために渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_IMMOVABLE.step.6" "DnD を開始せず、移動不可理由を一時表示するために渡す。"
			}
		}
		RT_010 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "現在位置に対応する DnD 進行情報を渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.1" "現在位置に対応する DnD 進行情報を渡す。"
			}
		}
		RT_011 = RESP_DND_INTERACTION -> RESP_DROP_TARGET_RESOLUTION "現在の移動対象、並び替え方向、制約情報、現在位置を渡して移動先判定を要求する。" {
			tags "Runtime Interaction,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.2" "現在の移動対象、並び替え方向、制約情報、現在位置を渡して移動先判定を要求する。"
			}
		}
		RT_012 = RESP_DROP_TARGET_RESOLUTION -> RESP_DND_INTERACTION "有効な移動先、または有効な移動先なしという判定結果を通知する。" {
			tags "Runtime Interaction,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.3" "有効な移動先、または有効な移動先なしという判定結果を通知する。"
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
		RT_015 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "DnD 完了を渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT_CORE_TABLE,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.1" "DnD 完了を渡す。"
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.1" "DnD 完了を渡す。"
			}
		}
		RT_016 = RESP_DND_INTERACTION -> RESP_DATA_UPDATE "移動対象と移動先を含む確定済みの並び替えを渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT_CORE_TABLE,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.2" "移動対象と移動先を含む確定済みの並び替えを渡す。"
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.2" "移動対象と移動先を含む確定済みの並び替えを渡す。"
			}
		}
		RT_017 = RESP_DATA_UPDATE -> RESP_TABLE_INTEGRATION "確定済みの並び替えの反映を要求する。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT_CORE_TABLE,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.3" "確定済みの並び替えの反映を要求する。"
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.3" "確定済みの並び替えの反映を要求する。"
			}
		}
		RT_018 = RESP_TABLE_INTEGRATION -> EXT_CORE_TABLE "Core Table 固有の方法で行または列の位置を更新する。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT_CORE_TABLE"
			properties {
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.4" "Core Table 固有の方法で行または列の位置を更新する。"
			}
		}
		RT_019 = RESP_DATA_UPDATE -> EXT_WORDPRESS_UNDO "1 回の並び替えを 1 回の Undo で戻せる更新単位として成立させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT_CORE_TABLE,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.5" "1 回の並び替えを 1 回の Undo で戻せる更新単位として成立させる。"
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.5" "1 回の並び替えを 1 回の Undo で戻せる更新単位として成立させる。"
			}
		}
		RT_020 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT_CORE_TABLE,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.6" "確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。"
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.6" "確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。"
			}
		}
		RT_021 = RESP_TABLE_INTEGRATION -> EXT_FLEXIBLE_TABLE_BLOCK "Flexible Table Block 固有の方法で行または列の位置を更新する。" {
			tags "Runtime Interaction,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.4" "Flexible Table Block 固有の方法で行または列の位置を更新する。"
			}
		}
		RT_022 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "DnD キャンセルを渡す。" {
			tags "Runtime Interaction,Runtime_RV_DND_CANCEL"
			properties {
				"runtime.RV_DND_CANCEL.step.1" "DnD キャンセルを渡す。"
			}
		}
		RT_023 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "キャンセル結果を提供し、移動対象を元の位置へ戻す表示を完了させる。" {
			tags "Runtime Interaction,Runtime_RV_DND_CANCEL"
			properties {
				"runtime.RV_DND_CANCEL.step.2" "キャンセル結果を提供し、移動対象を元の位置へ戻す表示を完了させる。"
			}
		}
	}

	views {
		custom "DV_RESPONSIBILITY" {
			title "Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_CORE_TABLE EXT_FLEXIBLE_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA RESP_REORDER_MODE RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_EDITOR_DOM_CONTEXT RESP_TABLE_INTEGRATION RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_DATA_UPDATE
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_EDITOR_INTERACTION" {
			title "Editor Interaction"
			include EXT_WORDPRESS_EDITOR RESP_EDITOR_DOM_CONTEXT RESP_FIRST_USE_GUIDANCE RESP_REORDER_REDISCOVERY RESP_INPUT_INTERACTION RESP_REORDER_MODE
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_DND_CORE" {
			title "DnD Core"
			include RESP_REORDER_MODE RESP_DND_INTERACTION RESP_REORDER_TARGET_RESOLUTION RESP_DROP_TARGET_RESOLUTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_TABLE_STRUCTURE" {
			title "Table Structure"
			include EXT_CORE_TABLE EXT_FLEXIBLE_TABLE_BLOCK RESP_TABLE_INTEGRATION RESP_REORDER_TARGET_RESOLUTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_DND_FEEDBACK" {
			title "DnD Feedback"
			include RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL RESP_EDITOR_DOM_CONTEXT EXT_SCROLL_AREA
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_DATA_UPDATE" {
			title "Data Update"
			include RESP_DND_INTERACTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION EXT_CORE_TABLE EXT_FLEXIBLE_TABLE_BLOCK EXT_WORDPRESS_UNDO
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "RV_DND_START_MOVABLE" {
			title "DnD start with movable target"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_TARGET_RESOLUTION RESP_TABLE_INTEGRATION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL
			exclude "relationship.tag!=Runtime_RV_DND_START_MOVABLE"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006;7=RT_007"
			}
			autoLayout lr
		}

		custom "RV_DND_START_IMMOVABLE" {
			title "DnD start with immovable target"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_TARGET_RESOLUTION RESP_TABLE_INTEGRATION RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_008;6=RT_009"
			}
			autoLayout lr
		}

		custom "RV_DND_PROGRESS" {
			title "DnD progress"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_DROP_TARGET_RESOLUTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL EXT_SCROLL_AREA
			exclude "relationship.tag!=Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.steps" "1=RT_010;2=RT_011;3=RT_012;4=RT_013;5=RT_007;6=RT_014"
			}
			autoLayout lr
		}

		custom "RV_DND_COMMIT_CORE_TABLE" {
			title "DnD commit to Core Table"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION EXT_CORE_TABLE EXT_WORDPRESS_UNDO RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_COMMIT_CORE_TABLE"
			properties {
				"runtime.steps" "1=RT_015;2=RT_016;3=RT_017;4=RT_018;5=RT_019;6=RT_020"
			}
			autoLayout lr
		}

		custom "RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK" {
			title "DnD commit to Flexible Table Block"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_DATA_UPDATE RESP_TABLE_INTEGRATION EXT_FLEXIBLE_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.steps" "1=RT_015;2=RT_016;3=RT_017;4=RT_021;5=RT_019;6=RT_020"
			}
			autoLayout lr
		}

		custom "RV_DND_CANCEL" {
			title "DnD cancel"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_CANCEL"
			properties {
				"runtime.steps" "1=RT_022;2=RT_023"
			}
			autoLayout lr
		}
	}
}