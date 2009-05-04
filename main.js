// Preload playlist
PLAYLICK.Track.prototype.toHTML = function () {
    return '<a href="#" class="handle">[+]</a> '
        + '<a href="#" class="remove">x</a>'
        + '<a href="#" class="item">'
            + '<span class="haudio">'
                + '<span class="fn">' + this.name + '</span>'
                + ' - '
                + '<span class="contributor">' + this.artist + '</span>'
            + '</span>'
        + '</a>';
};
PLAYLICK.Playlist.prototype.toHTML = function () {
    return '<a href="#" class="edit_playlist">edit</a>'
        + '<a href="#" class="playlist">' + this.name + '</a>'
        + '<form style="display: none;" class="edit_playlist_form">'
            + '<input type="text" name="name" value="' + this.name + '" class="playlist_name">'
            + '<input type="submit" value="save">'
        + '</form>';
};

// Setup playlist reordering behaviour
$('#playlist').sortable({
    axis: 'y',
    cursor: 'move',
    handle: 'a.handle',
    update: function (e, ui) {
        var ids = $('#playlist').sortable('toArray');
        var tracks = [];
        $.each(ids, function (index, id) {
            tracks.push($('#' + id).data('playlist_track'));
        });
        current_playlist.reset_tracks(tracks);
    }
});

// Load playlist stash
$('#loading_playlists').hide();
$.each(playlists, function (key, value) {
    var playlist = new PLAYLICK.Playlist('playlist', {
        id: key,
        name: value.name
    });
    playlist.element.appendTo($('#playlist_stash'));
});
// Create a new empty playlist
function new_playlist () {
    current_playlist = new PLAYLICK.Playlist('playlist', {
        onCreate: function () {
            if (!$('#' + this.get_dom_id()).size()) {
                this.element.appendTo($('#playlist_stash'));
                $('#playlistTitle').html(this.toString());
                playlists[this.id] = {
                    name: this.name,
                    tracks: this.tracks
                };
            }
        }
    });
}
new_playlist();

function stash_current () {
    if (Playdar.client) {
        Playdar.client.cancel_resolve();
    }
    // Stash the current data
    if (current_playlist.tracks.length) {
        playlists[current_playlist.id] = {
            name: current_playlist.name,
            tracks: $.map(current_playlist.tracks, function (item, index) {
                return item.track;
            })
        };
    }
};

$('#create_playlist').bind('click', function (e) {
    if (Playdar.client) {
        Playdar.client.cancel_resolve();
    }
    stash_current();
    new_playlist();
    $('#playlistTitle').empty();
    return false;
});

// Add to loaded playlist
$('#add_to_playlist').bind('submit', function (e) {
    // Parse the form and add tracks
    var params = {};
    $.each($(this).serializeArray(), function (index, item) {
        params[item.name] = item.value;
    });
    if (params.track && params.artist) {
        $('input[name=track]', this).select();
        var track = new PLAYLICK.Track(params.track, params.artist);
        var playlist_track = current_playlist.add_track(track);
        if (Playdar.client) {
            Playdar.client.autodetect(playdar_track_handler, playlist_track.element[0]);
        }
    }
    return false;
});

// Remove from playlist
$('#playlist').bind('click', function (e) {
    var target = $(e.target);
    if (target.is('a.remove')) {
        target.parents('li.p_t').data('playlist_track').remove();
        return false;
    }
});

// Load from the stash
$('#playlist_stash').bind('click', function (e) {
    // Load the clicked playlist
    var target = $(e.target);
    if (target.is('li.p a.playlist')) {
        target.blur();
        stash_current();
        current_playlist = target.parents('li.p').data('playlist');
        current_playlist.load_tracks(playlists[current_playlist.id].tracks);
        $('#playlistTitle').html(current_playlist.toString());
        if (Playdar.client) {
            Playdar.client.autodetect(playdar_track_handler);
        }
        return false;
    }
    // Edit the playlist name
    if (target.is('li.p a.edit_playlist')) {
        target.blur();
        target.siblings('.playlist').toggle();
        target.siblings('form').toggle();
        target.siblings(':text').select();
        return false;
    }
});
$('#playlist_stash form.edit_playlist_form').bind('submit', function (e) {
    var form = $(this);
    form.hide();
    form.siblings('.playlist').show();
    var stash_row = form.parents('li.p');
    var playlist = stash_row.data('playlist');
    var name = form.serializeArray()[0].value;
    form.siblings('.playlist').html(name);
    playlist.set_name(name);
    if (current_playlist == playlist) {
        $('#playlistTitle').html(playlist.toString());
    }
    return false;
});