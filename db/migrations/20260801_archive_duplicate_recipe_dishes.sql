-- Birleştirilen katalog kayıtlarını geçmiş veriyi silmeden arşivler.
-- Kanonik kayıt yoksa eski kaydı gizlemez; migration tekrar çalıştırılabilir.
with duplicate_map(old_slug, canonical_slug) as (
  values
    ('etliekmek', 'etli-ekmek'),
    ('alaca-corbasi', 'alaca-corba'),
    ('tuzlu-balik', 'sor-tuzlu-balik')
)
update public.recipe_dishes old_dish
set catalog_status = 'archived',
    updated_at = now()
from duplicate_map mapping
where old_dish.slug = mapping.old_slug
  and exists (
    select 1
    from public.recipe_dishes canonical
    where canonical.slug = mapping.canonical_slug
  );

update public.recipe_dishes child
set parent_dish_id = parent.id,
    variant_reason = 'Klasik sucuk kılıfa doldurularak olgunlaştırılan üründür; sucuk içi ise aynı baharatlı et karışımının kılıfsız, taze biçimde pişirilen yöresel çeşididir.',
    updated_at = now()
from public.recipe_dishes parent
where child.slug = 'sucuk-ici'
  and parent.slug = 'sucuk';

update public.recipe_dishes
set variant_reason = 'Bu kayıttaki “sucuk” et ürünü değildir; pestil ve geleneksel tatlı grubunda yer alan meyve/pekmez esaslı ürünü ifade eder.',
    updated_at = now()
where slug = 'pestil-ve-sucuklar';

-- Arşivlenen kayıtların yayımlanmış eski sürümleri olsa bile doğrudan tablo
-- sorgularında görünmesini engeller. Hidden statüsü, elle yayımlanan tariflerin
-- geriye dönük görünürlüğünü korur.
drop policy if exists "Authenticated users can read recipe dishes" on public.recipe_dishes;
create policy "Authenticated users can read recipe dishes"
  on public.recipe_dishes for select to authenticated
  using (
    catalog_status = 'visible'
    or (
      catalog_status = 'hidden'
      and exists (
        select 1 from public.recipe_versions version
        where version.dish_id = recipe_dishes.id
          and version.review_status = 'published'
      )
    )
  );
