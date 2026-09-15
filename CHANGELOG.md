# Changelog

椤圭洰鍙樻洿鏃ュ織銆傛瘡娆′慨鏀逛粨搴撴枃浠舵椂閮藉繀椤诲湪姝ゆ坊鍔犺褰曘€?

## [2026-09-15]

-   feat(destop): JSON 编辑器中的数组字段改为紧凑表格，支持逐项编辑、添加与删除数组项。
-   test(destop): 补充 JsonEditor 数组项增删改测试。

-   fix(destop): Meta 预加载不再作为预加载数据显示，改为展示 mod 预加载。
-   fix(destop): mod 预加载 JSON 分组标签改为“mod 预加载”。
-   test(destop): 补充 mod 预加载展示与解析测试。
-   test(destop): add Vitest tests for json/preload/theme/language utilities and DataTable/JsonEditor components.
-   style(destop): 绉婚櫎 JSON 缂栬緫鍣ㄩ《閮ㄧ殑璁板綍 key/id 涓庡瓧娈垫暟閲忎俊鎭潯銆?
-   feat(types): 鏂板 Data/TuJianChunWenBen.json 瀵瑰簲鐨勮瘝缂€绫诲瀷骞跺鍑?TuJianChunWenBen銆?
-   feat(destop): 椤圭洰璇诲彇鏂板 Data/TuJianChunWenBen.json 璇嶇紑鍒嗙粍锛屾敮鎸佸睍绀恒€佺紪杈戜笌鍥炲啓銆?
-   feat(i18n): 琛ュ厖璇嶇紑瀛楁涓枃鏂囨锛屽苟鏆傛椂闅愯棌琛ㄦ牸涓殑 name1 濉啓瀛楁銆?
-   feat(destop): 鏂板淇濆瓨椤圭洰鍔熻兘锛屾枃浠惰彍鍗曞彲鍐欏洖 mod JSON 骞舵樉绀烘湭淇濆瓨鏍囪涓庣粨鏋滄彁绀恒€?
-   feat(destop): Tauri 鏂板 write_project_file 鍛戒护锛屾寜鐩稿璺緞鍐欏洖鏂囦欢骞惰嚜鍔ㄥ垱寤虹埗鐩綍銆?
-   feat(destop): 椤圭洰缂栬緫鍚庢爣璁版湭淇濆瓨鐘舵€侊紝淇濆瓨鑿滃崟椤规樉绀烘槦鍙锋爣璁帮紝淇濆瓨鎴愬姛鏄剧ず宸蹭繚瀛樻彁绀恒€?
-   feat(destop): Meta 棰勫姞杞戒笌 mod 棰勫姞杞芥媶鍒嗕负涓ょ被鐙珛閰嶇疆锛岃缃獥鍙ｅ悇缁存姢涓€浠藉垪琛ㄣ€?
-   feat(destop): 宸︿晶鏍忔媶鍒嗕负鈥滈鍔犺浇鏁版嵁鈥濆拰鈥滈」鐩暟鎹€濓紝鏀寔鏁村尯銆佸崟涓?mod 鎶樺彔銆?
-   feat(destop): 鏂板缓 mod 鑷姩濉厖榛樿绌哄垎缁勶紝鍙抽敭 mod 鏀寔閲嶅懡鍚嶄笌鍒犻櫎銆?
-   fix(destop): JSON 瑙ｆ瀽鍏煎 BOM 涓庡熬閫楀彿锛屼慨澶?Meta 鐩綍棰勫姞杞藉け璐ャ€?
-   fix(destop): 涓棿琛ㄦ牸鎸夊垎缁勭被鍨嬫樉绀轰富閿垪锛屾棤涓婚敭瀛楁鐨勬暟鎹笉鍐嶇敓鎴愪吉 ID銆?
-   style(destop): Tip 鎻愮ず鏀逛负椤甸潰椤堕儴灞呬腑鏄剧ず銆?
-   feat(destop): 鏂板鍙鐢ㄧ殑 Tip 缁勪欢锛岃缃獥鍙ｄ繚瀛樺悗鏄剧ず鈥滃凡淇濆瓨鈥濇彁绀恒€?
-   feat(destop): Meta 棰勫姞杞芥敼涓哄鏉＄洰鍒楄〃锛屾敮鎸佸姞鍙锋坊鍔?JSON 鎴栫洰褰曞苟閫夋嫨璺緞銆?
-   style(destop): 璁剧疆绐楀彛淇濆瓨鎸夐挳鍥哄畾鍒板彸涓嬭銆?
-   fix(destop): error-log 绐楀彛鍔犲叆 Tauri capabilities锛屼慨澶嶆嫋鎷姐€佹渶灏忓寲銆佹渶澶у寲涓庡叧闂寜閽€?
-   fix(destop): 鍚姩棰勫姞杞藉け璐ヤ篃浼氬啓鍏?error.log銆?
-   feat(destop): 閿欒鎻愮ず绉昏嚦涓荤晫闈㈠簳閮紝涓嶉樆鏂富鐣岄潰鎿嶄綔銆?
-   feat(destop): 鍏充簬鑿滃崟鏂板閿欒鏃ュ織绐楀彛锛屼笌璁剧疆绐楀彛缁熶竴涓虹嫭绔嬫柊绐楀彛銆?
-   feat(destop): 鏂板 error.log 鏈湴璇诲啓鍛戒护锛屾瘡娆″惎鍔ㄩ噸鍐欙紝褰撴杩愯閿欒鍕惧瓨鑷虫湰鍦版枃浠躲€?
-   fix(destop): 棰勫姞杞藉け璐ユ椂涓嶅啀闃绘柇杩涘叆涓荤晫闈紝鏀逛负椤堕儴闈為樆鏂彁绀恒€?
-   feat(destop): 鏂板鍚姩棰勫姞杞界晫闈紝榛樿鍔犺浇 ./Editor 涓嬬殑 mod JSON锛屾敮鎸?JSON 鏂囦欢鎴栫洰褰曟ā寮忋€?
-   feat(destop): 璁剧疆涓柊澧?JSON 棰勫姞杞芥潵婧愶紝鍙€夋嫨鍔犺浇 JSON 鎴栧姞杞界洰褰曞苟鎸佷箙鍖栬矾寰勩€?
-   feat(types): 鏂板 PreloadSourceMode 鏋氫妇涓?ProjectSettings 棰勫姞杞藉瓧娈碉紝ProjectModGroupKey 澧炲姞 preload 鍒嗙粍銆?
-   feat(destop): Tauri 鍚庣鏂板 read_json_file 鍛戒护锛屾敮鎸佸崟涓?JSON 鏂囦欢棰勫姞杞姐€?
-   chore: Data/ 鐩綍鍔犲叆 .gitignore 骞朵粠 git 绱㈠紩绉婚櫎锛岀鐩樻暟鎹繚鐣欐湰鍦般€?
-   feat(types): 鏂板 Data/Meta 鍏冩暟鎹?JSON 瀵瑰簲鐨?TypeScript 绫诲瀷锛屽鍑轰负 packages/types/src/data/meta銆?
-   feat(destop): 璁剧疆绐楀彛鏂板鈥滆瑷€鈥濅笅鎷夋锛屾寜涓婚妯″紡鎸佷箙鍖栧苟璺ㄧ獥鍙ｅ悓姝ャ€?
-   feat(types): 鏂板 AppLanguage 鏋氫妇锛屽苟灏?ProjectSettings.language 鎻愪緵缁欒缃瓨鍌ㄣ€?
-   docs(i18n): 琛ュ厖 en/zh-CN 璇█璁剧疆鐩稿叧鏂囨銆?
-   feat(destop): 鏂囦欢 > 鎵撳紑椤圭洰鏀逛负绯荤粺鐩綍閫夋嫨鍣紝閫氳繃 Rust 鍛戒护閫掑綊璇诲彇椤圭洰 JSON 鏂囦欢锛屼笉鍐嶄娇鐢ㄦ枃浠朵笂浼犳帶浠躲€?
-   feat(destop): 鍙充晶鏂板 JSON 缂栬緫鍣紝鎸夊瓧娈垫樉绀?i18n 鏂囨涓庣被鍨嬪搴旇緭鍏ユ锛屾敮鎸佸瓧绗︿覆/鏁板瓧/甯冨皵/鏁扮粍/瀵硅薄缂栬緫骞跺疄鏃跺洖鍐欒〃鏍笺€?
-   build(destop): 鏂板 @tauri-apps/plugin-dialog 涓?tauri-plugin-dialog 渚濊禆锛屾敞鍐?dialog 鎻掍欢涓?read_project_files 鍛戒护銆?
-   fix(destop): 淇鍘熺敓鐩綍璇诲彇杩斿洖瀛楁鍚嶄笌鍓嶇涓嶄竴鑷村鑷寸殑 JSON 瑙ｆ瀽宕╂簝锛孯ust 绔簭鍒楀寲鏀逛负 camelCase銆?
-   style(destop): JSON 缂栬緫鍣ㄤ粎鏄剧ず瀛楁鐨?i18n 璇█鍚嶏紝绉婚櫎瀛楁涓嬫柟鐨?key 灞曠ず銆?
-   fix(i18n): 閲嶆柊鐢熸垚鍒嗙粍瀛楁鏄犲皠锛岃ˉ榻?qingjiaotype銆丼kill_LV 绛夐仐婕忓瓧娈电殑涓枃鏂囨銆?
-   feat(destop): 璁剧疆绐楀彛鏂板鐣岄潰璇█閫夋嫨骞舵敮鎸佽法绐楀彛鍚屾銆?
-   feat(types): 鏂板 AppLanguage 鏋氫妇涓庡伐绋嬭缃?language 瀛楁銆?
-   fix(destop): 淇涓婚鍦ㄤ富绐楀彛涓嶇敓鏁堢殑闂锛屼富棰樺垏鎹㈤€氳繃 Tauri 浜嬩欢璺ㄧ獥鍙ｅ疄鏃跺悓姝ワ紙鍚祻瑙堝櫒棰勮 storage 鍏滃簳锛夈€?
-   feat(destop): 璁剧疆鐣岄潰銆屼富棰樺瑙傘€嶆敼涓轰笅鎷夋锛屽皝瑁呴€氱敤 Select 缁勪欢锛屽苟鍦ㄥ彸涓婅鏂板淇濆瓨鎸夐挳銆?
-   fix(destop): 淇涓荤獥鍙ｄ笌璁剧疆绐楀彛涓婚涓嶅悓姝モ€斺€擳auri capabilities 琛ラ綈 settings 绐楀彛鏉冮檺锛坈ore:event 绛夛級锛屽苟璁?storage 鍏滃簳涔熷簲鐢ㄤ富棰樸€?
-   style(destop): 淇绐楀彛鎺у埗鎸夐挳锛堟渶灏忓寲/鏈€澶у寲/鍏抽棴锛夊浘鏍囨湭灞呬腑鐨勯棶棰橈紝鏀圭敤 flex 灞呬腑甯冨眬銆?
-   feat(destop): 涓鸿缃瓙绐楀彛澧炲姞鑷畾涔夋嫋鎷芥爮涓庢渶灏忓寲/鏈€澶у寲/鍏抽棴鎸夐挳锛堝簲鐢?decorations:false锛屽鐢?WindowControls锛夈€?
-   style(destop): 璋冩暣璁剧疆绐楀彛銆屼繚瀛樸€嶆寜閽綅缃紝鍥哄畾浜庨《閮ㄥ彸涓婅锛屼笌绐楀彛鎺у埗鎸夐挳骞舵帓銆?
-   refactor(destop): 鍒犻櫎涓荤晫闈㈡爣棰樻爮銆岃鍥俱€嶄富棰樺垏鎹㈣彍鍗曪紝涓婚缁熶竴鐢辫缃獥鍙ｇ鐞嗭紝骞舵竻鐞嗗搴?prop/鐘舵€併€?

