# DEPRECATED: Archived design draft

This file is kept only for historical reference. It does not reflect the current implementation.

# Fukusa 險ｭ險域嶌・域隼險ら沿繝峨Λ繝輔ヨ v0.2 / Native Editor First・・
> Implementation update (2026-03-15):
> 迴ｾ蝨ｨ縺ｮ螳溯｣・・縲√％縺ｮ譁・嶌荳ｭ縺ｮ縲系ative diff editor 繧・pair 縺斐→縺ｫ荳ｦ縺ｹ繧九肴｡医°繧峨＆繧峨↓騾ｲ繧√※縲・> **aligned native text editor 繧・N 譛ｬ荳ｦ縺ｹ繧・N-way compare** 縺ｫ遘ｻ陦後＠縺ｦ縺・∪縺吶・> 螳溘さ繝ｼ繝我ｸ翫・荳ｻ隕∝ｷｮ蛻・・谺｡縺ｮ縺ｨ縺翫ｊ縺ｧ縺吶・> - `pair[] + vscode.diff` 縺ｧ縺ｯ縺ｪ縺・`NWayCompareSession + SessionAlignmentService`
> - `Adjacent / Base` 蜈ｬ髢・UI 縺ｧ縺ｯ縺ｪ縺・`Browse Revisions` 縺九ｉ縺ｮ unified compare flow
> - `multidiff:` snapshot 縺縺代〒縺ｪ縺・repo-local shadow workspace 繧剃ｽｿ縺｣縺・historical raw file 隗｣豎ｺ
> - aligned pane 荳翫・ definition / hover / references 繧・raw shadow file 縺ｫ蟋碑ｭｲ縺励※蜀阪・繝・・
>
> 縺薙・ v0.2 譁・嶌縺ｮ native-first 縺ｨ縺・≧蜴溷援縺ｯ邯ｭ謖√＠縺､縺､縲∵ｯ碑ｼ・腰菴阪・ pair 縺ｧ縺ｯ縺ｪ縺・pane 鄒､縺ｸ鄂ｮ縺肴鋤繧上▲縺ｦ縺・∪縺吶・
- 菴懈・譌･: 2026-03-11
- 蟇ｾ雎｡: VS Code 諡｡蠑ｵ讖溯・ **Fukusa**
- 縺薙・迚医・菴咲ｽｮ縺･縺・
  - v0.1 縺ｮ縲係ebview 荳ｻ菴薙・ N-way diff縲肴｡医ｒ縲・*native editor / native diff editor 荳ｻ菴・*縺ｫ謾ｹ繧√◆迚・
  - 螟画峩逅・罰縺ｯ縲∬ｿｽ蜉隕∽ｻｶ縺ｧ縺ゅｋ **縲祁S Code 縺ｮ蝓ｺ譛ｬ讖溯・繧堤ｶ呎価縺励※菴ｿ縺・◆縺・・* 繧呈怙蜆ｪ蜈医☆繧九◆繧・
- 譁・嶌縺ｮ逶ｮ逧・
  - 莉雁ｾ後・螳溯｣・婿驥昴ｒ縲・*Native Editor First** 縺ｨ縺・≧譏守｢ｺ縺ｪ蜴溷援縺ｫ謠・∴繧・
  - 縲御ｽ輔°繧我ｽ懊ｋ縺九阪→縲後←縺薙〒螯･蜊斐☆繧九°縲阪ｒ縲∵怙蛻昴↓蝗ｺ螳壹☆繧・
  - 螳溯｣・・讀懆ｨｼ繝ｻMVP繝ｻ蟆・擂諡｡蠑ｵ縺ｾ縺ｧ荳雋ｫ縺励◆險ｭ險医・蝨溷床繧呈ｮ九☆

---

## 0. 縺薙・謾ｹ險ゅ〒菴輔′螟峨ｏ縺｣縺溘°

v0.1 縺九ｉ縺ｮ荳ｻ隕∝､画峩縺ｯ谺｡縺ｮ 6 轤ｹ縺ｧ縺吶・

1. **N-way diff 縺ｮ荳ｻ陦ｨ遉ｺ髱｢繧・Webview 縺九ｉ native diff editor 縺ｫ螟画峩**
2. **revision snapshot 縺ｮ謠蝉ｾ帶婿蠑上ｒ `TextDocumentContentProvider` 荳ｻ菴薙°繧・`FileSystemProvider` 荳ｻ菴薙↓螟画峩**
3. **Blame 繝薙Η繝ｼ縺ｯ蠑輔″邯壹″ native editor decoration 繧剃ｽｿ縺・′縲”istorical snapshot 縺ｫ繧る←逕ｨ縺ｧ縺阪ｋ蜑肴署縺ｸ謨ｴ逅・*
4. **Webview 縺ｯ縲後さ繝ｼ繝画緒逕ｻ髱｢縲阪〒縺ｯ縺ｪ縺上√そ繝・す繝ｧ繝ｳ邂｡逅・ｄ陬懷勧逧・↑ overview 逕ｨ縺ｫ譬ｼ荳九￡**
5. **Ctrl+繧ｯ繝ｪ繝・け / Go to Definition 莠呈鋤縺ｮ縺溘ａ縲〕anguage feature compatibility layer 繧定ｿｽ蜉**
6. **縲御ｻｻ諢上・謨ｰ縲阪・隗｣驥医ｒ縲・莉ｻ諢丞九・ revision 繧・session 縺ｨ縺励※菫晄戟縺ｧ縺阪ｋ" 縺ｫ螟画峩縺励∝酔譎ょ庄隕門・謨ｰ縺ｯ VS Code 縺ｮ editor group 蛻ｶ邏・・荳ｭ縺ｧ windowing 縺吶ｋ**

縺薙・謾ｹ險ゅ↓繧医ｊ縲・*隕九◆逶ｮ縺ｮ閾ｪ逕ｱ蠎ｦ縺ｯ蟆代＠關ｽ縺｡繧・*莉｣繧上ｊ縺ｫ縲・*syntax highlighting / hover / folding / Ctrl+繧ｯ繝ｪ繝・け / 騾壼ｸｸ縺ｮ editor 謫堺ｽ・*繧偵〒縺阪ｋ縺縺・VS Code 讓呎ｺ悶↓蟇・○繧峨ｌ縺ｾ縺吶・

---

## 1. 邨占ｫ・

縺薙・諡｡蠑ｵ縺ｮ荳ｭ譬ｸ險ｭ險医・縲∽ｻ･荳九・繧医≧縺ｫ螳夂ｾｩ縺励∪縺吶・

### 1.1 譛驥崎ｦ∝次蜑・

**繧ｳ繝ｼ繝峨ｒ陦ｨ遉ｺ縺吶ｋ蝣ｴ謇縺ｯ縲√〒縺阪ｋ髯舌ｊ Webview 縺ｧ縺ｯ縺ｪ縺・VS Code 讓呎ｺ悶・ text editor / diff editor 繧剃ｽｿ縺・・*

縺薙ｌ縺後√％縺ｮ迚医・譛繧ょ､ｧ縺阪↑邨占ｫ悶〒縺吶・

### 1.2 謾ｹ險ょｾ後・荳ｻ譁ｹ驥・

1. **N-way diff 縺ｯ縲∬､・焚縺ｮ native diff editor 繧・editor group 縺ｫ荳ｦ縺ｹ縺ｦ讒区・縺吶ｋ**
2. **historical snapshot 縺ｯ readonly 縺ｮ `multidiff:` 繧ｹ繧ｭ繝ｼ繝縺ｧ蜈ｬ髢九＠縲〃S Code 縺ｫ縺ｯ縲碁壼ｸｸ縺ｮ繝輔ぃ繧､繝ｫ縺ｮ繧医≧縺ｫ縲肴桶繧上○繧・*
3. **Blame 縺ｯ native editor 縺ｫ decoration / overview ruler / hover 縺ｧ驥阪・繧・*
4. **Git / SVN 縺ｮ蜿門ｾ励→繧ｭ繝｣繝・す繝･縺ｯ蠕捺擂縺ｩ縺翫ｊ adapter / cache 螻､縺ｧ蜷ｸ蜿弱☆繧・*
5. **Webview 繧剃ｽｿ縺・→縺励※繧ゅ√さ繝ｼ繝画悽譁・・謠冗判縺ｫ縺ｯ菴ｿ繧上↑縺・*
6. **Ctrl+繧ｯ繝ｪ繝・け莠呈鋤縺ｮ縺溘ａ縲∝ｿ・ｦ√↓蠢懊§縺ｦ custom scheme 蜷代￠縺ｮ language feature bridge 繧・temp file fallback 繧呈戟縺､**
7. **蜷梧凾陦ｨ遉ｺ謨ｰ縺ｯ editor group 蛻ｶ邏・・遽・峇縺ｫ蜿弱ａ縲∬ｶ・℃蛻・・繝壹・繧ｸ繝ｳ繧ｰ / windowing 縺ｧ謇ｱ縺・*

### 1.3 縺薙・譁ｹ驥昴・諢丞袖

縺薙・險ｭ險医↓縺吶ｋ縺ｨ縲√Θ繝ｼ繧ｶ繝ｼ縺梧悄蠕・＠縺ｦ縺・ｋ

- 繧ｷ繝ｳ繧ｿ繝・け繧ｹ繝上う繝ｩ繧､繝・
- Ctrl+繧ｯ繝ｪ繝・け縺ｫ繧医ｋ螳夂ｾｩ繧ｸ繝｣繝ｳ繝・
- hover
- folding
- 讀懃ｴ｢
- 讓呎ｺ悶・ editor 繧ｭ繝ｼ繝舌う繝ｳ繝・
- 騾壼ｸｸ縺ｮ diff editor 縺ｮ謫堺ｽ懈─

