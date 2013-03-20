![pind](app/_public/img/logo.png)

===================
Node Pinball Daemon
===================

A lightweight web server that runs on a virtual cab, serving all
kinds of neat stuff.

Goals
=====
* Get up running with the least possible effort.
* Be as lightweight as possible - it's for running on a cab.
* Be responsive - nobody likes slow applications.
* Be beautiful - minimal and elegant.

Installation
============

1. Download and install [Node.js](http://nodejs.org/).
2. Download and install [Python 2.7](http://www.python.org/download/releases/2.7.3/).
3. Download and install the [Visual Studio 2010 Express](http://go.microsoft.com/?linkid=9709949).
4. Download and install [GraphicsMagick](http://www.graphicsmagick.org/download.html) and verify that the installer adds the directory to your PATH.
5. Clone the repository to somewhere.
6. Copy `config/settings.json` to `config/settings-mine.json` and update it.
7. `npm install -d`
8. `compound db migrate`
9. `node app.js`

Visual Studio is needed for compiling the dependencies, notably
sqlite3, the database engine. This concerns only Windows, but then
all the pinball stuff doesn't run on other platforms.

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

More to come. Still under heavy development.

Credits
=======

Full credits for the high-score features go to Dna Disturber's [PINemHi](http://www.pinemhi.com/),
along with a big thanks for the permission to redistribute the binary. Looking
forward to even more features!


License
=======

Licensed under GPLv2. See LICENSE.txt.
