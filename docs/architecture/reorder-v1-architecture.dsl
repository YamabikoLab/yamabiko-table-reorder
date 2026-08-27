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
		RESP_INPUT_INTERACTION = element "Input Interaction" "Responsibility" "PC とタッチ端末の入力固有の差を共通の DnD 進行から分離し、開始試行・進行・完了・キャンセルとして DnD Interaction へ渡す境界を担う。" {
			tags "Responsibility"
		}
		RESP_DND_INTERACTION = element "DnD Interaction" "Responsibility" "入力方式と行・列に共通する DnD の開始可否判定と進行を統括し、確定可能な操作だけを Data Update へ渡す。" {
			tags "Responsibility"
		}
		RESP_REORDER_TARGET_RESOLUTION = element "Reorder Target Resolution" "Responsibility" "DnD 開始試行時に、Table 構造と並び替え方向から行または列を移動対象として選択できるかを判定し、移動不可の場合はその理由を提供する。" {
			tags "Responsibility"
		}
		RESP_DROP_TARGET_RESOLUTION = element "Drop Target Resolution" "Responsibility" "DnD 開始後の移動対象と Table 構造から、現在の位置が有効な移動先かを判定する。" {
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

		REL_001 = EXT_WORDPRESS_EDITOR -> RESP_FIRST_USE_GUIDANCE "初回案内の表示契機となる編集環境の状態を提供する。" {
			tags "Architecture Relationship"
		}
		REL_002 = EXT_WORDPRESS_EDITOR -> RESP_REORDER_REDISCOVERY "通常編集として成立した操作と並び替え試行候補を区別するための情報を提供する。" {
			tags "Architecture Relationship"
		}
		REL_003 = EXT_WORDPRESS_EDITOR -> RESP_EDITOR_DOM_CONTEXT "現在の editor context に属する基準を通じて、解決対象となる編集環境を提供する。" {
			tags "Architecture Relationship"
		}
		REL_004 = EXT_WORDPRESS_EDITOR -> RESP_INPUT_INTERACTION "PC またはタッチ端末の入力を提供する。DOM / Web API context の解決は提供しない。" {
			tags "Architecture Relationship"
		}
		REL_005 = RESP_EDITOR_DOM_CONTEXT -> RESP_FIRST_USE_GUIDANCE "初回案内で DOM / Web API を利用する時点の editor context を提供する。" {
			tags "Architecture Relationship"
		}
		REL_006 = RESP_EDITOR_DOM_CONTEXT -> RESP_REORDER_REDISCOVERY "再案内判定で DOM / Web API を利用する時点の editor context を提供する。" {
			tags "Architecture Relationship"
		}
		REL_007 = RESP_EDITOR_DOM_CONTEXT -> RESP_INPUT_INTERACTION "入力解釈で DOM / Web API を利用する時点の editor context を提供する。" {
			tags "Architecture Relationship"
		}
		REL_008 = RESP_EDITOR_DOM_CONTEXT -> RESP_REORDER_PRESENTATION "表示処理で DOM / Web API を利用する時点の editor context を提供する。" {
			tags "Architecture Relationship"
		}
		REL_009 = RESP_EDITOR_DOM_CONTEXT -> RESP_AUTO_SCROLL "自動スクロールで DOM / Web API を利用する時点の editor context を提供する。" {
			tags "Architecture Relationship"
		}
		REL_010 = RESP_REORDER_MODE -> RESP_FIRST_USE_GUIDANCE "並び替え入口の選択による案内終了を伝える。" {
			tags "Architecture Relationship"
		}
		REL_011 = RESP_REORDER_MODE -> RESP_REORDER_REDISCOVERY "並び替えモード中は再案内判定を行わないための現在状態を提供する。" {
			tags "Architecture Relationship"
		}
		REL_012 = RESP_REORDER_MODE -> RESP_INPUT_INTERACTION "現在の並び替え状態を提供する。" {
			tags "Architecture Relationship"
		}
		REL_013 = RESP_REORDER_MODE -> RESP_DND_INTERACTION "DnD 開始試行で使用する並び替え方向を提供する。" {
			tags "Architecture Relationship,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.2" "現在の並び替え方向を提供する。"
				"runtime.RV_DND_START_IMMOVABLE.step.2" "現在の並び替え方向を提供する。"
			}
		}
		REL_014 = RESP_REORDER_MODE -> RESP_REORDER_PRESENTATION "並び替えモード中に表示する対象方向を提供する。" {
			tags "Architecture Relationship"
		}
		REL_015 = RESP_FIRST_USE_GUIDANCE -> RESP_REORDER_REDISCOVERY "初回案内が完了済みであることを再案内判定の前提として提供する。" {
			tags "Architecture Relationship"
		}
		REL_016 = RESP_INPUT_INTERACTION -> RESP_DND_INTERACTION "DnD の開始試行、進行、完了、キャンセルを共通の意味で渡す。" {
			tags "Architecture Relationship,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE,Runtime_RV_DND_PROGRESS,Runtime_RV_DND_COMMIT_CORE_TABLE,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK,Runtime_RV_DND_CANCEL"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.1" "開始対象を含む DnD 開始試行を渡す。"
				"runtime.RV_DND_START_IMMOVABLE.step.1" "開始対象を含む DnD 開始試行を渡す。"
				"runtime.RV_DND_PROGRESS.step.1" "現在位置に対応する DnD 進行情報を渡す。"
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.1" "DnD 完了を渡す。"
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.1" "DnD 完了を渡す。"
				"runtime.RV_DND_CANCEL.step.1" "DnD キャンセルを渡す。"
			}
		}
		REL_017 = RESP_DND_INTERACTION -> RESP_REORDER_TARGET_RESOLUTION "DnD 開始試行時に開始対象と並び替え方向に対する移動対象判定を要求する。" {
			tags "Architecture Relationship,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.3" "開始対象と並び替え方向に対する移動対象判定を要求する。"
				"runtime.RV_DND_START_IMMOVABLE.step.3" "開始対象と並び替え方向に対する移動対象判定を要求する。"
			}
		}
		REL_018 = RESP_REORDER_TARGET_RESOLUTION -> RESP_DND_INTERACTION "移動可能かどうかと、移動不可の場合の理由を返す。" {
			tags "Architecture Relationship,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.4" "移動可能であることを返す。"
				"runtime.RV_DND_START_IMMOVABLE.step.4" "移動不可であることと理由を返す。"
			}
		}
		REL_019 = RESP_DND_INTERACTION -> RESP_DROP_TARGET_RESOLUTION "active な DnD 中に現在位置に対応する移動先判定を要求する。" {
			tags "Architecture Relationship,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.2" "現在の移動対象、並び替え方向、現在位置に対する移動先判定を要求する。"
			}
		}
		REL_020 = RESP_DROP_TARGET_RESOLUTION -> RESP_DND_INTERACTION "有効な移動先、または有効な移動先なしを返す。" {
			tags "Architecture Relationship,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.3" "有効な移動先、または有効な移動先なしを返す。"
			}
		}
		REL_021 = RESP_DND_INTERACTION -> RESP_REORDER_PRESENTATION "移動不可理由、DnD の進行状態、確定結果、キャンセル結果を提供する。" {
			tags "Architecture Relationship,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_START_IMMOVABLE,Runtime_RV_DND_PROGRESS,Runtime_RV_DND_COMMIT_CORE_TABLE,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK,Runtime_RV_DND_CANCEL"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.5" "DnD が開始した移動対象と進行状態を提供する。"
				"runtime.RV_DND_START_IMMOVABLE.step.5" "DnD を開始せず、移動不可理由を一時表示するために渡す。"
				"runtime.RV_DND_PROGRESS.step.4" "移動対象と現在の有効な移動先を提供し、挿入線と必要な周囲の表示変化を更新させる。"
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.5" "確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。"
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.5" "確定結果を提供し、移動対象を最終位置へつなぐ表示を完了させる。"
				"runtime.RV_DND_CANCEL.step.2" "キャンセル結果を提供し、移動対象を元の位置へ戻す表示を完了させる。"
			}
		}
		REL_022 = RESP_DND_INTERACTION -> RESP_AUTO_SCROLL "active な DnD と並び替え方向を提供する。" {
			tags "Architecture Relationship,Runtime_RV_DND_START_MOVABLE,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_START_MOVABLE.step.6" "active な DnD と並び替え方向を提供する。"
				"runtime.RV_DND_PROGRESS.step.5" "active な DnD と並び替え方向を提供する。"
			}
		}
		REL_023 = RESP_DND_INTERACTION -> RESP_DATA_UPDATE "有効な移動先で完了した確定済みの並び替えだけを渡す。" {
			tags "Architecture Relationship,Runtime_RV_DND_COMMIT_CORE_TABLE,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.2" "移動対象と移動先を含む確定済みの並び替えを渡す。"
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.2" "移動対象と移動先を含む確定済みの並び替えを渡す。"
			}
		}
		REL_024 = RESP_AUTO_SCROLL -> EXT_SCROLL_AREA "行では縦方向、列では横方向の必要な自動スクロールを行う。" {
			tags "Architecture Relationship,Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.RV_DND_PROGRESS.step.6" "行では縦方向、列では横方向に必要な自動スクロールを行う。"
			}
		}
		REL_025 = RESP_DATA_UPDATE -> EXT_CORE_TABLE "Core Table の行または列の位置を確定結果に従って更新する。" {
			tags "Architecture Relationship,Runtime_RV_DND_COMMIT_CORE_TABLE"
			properties {
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.3" "Core Table の行または列の位置を更新する。"
			}
		}
		REL_026 = RESP_DATA_UPDATE -> EXT_FLEXIBLE_TABLE_BLOCK "Flexible Table Block の行または列の位置を確定結果に従って更新する。" {
			tags "Architecture Relationship,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.3" "Flexible Table Block の行または列の位置を更新する。"
			}
		}
		REL_027 = RESP_DATA_UPDATE -> EXT_WORDPRESS_UNDO "1 回の成立した並び替えを 1 回で戻せる更新単位として反映する。" {
			tags "Architecture Relationship,Runtime_RV_DND_COMMIT_CORE_TABLE,Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.RV_DND_COMMIT_CORE_TABLE.step.4" "1 回の並び替えを 1 回の Undo で戻せる更新単位として成立させる。"
				"runtime.RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK.step.4" "1 回の並び替えを 1 回の Undo で戻せる更新単位として成立させる。"
			}
		}
	}

	views {
		custom "ResponsibilityView" {
			title "Responsibility View"
			include *
			autoLayout lr
		}

		custom "RV_DND_START_MOVABLE" {
			title "DnD start with movable target"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_TARGET_RESOLUTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL
			exclude "relationship.tag!=Runtime_RV_DND_START_MOVABLE"
			properties {
				"runtime.steps" "1=REL_016;2=REL_013;3=REL_017;4=REL_018;5=REL_021;6=REL_022"
			}
			autoLayout lr
		}

		custom "RV_DND_START_IMMOVABLE" {
			title "DnD start with immovable target"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_MODE RESP_REORDER_TARGET_RESOLUTION RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_START_IMMOVABLE"
			properties {
				"runtime.steps" "1=REL_016;2=REL_013;3=REL_017;4=REL_018;5=REL_021"
			}
			autoLayout lr
		}

		custom "RV_DND_PROGRESS" {
			title "DnD progress"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_DROP_TARGET_RESOLUTION RESP_REORDER_PRESENTATION RESP_AUTO_SCROLL EXT_SCROLL_AREA
			exclude "relationship.tag!=Runtime_RV_DND_PROGRESS"
			properties {
				"runtime.steps" "1=REL_016;2=REL_019;3=REL_020;4=REL_021;5=REL_022;6=REL_024"
			}
			autoLayout lr
		}

		custom "RV_DND_COMMIT_CORE_TABLE" {
			title "DnD commit to Core Table"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_DATA_UPDATE EXT_CORE_TABLE EXT_WORDPRESS_UNDO RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_COMMIT_CORE_TABLE"
			properties {
				"runtime.steps" "1=REL_016;2=REL_023;3=REL_025;4=REL_027;5=REL_021"
			}
			autoLayout lr
		}

		custom "RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK" {
			title "DnD commit to Flexible Table Block"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_DATA_UPDATE EXT_FLEXIBLE_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_COMMIT_FLEXIBLE_TABLE_BLOCK"
			properties {
				"runtime.steps" "1=REL_016;2=REL_023;3=REL_026;4=REL_027;5=REL_021"
			}
			autoLayout lr
		}

		custom "RV_DND_CANCEL" {
			title "DnD cancel"
			include RESP_INPUT_INTERACTION RESP_DND_INTERACTION RESP_REORDER_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_DND_CANCEL"
			properties {
				"runtime.steps" "1=REL_016;2=REL_021"
			}
			autoLayout lr
		}
	}
}