繧偵・*諡｡蠑ｵ蛛ｴ縺ｧ蜀咲匱譏弱○縺壹↓邯呎価縺ｧ縺阪ｋ蜿ｯ閭ｽ諤ｧ縺梧怙繧るｫ倥＞**縺ｧ縺吶・

---

## 2. 縺ｪ縺懆ｨｭ險亥､画峩縺悟ｿ・ｦ√↑縺ｮ縺・

### 2.1 Webview 縺ｯ縲梧怙蠕後・謇区ｮｵ縲阪〒縺ゅｋ

VS Code 縺ｮ UX 繧ｬ繧､繝峨Λ繧､繝ｳ縺ｧ縺ｯ縲仝ebview 縺ｯ **native API 縺ｧ雜ｳ繧翫↑縺・ｴ蜷医↓縺縺・*菴ｿ縺・∋縺阪□縺ｨ縺輔ｌ縺ｦ縺・∪縺吶・^webviews]

v0.1 縺ｮ險ｭ險医・縲君 蛟九ｒ 1 逕ｻ髱｢縺ｧ閾ｪ逕ｱ縺ｫ荳ｦ縺ｹ繧九阪→縺・≧ UI 逶ｮ逧・↓縺ｯ蜷医▲縺ｦ縺・∪縺励◆縺後・ 
莉雁屓霑ｽ蜉縺輔ｌ縺溯ｦ∽ｻｶ縺ｯ **縲瑚ｦ九◆逶ｮ縺ｮ閾ｪ逕ｱ縺輔阪ｈ繧翫祁S Code 讓呎ｺ・editor 讖溯・縺ｮ邯呎価縲・* 繧貞━蜈医＠縺ｦ縺・∪縺吶・

縺薙・譎らせ縺ｧ縲・*Webview 繧偵さ繝ｼ繝画緒逕ｻ縺ｮ荳ｻ謌ｦ蝣ｴ縺ｫ縺吶ｋ縺ｮ縺ｯ譛ｬ遲九〒縺ｯ縺ｪ縺・*縺ｨ蛻､譁ｭ縺励∪縺吶・

### 2.2 FileSystemProvider 縺ｯ VS Code 縺ｫ縲碁壼ｸｸ繝輔ぃ繧､繝ｫ縺ｮ繧医≧縺ｫ謇ｱ繧上○繧九阪◆繧√・ API 縺ｧ縺ゅｋ

VS Code 縺ｯ `FileSystemProvider` 繧帝壹§縺ｦ縲∽ｻｻ諢上た繝ｼ繧ｹ荳翫・繝輔ぃ繧､繝ｫ繧・ヵ繧ｩ繝ｫ繝繧・**regular files 縺ｮ繧医≧縺ｫ謇ｱ縺医ｋ**繧医≧縺ｫ縺励※縺・∪縺吶・^fsp-regular]

縺ｾ縺溘〃S Code 邨・∩霎ｼ縺ｿ Git 諡｡蠑ｵ繧ゅ∝商縺・ヵ繧｡繧､繝ｫ繝舌・繧ｸ繝ｧ繝ｳ縺ｮ蜈ｬ髢九↓ `FileSystemProvider` 繧呈治逕ｨ縺励※縺翫ｊ縲・ 
縺昴・逅・罰縺ｨ縺励※ **encoding 蝠城｡後・謾ｹ蝟・*縺ｨ**performance / reliability 蜷台ｸ・*縺梧嫌縺偵ｉ繧後※縺・∪縺吶・^git-fsp]

縺､縺ｾ繧翫”istorical snapshot 繧・VS Code 讓呎ｺ・editor 縺ｫ閾ｪ辟ｶ縺ｫ霈峨○縺溘＞縺ｪ繧峨・ 
**`TextDocumentContentProvider` 繧医ｊ `FileSystemProvider` 縺ｮ譁ｹ縺御ｸｭ髟ｷ譛溘・譛ｬ蜻ｽ**縺ｧ縺吶・

### 2.3 險隱樊ｩ溯・縺ｯ core editor 縺ｧ縺ｯ縺ｪ縺・language extension 縺梧署萓帙＠縺ｦ縺・ｋ

VS Code 縺ｮ syntax highlight 繧・Go to Definition 縺ｪ縺ｩ縺ｮ rich language features 縺ｯ縲・ 
core editor 縺檎峩謗･謖√▲縺ｦ縺・ｋ縺ｮ縺ｧ縺ｯ縺ｪ縺上・*language extensions 縺ｨ document selector** 縺ｫ繧医▲縺ｦ驕ｩ逕ｨ縺輔ｌ縺ｾ縺吶・^lang-overview][^doc-selector]

縺薙・縺溘ａ縲：ukusa 蛛ｴ縺後系ative editor 縺ｧ髢九￥縲阪□縺代〒縺ｯ蜊∝・縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・ 
**縺ｩ縺ｮ URI scheme 縺ｧ髢九￥縺九｝ath / extension 繧偵←縺・ｿ昴▽縺九〕anguageId 繧偵←縺・ｸ弱∴繧九°**縺ｾ縺ｧ險ｭ險医↓蜷ｫ繧√ｋ蠢・ｦ√′縺ゅｊ縺ｾ縺吶・

### 2.4 editor group 謨ｰ縺ｫ縺ｯ荳企剞縺後≠繧・

`showTextDocument` 縺ｪ縺ｩ縺ｧ editor 繧帝幕縺丞ｴ蜷医∝・縺ｯ `ViewColumn.Nine` 縺ｾ縺ｧ縺御ｸ企剞縺ｧ縺吶・^viewcolumn-max]

縺励◆縺後▲縺ｦ縲・*縲悟酔譎ゅ↓ 100 蛻励ｒ native editor 縺ｨ縺励※讓ｪ荳ｦ縺ｳ縲・*縺ｯ險ｭ險井ｸ翫〒縺阪∪縺帙ｓ縲・ 
縺薙・蛻ｶ邏・・荳九〒縲御ｻｻ諢上・謨ｰ縲阪ｒ謌千ｫ九＆縺帙ｋ縺ｫ縺ｯ縲・

- session 縺ｨ縺励※縺ｯ莉ｻ諢丞九・ revision 繧剃ｿ晄戟縺・
- 蜿ｯ隕夜Κ蛻・□縺代ｒ 2縲・ 蛟九・ diff editor 縺ｫ windowing 縺吶ｋ

縺ｨ縺・≧蠖｢縺ｫ謾ｹ繧√ｋ蠢・ｦ√′縺ゅｊ縺ｾ縺吶・

---

## 3. 謾ｹ險ょｾ後・繝励Ο繝繧ｯ繝亥ワ

### 3.1 逶ｮ謖・☆菴馴ｨ・

繝ｦ繝ｼ繧ｶ繝ｼ縺ｯ 1 繝輔ぃ繧､繝ｫ繧定ｵｷ轤ｹ縺ｫ縺励※縲・

1. 隍・焚 revision / commit / SVN revision 繧帝∈縺ｶ
2. 縺昴ｌ繧峨ｒ **native diff editor 縺ｮ蛻礼ｾ､**縺ｨ縺励※髢九￥
3. 蜷・・縺ｧ縺ｯ騾壼ｸｸ縺ｮ diff editor 縺ｮ繧医≧縺ｫ縲《yntax highlight 繧・Ctrl+繧ｯ繝ｪ繝・け繧定ｩｦ縺帙ｋ
4. 蜷後§繝輔ぃ繧､繝ｫ縺ｮ snapshot 繧・**native editor 蜊倅ｽ・*縺ｧ繧る幕縺代ｋ
5. 縺昴・ editor 荳翫〒 blame heatmap 繧定｡ｨ遉ｺ縺ｧ縺阪ｋ
6. 荳蠎ｦ蜿門ｾ励＠縺・history / snapshot / diff / blame 縺ｯ cache 縺輔ｌ縲∵ｬ｡蝗槭・騾溘￥髢九￠繧・

縺ｨ縺・≧菴馴ｨ薙ｒ蠕励∪縺吶・

### 3.2 隗｣縺剰ｪｲ鬘鯉ｼ亥・謨ｴ逅・ｼ・

- **2 蛟九＠縺句ｷｮ蛻・ｒ隕九ｉ繧後↑縺・*
  - 隍・焚縺ｮ native diff editor 繧・session 縺ｨ縺励※譚溘・繧・
