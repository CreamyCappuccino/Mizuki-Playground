# Earth Axial Tilt Lab — Roadmap

[復帰入口](START_HERE.md) · [現在の機能](README.md) · [v0.8時点の元計画](docs/PLAN-v0.8.md)

## 現在地

- 1.3.0-alpha.1：Climate Geographyの最初の一区切りとして、Classicを保持したidealized Land/Ocean同緯度対照を実装。実在maskと2D geographyは未実装で、v1.3全体完了とはしない。版の状態は [V1.3](docs/V1.3.md) を参照。
- 1.2.0-rc.1：Earth Orbit Mechanicsはmain `8364981`の同一HEAD CIで成功。正式な実機gateは未確認のまま維持。

- v0.9 Compare Lab は実装済み。
- v1.0 は `1.0.0-rc.1`。自動検証は整っているが、**物理iPhoneのSafari確認はまだ正式版ゲートとして残す**。
- 公開URLへのdeploymentは未実施。潮さんの明示GOが必要。

RCから先は、単に機能を積み足すのではなく、
**「何を変えると何が分かるか」→「なぜそうなるか」→「地球以外ではどうなるか」**
という順にLabを広げる。

---

# v1.0 final — human polish gate

v1.1へ大きく進む前後どちらでもよいが、正式1.0タグ／版番号確定の前に以下を閉じる。

### marker clarity — 完了

- 選択地点マーカーは白球から、画面正対で読める **pin** 系へ変更済み。
- 太陽直下点は別形状へ分離し、遠方のSun方向マーカーとも視覚的に区別済み。
- ガイド凡例・日英ラベル・ドキュメントも形状に合わせて更新済み。
- Science guidesとの関係も整理済み。

この改善は1.0 RCの人間目線polishとしてmainへ反映済み。

### device gate

- 物理iPhone Safariで portrait / landscape / pinch / Focus / Compare / Orbit / Atlas を確認。
- 問題があれば修正し、結果を `RELEASE_CHECKLIST.md` と版記録へ残す。
- 自動WebKitを実機確認の代用としない。

---

# v1.1 — Clarity & Shareable Experiments（実装済み／RC検証）

## 目的

**「何を見ているか分かる」「同じ実験をもう一度開ける」**を完成させる。
新しい気候物理は入れない。1.0の科学結果を変えない安全な拡張。

## 1. Marker / guide polish

- v1.0 finalのpin・subsolar targetを本格採用。
- Axis / selected point / subsolar point / Sun directionの視覚語彙を統一。
- 必要なガイドには短いオンキャンバスlabelを付ける。ただし常時文字だらけにしない。
- normal/science layer双方で十分なcontrastを保つ。

## 2. Experiment presets

「設定値」ではなく**問い**をプリセット化する。

例:
- Earth vs 90° — polar summer
- 0° — no axial seasons
- Taipei day/night
- North Pole at solstice
- Heat storage: Fast vs Slow
- Coupled motion — why seasons happen

presetを選ぶと、傾き・日付・地点・表示レイヤー・比較状態を一括設定する。
何を変えたかを短く表示し、勝手に再生開始はしない。

## 3. Shareable state URL

- tilt A/B
- day
- rotation
- location or custom latitude/longitude
- layer
- Compare on/off
- heat storage / temperature model
- scene view
- languageは原則個人表示設定としてURLから外すか明示的に扱う

をURL query/hashへシリアライズできるようにする。

要件:
- URLを開けば同じ科学状態を復元。
- 未知キー・古いversion・壊れた値は安全に無視。
- share URLを開いても自動再生しない。
- private dataは含めない。
- state schema versionを持ち、将来migration可能にする。

## 4. Verification

- serialize → parse round trip。
- malformed URL safety。
- preset実行前後で、意図した項目以外が変わらない。
- Japanese/English、mobile、大きな文字。
- markerの意味をスクリーンショットでも誤認しにくいことを人間レビュー。

## Definition of Done

