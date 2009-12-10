/**
 * MODELS
**/
var MODELS = {
    couch: new CouchDB('playlick'),
    couch_up: true,
    next_playlist_id: 0,
    next_playlist_track_id: 0,
    stat_couch: function () {
        try {
            var version = CouchDB.getVersion('/');
            MODELS.couch_up_handler('stat', version);
        } catch (result) {
            MODELS.couch_down_handler('stat', result);
        }
    },
    couch_down_handler: function (action, result) {
        MODELS.couch_up = false;
    },
    couch_up_handler: function (action, response) {
        MODELS.couch_up = true;
    }
};
(function () {
    //= require "models/track"
    //= require "models/playlist"
    //= require "models/playlisttrack"
    
    // Expose
    MODELS.Track = Track;
    MODELS.Playlist = Playlist;
    MODELS.PlaylistTrack = PlaylistTrack;
})();