- **NW 邨檎罰縺ｧ蟾ｮ蛻・叙蠕励′驕・＞**
  - snapshot / diff / blame 繧・cache 縺励～FileSystemProvider.readFile()` 邨檎罰縺ｧ迸ｬ譎ゅ↓霑斐☆
- **blame 縺ｮ蜈ｨ菴灘ワ縺瑚ｦ九∴縺ｫ縺上＞**
  - overview ruler + whole-line decoration + hover 縺ｧ讓｡讒倥→縺励※隕九○繧・
- **VS Code 讓呎ｺ匁ｩ溯・繧貞ｼ輔″邯吶℃縺溘＞**
  - Webview 縺ｧ縺ｯ縺ｪ縺・native editor surface 繧剃ｽｿ縺・

### 3.3 髱樒岼讓呻ｼ亥・迚医〒縺ｯ繧・ｉ縺ｪ縺・％縺ｨ・・

- custom editor 縺ｧ迢ｬ閾ｪ縺ｮ繧ｳ繝ｼ繝峨Ξ繝ｳ繝繝ｩ繧剃ｽ懊ｋ縺薙→
- Monaco 繧・Webview 蜀・↓蝓九ａ縺ｦ VS Code editor 縺ｮ莉｣逕ｨ蜩√ｒ菴懊ｋ縺薙→
- edit / save 蜿ｯ閭ｽ縺ｪ historical snapshot
- merge conflict 隗｣豸・UI
- binary diff / image diff
- 辟｡蛻ｶ髯舌・蜷梧凾蜿ｯ隕門・・・ative editor 繧剃ｽｿ縺・ｻ･荳翫∝庄隕・window 蛻ｶ髯舌ｒ蜿励￠蜈･繧後ｋ・・

---

## 4. 隕∽ｻｶ螳夂ｾｩ・域隼險ら沿・・

## 4.1 讖溯・隕∽ｻｶ

### FR-01: Multi Revision Diff Session
- 蜊倅ｸ繝輔ぃ繧､繝ｫ縺ｫ蟇ｾ縺励※ **2 蛟倶ｻ･荳翫・ revision** 繧帝∈謚槭〒縺阪ｋ
- session 縺ｨ縺励※ **莉ｻ諢丞・*縺ｮ revision 繧剃ｿ晄戟縺ｧ縺阪ｋ
- 陦ｨ遉ｺ繝｢繝ｼ繝峨ｒ蛻・ｊ譖ｿ縺医ｉ繧後ｋ
  - adjacent: `A竊韮`, `B竊任`, `C竊妊`
  - base: `A竊韮`, `A竊任`, `A竊妊`
- 蜿ｯ隕・window 蜀・・ pair 縺ｯ **native diff editor** 縺ｧ髢九°繧後ｋ
- 蜿ｯ隕・window 繧貞ｷｦ蜿ｳ縺ｫ遘ｻ蜍輔〒縺阪ｋ
- 莉ｻ諢・revision 繧貞腰菴薙・ native editor 縺ｧ髢九￠繧・

### FR-02: Native Editor Inheritance
- snapshot / diff 縺ｮ陦ｨ遉ｺ縺ｯ縲∝庄閭ｽ縺ｪ髯舌ｊ **讓呎ｺ・text editor / diff editor** 繧剃ｽｿ縺・
- syntax highlighting 縺梧怏蜉ｹ縺ｧ縺ゅｋ
- Ctrl+繧ｯ繝ｪ繝・け / Go to Definition 繧定ｩｦ縺帙ｋ
- hover / folding / search / standard keybindings 繧剃ｽｿ縺医ｋ
- 縺溘□縺怜ｮ滄圀縺ｫ縺ｩ縺薙∪縺ｧ譛牙柑縺ｫ縺ｪ繧九°縺ｯ縲∝推 language extension 縺ｮ scheme 蟇ｾ蠢懃憾豕√↓萓晏ｭ倥☆繧九◆繧√∝ｿ・ｦ√↑繧・compatibility fallback 繧剃ｽｿ縺・

### FR-03: Blame Visualization
- 縺ゅｋ snapshot 縺ｫ蟇ｾ縺吶ｋ blame 繧・native editor 荳翫↓陦ｨ遉ｺ縺ｧ縺阪ｋ
- whole-line decoration / overview ruler / hover 繧呈署萓帙☆繧・
- age-based heatmap 繧貞・迚医→縺吶ｋ
- 蟆・擂逧・↓ churn / authorship density 繧る㍾縺ｭ繧峨ｌ繧・

### FR-04: Cache
- history, snapshot, diff, blame 繧・cache 縺ｧ縺阪ｋ
- warm cache / clear cache 縺ｮ蟆守ｷ壹ｒ謖√▽
- repo / file / all 蜊倅ｽ阪〒蜑企勁縺ｧ縺阪ｋ

### FR-05: Source Adapter
- Git 縺ｨ SVN 繧貞酔荳 UI 縺ｧ謇ｱ縺医ｋ
- Git 縺ｯ邨・∩霎ｼ縺ｿ Git API 蜆ｪ蜈・+ CLI fallback
- SVN 縺ｯ CLI 繝吶・繧ｹ

## 4.2 髱樊ｩ溯・隕∽ｻｶ

### NFR-01: 陦ｨ遉ｺ騾溷ｺｦ
- cache hit 譎ゅ・菴捺─ 1 遘呈悴貅繧堤岼讓・
- editor 繧帝幕縺上◆縺ｳ縺ｫ network access 繧貞ｼｷ蛻ｶ縺励↑縺・

### NFR-02: Editor Fidelity
- 陦ｨ遉ｺ髱｢縺ｧ Webview 縺ｫ萓晏ｭ倥＠縺ｪ縺・
- 讓呎ｺ・diff editor / text editor 繧貞━蜈医☆繧・
- custom scheme 荳翫〒讖溯・荳崎ｶｳ縺悟・縺溷ｴ蜷医↓ fallback 繧呈戟縺､

### NFR-03: 蜿ｯ隕・window 蛻ｶ蠕｡
- 蜷梧凾蜿ｯ隕匁焚縺ｯ editor group 蛻ｶ邏・・縺ｫ蜿弱ａ繧・
- session 蜈ｨ菴捺焚縺ｨ蜿ｯ隕匁焚繧貞・髮｢縺吶ｋ

### NFR-04: Readonly Safety
- historical snapshot 縺ｯ隱ｭ縺ｿ蜿悶ｊ蟆ら畑
- 菫晏ｭ倥ｄ accidental edit 繧帝亟縺・

### NFR-05: Theme / Accessibility
- blame 濶ｲ莉倥￠縺ｯ theme-aware 縺ｫ縺吶ｋ
- keyboard driven 縺ｫ縺吶ｋ
- high contrast 縺ｧ繧りｭ伜挨蜿ｯ閭ｽ縺ｫ縺吶ｋ

---

## 5. 謾ｹ險ょｾ後・蜈ｨ菴薙い繝ｼ繧ｭ繝・け繝√Ε

```text
+-------------------------------------------------------------------+
| VS Code Commands / Menus / Tree Views                             |
| - Open Fukusa Session                                             |
| - Shift Window Left / Right                                       |
| - Open Revision Snapshot                                          |
| - Toggle Blame Heatmap                                            |
| - Warm Cache / Clear Cache                                        |
+----------------------------------+--------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------+
| Application Layer                                                 |
| - SessionService                                                  |
| - NativeDiffSessionController                                     |
| - RevisionPickerService                                           |
| - BlameService                                                    |
| - CacheService                                                    |
| - LanguageFeatureCompatibilityService                             |
+--------------------------+-------------------+--------------------+
                           |                   |
                           |                   +--------------------------------+
                           |                                                    |
                           v                                                    v
+------------------------------------------+                 +------------------+------------------+
| Snapshot Transport                       |                 | Repository Adapters                  |
| - SnapshotFsProvider (readonly scheme)   |                 | - GitAdapter                         |
| - UriFactory                             |                 | - SvnAdapter                         |
| - LanguageModeResolver                   |                 | - Git CLI fallback                   |
+------------------------+-----------------+                 +------------------+------------------+
                         |                                                        |
                         v                                                        v
+------------------------------------------+                 +-------------------------------------+
| VS Code Native Surface                   |                 | Data Sources                        |
| - Text Editor                            |                 | - vscode.git API                    |
| - Diff Editor                            |                 | - git CLI                           |
| - Decorations / Overview Ruler / Hover   |                 | - svn CLI                           |
+------------------------+-----------------+                 +-------------------------------------+
                         |
                         v