初見で白球/月問題がなくなり、面白い実験を1クリックで再現でき、その状態をURLで共有できる。

---

# v1.2 — Orbit Mechanics Lab（実装済み／RC検証）

## 目的

現在の「円軌道＋傾き」から一歩進み、
**季節は傾きだけでなく、軌道の形と季節の位置関係でも変わる**ことを実験できるようにする。

ここから物理拡張。既存のcircular modelはEarth Classicとして完全に残す。

## 1. Eccentricity

- eccentricity `e` を0からEarth近傍、さらに教材用の大きな値まで調整。
- Kepler軌道上の距離変化を表示。
- TOA solar fluxを `1/r²` で変化させる。
- 公転速度はKeplerの第二法則と整合するmodel timeを採用。
- 円軌道 `e=0` は現行結果へ厳密に戻る。

## 2. Perihelion season

- 近日点方向を季節に対して回転可能にする。
- Northern summer at perihelion / aphelion 等を比較。
- 軸傾斜そのものと近日点効果を分けて表示。

## 3. Precession

- 軸の傾き量は固定したまま、空間内の軸方向を回転。
- 「tilt magnitude」と「axis orientation」をUI上でも分離。
- Orbit overviewで歳差方向が視覚的に理解できる。

## 4. Orbital diagnostics

- current Sun distance
- relative solar flux
- orbital speed
- perihelion/aphelion markers
- seasonal quarter labels

を追加。

## 5. Compare integration

A/Bで
- same tilt, different eccentricity
- same orbit, different precession
- same e, opposite perihelion season

を比較可能にする。

## Scientific guardrails

- 実際のEarth ephemerisを装うものではない。
- calendar dateではなくmodel orbital phase。
- `e=0`でperihelion方向が無意味になるdegenerate caseを明示。
- Thermal EBMへ距離依存日射を入れる場合は、annual forcing全体を再計算しstale cacheを防ぐ。

## Definition of Done

「23.44°の傾きが同じでも、近日点が夏か冬かで季節強度が変わる」をOrbit/Atlas/graph/Compareの全部で観察できる。

---

# v1.3 — Climate Geography Lab（alpha 1：idealized対照を実装）

## 目的

現在の「同じ緯度なら同じ熱容量」という世界から、
**海と陸が季節応答を変える**ところまで進める。

他惑星へ進む前に、Earth自身の気候実験を完成させる。

## 1. Land / ocean heat capacity

- **alpha 1完了:** 同緯度・同じforcingで、全球一様なLand 2.5 m相当／Ocean 50 m相当を切り替え、年間曲線とAtlas差分で振幅・lagを見る。
- **alpha 2 review候補:** Natural Earth 4.1.0を固定し、18×36のlongitude-aware grid、面積fraction、可変熱容量、周期EBM、bounded PCGを独立coreとして実装。別ページの実Worker previewで地点・年間曲線・選択経度sectionまで接続。
- **残り:** 既存3D Earth profile、A/B Compare、本体Season Atlas、共有state/schemaへ同じsampler/provenanceを安全に統合する。
- latitude-band EBMを2D GCMへ一気に変えず、どの解像度で扱うか設計レビューを先に行う。
- alpha 1では既存Fast/Slowの係数を再利用し、根拠のない新定数を追加しない。
- 「Mixed 10m」というglobal knobと地理分布modeの意味を混同しない。

## 2. Optional altitude correction

- 地形データを入れる場合は出典・解像度・単位を明示。
- lapse-rateを使うなら教材近似として説明。

## 3. Geography-aware Compare / Atlas

- 同じ緯度でもland/oceanで温度振幅とlagが違うことを年間曲線／Atlasで比較。A/Bは引き続き世界比較であり、profile差分へ暗黙に転用しない。
- Season atlasは緯度だけの場から、地理依存をどの形で表現するかを再設計。
- 既存の緯度帯モードはEarth Classicとして残す。

## Definition of Done

