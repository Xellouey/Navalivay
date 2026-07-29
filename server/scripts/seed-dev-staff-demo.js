// Демо-данные раздела «Сотрудники и зарплаты» для локальной разработки.
// Создаёт трёх сотрудников с известными ПИН и наполняет последние 40 дней
// сменами, действиями и отметками, чтобы графики были не пустыми.
//
// Запуск:  node scripts/seed-dev-staff-demo.js
// Откат:   node scripts/seed-dev-staff-demo.js --clean
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';

import { db } from '../db.js';
import { createStaffPinCredentials } from '../utils/staff-service.js';
import { getBusinessCalendarDayRange, getTimeZoneDateParts } from '../utils/business-time.js';

const PREFIX = 'demo_staff_';
const DAYS = 40;
const TZ = 'Europe/Minsk';
// События удалить нельзя, поэтому прошлые запуски занимают свои idempotency_key.
// Метка запуска разводит ключи между пересозданиями; форма данных при этом
// остаётся прежней, её держит сид генератора ниже.
const RUN = Date.now().toString(36);

const PEOPLE = [
  {
    id: `${PREFIX}${RUN}_manager`,
    first_name: 'Константин',
    last_name: 'Жмурков',
    position: 'Руководитель',
    role: 'manager',
    color: '#2563eb',
    pin: '1111',
    // Доля дней, в которые человек выходит на смену, и типичная её длина.
    workRate: 0.55,
    hours: [6, 9],
  },
  {
    id: `${PREFIX}${RUN}_pavel`,
    first_name: 'Павел',
    last_name: 'Сергеевич',
    position: 'Продавец',
    role: 'employee',
    color: '#16a34a',
    pin: '2222',
    workRate: 0.75,
    hours: [8, 11],
  },
  {
    id: `${PREFIX}${RUN}_anna`,
    first_name: 'Анна',
    last_name: 'Ковалёва',
    position: 'Продавец',
    role: 'employee',
    color: '#db2777',
    pin: '3333',
    workRate: 0.5,
    hours: [5, 8],
  },
];

