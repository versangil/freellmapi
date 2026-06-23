const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('D:\\AiTools\\freellmapi\\server\\data\\freeapi.db');

const KEYLEN = 64;

// Must match server/src/lib/password.ts EXACTLY
function hashPassword(password) {
  const salt = crypto.randomBytes(16); // Buffer, not string!
  const hash = crypto.scryptSync(password, salt, KEYLEN);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}

function verifyPassword(password, stored) {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  let actual;
  try { actual = crypto.scryptSync(password, salt, expected.length); } catch { return false; }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const newPassword = 'admin1234';
const newHash = hashPassword(newPassword);

db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(newHash, 'verssangil@gmail.com');
console.log('Updated password hash for verssangil@gmail.com');
console.log('Verify with server format:', verifyPassword(newPassword, newHash));

// Test login via API
const http = require('http');
const data = JSON.stringify({ email: 'verssangil@gmail.com', password: newPassword });
const req = http.request({ hostname: '127.0.0.1', port: 3001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Login API status:', res.statusCode);
    console.log('Login API body:', body);
    db.close();
  });
});
req.write(data);
req.end();
