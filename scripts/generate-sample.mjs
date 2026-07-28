// Generates a realistic IEC-format sample CSV (15-min intervals) into public/.
import { writeFileSync } from 'node:fs';

const START = new Date(2024, 0, 1, 0, 0, 0); // 1 Jan 2024
const DAYS = 150;
const STEP_MIN = 15;

function pad(n) { return String(n).padStart(2, '0'); }

const lines = [];
// Hebrew-style metadata header (mirrors the real export so the parser is exercised).
lines.push('" ","  ","  "');
lines.push('"שם לקוח","כתובת","מספר חוזה"');
lines.push('"Sample User","Sample Address","000000000000"');
lines.push('"סוג מונה","קוד מונה","מספר מונה"');
lines.push('"צריכה","503","00000000"');
lines.push('"קוד ומספר מונה","סוג מונה","תאריך","מועד תחילת הפעימה","צריכה/ייצור בקוט""ש","הזרמה בקוט""ש"');

function baseLoad(hour, weekday, month) {
  // Diurnal shape: low at night, morning bump, big evening peak.
  let load = 0.15;
  if (hour >= 6 && hour < 9) load += 0.25;          // morning
  if (hour >= 9 && hour < 17) load += 0.12;         // daytime baseline
  if (hour >= 17 && hour < 23) load += 0.55;        // evening peak
  if (hour >= 23 || hour < 6) load += 0.05;         // night
  // Weekend (Fri=5, Sat=6): more daytime usage at home.
  if ((weekday === 5 || weekday === 6) && hour >= 9 && hour < 17) load += 0.2;
  // Seasonal: summer (Jun–Sep) AC pushes daytime/evening up.
  if (month >= 5 && month <= 8 && hour >= 12 && hour < 24) load += 0.35;
  // Winter (Dec–Feb) heating in evening.
  if ((month === 11 || month <= 1) && hour >= 17 && hour < 23) load += 0.25;
  return load;
}

for (let d = 0; d < DAYS; d++) {
  for (let m = 0; m < 24 * 60; m += STEP_MIN) {
    const t = new Date(START.getTime() + d * 86400000 + m * 60000);
    const hour = t.getHours();
    const weekday = t.getDay();
    const month = t.getMonth();
    const perHour = baseLoad(hour, weekday, month);
    const perInterval = (perHour / (60 / STEP_MIN)) * (0.75 + Math.random() * 0.5);
    const kwh = Math.max(0.02, perInterval).toFixed(3);
    const date = `${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()}`;
    const time = `${pad(hour)}:${pad(t.getMinutes())}`;
    lines.push(`"503-00000000","צריכה","${date}","${time}",${kwh},0`);
  }
}

writeFileSync(new URL('../public/sample-data.csv', import.meta.url), lines.join('\r\n'), 'utf8');
console.log(`Wrote ${lines.length} lines, ${DAYS} days of ${STEP_MIN}-min data.`);
