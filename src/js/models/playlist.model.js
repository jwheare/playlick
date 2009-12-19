/**
 * class MODELS.Playlist
 * Playlist objects have an array of PlaylistTracks, and associated metadata
**/
function Playlist (options) {
    this.saved = false;
    this.persisted = false;
    this.published = false;
    this.tracks = [];
    
    this.options = options || {};
    
    // If ref values were passed in, set them
    if (this.set_doc_ref(this.options._id, this.options._rev)) {
        this.persisted = true;
    } else {
        // Otherwise get a new UUID
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
    this.date = this.options.date ? new Date(this.options.date) : new Date();
    this.setOption('type', 'playlist');
    this.setOption('artist');
    this.setOption('album');
    this.setOption('title');
    this.setOption('image');
    this.setOption('subtitle');
    this.setOption('description');
    this.setOption('url');
    this.setOption('copyright');
    this.setOption('source');
    this.setOption('subscription');
    this.addOptions(Playlist.DefaultOptions);
    
    // Create the DOM element
    this.set_element(this.options.dom_element);
};
// Override this
Playlist.DefaultOptions = {};
Playlist.prototype = {
    setOption: function (optionName, defaultValue) {
        if (defaultValue === undefined) {
            defaultValue = '';
        }
        this[optionName] = this.options[optionName] || defaultValue;
    },
    addOptions: function (options) {
        $.extend(this.options, options);
    },
    /**
     * State management
    **/
    add_track: function (track, options) {
        var playlist_track = new PlaylistTrack(this, track, options);
        this.tracks.push(playlist_track);
        return playlist_track;
    },
    remove_track: function (playlist_track) {
        var i = $.inArray(playlist_track, this.tracks);
        this.tracks.splice(i, 1);
        // Refactor view
        playlist_track.element.remove();
        // AUTOSAVE
        this.save();
    },
    reset_tracks: function (playlist_tracks) {
        this.tracks = playlist_tracks;
        // AUTOSAVE
        this.save();
    },
    /**
     * Playlist management
    **/
    isAlbum: function () {
        return this.type == 'album';
    },
    isSubscription: function () {
        return this.type == 'subscription' && this.subscription;
    },
    isIncrementalSubscription: function () {
        return this.isSubscription() && this.subscription.incremental === true;
    },
    isEditable: function () {
        return !this.isAlbum() && !this.isSubscription();
    },
    albumToString: function () {
        return this.artist + ' - ' + this.album;
    },
    toString: function () {
        if (this.title) {
            return this.title;
        }
        if (this.isAlbum()) {
            return this.albumToString();
        }
        return "Playlist: " + this.date.toLocaleString();
    },
    /**
     * Fetch tracks from Couch
    **/
    fetchTracks: function () {
        if (!this.tracks.length) {
            try {
                var response = MODELS.couch.view("playlist/all", {
                    "key": this._id
                });
                MODELS.couch_up_handler('fetchTracks', response);
                var row = response.rows[0];
                var value = row.value;
                // Load tracks
                var playlist = this;
                var elements = $.map(value.tracks, function (track_data, i) {
                    var playlist_track = playlist.add_track(new MODELS.Track(track_data.track));
                    // Build DOM element
                    return playlist_track.element.get();
                });
                return elements;
            } catch (result) {
                MODELS.couch_down_handler('fetchTracks', result);
            }
        }
    },
    getTrackHash: function () {
        this.fetchTracks();
        var hash = {};
        var track, key;
        $.each(this.tracks, function (i, playlist_track) {
            hash[playlist_track.track.getDiffKey()] = playlist_track;
        });
        return hash;
    },
    /**
     * Load tracks to the DOM, fetching from Couch if needed
    **/
    load: function () {
        var elements;
        if (!this.tracks.length) {
            // Fetch from Couch
            elements = this.fetchTracks();
        } else {
            // Already fetched, just build DOM elements
            elements = this.loadDom();
        }
        return elements;
    },
    /**
     * Load and unload PlaylistTracks from the DOM
    **/
    loadDom: function () {
        var elements = $.map(this.tracks, function (playlist_track, i) {
            return playlist_track.load().get();
        });
        return elements;
    },
    unload: function () {
        // Remove all tracks from the DOM
        $.each(this.tracks, function (i, playlist_track) {
            playlist_track.unload();
        });
        if (this.options.onUnload) {
            this.options.onUnload.call(this);
        }
    },
    /**
     * Build a DOMElement for the Playlist
    **/
    set_element: function (element_name) {
        element_name = element_name || 'li';
        this.element = $('<' + element_name + ' class="p">')
            .attr('id', this.get_dom_id())
            .data('playlist', this)
            .html(this.toHTML());
    },
    get_dom_id: function () {
        return "p_" + this.get_id();
    },
    toHTML: function () {
        return this.toString();
    },
    /**
     * Build an applescript for exporting to iTunes
    **/
    toApplescript: function () {
        var track_records = $.map(this.tracks, function (playlist_track, i) {
            return '{'
                + 'artist: "' + playlist_track.track.artist.replace(/"/g, '\\"') + '",'
                + 'track: "' + playlist_track.track.name.replace(/"/g, '\\"') + '"'
                + '}';
        });
        var applescript = 'set playlist_name to "' + this.toString() + '"\n'
        + 'tell application "iTunes"\n'
        + '    set new_playlist to (make playlist with properties {name:playlist_name})\n'
        + '    set l to source "Library"\n'
        + '    set tracks_to_search to {'
               + track_records.join(',')
            + '}\n'
        + '    repeat with t in tracks_to_search\n'
        + '        duplicate ('
                   + 'every file track of l '
                   + 'whose artist contains (artist of t) '
                   + 'and name contains (track of t)'
                + ') to new_playlist\n'
        + '    end repeat\n'
        + '    reveal new_playlist\n'
        + '    activate\n'
        + 'end tell';
        return "applescript://com.apple.scripteditor?action=new&script=" + encodeURIComponent(applescript);
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
    onSave: function () {
        if (!this.persisted && this.options.onCreate) {
            this.options.onCreate.call(this);
        }
        if (this.options.onSave) {
            this.options.onSave.call(this);
        }
        this.saved = true;
    },
    save: function () {
        // Persist in CouchDB
        if (MODELS.couch_up) {
            try {
                var result = MODELS.couch.save(this.get_doc());
                // console.dir(result);
                if (result.ok) {
                    this.set_doc_ref(result.id, result.rev);
                    this.onSave();
                    this.persisted = true;
                    // console.info('[saved] ' + result.id + ' [' + result.rev + ']');
                }
            } catch (result) {
                MODELS.couch_down_handler('save', result);
            }
        }
        if (!MODELS.couch_up && !this.persisted) {
            this.onSave();
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
                    this.persisted = false;
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
    publish: function () {
        this.published = true;
        // AUTOSAVE
        this.save();
    },
    make_private: function () {
        this.published = false;
        // AUTOSAVE
        this.save();
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
        return id;
    },
    get_id: function () {
        return this._id;
    },
    set_rev: function (rev) {
        this._rev = rev;
        return rev;
    },
    get_rev: function () {
        return this._rev;
    },
    set_doc_ref: function (id, rev) {
        return this.set_id(id) && this.set_rev(rev);
    },
    get_doc_ref: function () {
        var doc_ref = {
            _id: this.get_id(),
            _rev: this.get_rev()
        };
        return doc_ref;
    },
    get_doc: function () {
        // Load tracks
        this.fetchTracks();
        var doc = $.extend(this.get_doc_ref(), {
            date: this.date.getTime(),
            published: this.published,
            type: this.type,
            title: this.title,
            artist: this.artist,
            album: this.album,
            image: this.image,
            subtitle: this.subtitle,
            description: this.description,
            url: this.url,
            copyright: this.copyright,
            source: this.source,
            subscription: this.subscription,
            tracks: $.map(this.tracks, function (playlist_track, i) {
                return playlist_track.get_doc();
            })
        });
        return doc;
    },
    /**
     * Coarse comparison of track data with another playlist
     * Returns an object containing differing tracks
    **/
    diffTracks: function (playlist) {
        var trackDiffs = {};
        var anyChanges = false;
        var thisTracks = this.getTrackHash();
        var playlistTracks = playlist.getTrackHash();
        var trackKey;
        for (trackKey in thisTracks) {
            var change;
            if (!playlistTracks[trackKey]) {
                // Added
                change = false;
            } else {
                // Moved
                change = thisTracks[trackKey].get_position() - playlistTracks[trackKey].get_position();
                // Don't include non changers
                if (change === 0) {
                    continue;
                }
            }
            anyChanges = true;
            trackDiffs[trackKey] = {
                change: change,
                track: thisTracks[trackKey].get_doc()
            };
        }
        for (trackKey in playlistTracks) {
            if (!thisTracks[trackKey]) {
                // Removed
                anyChanges = true;
                trackDiffs[trackKey] = {
                    change: true,
                    track: playlistTracks[trackKey]
                };
            }
        }
        if (anyChanges) {
            return trackDiffs;
        }
    }
};
/**
 * Fetch all playlists from Couch
**/
Playlist.fetchAll = function (callback) {
    try {
        var response = MODELS.couch.view("playlist/all");
        MODELS.couch_up_handler('Playlist.fetchAll', response);
        var playlists = $.map(response.rows, function (row, i) {
            var data = row.value;
            var playlist = new Playlist(row.value);
            if (callback) {
                callback(playlist);
            }
            return playlist;
        });
        return playlists;
    } catch (result) {
        MODELS.couch_down_handler('Playlist.fetchAll', result);
    }
};