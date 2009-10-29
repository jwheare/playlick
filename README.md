[Playlick](http://www.playlick.com) lets you create and share playlists with your friends.

There's a UI for creating, importing, and editing playlists and an accompanying JS library for modelling playlists.

Hooks into [Playdar](http://www.playdar.org) for content resolution.

Persists in a CouchDB database.

URL Import
----------

You can import playlists into Playlick by using URL hash parameters that map to the import forms:

* http://www.playlick.com#xspf=http://www.playgrub.com/8afc7ead91698404be84e27190c72fdd.xspf
* http://www.playlick.com#podcast=http%3A%2F%2Fmokele.co.uk%2Fmusic.xml
* http://www.playlick.com#artist=Miles+Davis;album=Kind+of+Blue
* http://www.playlick.com#lastfm_playlists=jwheare
* http://www.playlick.com#lastfm_you=jwheare;lastfm_they=rj

TODO
----

* Setup CouchDB/persistance/sessions/URLs on playlick.com
* Tag playlist/personal tags/loved tracks import from Last.fm
* Error handling for streaming
* XSPF export
* iTunes import

DESIGN NOTES
------------

* First visit gives you an anon session that you can later activate with an email address and name
* Anon session lets you stream other's playlists and create/import and manage playlists in browser. "Activate to save and share these playlists"