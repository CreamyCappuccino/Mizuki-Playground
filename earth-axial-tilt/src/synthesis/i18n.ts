import { getLanguage } from '../ui/i18n';
export const TEXT = {
 back:['← 3D Earth Lab','← 3D地球ラボ'],language:['Language','言語'],large:['Large text','大きな文字'],
 eyebrow:['EARTH SYNTHESIS / v1.5','EARTH SYNTHESIS / v1.5'],
 title:['One Earth. Many possible seasons.','ひとつの地球。いくつもの季節。'],
 lead:['Milankovitch Explorer','ミランコビッチ・エクスプローラー'],
 intro:['Change one orbital parameter and compare sunlight, season length and energy. Then carry the exact conditions into the Earth and Feedback laboratories.','軌道条件をひとつずつ変え、日射・季節の長さ・エネルギーを比較。その条件を地球ラボとフィードバック実験へ渡せます。'],
 scope:['Conceptual parameter sweep, not a dated reconstruction. Fixed 1 au / 365 model days. These are top-of-atmosphere solar quantities, not temperatures.','概念的なパラメータ走査で、年代付きの地球史ではありません。1 au・365モデル日を固定。表示するのは大気上端の日射で、気温ではありません。'],
 controls:['01 / Set up the experiment','01 / 実験を組み立てる'],
 parameter:['Vary one parameter','ひとつだけ変える条件'],tilt:['Obliquity (°)','地軸傾斜 (°)'],eccentricity:['Eccentricity','離心率'],perihelionSeason:['Seasonal longitude at perihelion (°)','近日点の季節黄経 (°)'],
 start:['From','開始'],end:['To','終了'],count:['Samples (3–41)','条件数 (3–41)'],
 base:['Fixed background conditions','背景となる固定条件'],peri:['Perihelion azimuth (°)','近日点方位 (°)'],axis:['Axis azimuth (°)','地軸方位 (°)'],
 parameterHelp:['The varied field overrides its background value. Perihelion season = perihelion azimuth − axis azimuth; 0° and 360° are the same orientation.','走査する値が背景値を上書きします。近日点の季節＝近日点方位−地軸方位。0°と360°は同じ向きです。'],
 latitude:['Latitude (°N)','緯度 (°N)'],longitude:['Longitude for linked labs (°E)','連携先の経度 (°E)'],
 summer:['Season reference','季節の基準'],north:['Northern summer · 90°','北半球の夏 · 90°'],south:['Southern summer · 270°','南半球の夏 · 270°'],
 run:['Run sweep','走査する'],cancel:['Cancel','中止'],idle:['Ready to run. Nothing runs automatically.','実行待ち。自動で計算を開始しません。'],running:['Calculating conditions','条件を計算中'],ready:['Sweep complete','走査完了'],canceled:['Canceled. Press Run to start again.','中止しました。「走査する」で再開できます。'],error:['Calculation failed. Press Run to retry.','計算できませんでした。「走査する」で再試行できます。'],invalid:['Invalid settings. The previous valid experiment was kept.','設定が不正です。直前の有効な実験を保持しました。'],
 results:['02 / Read the contrast','02 / 違いを読み取る'],selected:['Selected case A','選択条件 A'],comparison:['Comparison case B','比較条件 B'],metric:['Plot metric','グラフの指標'],
 solstice:['Daily mean at season reference','季節基準日の日平均日射'],halfMean:['Summer-half time mean','夏半期の時間平均日射'],halfDays:['Summer-half duration','夏半期の長さ'],halfEnergy:['Summer-half energy','夏半期の積算エネルギー'],annualMean:['Local annual mean','この緯度の年平均日射'],globalMean:['Global annual mean','全球の年平均日射'],
 contrastNote:['A and B diagnostics use each case’s own season-reference day. The annual curves below use the same model calendar. Summer-half means equinox to equinox around the chosen solstice, not three civil months.','A・Bの診断値は各条件自身の季節基準日です。下の年間曲線は共通のモデル暦。夏半期は選んだ至点を挟む分点から分点までで、暦の3か月ではありません。'],
 degenerate:['A circular orbit has no distinct perihelion. At zero tilt the season angles are reference markers, not axial seasons.','円軌道では近日点方向に区別がありません。傾きゼロの季節角は基準位置で、地軸傾斜による季節ではありません。'],
 trend:['One parameter, one measured response','ひとつの条件と、その応答'],
 annual:['A year on the same calendar','同じモデル暦で一年を見る'],annualNote:['Solid: A. Dashed: B. Day 80 is the model spring reference for both worlds; equal dates need not mean equal seasonal angles.','実線：A。破線：B。両世界とも80日目が春の基準。日付が同じでも季節角が同じとは限りません。'],modelDay:['Model day','モデル日'],
 atlas:['Sunlight across the sweep','条件ごとの季節日射'],atlasNote:['Rows: sweep cases from first (top) to last (bottom). Columns: 72 equal seasonal-angle bins, NOT equal time intervals. Fixed W/m² scale for the whole sweep.','行：上から走査の開始→終了条件。列：季節角を72等分（時間の等分ではありません）。全条件で共通のW/m²尺度です。'],angle:['Seasonal longitude (°)','季節黄経 (°)'],
 transfer:['03 / Continue in the laboratories','03 / その条件で実験を続ける'],profile:['Earth climate profile','地球の気候モデル'],classic:['Classic · uniform storage','Classic · 一様蓄熱'],land:['Idealized land','理想化した陸'],ocean:['Idealized ocean','理想化した海'],geography:['Real geography · 10° cells','実海陸 · 10°セル'],depth:['Classic / zonal storage (m equivalent)','Classic・緯度帯モデルの蓄熱 (m相当)'],
 openEarth:['Open A/B in 3D Earth + Atlas','3D地球・AtlasでA/Bを開く'],openFeedback:['Selected orbit → zonal feedback','選択した軌道 → 緯度帯フィードバック'],
 bridgeNote:['3D Earth shares A’s reference day with B; B is not moved to its own solstice. Feedback receives A’s orbit and latitude, but remains a separate uniform-storage 90-band model. No 2D geographic feedback is implied. Links restore settings without starting playback or feedback calculations.','3D地球ではAの基準日をBと共有し、Bだけを自身の至点へ移しません。Feedbackへ渡すのはAの軌道・緯度で、90緯度帯・一様蓄熱の別モデルです。実海陸2Dのfeedbackではありません。リンクからの復元は再生・feedback計算を開始しません。'],
 linkStorage:['Linked zonal storage','連携先の緯度帯蓄熱'],linkOnly:['Material, storage and longitude affect the linked climate experiments only, not this solar sweep.','素材・蓄熱・経度は連携先の気候実験だけに使い、この日射走査には影響しません。'],
 recipes:['04 / The Earth story, in seven questions','04 / 七つの問いで地球を巡る'],recipesNote:['These open existing experiments. Different climate models are named rather than silently combined.','既存の実験へ移動します。異なる気候モデルは、区別を明示してつなぎます。'],
 share:['Save, share & inspect','保存・共有・詳しい数値'],export:['Settings → JSON','設定 → JSON'],apply:['Apply JSON','JSONを適用'],shareLink:['Create share link','共有リンクを作る'],csv:['Export metrics CSV','指標CSVを書き出す'],saved:['Settings prepared below.','下に設定を用意しました。'],linkReady:['Link prepared below; copy it to share.','下にリンクを用意しました。コピーして共有できます。'],
 table:['All measured conditions','全条件の数値'],empty:['Run a sweep to populate these views.','走査すると結果を表示します。'],
 sources:['Science & boundaries','科学的な根拠と範囲'],sourceNote:['Season averages are weighted by Kepler elapsed time. Energy and time-mean intensity are different quantities. No real orbital timeline, elevation correction or new climate feedback is inferred.','季節平均はKepler軌道の経過時間で重み付けします。積算エネルギーと時間平均の強さは別の指標です。実際の軌道年代史・標高補正・新たな気候feedbackは含みません。'],
} as const;
export type TextKey=keyof typeof TEXT;
export const tr=(key:TextKey):string=>TEXT[key][getLanguage()==='ja'?1:0];
export function translate():void {
 document.documentElement.lang=getLanguage(); document.title=tr('lead')+' · Earth Lab';
 document.querySelectorAll<HTMLElement>('[data-sy]').forEach(el=>{el.textContent=tr(el.dataset.sy as TextKey);});
}
