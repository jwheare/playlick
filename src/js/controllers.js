/**
 * CONTROLLERS
**/
var CONTROLLERS = {
};
(function () {
    //= require "controllers/playlist.controller"
    // Initialise singleton
    var Playlist = new Playlist();
    // Register couch handlers
    MODELS.onCouchDown = function () {
        Playlist.couchDownHandler.apply(Playlist, arguments);
    };
    MODELS.onCouchUp = function () {
        Playlist.couchUpHandler.apply(Playlist, arguments);
    };
    MODELS.Playlist.DefaultOptions = {
        onSave: function () {
            Playlist.onSave(this);
        },
        onCreate: function () {
            Playlist.onCreate(this);
        },
        onUnload: function () {
            Playlist.onUnload(this);
        },
        onDelete: function () {
            Playlist.onDelete(this);
        }
    };
    // Expose
    CONTROLLERS.Playlist = Playlist;
})();
