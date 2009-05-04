// Playdar
Playdar.setup({
    name: "Playlick",
    website: "http://www.playlick.com/",
    receiverurl: "http://www.playlick.com/playdar_auth.html"
});
var playdar_track_handler = function (track) {
    var uuid = Playdar.Util.generate_uuid();
    Playdar.client.register_results_handler(function (response, final_answer) {
        var list_item = $(track.element).parents('li.p_t');
        var playlist_track = list_item.data('playlist_track');
        if (final_answer) {
            if (response.results.length) {
                var result = response.results[0];
                if (result.score == 1) {
                    list_item.css('background', '#92c137');
                    // Update track
                    playlist_track.track.name = result.track;
                    playlist_track.track.artist = result.artist;
                    playlist_track.track.duration = result.duration;
                    playlist_track.render();
                    playlist_track.playlist.save();
                } else {
                    list_item.css('background', '#c0e95b');
                }
                // Register stream
                Playdar.player.register_stream(result);
                playlist_track.element.bind('click', function (e) {
                    Playdar.player.play_stream(result.sid);
                    return false;
                });
            } else {
                list_item.css('background', '');
            }
        } else {
            list_item.css('background', '#e8f9bb');
        }
    }, uuid);
    return uuid;
};
Playdar.client.register_listeners({
    onAuth: function () {
        Playdar.client.autodetect(playdar_track_handler);
    }
});
soundManager.url = '/lib/soundmanager2_flash9.swf';
soundManager.flashVersion = 9;
soundManager.onload = function () {
    Playdar.setup_player(soundManager);
    Playdar.client.init();
};