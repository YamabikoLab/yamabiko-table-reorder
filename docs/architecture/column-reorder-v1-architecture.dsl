// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "QR-02で保証対象とする編集環境を提供し、Column Reorderの入力と表示が存在する。" {
			tags "External Context,External System"
			!script groovy {
				element.setGroup("WordPress Integration")
			}
		}
		EXT_SUPPORTED_TABLE_BLOCK = element "Supported Table Block" "External Block" "FR-13で定義されるCore TableまたはFlexible Table Blockであり、Table Integrationを介してTable全体の列構造取得と列順更新を行う対象。" {
			tags "External Context,External Block"
			!script groovy {
				element.setGroup("WordPress Integration")
			}
		}
		EXT_WORDPRESS_UNDO = element "WordPress Undo" "External Capability" "成立した1回の列並び替えを1回のUndoで戻せる更新単位を提供する。" {
			tags "External Context,External Capability"
			!script groovy {
				element.setGroup("WordPress Integration")
			}
		}
		EXT_SCROLL_AREA = element "Editor Scroll Area" "External Environment" "列DnD中に横方向へ自動スクロールする対象領域を提供する。" {
			tags "External Context,External Environment"
			!script groovy {
				element.setGroup("WordPress Integration")
			}
		}
		EXT_DND_ENGINE = element "DnD Engine" "External Library" "物理入力の継続、物理的なDnD状態、現在の物理入力位置、および自動スクロール実行を提供する。" {
			tags "External Context,External Library"
		}

		RESP_REORDER_MODE = element "Reorder Mode" "Responsibility" "Tableツールバーの行・列入口、`edit" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_REORDER_GUIDANCE = element "Reorder Guidance" "Responsibility" "PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態を所有する外側の境界。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在のWordPress Editorに属するDOM / Web API contextを必要な時点で解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Editor Integration")
			}
		}
		RESP_COLUMN_INPUT_INTERACTION = element "Input Interaction" "Responsibility" "PCとタッチ端末の開始条件を解釈し、開始候補をReorder Target Resolutionで事前解決して、開始可能な候補だけをDnD Engineへ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_TABLE_INTEGRATION = element "Table Integration" "Responsibility" "対応Table Blockとの差を吸収し、列並び替えに必要なTable同一性、Table全体の現在列構造、列更新境界、およびWordPress Undoとの境界を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_TARGET_RESOLUTION = element "Reorder Target Resolution" "Responsibility" "active DnD成立前に現在の列制約から論理列の成立可否を二段階で解決し、開始可能な場合はそのDnDで利用する開始時制約を導出する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_DND_INTERACTION = element "DnD Interaction" "Responsibility" "DnD Engineの物理的なDnD進行をColumn Reorderの意味状態へ変換し、列DnD Session、移動先判定、確定、中止のLifecycleを所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_PRESENTATION = element "Reorder Presentation" "Responsibility" "Column Reorderの意味状態と必要な物理的DnD情報から、列DnD中の独立した視覚フィードバックとDesignで定義された通知を表現する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}

		DEP_001 = RESP_REORDER_MODE -> EXT_WORDPRESS_EDITOR "WordPress Editor上のTableツールバー入口、通常編集と行・列並び替えの排他、および対象Table単位のモードLifecycleを扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_002 = RESP_REORDER_GUIDANCE -> EXT_WORDPRESS_EDITOR "初回案内の表示契機、および行・列の入口をまとめて提示する編集環境を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_003 = RESP_REORDER_GUIDANCE -> RESP_EDITOR_DOM_CONTEXT "共通入口案内を現在のeditor contextで表現するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_004 = RESP_REORDER_GUIDANCE -> RESP_REORDER_MODE "Reorder Modeが所有する行・列入口の案内と、入口選択による案内終了を整合させるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_EDITOR_DOM_CONTEXT -> EXT_WORDPRESS_EDITOR "現在のeditor contextを解決するために現在のWordPress Editorを必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_COLUMN_INPUT_INTERACTION -> EXT_WORDPRESS_EDITOR "PCまたはタッチ端末の開始入力を判断するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_COLUMN_INPUT_INTERACTION -> RESP_EDITOR_DOM_CONTEXT "入力開始時の現在のeditor contextを利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_COLUMN_INPUT_INTERACTION -> RESP_REORDER_MODE "列並び替えが有効な期間だけ列入力を受理するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_TARGET_RESOLUTION "入力開始候補を現在制約で事前解決し、開始可能な列だけをDnD Engineへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_COLUMN_INPUT_INTERACTION -> EXT_DND_ENGINE "開始可能と解決された列だけを物理的なDnD開始候補へ接続し、DnD終了またはcancelを検知して自身の一時状態を終了するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Block固有のTable全体の列構造取得と列順更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した1回の列並び替えを1回のUndoで戻せる更新単位を維持するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "active DnD成立前の各解決時点で現在列制約を取得し、論理列が列単位の移動対象として成立するか解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_COLUMN_DND_INTERACTION -> EXT_DND_ENGINE "物理的なDnD開始成立後の進行と現在の物理入力位置をColumn ReorderのSession意味状態へ変換するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_MODE "DnD Interactionがモード状態を所有せず、DnD終了後のモードLifecycle判断をReorder Modeの責務として成立させるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "complete時の現在構造への再照合、および確定したTable全体の列移動の反映に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_COLUMN_PRESENTATION -> RESP_EDITOR_DOM_CONTEXT "現在のeditor contextで列DnDの表示を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_COLUMN_PRESENTATION -> EXT_DND_ENGINE "列DnDの表示に必要な物理的なDnD情報をSessionへ取り込まず利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_COLUMN_PRESENTATION -> RESP_COLUMN_TARGET_RESOLUTION "Designで利用者へ提示する開始不可理由を、制約判定を重複させず表示へ反映するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_COLUMN_PRESENTATION -> RESP_COLUMN_DND_INTERACTION "現在の有効な移動先、終了時の表示解除、およびDesign上の終了通知要否を表示状態へ反映するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = EXT_DND_ENGINE -> EXT_SCROLL_AREA "列DnD中に横方向の自動スクロールを実行する対象領域として必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_COLUMN_INPUT_INTERACTION "WordPress Editorの入力が列並び替えの入力境界へ入る。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_002 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_TARGET_RESOLUTION "入力開始候補を現在制約で事前解決し、DnD Engineへ接続可能か確認する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_003 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "active DnD成立前の各解決時点で現在列制約を取得し、Reorder Targetの成立可否を解決する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_004 = RESP_COLUMN_TARGET_RESOLUTION -> EXT_DND_ENGINE "第一段階で開始可能な候補だけを物理的なDnD開始境界へ進め、第二段階では開始可否結果を物理DnD成立へ反映する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_005 = EXT_DND_ENGINE -> RESP_COLUMN_TARGET_RESOLUTION "active DnD成立直前にReorder Targetを現在制約で再解決する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_006 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_DND_INTERACTION "第二段階で開始可能な場合だけReorder Targetと開始時制約をSession開始境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_007 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "complete時の現在構造取得と確定済み列移動の反映へ進む。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_008 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table BlockからTable全体の列構造を取得し、確定時はTable全体の列順を1回で反映する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_009 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_DND_INTERACTION "[failure] 現在のEditor contextを利用できないなど、外部環境変化による継続不能を通常の終了結果として渡す。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_010 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "[failure] 対象Tableが現在利用できない、または更新開始前に現在更新できないなど、外部Table状態の変化による継続不能・確定不能を通常の結果として返す。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_011 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "[recovery] DnD中だけの表示状態を解除し、安全な操作継続不能による終了ではDesignで定義された通知を要求する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY,recovery"
		}
		PF_012 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_MODE "[recovery] DnD終了後に現在のTableで列並び替えモードを安全に継続できるかを外側のモード境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY,recovery"
		}

		RT_001 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_TARGET_RESOLUTION "入力開始候補を現在のTable制約で事前解決する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.1" "入力開始候補を現在のTable制約で事前解決する。"
			}
		}
		RT_002 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "第一段階の現在列制約を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.2" "第一段階の現在列制約を要求する。"
			}
		}
		RT_003 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在の対応Table BlockからTable全体の列構造を取得する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.3" "現在の対応Table BlockからTable全体の列構造を取得する。"
				"runtime.RV_COLUMN_DND_START.step.8" "現在の対応Table BlockからTable全体の列構造を取得する。"
			}
		}
		RT_004 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_PRESENTATION "colspanによりDesignの表示対象となる開始不可理由がある場合だけ理由を渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.4" "colspanによりDesignの表示対象となる開始不可理由がある場合だけ理由を渡す。"
			}
		}
		RT_005 = RESP_COLUMN_INPUT_INTERACTION -> EXT_DND_ENGINE "第一段階で開始可能な列だけをDnD開始候補として一時的に接続する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.5" "第一段階で開始可能な列だけをDnD開始候補として一時的に接続する。"
			}
		}
		RT_006 = EXT_DND_ENGINE -> RESP_COLUMN_TARGET_RESOLUTION "active DnD成立直前に同じReorder Targetを現在制約で再解決する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.6" "active DnD成立直前に同じReorder Targetを現在制約で再解決する。"
			}
		}
		RT_007 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "第二段階の現在列制約を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.7" "第二段階の現在列制約を要求する。"
			}
		}
		RT_008 = RESP_COLUMN_TARGET_RESOLUTION -> EXT_DND_ENGINE "第二段階の開始可否結果を返し、開始不能な場合は物理的なDnDを成立させない。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.9" "第二段階の開始可否結果を返し、開始不能な場合は物理的なDnDを成立させない。"
			}
		}
		RT_009 = EXT_DND_ENGINE -> RESP_COLUMN_DND_INTERACTION "第二段階で開始可能な場合だけ物理的なDnD開始成立と、解決済みReorder Target・開始時制約をstart境界へ渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.10" "第二段階で開始可能な場合だけ物理的なDnD開始成立と、解決済みReorder Target・開始時制約をstart境界へ渡す。"
			}
		}
		RT_010 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "Session開始時は移動対象列のDnD表示を開始する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.11" "Session開始時は移動対象列のDnD表示を開始する。"
			}
		}
		RT_011 = EXT_DND_ENGINE -> RESP_COLUMN_DND_INTERACTION "現在の物理入力位置を提供する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.1" "現在の物理入力位置を提供する。"
			}
		}
		RT_012 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_DND_INTERACTION "現在位置を論理的な列間挿入位置へ変換し、開始時制約でTable全体の構造を保てるか判定する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.2" "現在位置を論理的な列間挿入位置へ変換し、開始時制約でTable全体の構造を保てるか判定する。"
			}
		}
		RT_013 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "現在の有効移動先を表示状態へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.3" "現在の有効移動先を表示状態へ反映する。"
			}
		}
		RT_014 = RESP_COLUMN_PRESENTATION -> EXT_DND_ENGINE "移動対象表示に必要な物理的DnD情報を必要な時点で利用する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.4" "移動対象表示に必要な物理的DnD情報を必要な時点で利用する。"
			}
		}
		RT_015 = EXT_DND_ENGINE -> EXT_SCROLL_AREA "必要な場合だけ横方向へ自動スクロールする。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.5" "必要な場合だけ横方向へ自動スクロールする。"
			}
		}
		RT_016 = EXT_DND_ENGINE -> RESP_COLUMN_DND_INTERACTION "物理的なDnD完了を通知する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.1" "物理的なDnD完了を通知する。"
			}
		}
		RT_017 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "現在のTable全体の列構造を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.2" "現在のTable全体の列構造を要求する。"
			}
		}
		RT_018 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在のTable全体の列構造を取得する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.3" "現在のTable全体の列構造を取得する。"
			}
		}
		RT_019 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_DND_INTERACTION "Reorder Target、最終移動先、Table同一性を現在構造へ再照合する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.4" "Reorder Target、最終移動先、Table同一性を現在構造へ再照合する。"
			}
		}
		RT_020 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "現在も成立し列順が変化する場合だけ確定済み列移動の反映を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.5" "現在も成立し列順が変化する場合だけ確定済み列移動の反映を要求する。"
			}
		}
		RT_021 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "thead、tbody、tfootを含むTable全体の列順を1回の確定済み更新として反映する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.6" "thead、tbody、tfootを含むTable全体の列順を1回の確定済み更新として反映する。"
			}
		}
		RT_022 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した列並び替えを1回のUndo単位として成立させる。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.7" "成立した列並び替えを1回のUndo単位として成立させる。"
			}
		}
		RT_023 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "DnD中だけの表示を終了する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.8" "DnD中だけの表示を終了する。"
			}
		}
		RT_024 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_MODE "現在のTableで列並び替えモードを継続できる結果を渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.9" "現在のTableで列並び替えモードを継続できる結果を渡す。"
			}
		}
		RT_025 = EXT_DND_ENGINE -> RESP_COLUMN_DND_INTERACTION "cancelまたはDnD終了を通知する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.RV_COLUMN_DND_CANCEL.step.1" "cancelまたはDnD終了を通知する。"
			}
		}
		RT_026 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "DnD中だけの表示を終了し、異常終了メッセージを要求しない。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.RV_COLUMN_DND_CANCEL.step.2" "DnD中だけの表示を終了し、異常終了メッセージを要求しない。"
			}
		}
		RT_027 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_MODE "列並び替えモードを維持できる結果を渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.RV_COLUMN_DND_CANCEL.step.3" "列並び替えモードを維持できる結果を渡す。"
			}
		}
		RT_028 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_DND_INTERACTION "Editor contextの利用不能など外部環境変化による継続不能を通常の終了結果として渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_EXTERNAL_CHANGE_RECOVERY"
			properties {
				"runtime.RV_COLUMN_EXTERNAL_CHANGE_RECOVERY.step.1" "Editor contextの利用不能など外部環境変化による継続不能を通常の終了結果として渡す。"
			}
		}
		RT_029 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "現在Tableの利用不能または更新不能を通常の終了結果として返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_EXTERNAL_CHANGE_RECOVERY"
			properties {
				"runtime.RV_COLUMN_EXTERNAL_CHANGE_RECOVERY.step.2" "現在Tableの利用不能または更新不能を通常の終了結果として返す。"
			}
		}
		RT_030 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "DnD中だけの表示を解除し、Designで通知対象となる場合だけ終了通知を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_EXTERNAL_CHANGE_RECOVERY"
			properties {
				"runtime.RV_COLUMN_EXTERNAL_CHANGE_RECOVERY.step.3" "DnD中だけの表示を解除し、Designで通知対象となる場合だけ終了通知を要求する。"
			}
		}
		RT_031 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_MODE "現在Tableで列並び替えモードを安全に継続できるかという結果を渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_EXTERNAL_CHANGE_RECOVERY"
			properties {
				"runtime.RV_COLUMN_EXTERNAL_CHANGE_RECOVERY.step.4" "現在Tableで列並び替えモードを安全に継続できるかという結果を渡す。"
			}
		}
	}

	views {
		systemLandscape "DV_COLUMN_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_COLUMN_EDITOR_INTERACTION" {
			title "Structural Dependencies - Editor Interaction"
			include EXT_WORDPRESS_EDITOR EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TARGET_RESOLUTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_COLUMN_DND_CORE" {
			title "Structural Dependencies - DnD Core"
			include EXT_SUPPORTED_TABLE_BLOCK EXT_DND_ENGINE RESP_REORDER_MODE RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_COLUMN_FEEDBACK" {
			title "Structural Dependencies - DnD Feedback"
			include EXT_SCROLL_AREA EXT_DND_ENGINE RESP_EDITOR_DOM_CONTEXT RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_COLUMN_DATA_UPDATE" {
			title "Structural Dependencies - Table Update"
			include EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_COLUMN_DND_INTERACTION RESP_COLUMN_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "PV_COLUMN_REORDER_END_TO_END" {
			title "Process Flow - Column Reorder End-to-End"
			include EXT_WORDPRESS_EDITOR RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION EXT_DND_ENGINE RESP_COLUMN_DND_INTERACTION EXT_SUPPORTED_TABLE_BLOCK
			exclude "relationship.tag!=ProcessFlow_PV_COLUMN_REORDER_END_TO_END"
			autoLayout lr
		}

		custom "PV_COLUMN_EXTERNAL_CHANGE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - External Environment Change and Recovery"
			include RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY"
			autoLayout lr
		}

		custom "RV_COLUMN_DND_START" {
			title "Runtime - Column DnD start attempt"
			include RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_COLUMN_PRESENTATION EXT_DND_ENGINE RESP_COLUMN_DND_INTERACTION
			exclude "relationship.tag!=Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006;7=RT_007;8=RT_003;9=RT_008;10=RT_009;11=RT_010"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_DND_PROGRESS" {
			title "Runtime - Column DnD progress"
			include EXT_DND_ENGINE RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION EXT_SCROLL_AREA
			exclude "relationship.tag!=Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.steps" "1=RT_011;2=RT_012;3=RT_013;4=RT_014;5=RT_015"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_DND_COMPLETE" {
			title "Runtime - Column DnD complete"
			include EXT_DND_ENGINE RESP_COLUMN_DND_INTERACTION RESP_COLUMN_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_COLUMN_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.steps" "1=RT_016;2=RT_017;3=RT_018;4=RT_019;5=RT_020;6=RT_021;7=RT_022;8=RT_023;9=RT_024"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_DND_CANCEL" {
			title "Runtime - Column DnD cancel or invalid drop"
			include EXT_DND_ENGINE RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.steps" "1=RT_025;2=RT_026;3=RT_027"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_EXTERNAL_CHANGE_RECOVERY" {
			title "Runtime - Column DnD external change recovery"
			include RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_COLUMN_EXTERNAL_CHANGE_RECOVERY"
			properties {
				"runtime.steps" "1=RT_028;2=RT_029;3=RT_030;4=RT_031"
			}
			autoLayout lr
		}

		styles {
			element "Responsibility" {
				shape Box
			}
			element "External System" {
				shape RoundedBox
				background #f8fafc
				color #344054
				stroke #667085
				border solid
			}
			element "External Block" {
				shape Component
				background #eef4ff
				color #344054
				stroke #6172f3
			}
			element "External Capability" {
				shape Hexagon
				background #f4f3ff
				color #344054
				stroke #7f56d9
			}
			element "External Environment" {
				shape Box
				background #f2f4f7
				color #344054
				stroke #98a2b3
				border dashed
			}
			element "External Library" {
				shape Box
				background #fff7ed
				color #344054
				stroke #f79009
				border dashed
			}
			relationship "Structural Dependency" {
				style solid
			}
			relationship "Runtime Interaction" {
				style solid
			}
			relationship "normal" {
				style solid
			}
			relationship "failure" {
				color #b42318
				style dashed
				thickness 3
			}
			relationship "recovery" {
				color #b54708
				style dotted
				thickness 3
			}
		}
	}
}