## [2026-09-14]

-   style(destop): 妗岄潰绔紩鍏ャ€岄潚榛戣壊銆嶄富棰?Token 绯荤粺锛屼互璇箟鑹茬被鏇挎崲鍏ㄩ儴鐏拌壊闃朵笌钃濊壊寮鸿皟锛坅ccent/ink/panel/raised/base 绛夛級銆?
-   feat(destop): 涓婚绯荤粺鎵╁睍涓轰笁娆撅紙闈掗粦鑹?鏆楄壊榛?浜壊鐧斤級锛屾柊澧?data-theme Token銆佹寔涔呭寲涓庢爣棰樻爮/璁剧疆椤靛垏鎹€?
-   feat(destop): 璁剧疆鐣岄潰鏀逛负鐙珛绐楀彛锛岀敱鈥滃叧浜?> 璁剧疆鈥濇墦寮€锛岀獥鍙ｅ唴瀹规殏涓?TODO銆?

## [2026-09-13]

-   feat(types): 瑙ｆ瀽 Data/NPCLeiXingDate.json 骞剁敓鎴?TypeScript 绫诲瀷锛屽瓨鍏?packages/types 鍏变韩绫诲瀷鍖呫€?
-   feat(types): 瑙ｆ瀽 Data/NPCWuDaoJson.json 骞剁敓鎴?TypeScript 绫诲瀷锛屽瓨鍏?packages/types 鍏变韩绫诲瀷鍖呫€?
-   feat(types): 瑙ｆ瀽 Data 涓?BuffJsonData/ItemJsonData/skillJsonData/StaticSkillJsonData.json锛屽垎鍒敓鎴愬搴?TypeScript 绫诲瀷骞跺瓨鍏?packages/types 鍏变韩绫诲瀷鍖呫€?
-   fix(types): SkillJsonData/ItemJsonData 涓?Affix銆亀uDao銆乻kill_SameCastNum 淇涓?number[]銆?
-   refactor(types): 灏嗘暟鎹被鍨嬬洰褰曠敱 generated 鏇村悕涓?data锛屽苟鏂板 enums 鏋氫妇绫诲瀷涓撶敤鐩綍銆?
-   docs: 鏂板 AGENTS.md锛岃褰曢」鐩粨鏋勩€佸伐绋嬭鍒欎笌淇敼鏃ュ織瑙勫垯銆?
-   docs: 鏂板椤圭洰绾ц鍒欐枃浠?`.codex/rules.md`锛堜粎浣滅敤浜庢湰浠撳簱锛夈€?
-   chore: 鍩虹椤圭洰鍚嶇О鐢?baize 鏀逛负 baize-next锛屽苟鍚屾鏇存柊 README銆丄GENTS.md 涓?.codex/rules.md銆?
-   chore: 瀛愬寘浣滅敤鍩熷悕鐢?`@baize/*` 缁熶竴鏀逛负 `@baize-next/*`锛屽苟鍚屾鏇存柊 AGENTS.md 涓?.codex/rules.md銆?# [2026-09-14]

