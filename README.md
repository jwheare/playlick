[Playlick](http://www.playlick.com) lets you create and share playlists with your friends.

There's a UI for creating, importing, and editing playlists and an accompanying JS library for modelling playlists.

Hooks into [Playdar](http://www.playdar.org) for content resolution.

Persists in a CouchDB database.

TODO
----

* Setup CouchDB on playlick.com
* Album import from Last.fm
* Tag playlist import from Last.fm
* XSPF export
* Applecript export for iTunes
* Hosted playdar streaming
* Sessions/URLs
* Stream tokens

DESIGN NOTES
------------

* First visit gives you an anon session that you can later activate with an email address and name
* Anon session lets you stream other's playlists and create/import and manage playlists in browser. "Activate to save and share these playlists"
* In order to stream a playlist, you need a verified session, and a playdar daemon with a direct connection to the server.
* To make your playlist streamable by others, you create an obscured stream token for the playlist, signed with your session. You can then send around a link with this token, and once another user's session has been verified, they can stream direct from you via the tunnel on the server.
* Each session that begins a stream increments a counter, once a limit has been reached, the stream token expires. Maybe you can create more stream tokens for a playlist later.
* If another user has playdar, they can attempt to connect to you directly and resolve content elsewhere. Again, there is a limit to the number of people you can connect with. Maybe only allow local library resolution?