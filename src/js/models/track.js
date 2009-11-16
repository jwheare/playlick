/**
 * class MODELS.Track
 * Track objects have a name, artist, album and duration
 * and can cache playdar queries and results
**/
var Track = function (doc) {
    this.name = doc.name;
    this.artist = doc.artist || '';
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