+------------------------------------------+
| Cache Layer                              |
| - Memory LRU                             |
| - Persistent Snapshot Cache              |
| - Diff Cache                             |
| - Blame Cache                            |
+------------------------------------------+
```

---

## 6. 險ｭ險亥次蜑・ｼ域隼險ら沿・・

### 6.1 Native Editor First
繧ｳ繝ｼ繝画悽譁・ｒ謠上￥縺ｮ縺ｯ native editor 縺ｨ diff editor縲・ 
Webview 縺ｯ **陬懷勧 UI** 縺ｫ髯仙ｮ壹☆繧九・

### 6.2 Snapshot is a File
historical snapshot 縺ｯ縲檎音谿翫↑ HTML 譁ｭ迚・阪〒縺ｯ縺ｪ縺上・ 
**VS Code 縺・file-like 縺ｫ謇ｱ縺医ｋ resource** 縺ｨ縺励※蜈ｬ髢九☆繧九・

### 6.3 Session 縺ｨ Visible Window 繧貞・髮｢縺吶ｋ
session 蜈ｨ菴薙〒縺ｯ莉ｻ諢丞九・ revision 繧呈戟縺ｦ繧九′縲・ 
蜿ｯ隕・editor 縺ｯ 2縲・ 遞句ｺｦ縺ｫ蛻ｶ蠕｡縺吶ｋ縲・

### 6.4 Fallback 繧呈怙蛻昴°繧芽ｨｭ險医↓蜈･繧後ｋ
language extension 縺・custom scheme 縺ｫ蟇ｾ蠢懊＠縺ｦ縺・↑縺・ｴ蜷医′縺ゅｋ縺溘ａ縲・ 
**莠呈鋤繝ｬ繧､繝､繧呈怙蛻昴°繧芽ｨｭ險医↓蜷ｫ繧√ｋ**縲・

### 6.5 Cache 縺ｯ transport 螻､縺ｫ閾ｪ辟ｶ邨ｱ蜷医☆繧・
editor 縺・snapshot 繧帝幕縺上→縺阪・蜈･蜿｣縺ｯ `FileSystemProvider.readFile()` 縺ｫ蟇・○繧九・ 
縺薙ｌ縺ｫ繧医ｊ cache 縺・UI 螳溯｣・↓貍上ｌ縺ｫ縺上＞縲・

---

## 7. Snapshot Transport 險ｭ險・

## 7.1 `FileSystemProvider` 繧剃ｸｻ謗｡逕ｨ縺吶ｋ

historical snapshot 縺ｮ蜈ｬ髢九・縲∽ｻ･荳九・逅・罰縺ｧ `FileSystemProvider` 繧剃ｸｻ謗｡逕ｨ縺励∪縺吶・

- VS Code 縺・arbitrary source 繧・**regular file 縺ｮ繧医≧縺ｫ謇ｱ縺医ｋ**[^fsp-regular]
- 邨・∩霎ｼ縺ｿ Git 諡｡蠑ｵ繧・older versions 縺ｮ蜈ｬ髢九↓ `FileSystemProvider` 繧呈治逕ｨ貂医∩[^git-fsp]
- readonly 繧・provider 繝ｬ繝吶Ν縺ｧ螳｣險縺ｧ縺阪ｋ[^readonly-fsp]

### 7.1.1 謗｡逕ｨ API
- `workspace.registerFileSystemProvider('multidiff', provider, { isReadonly: true })`

### 7.1.2 縺ｪ縺・`TextDocumentContentProvider` 縺ｧ縺ｯ縺ｪ縺上％縺｡繧峨°
`TextDocumentContentProvider` 縺ｧ繧・readonly document 縺ｯ菴懊ｌ縺ｾ縺吶′縲・ 
譛ｬ莉ｶ縺ｧ縺ｯ **縲碁壼ｸｸ縺ｮ editor 縺ｧ閾ｪ辟ｶ縺ｫ謇ｱ繧上○繧九・*縺薙→縺碁㍾隕√〒縺吶・

縺昴・縺溘ａ譛邨りｨｭ險医〒縺ｯ縲・

- **MVP 隧ｦ菴・*: `TextDocumentContentProvider` 縺ｧ繧ょ庄
- **譛ｬ謗｡逕ｨ**: `FileSystemProvider`

縺ｨ縺励∪縺吶・

## 7.2 URI 險ｭ險・

### 7.2.1 萓・

```text
multidiff://git/<repoId>/src/foo/bar.ts?rev=abc123
multidiff://svn/<repoId>/src/foo/bar.ts?rev=18452
```

### 7.2.2 URI 險ｭ險域婿驥・
- path 縺ｫ **蜈・ヵ繧｡繧､繝ｫ縺ｮ逶ｸ蟇ｾ繝代せ縺ｨ諡｡蠑ｵ蟄・*繧呈ｮ九☆
- query 縺ｫ `rev` 繧呈戟縺溘○繧・
- authority 縺ｫ VCS kind・・git` / `svn`・峨ｒ鄂ｮ縺・
- repoId 縺ｯ hash 蛹悶＠縺ｦ螳牙ｮ夊ｭ伜挨蟄舌↓縺吶ｋ

縺薙・蠖｢縺ｫ縺吶ｋ逅・罰縺ｯ縲・*諡｡蠑ｵ蟄舌ｄ path 諠・ｱ縺・language detection 縺ｫ蜉ｹ縺丈ｽ吝慍繧呈ｮ九☆**縺溘ａ縺ｧ縺吶・

## 7.3 LanguageModeResolver

snapshot 繧帝幕縺・◆譎ゅ↓ language mode 縺・plain text 縺ｫ縺ｪ繧九・繧帝∩縺代ｋ縺溘ａ縲・ 
蠢・ｦ√↓蠢懊§縺ｦ `setTextDocumentLanguage(document, languageId)` 繧剃ｽｿ縺・∪縺吶・^set-language]

### 7.3.1 險隱樊ｱｺ螳夐・
1. 蜈・・ workspace file 縺ｮ `languageId`
2. path / extension 縺九ｉ謗ｨ螳・
3. 螟ｱ謨玲凾縺ｯ plain text

### 7.3.2 逶ｮ逧・
- syntax highlighting
- bracket matching
- comment toggling
- folding
- language-specific editor behaviors

繧偵〒縺阪ｋ縺縺醍ｶｭ謖√☆繧九・

## 7.4 `SnapshotFsProvider.readFile()` 縺ｮ蠖ｹ蜑ｲ

`readFile(uri)` 縺ｯ蜊倥↑繧・bytes 霑泌唆縺ｧ縺ｯ縺ｪ縺上∝ｮ溯ｳｪ逧・↓ **snapshot cache gateway** 縺ｧ縺吶・

### 蜃ｦ逅・ヵ繝ｭ繝ｼ
1. URI 繧・parse
2. cache key 繧堤函謌・
3. memory cache 繧定ｦ九ｋ
4. persistent cache 繧定ｦ九ｋ
5. miss 縺ｮ蝣ｴ蜷医・ RepositoryAdapter 縺九ｉ蜿門ｾ・
6. cache 菫晏ｭ・
7. bytes 繧定ｿ斐☆

縺薙ｌ縺ｫ繧医ｊ縲ゞI 螻､縺ｯ縲後←縺薙°繧牙叙繧九°縲阪ｒ諢剰ｭ倥○縺壹・ 
**resource 繧帝幕縺上□縺代〒騾溘￥縺ｪ繧・*險ｭ險医↓縺ｪ繧翫∪縺吶・

---

## 8. N-way Diff 縺ｮ譁ｰ險ｭ險茨ｼ・ative Diff Session・・

## 8.1 逋ｺ諠ｳ縺ｮ蛻・ｊ譖ｿ縺・

v0.1 縺ｧ縺ｯ **1 譫壹・ Webview 縺ｫ N 蛻励・繧ｳ繝ｼ繝画悽譁・ｒ謠上￥**諠ｳ螳壹〒縺励◆縲・ 
v0.2 縺ｧ縺ｯ **N-way diff = 隍・焚縺ｮ native diff editor 縺ｮ session** 縺ｨ螳夂ｾｩ縺礼峩縺励∪縺吶・

縺薙ｌ縺ｯ隕九◆逶ｮ縺ｨ縺励※縺ｯ縲・

- 1 縺､縺ｮ custom viewer
縺ｧ縺ｯ縺ｪ縺上・
- 隍・焚縺ｮ built-in diff editor 繧・extension 縺梧據縺ｭ繧・

繧､繝｡繝ｼ繧ｸ縺ｧ縺吶・

### 8.1.1 縺薙・蜀榊ｮ夂ｾｩ縺ｮ蛻ｩ轤ｹ
- 蜷・pair 豈碑ｼ・・ built-in diff editor 縺梧球蠖薙☆繧・
- syntax highlighting 繧貞ｼ輔″邯吶℃繧・☆縺・
- Ctrl+繧ｯ繝ｪ繝・け / hover / find / folding 縺ｪ縺ｩ縺梧悄蠕・＠繧・☆縺・
- 閾ｪ蜑榊ｮ溯｣・☆縺ｹ縺・diff renderer 縺梧ｿ貂帙☆繧・

### 8.1.2 莉｣蜆・
- 1 revision 縺瑚､・焚 pair 縺ｫ驥崎､・＠縺ｦ迴ｾ繧後ｋ・・djacent mode 縺ｧ B 縺悟ｷｦ蜿ｳ縺ｫ蜃ｺ繧具ｼ・
- 蜿ｯ隕門・謨ｰ縺ｫ荳企剞縺後≠繧・
- 螳悟・閾ｪ逕ｱ縺ｪ multi-column 繝ｬ繧､繧｢繧ｦ繝医・謐ｨ縺ｦ繧・

縺励°縺嶺ｻ雁屓縺ｮ霑ｽ蜉隕∽ｻｶ縺ｧ縺ｯ縲√％縺ｮ trade-off 縺ｯ螯･蠖薙〒縺吶・

## 8.2 Compare Mode

### Adjacent Mode
驕ｸ謚・revision 縺・`[A, B, C, D]` 縺ｮ縺ｨ縺阪・幕縺・pair 縺ｯ:

- `A竊韮`
- `B竊任`
- `C竊妊`

縺薙ｌ縺ｯ縲悟､画峩繧呈凾邉ｻ蛻励↓霑ｽ縺・阪◆繧√・荳ｻ繝｢繝ｼ繝峨〒縺吶・

### Base Mode
驕ｸ謚・revision 縺・`[A, B, C, D]` 縺ｮ縺ｨ縺阪・幕縺・pair 縺ｯ:

- `A竊韮`
- `A竊任`
- `A竊妊`

縺薙ｌ縺ｯ縲悟渕貅・revision 縺九ｉ菴輔′螟峨ｏ縺｣縺溘°縲阪ｒ隕九ｋ縺溘ａ縺ｮ繝｢繝ｼ繝峨〒縺吶・

## 8.3 Visible Window

editor group 謨ｰ縺ｮ荳企剞縺後≠繧九◆繧√《ession 縺ｨ visible window 繧貞・縺代∪縺吶・^viewcolumn-max][^set-layout]

### 8.3.1 螳夂ｾｩ
- `sessionRevisions`: 繝ｦ繝ｼ繧ｶ繝ｼ縺碁∈繧薙□蜈ｨ revision
- `visiblePairs`: 迴ｾ蝨ｨ editor 縺ｫ螻暮幕縺励※縺・ｋ pair 鄒､

### 8.3.2 萓・
`A, B, C, D, E, F, G` 繧帝∈繧薙□蝣ｴ蜷・

- session 蜈ｨ菴・ 7 revision
- adjacent pair: 6
- visible window size: 3 pair

縺ｪ繧峨∵怙蛻昴↓陦ｨ遉ｺ縺吶ｋ縺ｮ縺ｯ

- `A竊韮`
- `B竊任`
- `C竊妊`

縺ｧ縲・ 
縲梧ｬ｡縺ｸ縲阪〒

- `D竊忍`
- `E竊認`
- `F竊濡`

