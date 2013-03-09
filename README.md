===================
Node Pinball Daemon
===================

A lightweight webserver that runs on a virtual cab, serving all kinds of neat
stuff.

Installation
============

1. Download and install [Node.js](http://nodejs.org/).
2. Download and install [Python 2.7](http://www.python.org/download/releases/2.7.3/).
3. Download and install the [Visual Studio 2010 Express](http://go.microsoft.com/?linkid=9709949).
4. Download and install [GraphicsMagick](http://www.graphicsmagick.org/download.html) and verify that the installer adds the directory to your PATH.
5. Clone the repository to somewhere.
6. Update `config/settings.json`
7. `npm install -d`
8. `node app.js`

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

TODO
----

* Retrieve high scores from ROMs
* Link users to highscores
* Web table browser
* Score stats for registered users

More to come. Still under heavy development.

License
=======

Licensed under GPLv2. See LICENSE.txt.
