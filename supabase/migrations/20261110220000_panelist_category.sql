-- Padma Shri, Editors' and Corporate panel guests share one category and card title: Panelist.
UPDATE public.people SET category = 'Panelist', card_role = 'Panelist'
WHERE category IN ('Journal Editor', 'Padma Shri Panel', 'Corporate Panel', 'Editor Panel');