// Свой генератор вместо Math.random: сид должен давать одну и ту же картинку
// при повторном запуске, иначе «до/после» правок в графиках не сравнить.
let seedState = 20260729;
function random() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick(min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function iso(date) {
  return date.toISOString();
}

function businessDate(date) {
  const parts = getTimeZoneDateParts(date, TZ);
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function fullName(person) {
  return `${person.first_name} ${person.last_name}`;
}

// staff_events и staff_manual_mark_versions защищены триггерами от удаления:
// это журналы, которые в этой системе не переписываются. Поэтому --clean убирает
// только то, что удалять разрешено; события остаются, но после удаления
// сотрудников их employee_id обнуляется по FK и в аналитику они не попадают.
function clean() {
  db.pragma('foreign_keys = OFF');
  const wipe = db.transaction(() => {
    db.prepare(
      `UPDATE orders SET assembled_by_employee_id = NULL, assembled_at = NULL
        WHERE assembled_by_employee_id LIKE ?`,
    ).run(`${PREFIX}%`);
    db.prepare(
      `UPDATE orders SET issued_by_employee_id = NULL, issued_at = NULL
        WHERE issued_by_employee_id LIKE ?`,
    ).run(`${PREFIX}%`);
    for (const table of [
      'staff_monthly_salary_expectations',
      'staff_manual_marks',
      'staff_shifts',
    ]) {
      db.prepare(`DELETE FROM ${table} WHERE employee_id LIKE ?`).run(`${PREFIX}%`);
    }
    db.prepare('DELETE FROM staff_sessions WHERE employee_id LIKE ?').run(`${PREFIX}%`);
    db.prepare('DELETE FROM employees WHERE id LIKE ?').run(`${PREFIX}%`);
    setTracking('false');
  });
  wipe.immediate();
  db.pragma('foreign_keys = ON');
}

// Без включённого учёта раздел показывает заглушку вместо данных.
function setTracking(value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES ('staff_tracking_enabled', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(value);
}

async function createPeople() {
  const timestamp = iso(new Date());
  for (const person of PEOPLE) {
    const credentials = await createStaffPinCredentials(person.pin);
    // Пароль сотруднику не нужен, вход только по ПИН, но колонка NOT NULL.
    const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12);
    db.prepare(`
      INSERT INTO employees (
        id, username, password_hash, first_name, last_name, position,
        active, color, responsibilities, role,
        pin_hash, pin_fingerprint, pin_updated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, '[]', ?, ?, ?, ?, ?, ?)
    `).run(
      person.id,
      person.id,
      unusablePassword,
      person.first_name,
      person.last_name,
      person.position,
      person.color,
      person.role,
      credentials.hash,
      credentials.fingerprint,
      timestamp,
      timestamp,
      timestamp,
    );
  }
}

function insertShift(person, dayStart, startHour, hours) {
  const startedAt = new Date(dayStart.getTime() + startHour * 3_600_000);
  const endedAt = new Date(startedAt.getTime() + hours * 3_600_000);
  const timestamp = iso(new Date());
  db.prepare(`
    INSERT INTO staff_shifts (
      id, employee_id, employee_name_snapshot, business_date,
      planned_start_at, planned_end_at, started_at, ended_at,
      status, version, created_by_employee_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'closed', 1, ?, ?, ?)
  `).run(
    `${PREFIX}shift_${person.id}_${businessDate(startedAt)}`,
    person.id,
    fullName(person),
    businessDate(startedAt),
    iso(startedAt),
    iso(endedAt),
    iso(startedAt),
    iso(endedAt),
    person.id,
    timestamp,
    timestamp,
  );
  return { startedAt, endedAt };
}

function insertEvent(person, happenedAt, eventType, polarity, index) {
  db.prepare(`
    INSERT INTO staff_events (
      id, employee_id, employee_name_snapshot, event_type, polarity, points,
      source, happened_at, business_date, idempotency_key, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, 'system', ?, ?, ?, '{}', ?)
  `).run(
    `${PREFIX}event_${RUN}_${person.id}_${happenedAt.getTime()}_${index}`,
    person.id,
    fullName(person),
    eventType,
    polarity,
    iso(happenedAt),
    businessDate(happenedAt),
    `${PREFIX}${RUN}_${person.id}_${happenedAt.getTime()}_${index}`,
    iso(happenedAt),
  );
}

function insertMark(person, happenedAt, type, title, description, author) {
  const id = `${PREFIX}mark_${person.id}_${happenedAt.getTime()}`;
  const timestamp = iso(new Date());
  db.prepare(`
    INSERT INTO staff_manual_marks (
      id, employee_id, employee_name_snapshot, mark_type, points, title, description,
      happened_at, business_date, current_version,
      created_by_employee_id, created_by_name_snapshot, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `).run(
    id,
    person.id,
    fullName(person),
    type,
    title,
    description,
    iso(happenedAt),
    businessDate(happenedAt),
    author.id,
    fullName(author),
    timestamp,
    timestamp,
  );
  // Версию не пишем: таблица неудаляемая, и её строки пережили бы --clean.
}

/**
 * Метрики «Собрано» и «Выдано» считаются не по событиям, а по колонкам заказов,
 * поэтому проставляем сотрудников на реальные заказы того же дня.
 */
function attributeOrders(person, dayStart, assembled, issued) {
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const orders = db.prepare(`
    SELECT id FROM orders
     WHERE created_at < ?
       AND assembled_by_employee_id IS NULL
       AND issued_by_employee_id IS NULL
     ORDER BY created_at DESC
     LIMIT ?
  `).all(iso(dayEnd), assembled + issued);
  orders.slice(0, assembled).forEach((order, index) => {
    db.prepare('UPDATE orders SET assembled_by_employee_id = ?, assembled_at = ? WHERE id = ?')
      .run(person.id, iso(new Date(dayStart.getTime() + (11 + index % 8) * 3_600_000)), order.id);
  });
  orders.slice(assembled).forEach((order, index) => {
    db.prepare('UPDATE orders SET issued_by_employee_id = ?, issued_at = ? WHERE id = ?')
      .run(person.id, iso(new Date(dayStart.getTime() + (12 + index % 8) * 3_600_000)), order.id);
  });
}

function seedHistory() {
  const manager = PEOPLE[0];
  const today = getTimeZoneDateParts(new Date(), TZ);
  for (let back = DAYS; back >= 1; back -= 1) {
    const anchor = new Date(Date.UTC(today.year, today.month - 1, today.day - back, 12));
    const parts = getTimeZoneDateParts(anchor, TZ);
    const { start: dayStart } = getBusinessCalendarDayRange(parts.year, parts.month, parts.day, TZ);

    for (const person of PEOPLE) {
      if (random() > person.workRate) continue;
      const hours = pick(person.hours[0], person.hours[1]);
      const { startedAt } = insertShift(person, dayStart, pick(10, 12), hours);

      const assembled = pick(0, 4);
      const issued = pick(0, 3);
      const tasks = random() > 0.75 ? 1 : 0;
      let index = 0;
      for (let n = 0; n < assembled; n += 1) {
        insertEvent(person, new Date(startedAt.getTime() + (n + 1) * 1_800_000), 'order_assembled', 'positive', index++);
      }
      for (let n = 0; n < issued; n += 1) {
        insertEvent(person, new Date(startedAt.getTime() + (n + 2) * 2_400_000), 'order_issued', 'positive', index++);
      }
      for (let n = 0; n < tasks; n += 1) {
        insertEvent(person, new Date(startedAt.getTime() + 5_400_000), 'task_approved', 'positive', index++);
      }
      if (random() > 0.9) {
        insertEvent(person, new Date(startedAt.getTime() + 7_200_000), 'procurement_accepted', 'positive', index++);
      }
      attributeOrders(person, dayStart, assembled, issued);

      if (random() > 0.94) {
        // Тип, заголовок и пояснение берём одним броском, иначе получались
        // отметки вида «отрицательная: помог с тяжёлой поставкой».
        const good = random() > 0.4;
        insertMark(
          person,
          new Date(startedAt.getTime() + 3_600_000),
          good ? 'positive' : 'negative',
          good ? 'Помог с тяжёлой поставкой' : 'Опоздал на смену',
          good
            ? 'Остался после закрытия и разобрал коробки.'
            : 'Пришёл на 40 минут позже, витрину открыли позже.',
          manager,
        );
      }
    }
  }
}

/** Зарплату ставим не всем: пусть подсказка «не проставлена» тоже проверяется. */
function seedSalaries() {
  const manager = PEOPLE[0];
  const today = getTimeZoneDateParts(new Date(), TZ);
  const month = `${today.year}-${String(today.month).padStart(2, '0')}`;
  const timestamp = iso(new Date());
  for (const person of PEOPLE.slice(0, 2)) {
    db.prepare(`
      INSERT INTO staff_monthly_salary_expectations (
        id, employee_id, employee_name_snapshot, month, amount_minor, currency,
        status, calculation_json, note, visible_to_employee, current_version,
        set_by_employee_id, set_by_name_snapshot, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'BYN', 'published', '{}', ?, 1, 1, ?, ?, ?, ?)
    `).run(
      `${PREFIX}salary_${person.id}_${month}`,
      person.id,
      fullName(person),
      month,
      person.role === 'manager' ? 280_000 : 145_050,
      'Оклад плюс процент с выдач.',
      manager.id,
      fullName(manager),
      timestamp,
      timestamp,
    );
  }
}

async function main() {
  if (process.argv.includes('--clean')) {
    clean();
    console.log('Демо-сотрудники, смены, отметки и зарплаты удалены.');
    console.log('Системные события остались: они не удаляются, но больше ни к кому не привязаны.');
    return;
  }
  const existing = db
    .prepare('SELECT COUNT(*) c FROM employees WHERE id LIKE ?')
    .get(`${PREFIX}%`).c;
  if (existing) {
    console.log('Демо-данные уже созданы. Пересоздать: --clean, затем запустить снова.');
    for (const person of PEOPLE) {
      console.log(`  ПИН ${person.pin} — ${fullName(person)}, ${person.position}`);
    }
    return;
  }
  await createPeople();
  db.transaction(() => {
    seedHistory();
    seedSalaries();
    setTracking('true');
  }).immediate();

  // Считаем по id этого запуска: события прошлых прогонов удалить нельзя,
  // и общий LIKE по префиксу показал бы их тоже.
  const ids = PEOPLE.map((person) => person.id);
  const countFor = (table) => db
    .prepare(`SELECT COUNT(*) c FROM ${table} WHERE employee_id IN (${ids.map(() => '?').join(',')})`)
    .get(...ids).c;
  const shifts = countFor('staff_shifts');
  const events = countFor('staff_events');
  const marks = countFor('staff_manual_marks');
  console.log(`Создано: ${PEOPLE.length} сотрудника, смен ${shifts}, действий ${events}, отметок ${marks}.`);
  for (const person of PEOPLE) {
    console.log(`  ПИН ${person.pin} — ${fullName(person)}, ${person.position}`);
  }
  console.log('Откат: node scripts/seed-dev-staff-demo.js --clean');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