同じ緯度でもland/oceanによって季節温度の振幅・lagが違うことを、モデルの限界込みで説明できる。

---

# v1.4 — Earth Feedbacks Lab

## 目的

Earthの気候を「受け身の温度応答」から、
**状態が次の放射収支へ戻るfeedback experiment**へ進める。

ここはEarth専用章として閉じる。他惑星の気候係数は混ぜない。

## 1. Ice-albedo feedback

- temperature dependent albedo
- ice advance / retreat
- snowball tendency
- equilibrium sensitivity

を実験できるようにする。

非線形feedbackを入れる場合は必ず:

- initial condition dependence
- multiple equilibria
- spin-up
- hysteresis

を隠さない。

## 2. Initial condition / hysteresis experiments

- warm start / cold start
- same forcing, different history
- warming and cooling sweeps

を比較できるようにする。

## 3. Clouds

**visual clouds**と**climate clouds**を完全に分離。

- visual cloud layerはpresentation only。
- climate cloud parameterizationは別機能として、入れるなら科学仕様へ明記。
- 雲を入れない場合も、それをモデル限界として明示。

## Scientific guardrails

- feedback導入前のEBMをEarth Classicとして残す。
- 数値安定性のためのclipを物理現象として見せない。
- 収束しない条件、複数平衡、極端値を「失敗」として隠さない。

## Definition of Done

同じ外力でも初期状態やfeedbackによって異なるEarthの平衡へ行きうることを、再現可能な実験として説明できる。

---

# v1.5 — Milankovitch & Earth Synthesis

## 目的

v1.2の軌道力学、v1.3の地理、v1.4のfeedbackをまとめ、
**Earthを一つの完成した季節・軌道・簡易気候実験Labとして閉じる。**

対象:

- obliquity
- eccentricity
- precession / climatic precession
- perihelion season
- land/ocean heat response
- optional ice-albedo feedback

## 1. Milankovitch Explorer

- orbital parameter timeline
- selected epoch
- summer insolation at chosen latitude
- compare epochs
- Season atlas across orbital configurations

数万年の実Earth時系列を扱うなら、信頼できる外部データセット／近似式を採用し出典を固定。
単なるsin波を「実Earth history」と呼ばない。
first versionではparameter sweepと概念実験を優先してもよい。

## 2. Earth synthesis presets

例:

- modern-like Earth
- zero tilt Earth
- 90° Earth
- high-eccentricity Earth
- summer-at-perihelion vs summer-at-aphelion
- warm-start vs cold-start feedback
- land vs ocean seasonal lag

各presetは「何が違うか」を明示し、観測値再現を装わない。

## 3. Earth completion pass

- Earth専用UIの重複整理。
- Orbit / Compare / Atlas / Climate / Share URLを一貫させる。
- performance、memory、mobile、accessibilityを再点検。
- Earth Classicでv1.0代表値が維持される回帰テスト。
- Earth向け科学文書を一度完成形へ整理。

## Definition of Done

「地軸傾斜から始め、軌道・地理・feedback・Milankovitchまで」を一つのEarth教材として連続して操作できる。
**この時点をEarth章の完成とする。**

---

# v2.0 — Planet Lab Foundation

## 目的

Earth v1.xで得た概念を壊さずに、
**planet + orbit + rotation + climate capability**へ一般化する。

この版では、まずarchitectureを一般化し、Earthを新構造へ移す。
Mars/Uranusを急いで同時実装しない。

## Core concepts

- PlanetDefinition
- OrbitDefinition
- RotationDefinition
- ClimateModel capability
- World A / World B experiment state
- shared presentation state
- versioned share URL

## Migration

- v1.x share URLを読み込めるmigration。
- Earth Classic presetでv1.xの代表結果が一致。
- old docs/historyを保持。
- PlanetDefinition化してもEarth側の科学結果を変えない。

## UI

- Planet
- Orbit
- Rotation
- Climate
- Compare
- Atlas
- Guides

