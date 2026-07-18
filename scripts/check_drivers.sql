-- فحص السائقين الموجودين حالياً
SELECT 
  id,
  full_name,
  role,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.vehicles v 
      WHERE v.assigned_driver_id = staff_members.id::text
         OR CAST(v.assigned_driver_id AS BIGINT) = staff_members.id
    ) THEN 'مرتبط بمركبة'
    ELSE 'غير مرتبط'
  END AS vehicle_status
FROM public.staff_members
WHERE role = 'driver'
ORDER BY full_name;
