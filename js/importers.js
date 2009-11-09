IMPORTERS = {
    YQL_ROOT: "http://query.yahooapis.com/v1/public/yql?callback=?",
    getJSON: function (url, callback) {
        $.getJSON(IMPORTERS.YQL_ROOT, {
            q: 'select * from xml where url="' + url + '"',
            format: 'json'
        }, callback);
    },
    handleException: function (exception) {
        if (PLAYLICK.debug) {
            console.warn(exception);
            exception.logExtra();
        }
    }
};
(function () {
    var Spotify = {
        LOOKUP_ROOT: "http://ws.spotify.com/lookup/1/?uri="
    };
    // Initialised with just a URL, then called with a message and extra when you want
    // to throw it
    Spotify.Exception = function (url) {
        this.url = url;
        var that = this;
        return function (message, extra) {
            that.message = message;
            that.extra = extra;
            return that;
        };
    };
    Spotify.Exception.prototype = {
        name: 'SpotifyException',
        toString: function () {
            return this.name + ': ' + this.message + ' (' + this.url + ')';
        },
        logExtra: function () {
            if (typeof(this.extra) == 'string') {
                console.log(this.extra);
            } else {
                console.dir(this.extra);
            }
        }
    };
    Spotify.AlbumException = Spotify.Exception;
    Spotify.AlbumException.prototype.name = 'SpotifyAlbumException';
    Spotify.TrackException = Spotify.Exception;
    Spotify.TrackException.prototype.name = 'SpotifyTrackException';
    Spotify.import_album = function (url, callback, exception_handler) {
        var album_lookup_url = Spotify.LOOKUP_ROOT + url + '&extras=trackdetail';
        IMPORTERS.getJSON(album_lookup_url, function (json) {
            try {
                var exception = new Spotify.AlbumException(url);
                if (!json) {
                    throw exception('No response', this.url);
                }
                if (json.error) {
                    throw exception(json.error.description, json);
                }
                if (!json.query || !json.query.results || !json.query.results.album) {
                    throw exception('No album', json);
                }
                var album = json.query.results.album;
                if (!album.artist || !album.name) {
                    throw exception('Invalid album', album);
                }
                // XML to JSON converters often return single item lists as single items
                var track_list = $.makeArray(album.tracks.track);
                if (!track_list.length) {
                    throw exception('No tracks', album);
                }
                // Create the playlist
                var playlist = PLAYLICK.create_playlist({
                    name: album.artist.name + ' - ' + album.name
                });
                // Load tracks
                $.each(track_list, function (i, track_data) {
                    if (track_data.name && track_data.artist) {
                        var track_doc = {
                            name: track_data.name,
                            artist: track_data.artist.name,
                            album: album.name,
                            duration: Math.round(track_data.length)
                        };
                        if (track_data.href) {
                            track_doc.url = track_data.href;
                        }
                        playlist.add_track(new MODELS.Track(track_doc));
                    }
                });
                // Save metadata
                playlist.description = url;
                playlist.save();
                if (callback) {
                    callback(playlist);
                }
            }  catch (exception) {
                if (exception_handler) {
                    exception_handler(exception_handler);
                } else {
                    IMPORTERS.handleException(exception);
                }
            }
        });
    };
    Spotify.import_track = function (url, callback, exception_handler) {
        var track_lookup_url = Spotify.LOOKUP_ROOT + url;
        IMPORTERS.getJSON(track_lookup_url, function (json) {
            try {
                var exception = new Spotify.TrackException(url);
                if (!json) {
                    throw exception('No response', this.url);
                }
                if (json.error) {
                    throw exception(json.error.description, json);
                }
                if (!json.query || !json.query.results || !json.query.results.track) {
                    throw exception('No track', json);
                }
                var track = json.query.results.track;
                if (!track.artist || !track.name) {
                    throw exception('Invalid track', album);
                }
                // Create a playlist
                var playlist = PLAYLICK.create_playlist();
                var track_doc = {
                    name: track.name,
                    artist: track.artist.name,
                    album: track.album.name,
                    duration: Math.round(track.length)
                };
                if (track.href) {
                    track_doc.url = track.href;
                }
                playlist.add_track(new MODELS.Track(track_doc));
                playlist.save();
                if (callback) {
                    callback(playlist);
                }
            }  catch (exception) {
                if (exception_handler) {
                    exception_handler(exception_handler);
                } else {
                    IMPORTERS.handleException(exception);
                }
            }
        });
    };
    // Export
    IMPORTERS.Spotify = Spotify;
})();