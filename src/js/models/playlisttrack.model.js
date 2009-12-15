/**
 * class MODELS.PlaylistTrack
 * PlaylistTrack objects join a Playlist with a Track
 * and have a position and element
**/
function PlaylistTrack (playlist, track, options) {
    this.id = MODELS.next_playlist_track_id++;
    this.playlist = playlist;
    this.track = track;
    this.set_track_duration(track.duration);
    
    this.options = options || {};
    
    this.load();
};
PlaylistTrack.prototype = {
    load: function () {
        // Create the dom element
        return this.set_element(this.options.dom_element);
    },
    unload: function () {
        // Create the dom element
        this.element.remove();
    },
    remove: function () {
        // Update playlist state
        this.playlist.remove_track(this);
    },
    
    /**
     * Update the track and the playlist duration
    **/
    set_track_duration: function (duration) {
        if (duration) {
            this.track.duration = duration;
        }
    },
    /**
     * Build a DOMElement for the PlaylistTrack
    **/
    set_element: function (element_name) {
        element_name = element_name || 'li';
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
