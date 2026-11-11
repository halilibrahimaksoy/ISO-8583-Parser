# ISO 8583 Parser (BKM TechPOS)

Tek dosyalık (bağımlılıksız) bir web sayfası: **ISO 8583 / BKM TechPOS** mesajlarını hex girdiden ayrıştırıp alanları, EMV ve özel TLV alanlarını okunur biçimde gösterir.

## Kullanım

`index.html` dosyasını bir tarayıcıda aç. Açık mesaj için **Decrypted (Açık)** seçiliyken mesajı (hex) kutuya yapıştırıp **Ayrıştır**'a bas. Açılışta kutu boştur; **Örnek Yükle** ile örnek mesajı ayrıştırabilirsin.

Şifreli mesaj için **Encrypted (Şifreli)** seçeneğini seç, şifreli mesajı / gövdeyi hex olarak yapıştır ve **64 hex karakterlik (32 bayt) AES anahtarını** gir. **Şifreyi Çöz ve Ayrıştır**, gövdeyi **AES-256-CBC**, **IV = 00000000000000000000000000000000** ve **PKCS#7 padding** ile çözüp ISO alanlarını ayrıştırır. PKCS#7 dolgu uzunluğunu doğrulayarak kaldırır; örneğin 10 dolgu baytı varsa sondaki on adet `0A` kaldırılır. Anahtar bir parola değil, doğrudan hex kodlanmış AES anahtarıdır; boşluklar ve baştaki `0x` kabul edilir.

BKM başlığı algılanırsa yalnızca başlıktan sonraki gövde çözülür; başlık ayrıca gösterilir. Şifreli gövde 16 baytın katı olmalı ve çözüldüğünde ikili ISO mesajını içermelidir. Çözülen gövdenin hex hali sonuçlarda açılabilir. **Temizle** mesajı, anahtarı ve sonuçları siler; **Örnek Yükle** açık mesaj moduna döner.

Şifre çözme tarayıcının Web Crypto API'sinde yerel olarak yapılır; anahtar kaydedilmez veya bir sunucuya gönderilmez. Güncel bir tarayıcıda yerel dosya, HTTPS ya da localhost üzerinden kullanılabilir.

## Özellikler

- **MTI + bitmap** çözümü, F1–F128 alan tanımları, BKM MTI/processing/cevap kodu açıklamaları
- **Kodlama:** sayısal alanlar BCD, alfanümerik ASCII, Track 2 (F35) BCD-packed, LLVAR/LLLVAR
- **EMV (F55/F56):** BER-TLV (çok-baytlı tag, nested template'ler), ~150 tag sözlüğü
- **Özel TLV (F48/F62/F63):** 1-bayt tag + 2-bayt uzunluk; CP1254 (Türkçe) metin çözümü; alan bazlı tag isim sözlükleri
- **Mesaj başlığı (header)** otomatik algılama (Len/HostID/SubHeader/EncInd/Vendor/GİB SeriNo/MType/PCode); şifreli gövde için AES-256-CBC çözme ve ayrıştırma
- **CRC-32** hesaplama ve doğrulama (mesaj bütünlüğü)
- **İşlem özeti:** acquirer banka (F32/F43 → BKM banka listesi), kart markası (AID/BIN), kart tipi/domain
- **Ayrıştırma durumu göstergesi:** ✓ tam / ⚠ uyarı / ✗ ayrıştırılamadı
- F43 cihaz bilgisi ve F63 terminal yetenek bitlerinin açılması

> Referans: BKM TechPOS Vendor Mesaj Spesifikasyonu V3.2.2

## Doğrulama

Node.js 18+ ile bağımlılık kurmadan: `node --test tests/parser.test.cjs`
