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
    // Expose
    CONTROLLERS.Playlist = Playlist;
})();
