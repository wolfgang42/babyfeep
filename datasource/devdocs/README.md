Download pages from https://devdocs.io/, which conveniently have already been crawled by [someone else](https://github.com/freeCodeCamp/devdocs?tab=readme-ov-file#scraper) and so make for an excellent starting point.

The `wantdocs.txt` list was hastily derived by combining Kagi's domain list with data that Feep! already had, like so:
```sh
duckdb -bail -c '.mode tabs' -noheader -c '
    with origins as (
        select distinct chunk, url_origin from "data/cachev1/*/pages.parquet"
    )
    select chunk
    from origins
    where url_origin in (
        select origin from "/home/wolf/kagimini/wantorigins.csv"
    )' \
    | cut -d: -f2 > /home/wolf/kagimini/datasource/devdocs/wantdocs.txt
```
