Playdar={VERSION:"0.4.2",SERVER_ROOT:"localhost",SERVER_PORT:"8888",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_POPUP_NAME:"PD_auth",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"PD_queries",QUERIES_POPUP_SIZE:{"w":640,"h":700},REFRESH_INTERVAL:null,MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,USE_SCROBBLER:true,client:null,status_bar:null,player:null,setup:function(_1){
new Playdar.Client(_1);
new Playdar.Boffin();
},setup_player:function(_2){
new Playdar.Player(_2);
}};
Playdar.DefaultListeners={onStat:function(_3){
if(_3){
}else{
}
},onAuth:function(){
},onAuthClear:function(){
},onResults:function(_4,_5){
if(_5){
if(_4.results.length){
}else{
}
}else{
}
},onTagCloud:function(_6){
},onRQL:function(_7){
},onResolveIdle:function(){
}};
Playdar.Client=function(_8,_9){
Playdar.client=this;
this.auth_token=false;
this.auth_popup=null;
this.listeners={};
this.results_handlers={};
this.resolve_qids=[];
this.last_qid="";
this.poll_counts={};
this.initialise_resolve();
this.auth_details=_8;
this.register_listeners(Playdar.DefaultListeners);
this.register_listeners(_9);
this.uuid=Playdar.Util.generate_uuid();
};
Playdar.Client.prototype={register_listener:function(_a,_b){
_b=_b||Playdar.Util.null_callback;
this.listeners[_a]=function(){
return _b.apply(Playdar.client,arguments);
};
},register_listeners:function(_c){
if(!_c){
return;
}
for(var _d in _c){
this.register_listener(_d,_c[_d]);
}
return true;
},register_results_handler:function(_e,_f){
if(_f){
this.results_handlers[_f]=_e;
}else{
this.register_listener("onResults",_e);
}
},init:function(){
if(!this.auth_token){
this.auth_token=Playdar.Util.getcookie("auth");
}
this.stat();
},stat:function(){
setTimeout(function(){
Playdar.client.check_stat_timeout();
},Playdar.STAT_TIMEOUT);
Playdar.Util.loadjs(this.get_url("stat","handle_stat"));
},check_stat_timeout:function(){
if(!this.stat_response||this.stat_response.name!="playdar"){
this.listeners.onStat(false);
}
},handle_stat:function(_10){
this.stat_response=_10;
if(Playdar.USE_STATUS_BAR){
new Playdar.StatusBar();
Playdar.status_bar.handle_stat(_10);
}
this.listeners.onStat(_10);
if(_10.authenticated){
this.listeners.onAuth();
}else{
if(this.auth_token){
this.clear_auth();
}
}
},clear_auth:function(){
if(Playdar.player){
Playdar.player.stop_all();
}
Playdar.Util.loadjs(this.get_revoke_url());
this.auth_token=false;
Playdar.Util.deletecookie("auth");
this.listeners.onAuthClear();
if(Playdar.status_bar){
Playdar.status_bar.offline();
}
},is_authed:function(){
if(this.auth_token){
return true;
}
return false;
},get_revoke_url:function(){
return this.get_base_url("/settings/auth/",{revoke:this.auth_token});
},get_auth_url:function(){
return this.get_base_url("/auth_1/",this.auth_details);
},get_auth_link_html:function(_11){
_11=_11||"Connect";
var _12="<a href=\""+this.get_auth_url()+"\" target=\""+Playdar.AUTH_POPUP_NAME+"\" onclick=\"Playdar.client.start_auth(); return false;"+"\">"+_11+"</a>";
return _12;
},get_disconnect_link_html:function(_13){
_13=_13||"Disconnect";
var _14="<a href=\""+this.get_base_url("/settings/auth/")+"\" onclick=\"Playdar.client.clear_auth(); return false;"+"\">"+_13+"</a>";
return _14;
},start_auth:function(){
if(!this.auth_popup||this.auth_popup.closed){
this.auth_popup=window.open(this.get_auth_url(),Playdar.AUTH_POPUP_NAME,Playdar.Util.get_popup_options(Playdar.AUTH_POPUP_SIZE));
}else{
this.auth_popup.focus();
}
if(!this.auth_details.receiverurl){
if(Playdar.status_bar){
Playdar.status_bar.start_manual_auth();
}
}
},auth_callback:function(_15){
Playdar.Util.setcookie("auth",_15,365);
if(this.auth_popup&&!this.auth_popup.closed){
this.auth_popup.close();
this.auth_popup=null;
}
this.auth_token=_15;
this.stat();
},manual_auth_callback:function(_16){
var _17=document.getElementById(_16);
if(_17&&_17.value){
this.auth_callback(_17.value);
}
},parse_microformats:function(_18){
var _19=[];
var _1a=Playdar.Util.select(".haudio",_18);
for(var i=0;i<_1a.length;i++){
var _1c=_1a[i];
var _1d=Playdar.Util.select(".contributor",_1c);
var _1e=Playdar.Util.select(".fn",_1c);
if(_1e[0]&&_1d[0]){
var _1f={"artist":_1d[0].title||_1d[0].innerHTML,"name":_1e[0].title||_1e[0].innerHTML,"element":_1c};
_19.push(_1f);
}
}
return _19;
},autodetect:function(_20,_21){
var _22,qid;
var _24=this.parse_microformats(_21);
for(var i=0;i<_24.length;i++){
_22=_24[i];
if(_20){
qid=_20(_22);
}
Playdar.client.resolve(_22.artist,"",_22.name,qid);
}
},resolve:function(art,alb,trk,qid){
var _2a={artist:art,album:alb,track:trk,qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.resolution_queue.push(_2a);
this.process_resolution_queue();
},process_resolution_queue:function(){
if(this.resolutions_in_progress.count>=Playdar.MAX_CONCURRENT_RESOLUTIONS){
return false;
}
var _2b=this.resolution_queue.length+this.resolutions_in_progress.count;
if(_2b){
var _2c=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_2c;i++){
var _2e=this.resolution_queue.shift();
if(!_2e){
break;
}
this.resolutions_in_progress.queries[_2e.qid]=_2e;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_2e));
}
}else{
this.listeners.onResolveIdle();
}
},cancel_resolve:function(){
this.initialise_resolve();
if(Playdar.status_bar){
Playdar.status_bar.cancel_resolve();
}
},initialise_resolve:function(){
this.resolution_queue=[];
this.resolutions_in_progress={count:0,queries:{}};
},recheck_results:function(qid){
var _30={qid:qid};
this.resolutions_in_progress.queries[qid]=_30;
this.resolutions_in_progress.count++;
this.handle_resolution(_30);
},handle_resolution:function(_31){
if(this.resolutions_in_progress.queries[_31.qid]){
this.last_qid=_31.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_31.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_33,_34,_35){
var _36=this.should_stop_polling(_33);
_35=_35||this;
if(!_36){
setTimeout(function(){
_34.call(_35,_33.qid);
},Playdar.REFRESH_INTERVAL||_33.refresh_interval);
}
return _36;
},should_stop_polling:function(_37){
if(_37.refresh_interval<=0){
return true;
}
if(_37.query.solved==true){
return true;
}
if(this.poll_counts[_37.qid]>=4){
return true;
}
return false;
},handle_results:function(_38){
if(this.resolutions_in_progress.queries[_38.qid]){
var _39=this.poll_results(_38,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_38,_39);
}
if(this.results_handlers[_38.qid]){
this.results_handlers[_38.qid](_38,_39);
}else{
this.listeners.onResults(_38,_39);
}
if(_39){
delete this.resolutions_in_progress.queries[_38.qid];
this.resolutions_in_progress.count--;
this.process_resolution_queue();
}
}
},get_last_results:function(){
if(this.last_qid){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.get_results(this.last_qid);
}
},get_base_url:function(_3a,_3b){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_3a){
url+=_3a;
}
if(_3b){
url+="?"+Playdar.Util.toQueryString(_3b);
}
return url;
},get_url:function(_3d,_3e,_3f){
_3f=_3f||{};
_3f.call_id=new Date().getTime();
_3f.method=_3d;
if(!_3f.jsonp){
if(_3e.join){
_3f.jsonp=_3e.join(".");
}else{
_3f.jsonp=this.jsonp_callback(_3e);
}
}
this.add_auth_token(_3f);
return this.get_base_url("/api/",_3f);
},add_auth_token:function(_40){
if(this.auth_token){
_40.auth=this.auth_token;
}
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_42){
return "Playdar.client."+_42;
},list_results:function(_43){
for(var i=0;i<_43.results.length;i++){
console.log(_43.results[i].name);
}
}};
Playdar.Boffin=function(){
Playdar.boffin=this;
};
Playdar.Boffin.prototype={get_url:function(_45,_46){
_46=_46||{};
_46.jsonp=_46.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_46);
return Playdar.client.get_base_url("/boffin/"+_45,_46);
},get_tagcloud:function(){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
Playdar.Util.loadjs(this.get_url("tagcloud",{jsonp:"Playdar.boffin.handle_tagcloud"}));
},handle_tagcloud:function(_47){
Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud,_47.qid);
Playdar.client.get_results(_47.qid);
},get_tag_rql:function(tag){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
var rql="tag:\""+tag+"\"";
Playdar.Util.loadjs(this.get_url("rql/"+encodeURIComponent(rql),{jsonp:"Playdar.boffin.handle_rql"}));
},handle_rql:function(_4a){
Playdar.client.register_results_handler(Playdar.client.listeners.onRQL,_4a.qid);
Playdar.client.get_results(_4a.qid);
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_4b,_4c){
_4c=_4c||{};
_4c.jsonp=_4c.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_4c);
return Playdar.client.get_base_url("/audioscrobbler/"+_4b,_4c);
},start:function(_4d,_4e,_4f,_50,_51,_52){
var _53={a:_4d,t:_4e,o:"P"};
if(_4f){
_53["b"]=_4f;
}
if(_50){
_53["l"]=_50;
}
if(_51){
_53["n"]=_51;
}
if(_52){
_53["m"]=_52;
}
Playdar.Util.loadjs(this.get_url("start",_53));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_options:function(_54,_55){
var _56=this;
return {onplay:function(){
_56.start(_54.artist,_54.track,_54.album,_54.duration);
Playdar.Util.apply_property_function(_55,"onplay",this,arguments);
},onbufferchange:function(){
if(this.isBuffering){
_56.pause();
}else{
_56.resume();
}
Playdar.Util.apply_property_function(_55,"onbufferchange",this,arguments);
},onpause:function(){
_56.pause();
Playdar.Util.apply_property_function(_55,"onpause",this,arguments);
},onresume:function(){
_56.resume();
Playdar.Util.apply_property_function(_55,"onresume",this,arguments);
},onstop:function(){
_56.stop();
Playdar.Util.apply_property_function(_55,"onstop",this,arguments);
},onfinish:function(){
_56.stop();
Playdar.Util.apply_property_function(_55,"onfinish",this,arguments);
}};
}};
Playdar.Player=function(_57){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_57;
if(Playdar.USE_SCROBBLER){
new Playdar.Scrobbler();
}
};
Playdar.Player.prototype={register_stream:function(_58,_59){
this.streams[_58.sid]=_58;
var _5a=Playdar.Util.extend_object({id:_58.sid,url:Playdar.client.get_stream_url(_58.sid)},_59);
if(Playdar.status_bar){
Playdar.Util.extend_object(_5a,Playdar.status_bar.get_sound_options(_58,_59));
}
if(Playdar.scrobbler){
Playdar.Util.extend_object(_5a,Playdar.scrobbler.get_sound_options(_58,_59));
}
return this.soundmanager.createSound(_5a);
},play_stream:function(sid){
var _5c=this.soundmanager.getSoundById(sid);
if(this.nowplayingid!=sid){
this.stop_all();
if(_5c.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_5c.togglePause();
return _5c;
},stop_all:function(){
if(this.nowplayingid){
var _5d=this.soundmanager.getSoundById(this.nowplayingid);
_5d.stop();
_5d.setPosition(1);
this.nowplayingid=null;
}
if(Playdar.status_bar){
Playdar.status_bar.stop_handler();
}
},stop_stream:function(sid){
if(sid&&sid==this.nowplayingid){
this.stop_all();
return true;
}
return false;
},is_now_playing:function(){
if(this.nowplayingid){
return true;
}
return false;
},toggle_nowplaying:function(){
if(this.nowplayingid){
this.play_stream(this.nowplayingid);
}
}};
Playdar.StatusBar=function(){
Playdar.status_bar=this;
this.queries_popup=null;
this.progress_bar_width=200;
this.request_count=0;
this.pending_count=0;
this.success_count=0;
this.query_list_link=null;
this.nowplaying_query_button=null;
this.build();
};
Playdar.StatusBar.prototype={build:function(){
var _5f=document.createElement("div");
_5f.style.position="fixed";
_5f.style.bottom=0;
_5f.style.left=0;
_5f.style.zIndex=100;
_5f.style.width="100%";
_5f.style.height="36px";
_5f.style.padding="7px 0";
_5f.style.borderTop="2px solid #4c7a0f";
_5f.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_5f.style.color="#335507";
_5f.style.background="#e8f9bb";
var _60=document.createElement("div");
_60.style.padding="0 7px";
var _61="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_60.innerHTML=_61;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_60.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _62=document.createElement("p");
_62.style.margin="0";
this.track_link=document.createElement("a");
this.track_link.style.textDecoration="none";
this.artist_name=document.createElement("span");
this.artist_name.style.textTransform="uppercase";
this.artist_name.style.color="#4c7a0f";
this.track_name=document.createElement("strong");
this.track_name.style.margin="0 0 0 10px";
this.track_name.style.color="#335507";
this.track_link.appendChild(this.artist_name);
this.track_link.appendChild(this.track_name);
_62.appendChild(this.track_link);
this.playback.appendChild(_62);
var _63=document.createElement("table");
_63.setAttribute("cellpadding",0);
_63.setAttribute("cellspacing",0);
_63.setAttribute("border",0);
_63.style.color="#4c7a0f";
_63.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _64=document.createElement("tbody");
var _65=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_65.appendChild(this.track_elapsed);
var _66=document.createElement("td");
_66.style.padding="0 5px";
_66.style.verticalAlign="middle";
var _67=document.createElement("div");
_67.style.width=this.progress_bar_width+"px";
_67.style.height="9px";
_67.style.border="1px solid #4c7a0f";
_67.style.background="#fff";
_67.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_67.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_67.appendChild(this.playhead);
_67.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_66.appendChild(_67);
_65.appendChild(_66);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_65.appendChild(this.track_duration);
_64.appendChild(_65);
_63.appendChild(_64);
this.playback.appendChild(_63);
_60.appendChild(this.playback);
var _68=document.createElement("div");
_68.style.cssFloat="right";
_68.style.padding="0 8px";
_68.style.textAlign="right";
var _69=document.createElement("p");
_69.style.margin=0;
_69.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_68.appendChild(_69);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML="<a href=\""+this.get_queries_popup_url()+"\" target=\""+Playdar.QUERIES_POPUP_NAME+"\" onclick=\"Playdar.status_bar.open_queries_popup(); return false;"+"\">Tracks</a>"+" | "+Playdar.client.get_disconnect_link_html();
_68.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_5f.appendChild(_68);
_5f.appendChild(_60);
document.body.appendChild(_5f);
var _6a=document.body.style.marginBottom;
if(!_6a){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_6a=css.marginBottom;
}
}
document.body.style.marginBottom=(_6a.replace("px","")-0)+36+(7*2)+2+"px";
return _5f;
},ready:function(){
this.playdar_links.style.display="";
var _6c="Ready";
this.status.innerHTML=_6c;
},offline:function(){
this.playdar_links.style.display="none";
var _6d=Playdar.client.get_auth_link_html();
this.status.innerHTML=_6d;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _6e="manualAuth_"+Playdar.client.uuid;
var _6f="<input type=\"text\" id=\""+_6e+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_6e+"'); return false;"+"\" />";
this.status.innerHTML=_6f;
},handle_stat:function(_70){
if(_70.authenticated){
this.ready();
}else{
this.offline();
}
},get_queries_popup_url:function(){
return Playdar.STATIC_HOST+"/demos/tracks.html";
},open_queries_popup:function(){
if(this.queries_popup===null||this.queries_popup.closed){
this.queries_popup=window.open(this.get_queries_popup_url(),Playdar.QUERIES_POPUP_NAME,Playdar.Util.get_popup_options(Playdar.QUERIES_POPUP_SIZE));
}else{
this.queries_popup.focus();
}
},show_resolution_status:function(){
if(this.query_count){
var _71=" ";
if(this.pending_count){
_71+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_71+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_71;
}
},handle_results:function(_72,_73){
if(_73){
this.pending_count--;
if(_72.results.length){
this.success_count++;
}
}
this.show_resolution_status();
},increment_requests:function(){
this.request_count++;
this.pending_count++;
this.show_resolution_status();
},cancel_resolve:function(){
this.pending_count=0;
this.show_resolution_status();
},get_sound_options:function(_74,_75){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
Playdar.Util.apply_property_function(_75,"whileplaying",this,arguments);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
Playdar.Util.apply_property_function(_75,"whileloading",this,arguments);
}};
},play_handler:function(_76){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_76.sid);
this.track_link.title=_76.source;
this.track_name.innerHTML=_76.track;
this.artist_name.innerHTML=_76.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_76.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_77){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_77.position/1000));
var _78;
if(_77.readyState==3){
_78=_77.duration;
}else{
_78=_77.durationEstimate;
}
var _79=_77.position/_78;
this.playhead.style.width=Math.round(_79*this.progress_bar_width)+"px";
},loading_handler:function(_7a){
var _7b=_7a.bytesLoaded/_7a.bytesTotal;
this.bufferhead.style.width=Math.round(_7b*this.progress_bar_width)+"px";
},stop_handler:function(){
this.playback.style.display="none";
this.status.style.display="";
this.track_link.href="#";
this.track_link.title="";
this.track_name.innerHTML="";
this.artist_name.innerHTML="";
this.bufferhead.style.width=0;
this.playhead.style.width=0;
}};
Playdar.Util={generate_uuid:function(){
var _7c="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _7d=[];
var rnd=Math.random;
var r;
_7d[8]=_7d[13]=_7d[18]=_7d[23]="-";
_7d[14]="4";
for(var i=0;i<36;i++){
if(!_7d[i]){
r=0|rnd()*16;
_7d[i]=_7c[(i==19)?(r&3)|8:r&15];
}
}
return _7d.join("");
},toQueryPair:function(key,_82){
if(_82===null){
return key;
}
return key+"="+encodeURIComponent(_82);
},toQueryString:function(_83){
var _84=[];
for(var key in _83){
var _86=_83[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_86)=="[object Array]"){
for(var i=0;i<_86.length;i++){
_84.push(Playdar.Util.toQueryPair(key,_86[i]));
}
}else{
_84.push(Playdar.Util.toQueryPair(key,_86));
}
}
return _84.join("&");
},mmss:function(_88){
var s=_88%60;
if(s<10){
s="0"+s;
}
return Math.floor(_88/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_8c,_8d,_8e){
if(_8e){
var _8f=new Date();
_8f.setTime(_8f.getTime()+(_8e*24*60*60*1000));
var _90="; expires="+_8f.toGMTString();
}else{
var _90="";
}
document.cookie="PD_"+_8c+"="+_8d+_90+"; path=/";
},getcookie:function(_91){
var _92="PD_"+_91+"=";
var _93=document.cookie.split(";");
for(var i=0;i<_93.length;i++){
var c=_93[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_92)==0){
return c.substring(_92.length,c.length);
}
}
return null;
},deletecookie:function(_96){
Playdar.Util.setcookie(_96,"",-1);
},get_window_position:function(){
var _97={};
if(window.screenLeft){
_97.x=window.screenLeft||0;
_97.y=window.screenTop||0;
}else{
_97.x=window.screenX||0;
_97.y=window.screenY||0;
}
return _97;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_98){
var _99=Playdar.Util.get_popup_location(_98);
return ["left="+_99.x,"top="+_99.y,"width="+_98.w,"height="+_98.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_9a){
var _9b=Playdar.Util.get_window_position();
var _9c=Playdar.Util.get_window_size();
return {"x":Math.max(0,_9b.x+(_9c.w-_9a.w)/2),"y":Math.max(0,_9b.y+(_9c.h-_9a.h)/2)};
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_9e,_9f){
_9f=_9f||{};
for(var _a0 in _9f){
_9e[_a0]=_9f[_a0];
}
return _9e;
},apply_property_function:function(obj,_a2,_a3,_a4){
if(obj&&obj[_a2]){
obj[_a2].apply(_a3,_a4);
}
},log:function(_a5){
if(typeof console!="undefined"){
console.dir(_a5);
}
},null_callback:function(){
}};
(function(){
var _a6=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_a7=0,_a8=Object.prototype.toString,_a9=false;
var _aa=function(_ab,_ac,_ad,_ae){
_ad=_ad||[];
var _af=_ac=_ac||document;
if(_ac.nodeType!==1&&_ac.nodeType!==9){
return [];
}
if(!_ab||typeof _ab!=="string"){
return _ad;
}
var _b0=[],m,set,_b3,_b4,_b5,_b6,_b7=true,_b8=_b9(_ac);
_a6.lastIndex=0;
while((m=_a6.exec(_ab))!==null){
_b0.push(m[1]);
if(m[2]){
_b6=RegExp.rightContext;
break;
}
}
if(_b0.length>1&&_ba.exec(_ab)){
if(_b0.length===2&&_bb.relative[_b0[0]]){
set=_bc(_b0[0]+_b0[1],_ac);
}else{
set=_bb.relative[_b0[0]]?[_ac]:_aa(_b0.shift(),_ac);
while(_b0.length){
_ab=_b0.shift();
if(_bb.relative[_ab]){
_ab+=_b0.shift();
}
set=_bc(_ab,set);
}
}
}else{
if(!_ae&&_b0.length>1&&_ac.nodeType===9&&!_b8&&_bb.match.ID.test(_b0[0])&&!_bb.match.ID.test(_b0[_b0.length-1])){
var ret=_aa.find(_b0.shift(),_ac,_b8);
_ac=ret.expr?_aa.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_ac){
var ret=_ae?{expr:_b0.pop(),set:_be(_ae)}:_aa.find(_b0.pop(),_b0.length===1&&(_b0[0]==="~"||_b0[0]==="+")&&_ac.parentNode?_ac.parentNode:_ac,_b8);
set=ret.expr?_aa.filter(ret.expr,ret.set):ret.set;
if(_b0.length>0){
_b3=_be(set);
}else{
_b7=false;
}
while(_b0.length){
var cur=_b0.pop(),pop=cur;
if(!_bb.relative[cur]){
cur="";
}else{
pop=_b0.pop();
}
if(pop==null){
pop=_ac;
}
_bb.relative[cur](_b3,pop,_b8);
}
}else{
_b3=_b0=[];
}
}
if(!_b3){
_b3=set;
}
if(!_b3){
throw "Syntax error, unrecognized expression: "+(cur||_ab);
}
if(_a8.call(_b3)==="[object Array]"){
if(!_b7){
_ad.push.apply(_ad,_b3);
}else{
if(_ac&&_ac.nodeType===1){
for(var i=0;_b3[i]!=null;i++){
if(_b3[i]&&(_b3[i]===true||_b3[i].nodeType===1&&_c2(_ac,_b3[i]))){
_ad.push(set[i]);
}
}
}else{
for(var i=0;_b3[i]!=null;i++){
if(_b3[i]&&_b3[i].nodeType===1){
_ad.push(set[i]);
}
}
}
}
}else{
_be(_b3,_ad);
}
if(_b6){
_aa(_b6,_af,_ad,_ae);
_aa.uniqueSort(_ad);
}
return _ad;
};
_aa.uniqueSort=function(_c3){
if(_c4){
_a9=false;
_c3.sort(_c4);
if(_a9){
for(var i=1;i<_c3.length;i++){
if(_c3[i]===_c3[i-1]){
_c3.splice(i--,1);
}
}
}
}
};
_aa.matches=function(_c6,set){
return _aa(_c6,null,null,set);
};
_aa.find=function(_c8,_c9,_ca){
var set,_cc;
if(!_c8){
return [];
}
for(var i=0,l=_bb.order.length;i<l;i++){
var _cf=_bb.order[i],_cc;
if((_cc=_bb.match[_cf].exec(_c8))){
var _d0=RegExp.leftContext;
if(_d0.substr(_d0.length-1)!=="\\"){
_cc[1]=(_cc[1]||"").replace(/\\/g,"");
set=_bb.find[_cf](_cc,_c9,_ca);
if(set!=null){
_c8=_c8.replace(_bb.match[_cf],"");
break;
}
}
}
}
if(!set){
set=_c9.getElementsByTagName("*");
}
return {set:set,expr:_c8};
};
_aa.filter=function(_d1,set,_d3,not){
var old=_d1,_d6=[],_d7=set,_d8,_d9,_da=set&&set[0]&&_b9(set[0]);
while(_d1&&set.length){
for(var _db in _bb.filter){
if((_d8=_bb.match[_db].exec(_d1))!=null){
var _dc=_bb.filter[_db],_dd,_de;
_d9=false;
if(_d7==_d6){
_d6=[];
}
if(_bb.preFilter[_db]){
_d8=_bb.preFilter[_db](_d8,_d7,_d3,_d6,not,_da);
if(!_d8){
_d9=_dd=true;
}else{
if(_d8===true){
continue;
}
}
}
if(_d8){
for(var i=0;(_de=_d7[i])!=null;i++){
if(_de){
_dd=_dc(_de,_d8,i,_d7);
var _e0=not^!!_dd;
if(_d3&&_dd!=null){
if(_e0){
_d9=true;
}else{
_d7[i]=false;
}
}else{
if(_e0){
_d6.push(_de);
_d9=true;
}
}
}
}
}
if(_dd!==undefined){
if(!_d3){
_d7=_d6;
}
_d1=_d1.replace(_bb.match[_db],"");
if(!_d9){
return [];
}
break;
}
}
}
if(_d1==old){
if(_d9==null){
throw "Syntax error, unrecognized expression: "+_d1;
}else{
break;
}
}
old=_d1;
}
return _d7;
};
var _bb=_aa.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_e1){
return _e1.getAttribute("href");
}},relative:{"+":function(_e2,_e3,_e4){
var _e5=typeof _e3==="string",_e6=_e5&&!(/\W/).test(_e3),_e7=_e5&&!_e6;
if(_e6&&!_e4){
_e3=_e3.toUpperCase();
}
for(var i=0,l=_e2.length,_ea;i<l;i++){
if((_ea=_e2[i])){
while((_ea=_ea.previousSibling)&&_ea.nodeType!==1){
}
_e2[i]=_e7||_ea&&_ea.nodeName===_e3?_ea||false:_ea===_e3;
}
}
if(_e7){
_aa.filter(_e3,_e2,true);
}
},">":function(_eb,_ec,_ed){
var _ee=typeof _ec==="string";
if(_ee&&!(/\W/).test(_ec)){
_ec=_ed?_ec:_ec.toUpperCase();
for(var i=0,l=_eb.length;i<l;i++){
var _f1=_eb[i];
if(_f1){
var _f2=_f1.parentNode;
_eb[i]=_f2.nodeName===_ec?_f2:false;
}
}
}else{
for(var i=0,l=_eb.length;i<l;i++){
var _f1=_eb[i];
if(_f1){
_eb[i]=_ee?_f1.parentNode:_f1.parentNode===_ec;
}
}
if(_ee){
_aa.filter(_ec,_eb,true);
}
}
},"":function(_f3,_f4,_f5){
var _f6=_a7++,_f7=dirCheck;
if(!_f4.match(/\W/)){
var _f8=_f4=_f5?_f4:_f4.toUpperCase();
_f7=dirNodeCheck;
}
_f7("parentNode",_f4,_f6,_f3,_f8,_f5);
},"~":function(_f9,_fa,_fb){
var _fc=_a7++,_fd=dirCheck;
if(typeof _fa==="string"&&!_fa.match(/\W/)){
var _fe=_fa=_fb?_fa:_fa.toUpperCase();
_fd=dirNodeCheck;
}
_fd("previousSibling",_fa,_fc,_f9,_fe,_fb);
}},find:{ID:function(_ff,_100,_101){
if(typeof _100.getElementById!=="undefined"&&!_101){
var m=_100.getElementById(_ff[1]);
return m?[m]:[];
}
},NAME:function(_103,_104,_105){
if(typeof _104.getElementsByName!=="undefined"){
var ret=[],_107=_104.getElementsByName(_103[1]);
for(var i=0,l=_107.length;i<l;i++){
if(_107[i].getAttribute("name")===_103[1]){
ret.push(_107[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_10a,_10b){
return _10b.getElementsByTagName(_10a[1]);
}},preFilter:{CLASS:function(_10c,_10d,_10e,_10f,not,_111){
_10c=" "+_10c[1].replace(/\\/g,"")+" ";
if(_111){
return _10c;
}
for(var i=0,elem;(elem=_10d[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_10c)>=0)){
if(!_10e){
_10f.push(elem);
}
}else{
if(_10e){
_10d[i]=false;
}
}
}
}
return false;
},ID:function(_114){
return _114[1].replace(/\\/g,"");
},TAG:function(_115,_116){
for(var i=0;_116[i]===false;i++){
}
return _116[i]&&_b9(_116[i])?_115[1]:_115[1].toUpperCase();
},CHILD:function(_118){
if(_118[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_118[2]=="even"&&"2n"||_118[2]=="odd"&&"2n+1"||!(/\D/).test(_118[2])&&"0n+"+_118[2]||_118[2]);
_118[2]=(test[1]+(test[2]||1))-0;
_118[3]=test[3]-0;
}
_118[0]=_a7++;
return _118;
},ATTR:function(_11a,_11b,_11c,_11d,not,_11f){
var name=_11a[1].replace(/\\/g,"");
if(!_11f&&_bb.attrMap[name]){
_11a[1]=_bb.attrMap[name];
}
if(_11a[2]==="~="){
_11a[4]=" "+_11a[4]+" ";
}
return _11a;
},PSEUDO:function(_121,_122,_123,_124,not){
if(_121[1]==="not"){
if(_121[3].match(_a6).length>1||(/^\w/).test(_121[3])){
_121[3]=_aa(_121[3],null,null,_122);
}else{
var ret=_aa.filter(_121[3],_122,_123,true^not);
if(!_123){
_124.push.apply(_124,ret);
}
return false;
}
}else{
if(_bb.match.POS.test(_121[0])||_bb.match.CHILD.test(_121[0])){
return true;
}
}
return _121;
},POS:function(_127){
_127.unshift(true);
return _127;
}},filters:{enabled:function(elem){
return elem.disabled===false&&elem.type!=="hidden";
},disabled:function(elem){
return elem.disabled===true;
},checked:function(elem){
return elem.checked===true;
},selected:function(elem){
elem.parentNode.selectedIndex;
return elem.selected===true;
},parent:function(elem){
return !!elem.firstChild;
},empty:function(elem){
return !elem.firstChild;
},has:function(elem,i,_130){
return !!_aa(_130[3],elem).length;
},header:function(elem){
return (/h\d/i).test(elem.nodeName);
},text:function(elem){
return "text"===elem.type;
},radio:function(elem){
return "radio"===elem.type;
},checkbox:function(elem){
return "checkbox"===elem.type;
},file:function(elem){
return "file"===elem.type;
},password:function(elem){
return "password"===elem.type;
},submit:function(elem){
return "submit"===elem.type;
},image:function(elem){
return "image"===elem.type;
},reset:function(elem){
return "reset"===elem.type;
},button:function(elem){
return "button"===elem.type||elem.nodeName.toUpperCase()==="BUTTON";
},input:function(elem){
return (/input|select|textarea|button/i).test(elem.nodeName);
}},setFilters:{first:function(elem,i){
return i===0;
},last:function(elem,i,_140,_141){
return i===_141.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_148){
return i<_148[3]-0;
},gt:function(elem,i,_14b){
return i>_14b[3]-0;
},nth:function(elem,i,_14e){
return _14e[3]-0==i;
},eq:function(elem,i,_151){
return _151[3]-0==i;
}},filter:{PSEUDO:function(elem,_153,i,_155){
var name=_153[1],_157=_bb.filters[name];
if(_157){
return _157(elem,i,_153,_155);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_153[3])>=0;
}else{
if(name==="not"){
var not=_153[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_15b){
var type=_15b[1],node=elem;
switch(type){
case "only":
case "first":
while(node=node.previousSibling){
if(node.nodeType===1){
return false;
}
}
if(type=="first"){
return true;
}
node=elem;
case "last":
while(node=node.nextSibling){
if(node.nodeType===1){
return false;
}
}
return true;
case "nth":
var _15e=_15b[2],last=_15b[3];
if(_15e==1&&last==0){
return true;
}
var _160=_15b[0],_161=elem.parentNode;
if(_161&&(_161.sizcache!==_160||!elem.nodeIndex)){
var _162=0;
for(node=_161.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_162;
}
}
_161.sizcache=_160;
}
var diff=elem.nodeIndex-last;
if(_15e==0){
return diff==0;
}else{
return (diff%_15e==0&&diff/_15e>=0);
}
}
},ID:function(elem,_165){
return elem.nodeType===1&&elem.getAttribute("id")===_165;
},TAG:function(elem,_167){
return (_167==="*"&&elem.nodeType===1)||elem.nodeName===_167;
},CLASS:function(elem,_169){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_169)>-1;
},ATTR:function(elem,_16b){
var name=_16b[1],_16d=_bb.attrHandle[name]?_bb.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_16e=_16d+"",type=_16b[2],_170=_16b[4];
return _16d==null?type==="!=":type==="="?_16e===_170:type==="*="?_16e.indexOf(_170)>=0:type==="~="?(" "+_16e+" ").indexOf(_170)>=0:!_170?_16e&&_16d!==false:type==="!="?_16e!=_170:type==="^="?_16e.indexOf(_170)===0:type==="$="?_16e.substr(_16e.length-_170.length)===_170:type==="|="?_16e===_170||_16e.substr(0,_170.length+1)===_170+"-":false;
},POS:function(elem,_172,i,_174){
var name=_172[2],_176=_bb.setFilters[name];
if(_176){
return _176(elem,i,_172,_174);
}
}}};
var _ba=_bb.match.POS;
for(var type in _bb.match){
_bb.match[type]=new RegExp(_bb.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _be=function(_178,_179){
_178=Array.prototype.slice.call(_178);
if(_179){
_179.push.apply(_179,_178);
return _179;
}
return _178;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_be=function(_17a,_17b){
var ret=_17b||[];
if(_a8.call(_17a)==="[object Array]"){
Array.prototype.push.apply(ret,_17a);
}else{
if(typeof _17a.length==="number"){
for(var i=0,l=_17a.length;i<l;i++){
ret.push(_17a[i]);
}
}else{
for(var i=0;_17a[i];i++){
ret.push(_17a[i]);
}
}
}
return ret;
};
}
var _c4;
if(document.documentElement.compareDocumentPosition){
_c4=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_a9=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_c4=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_a9=true;
}
return ret;
};
}else{
if(document.createRange){
_c4=function(a,b){
var _187=a.ownerDocument.createRange(),_188=b.ownerDocument.createRange();
_187.selectNode(a);
_187.collapse(true);
_188.selectNode(b);
_188.collapse(true);
var ret=_187.compareBoundaryPoints(Range.START_TO_END,_188);
if(ret===0){
_a9=true;
}
return ret;
};
}
}
}
(function(){
var form=document.createElement("div"),id="script"+(new Date).getTime();
form.innerHTML="<a name='"+id+"'/>";
var root=document.documentElement;
root.insertBefore(form,root.firstChild);
if(!!document.getElementById(id)){
_bb.find.ID=function(_18d,_18e,_18f){
if(typeof _18e.getElementById!=="undefined"&&!_18f){
var m=_18e.getElementById(_18d[1]);
return m?m.id===_18d[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_18d[1]?[m]:undefined:[];
}
};
_bb.filter.ID=function(elem,_192){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_192;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_bb.find.TAG=function(_195,_196){
var _197=_196.getElementsByTagName(_195[1]);
if(_195[1]==="*"){
var tmp=[];
for(var i=0;_197[i];i++){
if(_197[i].nodeType===1){
tmp.push(_197[i]);
}
}
_197=tmp;
}
return _197;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_bb.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _19b=_aa,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_aa=function(_19d,_19e,_19f,seed){
_19e=_19e||document;
if(!seed&&_19e.nodeType===9&&!_b9(_19e)){
try{
return _be(_19e.querySelectorAll(_19d),_19f);
}
catch(e){
}
}
return _19b(_19d,_19e,_19f,seed);
};
for(var prop in _19b){
_aa[prop]=_19b[prop];
}
})();
}
if(document.getElementsByClassName&&document.documentElement.getElementsByClassName){
(function(){
var div=document.createElement("div");
div.innerHTML="<div class='test e'></div><div class='test'></div>";
if(div.getElementsByClassName("e").length===0){
return;
}
div.lastChild.className="e";
if(div.getElementsByClassName("e").length===1){
return;
}
_bb.order.splice(1,0,"CLASS");
_bb.find.CLASS=function(_1a3,_1a4,_1a5){
if(typeof _1a4.getElementsByClassName!=="undefined"&&!_1a5){
return _1a4.getElementsByClassName(_1a3[1]);
}
};
})();
}
function dirNodeCheck(dir,cur,_1a8,_1a9,_1aa,_1ab){
var _1ac=dir=="previousSibling"&&!_1ab;
for(var i=0,l=_1a9.length;i<l;i++){
var elem=_1a9[i];
if(elem){
if(_1ac&&elem.nodeType===1){
elem.sizcache=_1a8;
elem.sizset=i;
}
elem=elem[dir];
var _1b0=false;
while(elem){
if(elem.sizcache===_1a8){
_1b0=_1a9[elem.sizset];
break;
}
if(elem.nodeType===1&&!_1ab){
elem.sizcache=_1a8;
elem.sizset=i;
}
if(elem.nodeName===cur){
_1b0=elem;
break;
}
elem=elem[dir];
}
_1a9[i]=_1b0;
}
}
}
function dirCheck(dir,cur,_1b3,_1b4,_1b5,_1b6){
var _1b7=dir=="previousSibling"&&!_1b6;
for(var i=0,l=_1b4.length;i<l;i++){
var elem=_1b4[i];
if(elem){
if(_1b7&&elem.nodeType===1){
elem.sizcache=_1b3;
elem.sizset=i;
}
elem=elem[dir];
var _1bb=false;
while(elem){
if(elem.sizcache===_1b3){
_1bb=_1b4[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_1b6){
elem.sizcache=_1b3;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_1bb=true;
break;
}
}else{
if(_aa.filter(cur,[elem]).length>0){
_1bb=elem;
break;
}
}
}
elem=elem[dir];
}
_1b4[i]=_1bb;
}
}
}
var _c2=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _b9=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _bc=function(_1c1,_1c2){
var _1c3=[],_1c4="",_1c5,root=_1c2.nodeType?[_1c2]:_1c2;
while((_1c5=_bb.match.PSEUDO.exec(_1c1))){
_1c4+=_1c5[0];
_1c1=_1c1.replace(_bb.match.PSEUDO,"");
}
_1c1=_bb.relative[_1c1]?_1c1+"*":_1c1;
for(var i=0,l=root.length;i<l;i++){
_aa(_1c1,root[i],_1c3);
}
return _aa.filter(_1c4,_1c3);
};
Playdar.Util.select=_aa;
})();