縺ｫ蛻・ｊ譖ｿ縺医ｋ縲・

### 8.3.3 蛻ｩ轤ｹ
- 莉ｻ諢丞九・ revision 繧帝∈縺ｹ繧・
- 荳蠎ｦ縺ｫ髢九″縺吶℃縺ｦ editor area 縺悟ｴｩ繧後↑縺・
- native editor 蜑肴署縺ｧ繧ゅ∝ｮ溽畑荳翫・縲君-way縲阪ｒ邯ｭ謖√〒縺阪ｋ

## 8.4 繝ｬ繧､繧｢繧ｦ繝亥宛蠕｡

### 謗｡逕ｨ API
- `vscode.setEditorLayout`[^set-layout]
- `vscode.diff(left, right, title, options)`[^diff-command]

### 蝓ｺ譛ｬ謌ｦ逡･
1. visible pair 謨ｰ `k` 繧呈ｱｺ繧√ｋ
2. `setEditorLayout` 縺ｧ讓ｪ荳ｦ縺ｳ `k` group 繧剃ｽ懊ｋ
3. 蜷・group 縺ｫ `vscode.diff()` 繧呈兜縺偵ｋ
4. preview 縺ｯ蛻・ｊ縲《ession 縺ｮ蜷・pair 繧・tab 縺ｨ縺励※蝗ｺ螳壹☆繧・

### 萓・
3 pair 陦ｨ遉ｺ縺ｪ繧・3 group 繧呈ｨｪ荳ｦ縺ｳ縺ｫ菴懊ｋ縲・

## 8.5 NativeDiffSessionController

雋ｬ蜍・
- session 縺九ｉ visible pair 繧定ｨ育ｮ励☆繧・
- editor layout 繧堤ｵ・・
- 蜷・pair 繧・diff editor 縺ｨ縺励※髢九￥
- 蟾ｦ蜿ｳ繧ｦ繧｣繝ｳ繝峨え遘ｻ蜍輔∝・謠冗判縲∝・繧ｪ繝ｼ繝励Φ繧堤ｮ｡逅・☆繧・

### 諠ｳ螳・API
```ts
interface NativeDiffSessionController {
  openSession(input: MultiDiffSessionInput): Promise<void>;
  shiftWindow(sessionId: string, delta: number): Promise<void>;
  reopenPair(sessionId: string, pairIndex: number): Promise<void>;
  focusPair(sessionId: string, pairIndex: number): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
}
```

## 8.6 繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ縺ｨ繝翫ン繧ｲ繝ｼ繧ｷ繝ｧ繝ｳ

### v1 縺ｮ譁ｹ驥・
- **pair 蜀・・蟾ｦ蜿ｳ蜷梧悄**縺ｯ built-in diff editor 縺ｫ莉ｻ縺帙ｋ
- **pair 髢薙・蜷梧悄繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ**縺ｯ MVP 縺ｧ縺ｯ蠢・医↓縺励↑縺・
- session 蜈ｨ菴薙・遘ｻ蜍輔・ command 繝吶・繧ｹ縺ｫ縺吶ｋ

### 逅・罰
pair 髢薙∪縺ｧ螳悟・蜷梧悄繧堤漁縺・→縲］ative diff editor 縺ｮ蜀・Κ迥ｶ諷九→縺ｮ逶ｸ莠貞宛蠕｡縺碁屮縺励￥縺ｪ繧翫・ 
蛻晏ｭｦ閠・髄縺代・譛蛻昴・諡｡蠑ｵ縺ｨ縺励※縺ｯ髮｣蠎ｦ縺御ｸ翫′繧翫☆縺弱∪縺吶・

### v2 縺ｧ讀懆ｨ弱☆繧九ｂ縺ｮ
- active pair 縺ｮ visible range 縺ｫ蠢懊§縺ｦ莉・pair 繧・`revealRange()` 縺ｧ霑ｽ蠕薙＆縺帙ｋ[^visible-ranges][^reveal-range]
- hunk 蜊倅ｽ阪・ session navigation
- session minimap

---

## 9. Blame 繝薙Η繝ｼ險ｭ險茨ｼ・ative editor 邯ｭ謖・ｼ・

## 9.1 陦ｨ遉ｺ蟇ｾ雎｡
- 迴ｾ蝨ｨ縺ｮ workspace file (`file:`)
- historical snapshot (`multidiff:`)

縺ｮ縺ｩ縺｡繧峨↓繧・blame 繧帝←逕ｨ蜿ｯ閭ｽ縺ｫ縺励∪縺吶・

## 9.2 陦ｨ遉ｺ譁ｹ豕・
- `createTextEditorDecorationType()` 縺ｧ whole-line 閭梧勹[^decorations]
- `overviewRulerLane` 繧剃ｽｿ縺｣縺溷・菴捺ｨ｡讒麓^overview-ruler]
- hover text 縺ｧ revision / author / date / summary

### 陦ｨ遉ｺ繧､繝｡繝ｼ繧ｸ
- 譁ｰ縺励＞陦後⊇縺ｩ逶ｮ遶九▽
- 蜿､縺・｡後⊇縺ｩ關ｽ縺｡逹縺・◆陦ｨ遉ｺ
- 繝輔ぃ繧､繝ｫ蜿ｳ遶ｯ縺ｮ overview ruler 縺ｧ縲後←縺薙′譛霑題ｧｦ繧峨ｌ縺溘°縲阪′荳逶ｮ縺ｧ蛻・°繧・

## 9.3 heatmap 縺ｮ諢丞袖莉倥￠
blame 縺ｯ defect predictor 縺ｧ縺ｯ縺ｪ縺・◆繧√・ 
譁・ｨ縺ｯ谺｡縺ｮ繧医≧縺ｫ謨ｴ逅・＠縺ｾ縺吶・

- `stability hint`
- `recently changed`
- `older / newer lines`
- `high churn area`・亥ｰ・擂・・

**縲後ヰ繧ｰ縺後≠繧九阪〒縺ｯ縺ｪ縺上梧怙霑代ｈ縺丞虚縺・◆鬆伜沺縺九←縺・°縲・*繧堤､ｺ縺・UI 縺ｫ縺励∪縺吶・

## 9.4 native editor 繧剃ｽｿ縺・茜轤ｹ
Blame 繝薙Η繝ｼ縺・Webview 縺ｧ縺ｯ縺ｪ縺乗ｨ呎ｺ・editor 荳翫↓霈峨ｋ縺溘ａ縲・

- syntax highlight
- folding
- Ctrl+繧ｯ繝ｪ繝・け
- file 讀懃ｴ｢
- editor keybindings

繧堤ｶｭ謖√＠繧・☆縺・〒縺吶・

---

## 10. Language Feature Compatibility Layer

## 10.1 縺ｪ縺懷ｿ・ｦ√°

VS Code 縺ｮ language features 縺ｯ document selector 縺ｧ驕ｩ逕ｨ蟇ｾ雎｡縺梧ｱｺ縺ｾ繧翫∪縺吶・^doc-selector]

縺､縺ｾ繧翫√≠繧区僑蠑ｵ縺・

```ts
{ scheme: 'file', language: 'typescript' }
```

縺ｮ繧医≧縺ｫ selector 繧堤ｵ槭▲縺ｦ縺・ｋ蝣ｴ蜷医・ 
`multidiff:` URI 縺ｧ縺ｯ閾ｪ蜍慕噪縺ｫ蜷後§讖溯・縺御ｻ倥￥縺ｨ縺ｯ髯舌ｊ縺ｾ縺帙ｓ縲・

縺励◆縺後▲縺ｦ縲・*縲系ative editor 縺ｧ髢九￠縺ｰ蠢・★ Ctrl+繧ｯ繝ｪ繝・け縺ｧ縺阪ｋ縲・*縺ｨ縺ｾ縺ｧ縺ｯ險縺医∪縺帙ｓ縲・ 
縺薙％縺ｯ險ｭ險井ｸ翫∵怙蛻昴°繧画ｭ｣逶ｴ縺ｫ謇ｱ縺・∋縺阪〒縺吶・

## 10.2 蝓ｺ譛ｬ謌ｦ逡･

### 繝ｬ繧､繝､ 1: 縺ｾ縺壹・邏逶ｴ縺ｫ native resource 縺ｨ縺励※髢九￥
- `FileSystemProvider`
- path 縺ｫ蜈・・諡｡蠑ｵ蟄・
- `setTextDocumentLanguage`

縺薙ｌ縺ｧ蜍輔￥ language extension 縺ｯ縺昴・縺ｾ縺ｾ菴ｿ縺・・

### 繝ｬ繧､繝､ 2: compatibility mode 繧堤畑諢上☆繧・
險ｭ螳壹〒谺｡繧貞・繧頑崛縺亥庄閭ｽ縺ｫ縺吶ｋ縲・

- `virtual`・域里螳夲ｼ・ `multidiff:` 縺ｮ縺ｾ縺ｾ髢九￥
- `tempFile`・井ｺ呈鋤驥崎ｦ厄ｼ・ 荳譎・mirror file 繧剃ｽ懊▲縺ｦ `file:` 縺ｨ縺励※髢九￥

#### `tempFile` 縺ｮ諢丞峙
- `scheme: 'file'` 蜑肴署縺ｮ language extension 縺ｫ蟇・○繧・
- Ctrl+繧ｯ繝ｪ繝・け繧・盾辣ｧ隗｣豎ｺ縺ｮ謌仙粥邇・ｒ荳翫￡繧・

#### 谺轤ｹ
- temp file 縺ｮ邂｡逅・′蠢・ｦ・
- diagnostics 縺・temp path 縺ｫ蜃ｺ繧句ｴ蜷医′縺ゅｋ
- 讀懃ｴ｢蟇ｾ雎｡繧・workspace 縺ｨ縺ｮ髢｢菫ゅ↓豕ｨ諢上′蠢・ｦ・

