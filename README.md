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
  * Automatically download missing artwork `done`
  * Easily (fuzzy-) search, download and add new tables `done`
  * Automatically download missing ROMs `done`
  * Automatically search, download and patch table for DirectB2S backglasses
  * Bulk-update VPinMAME rotation settings in tables `done`
  * Match tables on IPDB.org for additional meta data `done`
  * Support for Visual Pinball and Future Pinball `VP - done`
  * Receive real-time status updates during processing `done`
* Manage users:
  * Anyone can sign up individually using high score initials as user name `done`
  * Administrator can manage credits for each user `done`
  * Credits allow users to insert coins via web app or Android client (using
    NFC where supported) `done`
  * Users can be notified by mail when someone beats a high score
* Include a download manager for assets and tables `done`
* Provide an API for all features (JSON-RPC 2.0) `done`
* Provide an Android app for some features (such as inserting a coin, browsing
  tables and high scores). `inserting coin - done`
* Implement reasonable security. Passwords are salted and strongly hashed,
  auto-login uses a random token, CSRF protection, SSL connections should be
  enforced when transferring sensitive data. `done`
* Provide an automatic update procedure. `done`
* Be usable on a phone (responsive layout). `done`

Note that for a single user cab, pind is mainly useful for managing tables,
which is a major PITA to do manually. Most of the other features however are
about multiple players using the same cab.


Development Principles
======================

* Get up and running with the least possible effort.
* Be as lightweight as possible - it's for running on a cab.
* Be responsive - nobody likes slow applications.
* Be beautiful - minimal yet elegant.


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

See [INSTALL.md](https://github.com/freezy/node-pind/blob/master/INSTALL.md).


Technologies
============

Besides obviously [NodeJS](http://nodejs.org/) on server side, there are a few
more technologies used:

* [Twitter Bootstrap](http://twitter.github.io/bootstrap/) for client side CSS
* Vector icons from [Font Awesome](http://fortawesome.github.io/Font-Awesome/),
  assembled by [IcoMoon](http://icomoon.io/) (along with some custom icons).
* [jQuery](http://jquery.com/) for all our JS needs.
* [Socket.IO](http://socket.io/) for the real-time features.
* [AngularJS](http://angularjs.org/) for client side development.


Credits
=======

* Full credits for the high score features go to Dna Disturber's [PINemHi](http://www.pinemhi.com/),
  along with a big thanks for the permission to redistribute the binary. Looking
  forward to even more features!
* Thanks to Sacha Greif for the nice [3D buttons](http://sachagreif.com/bootstrap/).
* Thanks to Andreas Nylin for the DMD font and his permission to use it freely.

License
=======

Licensed under GPLv2. See LICENSE.txt.
