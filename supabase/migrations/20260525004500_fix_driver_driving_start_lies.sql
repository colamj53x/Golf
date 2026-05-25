UPDATE public.shots
SET start_lie = 'Tee'
WHERE lower(trim(club)) IN ('dr', 'driver')
  AND lower(trim(start_lie)) = 'fairway'
  AND lower(trim(shot_type)) LIKE 'driv%';
