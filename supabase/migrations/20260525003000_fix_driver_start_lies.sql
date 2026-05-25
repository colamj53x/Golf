UPDATE public.shots
SET start_lie = 'Tee'
WHERE lower(trim(club)) IN ('dr', 'driver')
  AND lower(trim(start_lie)) = 'fairway'
  AND (
    (shot_date = '2025-08-16 10:42:53+00' AND target = 468.8347667 AND total = 181.3987108)
    OR (shot_date = '2025-10-30 20:39:07+00' AND target = 157.4165102 AND total = 84.93204309)
    OR (shot_date = '2025-11-15 19:52:08+00' AND target = 337.4227192 AND total = 119.8582396)
    OR (shot_date = '2025-12-29 04:46:52+00' AND target = 357.1374196 AND total = 199.9372017)
    OR (shot_date = '2026-01-03 19:12:53+00' AND target = 264.7230052 AND total = 78.51911783)
  );
