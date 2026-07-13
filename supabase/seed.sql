-- Seed: gedeelde content (oefeningen, meditaties, breathwork-patronen).
-- video_url/media_url blijven leeg tot er media in Supabase Storage staat.

-- === Oefeningen ===
insert into exercises (name, kind, default_secs, reps, cue, muscle_group) values
  -- Stretch (voor de stretch-player, Fase 1)
  ('Nek-rol',                'stretch', 30, null, 'Rol je hoofd langzaam van schouder naar schouder, ontspan je kaak.', 'nek'),
  ('Schouder-cirkels',       'stretch', 30, null, 'Grote trage cirkels, adem mee met de beweging.', 'schouders'),
  ('Cat-cow',                'stretch', 45, null, 'Wissel op de ademhaling tussen bolle en holle rug.', 'rug'),
  ('Downward dog',           'stretch', 45, null, 'Duw je hielen richting de grond, houd je rug lang.', 'hamstrings'),
  ('Heupflexor-lunge',       'stretch', 40, null, 'Kniel in een lunge, duw je heup naar voren, borst open.', 'heupen'),
  ('Hamstring-stretch',      'stretch', 40, null, 'Been gestrekt, scharnier vanuit je heup, rug recht.', 'hamstrings'),
  ('Borst-opener deurpost',  'stretch', 30, null, 'Onderarm tegen de deurpost, draai je romp rustig weg.', 'borst'),
  ('Kind-houding',           'stretch', 60, null, 'Zak terug op je hielen, armen lang, adem laag in je buik.', 'rug'),
  -- Kracht
  ('Squat',                  'strength', null, 10, 'Gewicht op je hielen, knieën naar buiten, borst omhoog.', 'benen'),
  ('Push-up',                'strength', null, 10, 'Lichaam als een plank, ellebogen ~45 graden.', 'borst'),
  ('Row (elastiek/halter)',  'strength', null, 12, 'Trek je schouderbladen eerst samen, dan pas de armen.', 'rug'),
  ('Plank',                  'strength', 45, null, 'Bilspieren aan, onderrug neutraal, blijf ademen.', 'core'),
  ('Lunge',                  'strength', null, 10, 'Grote stap, achterste knie richting de grond.', 'benen'),
  -- Mobiliteit
  ('Heup-cirkels 90/90',     'mobility', 45, null, 'Wissel zittend van kant zonder je handen te gebruiken.', 'heupen'),
  ('Enkel-mobilisatie',      'mobility', 30, null, 'Knie over je tenen, hiel blijft aan de grond.', 'enkels'),
  ('Thoracale rotatie',      'mobility', 40, null, 'Draai vanuit je borstwervels, heupen blijven stil.', 'rug');

-- === Meditaties ===
insert into meditations (title, category, media_type, duration_secs, description) values
  ('Ochtend-reset',        'reset',  'voice', 300, 'Vijf minuten om de dag wakker en helder te beginnen.'),
  ('Diepe focus',          'focus',  'voice', 600, 'Tien minuten aandachtstraining voor deep work.'),
  ('Bodyscan voor slaap',  'slaap',  'voice', 900, 'Vijftien minuten van hoofd naar tenen ontspannen.'),
  ('Kalmte bij stress',    'kalmte', 'voice', 420, 'Zeven minuten om je zenuwstelsel te laten zakken.'),
  ('Micro-reset',          'reset',  'voice', 180, 'Drie minuten tussendoor: adem, land, ga verder.');

-- === Breathwork-patronen ===
-- phases: [{label, secs, scale}] — scale stuurt de ademende bol-animatie
insert into breathwork_patterns (name, phases) values
  ('4-7-8', '[
    {"label": "Adem in",  "secs": 4, "scale": 1.0},
    {"label": "Houd vast","secs": 7, "scale": 1.0},
    {"label": "Adem uit", "secs": 8, "scale": 0.6}
  ]'::jsonb),
  ('Box breathing', '[
    {"label": "Adem in",  "secs": 4, "scale": 1.0},
    {"label": "Houd vast","secs": 4, "scale": 1.0},
    {"label": "Adem uit", "secs": 4, "scale": 0.6},
    {"label": "Houd vast","secs": 4, "scale": 0.6}
  ]'::jsonb),
  ('Coherent (5.5)', '[
    {"label": "Adem in",  "secs": 5.5, "scale": 1.0},
    {"label": "Adem uit", "secs": 5.5, "scale": 0.6}
  ]'::jsonb);
