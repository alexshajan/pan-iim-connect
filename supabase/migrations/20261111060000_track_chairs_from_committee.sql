-- Prof. Kailash, Devansh, Teidorlang and Sitanshu chair tracks: they get the Track Chair card (18 track chairs).
update public.people set card_role = 'Track Chair', category = 'Track Chair'
where delegate_code in ('WMC-Y82G','WMC-PLK8','WMC-SG5P','WMC-T8EE');