-   perf(destop): 婊氬姩鏉℃敼鐢?requestAnimationFrame 鐩存帴鍒锋柊婊戝潡浣嶇Щ锛岀Щ闄?transform 杩囨浮锛屾粊娑傛洿涓濇粦銆?
-   style(destop): 缁嗗寲婊氬姩鏉℃牱寮忥紙杞ㄩ亾鏀剁粏涓?10px锛屾粦鍧楁敼涓鸿摑鑹诧紝鏃犳粴鍔ㄦ椂杞ㄩ亾寮卞寲锛夈€?
-   fix(destop): 淇鑷畾涔夋粴鍔ㄦ潯棣栨娓叉煋鍚庝笉鍙鐨勯棶棰橈紙杞ㄩ亾甯搁┗銆佹牴鎹唴瀹规孩鍑哄姩鎬佸睍绀烘粦鍧楋級銆?
-   style(destop): 婊氬姩鏉℃敼涓虹嫭绔嬭建閬撳竷灞€锛堢旱/妯悜杞ㄩ亾鍗犳嵁鍥哄畾瀹介珮锛夛紝涓嶅啀閬尅琛ㄦ牸鍐呭銆?
-   style(destop): 鎻愬崌婊氬姩鏉¤建閬撲笌婊戝潡瀵规瘮搴︼紙闈掕壊婊戝潡 + 鐏拌壊杞ㄩ亾锛夛紝鏃犳粴鍔ㄦ椂鑷姩闅愯棌杞ㄩ亾銆?
-   style(destop): 璋冩暣鏁版嵁琛ㄦ牸鍒楀/琛岄珮锛屾柊澧?min-w-max 浠ユ敮鎸佹í鍚戞粴鍔ㄣ€?
-   style(destop): 婊氬姩鏉￠鐣?padding锛屼负铔囧舰杞ㄩ亾璁╀綅锛屼笉鍐嶉伄鎸¤〃鏍煎唴瀹广€?
-   fix(destop): 鏁版嵁琛ㄦ牸杩囨护 id 瀛楁锛岄伩鍏嶄笌 ID 鍒楅噸澶嶅睍绀恒€?
-   feat(destop): 鍒濆鐗堟湰 create Tauri 妗岄潰绔簲鐢?@baize-next/destop锛屽熀浜?React 18 + TypeScript + Tailwind CSS銆?
-   feat(destop): 瀹炵幇涓夋爮甯冨眬锛氬乏鏍忛€夋嫨 JSON 鏁版嵁闆嗭紝涓爮琛ㄦ牸灞曠ず璁板綍锛屽彸鏍忕紪杈戝綋鍓嶈褰?JSON 骞跺疄鏃舵洿鏂般€?
-   feat(destop): 闅愯棌绯荤粺榛樿鏍囬鏍忥紝瀹炵幇鑷畾涔変换鍔℃爮锛堟嫋鎷姐€佸叧闂?鏈€灏忓寲/鏈€澶у寲銆佹枃浠?鍏充簬鑿滃崟锛夈€?
-   feat(destop): 鏂板 Tauri v2 鍚庣閰嶇疆锛坱auri.conf.json銆乧apabilities锛変笌搴旂敤鍥炬爣銆?
-   feat(i18n): 鍒濆鍖?@baize-next/i18n 鍏变韩瀛愬寘
-   refactor(i18n): locale JSON 璋冩暣涓哄祵濂楃粨鏋勶細{ 琛ㄥ悕: { 瀛楁鍚? 鏂囨 } }锛屽彇娑堝钩閾?key銆?
-   docs(i18n): 琛ュ厖 BuffJsonData 瀛楁鐨勪腑鏂囨枃妗堬紙鍖呭惈瀛楁璇存槑鏄犲皠銆?
-   docs(i18n): 琛ュ厖 ItemJsonData 瀛楁鐨勪腑鏂囨枃妗堬紙鍖呭惈瀛楁璇存槑鏄犲皠锛夈€?
-   docs(i18n): 琛ュ厖 SkillJsonData 涓?StaticSkillJsonData 瀛楁鐨勪腑鏂囨枃妗堬紙鍖呭惈瀛楁璇存槑鏄犲皠锛夈€?
-   docs(i18n): 琛ュ厖 NPCLeiXingDate 涓?NPCWuDaoJson 瀛楁鐨勪腑鏂囨枃妗堬紙鍖呭惈瀛楁璇存槑鏄犲皠锛夈€?
-   feat(types): 鏂板 ModConfig 绫诲瀷涓?i18n 鏂囨锛岃鐩?mod 鍚嶇О/浣滆€?鐗堟湰/浠嬬粛/璁剧疆鍙婅缃€夐」銆?
-   feat(types): 鏂板椤圭洰璁剧疆涓撶敤绫诲瀷 ProjectSettings 涓庝富棰樿壊鏋氫妇 ThemeColor锛堜寒鑹?鏆楄壊/闈掗粦鑹诧級锛屽苟琛ュ厖 i18n 鏂囨銆傦紝鏂板 en/zh-CN 鏂囨鏄犲皠锛岃嫳鏂囨殏鐢ㄥ瓧娈靛悕浣滀负灞曠ず鏂囨锛屼腑鏂囧鍒惰嫳鏂囧緟琛ュ厖銆?
-   docs: 鍦?AGENTS.md 涓?.codex/rules.md 涓ˉ鍏?monorepo 鏋舵瀯瑙勫垯锛屼緵瀛愭櫤鑳戒綋璇嗗埆浠撳簱杈圭晫銆?
-   docs: 淇 monorepo 鏋舵瀯瑙勫垯涓唬鐮佹爣璁版牸寮忥紙`apps/*`銆乣packages/\*`锛夈€?
-   feat(destop): 鎵撳紑椤圭洰鐩綍锛坧lugins/Next/*/mod*锛夛紝瑙ｆ瀽椤圭洰缁撴瀯骞跺睍绀?mod 鏍戙€?
-   feat(destop): 鍚屼竴 mod 涓?BuffJsonData銆両temJsonData銆乻killJsonData 鎸夆€?json1鏁版嵁鈥濆悎骞朵负涓€缁勬暟鎹睍绀恒€?
-   feat(destop): 宸︿晶鏀归€犱负椤圭洰缁撴瀯鏍戯紝灞曠ず 椤圭洰璁剧疆/buff/鐗╁搧/鍔熸硶/绁為€?NPC绫诲瀷/NPC鎮熼亾銆?
-   feat(destop): 涓棿琛ㄦ牸琛ㄥご鏀圭敤 @baize-next/i18n 瀛楁鏄犲皠锛屽彸渚ч潰鏉挎殏涓?TODO銆?
-   refactor(destop): 鏁版嵁瑙ｆ瀽涓庣被鍨嬪畾涔夎縼绉昏嚦鐙珛瀛愬寘 @baize-next/types銆?
-   feat(i18n): 鏂板 @baize-next/i18n 鐙珛瀛愬寘锛屾彁渚涘瓧娈佃〃澶?i18n 鏄犲皠銆?
-   build: 鏍圭洰褰?package.json 鏂板 `tauri` 鑴氭湰锛岄€氳繃 `pnpm --filter @baize-next/destop tauri` 鏀寔鍦ㄤ粨搴撴牴鐩綍鎵ц `pnpm tauri dev`銆?
-   style(destop): 閲嶅啓涓棿琛ㄦ牸婊氬姩鏉′负閫氱敤 ScrollArea 缁勪欢锛岄殣钘忕郴缁熼粯璁ゆ粴鍔ㄦ潯銆?
-   style(destop): 琛ㄥご淇濇寔鍗曡锛岀Щ闄ら噸澶?key 鍒楋紝浣跨敤璁板綍 key 浣滀负 ID 灞曠ず銆?
-   style(destop): 宸︿晶鏍忎笉鍐嶅睍绀哄垎缁勮矾寰勭洰褰曡鏄庛€?
-   style(destop): 鍏ㄥ眬绂佺敤榛樿鍙抽敭鑿滃崟銆?
-   style(destop): 鎻愬崌鑷畾涔夋粴鍔ㄦ潯鍙鎬э紙鍔犲ぇ婊戝潡灏哄銆佹彁楂樺姣斿害锛夈€?
-   style(destop): 鏍瑰鍣ㄧ鐢ㄦ枃鏈€夋嫨锛屼粎琛ㄥ崟鍏冪礌锛坕nput/textarea/contenteditable锛夊厑璁搁€変腑銆?
-   docs: 在 AGENTS.md 与 .codex/rules.md 中补充 Vitest 测试用例编写规则。
