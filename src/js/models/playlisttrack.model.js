/**
 * class MODELS.PlaylistTrack
 * PlaylistTrack objects join a Playlist with a Track
 * and have a position and element
**/
function PlaylistTrack (playlist, track, options) {
    this.id = MODELS.next_playlist_track_id++;
    this.playlist = playlist;
    this.track = track;
    
    this.options = options || {};
    
    this.unplayed = this.options.unplayed || false;
    
    this.playdar_qid = null;
    this.playdar_result = null;
    this.playdar_response = null;
    
    this.load();
};
PlaylistTrack.prototype = {
    load: function () {
        // Create the dom element
        // TODO this is view layer stuff
        return this.set_element();
    },
    unload: function () {
        // Create the dom element
        // TODO this is view layer stuff
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
     * TODO this is view layer stuff
    **/
    set_element: function (element_name) {
        element_name = element_name || 'li';
        this.element = $('<' + element_name + ' class="p_t">')
            .attr('id', this.get_dom_id())
            .data('playlist_track', this)
            .html(this.track.toHTML());
        if (this.unplayed) {
            this.element.addClass('unplayed');
        }
        return this.element;
    },
    get_dom_id: function () {
        // TODO this is view layer stuff
        return "p_t_" + this.playlist.get_id() + '_' + this.id;
    },
    get_position: function () {
        return $.inArray(this, this.playlist.tracks) + 1;
    },
    get_doc: function () {
        var doc = {
            position: this.get_position(),
            track: this.track.get_doc(),
            unplayed: this.unplayed
        };
        return doc;
    },
    toString: function () {
        return this.get_position() + ': ' + this.track.toString();
    },
    /**
     * Playback
    **/
    setResult: function (result) {
        this.playdar_result = result;
    },
    setPlayed: function () {
        this.unplayed = false;
        // TODO this is view layer stuff
        this.element.removeClass('unplayed');
        this.playlist.save();
    },
    setUnplayed: function () {
        this.unplayed = true;
        // TODO this is view layer stuff
        this.element.addClass('unplayed');
        this.playlist.save();
    },
    play: function () {
        if (this.playdar_result) {
            Playdar.player.play_stream(this.playdar_result.sid);
            this.setPlayed();
            return true;
        }
    },
    stop: function () {
        if (this.playdar_result) {
            Playdar.player.stop_stream(this.playdar_result.sid);
            return true;
        }
    }
};
