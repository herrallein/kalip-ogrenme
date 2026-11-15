# Sahne kataloğu (görsel aracı)

Kullanım: `node compose.mjs scenes/*.json` → `public/visuals/<id>.svg` + `public/visuals/meta.json` ({id:{cue,alt}}).
Tuval 320×200 piksel (x sağa, y aşağı). Bir sahne = küçük bir JSON. Bilinmeyen ad olursa program hatayı ve geçerli adları yazar.

## Alanlar

| alan | zorunlu | açıklama |
|---|---|---|
| `id` | evet | desen kimliği (`a1-ich-heisse`), yalnız a-z 0-9 - |
| `alt` | evet | kısa Türkçe görsel betimlemesi (ekran okuyucu) |
| `cue` | evet | uygulamada görselin altında gösterilen Türkçe ipucu |
| `bg` | evet | arka plan (aşağıda); `plain` için `bgColor` (#hex) |
| `keyword` | önerilir | büyük tek Almanca sözcük/kısa kalıp (yüzlere çarpmayacak köşeyi program seçer; `keywordPos`: `top`,`top-left`,`top-right`,`bottom`,`bottom-left`,`bottom-right`,`left`,`right`,`center` veya [x,y]) |
| `people` | hayır | 0–3 kişi |
| `objects` | hayır | emoji nesneleri |
| `props` | hayır | çizilmiş sahne eşyaları |
| `bubble` | hayır | tek düşünce/konuşma balonu |
| `arrow` | hayır | tek ok |
| `accent` | hayır | anahtar kelime rengi (#hex veya renk adı) |

### people[i]
`{"pose":"RestingBW","face":"Smile","hair":"Short","accessory":"GlassRound","facialHair":"Goatee","x":90,"y":180,"scale":1,"flip":false,"skin":"medium","shirt":"orange","dark":"navy"}`
- `pose` zorunlu (adlar benzersiz; `bust:Shirt` gibi önek de olur). `face` (varsayılan Calm), `hair` (Short) isteğe bağlı; `accessory`, `facialHair` isteğe bağlı.
- `x` = baş merkezi (px; boşsa kişiler eşit aralıkla dizilir), `y` = ayak çizgisi (varsayılan: arka planın zemini; **bust** pozlar altta kadraja taşar, y vermeyin). `scale` 1 = ayakta ≈130 px boy, oturan ≈80–110 px, bust ≈115 px (baş 45 px, yüz ayrıntısı en net bu). `flip`: true = sola bakar/yansıtır.
- `skin`: light | medium | brown | dark veya #hex (baş+boyun+tüm silüet). `shirt`: kıyafet rengi (#hex veya red orange yellow green teal blue purple white gray navy black brown pink). **Önemli:** pozun siyah olmayan bölgesi tek renktir; `shirt` verilirse eller/kollar da o renk olur (verilmezse hepsi ten rengi). `dark`: pozun siyah bölgelerinin (pantolon, siyah gömlek) rengi, varsayılan koyu mürekkep; koyu tonlar seç (kontur da bu renkte).
- Pozlarda **BW/WB** son ekleri aynı pozun siyah/açık kıyafet tersleridir (BW: üst koyu, pantolon açık veya tersi). İkisini de deneyin; fark yalnız hangi parçanın koyu olduğudur.
- Boyut: kişi başı ≈ 6–11 KB. Hedef ≤30 KB için 3 tam boy kişi sığmaz; 2 kişi veya 3 bust kullan (program 30 KB üstünde uyarı verir).

### objects[i]
`{"emoji":"☕","x":230,"y":120,"size":40,"rot":0,"layer":"back"}` — x,y merkez, size px (24–60 iyi), rot derece. `layer`:"back" = kişilerin arkasında (varsayılan önünde). Kadraja taşarsa uyarı verir.

### props[i]
`{"type":"table","x":230,"y":172,"scale":1.1,"color":"brown"}` — türler: table, chair, door, bed, sofa, tree, bench, lamp, clock, box, plant, sun, moon, cloud, window. table, chair, door, bed, sofa, tree, bench, lamp, box, plant: x,y = alt-orta (zemin); sun, moon, cloud, clock, window: merkez.

### bubble
`{"type":"thought"|"speech","from":0,"emoji":["☕","🥐"]}` veya `{"type":"speech","from":0,"word":"Anna"}` (1–3 emoji ya da kısa sözcük; ikisi birlikte de olur). `from` = kişi indeksi. Program balonu başın üstüne, yer yoksa yanına koyar; elle: `"side":"above|left|right"` ya da `"x":..,"y":..` (merkez).

### arrow
`{"from":[x,y],"to":[x,y],"bend":28,"style":"dotted"|"solid","marker":null|"rewind"|"timeline","color":"#hex"}`
Eğri noktalı ok (hareket, yön, neden→sonuç). `bend` ± = kavis yönü. `marker`:"rewind" = ortada ⏪ simgesi (geçmiş/öncesi), "timeline" = düz zaman çizgisi (başlangıçta boş nokta, ucunda ok; geçmiş→şimdi).

## Arka planlar (`bg`) ve varsayılan zemin (ayak y)

| ad | zemin y | açıklama |
|---|---|---|
| `home` | 180 | oturma odası: pencere+perde, kanepe, lamba, tablolar, ahşap zemin |
| `kitchen` | 182 | mutfak: fayans duvar, dolaplar, tezgâh, ocak, pencere |
| `cafe` | 184 | kafe: tebeşir menü, sarkıt lambalar, tezgâh + espresso makinesi, dama zemin |
| `shop` | 184 | dükkân: raflarda renkli kutular, kırmızı tente, kasa tezgâhı |
| `street` | 168 | sokak: renkli binalar, kaldırım, yol, lamba, ağaç, güneş |
| `park` | 176 | park: gökyüzü, tepeler, ağaçlar, bank, çiçekler, patika |
| `office` | 182 | ofis: pencere siluet, raflar, masa + monitör, saat, bitki |
| `classroom` | 182 | sınıf: yeşil tahta, saat, kırmızı/mavi afişler, sıralar |
| `station` | 180 | istasyon: kırmızı tren, varış tabelası, sarı çizgi, peron |
| `doctor` | 182 | doktor odası: yeşil haç, göz tablosu, ilaç dolabı, muayene yatağı |
| `sky` | 178 | açık gökyüzü: güneş, bulutlar, alt bulut zemini (soyut/serbest) |
| `stage` | 182 | sahne: bordo perde, spot ışıklar, ahşap sahne |
| `meeting` | 182 | toplantı odası: beyaz tahta grafik, pencere, uzun masa |
| `night` | 178 | gece: koyu lacivert, ay, yıldızlar, evler, sokak lambası |
| `plain` | 180 | düz renk ("bgColor" ile), yumuşak yer gölgesi |

Gece (`night`) koyu zemin: anahtar kelime otomatik uyumlu renk alır. Ağaç/kanepe gibi eşyalar bg içinde zaten var; `props` ile fazladan eklenir.

## Geçerli adlar

**pose – ayakta (standing):** BlazerBW, BlazerPantsBW, BlazerPantsWB, BlazerWB, CrossedArmsBW, CrossedArmsWB, EasingBW, EasingWB, PointingFingerBW, PointingFingerWB, PolkaDots, RestingBW, RestingWB, RoboDanceBW, RoboDanceOutline, RoboDanceWB, ShirtBW, ShirtPantsBW, ShirtPantsWB, ShirtWB, WalkingBW, WalkingFilled, WalkingWB, Doc, DocProtectiveClothe, DocStethoscope

**pose – oturan (sitting):** Bike, ClosedLegBW, ClosedLegWB, CrossedLegs, HandsBackBW, HandsBackWB, MediumBW, MediumWB, OneLegUpBW, OneLegUpWB, WheelChair

**pose – büst (bust, bel üstü):** BlazerBlackTee, Shirt, ButtonShirt, Dress, Gaming, Geek, Hoodie, PointingUp, Selena, Thunder, Turtleneck, ArmsCrossed, Coffee, Device, DotJacket, Explaining, FurJacket, Killer, Paper, PocketShirt, PoloSweater, ShirtCoat, ShirtFilled, SportyShirt, StripedShirt, Sweater, SweaterDots, Whatever

**face:** Angry, Blank, Calm, Cheeky, Concerned, Contempt, Cute, Driven, EatingHappy, EyesClosed, OldAged, Serious, Smile, Solemn, Suspicious, Tired, VeryAngry, Awe, ConcernedFear, Cyclops, Explaining, Fear, Hectic, LoveGrin, LoveGrinTeeth, Monster, Rage, SmileBig, SmileLol, SmileTeeth, CalmNM, SmileNM, CheersNM

**hair:** Afro, Bald, BaldSides, BaldTop, Bangs, BangsFilled, Bear, Bun, BunCurly, Buns, FlatTop, FlatTopLong, HatHip, Long, LongAfro, LongBangs, LongCurly, Medium, MediumBangs, MediumBangsFilled, MediumLong, MediumShort, MediumStraight, Mohawk, MohawkDino, Pomp, ShavedRight, ShavedSides, ShavedWavy, Short, ShortCurly, ShortMessy, ShortScratch, ShortVolumed, ShortWavy, BantuKnots, Beanie, BunFancy, CornRows, CornRowsFilled, GrayBun, GrayMedium, GrayShort, Hijab, MediumShade, Turban, Twists, TwistsVolumed, DocBouffant, DocSurgery, DocShield

**accessory:** Eyepatch, GlassRoundThick, SunglassClubmaster, SunglassWayfarer, GlassAviator, GlassButterfly, GlassButterflyOutline, GlassClubmaster, GlassRound

**facialHair:** Chin, Full, FullMajestic, FullMedium, Goatee, GoateeCircle, Dali, Handlebars, Imperial, Painters, PaintersFilled, Swashbuckler, MoustacheThin, Yosemite, GrayFull, MajesticHandlebars

İpuçları: ifade seç: sevinç SmileBig/SmileLol/LoveGrin, şaşkınlık Awe/Fear, düşünme Calm/Suspicious/Concerned, yorgun Tired, kızgın Angry/Rage, yemek EatingHappy, konuşma Explaining. "NM" son ekli yüzler ağızsız (balon/yemek vb. için). Bust: PointingUp (parmak yukarı), Coffee (kahve fincanı), Device/Gaming (telefon/oyun), Paper (kâğıt), Explaining (anlatan el). Ayakta: PointingFinger* (gösterir), Walking* (yürür), CrossedArms* (kollar kavuşuk), Doc* (doktor). Oturan: WheelChair, Bike (bisiklet).

## Emoji kuralları (Twemoji v17, CC-BY 4.0)
- Her emoji tek bir dizge (bayrak 🇹🇷, 👨‍🍳 gibi ZWJ dizileri de tek dizge). İlk kullanımda ağdan indirilir ve `twemoji/` önbelleğine yazılır; olmayan emoji hata verir.
- Yaygın, sade emoji seç (yiyecek, eşya, hava, ulaşım, bayrak, yüz). Çok yeni (Unicode 15+) ve ten tonlu/aile emojilerinden kaçın.
- Nesne ≈ 24–60 px; bir sahnede ≤ 6 farklı emoji (her biri 0,5–1,7 KB). Aynı emoji birden çok kullanılırsa tek kez saklanır.
- Emoji kişilerin yüzünü ve anahtar kelimeyi örtmesin; kelimeyi yazıyla değil resimle anlat.
- Lisans: Twemoji (c) Twitter/jdecked CC-BY 4.0 ve Open Peeps (c) Pablo Stanley CC0; SVG içinde kısa atıf yorumu bulunur, uygulamanın hakkında sayfasına da yazılmalı.

## Tasarım kuralları
- Bir görsel = tek fikir: tek anahtar kelime + bir eylem/nesne/duygu. Çok kalabalık yapma.
- Soyut kavramlar için: ok (neden→sonuç, yön), `rewind`/`timeline` (zaman), balon (söz/düşünce), küçük emoji ikonları.
- Parmak izi gibi ince şeyler 22 px altında okunmaz; emoji ≥ 26 px.
- Yazı için yalnız `keyword` ve balonda 1 kısa sözcük kullan; başka metin yok.

## Örnek 1 – düşünce balonu + kişi (a1-ich-moechte)
```json
{"id":"a1-ich-moechte","bg":"cafe","keyword":"möchte",
 "alt":"Kafede duran kişinin düşünce balonunda kahve ve kruvasan",
 "people":[{"pose":"RestingBW","face":"Smile","hair":"ShortCurly","x":82,"skin":"medium","dark":"navy"}],
 "bubble":{"type":"thought","from":0,"emoji":["☕","🥐"]},
 "cue":"Tezgâhta kafandaki kahve bulutu 'möchte' diyor; istediğin şey (mastar) en sona gider: Ich möchte … trinken."}
```

## Örnek 2 – hareket oku + bayrak + eşya (a1-ich-komme-aus)
```json
{"id":"a1-ich-komme-aus","bg":"park","keyword":"aus",
 "alt":"Türk bayrağından valizle yola çıkıp gelen gülümseyen kişi",
 "people":[{"pose":"WalkingBW","face":"Smile","hair":"Bun","x":246,"skin":"brown","dark":"navy","flip":true}],
 "objects":[{"emoji":"🇹🇷","x":64,"y":66,"size":60},{"emoji":"🧳","x":196,"y":150,"size":34}],
 "arrow":{"from":[104,70],"to":[196,86],"bend":-28},
 "cue":"Bayrak memleketin, ok seni oradan valizinle getiriyor; 'aus' = -den: Ich komme AUS der Türkei."}
```

## Örnek 3 – geri sarma oku + prop (a2-ich-habe-partizip)
```json
{"id":"a2-ich-habe-partizip","bg":"kitchen","keyword":"habe",
 "alt":"Pizzayı bitirmiş, karnı tok kişi; masada boş tabak, pizzadan tabağa doğru geri saran ok",
 "people":[{"pose":"ShirtPantsWB","face":"EatingHappy","hair":"Medium","x":84,"skin":"light","shirt":"purple","scale":1.1}],
 "props":[{"type":"table","x":236,"y":176,"scale":1.15}],
 "objects":[{"emoji":"🍽️","x":236,"y":116,"size":42},{"emoji":"🍕","x":166,"y":98,"size":34,"rot":-15}],
 "arrow":{"from":[226,92],"to":[188,96],"bend":-16,"marker":"rewind"},
 "cue":"Boş tabak, dolu mide: dün pizzayı yedin. 'habe' hazır, 'gegessen' en sonda: Ich habe gestern gegessen."}
```
