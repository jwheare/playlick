/**
 * MODELS
 * Model namespace
**/
var MODELS = {
    couch: new CouchDB('playlick'),
    couch_up: true,
    next_playlist_id: 0,
    next_playlist_track_id: 0,
    couch_down_handler: function (action, result) {
        MODELS.couch_up = false;
        var message = "couchdb unavailable";
        if (result.error && result.error != 'unknown') {
            message = result.error+': '+result.reason;
        }
        // console.warn('['+action+'] '+message);
    }
};
(function () {
    /**
     * class MODELS.Track
     * Track objects have a name, artist and duration
    **/
    var Track = function (name, artist, duration) {
        this.name = name;
        this.artist = artist;
        this.duration = duration;
        this.playdar_qid = null;
        this.playdar_sid = null;
        this.playdar_response = null;
        this.playdar_url = null;
    };
    Track.prototype = {
        get_duration_string: function () {
            if (typeof this.duration != 'undefined') {
                return Playdar.Util.mmss(this.duration);
            }
            return '';
        },
        toString: function () {
            var duration = this.get_duration_string();
            if (duration) {
                duration = ' (' + duration + ')';
            }
            return this.name + ' - ' + this.artist + duration;
        },
        toHTML: function () {
            var duration = this.get_duration_string();
            if (duration) {
                duration = ' (<span class="duration">' + duration + '</span>)';
            }
            return '<span class="haudio">'
                + '<span class="fn">' + this.name + '</span>'
                + ' - '
                + '<span class="contributor">' + this.artist + '</span>'
                + duration;
        },
        get_doc: function () {
            var doc = {
                name: this.name,
                artist: this.artist
            };
            return doc;
        }
    };
    
    /**
     * class MODELS.Playlist
     * Playlist objects have a name, array of Tracks and duration
    **/
    var Playlist = function (options) {
        this.saved = false;
        this.persisted = false;
        this.published = false;
        this.tracks = [];
        this.duration = 0;
        
        this.options = options || {};
        if (this.options.doc_ref) {
            // Update the ref values
            this.set_doc_ref(this.options.doc_ref);
        } else {
            // Get a new UUID
            if (MODELS.couch_up) {
                try {
                    this.set_id(CouchDB.newUuids(1)[0]);
                } catch (result) {
                    MODELS.couch_down_handler('uuid', result);
                }
            }
            if (!MODELS.couch_up) {
                this.set_id(MODELS.next_playlist_id++);
            }
        }
        this.name = this.options.name || "Playlist: " + new Date().toLocaleString();
        
        // Create the DOM element
        this.set_element(this.options.dom_element);
    };
    Playlist.prototype = {
        /**
         * State management
        **/
        add_track: function (track, options) {
            var playlist_track = new PlaylistTrack(this, track, options);
            this.tracks.push(playlist_track);
            return playlist_track;
        },
        remove_track: function (playlist_track, onSave) {
            var i = $.inArray(playlist_track, this.tracks);
            this.tracks.splice(i, 1);
            // AUTOSAVE
            this.save(function () {
                // Remove from the DOM
                playlist_track.element.remove();
            });
        },
        reset_tracks: function (playlist_tracks, onSave) {
            this.tracks = playlist_tracks;
            // AUTOSAVE
            this.save(onSave);
        },
        /**
         * MODELS.Playlist->_rebuild()
         * Update track positions and playlist duration
        **/
        _rebuild: function () {
            var duration = 0;
            $.each(this.tracks, function (i, playlist_track) {
                playlist_track.position = i + 1;
                if (typeof playlist_track.track.duration != 'undefined') {
                    duration += playlist_track.track.duration;
                }
            });
            this.duration = duration;
        },
        /**
         * Playlist management
        **/
        set_name: function (name, onSave) {
            this.name = name;
            // AUTOSAVE
            this.save(onSave);
        },
        get_duration: function () {
            return Playdar.Util.mmss(this.duration);
        },
        toString: function () {
            var duration = this.get_duration();
            if (duration) {
                duration = ' (' + duration + ')';
            }
            return this.name + duration;
        },
        /**
         * Build a DOMElement for the Playlist
        **/
        set_element: function (element_name) {
            var element_name = element_name || 'li';
            this.element = $(
                '<' + element_name + ' class="p" id="' + this.get_dom_id() + '">'
              + '</' + element_name + '>'
            ).data('playlist', this).html(this.toHTML());
        },
        get_dom_id: function () {
            return "p_" + this.get_id();
        },
        toHTML: function () {
            return this.toString();
        },
        get_urls: function () {
            var urls = [];
            $.each(this.tracks, function (i, playlist_track) {
                if (playlist_track.track.playdar_url) {
                    urls.push(playlist_track.track.playdar_url);
                }
            });
            return urls;
        },
        /**
         * Track accessors
        **/
        get_track_by_id: function (playlist_track_id) {
            var that = this;
            $.each(this.tracks, function (i, playlist_track) {
                if (playlist_track.id == playlist_track_id) {
                    return false;
                }
            });
            return playlist_track;
        },
        get_track_at_position: function (position) {
            var i = position - 1;
            return this.tracks[i];
        },
        /**
         * Persistance
        **/
        onSave: function (callback) {
            if (!this.persisted && this.options.onCreate) {
                this.options.onCreate.call(this);
            }
            if (callback) {
                callback.call(this);
            }
            if (this.options.onSave) {
                this.options.onSave.call(this);
            }
            this.saved = true;
        },
        save: function (callback) {
            this._rebuild();
            
            // Persist in CouchDB
            if (MODELS.couch_up) {
                try {
                    var result = MODELS.couch.save(this.get_doc());
                    // console.dir(result);
                    if (result.ok) {
                        this.set_doc_ref(result);
                        this.onSave(callback);
                        // console.info('[saved] ' + result.id + ' [' + result.rev + ']');
                    }
                } catch (result) {
                    MODELS.couch_down_handler('save', result);
                }
            }
            if (!MODELS.couch_up && !this.persisted) {
                this.onSave(callback);
            }
        },
        onRemove: function () {
            // Remove from the DOM
            this.element.remove();
            // onDelete Callback
            if (this.options.onDelete) {
                this.options.onDelete.call(this);
            }
        },
        remove: function () {
            if (MODELS.couch_up) {
                try {
                    var result = MODELS.couch.deleteDoc(this.get_doc_ref());
                    // console.dir(result);
                    if (result.ok) {
                        this.onRemove();
                        // console.info('[delete] ' + result.id + ' [' + result.rev + ']');
                    }
                } catch (result) {
                    MODELS.couch_down_handler('delete', result);
                }
            }
            if (!MODELS.couch_up && !this.persisted) {
                this.onRemove();
            }
        },
        publish: function (onSave) {
            this.published = true;
            // AUTOSAVE
            this.save(onSave);
        },
        make_private: function (onSave) {
            this.published = false;
            // AUTOSAVE
            this.save(onSave);
        },
        share: function (person) {
            // TODO
            // Fire off AJAX request to share Playlist with email address or user
        },
        /**
         * CouchDB Representation
        **/
        set_id: function (id) {
            this._id = id;
        },
        get_id: function () {
            return this._id;
        },
        set_rev: function (rev) {
            this._rev = rev;
        },
        get_rev: function () {
            return this._rev;
        },
        set_doc_ref: function (doc_ref) {
            this.set_id(doc_ref.id);
            this.set_rev(doc_ref.rev);
            this.persisted = true;
        },
        get_doc_ref: function () {
            var doc_ref = {
                _id: this.get_id(),
                _rev: this.get_rev()
            };
            return doc_ref;
        },
        get_doc: function () {
            var doc = $.extend(this.get_doc_ref(), {
                name: this.name,
                duration: this.duration,
                published: this.published,
                tracks: $.map(this.tracks, function (playlist_track, i) {
                    return playlist_track.get_doc();
                })
            });
            return doc;
        }
    };
    
    /**
     * class MODELS.PlaylistTrack
     * PlaylistTrack objects join a Playlist with a Track
     * and have a position and element
    **/
    var PlaylistTrack = function (playlist, track, options) {
        this.id = MODELS.next_playlist_track_id++;
        this.playlist = playlist;
        this.track = track;
        
        this.options = options || {};
        
        // Create the dom element
        this.set_element(this.options.dom_element);
    };
    PlaylistTrack.prototype = {
        remove: function () {
            // Update playlist state
            this.playlist.remove_track(this);
        },
        /**
         * Build a DOMElement for the PlaylistTrack
        **/
        set_element: function (element_name) {
            var element_name = element_name || 'li';
            this.element = $(
                '<' + element_name + ' class="p_t" id="' + this.get_dom_id() + '">'
              + '</' + element_name + '>'
            ).data('playlist_track', this).html(this.track.toHTML());
        },
        get_dom_id: function () {
            return "p_t_" + this.playlist.get_id() + '_' + this.id;
        },
        get_position: function () {
            return $.inArray(this, this.playlist.tracks) + 1;
        },
        get_doc: function () {
            var doc = {
                position: this.position,
                track: this.track.get_doc()
            };
            return doc;
        }
    };
    
    MODELS.Track = Track;
    MODELS.Playlist = Playlist;
    MODELS.PlaylistTrack = PlaylistTrack;
})();