![pind](app/_public/img/logo.png)

===================
Node Pinball Daemon
===================

A lightweight web server that runs on a virtual pinball cab, doing all kinds
of neat stuff. Particularly it should be able to:

* Browse through HyperPin's tables in a fast and visually pleasing way with
  the ability to:
  * Define filters based on table attributes 
  * Mark tables as favorite for faster access
  * Make use of available artwork using realtime image processing and caching
* List high scores of all tables for a given user, including a "global" score
  based on achievements.
* Provide a voting system for new tables to install.
* Administer HyperPin's tables. This includes:
  * Automatically download missing artwork
  * Easily search, download and add new tables
  * Automatically download missing ROMs
  * Automatically search for DirectB2S backglasses
  * Bulk-update VPinMAME rotation settings in tables
  * Match tables on IPDB.org for additional meta data
  * Support for Visual Pinball and Future Pinball
* Manage users:
  * Anyone can sign up individually using high score initials as user name
  * Administrator can manage credits for each user
  * Credits allow users to insert coins via web app or Android client (using
    NFC where supported)
  * Users can be notified by mail when someone beats a high score
* Provide an API for all features (JSON-RPC 2.0)
* Provide an Android app for some features (such as inserting a coin, browsing
  tables and high scores).
* Implement reasonable security. Passwords are salted and strongly hashed, 
  auto-login uses a random token, SSL connections should be enforced when
  transferring sensitive data.

Note that for a single user cab, pind is mainly useful for managing tables, 
which is a major PITA to do manually. Most of the other features however are
about multiple players using the same cab.


Development Principles
======================

* Get up and running with the least possible effort (still work to do).
* Be as lightweight as possible - it's for running on a cab.
* Be responsive - nobody likes slow applications.
* Be beautiful - minimal yet elegant.


Installation
============

1. Download and install [Node.js](http://nodejs.org/).
2. Download and install [Python 2.7](http://www.python.org/download/releases/2.7.3/).
3. Download and install the [Visual Studio 2010 Express](http://go.microsoft.com/?linkid=9709949).
4. Download and install [GraphicsMagick](http://www.graphicsmagick.org/download.html)
   and verify that the installer adds the directory to your PATH.
5. Clone the repository to somewhere.
6. Copy `config/settings.json` to `config/settings-mine.json` and update it.
7. `npm install -d`
8. `compound db migrate`
9. `node app.js`

Visual Studio is needed for compiling the dependencies, notably sqlite3, the
database engine. This concerns only Windows, but then all the pinball stuff
doesn't run on other platforms.


Status
======

Working
-------

* Register user via web
* Trigger coin drop via API
* Parse HyperPin "database" and store locally
* Scrape ipdb.org for additional meta data
* Rudimentary access to HyperPin media via API
* Parse game ROM name from .vpt
* Get structured high-scores (incl. additional achievements) for a .vpt

TODO
----

* Integrate with an MVC framework (CompoundJS looks good).
* Link users to high-scores
* Web table browser
* Score stats for registered users
* Look for another DB engine (sqlite is major PITA to compile).
* Basic VPForums.org integration
* Browsing features
* Admin features

More to come. Still under heavy development.


Credits
=======

Full credits for the high score features go to Dna Disturber's [PINemHi](http://www.pinemhi.com/),
along with a big thanks for the permission to redistribute the binary. Looking
forward to even more features!


License
=======

Licensed under GPLv2. See LICENSE.txt.
