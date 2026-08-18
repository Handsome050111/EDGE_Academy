const fs = require('fs');
const path = require('path');
const assert = require('assert');

const enPath = path.join(__dirname, '../../client/src/locales/en.json');
const dePath = path.join(__dirname, '../../client/src/locales/de.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const de = JSON.parse(fs.readFileSync(dePath, 'utf8'));

const getKeys = (obj, prefix = '') => {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
};

const enKeys = getKeys(en);
const deKeys = getKeys(de);

console.log(`Total EN keys: ${enKeys.length}`);
console.log(`Total DE keys: ${deKeys.length}`);

const missingInDe = enKeys.filter((k) => !deKeys.includes(k));
const missingInEn = deKeys.filter((k) => !enKeys.includes(k));

if (missingInDe.length > 0) {
  console.error('❌ Keys missing in German (de.json):', missingInDe);
}
if (missingInEn.length > 0) {
  console.error('❌ Keys missing in English (en.json):', missingInEn);
}

assert.strictEqual(missingInDe.length, 0, 'No keys should be missing in German');
assert.strictEqual(missingInEn.length, 0, 'No keys should be missing in English');

console.log('✓ 100% i18n Translation Key Parity verified between EN and DE!');
