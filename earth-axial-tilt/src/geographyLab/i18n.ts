export type Language='ja'|'en';
const ja:Record<string,string>={
'Earth geography · experimental':'地球の気候地理 · 接続試験版',
'Same sunlight. Different ground.':'同じ太陽、違う地表。',
'Pinned real land fractions + a 648-cell educational climate model.':'実海陸データと、648セルの教材用気候モデル。',
'Back to Earth Lab':'地球ラボへ戻る',
'Large text':'大きな文字', 'Experiment':'実験条件','Tilt (°)':'地軸の傾き（°）',
'Eccentricity':'離心率','Perihelion direction (°)':'近日点の太陽方向（°）','Axis direction (°)':'地軸の方位（°）',
'Uniform ocean reference':'同条件の一様な海と比較','Calculate':'計算する','Cancel':'中止',
'Apply tilt/orbit edits with Calculate. Day and location need no new solve.':'傾き・軌道の変更は「計算する」で適用。日付と地点は再計算しません。',
'Model day':'モデル日','Latitude (°)':'緯度（°）','Longitude (°)':'経度（°）',
'Layer':'地図の表示','Temperature':'気温','Earth − uniform ocean':'実海陸 − 一様な海','Land fraction':'陸の面積割合',
'Run status':'計算の状態','Ready':'計算完了','Cancelled':'中止しました','Loading verified data…':'海陸データを検証中…',
'Solving Earth geography…':'実海陸の一年を計算中…','Solving the ocean reference…':'比較用の海の一年を計算中…',
'Calculating; previous temperatures are hidden.':'計算中。前の条件の気温は表示していません。',
'Not computed':'未計算','Retry with Calculate. No fallback temperatures are shown.':'「計算する」で再試行。代わりの気温を表示することはありません。',
'Selected model cell':'選択中のモデルセル','Temperature / ocean':'気温／一様な海','Effective storage':'有効蓄熱',
'Cell centre':'セルの中心','Polar-row mean; longitude is undefined.':'極域行の平均。極点の経度は未定義です。',
'10° × 10° · 18 × 36 cells. Not city-scale weather.':'10°×10°・18×36セル。都市の天気ではありません。',
'Geographic field':'緯度・経度の地図','Click a cell. Arrow keys move between cells.':'セルをクリック。矢印キーでも移動できます。',
'Annual response at the selected cell':'選択セルの一年の応答',
'Solid: Earth geography · dashed: uniform ocean, same tilt and orbit.':'実線：実海陸／破線：同じ傾き・軌道の一様な海。',
'Selected-longitude season atlas':'選択経度の季節マップ',
'North at top; model day across. This is a longitude section, not a zonal mean.':'上が北、横がモデル日。全経度の平均ではなく、選択経度の断面です。',
'Fixed temperature colours: −100 to 180 °C. Numeric values are not clipped.':'気温の色域は −100〜180℃で固定。数値は切り詰めません。',
'Land fraction: 0–100%.':'陸の面積割合：0〜100%。',
'Difference colours are symmetric around zero.':'差分の色域はゼロを中心に対称です。',
'Full model-year range':'モデル一年の範囲','Annual mean':'年間平均','years to convergence':'収束までの年数',
'Cached result':'保存済みの計算結果','New result':'新しく計算した結果','Retained result memory':'保持中の計算データ',
'Settings':'実験の保存','Copy experiment link':'実験リンクをコピー','Save JSON':'JSONを保存','Load JSON':'JSONを開く',
'Link copied':'リンクをコピーしました','Settings loaded':'設定を読み込みました',
'Invalid settings; the previous experiment is unchanged.':'不正な設定です。実験は変更していません。',
'Clipboard unavailable; use Save JSON.':'コピーを利用できません。JSONを保存してください。',
'What this experiment does not simulate':'このモデルに入っていないもの',
'No weather, winds, ocean currents, topography, clouds, melting ice or nonlinear feedback.':'天気・風・海流・標高・雲・氷の融解・非線形フィードバックは計算しません。',
'Extreme model extrapolation. These temperatures are not climate predictions.':'簡易モデルの大きな外挿です。この気温は実気候の予測ではありません。',
'Natural Earth 1:110m v4.1.0 · public-domain source · q64 equal-area land fractions.':'Natural Earth 1:110m v4.1.0・公開領域データ・q64等面積サンプリング。',
'This standalone integration page does not change the accepted 3D Earth UI or its schema.':'この独立した接続試験ページは、従来の3D地球UIや保存形式を変更しません。',
'Pole readout averages the polar row; this atlas retains the selected longitude.':'極点の数値は極域行の全経度平均。このマップは選択経度の断面です。',
'Ocean reference disabled':'海の比較は無効','day':'日','N':'北','S':'南','Temperature (°C)':'気温（℃）',
};
let language:Language='ja';
export function setLanguage(value:Language):void{language=value;}
export function getLanguage():Language{return language;}
export function t(text:string):string{return language==='ja'?(ja[text]??text):text;}
export function translateDocument():void {
  document.documentElement.lang=language;
  document.querySelectorAll<HTMLElement>('[data-g]').forEach(e=>{e.textContent=t(e.dataset.g!);});
}
