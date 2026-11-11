const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const { createCipheriv, webcrypto } = require("node:crypto");

const html = readFileSync(join(__dirname, "../index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const KEY = "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F";
// 22-byte ISO body: F3=000000, F4=000000001234, F11=000001.
// PKCS#7 adds exactly ten 0A bytes.
const ISO = "02003020000000000000000000000000001234000001";
const CIPHER = "F85C7B3EAC870C67EB3946B3292017085A424C59CBF490CE63A9653028EAAFD4";

function setup(crypto = webcrypto) {
  const elements = {};
  for (const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const attrs = match[2];
    elements[match[3]] = {
      value: attrs.match(/\bvalue="([^"]*)"/)?.[1] || "",
      checked: /\bchecked\b/.test(attrs),
      hidden: /\bhidden\b/.test(attrs),
      disabled: /\bdisabled\b/.test(attrs),
      innerHTML: "",
      textContent: "",
      listeners: {},
      addEventListener(type, listener) { this.listeners[type] = listener; },
      dispatch(type) { this.listeners[type]?.(); }
    };
  }
  const context = vm.createContext({
    crypto,
    Uint8Array,
    document: {
      getElementById(id) {
        assert.ok(elements[id], "Missing element: " + id);
        return elements[id];
      }
    }
  });
  vm.runInContext(script, context);
  return { context, elements };
}

function encrypted(app, input = CIPHER, key = KEY) {
  app.elements.modeClear.checked = false;
  app.elements.modeEncrypted.checked = true;
  app.elements.modeEncrypted.dispatch("change");
  app.elements.input.value = input;
  app.elements.aesKey.value = key;
}

function encrypt(plain, padding = true) {
  const cipher = createCipheriv("aes-256-cbc", Buffer.from(KEY, "hex"), Buffer.alloc(16));
  cipher.setAutoPadding(padding);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("hex").toUpperCase();
}

function header(body, enc = 1) {
  const sub = (enc ? "01" : "00") + "01" +
    Buffer.from("TEST00000001").toString("hex") + "00000000" + "0200" + "000000";
  return ((2 + sub.length / 2 + body.length / 2).toString(16).padStart(4, "0") +
    "01" + (sub.length / 2).toString(16).padStart(2, "0") + sub + body).toUpperCase();
}

test("fixed AES-256-CBC vector removes ten 0A padding bytes and parses ISO fields", async () => {
  const app = setup();
  assert.equal(await app.context.decryptISOBody(CIPHER, KEY), ISO);
  encrypted(app);
  const promise = app.context.run();
  assert.equal(app.elements.parseButton.disabled, true);
  await promise;
  const output = app.elements.out.innerHTML;
  assert.match(output, /Mesaj tamamen ayrıştırıldı/);
  assert.match(output, /0200/);
  assert.match(output, /F3/);
  assert.match(output, /F4/);
  assert.match(output, /F11/);
  assert.match(output, /Tutar: 12\.34/);
  assert.ok(output.includes(ISO));
  assert.ok(!output.includes(KEY));
  assert.equal(app.elements.input.value, CIPHER);
  assert.equal(app.elements.parseButton.disabled, false);
});

test("all PKCS#7 lengths including a full block preserve binary data", async () => {
  const { context } = setup();
  for (let padding = 1; padding <= 16; padding++) {
    const plain = Buffer.alloc(48 - padding, 0x80);
    plain[plain.length - 3] = 0x0A;
    plain[plain.length - 2] = 0x00;
    plain[plain.length - 1] = 0xFF;
    assert.equal(await context.decryptISOBody(encrypt(plain), KEY),
      plain.toString("hex").toUpperCase(), "padding=" + padding);
  }
});

test("real trailing 0A and zero bytes are preserved", async () => {
  const { context } = setup();
  for (const suffix of ["0A0A", "0000"]) {
    const hex = ISO + suffix;
    assert.equal(await context.decryptISOBody(encrypt(Buffer.from(hex, "hex")), KEY), hex);
  }
});

test("encrypted BKM header stays readable while only its body is decrypted", async () => {
  const app = setup();
  encrypted(app, header(CIPHER));
  await app.context.run();
  assert.match(app.elements.out.innerHTML, /BKM Mesaj Başlığı/);
  assert.match(app.elements.out.innerHTML, /TEST00000001/);
  assert.match(app.elements.out.innerHTML, /Mesaj tamamen ayrıştırıldı/);
  assert.match(app.elements.out.innerHTML, /Tutar: 12\.34/);
  assert.doesNotMatch(app.elements.out.innerHTML, /3DES/);
});

test("encrypted body with CRC retains the CRC and validates it after decryption", async () => {
  const app = setup();
  const crc = app.context.crc32([...Buffer.from(ISO, "hex")]);
  encrypted(app, encrypt(Buffer.from(ISO + crc, "hex")));
  await app.context.run();
  assert.match(app.elements.out.innerHTML, /CRC EŞLEŞTİ/);
});

test("clear body, clear header, and sample still parse without a key or Web Crypto", async () => {
  const app = setup(null);
  assert.equal(app.elements.modeClear.checked, true);
  assert.equal(app.elements.cryptoPanel.hidden, true);
  assert.equal(app.elements.cryptoPanel.disabled, true);
  for (const input of [ISO, header(ISO, 0)]) {
    app.elements.input.value = input;
    await app.context.run();
    assert.match(app.elements.out.innerHTML, /Mesaj tamamen ayrıştırıldı/);
  }
  await app.context.loadSample();
  assert.equal(app.elements.input.value, vm.runInContext("SAMPLE", app.context));
  assert.match(app.elements.out.innerHTML, /0120/);
});

test("encrypted header in clear mode asks for a key instead of parsing ciphertext", async () => {
  const app = setup();
  app.elements.input.value = header(CIPHER);
  await app.context.run();
  assert.match(app.elements.out.innerHTML, /Encrypted \(Şifreli\)/);
  assert.match(app.elements.out.innerHTML, /BKM Mesaj Başlığı/);
  assert.doesNotMatch(app.elements.out.innerHTML, /Mesaj tamamen ayrıştırıldı/);
});

test("hex accepts whitespace, lowercase and a leading 0x", async () => {
  const { context } = setup();
  const spacedKey = " 0x" + KEY.toLowerCase().match(/../g).join(" \n") + " ";
  assert.equal(await context.decryptISOBody("0x" + CIPHER.toLowerCase(), spacedKey), ISO);
});

test("invalid key and ciphertext formats fail clearly without leaking the key", async () => {
  const cases = [
    [CIPHER, "", /AES anahtarı girilmedi/],
    [CIPHER, "00".repeat(16), /32 bayt/],
    [CIPHER, "00".repeat(33), /32 bayt/],
    [CIPHER, KEY.slice(1), /çift sayıda/],
    [CIPHER, "G" + KEY.slice(1), /yalnızca hex/],
    ["", KEY, /Lütfen bir ISO/],
    [CIPHER.slice(1), KEY, /çift sayıda/],
    [CIPHER.slice(2), KEY, /16 baytın katı/],
    ["GG" + CIPHER.slice(2), KEY, /yalnızca hex/]
  ];
  for (const [input, key, expected] of cases) {
    const app = setup();
    encrypted(app, input, key);
    await app.context.run();
    assert.match(app.elements.out.innerHTML, expected);
    assert.doesNotMatch(app.elements.out.innerHTML, /Mesaj tamamen ayrıştırıldı/);
    if (key) assert.ok(!app.elements.out.innerHTML.includes(key));
    assert.equal(app.elements.parseButton.disabled, false);
  }
});

test("wrong key and malformed PKCS#7 padding fail before parsing", async () => {
  const app = setup();
  await assert.rejects(app.context.decryptISOBody(CIPHER, "FF".repeat(32)), /şifre çözülemedi/);
  // Correct final pad count (0A), but one of the ten padding bytes is wrong.
  const invalidPad = Buffer.concat([Buffer.from(ISO, "hex"), Buffer.alloc(10, 0x0A)]);
  invalidPad[invalidPad.length - 2] = 0x09;
  encrypted(app, encrypt(invalidPad, false));
  await app.context.run();
  assert.match(app.elements.out.innerHTML, /şifre çözülemedi/);
  assert.doesNotMatch(app.elements.out.innerHTML, /Mesaj tamamen ayrıştırıldı/);
  const zeroPad = Buffer.concat([Buffer.from(ISO, "hex"), Buffer.alloc(10)]);
  await assert.rejects(app.context.decryptISOBody(encrypt(zeroPad, false), KEY), /şifre çözülemedi/);
});

test("decrypted non-ISO data is rejected", async () => {
  for (const plain of [Buffer.alloc(0), Buffer.from("short"), Buffer.alloc(32, 0xFF)]) {
    const app = setup();
    encrypted(app, encrypt(plain));
    await app.context.run();
    assert.match(app.elements.out.innerHTML, /geçerli bir ISO 8583/);
    assert.doesNotMatch(app.elements.out.innerHTML, /Mesaj tamamen ayrıştırıldı/);
  }
});

test("unavailable Web Crypto gives a useful error and retains the header", async () => {
  const app = setup(null);
  encrypted(app, header(CIPHER));
  await app.context.run();
  assert.match(app.elements.out.innerHTML, /Web Crypto kullanılamıyor/);
  assert.match(app.elements.out.innerHTML, /BKM Mesaj Başlığı/);
});

test("mode toggle, clear and sample remove keys and stale results", async () => {
  const app = setup();
  encrypted(app);
  assert.equal(app.elements.cryptoPanel.hidden, false);
  assert.equal(app.elements.cryptoPanel.disabled, false);
  await app.context.run();
  app.context.clearMessage();
  assert.equal(app.elements.input.value, "");
  assert.equal(app.elements.aesKey.value, "");
  assert.equal(app.elements.out.innerHTML, "");

  encrypted(app);
  app.elements.modeEncrypted.checked = false;
  app.elements.modeClear.checked = true;
  app.elements.modeClear.dispatch("change");
  assert.equal(app.elements.cryptoPanel.hidden, true);
  assert.equal(app.elements.cryptoPanel.disabled, true);
  assert.equal(app.elements.aesKey.value, "");

  encrypted(app);
  await app.context.loadSample();
  assert.equal(app.elements.modeClear.checked, true);
  assert.equal(app.elements.modeEncrypted.checked, false);
  assert.equal(app.elements.cryptoPanel.hidden, true);
  assert.equal(app.elements.aesKey.value, "");
  assert.match(app.elements.out.innerHTML, /0120/);
});

test("editing input, key, or bitmap option clears results", async () => {
  for (const [id, event] of [["input", "input"], ["aesKey", "input"], ["secbit", "change"]]) {
    const app = setup();
    encrypted(app);
    await app.context.run();
    app.elements[id].dispatch(event);
    assert.equal(app.elements.out.innerHTML, "");
  }
});

function delayedCrypto() {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  return {
    release,
    crypto: { subtle: {
      importKey: (...args) => webcrypto.subtle.importKey(...args),
      decrypt: async (...args) => { await gate; return webcrypto.subtle.decrypt(...args); }
    } }
  };
}

test("clearing or editing during decryption prevents stale decrypted output", async () => {
  for (const action of ["clear", "edit", "sample"]) {
    const delayed = delayedCrypto();
    const app = setup(delayed.crypto);
    encrypted(app);
    const pending = app.context.run();
    if (action === "clear") app.context.clearMessage();
    if (action === "edit") app.elements.input.dispatch("input");
    if (action === "sample") await app.context.loadSample();
    const expected = app.elements.out.innerHTML;
    delayed.release();
    await pending;
    assert.equal(app.elements.out.innerHTML, expected);
    assert.equal(app.elements.parseButton.disabled, false);
  }
});

test("a new run wins over an earlier pending decryption", async () => {
  const delayed = delayedCrypto();
  const app = setup(delayed.crypto);
  encrypted(app);
  const first = app.context.run();
  app.elements.input.value = "invalid";
  await app.context.run();
  const expected = app.elements.out.innerHTML;
  assert.match(expected, /yalnızca hex/);
  delayed.release();
  await first;
  assert.equal(app.elements.out.innerHTML, expected);
});
