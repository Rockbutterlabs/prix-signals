const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l && !l.trim().startsWith('#'));
const example = fs.readFileSync('.env.example', 'utf-8').split('\n').filter(l => l && !l.trim().startsWith('#'));

const envKeys = env.map(l => l.split('=')[0]);
const exampleKeys = example.map(l => l.split('=')[0]);

const missing = exampleKeys.filter(k => !envKeys.includes(k));
const extra = envKeys.filter(k => !exampleKeys.includes(k));

if (missing.length) console.log('❌ Missing in .env:', missing);
if (extra.length) console.log('⚠️ Extra in .env:', extra);
if (!missing.length && !extra.length) console.log('✅ .env matches .env.example!'); 