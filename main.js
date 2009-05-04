// Preload playlist
PLAYLICK.Track.prototype.toHTML = function () {
    return '<a href="#" class="handle">[+]</a> '
        + '<a href="#" class="item">'
            + '<span class="haudio">'
                + '<span class="fn">' + this.name + '</span>'
                + ' - '
                + '<span class="contributor">' + this.artist + '</span>'
            + '</span>'
        + '</a>';
};

var add_callback = function (playlist_track) {
    // Add drag drop behaviours
    playlist_track.element.draggable({
        axis: 'y',
        handle: 'a.handle',
        revert: true,
        revertDuration: 0,
        containment: 'parent',
        addClasses: false,
        zIndex: 100,
        start: function (e, ui) {
            // $(this).css('position', 'absolute');
        },
        stop: function (e, ui) {
            // $(this).css('position', '');
        }
    });
    playlist_track.element.droppable({
        addClasses: false,
        tolerance: 'pointer',
        over: function (e, ui) {
            $(this).addClass('dragover');
        },
        out: function (e, ui) {
            $(this).removeClass('dragover');
        },
        drop: function (e, ui) {
            var dropped_track = $(this).data('playlist_track');
            var dragged_track = ui.draggable.data('playlist_track');
            dragged_track.move_before(dropped_track);
            $(this).removeClass('dragover');
        }
    });
};
var save_callback = function () {
    $('#playlistTitle').html(this.toString());
};
var new_playlist = function () {
    loaded_playlist = new PLAYLICK.Playlist('playlist', {
        onAdd: add_callback,
        onSave: save_callback,
        onCreate: function () {
            if (!$('#' + this.get_dom_id()).size()) {
                $('#playlist_stash').append(
                    '<li class="stashed_playlist">'
                        + '<a href="#" id="' + this.get_dom_id() + '">' + this.name + '</a>'
                    + '</li>'
                );
                playlists[this.id] = {
                    name: this.name,
                    tracks: this.tracks
                };
            }
        }
    });
};
new_playlist();

var playlists = {
    'test': {
        name: 'Test Playlist',
        tracks: [
            new PLAYLICK.Track('Dry The Rain', 'The Beta Band', (6*60)+5),
            new PLAYLICK.Track('Woozy with Cider', 'James Yorkston', (4*60)+6),
            new PLAYLICK.Track('Yoshimi Battles the Pink Robots Pt. 1', 'The Flaming Lips', (4*60)+46),
            new PLAYLICK.Track('Stay Loose', 'Belle and Sebastian', (6*60)+42),
            new PLAYLICK.Track('Such Great Heights', 'The Postal Service', (4*60)+26),
            new PLAYLICK.Track('Stockholm Syndrome', 'Muse', (4*60)+57),
            new PLAYLICK.Track('New Slang', 'The Shins', (3*60)+52),
            new PLAYLICK.Track('Bluebird', 'Devendra Banhart', (1*60)+28),
            new PLAYLICK.Track('Von', 'Sigur Rós', (8*60)+14),
            new PLAYLICK.Track('Time Is The Enemy', 'Quantic', (3*60)+42),
            new PLAYLICK.Track('Get Ready for Love', 'Nick Cave & The Bad Seeds', (5*60)+5),
            new PLAYLICK.Track('Country House', 'Blur', (3*60)+58),
            new PLAYLICK.Track('Infinity Milk', 'Dananananaykroyd', (4*60)+20),
            new PLAYLICK.Track('The Hell Song', 'Sum 41', (3*60)+19),
            new PLAYLICK.Track('Up In Arms', 'Foo Fighters', (2*60)+16)
        ]
    }
};
for (var p in playlists) {
    $('#playlist_stash').append(
        '<li class="stashed_playlist">'
            + '<a href="#" id="p_' + p + '">' + playlists[p].name + '</a>'
        + '</li>'
    );
}

var stash_playlist = function () {
    // Stash the current data
    if (loaded_playlist.tracks.length) {
        playlists[loaded_playlist.id] = {
            name: loaded_playlist.name,
            tracks: $.map(loaded_playlist.tracks, function (item, index) {
                return item.track;
            })
        };
    }
};

$('#create_playlist').bind('click', function (e) {
    if (Playdar.client) {
        Playdar.client.cancel_resolve();
    }
    stash_playlist();
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
        var track = new PLAYLICK.Track(params.track, params.artist);
        var playlist_track = new PLAYLICK.PlaylistTrack(loaded_playlist, track);
        if (Playdar.client) {
            Playdar.client.autodetect(playdar_track_handler, playlist_track.element[0]);
        }
    }
    return false;
});

// Load from the stash
$('#playlist_stash').bind('click', function (e) {
    stash_playlist();
    // Load the clicked playlist
    var target = $(e.target);
    if (target.is('li.stashed_playlist a')) {
        if (Playdar.client) {
            Playdar.client.cancel_resolve();
        }
        var playlist_id = target.attr('id').replace('p_', '');
        loaded_playlist = PLAYLICK.load_playlist(playlists[playlist_id].tracks, 'playlist', {
            id: playlist_id,
            name: playlists[playlist_id].name,
            onAdd: add_callback,
            onSave: save_callback
        });
        $('#playlistTitle').html(loaded_playlist.toString());
        if (Playdar.client) {
            Playdar.client.autodetect(playdar_track_handler);
        }
        return false;
    }
});