## 10.3 Go to Definition fallback・郁ｨｭ險井ｸ翫・菫晞匱・・

VS Code 縺ｯ `registerDefinitionProvider()` 縺ｧ custom scheme 蜷代￠ provider 繧堤匳骭ｲ縺ｧ縺阪ー^register-definition]
`vscode.executeDefinitionProvider` 縺ｧ譌｢蟄・provider 繧貞他縺ｳ蜃ｺ縺帙∪縺吶・^execute-definition]

縺昴・縺溘ａ v2 莉･髯阪〒縺ｯ縲∵ｬ｡縺ｮ fallback 繧貞ｮ溯｣・庄閭ｽ縺ｧ縺吶・

1. `multidiff:` document 荳翫〒 Ctrl+繧ｯ繝ｪ繝・け
2. Fukusa 迢ｬ閾ｪ縺ｮ DefinitionProvider 縺悟女縺代ｋ
3. 蠢・ｦ√↑繧・temp mirror file 繧堤畑諢上☆繧・
4. 縺昴・ mirror file 縺ｫ蟇ｾ縺励※ `vscode.executeDefinitionProvider` 繧貞ｮ溯｡後☆繧・
5. 邨先棡 Location 繧偵◎縺ｮ縺ｾ縺ｾ縲√∪縺溘・ `multidiff:` 縺ｫ蜀阪・繝・ヴ繝ｳ繧ｰ縺励※霑斐☆

### 10.3.1 蛻晉沿縺ｧ縺ｮ迴ｾ螳溽噪縺ｪ蜆ｪ蜈磯・ｽ・
- **蜆ｪ蜈・1**: 縺ｾ縺・native diff editor / snapshot editor 縺ｧ縺昴・縺ｾ縺ｾ蜉ｹ縺上°隧ｦ縺・
- **蜆ｪ蜈・2**: 蜉ｹ縺九↑縺・ｨ隱槭□縺・tempFile mode 繧堤畑諢上☆繧・
- **蜆ｪ蜈・3**: 譛ｬ蠖薙↓蠢・ｦ√↓縺ｪ縺｣縺溘ｉ bridge provider 繧剃ｽ懊ｋ

蛻晉沿縺九ｉ荳・・縺ｪ bridge 繧剃ｽ懊ｋ蠢・ｦ√・縺ゅｊ縺ｾ縺帙ｓ縲・ 
縺溘□縺励∬ｨｭ險井ｸ翫・騾・￡驕薙→縺励※縺ｯ謖√▲縺ｦ縺翫″縺ｾ縺吶・

---

## 11. Webview 縺ｮ菴咲ｽｮ縺･縺托ｼ域隼險ょｾ鯉ｼ・

## 11.1 蛻晉沿縺ｧ縺ｮ謇ｱ縺・
Webview 縺ｯ **繧ｳ繝ｼ繝画悽譁・ｒ謠冗判縺励↑縺・*蜑肴署縺ｫ螟画峩縺励∪縺吶・

### 逕ｨ騾泌呵｣・
- session summary
- revision timeline
- cache overview
- blame distribution summary
- future 縺ｮ heatmap dashboard

## 11.2 菴ｿ繧上↑縺・畑騾・
- multi-column code body rendering
- native diff editor 縺ｮ莉｣譖ｿ
- syntax highlighting / Ctrl+繧ｯ繝ｪ繝・け縺ｮ蜀榊ｮ溯｣・

## 11.3 菴咲ｽｮ縺･縺・
Webview 縺ｯ **optional auxiliary surface** 縺ｧ縺吶・ 
荳ｻ蠖ｹ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・

---

## 12. Git / SVN 蜿門ｾ怜ｱ､・亥渕譛ｬ縺ｯ謐ｮ縺育ｽｮ縺搾ｼ・

## 12.1 GitAdapter
譁ｹ驥昴・ v0.1 繧堤ｶｭ謖√＠縺ｾ縺吶・

- 邨・∩霎ｼ縺ｿ Git API 繧貞━蜈・
- 雜ｳ繧翫↑縺・Κ蛻・□縺・Git CLI fallback
- arbitrary revision blame 縺ｯ CLI fallback 繧定ｨｱ螳ｹ

## 12.2 SvnAdapter
- `svn info`
- `svn log`
- `svn cat`
- `svn diff`
- `svn blame`

繧・CLI 縺ｧ謇ｱ縺・婿驥昴ｒ邯ｭ謖√＠縺ｾ縺吶・

## 12.3 蜿門ｾ怜ｱ､縺・native UI 縺ｫ縺ｩ縺・ｹ九′繧九°
蜿門ｾ礼ｵ先棡縺ｯ譛邨ら噪縺ｫ

- snapshot bytes 竊・`FileSystemProvider`
- blame lines 竊・`DecorationController`
- session pairs 竊・`NativeDiffSessionController`

縺ｫ豬√ｌ繧九◆繧√・ 
UI 縺・Git / SVN 蟾ｮ逡ｰ繧呈э隴倥＠縺ｪ縺上※貂医∩縺ｾ縺吶・

---

## 13. Cache 險ｭ險茨ｼ・ative editor 蛹悶↓蜷医ｏ縺帙◆謨ｴ逅・ｼ・

## 13.1 cache 遞ｮ蛻･
1. history cache
2. snapshot cache
3. diff cache
4. blame cache

## 13.2 驥崎ｦ√↑螟画峩轤ｹ
v0.1 縺ｧ縺ｯ Webview 謠冗判逕ｨ DTO 縺ｸ縺ｮ譛驕ｩ蛹悶′濶ｲ豼・°縺｣縺溘〒縺吶′縲・ 
v0.2 縺ｧ縺ｯ **snapshot cache 繧呈怙荳頑ｵ√・荳ｭ蠢・*縺ｫ鄂ｮ縺阪∪縺吶・

### 逅・罰
native diff editor 縺ｯ譛邨ら噪縺ｫ縲畦eft URI縲阪罫ight URI縲阪ｒ髢九￥縺縺代〒繧医￥縲・ 
縺昴・閭悟ｾ後〒 `readFile()` 縺碁ｫ倬溘↓霑斐ｌ縺ｰ繧医＞縺九ｉ縺ｧ縺吶・

## 13.3 warm 縺ｮ蜊倅ｽ・
- 迴ｾ蝨ｨ file 縺ｮ recent revisions
- session 蜈ｨ菴・
- blame
- visible window 蜻ｨ霎ｺ縺ｮ pair

## 13.4 clear 縺ｮ蜊倅ｽ・
- current file
- current repo
- all
- expired only

---

## 14. package.json / Contribution 險ｭ險・

## 14.1 蝓ｺ譛ｬ譁ｹ驥・
- `extensionKind: ["workspace"]`
- `extensionDependencies: ["vscode.git"]`
- custom editor / webview panel 縺ｯ蠢・医↓縺励↑縺・
- tree view + commands + editor actions 繧剃ｸｻ蟆守ｷ壹↓縺吶ｋ

## 14.2 荳ｻ隕√さ繝槭Φ繝画｡・

```text
multidiff.openForCurrentFile
multidiff.openForExplorerFile
multidiff.openSessionAdjacent
multidiff.openSessionBase
multidiff.shiftWindowLeft
multidiff.shiftWindowRight
multidiff.openRevisionSnapshot
multidiff.toggleBlameHeatmap
multidiff.cache.warmCurrentFile
multidiff.cache.clearCurrentRepo
multidiff.cache.clearAll
multidiff.compatibility.openSnapshotAsTempFile
```

## 14.3 險ｭ螳夐・岼譯・

```jsonc
{
  "multidiff.presentation.mode": "native",
  "multidiff.native.visiblePairCount": 3,
  "multidiff.native.maxVisiblePairCount": 6,
  "multidiff.snapshot.openMode": "virtual",
  "multidiff.compatibility.definitionFallback": "auto",
  "multidiff.cache.maxSizeMb": 512,
  "multidiff.cache.prefetchRecentRevisionCount": 20,
  "multidiff.blame.mode": "age",
  "multidiff.blame.showOverviewRuler": true
}
```

### 陬懆ｶｳ
- `presentation.mode` 縺ｮ譌｢螳壼､縺ｯ `native`
- 蟆・擂 `experimentalWebviewOverview` 繧定ｶｳ縺励※繧ゅ∵里螳壹・螟峨∴縺ｪ縺・

---

## 15. 繝・ぅ繝ｬ繧ｯ繝医Μ讒区・譯茨ｼ域隼險ら沿・・

```text
fukusa/
  src/
    extension.ts

    commands/
      openForCurrentFile.ts
      openForExplorerFile.ts
      openSessionAdjacent.ts
      openSessionBase.ts
      shiftWindowLeft.ts
      shiftWindowRight.ts
      openRevisionSnapshot.ts
      toggleBlameHeatmap.ts
      warmCache.ts
      clearCache.ts
      openSnapshotAsTempFile.ts

    application/
      sessionService.ts
      revisionPickerService.ts
      blameService.ts
      cacheService.ts
      languageFeatureCompatibilityService.ts

    adapters/
      common/
        repositoryAdapter.ts
        types.ts
      git/
        gitAdapter.ts
        gitApi.ts
        gitCli.ts
      svn/
        svnAdapter.ts
        svnCli.ts

    infrastructure/
      fs/
        snapshotFsProvider.ts
        uriFactory.ts
        languageModeResolver.ts
      cache/
        memoryCache.ts
        persistentCache.ts
        cacheKeys.ts
      temp/
        tempSnapshotMirror.ts

    presentation/
      native/
        nativeDiffSessionController.ts
        editorLayoutController.ts
      decorations/
        blameDecorationController.ts
      views/
        sessionsTreeProvider.ts
        cacheTreeProvider.ts

    compatibility/
      definitionBridgeProvider.ts
      hoverBridgeProvider.ts
      referenceBridgeProvider.ts

    util/
      hash.ts
      disposable.ts
      output.ts

    test/
      unit/
      integration/
```

