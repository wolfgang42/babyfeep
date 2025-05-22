Download pages from the web.

This is a hacky way to do it, which should not be put anywhere near production;
see `download.sh` for a small list of just a few of the reasons it’s a bad idea.

The `wantorigins.txt` list was hastily derived by combining Kagi's domain list with data that Feep! already had, like so:
```sh
duckdb -bail -c '.mode tabs' -noheader -c '
    select * from "/home/wolf/kagimini/wantorigins.csv"
    where origin not in (
        select distinct url_origin
        from "data/cachev1/*/pages.parquet"
        where chunk not like '"'devdocs:%'"'
    )' \
    > /home/wolf/kagimini/datasource/web/wantorigins.txt
```

Then the URL lists were obtained with this slow and hacky script, which is not quite correct for several reasons: notably, it leaves out any pages that Feep! has but Baby Feep! doesn't. I decided to call it good enough anyway.

```sh
cat /home/wolf/kagimini/datasource/web/wantorigins.txt | while read -r origin; do
	originurl="$(echo "$origin" | jq -Rr @uri)"

	if [ -e "/home/wolf/kagimini/datasource/web/data/derive/want/$originurl" ]; then
		continue
	fi
	echo "$origin"

	duckdb -bail -c '.mode tabs' -noheader -c '
		create or replace view pagerank as (select * from "data/pagerank-m0687lvy.parquet");
		create or replace view pages as (
			select pages.*, pagerank.rank as url_pagerank
			from "data/cachev1/*/pages.parquet" as pages
			left outer join pagerank on pages.url_prid = pagerank.prid
		);
		create or replace view links as (
			select links.*, pagerank_src.rank as src_pagerank, pagerank_dst.rank as dst_pagerank
			from "data/cachev1/*/links.parquet" as links
			left outer join pagerank as pagerank_src on links.src_prid = pagerank_src.prid
			left outer join pagerank as pagerank_dst on links.dst_prid = pagerank_dst.prid
		);
		select distinct
			dst_canonical
		from links
		where
			not exists (select 1 from pages where pages.url_prid = dst_prid) and
			dst_canonical like '"'$origin%'"'
		order by dst_pagerank desc
		limit 1000;' \
	> /home/wolf/kagimini/datasource/web/data/derive/want/"$originurl".tmp
	mv /home/wolf/kagimini/datasource/web/data/derive/want/"$originurl"{.tmp,}
done
```
