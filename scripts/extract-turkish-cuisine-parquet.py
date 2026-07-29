"""Extract factual recipe fields from the licensed Hugging Face Parquet export.

Requires the optional `duckdb` Python package. The output is an intermediate
file consumed by build-turkish-cuisine-catalog.mjs; narrative instructions and
descriptions are deliberately excluded.
"""

import argparse
import duckdb


TERMS = (
    "çorba|köfte|kebap|börek|dolma|sarma|pilav|helva|baklava|kadayıf|künefe|"
    "pide|lahmacun|mantı|menemen|cacık|ayran|gözleme|poğaça|açma|simit|bazlama|"
    "tarhana|keşkek|aşure|revani|lokma|tulumba|sütlaç|muhallebi|hoşaf|komposto|"
    "yahni|güveç|kavurma|tava|zeytinyağlı|dible|kuymak|mıhlama|kısır|mercimek|"
    "fasulye|nohut|patlıcan|kabak|bulgur|erişte|imam bayıldı|karnıyarık|musakka|"
    "türlü|oturtma|kapuska|ezogelin|işkembe|paça|kavut|pestil|sucuk|pastırma|şerbet"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--limit", type=int, default=20_000)
    args = parser.parse_args()

    connection = duckdb.connect()
    query = """
        select
          row_number() over () - 1 as row_idx,
          struct_pack(
            title := title,
            ingredients := ingredients,
            category := category,
            tags := tags,
            servings := servings,
            prep_time := prep_time,
            cook_time := cook_time,
            total_time := total_time,
            nutrition := nutrition
          ) as row
        from read_parquet(?)
        where regexp_matches(
          lower(coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(array_to_string(tags, ' '), '')),
          ?
        )
        limit ?
    """
    connection.execute(
        f"create temporary table candidates as {query}",
        [args.input, TERMS, args.limit],
    )
    escaped_output = args.output.replace("'", "''")
    connection.execute(
        f"copy candidates to '{escaped_output}' (format json, array true)"
    )
    count = connection.execute("select count(*) from read_json_auto(?)", [args.output]).fetchone()[0]
    print(f"{count} aday {args.output} dosyasına çıkarıldı.")


if __name__ == "__main__":
    main()
