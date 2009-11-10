IMPORTERS = {
    /**
     * getJson(url, params, callback, exception[, exceptionHandler])
     * - url (String): URL to a JSON document
     * - params (Object): Query parameters for the URL
     * - callback(JSON) (Function): Function to be called if the request successfully completes.
     *      Takes a JSON object as its only argument
     * - exception (Exception): Partially initialised exception object to be thrown on error
     * - exceptionHandler(exception) (Function): Function to be called on error
     *      Takes an exception object as its only argument
     * 
     * Wraps jQuery.getJSON with response, exception and timeout handling.
    **/
    getJson: function (url, params, callback, exception, exceptionHandler) {
        var params = params || {};
        var exceptionHandler = exceptionHandler || IMPORTERS.defaultExceptionHandler;
        // Setup a 2 second timeout for the JSONP request
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
            // Cancel the timeout
            clearTimeout(callTimeout);
            // Check the response, call the callback and handle any exceptions
            try {
                IMPORTERS.checkResponse.call(this, json, exception);
                callback.call(this, json);
            } catch (e) {
                exceptionHandler(e);
            }
        });
    },
    /**
     * getJsonFomXml(url, callback, exception[, exceptionHandler])
     * - url (String): URL to an XML document to be converted to JSON
     * - callback(JSON) (Function): Function to be called if the request successfully completes.
     *      Takes a JSON object as its only argument
     * - exception (Exception): Partially initialised exception object to be thrown on error
     * - exceptionHandler(exception) (Function): Function to be called on error
     *      Takes an exception object as its only argument
     * 
     * Fetches a JSON response from a URL to an XML document using YQL
     * http://developer.yahoo.com/yql/
    **/
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
    /**
     * createPlaylistFromJspf(jspf, metadata, exception) -> MODELS.Playlist
     * - jspf (Object): JSON object representation of an XSPF
     * - metadata (Object): Extra metadata about the playlist
     * - exception (Exception): Partially initialised exception object to be thrown on error
     * 
     * Creates a playlist from a JSON representation of an XSPF. A JSPF if you will.
    **/
    createPlaylistFromJspf: function (jspf, metadata, exception) {
        if (!jspf.trackList || !jspf.trackList.track) {
            throw exception('No tracks in JSPF response', jspf);
        }
        var metadata = metadata || {};
        // XML to JSON converters often return single item lists as single items
        var trackList = $.makeArray(jspf.trackList.track);
        if (!trackList.length) {
            throw exception('No tracks in JSPF', jspf.trackList);
        }
        // Create the playlist
        var playlist = PLAYLICK.create_playlist({
            name: jspf.title
        });
        // Load tracks
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
        // Save metadata
        playlist.image = metadata.image;
        playlist.description = metadata.description;
        playlist.save();
        return playlist;
    },
    createPlaylistFromPodcast: function (podcast, exception) {
        if (!podcast.item) {
            throw exception('No tracks in Podcast response', podcast);
        }
        // XML to JSON converters often return single item lists as single items
        var trackList = $.makeArray(podcast.item);
        if (!trackList.length) {
            throw exception('No tracks in Podcast', jspf.trackList);
        }
        // Create the playlist
        var playlist = PLAYLICK.create_playlist({
            name: podcast.title
        });
        // Load tracks
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
        // Save
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
        /**
         * Exception#diagnose()
         * Log diagnostics to the console
        **/
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
    /**
     * partialException allows a constructor to return a finalise function instead of the Exception.
     * This function takes a message and optional diagnostic object as arguments, and when called
     * returns the Exception object.
     * This allows you to setup a partial exception that can later be thrown with different error messages.
     * If you pass a message into the constructor, it returns the object straightaway.
     * 
     * e.g.
     * // Prepare exception
     * var exception = new Exception();
     * ...
     * // Throw exception, adding extra info
     * throw exception('Call exception', call);
    **/
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
    
    /**
     * Url
     * Methods and Exceptions for importing playlists from HTTP URLs
    **/
    var Url = {};
    /**
     * class Url.Exception < Exception
     * 
     * new Url.Exception(url[, message][, diagnostics]) -> Function(message[, diagnostics])
     * - url (String): URL
     * - message (String): Error message that describes the exception
     * - diagnostics (Object): Any object that might aid in diagnosing the exception
     * 
     * Base class for URL import exceptions.
     * The constructor takes a URL and uses the partialException pattern
     * 
     * Available subclasses:
     * Url.XspfException
     * Url.PodcastException
    **/
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
    /**
     * class Url.XspfException < Url.Exception
     * class Url.PodcastException < Url.Exception
    **/
    Url.XspfException = Url.Exception;
    Url.XspfException.prototype.name = 'UrlXspfException';
    Url.PodcastException = Url.Exception;
    Url.PodcastException.prototype.name = 'UrlPodcastException';
    /**
     * Url.xspf(url[, callback][, exceptionHandler])
     * - url (String): URL to import the playlist from
     * - callback(playlist) (Function): Function to be called if a playlist is successfully created
     *      Takes the playlist object as the only argument
     * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
     *      Takes the exception object as the only argument
     * 
     * Creates a playlist from an XSPF URL
    **/
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
    /**
     * Url.podcast(url[, callback][, exceptionHandler])
     * - url (String): URL to import the playlist from
     * - callback(playlist) (Function): Function to be called if a playlist is successfully created
     *      Takes the playlist object as the only argument
     * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
     *      Takes the exception object as the only argument
     * 
     * Creates a playlist from a Podcast URL
    **/
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
    // Expose
    IMPORTERS.Url = Url;
    
    
    /**
     * Spotify
     * Methods and Exceptions for importing playlists from the Spotify Lookup API
     * http://developer.spotify.com/en/metadata-api/lookup/
    **/
    var Spotify = {
        LOOKUP_ROOT: "http://ws.spotify.com/lookup/1/?uri="
    };
    /**
     * class Spotify.Exception < Exception
     * 
     * new Spotify.Exception(url[, message][, diagnostics]) -> Function(message[, diagnostics])
     * - url (String): Spotify URL that lead to the exception
     * - message (String): Error message that describes the exception
     * - diagnostics (Object): Any object that might aid in diagnosing the exception
     * 
     * Base class for Spotify import exceptions
     * The constructor takes a Spotify URL and uses the partialException pattern.
     * 
     * Available subclasses:
     * Spotify.AlbumException
     * Spotify.TrackException
    **/
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
    /**
     * class Spotify.AlbumException < Spotify.Exception
     * class Spotify.TrackException < Spotify.Exception
    **/
    Spotify.AlbumException = Spotify.Exception;
    Spotify.AlbumException.prototype.name = 'SpotifyAlbumException';
    Spotify.TrackException = Spotify.Exception;
    Spotify.TrackException.prototype.name = 'SpotifyTrackException';
    
    /**
     * Spotify.album(url[, callback][, exceptionHandler])
     * - url (String): Spotify album URL to lookup metadata for
     * - callback(playlist) (Function): Function to be called if a playlist is successfully created
     *      Takes the playlist object as the only argument
     * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
     *      Takes the exception object as the only argument
     * 
     * Creates a playlist from a Spotify album URL retrieved from the Lookup API with extras=trackdetail
     * http://developer.spotify.com/en/metadata-api/lookup/album/
    **/
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
            // XML to JSON converters often return single item lists as single items
            var trackList = $.makeArray(album.tracks.track);
            if (!trackList.length) {
                throw exception('No tracks', album);
            }
            // Create the playlist
            var playlist = PLAYLICK.create_playlist({
                name: album.artist.name + ' - ' + album.name
            });
            // Load tracks
            $.each(trackList, function (i, trackData) {
                if (trackData.name && trackData.artist) {
                    var trackDoc = {
                        name: trackData.name,
                        artist: trackData.artist.name,
                        album: album.name,
                        duration: Math.round(trackData.length)
                    };
                    if (trackData.href) {
                        trackDoc.url = trackData.href;
                    }
                    playlist.add_track(new MODELS.Track(trackDoc));
                }
            });
            // Save metadata
            playlist.description = url;
            playlist.save();
            if (callback) {
                callback(playlist);
            }
        }, exception, exceptionHandler);
    };
    /**
     * Spotify.track(url[, callback][, exceptionHandler])
     * - url (String): Spotify track URL to lookup metadata for
     * - callback(playlist) (Function): Function to be called if a playlist is successfully created
     *      Passed the playlist object as the only argument
     * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
     *      Passed the exception object as the only argument
     * 
     * Creates a playlist from a Spotify track URL retrieved from the Lookup API
     * http://developer.spotify.com/en/metadata-api/lookup/track/
    **/
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
            // Create a playlist
            var playlist = PLAYLICK.create_playlist();
            var trackDoc = {
                name: track.name,
                artist: track.artist.name,
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
    // Expose
    IMPORTERS.Spotify = Spotify;
    
    
    /**
     * Last.fm
     * Methods and Exceptions for importing playlists from the Last.fm API
     * http://www.last.fm/api
    **/
    var LastFm = {
        API_KEY: "b25b959554ed76058ac220b7b2e0a026",
        WS_ROOT: "http://ws.audioscrobbler.com"
    };
    /**
     * class LastFm.Exception < Exception
     * 
     * new LastFm.Exception(signature[, message][, diagnostics]) -> Function(message[, diagnostics])
     * - signature (String): Last.fm API method signature that lead to the exception
     * - message (String): Error message that describes the exception
     * - diagnostics (Object): Any object that might aid in diagnosing the exception
     * 
     * Base class for Last.fm import exceptions.
     * The constructor takes a Last.fm method signature and uses the partialException pattern
    **/
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
    /**
     * LastFm.getJson(method, params, callback, exception[, exceptionHandler])
     * - method (String): Last.fm API method
     * - params (Object): Parameters needed for this method call
     * - callback(JSON) (Function): Function to be called if the request successfully completes.
     *      Takes a JSON object as its only argument
     * - exception (Exception): Partially initialised exception object to be thrown on error
     * - exceptionHandler(exception) (Function): Function to be called on error
     *      Takes an exception object as its only argument
     * 
     * Wraps getJson with Last.fm specifics
    **/
    LastFm.getJson = function (method, params, callback, exception, exceptionHandler) {
        var params = params || {};
        params.method = method;
        IMPORTERS.getJson(LastFm.WS_ROOT + "/2.0/?callback=?", $.extend(params, {
            api_key: LastFm.API_KEY,
            format: 'json'
        }), callback, exception, exceptionHandler);
    };
    /**
     * LastFm.generateSignature(method[, params]) -> String
     * - method (String): Last.fm API method
     * - params (Object): Parameters needed for this method call
     * 
     * Generates a method signature for a Last.fm API call
     * 
     * e.g.
     * LastFm.generateSignature('track.getInfo', { artist: 'James Wheare', track: 'Take Control' });
     * -> 'user.getInfo --artist=James%20Wheare --track=Take%20Control'
    **/
    LastFm.generateSignature = function (method, params) {
        var signature = method;
        var params = params || {};
        for (k in params) {
            signature += " --" + k + "=" + encodeURIComponent(params[k]);
        }
        return signature;
    };
    /**
     * LastFm.getPlaylist(url[, callback][, exceptionHandler])
     * 
     * Imports a playlist URL from Last.fm
     * http://www.last.fm/api/playlists
     * http://www.last.fm/api/show?service=271
    **/
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
    /**
     * LastFm.userPlaylists(user[, callback][, exceptionHandler][, noPlaylistHandler])
     * - user (String): Last.fm username to fetch playlists for
     * - callback(playlist) (Function): Function to be called for each playlist that's successfully created
     *      Takes the playlist object as the only argument
     * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
     *      Takes the exception object as the only argument
     * - noPlaylistHandler() (Function): Function to be called when the user has no playlists
     * 
     * Imports user playlists from Last.fm
     * http://www.last.fm/api/show?service=313
    **/
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
            
            // Last.fm APIs return single item lists as single items
            var playlists = $.makeArray(json.playlists.playlist);
            var importedPlaylists = {};
            // Callback to loop through importedPlaylists to check if we're still waiting for results
            // called on LastFm.getPlaylist success and failure
            function playlistDone (processedUrl, playlist) {
                for (url in importedPlaylists) {
                    if (importedPlaylists[url] === false) {
                        return;
                    }
                }
                // All playlists are processed, call the LastFm.userPlaylists callback
                callback(importedPlaylists);
            }
            // Create a playlist for each in the API response
            // Requires a separate call to LastFm.getPlaylist for each
            $.each(playlists, function (i, data) {
                var url = "lastfm://playlist/" + data.id;
                importedPlaylists[url] = false;
                // Extract other metadata from playlist info
                var metadata = {
                    description: data.description
                };
                var image = $.grep(data.image, function (value, i) {
                    return value.size == 'medium';
                });
                if (image[0]) {
                    metadata.image = image[0]['#text'];
                }
                // Fetch the tracklist
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
    /**
     * LastFm.lovedTracks(user[, callback][, exceptionHandler])
     * - user (String): User to get loved tracks for
     * - callback(playlist) (Function): Function to be called once the loved tracks playlist has been created
     *      Takes the playlist object as the only argument
     * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
     *      Takes the exception object as the only argument
     * 
     * Import a user's loved tracks from Last.fm
     * http://www.last.fm/api/show?service=329
    **/
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
            // XML to JSON converters often return single item lists as single items
            var trackList = $.makeArray(json.lovedtracks.track);
            if (!trackList.length) {
                throw exception('No loved tracks', jspf.trackList);
            }
            // Create the playlist
            var playlist = PLAYLICK.create_playlist({
                name: 'Loved tracks for ' + json.lovedtracks['@attr'].user
            });
            // Load tracks
            $.each(trackList, function (i, data) {
                var trackDoc = {
                    name: data.name,
                    artist: data.artist.name
                };
                playlist.add_track(new MODELS.Track(trackDoc));
            });
            // Save
            playlist.save();
            if (callback) {
                callback(playlist);
            }
        }, exception, exceptionHandler);
    };
    /**
     * LastFm.album(artist, album[, callback][, exceptionHandler])
     * - artist (String): Artist who authored the album
     * - album (String): Album name
     * - callback(playlist) (Function): Function to be called once the album playlist has been created
     *      Takes the playlist object as the only argument
     * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
     *      Takes the exception object as the only argument
     * 
     * Import an Album playlist from Last.fm
     * http://www.last.fm/api/show?service=290
    **/
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
            // Extract other metadata from album info
            var metadata = {};
            var image = $.grep(json.album.image, function (value, i) {
                return value.size == 'medium';
            });
            if (image[0]) {
                metadata.image = image[0]['#text'];
            }
            // Fetch the album tracklist
            LastFm.getPlaylist(url, metadata, callback, exceptionHandler);
        }, exception, exceptionHandler);
    };
    // Expose
    IMPORTERS.LastFm = LastFm;
})();