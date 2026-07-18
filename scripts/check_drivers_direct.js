// فحص السائقين مباشرة من Supabase
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnon);

async function checkDrivers() {
  console.log('=== فحص السائقين ===\n');
  
  const { data: drivers, error } = await supabase
    .from('staff_members')
    .select('id, full_name, role')
    .eq('role', 'driver')
    .order('full_name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`إجمالي السائقين: ${drivers.length}\n`);

  // البحث عن مكررات محتملة
  const nameMap = new Map();
  drivers.forEach(d => {
    const normalized = d.full_name.trim().toLowerCase();
    if (!nameMap.has(normalized)) {
      nameMap.set(normalized, []);
    }
    nameMap.get(normalized).push(d);
  });

  const duplicates = Array.from(nameMap.entries())
    .filter(([_, list]) => list.length > 1);

  if (duplicates.length > 0) {
    console.log('=== أسماء متطابقة تماماً ===');
    duplicates.forEach(([name, list]) => {
      console.log(`\n"${name}":`);
      list.forEach(d => console.log(`  - ID: ${d.id}, Name: "${d.full_name}"`));
    });
  }

  // البحث عن أسماء مشابهة (مثل "احمد رفاعی" و "احمد رفاعي عايد دعيبل")
  console.log('\n=== البحث عن أسماء مشابهة ===');
  const similarPairs = [];
  for (let i = 0; i < drivers.length; i++) {
    for (let j = i + 1; j < drivers.length; j++) {
      const name1 = drivers[i].full_name.toLowerCase();
      const name2 = drivers[j].full_name.toLowerCase();
      
      // إذا كان أحد الاسمين جزء من الآخر
      if (name1.includes(name2) || name2.includes(name1)) {
        if (name1 !== name2) {
          similarPairs.push([drivers[i], drivers[j]]);
        }
      }
    }
  }

  if (similarPairs.length > 0) {
    similarPairs.forEach(([d1, d2]) => {
      console.log(`\n"${d1.full_name}" (ID: ${d1.id})`);
      console.log(`"${d2.full_name}" (ID: ${d2.id})`);
    });
  } else {
    console.log('لا توجد أسماء مشابهة واضحة');
  }

  // التحقق من الربط بالمركبات
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('assigned_driver_id');

  const linkedDriverIds = new Set(
    vehicles
      ?.filter(v => v.assigned_driver_id)
      .map(v => String(v.assigned_driver_id)) || []
  );

  console.log('\n=== حالة الربط بالمركبات ===');
  const unlinked = drivers.filter(d => !linkedDriverIds.has(String(d.id)));
  console.log(`مرتبطين بمركبات: ${drivers.length - unlinked.length}`);
  console.log(`غير مرتبطين: ${unlinked.length}`);
  
  if (unlinked.length > 0) {
    console.log('\nالسائقين غير المرتبطين:');
    unlinked.forEach(d => console.log(`  - "${d.full_name}" (ID: ${d.id})`));
  }
}

checkDrivers().catch(console.error);
