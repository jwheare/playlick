[Playlick](http://www.playlick.com) lets you create and share playlists with your friends.

There's a UI for creating, importing, and editing playlists and an accompanying JS library for modelling playlists.

Hooks into [Playdar](http://www.playdar.org) for content resolution.

Persists in a CouchDB database.

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