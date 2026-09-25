# Earth Axial Tilt Lab — ROADMAP

この文書は **「次に何を作るか」** の正本。現在地の入口は `START_HERE.md`、現在できることは `README.md`、物理仕様は `docs/SCIENCE.md`、各版で実際に変更した内容は `docs/V0.x.md` を参照する。

ロードマップは固定契約ではない。実装中の検証で、科学的整合性・操作性・保守性を守るために順番や版内の区切りを変更してよい。ただし、未実装の候補を完成済みとして扱わない。

## 現在地 — v0.8

v0.8時点で、次の基盤がある。

- 0–90°の地軸傾斜、365日の円軌道モデル、独立した自転位相。
- `Play year`（日付だけ進める）と `Play day`（日付固定で自転だけ進める）。
- Earth / Sun now / Daily solar / Daylight / Temperature の3D表示。
- Thermal EBM、Fast / Mixed / Slowの熱容量実験、23.44°比較。
- Year / Dayグラフ、Season atlas、地点選択、科学ガイド。
- 日本語 / English、文脈ヘルプ「？」、Large text、mobile対応。
- Earth中心の拡大表示、Focus view、Sun中心のOrbit overview。
- ローカル4K昼夜Earth、夜景、大気表現、画質プリセット。
- GitHub Actionsによる型・単体・build・Chromium E2E検証。

ここからv1.0までは、**比較実験を完成させ、その後に製品として締める**。

---

# v0.9 — Compare Lab

## 目的

一つの地球の条件を変えて観察する段階から、**条件Aと条件Bを同時に比較する科学実験装置**へ進める。

主役は **Dual Earth**。Coupled motion（自転＋公転の同時再生）もこの版に含める。

## 0.9 Core

### 1. Dual Earth

- Earth A / Earth B を同じ画面で比較。
- 各Earthの地軸傾斜を個別設定。
- 初期プリセット:
  - Earth 23.44° vs 0°
  - Earth 23.44° vs 45°
  - Earth 23.44° vs 90°
  - Custom vs Custom
- 同じ日付・地点・表示レイヤーを共有して比較できる。
- 必要なら同期を解除できる設計にするが、比較の基準が曖昧にならないUIを優先する。
- 既存のSingle Earth操作は残し、Dual Earthを強制しない。

### 2. 比較値

選択地点について、A / B / A−B を明示する。

対象候補:

- Daylight
- Daily solar (TOA)
- Temperature
- Sun elevation / Solar now は同じ瞬間条件で意味が明確な場合のみ

差分は、同じ日・緯度・温度モデル・熱容量など、**比較対象以外の条件を揃えた場合に何を差し引いているか**を表示する。

### 3. Dual Orbit Overview

Sun中心の公転俯瞰でもA/Bを比較できるようにする。

- 両Earthの公転位相を同期。
- 軸はそれぞれ宇宙空間で固定。
- サイズ・距離は説明用で非スケール。
- Earth A/Bが見分けられるが、科学レイヤーの色解釈を邪魔しない。
- 春分・夏至・秋分・冬至へのジャンプを比較表示でも使える。

### 4. Coupled motion — 自転＋公転の同時再生

現在の独立実験は残したまま、第三の再生モードを追加する。

- `Play year`: 公転位相のみ進む。自転位相固定。
- `Play day`: 日付固定。自転位相のみ進む。
- **Coupled motion**: 公転位相と自転位相を同時に進める。

設計条件:

- 365日モデルの一年と昼夜周期の関係が一貫すること。
- 単に「dayとrotationを同時に適当に増やす」のではなく、太陽に対する1日の周期が破綻しない進め方を数式・テストで固定する。
- 表示速度は観察用に加速してよいが、**公転と自転の比率は速度変更で変えない**。
- hidden tab復帰で巨大な時間ジャンプを起こさない。
- `Play day` / `Play year` の既存意味を変更しない。
- Dual EarthではA/Bが同じモデル時間を共有し、比較中に時間基準がずれない。

