# Earth Axial Tilt Lab — Roadmap

[復帰入口](START_HERE.md) · [現在の機能](README.md) · [v0.8時点の元計画](docs/PLAN-v0.8.md)

## 現在地

- v0.9 Compare Lab は実装済み。
- v1.0 は `1.0.0-rc.1`。自動検証は整っているが、**物理iPhoneのSafari確認はまだ正式版ゲートとして残す**。
- 公開URLへのdeploymentは未実施。潮さんの明示GOが必要。

RCから先は、単に機能を積み足すのではなく、
**「何を変えると何が分かるか」→「なぜそうなるか」→「地球以外ではどうなるか」**
という順にLabを広げる。

---

# v1.0 final — human polish gate

v1.1へ大きく進む前後どちらでもよいが、正式1.0タグ／版番号確定の前に以下を閉じる。

### marker clarity

- 現在の白球の選択地点マーカーを、球ではなく **pin / ▼ + dot** 系へ変更。
- 太陽直下点は黄色い球ではなく **ring / target / sun glyph** 系へ変更。
- 遠方のSun方向マーカー、選択地点、太陽直下点を形だけでも識別可能にする。
- hover/tap/「？」で「選択地点」「太陽直下点」を説明。
- Science guides OFF時に何が消えるかを明確化。

### device gate

- 物理iPhone Safariで portrait / landscape / pinch / Focus / Compare / Orbit / Atlas を確認。
- 問題があれば修正し、結果を `RELEASE_CHECKLIST.md` と版記録へ残す。
- 自動WebKitを実機確認の代用としない。

---

# v1.1 — Clarity & Shareable Experiments

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

# v1.2 — Orbit Mechanics Lab

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

# v1.3 — Other Worlds: Mars & Uranus

## 目的

Earth Labを壊さずに、**同じ幾何学が別惑星ではどう見えるか**へ進む。

最初から万能planet engineにはしない。まず信頼できるastronomy layerを作る。

## Phase A — astronomy first

planet preset:
- Earth
- Mars
- Uranus

各presetで少なくとも:
- obliquity
- orbital period
- rotation period / direction
- eccentricity
- solar distance baseline
- axial orientation conventions

を明示。

### Mars

- 約25°の傾きだが、Earthよりeccentricityが大きい。
- axial tiltだけ似ていても、季節強度がEarthと同じではないことを示す。

### Uranus

- 約98°級の軸で、現在の90°実験を現実のplanetへ接続。
- retrograde/axis conventionを曖昧にしない。
- 「98°」を単純にEarthの90°sliderへ押し込まず、planet-specific orientationを定義。

## Climate policy

v1.3初期は **Earth Thermal EBMをMars/Uranusへそのまま流用しない**。

- Solar / Daylight / Sun now はplanet physicsで表示可能。
- Temperatureはplanet-specific modelがない場合「未提供」と明示。
- 後から簡易planet climateを追加するなら、係数・意味・限界を別文書化する。

## Compare

Earth vs Mars / Earth vs Uranusをastronomy metricsで比較。

## Definition of Done

「Earthの横倒し実験」と「実際のUranusの極端な季節」を同じUIで比較できるが、Earth気候モデルを偽装転用しない。

---

# v1.4 — Climate Geography Lab

## 目的

現在の「同じ緯度なら同じ熱容量」という世界から、
**海と陸が季節応答を変える**ところまで進める。

これはv1.2/v1.3より計算・説明コストが高いため独立版にする。

## 1. Land / ocean heat capacity

- まずはEarth mapをland/ocean maskとして使用。
- latitude-band EBMを2D GCMへ一気に変えず、どの解像度で扱うか設計レビューを先に行う。
- 最低限、land/oceanでeffective heat capacityを変える。
- 「Mixed 10m」というglobal knobと地理分布modeの意味を混同しない。

## 2. Optional altitude correction

- 地形データを入れる場合は出典・解像度・単位を明示。
- lapse-rateを使うなら教材近似として説明。

## 3. Ice-albedo feedback — stretch goal

- temperature dependent albedo
- snowball / ice retreatの可能性
- equilibrium sensitivity

を実験できる候補。

ただし非線形feedbackを入れる場合:
- initial condition dependence
- multiple equilibria
- spin-up
- hysteresis

を隠さない。

## 4. Clouds

**visual clouds**と**climate clouds**を完全に分離。

- visual cloud layerはpresentation only。
- climate cloud parameterizationは別機能として、入れるなら科学仕様へ明記。

## Definition of Done

同じ緯度でもland/oceanによって季節温度の振幅・lagが違うことを、モデルの限界込みで説明できる。

---

# v1.5 — Milankovitch Explorer

## 目的

v1.2のorbital controlsを、単発のsliderから
**長期的な軌道要素の組み合わせを理解する教材**へ進める。

対象:
- obliquity
- eccentricity
- precession / climatic precession
- perihelion season

## 方針

- 数万年の実Earth時系列を扱うなら、信頼できる外部データセット／近似式を採用し出典を固定。
- 単なるsin波を「実Earth history」と呼ばない。
- first versionでは「parameter sweep」と「概念実験」を優先してもよい。

## UI

- orbital parameter timeline
- selected epoch
- summer insolation at chosen latitude
- compare epochs
- Season atlas across orbital configurations

## Definition of Done

「Milankovitch cycles」という名前だけでなく、どの軌道要素がどの緯度・季節の日射へ効くのかを操作で分解できる。

---

# v2.0 — Planet Lab

## 目的

ここまでEarth Axial Tilt Labへ足してきた機能を、
**planet + orbit + rotation + climate experiment**の一般化されたLabとして整理し直す。

v2.0は機能追加よりarchitecture milestone。

## Core concepts

- PlanetDefinition
- OrbitDefinition
- RotationDefinition
- ClimateModel capability
- World A / World B experiment state
- shared presentation state
- versioned share URL

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

## Migration

- v1.x share URLを読み込めるmigration。
- Earth Classic presetでv1.xの代表結果が一致。
- old docs/historyを保持。

## Definition of Done

Earthを特別ケースとして維持しつつ、Mars/Uranusや異なる軌道条件を同じ実験フレームで安全に扱える。

---

# 長距離実装の推奨順

依存関係を考えると、次の順で進める。

1. **1.0 marker polish**
2. **1.1 presets + shareable state URL**
3. **1.2 eccentricity / perihelion / precession**
4. **1.3 Mars / Uranus astronomy**
5. **1.4 land/ocean climate geography**
6. **1.5 Milankovitch Explorer**
7. **2.0 architecture consolidation**

一晩で無理に全版を完成させる必要はない。
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
