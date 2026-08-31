// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "QR-02で保証対象とする編集環境を提供し、Row Reorderの入力と表示が存在する。" {
			tags "External Context,External System"
		}
		EXT_SUPPORTED_TABLE_BLOCK = element "Supported Table Block" "External Block" "FR-13で定義されるCore TableまたはFlexible Table Blockであり、Table Integrationを介して行構造の取得と行順更新を行う対象。" {
			tags "External Context,External Block"
		}
		EXT_WORDPRESS_UNDO = element "WordPress Undo" "External Capability" "成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。" {
			tags "External Context,External Capability"
		}
		EXT_SCROLL_AREA = element "Editor Scroll Area" "External Environment" "行DnD中に縦方向へ自動スクロールする対象領域を提供する。" {
			tags "External Context,External Environment"
		}

		RESP_REORDER_MODE = element "Reorder Mode" "Responsibility" "Tableツールバーの行・列入口、`edit" {
			tags "Responsibility"
		}
		RESP_REORDER_GUIDANCE = element "Reorder Guidance" "Responsibility" "PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態を所有する外側の境界。" {
			tags "Responsibility"
		}
		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在のWordPress Editorに属するDOM / Web API contextを必要な時点で解決する。" {
			tags "Responsibility"
		}
		RESP_ROW_REDISCOVERY_DETECTION = element "Rediscovery Detection" "Responsibility" "通常編集時の反復操作から行を移動しようとする意図が成立したことだけを検出し、外側の案内境界へ通知する。" {
			tags "Responsibility"
		}
		RESP_ROW_INPUT_INTERACTION = element "Input Interaction" "Responsibility" "PCとタッチ端末の入力固有差を行DnDのstart、progress、complete、cancelへ変換する。" {
			tags "Responsibility"
		}
		RESP_ROW_TABLE_INTEGRATION = element "Table Integration" "Responsibility" "対応Table Blockとの差を吸収し、行並び替えに必要なTable同一性、現在構造、行更新境界を提供する。" {
			tags "Responsibility"
		}
		RESP_ROW_REORDER_TARGET_RESOLUTION = element "Reorder Target Resolution" "Responsibility" "DnD開始時に入力位置から移動対象行を特定し、その行が移動可能か判定する。" {
			tags "Responsibility"
		}
		RESP_ROW_DROP_TARGET_RESOLUTION = element "Drop Target Resolution" "Responsibility" "DnD中とcomplete時に、現在のTable構造で成立する行間の移動先を判定する。" {
			tags "Responsibility"
		}
		RESP_ROW_DND_INTERACTION = element "DnD Interaction" "Responsibility" "行DnDのSession、operation boundary、確定、中止、回復Lifecycleを所有する。" {
			tags "Responsibility"
		}
		RESP_ROW_DATA_UPDATE = element "Data Update" "Responsibility" "現在構造で成立することを確認済みの行移動を対応Table Blockの行順へ一度だけ反映する。" {
			tags "Responsibility"
		}
		RESP_ROW_PRESENTATION = element "Reorder Presentation" "Responsibility" "移動不可理由、行DnD中の視覚フィードバック、およびDesignで定義された異常終了通知を表現する。" {
			tags "Responsibility"
		}
		RESP_ROW_AUTO_SCROLL = element "Auto Scroll" "Responsibility" "行DnD中に必要な縦方向の自動スクロールを判断・制御する。" {
			tags "Responsibility"
		}

		DEP_001 = RESP_REORDER_MODE -> EXT_WORDPRESS_EDITOR "WordPress Editor上のTableツールバー入口、通常編集と行・列並び替えの排他、および対象Table単位のモードLifecycleを扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_002 = RESP_REORDER_GUIDANCE -> EXT_WORDPRESS_EDITOR "初回案内と再案内の表示契機、および行・列の入口をまとめて提示する編集環境を必要とする。" {
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
		DEP_006 = RESP_ROW_REDISCOVERY_DETECTION -> EXT_WORDPRESS_EDITOR "通常編集として成立する操作と行移動の再案内候補を区別するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_ROW_REDISCOVERY_DETECTION -> RESP_REORDER_MODE "通常編集状態でだけ行移動意図の検出を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_ROW_REDISCOVERY_DETECTION -> RESP_REORDER_GUIDANCE "成立した行移動意図を共通の再案内判断へ渡すために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_ROW_INPUT_INTERACTION -> EXT_WORDPRESS_EDITOR "PCまたはタッチ端末の入力を行DnD操作へ変換するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_ROW_INPUT_INTERACTION -> RESP_EDITOR_DOM_CONTEXT "入力処理で現在のeditor DOM contextを利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_ROW_INPUT_INTERACTION -> RESP_REORDER_MODE "行並び替えが有効な期間だけ行入力を受理するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_DND_INTERACTION "入力を行DnDのoperationへ渡すために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Block固有の行構造取得と行順更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_ROW_REORDER_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "移動対象行の成立判定に現在の行構造とTable同一性を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_ROW_DROP_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "progress中の移動先判定とcomplete時の再照合に現在の行構造とTable同一性を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "DnD終了後に現在のTableで行並び替えモードを安全に継続できるかという結果を外側のモード境界へ渡すために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_ROW_DND_INTERACTION -> RESP_ROW_REORDER_TARGET_RESOLUTION "Session開始前に移動可能な行を確定するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_ROW_DND_INTERACTION -> RESP_ROW_DROP_TARGET_RESOLUTION "active DnD中の移動先判定とcomplete時の現在構造への再照合を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "Sessionが参照するTable同一性と外部Tableの現在利用可否を確認するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_ROW_DND_INTERACTION -> RESP_ROW_DATA_UPDATE "現在構造でも成立することを確認できた行移動だけをTableへ反映するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = RESP_ROW_DATA_UPDATE -> RESP_ROW_TABLE_INTEGRATION "対応Table Block差を越えて行順を更新するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_022 = RESP_ROW_DATA_UPDATE -> EXT_WORDPRESS_UNDO "成立した1回の行並び替えを1回のUndoで戻せる更新単位を維持するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_023 = RESP_ROW_PRESENTATION -> RESP_EDITOR_DOM_CONTEXT "現在のeditor contextで行DnDの表示を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_024 = RESP_ROW_PRESENTATION -> RESP_ROW_DND_INTERACTION "移動不可理由、active DnD状態、終了時の表示解除、およびDesign上の通知要否を表示状態へ反映するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_025 = RESP_ROW_AUTO_SCROLL -> RESP_ROW_DND_INTERACTION "activeな行DnD状態と終了状態を自動スクロール判断に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_026 = RESP_ROW_AUTO_SCROLL -> RESP_EDITOR_DOM_CONTEXT "現在のeditor contextでスクロール対象を扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_027 = RESP_ROW_AUTO_SCROLL -> EXT_SCROLL_AREA "行DnD中に縦方向へスクロールできる外部領域を必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_ROW_INPUT_INTERACTION "WordPress Editorの入力が行並び替えの入力境界へ入る。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_002 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_DND_INTERACTION "入力方式固有の解釈から行DnDのstart、progress、complete、cancelへ進む。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_003 = RESP_ROW_DND_INTERACTION -> RESP_ROW_REORDER_TARGET_RESOLUTION "DnD開始試行から移動対象行の解決へ進む。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_004 = RESP_ROW_REORDER_TARGET_RESOLUTION -> RESP_ROW_DROP_TARGET_RESOLUTION "開始済み行DnDが有効な行間の移動先判定へ進む。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_005 = RESP_ROW_DROP_TARGET_RESOLUTION -> RESP_ROW_DATA_UPDATE "complete時の現在構造への再照合でも成立した移動だけが確定済み行移動の反映へ進む。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_006 = RESP_ROW_DATA_UPDATE -> RESP_ROW_TABLE_INTEGRATION "確定済み行移動を対応Table Block固有の更新境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_007 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Blockへtbodyの行順だけを反映する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_008 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_DND_INTERACTION "[failure] 現在のEditor contextを利用できないなど、外部環境変化による継続不能をoperation boundaryへ合流させる。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_009 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DND_INTERACTION "[failure] 対象Tableが現在利用できないなど、外部Table状態の変化による継続不能をoperation boundaryへ合流させる。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_010 = RESP_ROW_DROP_TARGET_RESOLUTION -> RESP_ROW_DND_INTERACTION "[failure] complete時の現在構造への再照合でSessionの最終移動先が成立しないことを正常な確定不能結果として返す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_011 = RESP_ROW_DATA_UPDATE -> RESP_ROW_DND_INTERACTION "[failure] 更新開始前に現在の外部Table状態では更新できないことを正常な確定不能結果として返す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_012 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "[recovery] DnD中だけの表示状態を解除し、安全な操作継続不能による終了ではDesignで定義された通知を要求する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery"
		}
		PF_013 = RESP_ROW_DND_INTERACTION -> RESP_ROW_AUTO_SCROLL "[recovery] 行DnDの自動スクロール一時状態を終了する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery"
		}
		PF_014 = RESP_ROW_DND_INTERACTION -> RESP_ROW_INPUT_INTERACTION "[recovery] 入力方式固有のDnD一時状態を終了する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,ProcessFlow_PV_ROW_ACTIVE_DND_FAILURE_RECOVERY,ProcessFlow_PV_ROW_DATA_UPDATE_FAILURE_RECOVERY,recovery"
		}
		PF_015 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "[recovery] DnD終了後に現在のTableで行並び替えモードを安全に継続できるかを外側のモード境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,ProcessFlow_PV_ROW_ACTIVE_DND_FAILURE_RECOVERY,ProcessFlow_PV_ROW_DATA_UPDATE_FAILURE_RECOVERY,recovery"
		}
		PF_016 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DND_INTERACTION "[failure] start処理中に検出されたRow Reorder所有のContractまたはInvariant違反をoperation boundaryへ伝播する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_START_FAILURE_RECOVERY,failure"
		}
		PF_017 = RESP_ROW_REORDER_TARGET_RESOLUTION -> RESP_ROW_DND_INTERACTION "[failure] 移動対象解決中に検出された内部Errorをstart operation boundaryへ伝播する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_START_FAILURE_RECOVERY,failure"
		}
		PF_018 = RESP_ROW_DND_INTERACTION -> RESP_ROW_INPUT_INTERACTION "[recovery] startに属する入力一時状態を破棄し、Sessionを開始せずidleへ戻る。" {
			tags "Process Flow,ProcessFlow_PV_ROW_START_FAILURE_RECOVERY,recovery"
		}
		PF_019 = RESP_ROW_DROP_TARGET_RESOLUTION -> RESP_ROW_DND_INTERACTION "[failure] progressまたはcomplete中の移動先判定で検出された内部Errorをoperation boundaryへ伝播する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_ACTIVE_DND_FAILURE_RECOVERY,failure"
		}
		PF_020 = RESP_ROW_PRESENTATION -> RESP_ROW_DND_INTERACTION "[failure] active DnD中の表示責務で検出された内部Errorをoperation boundaryまたは必要なexecution boundaryから共通中止経路へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_ACTIVE_DND_FAILURE_RECOVERY,failure"
		}
		PF_021 = RESP_ROW_AUTO_SCROLL -> RESP_ROW_DND_INTERACTION "[failure] active DnD中の自動スクロール責務で検出された内部Errorをoperation boundaryまたは必要なexecution boundaryから共通中止経路へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_ACTIVE_DND_FAILURE_RECOVERY,failure"
		}
		PF_022 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "[recovery] DnD中だけの表示状態を解除し、異常終了としてDesignで定義された通知を要求する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_ACTIVE_DND_FAILURE_RECOVERY,ProcessFlow_PV_ROW_DATA_UPDATE_FAILURE_RECOVERY,recovery"
		}
		PF_023 = RESP_ROW_DND_INTERACTION -> RESP_ROW_AUTO_SCROLL "[recovery] 自動スクロール一時状態を終了する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_ACTIVE_DND_FAILURE_RECOVERY,ProcessFlow_PV_ROW_DATA_UPDATE_FAILURE_RECOVERY,recovery"
		}
		PF_024 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DATA_UPDATE "[failure] 更新処理中に検出された内部ErrorをData Updateへ伝播する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_DATA_UPDATE_FAILURE_RECOVERY,failure"
		}
		PF_025 = RESP_ROW_DATA_UPDATE -> RESP_ROW_DND_INTERACTION "[failure] complete処理を継続できない内部Errorをoperation boundaryへ伝播する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_DATA_UPDATE_FAILURE_RECOVERY,failure"
		}

		RT_001 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_DND_INTERACTION "行DnDのstart operationと開始位置を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.1" "行DnDのstart operationと開始位置を渡す。"
			}
		}
		RT_002 = RESP_ROW_DND_INTERACTION -> RESP_ROW_REORDER_TARGET_RESOLUTION "開始位置から移動対象行の解決と移動可否判定を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.2" "開始位置から移動対象行の解決と移動可否判定を要求する。"
			}
		}
		RT_003 = RESP_ROW_REORDER_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在の対象Table情報を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.3" "現在の対象Table情報を要求する。"
			}
		}
		RT_004 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在の対応Table Blockから行構造とTable同一性を取得する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_START.step.4" "現在の対応Table Blockから行構造とTable同一性を取得する。"
				"runtime.RV_ROW_DND_COMPLETE.step.4" "現在の対応Table Blockから行構造とTable同一性を取得する。"
			}
		}
		RT_005 = RESP_ROW_REORDER_TARGET_RESOLUTION -> RESP_ROW_DND_INTERACTION "移動可能な行、または開始できない正常な理由を通知する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.5" "移動可能な行、または開始できない正常な理由を通知する。"
			}
		}
		RT_006 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "Session開始時は移動対象行のDnD表示を開始し、開始拒否時は必要な理由表示を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.6" "Session開始時は移動対象行のDnD表示を開始し、開始拒否時は必要な理由表示を要求する。"
			}
		}
		RT_007 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_DND_INTERACTION "行DnDのprogress operationと現在位置を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.1" "行DnDのprogress operationと現在位置を渡す。"
			}
		}
		RT_008 = RESP_ROW_DND_INTERACTION -> RESP_ROW_DROP_TARGET_RESOLUTION "現在位置に対応する有効な行間の判定を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.2" "現在位置に対応する有効な行間の判定を要求する。"
			}
		}
		RT_009 = RESP_ROW_DROP_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在のTable同一性と行構造を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.3" "現在のTable同一性と行構造を要求する。"
				"runtime.RV_ROW_DND_COMPLETE.step.3" "現在のTable同一性と行構造を要求する。"
			}
		}
		RT_010 = RESP_ROW_DROP_TARGET_RESOLUTION -> RESP_ROW_DND_INTERACTION "有効な移動先、または現在は確定できない正常な結果を通知する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.4" "有効な移動先、または現在は確定できない正常な結果を通知する。"
			}
		}
		RT_011 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "現在の移動先と周囲行の一時表示を更新する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.5" "現在の移動先と周囲行の一時表示を更新する。"
			}
		}
		RT_012 = RESP_ROW_DND_INTERACTION -> RESP_ROW_AUTO_SCROLL "現在位置に応じた縦方向自動スクロールの更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.6" "現在位置に応じた縦方向自動スクロールの更新を要求する。"
			}
		}
		RT_013 = RESP_ROW_AUTO_SCROLL -> EXT_SCROLL_AREA "必要な場合だけ現在のEditor Scroll Areaを縦方向へスクロールする。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.7" "必要な場合だけ現在のEditor Scroll Areaを縦方向へスクロールする。"
			}
		}
		RT_014 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_DND_INTERACTION "行DnDのcomplete operationを渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.1" "行DnDのcomplete operationを渡す。"
			}
		}
		RT_015 = RESP_ROW_DND_INTERACTION -> RESP_ROW_DROP_TARGET_RESOLUTION "Sessionの移動対象と最終有効移動先が現在のTable構造でも成立するか再照合を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.2" "Sessionの移動対象と最終有効移動先が現在のTable構造でも成立するか再照合を要求する。"
			}
		}
		RT_016 = RESP_ROW_DROP_TARGET_RESOLUTION -> RESP_ROW_DND_INTERACTION "現在も成立する確定可能結果、または外部状態変化による正常な確定不能結果を通知する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.5" "現在も成立する確定可能結果、または外部状態変化による正常な確定不能結果を通知する。"
			}
		}
		RT_017 = RESP_ROW_DND_INTERACTION -> RESP_ROW_DATA_UPDATE "現在も成立することを確認できた場合だけ確定済み行移動の反映を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.6" "現在も成立することを確認できた場合だけ確定済み行移動の反映を要求する。"
			}
		}
		RT_018 = RESP_ROW_DATA_UPDATE -> RESP_ROW_TABLE_INTEGRATION "対応Table Block固有の行順更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.7" "対応Table Block固有の行順更新を要求する。"
			}
		}
		RT_019 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "tbodyの行順だけを確定結果として更新する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.8" "tbodyの行順だけを確定結果として更新する。"
			}
		}
		RT_020 = RESP_ROW_DATA_UPDATE -> EXT_WORDPRESS_UNDO "成立した行並び替えを1回のUndoで戻せる更新単位として維持する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.9" "成立した行並び替えを1回のUndoで戻せる更新単位として維持する。"
			}
		}
		RT_021 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "DnD中だけの表示を終了する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.10" "DnD中だけの表示を終了する。"
			}
		}
		RT_022 = RESP_ROW_DND_INTERACTION -> RESP_ROW_AUTO_SCROLL "行DnDの自動スクロール状態を終了する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.11" "行DnDの自動スクロール状態を終了する。"
			}
		}
		RT_023 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "complete終了後も現在のTableで行並び替えモードを維持できる結果を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.12" "complete終了後も現在のTableで行並び替えモードを維持できる結果を渡す。"
			}
		}
		RT_024 = RESP_ROW_DND_INTERACTION -> RESP_ROW_DROP_TARGET_RESOLUTION "complete時はSessionの最終移動先を現在構造へ再照合する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.1" "complete時はSessionの最終移動先を現在構造へ再照合する。"
			}
		}
		RT_025 = RESP_ROW_DROP_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在の対象Table情報を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.2" "現在の対象Table情報を要求する。"
			}
		}
		RT_026 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DROP_TARGET_RESOLUTION "現在のTable情報、または対象Tableが利用できない正常な不在を返す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.3" "現在のTable情報、または対象Tableが利用できない正常な不在を返す。"
			}
		}
		RT_027 = RESP_ROW_DROP_TARGET_RESOLUTION -> RESP_ROW_DND_INTERACTION "現在構造では移動を確定できない正常な結果を通知する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.4" "現在構造では移動を確定できない正常な結果を通知する。"
			}
		}
		RT_028 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "DnD中だけの表示を解除し、安全な操作継続不能による終了としてDesignで定義された通知を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.5" "DnD中だけの表示を解除し、安全な操作継続不能による終了としてDesignで定義された通知を要求する。"
			}
		}
		RT_029 = RESP_ROW_DND_INTERACTION -> RESP_ROW_AUTO_SCROLL "自動スクロール状態を終了する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.6" "自動スクロール状態を終了する。"
			}
		}
		RT_030 = RESP_ROW_DND_INTERACTION -> RESP_ROW_INPUT_INTERACTION "入力方式固有のDnD一時状態を終了する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.7" "入力方式固有のDnD一時状態を終了する。"
			}
		}
		RT_031 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT,Runtime_RV_ROW_DND_FAILURE_RECOVERY"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.8" "現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。"
				"runtime.RV_ROW_DND_FAILURE_RECOVERY.step.5" "現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。"
			}
		}
		RT_032 = RESP_ROW_AUTO_SCROLL -> RESP_ROW_DND_INTERACTION "通常のoperation boundaryへ伝播できないexecution boundaryで捕捉したErrorを、元のoperation情報とともに同じ共通中止経路へ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_FAILURE_RECOVERY"
			properties {
				"runtime.RV_ROW_DND_FAILURE_RECOVERY.step.1" "通常のoperation boundaryへ伝播できないexecution boundaryで捕捉したErrorを、元のoperation情報とともに同じ共通中止経路へ渡す。"
			}
		}
		RT_033 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "共通中止経路としてDnD中だけの表示を解除し、Designで定義された異常終了通知を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_FAILURE_RECOVERY"
			properties {
				"runtime.RV_ROW_DND_FAILURE_RECOVERY.step.2" "共通中止経路としてDnD中だけの表示を解除し、Designで定義された異常終了通知を要求する。"
			}
		}
		RT_034 = RESP_ROW_DND_INTERACTION -> RESP_ROW_AUTO_SCROLL "共通中止経路として自動スクロール状態を終了する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_FAILURE_RECOVERY"
			properties {
				"runtime.RV_ROW_DND_FAILURE_RECOVERY.step.3" "共通中止経路として自動スクロール状態を終了する。"
			}
		}
		RT_035 = RESP_ROW_DND_INTERACTION -> RESP_ROW_INPUT_INTERACTION "共通中止経路として入力方式固有のDnD一時状態を終了する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_FAILURE_RECOVERY"
			properties {
				"runtime.RV_ROW_DND_FAILURE_RECOVERY.step.4" "共通中止経路として入力方式固有のDnD一時状態を終了する。"
			}
		}
	}

	views {
		custom "DV_ROW_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_REDISCOVERY_DETECTION RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_REORDER_TARGET_RESOLUTION RESP_ROW_DROP_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_DATA_UPDATE RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_ROW_EDITOR_INTERACTION" {
			title "Structural Dependencies - Editor Interaction"
			include EXT_WORDPRESS_EDITOR RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_REDISCOVERY_DETECTION RESP_ROW_INPUT_INTERACTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_ROW_DND_CORE" {
			title "Structural Dependencies - DnD Core"
			include EXT_SUPPORTED_TABLE_BLOCK RESP_REORDER_MODE RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_REORDER_TARGET_RESOLUTION RESP_ROW_DROP_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_DATA_UPDATE
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_ROW_FEEDBACK" {
			title "Structural Dependencies - DnD Feedback"
			include EXT_SCROLL_AREA RESP_EDITOR_DOM_CONTEXT RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "DV_ROW_DATA_UPDATE" {
			title "Structural Dependencies - Data Update"
			include EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_ROW_DND_INTERACTION RESP_ROW_DATA_UPDATE RESP_ROW_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "PV_ROW_REORDER_END_TO_END" {
			title "Process Flow - Row Reorder End-to-End"
			include EXT_WORDPRESS_EDITOR RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_INTERACTION RESP_ROW_REORDER_TARGET_RESOLUTION RESP_ROW_DROP_TARGET_RESOLUTION RESP_ROW_DATA_UPDATE RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK
			exclude "relationship.tag!=ProcessFlow_PV_ROW_REORDER_END_TO_END"
			autoLayout lr
		}

		custom "PV_ROW_EXTERNAL_CHANGE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - External Environment Change and Recovery"
			include RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DROP_TARGET_RESOLUTION RESP_ROW_DATA_UPDATE RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL RESP_REORDER_MODE
			exclude "relationship.tag!=ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY"
			autoLayout lr
		}

		custom "PV_ROW_START_FAILURE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - Start Failure and Recovery"
			include RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_REORDER_TARGET_RESOLUTION RESP_ROW_INPUT_INTERACTION
			exclude "relationship.tag!=ProcessFlow_PV_ROW_START_FAILURE_RECOVERY"
			autoLayout lr
		}

		custom "PV_ROW_ACTIVE_DND_FAILURE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - Active DnD Failure and Recovery"
			include RESP_ROW_DROP_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL RESP_ROW_INPUT_INTERACTION RESP_REORDER_MODE
			exclude "relationship.tag!=ProcessFlow_PV_ROW_ACTIVE_DND_FAILURE_RECOVERY"
			autoLayout lr
		}

		custom "PV_ROW_DATA_UPDATE_FAILURE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - Data Update Failure and Recovery"
			include RESP_ROW_TABLE_INTEGRATION RESP_ROW_DATA_UPDATE RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL RESP_ROW_INPUT_INTERACTION RESP_REORDER_MODE
			exclude "relationship.tag!=ProcessFlow_PV_ROW_DATA_UPDATE_FAILURE_RECOVERY"
			autoLayout lr
		}

		custom "RV_ROW_DND_START" {
			title "Runtime - Row DnD start attempt"
			include RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_INTERACTION RESP_ROW_REORDER_TARGET_RESOLUTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_ROW_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_ROW_DND_START"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_PROGRESS" {
			title "Runtime - Row DnD progress"
			include RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_INTERACTION RESP_ROW_DROP_TARGET_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL EXT_SCROLL_AREA
			exclude "relationship.tag!=Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.steps" "1=RT_007;2=RT_008;3=RT_009;4=RT_010;5=RT_011;6=RT_012;7=RT_013"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_COMPLETE" {
			title "Runtime - Row DnD complete"
			include RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_INTERACTION RESP_ROW_DROP_TARGET_RESOLUTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_ROW_DATA_UPDATE EXT_WORDPRESS_UNDO RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.steps" "1=RT_014;2=RT_015;3=RT_009;4=RT_004;5=RT_016;6=RT_017;7=RT_018;8=RT_019;9=RT_020;10=RT_021;11=RT_022;12=RT_023"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_EXTERNAL_ABORT" {
			title "Runtime - Row DnD external change abort"
			include RESP_ROW_DND_INTERACTION RESP_ROW_DROP_TARGET_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_PRESENTATION RESP_ROW_AUTO_SCROLL RESP_ROW_INPUT_INTERACTION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.steps" "1=RT_024;2=RT_025;3=RT_026;4=RT_027;5=RT_028;6=RT_029;7=RT_030;8=RT_031"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_FAILURE_RECOVERY" {
			title "Runtime - Row DnD internal failure recovery"
			include RESP_ROW_AUTO_SCROLL RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_INPUT_INTERACTION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_ROW_DND_FAILURE_RECOVERY"
			properties {
				"runtime.steps" "1=RT_032;2=RT_033;3=RT_034;4=RT_035;5=RT_031"
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