---

## 16. 繝・・繧ｿ繝｢繝・Ν譯茨ｼ域隼險ら沿・・

```ts
export interface RepoContext {
  kind: 'git' | 'svn';
  repoRoot: string;
  repoId: string;
  displayName: string;
}

export interface RevisionRef {
  id: string;
  shortId: string;
  author?: string;
  date?: string;
  message?: string;
  order: number;
}

export interface SnapshotResource {
  uri: vscode.Uri;
  repo: RepoContext;
  relativePath: string;
  revision: RevisionRef;
  languageId?: string;
}

export interface DiffPair {
  left: SnapshotResource | vscode.Uri;
  right: SnapshotResource | vscode.Uri;
  title: string;
  pairIndex: number;
}

export interface MultiDiffSession {
  sessionId: string;
  repo: RepoContext;
  relativePath: string;
  revisions: RevisionRef[];
  compareMode: 'adjacent' | 'base';
  visibleStartPairIndex: number;
  visiblePairCount: number;
}
```

---

## 17. 螳溯｣・せ繝・ャ繝暦ｼ域隼險ら沿・・

## Milestone 0: 諡｡蠑ｵ縺ｮ鬪ｨ邨・∩
### 繧ｴ繝ｼ繝ｫ
- F5 縺ｧ襍ｷ蜍・
- Command Palette 縺九ｉ迴ｾ蝨ｨ繝輔ぃ繧､繝ｫ URI 繧貞叙蠕・

## Milestone 1: Readonly snapshot 繧・native editor 縺ｧ髢九￥
### 繧ｴ繝ｼ繝ｫ
- `multidiff:` URI 繧・`FileSystemProvider` 縺ｧ蜈ｬ髢・
- arbitrary revision snapshot 繧呈ｨ呎ｺ・editor 縺ｧ髢九￠繧・

### 繧・ｋ縺薙→
1. `registerFileSystemProvider`
2. URI parser
3. GitAdapter 縺ｮ `getSnapshot`
4. `readFile()` 螳溯｣・
5. `showTextDocument(snapshotUri)`
6. `setTextDocumentLanguage` 縺ｧ險隱槭Δ繝ｼ繝芽｣懈ｭ｣

> 縺薙％縺ｧ縺ｾ縺壹敬istorical code 繧呈ｨ呎ｺ・editor 縺ｧ髢九￥縲肴・蜉滉ｽ馴ｨ薙ｒ菴懊ｋ縲・ 
> 縺薙・譎らせ縺ｧ Webview 縺ｯ荳崎ｦ√・

## Milestone 2: Pair diff 繧・native diff editor 縺ｧ髢九￥
### 繧ｴ繝ｼ繝ｫ
- 迴ｾ蝨ｨ繝輔ぃ繧､繝ｫ or revision snapshot 縺ｮ pair diff 繧・`vscode.diff` 縺ｧ髢九￠繧・

### 繧・ｋ縺薙→
1. revision 1 莉ｶ驕ｸ謚・
2. left / right URI 讒狗ｯ・
3. `vscode.diff(left, right, title, options)`

> 縺薙％縺ｾ縺ｧ縺ｧ縲梧ｨ呎ｺ・diff editor 繧定・蛻・・諡｡蠑ｵ縺九ｉ謫阪ｋ縲榊渕遉弱′螳梧・縺吶ｋ縲・

## Milestone 3: Fukusa Session
### 繧ｴ繝ｼ繝ｫ
- 3 pair 遞句ｺｦ繧呈ｨｪ荳ｦ縺ｳ縺ｧ髢九￠繧・

### 繧・ｋ縺薙→
1. 隍・焚 revision 驕ｸ謚・
2. adjacent / base pair 逕滓・
3. `setEditorLayout`
4. 蜷・group 縺ｫ `vscode.diff` 繧帝幕縺・
5. session tree 繧剃ｽ懊ｋ
6. next / prev window 繧ｳ繝槭Φ繝峨ｒ菴懊ｋ

> v0.1 縺ｮ Webview multi-column 繧医ｊ蜈医↓縲√％縺｡繧峨ｒ螳梧・縺輔○繧九・

## Milestone 4: Blame heatmap
### 繧ｴ繝ｼ繝ｫ
- current file / snapshot 縺ｫ blame 繧帝㍾縺ｭ繧・

### 繧・ｋ縺薙→
1. blame 蜿門ｾ・
2. age bucket 蛹・
3. decoration 菴懈・
4. overview ruler 陦ｨ遉ｺ
5. hover

## Milestone 5: Cache
### 繧ｴ繝ｼ繝ｫ
- 2 蝗樒岼縺碁溘＞縺薙→繧剃ｽ捺─縺ｧ縺阪ｋ

### 繧・ｋ縺薙→
1. memory cache
2. persistent cache
3. readFile 邨檎罰邨ｱ蜷・
4. warm / clear commands

## Milestone 6: SVN support
### 繧ｴ繝ｼ繝ｫ
- Git 縺ｨ蜷後§ native UI 縺ｧ SVN 繧ょ虚縺・

## Milestone 7: Compatibility fallback
### 繧ｴ繝ｼ繝ｫ
- `multidiff:` 縺ｧ definition 縺悟ｼｱ縺・ｨ隱槭↓蟇ｾ蜃ｦ縺吶ｋ

### 繧・ｋ縺薙→
1. temp snapshot mirror
2. open-as-temp-file command
3. 蠢・ｦ√↑繧・DefinitionProvider bridge

## Milestone 8: 陬懷勧 UI・亥ｿ・ｦ√↑繧会ｼ・
### 繧ｴ繝ｼ繝ｫ
- Session summary 繧・blame overview 繧定｣懷勧陦ｨ遉ｺ縺吶ｋ

### 繧・ｋ縺薙→
- Tree View 蜈・ｮ・
- optional Webview overview

---

## 18. 蛻晏ｭｦ閠・髄縺代・縲梧怙蛻昴↓隗ｦ繧矩・分縲・

蛻昴ａ縺ｦ縺ｮ VS Code 諡｡蠑ｵ髢狗匱縺ｪ繧峨・・分縺ｯ蠢・★縺薙≧縺励∪縺吶・

1. 繧ｳ繝槭Φ繝・
2. `FileSystemProvider`
3. snapshot 繧・text editor 縺ｧ髢九￥
4. `vscode.diff`
5. `setEditorLayout`
6. blame decoration
7. cache
8. SVN
9. compatibility fallback
10. optional Webview

### 縺薙・鬆・分縺瑚憶縺・炊逕ｱ
- 縲系ative editor 繧帝幕縺上阪％縺ｨ縺後∽ｻ雁屓縺ｮ隕∵ｱゅ・譬ｸ蠢・□縺九ｉ
- Webview 繧医ｊ蜈医↓ editor surface 縺ｮ逅・ｧ｣縺悟ｿ・ｦ√□縺九ｉ
- pair diff 縺ｾ縺ｧ蜍輔￠縺ｰ縲√◎繧後□縺代〒萓｡蛟､縺悟・繧九°繧・

---

## 19. 繝ｪ繧ｹ繧ｯ縺ｨ蟇ｾ遲厄ｼ域隼險ら沿・・

## R-01: custom scheme 縺ｧ縺ｯ荳驛ｨ language features 縺悟柑縺九↑縺・
### 閭梧勹
language extension 蛛ｴ縺・`scheme: 'file'` 縺ｫ邨槭▲縺ｦ縺・ｋ蜿ｯ閭ｽ諤ｧ縺後≠繧九・^doc-selector]

### 蟇ｾ遲・
- path 縺ｨ extension 繧堤ｶｭ謖√☆繧・
- `setTextDocumentLanguage`
- tempFile compatibility mode
- 蠢・ｦ√↑繧・DefinitionProvider bridge

## R-02: 蜷梧凾蜿ｯ隕匁焚縺ｫ荳企剞縺後≠繧・
### 閭梧勹
editor columns 縺ｯ `ViewColumn.Nine` 縺御ｸ企剞縲・^viewcolumn-max]

### 蟇ｾ遲・
- session 縺ｨ visible window 繧貞・髮｢
- default visible pair count 縺ｯ 3
- over-limit 譎ゅ・ next / prev window

## R-03: adjacent mode 縺ｧ縺ｯ荳ｭ螟ｮ revision 縺碁㍾隍・｡ｨ遉ｺ縺輔ｌ繧・
### 閭梧勹
`A竊韮`, `B竊任` 縺ｮ繧医≧縺ｫ middle revision 縺瑚､・焚 pair 縺ｫ迴ｾ繧後ｋ

### 蟇ｾ遲・
- 縺薙ｌ縺ｯ native diff editor 邯呎価縺ｮ縺溘ａ縺ｮ諢丞峙逧・trade-off 縺ｨ譏守､ｺ縺吶ｋ
- 莉ｻ諢・revision 蜊倅ｽ薙ｒ snapshot editor 縺ｧ髢九￥繧ｳ繝槭Φ繝峨ｒ逕ｨ諢上☆繧・

## R-04: temp file fallback 縺檎・髮・
### 閭梧勹
莠呈鋤諤ｧ縺ｮ縺溘ａ縺ｮ temp mirror 縺ｯ cleanup 繧・diagnostics 縺ｮ蝠城｡後ｒ謖√▽

