IMPORTERS = {
    getJson: function (url, params, callback, exception, exceptionHandler) {
        var params = params || {};
        var exceptionHandler = exceptionHandler || IMPORTERS.defaultExceptionHandler;
        var hasTimedOut = false;
        var callTimeout = setTimeout(function () {
            hasTimedOut = true;
            exceptionHandler(exception('Request timed out', {
                url: url,
                params: params
            }));
        }, 4000);
        $.getJSON(url, params, function (json) {
            if (hasTimedOut) {
                return;
            }
            clearTimeout(callTimeout);
            try {
                IMPORTERS.checkResponse.call(this, json, exception);
                callback.call(this, json);
            } catch (e) {
                exceptionHandler(e);
            }
        });
    },
    getJsonFomXml: function (url, callback, exception, exceptionHandler) {
        IMPORTERS.getJson("http://query.yahooapis.com/v1/public/yql?callback=?", {
            q: 'select * from xml where url="' + url + '"',
            format: 'json'
        }, function (json) {
            if (!json.query || !json.query.results) {
                throw exception('Invalid URL');
            }
            callback.call(this, json);
        }, exception, exceptionHandler);
    },
    createPlaylistFromJspf: function (jspf, metadata, exception) {
        if (!jspf.trackList || !jspf.trackList.track) {
            throw exception('No tracks in JSPF response', jspf);
        }
        var metadata = metadata || {};
        var trackList = $.makeArray(jspf.trackList.track);
        if (!trackList.length) {
            throw exception('No tracks in JSPF', jspf.trackList);
        }
        var playlist = PLAYLICK.create_playlist({
            name: jspf.title
        });
        $.each(trackList, function (i, data) {
            if (data.title && data.creator) {
                var trackDoc = {
                    name: data.title,
                    artist: data.creator,
                    album: data.album,
                    duration: Math.round(data.duration/1000)
                };
                if (data.location) {
                    trackDoc.url = data.location;
                }
                playlist.add_track(new MODELS.Track(trackDoc));
            }
        });
        playlist.image = metadata.image;
        playlist.description = metadata.description;
        playlist.save();
        return playlist;
    },
    createPlaylistFromPodcast: function (podcast, exception) {
        if (!podcast.item) {
            throw exception('No tracks in Podcast response', podcast);
        }
        var trackList = $.makeArray(podcast.item);
        if (!trackList.length) {
            throw exception('No tracks in Podcast', jspf.trackList);
        }
        var playlist = PLAYLICK.create_playlist({
            name: podcast.title
        });
        $.each(trackList, function (i, data) {
            var trackDoc = {
                name: data.title,
                artist: data.author
            };
            if (data.enclosure && data.enclosure.url) {
                trackDoc.url = data.enclosure.url;
            }
            playlist.add_track(new MODELS.Track(trackDoc));
        });
        playlist.save();
        return playlist;
    },
    defaultExceptionHandler: function (exception) {
        if (PLAYLICK.debug) {
            console.warn(exception);
            exception.diagnose();
        }
    },
    checkResponse: function (json, exception) {
        if (!json) {
            throw exception('No JSON', this.url);
        }
        if (json.error) {
            throw exception(json.error.description, json);
        }
    }
};
(function () {
function Exception (message, diagnostics) {
    this.message = message;
    this.diagnostics = diagnostics;
};
Exception.prototype = {
    name: 'Exception',
    toString: function () {
        return this.name + ': ' + this.message;
    },
    diagnose: function () {
        if (this.diagnostics) {
            if (typeof(this.diagnostics) == 'string') {
                console.log(this.diagnostics);
            } else {
                console.dir(this.diagnostics);
            }
        }
    }
};
function partialException (exception) {
    if (!exception.message) {
        return function finalise (message, diagnostics) {
            exception.message = message;
            exception.diagnostics = diagnostics;
            return exception;
        };
    }
    return exception;
}

var Url = {};
Url.Exception = function (url, message, diagnostics) {
    this.url = url;
    this.message = message;
    this.diagnostics = diagnostics;
    return partialException(this);
};
Url.Exception.prototype = new Exception;
Url.Exception.prototype.name = 'UrlException';
Url.Exception.prototype.toString = function () {
    return this.name + ': ' + this.message + ' (' + this.url + ')';
};
Url.XspfException = Url.Exception;
Url.XspfException.prototype.name = 'UrlXspfException';
Url.PodcastException = Url.Exception;
Url.PodcastException.prototype.name = 'UrlPodcastException';
Url.xspf = function (url, callback, exceptionHandler) {
    var exception = new Url.XspfException(url);
    IMPORTERS.getJsonFomXml(url, function (json) {
        var jspf = json.query.results.lfm ? json.query.results.lfm.playlist : json.query.results.playlist;
        if (!jspf) {
            throw exception('Invalid XSPF', json.query.results);
        }
        var metadata = {
            description: jspf.annotation,
            image: jspf.image
        };
        var playlist = IMPORTERS.createPlaylistFromJspf(jspf, metadata, exception);
        if (callback) {
            callback(playlist);
        }
    }, exception, exceptionHandler);
};
Url.podcast = function (url, callback, exceptionHandler) {
    var exception = new Url.XspfException(url);
    IMPORTERS.getJsonFomXml(url, function (json) {
        var podcast = json.query.results.rss.channel;
        if (!podcast) {
            throw exception('Invalid Podcast', json.query.results);
        }
        var playlist = IMPORTERS.createPlaylistFromPodcast(podcast, exception);
        if (callback) {
            callback(playlist);
        }
    }, exception, exceptionHandler);
};
var Spotify = {
    LOOKUP_ROOT: "http://ws.spotify.com/lookup/1/?uri="
};
Spotify.Exception = function (url, message, diagnostics) {
    this.url = url;
    this.message = message;
    this.diagnostics = diagnostics;
    return partialException(this);
};
Spotify.Exception.prototype = new Exception;
Spotify.Exception.prototype.name = 'SpotifyException';
Spotify.Exception.prototype.toString = function () {
    return this.name + ': ' + this.message + ' (' + this.url + ')';
};
Spotify.AlbumException = Spotify.Exception;
Spotify.AlbumException.prototype.name = 'SpotifyAlbumException';
Spotify.TrackException = Spotify.Exception;
Spotify.TrackException.prototype.name = 'SpotifyTrackException';

Spotify.album = function (url, callback, exceptionHandler) {
    var albumLookupUrl = Spotify.LOOKUP_ROOT + url + '&extras=trackdetail';
    var exception = new Spotify.AlbumException(url);
    IMPORTERS.getJsonFomXml(albumLookupUrl, function (json) {
        if (!json.query.results.album) {
            throw exception('No album', json);
        }
        var album = json.query.results.album;
        if (!album.artist || !album.name) {
            throw exception('Invalid album', album);
        }
        var trackList = $.makeArray(album.tracks.track);
        if (!trackList.length) {
            throw exception('No tracks', album);
        }
        var playlist = PLAYLICK.create_playlist({
            name: (album.artist.name || album.artist[0].name) + ' - ' + album.name
        });
        $.each(trackList, function (i, trackData) {
            if (trackData.name && trackData.artist) {
                var trackDoc = {
                    name: trackData.name,
                    artist: trackData.artist.name || trackData.artist[0].name,
                    album: album.name,
                    duration: Math.round(trackData.length)
                };
                if (trackData.href) {
                    trackDoc.url = trackData.href;
                }
                playlist.add_track(new MODELS.Track(trackDoc));
            }
        });
        playlist.description = url;
        playlist.save();
        if (callback) {
            callback(playlist);
        }
    }, exception, exceptionHandler);
};
Spotify.track = function (url, callback, exceptionHandler) {
    var trackLookupUrl = Spotify.LOOKUP_ROOT + url;
    var exception = new Spotify.TrackException(url);
    IMPORTERS.getJsonFomXml(trackLookupUrl, function (json) {
        if (!json.query || !json.query.results || !json.query.results.track) {
            throw exception('No track', json);
        }
        var track = json.query.results.track;
        if (!track.artist || !track.name) {
            throw exception('Invalid track', album);
        }
        var playlist = PLAYLICK.create_playlist();
        var trackDoc = {
            name: track.name,
            artist: track.artist.name || track.artist[0].name,
            album: track.album.name,
            duration: Math.round(track.length)
        };
        if (track.href) {
            trackDoc.url = track.href;
        }
        playlist.add_track(new MODELS.Track(trackDoc));
        playlist.save();
        if (callback) {
            callback(playlist);
        }
    }, exception, exceptionHandler);
};
var LastFm = {
    API_KEY: "b25b959554ed76058ac220b7b2e0a026",
    WS_ROOT: "http://ws.audioscrobbler.com"
};
LastFm.Exception = function (signature, message, diagnostics) {
    this.signature = signature;
    this.message = message;
    this.diagnostics = diagnostics;
    return partialException(this);
};
LastFm.Exception.prototype = new Exception;
LastFm.Exception.prototype.name = 'LastFmException';
LastFm.Exception.prototype.toString = function () {
    return this.name + ': ' + this.message + ' (' + this.signature + ')';
};
LastFm.getJson = function (method, params, callback, exception, exceptionHandler) {
    var params = params || {};
    params.method = method;
    IMPORTERS.getJson(LastFm.WS_ROOT + "/2.0/?callback=?", $.extend(params, {
        api_key: LastFm.API_KEY,
        format: 'json'
    }), callback, exception, exceptionHandler);
};
LastFm.generateSignature = function (method, params) {
    var signature = method;
    var params = params || {};
    for (k in params) {
        signature += " --" + k + "=" + encodeURIComponent(params[k]);
    }
    return signature;
};
LastFm.getPlaylist = function (url, metadata, callback, exceptionHandler) {
    var method = "playlist.fetch";
    var params = {
        playlistURL: url
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        var playlist = IMPORTERS.createPlaylistFromJspf(json.playlist, metadata, exception);
        if (callback) {
            callback(playlist);
        }
    }, exception, exceptionHandler);
};
LastFm.userPlaylists = function (user, callback, exceptionHandler, noPlaylistHandler) {
    var method = "user.getplaylists";
    var params = {
        user: user
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        if (!json.playlists) {
            throw exception('No playlists in response', json);
        }
        if (!json.playlists.playlist) {
            return noPlaylistHandler();
        }

        var playlists = $.makeArray(json.playlists.playlist);
        var importedPlaylists = {};
        function playlistDone (processedUrl, playlist) {
            for (url in importedPlaylists) {
                if (importedPlaylists[url] === false) {
                    return;
                }
            }
            callback(importedPlaylists);
        }
        $.each(playlists, function (i, data) {
            var url = "lastfm://playlist/" + data.id;
            importedPlaylists[url] = false;
            var metadata = {
                description: data.description
            };
            var image = $.grep(data.image, function (value, i) {
                return value.size == 'medium';
            });
            if (image[0]) {
                metadata.image = image[0]['#text'];
            }
            LastFm.getPlaylist(
                url,
                metadata,
                function playlistCallback (playlist) {
                    importedPlaylists[url] = playlist;
                    playlistDone(url, playlist);
                },
                function playlistExceptionHandler (exception) {
                    importedPlaylists[url] = exception;
                    playlistDone(url, exception);
                }
            );
        });
    }, exception, exceptionHandler);
};
LastFm.lovedTracks = function (user, callback, exceptionHandler) {
    var method = "user.getLovedTracks";
    var params = {
        user: user
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        if (!json.lovedtracks || !json.lovedtracks.track) {
            throw exception('No loved tracks in response', json);
        }
        var trackList = $.makeArray(json.lovedtracks.track);
        if (!trackList.length) {
            throw exception('No loved tracks', jspf.trackList);
        }
        var playlist = PLAYLICK.create_playlist({
            name: 'Loved tracks for ' + json.lovedtracks['@attr'].user
        });
        $.each(trackList, function (i, data) {
            var trackDoc = {
                name: data.name,
                artist: data.artist.name
            };
            playlist.add_track(new MODELS.Track(trackDoc));
        });
        playlist.save();
        if (callback) {
            callback(playlist);
        }
    }, exception, exceptionHandler);
};
LastFm.album = function (artist, album, callback, exceptionHandler) {
    var method = "album.getInfo";
    var params = {
        artist: artist,
        album: album
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        if (!json.album) {
            throw exception('No album data', json);
        }
        var url = "lastfm://playlist/album/" + json.album.id;
        var metadata = {};
        var image = $.grep(json.album.image, function (value, i) {
            return value.size == 'medium';
        });
        if (image[0]) {
            metadata.image = image[0]['#text'];
        }
        LastFm.getPlaylist(url, metadata, callback, exceptionHandler);
    }, exception, exceptionHandler);
};

    IMPORTERS.Url = Url;
    IMPORTERS.Spotify = Spotify;
    IMPORTERS.LastFm = LastFm;
})();
