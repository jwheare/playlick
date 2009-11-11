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
var Track = function (doc) {
    this.name = doc.name;
    this.artist = doc.artist;
    this.album = doc.album || '';
    this.duration = doc.duration;
    this.url = doc.url || '';

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
            artist: this.artist,
            album: this.album,
            url: this.url
        };
        return doc;
    }
};
var Playlist = function (options) {
    this.saved = false;
    this.persisted = false;
    this.published = false;
    this.tracks = [];
    this.duration = 0;

    this.options = options || {};
    if (this.options.doc_ref && this.options.doc_ref.id && this.options.doc_ref.rev) {
        this.set_doc_ref(this.options.doc_ref);
        this.persisted = true;
    } else {
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
    this.image = this.options.image || '';
    this.description = this.options.description || '';

    this.set_element(this.options.dom_element);
};
Playlist.prototype = {
    add_track: function (track, options) {
        var playlist_track = new PlaylistTrack(this, track, options);
        this.tracks.push(playlist_track);
        return playlist_track;
    },
    remove_track: function (playlist_track, onSave) {
        var i = $.inArray(playlist_track, this.tracks);
        this.tracks.splice(i, 1);
        this.save(function () {
            playlist_track.element.remove();
        });
    },
    reset_tracks: function (playlist_tracks, onSave) {
        this.tracks = playlist_tracks;
        this.save(onSave);
    },
    set_name: function (name, onSave) {
        this.name = name;
        this.save(onSave);
    },
    set_duration: function (duration) {
        this.duration = duration;
        if (this.options.onSetDuration) {
            this.options.onSetDuration.call(this);
        }
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
    load: function () {
        var elements = $.map(this.tracks, function (playlist_track, i) {
            return playlist_track.load().get();
        });
        return elements;
    },
    unload: function () {
        $.each(this.tracks, function (i, playlist_track) {
            playlist_track.unload();
        });
    },
    set_element: function (element_name) {
        var element_name = element_name || 'li';
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
    titleHTML: function () {
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
    toApplescript: function () {
        var track_records = $.map(this.tracks, function (playlist_track, i) {
            return '{'
                + 'artist: "' + playlist_track.track.artist.replace(/"/g, '\\"') + '",'
                + 'track: "' + playlist_track.track.name.replace(/"/g, '\\"') + '"'
                + '}';
        });
        var applescript = 'set playlist_name to "' + this.name + '"\n'
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
        if (MODELS.couch_up) {
            try {
                var result = MODELS.couch.save(this.get_doc());
                if (result.ok) {
                    this.set_doc_ref(result);
                    this.onSave(callback);
                    this.persisted = true;
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
        this.element.remove();
        if (this.options.onDelete) {
            this.options.onDelete.call(this);
        }
    },
    remove: function () {
        if (MODELS.couch_up) {
            try {
                var result = MODELS.couch.deleteDoc(this.get_doc_ref());
                if (result.ok) {
                    this.onRemove();
                    this.persisted = false;
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
        this.save(onSave);
    },
    make_private: function (onSave) {
        this.published = false;
        this.save(onSave);
    },
    share: function (person) {
    },
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
            published: this.published,
            type: 'playlist',
            name: this.name,
            duration: this.duration,
            image: this.image,
            description: this.description,
            tracks: $.map(this.tracks, function (playlist_track, i) {
                return playlist_track.get_doc();
            })
        });
        return doc;
    }
};
var PlaylistTrack = function (playlist, track, options) {
    this.id = MODELS.next_playlist_track_id++;
    this.playlist = playlist;
    this.track = track;
    this.set_track_duration(track.duration);

    this.options = options || {};

    this.load();
};
PlaylistTrack.prototype = {
    load: function () {
        return this.set_element(this.options.dom_element);
    },
    unload: function () {
        this.element.remove();
    },
    remove: function () {
        this.playlist.remove_track(this);
    },

    set_track_duration: function (duration) {
        if (duration) {
            var playlist_duration = this.playlist.duration;
            if (playlist_duration && this.track.duration) {
                playlist_duration -= this.track.duration;
            }
            this.track.duration = duration;
            playlist_duration += this.track.duration;
            this.playlist.set_duration(playlist_duration);
        }
    },
    set_element: function (element_name) {
        var element_name = element_name || 'li';
        this.element = $('<' + element_name + ' class="p_t">')
            .attr('id', this.get_dom_id())
            .data('playlist_track', this)
            .html(this.track.toHTML());
        return this.element;
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