### 5. Compare向け「？」ガイド

追加例:

- 23.44° vs 90°で夏至を見る
- 赤道と極の役割がどう変わるか
- 日射差と温度差が同時でない理由
- Heat storageを同じにして比較する意味
- Coupled motionで「軸は固定なのに季節が生まれる」ことを見る

## 0.9 Mobile / accessibility

- Desktop: 2つのEarthを同時に見やすい配置。
- Phone: 無理な横並びで縮小せず、縦並びまたはA/B切替を採用。
- A/Bどちらを操作しているか常に明確にする。
- 日本語Largeでも主要ボタン・差分値が潰れない。
- keyboard / touch / hoverなし環境でも比較操作とヘルプが成立する。

## 0.9 検証

最低限:

- A/Bの条件分離と共有条件のテスト。
- A=Bなら差分が0になる。
- Earth 23.44° vs 23.44°は3D状態・数値とも一致。
- Coupled motionの公転/自転比率、wrap、hidden-tab挙動。
- Dual Orbitで軸の慣性方向が保たれる。
- Single Earthへ戻して既存v0.8の数値・操作が変わらない。
- 日本語 / English、Comfort / Large、desktop / portrait mobile。
- Thermal Worker失敗時でもSolar / Daylight比較は使える。

## 0.9 Definition of Done

- Dual Earthで「同じ日に、傾きだけ変えると何が違うか」を直感的に比較できる。
- Coupled motionで、Sun中心表示における自転・公転・固定軸の関係を破綻なく観察できる。
- 既存のSingle Earth / Play day / Play yearを壊さない。
- 型・unit・build・browser CIがgreen。
- `README.md`、`START_HERE.md`、`ROADMAP.md`、`docs/V0.9.md`を現状へ更新。

---

# v1.0 — Release-quality Planet Lab

## 目的

新しい大物を足す版ではなく、v0.1〜v0.9で育てた機能を **「完成品として使える状態」** にまとめる。

原則として、v1.0で新しい物理モデルの大幅追加はしない。必要な修正・説明・検証を優先する。

## 1. UI / information architecture の最終整理

候補:

- Basic / Advanced、または同等の段階表示。
- セクション折りたたみ。
- 現在の実験モードが見失われない表示。
- 日本語の用語・文章の最終点検。
- 「？」ガイドの漏れ・重複を整理。
- 初回利用者向けの短い導入。
- 既存機能を隠しすぎず、画面密度を下げる。

## 2. 実機Safari / iPhone

CI Chromiumだけでなく、実機で確認する。

- portrait / landscape
- touch drag / pinch zoom
- Focus / Orbit overview
- Dual Earth
- Coupled motion
- Season atlas
- 日本語 / English
- Comfort / Large
- dialog / keyboard相当操作の代替
- safe-area / viewport / scroll

実機確認で見つかった差異はv1.0前に修正する。

## 3. Visual polish

Normal Earth / Orbit overviewの装飾を磨く。

候補:

- Sun表面・corona・glowの改善。
- Earthの大気・day/night transitionの微調整。
- 独立cloud layerは、負荷と意味が明確なら導入候補。

原則:

- Science layerの色や数値へ装飾を混ぜない。
- visual qualityで物理結果を変えない。
- 非スケール表現を実寸と誤認させない。

## 4. Packaging / performance

- `package-lock.json`をcommit。
- CIを`npm ci`へ移行。
- bundle warningを点検し、必要ならcode splitting / lazy loading。
- Season atlas / Compare / helpなど、常時不要なコードの分割を検討。
- texture / geometry / worker / event listenerのdisposeを再点検。
- mobile GPU負荷とメモリを確認。
- 新しい依存を増やす場合は本当に必要かを見直す。

## 5. Regression / release verification

- 代表的な数値不変条件を固定。
- 日本語 / English。
- desktop / mobile。
- Earth view / science layers。
- Single / Compare / Orbit / Coupled。
- Thermal Worker failure / image failure。
- screenshot artifactを継続。
- 安定する部分ではpixel-baseline regression導入を検討。

