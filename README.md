# Pax Historia

> **© 2025–2026 Ouysam — Tüm Hakları Saklıdır.**
>
> Bu proje **[CC BY-NC-ND 4.0](LICENSE)** lisansı altındadır.
> Ticari kullanım, yeniden satış ve türev ürün dağıtımı **kesinlikle yasaktır**.
> Ticari lisans için iletişime geçin.

---

Pax Historia, alternatif tarih senaryoları ve yapay zeka ile şekillenen dinamik bir büyük strateji (grand strategy) oyunudur. Oyuncu, tarihin akışını değiştirmek için kararlar alır, orduları hareket ettirir, diplomatik müzakereler yürütür ve ülkesini yönetir. Oyun dünyası, oyuncunun kararlarına ve küresel olaylara göre dinamik olarak tepki verir.

---

## ✨ Öne Çıkan Özellikler

- **Dinamik Dünya Haritası:** Sınırların, bölgelerin ve egemenliklerin turlara ve olaylara bağlı olarak dinamik şekilde değiştiği interaktif vektörel harita.
- **Yapay Zeka Destekli Olaylar (Deterministic Core):** Altyapı, ekonomik kriz, siyaset, istihbarat, denizcilik ve teknoloji gibi 12'den fazla arketip içeren deterministik olay simülasyonu. "Siyah Kuğu" (Black Swan) olaylarıyla beklenmedik küresel krizler veya büyük atılımlar.
- **Danışman Kişilikleri (Advisor Stances):** Şahin (agresif askeri), Güvercin (barışçıl diplomatik) ve Tilki (pragmatik fırsatçı) kişilikleri arasında geçiş yaparak stratejinize göre özelleştirilmiş yapay zeka tavsiyeleri alabilme.
- **Doğal Dil ile Diplomasi:** Diğer ülkelerin liderleriyle doğrudan doğal dilde yazışarak ittifaklar kurma, ticaret anlaşmaları imzalama veya ültimatom verme.
- **Bütçe ve Kaynak Yönetimi:** Sahip olunan bölgeler ve sanayi tesislerine göre tur başına bütçe hesabı, askeri ve diplomatik aksiyonların maliyet yönetimi.
- **Tension Heatmap (Gerilim Isı Haritası):** Dünyadaki gerilimleri yeşilden kırmızıya değişen dinamik bir ısı haritası üzerinden izleme seçeneği.
- **Ses ve Atmosfer:** Web Audio API ile sentezlenen tur geçiş tik takları, olay zilleri ve aksiyon onay sesleri.

---

## 🛠 Kurulum ve Çalıştırma

### Gereksinimler

- Node.js

### Kurulum Adımları

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

2. Projeyi derleyin:
   ```bash
   npm run build
   ```

3. Sunucuyu başlatın:
   ```bash
   node server/server.js
   ```

4. Tarayıcınızda **http://localhost:3000** adresini açarak oynamaya başlayın.

---

## 🧭 Oyun Mekanikleri ve Akışı

1. **Aksiyon Planlama:** Tur başında sahip olduğunuz bütçeyi aşmadan askeri konuşlandırmalar yapın, sanayi bölgeleri açın veya diplomatik adımlar planlayın.
2. **Diplomatik Görüşmeler:** Danışmanınızdan tavsiyeler alarak ve rakip liderlerle doğrudan sohbet ederek pozisyonunuzu güçlendirin.
3. **Zaman Atlama:** Zamanı ileri sardığınızda (1 hafta, 1 ay veya daha uzun süreler), simülasyon motoru kararlarınızı ve dünyanın durumunu işleyerek yeni olay zincirleri oluşturur.
4. **Harita Güncellemeleri:** Olayların gerçekleştiği bölgelerde harita üzerinde pulse animasyonları tetiklenir, yeni tesisler veya ordular harita üzerinde görsel işaretlerle belirir.