を段階的に見せる。

Earth初心者がいきなり全設定を浴びないようBasic experienceを維持する。

## Definition of Done

Earthが一般化された内部構造の上で、v1.xと同じ実験を再現できる。
**まだ他惑星がなくても2.0 foundationとして成立する。**

---

# v2.1 — Mars

## 目的

Planet Lab最初の別世界としてMarsを追加する。

- obliquity
- orbital period
- rotation period / direction
- eccentricity
- solar distance baseline
- axial orientation conventions

を信頼できる根拠から定義。

MarsはEarthと傾きが近い一方、eccentricityが大きい。
**「傾斜角が似ていても季節強度は同じではない」**を主題にする。

### Climate policy

Earth Thermal EBMをそのままMarsへ流用しない。
最初はSolar / Daylight / Sun now / orbitを中心にし、Mars専用温度モデルがなければTemperatureは未提供と明示。

## Definition of Done

Earth vs Marsをastronomy metricsで比較でき、Earth用気候係数を偽装転用しない。

---

# v2.2 — Uranus

## 目的

Earthの90°実験を、実在する極端なobliquity worldへ接続する。

- 約98°級のobliquity
- rotation / retrograde convention
- orbital period
- solar distance
- seasonal illumination geometry

をplanet-specificに定義。

「98°」を単純にEarthの90°sliderへ押し込まず、軸方向と回転方向のconventionを明文化する。

### Climate policy

Earth/Marsと同様、専用モデルがないTemperatureは未提供。
まず極端な昼夜・季節照明を正しく見せる。

## Definition of Done

「地球を横倒しにした思考実験」と「実際のUranusの極端な季節」を同じLabで比較できる。

---

# v2.x — その先

候補:

- Venus / Mercury / giant planetsのrotation/orbit experiments
- planet-specific simple climate models
- more generalized atmosphere capability
- export / classroom scenario packs

惑星数を増やすこと自体を目的にせず、各worldで何が学べるかを優先する。

---

# 長距離実装の推奨順

1. **1.0 marker polish — 完了**
2. **1.1 presets + shareable state URL — 実装済み、同一HEADのCIで確認**
3. **1.2 Earth orbit mechanics: eccentricity / perihelion / precession**
4. **1.3 Earth climate geography: land / ocean / altitude**
5. **1.4 Earth feedbacks: ice-albedo / hysteresis**
6. **1.5 Milankovitch + Earth synthesis — Earth章完成**
7. **2.0 Planet Lab architecture foundation**
8. **2.1 Mars**
9. **2.2 Uranus**

**Earthを終えてから他惑星へ進む。**
途中でMars/Uranusを挟まず、Earthで科学・UI・比較・Atlas・URL schemaを成熟させてから一般化する。

各版ごとに typecheck → unit → build → browser → docs → same-HEAD CI を閉じてから次へ進む。
前版の不具合を抱えたまま版番号だけ進めない。

---

# 自律実装時のstop conditions

以下に当たったら、科学的に勝手な決定をして先へ進まず、実装を安全な境界で止める。

- planet固有の定数やモデルを信頼できる根拠なしに決める必要がある。
- Earth EBMを別惑星へ流用しないと先へ進めない。
- 新しい非線形気候feedbackで、結果の意味を検証できない。
- dependency/licenseが不明。
- 実機確認が必要なrelease gate。
- public deployment、課金、外部書込みなど新しい権限境界。

それ以外のUI、テスト、docs、内部refactor、既存モデルの明確な一般化は自律的に進めてよい。

---

# 運用

- START_HERE = 現在地。
- README = 今できること。
- ROADMAP = 未来。
- SCIENCE = 数式とモデル制限。
- Vx.y = 実際に変更・検証した事実。
- VERIFICATION = そのrelease candidateの証拠。

計画を完了事実と混同しない。
変更時は影響した文書だけ更新する。
実装と同じHEADのCI、手動観察、未確認事項を区別する。
