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
  * Automatically search, download and patch table for DirectB2S backglasses
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
  auto-login uses a random token, CSRF protection, SSL connections should be
  enforced when transferring sensitive data.
* Be usable on a phone (responsive layout).

Note that for a single user cab, pind is mainly useful for managing tables, 
which is a major PITA to do manually. Most of the other features however are
about multiple players using the same cab.


Development Principles
======================

* Get up and running with the least possible effort (not there yet).
* Be as lightweight as possible - it's for running on a cab (check).
* Be responsive - nobody likes slow applications (check).
* Be beautiful - minimal yet elegant (check).


Platforms
=========

If you've read as far as this, you already know that all the stuff mentioned
above runs on Windows and Windows only. I'm currently testing this on XP,
Windows 7 and Windows 8.

However, I'm open to add support for other platforms if that's your
development environment. If there are particular problems, let me know and I'll
try to fix them (or even better, submit a PR).


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
8. `node create-schema`
9. `node server`

Visual Studio is needed for compiling the dependencies, notably sqlite3, the
database engine. This concerns only Windows, but then all the pinball stuff
doesn't run on other platforms.


Status
======

Working
-------

* Register user via web
* Table manager
* User manager
* Trigger coin drop via API and web app
* Parse HyperPin "database" and store locally
* Scrape ipdb.org for additional meta data
* Rudimentary access to HyperPin media via API
* Parse game ROM name from .vpt
* Get structured high-scores (incl. additional achievements) for a .vpt
* Link users to high-scores

TODO
----
* Score stats for registered users
* Web table browser
* Look for another DB engine (sqlite is major PITA to compile).
* Basic VPForums.org integration
* Browsing features

More to come. Still under heavy development.


Technologies
============

Besides obviously [NodeJS](http://nodejs.org/) on server side, there are a few
more technologies used:

* [Twitter Bootstrap](http://twitter.github.io/bootstrap/) for client side CSS
* Vector icons from [Font Awesome](http://fortawesome.github.io/Font-Awesome/),
  assembled by [IcoMoon](http://icomoon.io/) (along with some custom icons).
* [jQuery](http://jquery.com/) for all our JS needs.


Credits
=======

* Full credits for the high score features go to Dna Disturber's [PINemHi](http://www.pinemhi.com/),
  along with a big thanks for the permission to redistribute the binary. Looking
  forward to even more features!
* Thanks to Sacha Greif for the nice [3D buttons](http://sachagreif.com/bootstrap/).
* Thanks to Andreas Nylin for the DMD font and his permission to use it freely.
* Thanks to [Backpacker](http://backpacker.gr/) for the [BPdots](http://www.fontsquirrel.com/fonts/BPdots) font. It is licensed under Creative Commons 3.0, for more info see [here](http://www.fontsquirrel.com/license/BPdots).

License
=======

Licensed under GPLv2. See LICENSE.txt.