### 蟇ｾ遲・
- 譌｢螳壹・ `virtual`
- 蝠城｡後・縺ゅｋ險隱槭□縺・`tempFile` 繧呈怏蜉ｹ蛹・
- temp path 縺ｯ extension storage 驟堺ｸ九↓髯仙ｮ壹＠縲…lear command 繧呈戟縺､

## R-05: pair 髢灘酔譛溘せ繧ｯ繝ｭ繝ｼ繝ｫ縺悟ｼｱ縺・
### 閭梧勹
native diff editor 繧定､・焚譚溘・繧九◆繧√仝ebview 縺ｮ繧医≧縺ｪ螳悟・邨ｱ蛻ｶ縺ｯ縺励▼繧峨＞

### 蟇ｾ遲・
- MVP 縺ｧ縺ｯ pair 蜀・酔譛溘□縺代〒蜊∝・縺ｨ蜑ｲ繧雁・繧・
- v2 縺ｧ visible range 霑ｽ蠕薙ｒ隧ｦ縺・

---

## 20. 縺薙・險ｭ險医〒縺ｮ MVP

### MVP 縺ｮ螳夂ｾｩ
谺｡縺ｮ 5 譚｡莉ｶ繧呈ｺ縺溘＠縺溘ｉ縲∵怙蛻昴・蜈ｬ髢句呵｣懊↓縺ｧ縺阪∪縺吶・

1. Git 縺ｮ迴ｾ蝨ｨ繝輔ぃ繧､繝ｫ縺ｧ history 繧定､・焚驕ｸ謚槭〒縺阪ｋ
2. 3 pair 莉･荳翫ｒ native diff editor 縺ｧ讓ｪ荳ｦ縺ｳ縺ｫ髢九￠繧・
3. historical snapshot 繧貞腰菴薙・ native editor 縺ｧ髢九￠繧・
4. snapshot 荳翫↓ blame heatmap 繧定｡ｨ遉ｺ縺ｧ縺阪ｋ
5. 荳ｻ隕∝ｯｾ雎｡險隱槭〒縲∝ｰ代↑縺上→繧・syntax highlighting 縺ｨ Ctrl+繧ｯ繝ｪ繝・け縺ｮ讀懆ｨｼ縺悟ｮ御ｺ・＠縺ｦ縺・ｋ

### 陬懆ｶｳ
譛蠕後・ 5 縺ｯ縲悟・險隱槭〒菫晁ｨｼ縲阪〒縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・ 
**閾ｪ蛻・・迴ｾ蝣ｴ縺ｧ譛ｬ蠖薙↓菴ｿ縺・ｨ隱・*繧貞━蜈医＠縺ｦ acceptance test 縺ｫ蜈･繧後ｋ縺ｹ縺阪〒縺吶・

---

## 21. 蜿励￠蜈･繧悟渕貅厄ｼ郁ｿｽ蜉・・

## AC-NATIVE-01
snapshot 繧帝幕縺・◆譎ゅ・*Webview 縺ｧ縺ｯ縺ｪ縺乗ｨ呎ｺ・text editor** 縺ｧ髢九￥

## AC-NATIVE-02
pair compare 縺ｯ **讓呎ｺ・diff editor** 縺ｧ髢九￥

## AC-NATIVE-03
snapshot 縺ｫ蟇ｾ縺励※ blame decoration 繧帝㍾縺ｭ縺ｦ繧ゅ・壼ｸｸ縺ｮ editor 謫堺ｽ懊′螢翫ｌ縺ｪ縺・

## AC-NATIVE-04
蟇ｾ雎｡險隱槭〒 syntax highlighting 縺梧怏蜉ｹ

## AC-NATIVE-05
蟇ｾ雎｡險隱槭〒 Ctrl+繧ｯ繝ｪ繝・け縺後◎縺ｮ縺ｾ縺ｾ蜍輔￥縲√∪縺溘・ compatibility mode 縺ｧ蜍輔￥

## AC-NATIVE-06
visible window 繧貞・繧頑崛縺医※繧・session 諠・ｱ縺悟､ｱ繧上ｌ縺ｪ縺・

---

## 22. 譛邨よ署譯・

莉雁屓縺ｮ霑ｽ蜉隕∽ｻｶ繧貞・繧後ｋ縺ｪ繧峨・ 
**v0.1 縺ｮ Webview 荳ｻ菴捺｡医・縺ｾ縺ｾ騾ｲ繧縺ｹ縺阪〒縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・*

險ｭ險亥､画峩縺ｯ蠢・ｦ√〒縺吶・ 
縺溘□縺励√◎繧後・謔ｪ縺・％縺ｨ縺ｧ縺ｯ縺ｪ縺上√・縺励ｍ譁ｹ蜷第ｧ縺後ｈ繧頑・遒ｺ縺ｫ縺ｪ縺｣縺溘→閠・∴繧九∋縺阪〒縺吶・

### 謾ｹ險ょｾ後・荳險縺ｧ縺ｮ譁ｹ驥・
**縲熊ukusa 縺ｯ縲∫峡閾ｪ謠冗判縺ｮ diff viewer 縺ｧ縺ｯ縺ｪ縺上〃S Code 讓呎ｺ・editor / diff editor 繧呈據縺ｭ繧句ｱ･豁ｴ髢ｲ隕ｧ繧ｪ繝ｼ繧ｱ繧ｹ繝医Ξ繝ｼ繧ｿ縺ｨ縺励※菴懊ｋ縲・*

縺薙ｌ縺ｪ繧峨・

- 縺ゅ↑縺溘′谺ｲ縺励＞ **N 蛟九・蟾ｮ蛻・ｿｽ霍｡**
- **鬮倬溯｡ｨ遉ｺ縺ｮ縺溘ａ縺ｮ繧ｭ繝｣繝・す繝･**
- **讓｡讒倥→縺励※隱ｭ繧√ｋ blame**
- 縺昴＠縺ｦ莉雁屓霑ｽ蜉縺輔ｌ縺・**VS Code 讓呎ｺ匁ｩ溯・縺ｮ邯呎価**

繧偵・ 譛ｬ縺ｮ險ｭ險医〒荳｡遶九＠繧・☆縺上↑繧翫∪縺吶・

---

## 23. 蜿り・ｳ・侭

[^webviews]: VS Code UX Guidelines - Webviews. Webview 縺ｯ native API 縺ｧ雜ｳ繧翫↑縺・ｴ蜷医□縺台ｽｿ縺・∋縺阪→縺輔ｌ縺ｦ縺・ｋ縲・https://code.visualstudio.com/api/ux-guidelines/webviews>
[^fsp-regular]: VS Code 1.23 release notes - FileSystem Providers. arbitrary source 縺ｮ files/folders 繧・VS Code 縺・regular files 縺ｮ繧医≧縺ｫ謇ｱ縺医ｋ縲・https://code.visualstudio.com/updates/v1_23>
[^git-fsp]: VS Code 1.41 release notes - Git: Adoption of FileSystemProvider. 邨・∩霎ｼ縺ｿ Git 諡｡蠑ｵ縺ｯ older versions 縺ｮ蜈ｬ髢九↓ `FileSystemProvider` 繧呈治逕ｨ縺励｝erformance / reliability 繧呈隼蝟・＠縺ｦ縺・ｋ縲・https://code.visualstudio.com/updates/v1_41>
[^lang-overview]: VS Code Language Extensions Overview. syntax highlight 繧・Go to Definition 縺ｪ縺ｩ縺ｮ險隱樊ｩ溯・縺ｯ language extensions 縺梧球縺・・https://code.visualstudio.com/api/language-extensions/overview>
[^doc-selector]: VS Code Document Selectors. language features 縺ｯ language / scheme / pattern 縺ｧ驕ｩ逕ｨ蟇ｾ雎｡縺梧ｱｺ縺ｾ繧九・https://code.visualstudio.com/api/references/document-selector>
[^viewcolumn-max]: VS Code API. `showTextDocument` 縺ｧ菴懊ｉ繧後ｋ column 縺ｯ `ViewColumn.Nine` 縺ｾ縺ｧ縲・https://code.visualstudio.com/api/references/vscode-api>
[^readonly-fsp]: VS Code API. `registerFileSystemProvider(..., { isReadonly: true })` 縺ｨ readonly file system 縺ｮ謇ｱ縺・・https://code.visualstudio.com/api/references/vscode-api>
[^set-language]: VS Code API. `setTextDocumentLanguage(document, languageId)` 縺ｧ document 縺ｮ language 繧貞､画峩縺ｧ縺阪ｋ縲・https://code.visualstudio.com/api/references/vscode-api>
[^diff-command]: VS Code Built-in Commands. `vscode.diff(left, right, title, options)` 縺ｧ diff editor 繧帝幕縺代ｋ縲・https://code.visualstudio.com/api/references/commands>
[^set-layout]: VS Code 1.25 release notes. `vscode.setEditorLayout` 縺ｧ editor group layout 繧呈ｧ区・縺ｧ縺阪ｋ縲・https://code.visualstudio.com/updates/v1_25>
[^register-definition]: VS Code API. `registerDefinitionProvider(selector, provider)`縲Ｄustom scheme 蜷代￠ definition provider 繧堤匳骭ｲ縺ｧ縺阪ｋ縲・https://code.visualstudio.com/api/references/vscode-api>
[^execute-definition]: VS Code Built-in Commands / Commands guide. `vscode.executeDefinitionProvider` 縺ｧ譌｢蟄・definition provider 繧貞ｮ溯｡後〒縺阪ｋ縲・https://code.visualstudio.com/api/references/commands> / <https://code.visualstudio.com/api/extension-guides/command>
