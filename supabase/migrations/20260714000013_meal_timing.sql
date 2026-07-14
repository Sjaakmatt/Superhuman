-- L5: tijd en structuur in voeding.
alter table meal_plan add column if not exists target_min int; -- richttijd (min na middernacht)
alter table recipes   add column if not exists prep_min int;   -- bereidingstijd
