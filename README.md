# ISO 8583 Parser (BKM TechPOS)

Tek dosyalık (bağımlılıksız) bir web sayfası: **ISO 8583 / BKM TechPOS** mesajlarını hex girdiden ayrıştırıp alanları, EMV ve özel TLV alanlarını okunur biçimde gösterir.

## Kullanım

`index.html` dosyasını bir tarayıcıda aç. Mesajı (hex) kutuya yapıştırıp **Ayrıştır**'a bas. Açılışta bir örnek mesaj otomatik yüklenir.

## Özellikler

- **MTI + bitmap** çözümü, F1–F128 alan tanımları, BKM MTI/processing/cevap kodu açıklamaları
- **Kodlama:** sayısal alanlar BCD, alfanümerik ASCII, Track 2 (F35) BCD-packed, LLVAR/LLLVAR
- **EMV (F55/F56):** BER-TLV (çok-baytlı tag, nested template'ler), ~150 tag sözlüğü
- **Özel TLV (F48/F62/F63):** 1-bayt tag + 2-bayt uzunluk; CP1254 (Türkçe) metin çözümü; alan bazlı tag isim sözlükleri
- **Mesaj başlığı (header)** otomatik algılama (Len/HostID/SubHeader/EncInd/Vendor/GİB SeriNo/MType/PCode); şifreli gövde uyarısı
- **CRC-32** hesaplama ve doğrulama (mesaj bütünlüğü)
- **İşlem özeti:** acquirer banka (F32/F43 → BKM banka listesi), kart markası (AID/BIN), kart tipi/domain
- **Ayrıştırma durumu göstergesi:** ✓ tam / ⚠ uyarı / ✗ ayrıştırılamadı
- F43 cihaz bilgisi ve F63 terminal yetenek bitlerinin açılması

> Referans: BKM TechPOS Vendor Mesaj Spesifikasyonu V3.2.2
