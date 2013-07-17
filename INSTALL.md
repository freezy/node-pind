![pind](app/_public/img/logo.png)

Installation
============

1. Install Node.js
------------------
Since Pind is running on top of Node.js, there is no need of an additional
HTTP server. For the dependencies used in the project, 
[npm](https://github.com/isaacs/npm) will take care of downloading and
compiling all the necessary libraries.

Download and install Node.js from [here](http://nodejs.org/). Also, make sure
`node.exe` and `npm.cmd` are in your `PATH` (per default at `C:\Program Files\nodejs`).


2. Install Git
--------------
If you haven't already, install [Git for Windows](https://code.google.com/p/msysgit/downloads/list?q=full+installer+official+git). If you really want
to live without Git, you can also download the zipball from GitHub instead of
cloning in step 5 below.


3. Install Build Tools
----------------------

Since not every library is available in native Javascript, NPM will have to do
some compilation. This is the reason of Visual Studio and Windows SDK being
included in the installation procedure.

1. Download and install [Python 2.7](http://www.python.org/download/releases/2.7.5/).
2. Download and install the [Visual Studio 2010 Express](http://go.microsoft.com/?linkid=9709949).
3. On Windows 7 or above, download and install the 
   [Windows 7 SDK](http://www.microsoft.com/en-us/download/details.aspx?id=8279).


4. Install Additional Dependencies
----------------------------------

Pind needs to be able to unrar your downloaded files and deal with artwork. For
that, the following software is needed:

1. Download and install [GraphicsMagick](http://www.graphicsmagick.org/download.html)
   and verify that the installer adds the directory to your `PATH`.
2. Download and install [Unrar](http://gnuwin32.sourceforge.net/downlinks/unrar.php).


5. Install Pind
---------------
1. Open a command line prompt - Win+R, `cmd`, enter.
2. Go to where you want to install Pind  - `cd C:\Games\`
3. Clone the repository - `git clone git://github.com/freezy/node-pind.git`
4. Install dependencies - `cd node-pind`, `npm install -d`

Don't close the command line window just yet.


6. Configure Pind
-----------------
1. Copy `config/settings.json` to `config/settings-mine.json` and open it in a text editor.
2. Go through every option and update it if necessary.
3. Make sure you got everything by searching "@important" in the file and double-check each value.
3. Initialize database schema via command prompt - `node create-schema`
4. Start Pind for a first test run (`node server`) and open a browser at
   `http://localhost`.


7. Make Pind start automatically
---------------------------------

1. Download and install [NSSM](http://nssm.cc/)
2. On the command line prompt install Pind as a service - `nssm install "Pinball Daemon" "C:\Program Files\nodejs\node.exe" C:\Games\node-pind\prod.js` - with path names
of your installation.


If shit crashes, open up an issue. :)