「数字は正しいがUIが壊れた」と「見た目は同じだが物理が変わった」の両方を拾う。

## 6. Documentation 1.0

v1.0では文書の役割を明確化する。

- `README.md`: 現在できること、Quick Start、主要実験、検証。
- `START_HERE.md`: 次の開発セッションの最短入口。
- `ROADMAP.md`: 今後の計画。完了項目は履歴へ移す。
- `docs/GUIDE.ja.md`: 日本語の利用者向け実験ガイド。
- `docs/SCIENCE.md`: 数式・モデル・制限の正本。
- `docs/V1.0.md`: v1.0で実際に変更・検証した内容。
- 過去の`V0.x.md`は履歴として保持。

READMEは過去版の長い積み上げを必要に応じて整理し、履歴詳細はdocsへ逃がす。

## 7. Deployment-ready

v1.0は公開可能な状態まで整える。

- relative/static hosting確認。
- asset license / attribution確認。
- metadata / title / descriptionを整理。
- production buildを再現可能にする。

**実際のGitHub Pages等への公開は自動で行わない。潮さんの明示的なGOを境界とする。**

## v1.0 Definition of Done

- 初めて触る人が日本語UIと「？」だけでも主要実験を理解できる。
- Single / Compare / Orbit / Coupledを破綻なく行き来できる。
- 実機iPhone/Safariを含む主要環境で操作可能。
- build/test/dependencyの再現性がある。
- 科学的な意味とモデル限界が文書・UIで一致。
- 公開してもよい品質だが、公開自体は別承認。

---

# v1.x — 第二章候補

順番は固定しない。v1.0後に価値・実装コスト・科学的整合性で決める。

## Other planets

- Mars
- Uranus
- 惑星ごとの自転周期、年、傾斜角、太陽距離などを扱う場合は、Earth用の仮定を暗黙に流用しない。
- 特にUranusは大きなobliquityを持つため、このLabとの相性がよい。

## Orbital parameters / Milankovitch

- eccentricity
- longitude of perihelion / season relative to perihelion
- axial precession
- obliquity cycle
- Milankovitch的な組み合わせ

現在の「365日・円軌道・傾き中心」の意味を崩さず、Advanced experimentとして追加する。

## Climate model 2

候補:

- land / ocean heat-capacity contrast
- ice-albedo feedback
- altitude
- cloud / latent heat
- simple ocean transport

ただし複雑化するほど「教材用モデル」と「現実の気候予測」の境界説明を強化する。都市の実測値へ無理にfitさせない。

## Visual / presentation

- cloud layer
- richer Sun
- additional observation presets
- shareable experiment state / URL

---

# 常に守る方針

1. **操作で何が分かるかを優先する。** 機能数だけを増やさない。
2. **表示と物理を分離する。** Language / Focus / Quality / decorationは科学結果を変えない。
3. **比較条件を明示する。** A−Bの意味を曖昧にしない。
4. **極端条件でも嘘をつかない。** 90°や極点のdegenerate caseを隠さない。
5. **古い結果を新条件として見せない。** Workerやcacheのstale stateを防ぐ。
6. **mobileで文字を縮めて解決しない。** reflow / stacking / fewer labelsを使う。
7. **過去版は履歴、現在地は現在形の文書を正本にする。**
8. **deployは別承認。**
9. **完了後はGitHub CIの同一head_shaを確認し、許可済みのMac local pullまで行う。**

# このROADMAPの更新方法

- 大きな仕様追加・優先順位変更時に更新。
- 実装を始める前に「対象版」の項目を確認。
- 完成した内容は各`docs/V0.x.md` / `V1.x.md`へ事実として記録し、ROADMAPでは完了扱いへ整理。
- `START_HERE.md`の「現在地」「読む順番」「残作業」がROADMAPと矛盾しないよう同時点検。
- ROADMAPに書いてあるだけの機能をREADMEの「現在できること」と混同しない。
