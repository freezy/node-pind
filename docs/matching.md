How Pind identifies tables
==========================

Pind is supposed to work with an already set up system. That means it is able to read table info from HyperPin's
XML database and update the correct table when a new version is downloaded.

But how does Pind identify a table from HyperPin at VPF and vice versa? This is very important, otherwise users will
end up with the same table added multiple times to HyperPin or even worse, a table gets overwritten with the
wrong file.


A Unique ID
-----------

In order to make table matching accurate, a unique identifier is needed. Fortunately, we have a few options here.
Firstly, there is IPDB.org which promotes an IPDB number, and whose database is pretty complete when it comes to table
recreations.

For original tables however, IPDB will come up empty, so another identifier is needed. Turns out that at VPF, we
have file IDs as well. So for original tables, Pind will use VPF's file ID.

Now, since we have a vibrant modding community, tables tend to be available in multiple variations, such as an
additional night mod version. For this, Pind will track an additional "mod" field that distinguishes between
the classic and any potentially modded versions.


How to match?
-------------

As explained above, our identifier has three components: IPDB number, VPF file ID and mod type. The challenge now
is to accurately determine:

1. IPDB number for all VPF downloads
2. IPDB number for your HyperPin recreations
3. VPF file ID for your HyperPin original games

Point 1 is pretty much taken care of. Pind contains [a map](https://github.com/freezy/node-pind/blob/master/server/data/ipdb-vpf.json)
that links all VPF cabinet downloads to an IPDB number. This map has been manually verified, using visuals from both
VPF and IPDB to ensure that the correct match is made. You can have a look at how it works by opening the path `/ipdbvpf`
in Pind. For new entries that aren't yet in the mapping, the usual search fallback is applied, which is nearly as
accurate.

Point 2 is somewhat more difficult. Right now, Pind expects the standard HyperPin format `Table Name (Manufacturer Year)`
and will search accordingly on IPDB. Before searching, Pind tweaks the search query for optimal results. Additionaly,
Pind ships with a [mapping file](https://github.com/freezy/node-pind/blob/master/server/data/ipdb-hp.json) for common
titles. The quality of the HyperPin matches can be checked by opening the path `/ipdbhp` in Pind. The displayed list
highlights differences between the HyperPin database and the data fetched from IPDB. It also provides a way to correct
wrong entries and write them into the mapping file.

Point 3 is still unsolved. If you download an OG using Pind, the VPF file ID is obviously known and future updates
get matched correctly. However, matching the correct original game when downloading an update for an already
*existing* table is quite difficult without an IPDB number to rely on.

One approach to solve Point 3 would be to search for the OG's media pack, where the HyperPin database entry is usually
posted, read the game description from there and try to match it with the local HP database. However for this we need
more reliable media pack matching first.


Persistence
-----------

When Pind adds a new table to HyperPin, it knows with 100% accuracy where the file came from (i.e. its VPF file ID and
consequently its IPDB number). In order not to lose that information next time a user re-initializes Pind, this data
is written to HyperPin's XML database, ending up like this:

	<game name="T2_CE_Tipoto_1.06_FS" ipdb="2524" vpf="6105">
		<description>Terminator 2 - Judgement Day (Williams 1991)</description>
		<manufacturer>Williams</manufacturer>
		<year>1991</year>
		<type>SS</type>
		<enabled>yes</enabled>
	</game>

If available, this data is read when parsing and used before falling back to the search algorithm.


Battlefield Tested?
-------------------

Not really (yet). It works with a 880 table file that mainly contains recreations and it seems to work well on a few
other systems, but otherwise it still needs approval. Feedback is appreciated though.

