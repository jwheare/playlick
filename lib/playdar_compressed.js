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
if(!Playdar.scrobbler&&Playdar.USE_SCROBBLER&&_10.capabilities.audioscrobbler){
new Playdar.Scrobbler();
}
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
return this.get_base_url("/settings/auth/",{revoke:this.auth_token,jsonp:"Playdar.Util.null_callback"});
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
var _1b=_1a[i];
var _1c=Playdar.Util.select(".contributor",_1b);
var _1d=Playdar.Util.select(".fn",_1b);
if(_1d[0]&&_1c[0]){
var _1e={"artist":_1c[0].title||_1c[0].innerHTML,"name":_1d[0].title||_1d[0].innerHTML,"element":_1b};
_19.push(_1e);
}
}
return _19;
},autodetect:function(_1f,_20){
var _21,qid;
var _22=this.parse_microformats(_20);
for(var i=0;i<_22.length;i++){
_21=_22[i];
if(_1f){
qid=_1f(_21);
}
Playdar.client.resolve(_21.artist,"",_21.name,qid);
}
},resolve:function(_23,_24,_25,qid,url){
var _26={artist:_23||"",album:_24||"",track:_25||"",url:url||"",qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.resolution_queue.push(_26);
this.process_resolution_queue();
},process_resolution_queue:function(){
if(this.resolutions_in_progress.count>=Playdar.MAX_CONCURRENT_RESOLUTIONS){
return false;
}
var _27=this.resolution_queue.length+this.resolutions_in_progress.count;
if(_27){
var _28=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_28;i++){
var _29=this.resolution_queue.shift();
if(!_29){
break;
}
this.resolutions_in_progress.queries[_29.qid]=_29;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_29));
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
var _2a={qid:qid};
this.resolutions_in_progress.queries[qid]=_2a;
this.resolutions_in_progress.count++;
this.handle_resolution(_2a);
},handle_resolution:function(_2b){
if(this.resolutions_in_progress.queries[_2b.qid]){
this.last_qid=_2b.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_2b.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_2c,_2d,_2e){
var _2f=this.should_stop_polling(_2c);
_2e=_2e||this;
if(!_2f){
setTimeout(function(){
_2d.call(_2e,_2c.qid);
},Playdar.REFRESH_INTERVAL||_2c.refresh_interval);
}
return _2f;
},should_stop_polling:function(_30){
if(_30.refresh_interval<=0){
return true;
}
if(_30.query.solved==true){
return true;
}
if(this.poll_counts[_30.qid]>=4){
return true;
}
return false;
},handle_results:function(_31){
if(this.resolutions_in_progress.queries[_31.qid]){
var _32=this.poll_results(_31,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_31,_32);
}
if(this.results_handlers[_31.qid]){
this.results_handlers[_31.qid](_31,_32);
}else{
this.listeners.onResults(_31,_32);
}
if(_32){
delete this.resolutions_in_progress.queries[_31.qid];
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
},get_base_url:function(_33,_34){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_33){
url+=_33;
}
if(_34){
url+="?"+Playdar.Util.toQueryString(_34);
}
return url;
},get_url:function(_35,_36,_37){
_37=_37||{};
_37.call_id=new Date().getTime();
_37.method=_35;
if(!_37.jsonp){
if(_36.join){
_37.jsonp=_36.join(".");
}else{
_37.jsonp=this.jsonp_callback(_36);
}
}
this.add_auth_token(_37);
return this.get_base_url("/api/",_37);
},add_auth_token:function(_38){
if(this.auth_token){
_38.auth=this.auth_token;
}
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_39){
return "Playdar.client."+_39;
},list_results:function(_3a){
for(var i=0;i<_3a.results.length;i++){
console.log(_3a.results[i].name);
}
}};
Playdar.Boffin=function(){
Playdar.boffin=this;
};
Playdar.Boffin.prototype={get_url:function(_3b,_3c){
_3c=_3c||{};
_3c.jsonp=_3c.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_3c);
return Playdar.client.get_base_url("/boffin/"+_3b,_3c);
},get_tagcloud:function(){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
Playdar.Util.loadjs(this.get_url("tagcloud",{jsonp:"Playdar.boffin.handle_tagcloud"}));
},handle_tagcloud:function(_3d){
Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud,_3d.qid);
Playdar.client.get_results(_3d.qid);
},get_tag_rql:function(tag){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
var rql="tag:\""+tag+"\"";
Playdar.Util.loadjs(this.get_url("rql/"+encodeURIComponent(rql),{jsonp:"Playdar.boffin.handle_rql"}));
},handle_rql:function(_3e){
Playdar.client.register_results_handler(Playdar.client.listeners.onRQL,_3e.qid);
Playdar.client.get_results(_3e.qid);
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_3f,_40){
_40=_40||{};
_40.jsonp=_40.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_40);
return Playdar.client.get_base_url("/audioscrobbler/"+_3f,_40);
},start:function(_41,_42,_43,_44,_45,_46){
var _47={a:_41,t:_42,o:"P"};
if(_43){
_47["b"]=_43;
}
if(_44){
_47["l"]=_44;
}
if(_45){
_47["n"]=_45;
}
if(_46){
_47["m"]=_46;
}
Playdar.Util.loadjs(this.get_url("start",_47));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_options:function(_48,_49){
var _4a=this;
return {onplay:function(){
this.scrobbleStart=true;
Playdar.Util.call_optional(_49,"onplay",this,arguments);
},onbufferchange:function(){
if(!this.isBuffering){
if(this.scrobbleStart){
this.scrobbleStart=false;
_4a.start(_48.artist,_48.track,_48.album,_48.duration);
}
}
Playdar.Util.call_optional(_49,"onbufferchange",this,arguments);
},onpause:function(){
_4a.pause();
Playdar.Util.call_optional(_49,"onpause",this,arguments);
},onresume:function(){
_4a.resume();
Playdar.Util.call_optional(_49,"onresume",this,arguments);
},onstop:function(){
_4a.stop();
Playdar.Util.call_optional(_49,"onstop",this,arguments);
},onfinish:function(){
_4a.stop();
Playdar.Util.call_optional(_49,"onfinish",this,arguments);
}};
}};
Playdar.Player=function(_4b){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_4b;
};
Playdar.Player.prototype={register_stream:function(_4c,_4d){
this.streams[_4c.sid]=_4c;
var _4e=Playdar.Util.extend_object({id:_4c.sid,url:Playdar.client.get_stream_url(_4c.sid)},_4d);
if(Playdar.status_bar){
Playdar.Util.extend_object(_4e,Playdar.status_bar.get_sound_options(_4c,_4d));
}
if(Playdar.scrobbler){
Playdar.Util.extend_object(_4e,Playdar.scrobbler.get_sound_options(_4c,_4d));
}
return this.soundmanager.createSound(_4e);
},play_stream:function(sid){
var _4f=this.soundmanager.getSoundById(sid);
if(this.nowplayingid!=sid){
this.stop_all();
if(_4f.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_4f.togglePause();
return _4f;
},stop_all:function(){
if(this.nowplayingid){
var _50=this.soundmanager.getSoundById(this.nowplayingid);
_50.stop();
_50.setPosition(1);
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
var _51=document.createElement("div");
_51.style.position="fixed";
_51.style.bottom=0;
_51.style.left=0;
_51.style.zIndex=100;
_51.style.width="100%";
_51.style.height="36px";
_51.style.padding="7px 0";
_51.style.borderTop="2px solid #4c7a0f";
_51.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_51.style.color="#335507";
_51.style.background="#e8f9bb";
var _52=document.createElement("div");
_52.style.padding="0 7px";
var _53="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_52.innerHTML=_53;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_52.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _54=document.createElement("p");
_54.style.margin="0";
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
_54.appendChild(this.track_link);
this.playback.appendChild(_54);
var _55=document.createElement("table");
_55.setAttribute("cellpadding",0);
_55.setAttribute("cellspacing",0);
_55.setAttribute("border",0);
_55.style.color="#4c7a0f";
_55.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _56=document.createElement("tbody");
var _57=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_57.appendChild(this.track_elapsed);
var _58=document.createElement("td");
_58.style.padding="0 5px";
_58.style.verticalAlign="middle";
var _59=document.createElement("div");
_59.style.width=this.progress_bar_width+"px";
_59.style.height="9px";
_59.style.border="1px solid #4c7a0f";
_59.style.background="#fff";
_59.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_59.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_59.appendChild(this.playhead);
_59.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_58.appendChild(_59);
_57.appendChild(_58);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_57.appendChild(this.track_duration);
_56.appendChild(_57);
_55.appendChild(_56);
this.playback.appendChild(_55);
_52.appendChild(this.playback);
var _5a=document.createElement("div");
_5a.style.cssFloat="right";
_5a.style.padding="0 8px";
_5a.style.textAlign="right";
var _5b=document.createElement("p");
_5b.style.margin=0;
_5b.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_5a.appendChild(_5b);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML="<a href=\""+this.get_queries_popup_url()+"\" target=\""+Playdar.QUERIES_POPUP_NAME+"\" onclick=\"Playdar.status_bar.open_queries_popup(); return false;"+"\">Tracks</a>"+" | "+Playdar.client.get_disconnect_link_html();
_5a.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_51.appendChild(_5a);
_51.appendChild(_52);
document.body.appendChild(_51);
var _5c=document.body.style.marginBottom;
if(!_5c){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_5c=css.marginBottom;
}
}
document.body.style.marginBottom=(_5c.replace("px","")-0)+36+(7*2)+2+"px";
return _51;
},ready:function(){
this.playdar_links.style.display="";
var _5d="Ready";
this.status.innerHTML=_5d;
},offline:function(){
this.playdar_links.style.display="none";
var _5e=Playdar.client.get_auth_link_html();
this.status.innerHTML=_5e;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _5f="manualAuth_"+Playdar.client.uuid;
var _60="<input type=\"text\" id=\""+_5f+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_5f+"'); return false;"+"\" />";
this.status.innerHTML=_60;
},handle_stat:function(_61){
if(_61.authenticated){
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
var _62=" ";
if(this.pending_count){
_62+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_62+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_62;
}
},handle_results:function(_63,_64){
if(_64){
this.pending_count--;
if(_63.results.length){
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
},get_sound_options:function(_65,_66){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
Playdar.Util.call_optional(_66,"whileplaying",this,arguments);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
Playdar.Util.call_optional(_66,"whileloading",this,arguments);
}};
},play_handler:function(_67){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_67.sid);
this.track_link.title=_67.source;
this.track_name.innerHTML=_67.track;
this.artist_name.innerHTML=_67.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_67.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_68){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_68.position/1000));
var _69;
if(_68.readyState==3){
_69=_68.duration;
}else{
_69=_68.durationEstimate;
}
var _6a=_68.position/_69;
this.playhead.style.width=Math.round(_6a*this.progress_bar_width)+"px";
},loading_handler:function(_6b){
var _6c=_6b.bytesLoaded/_6b.bytesTotal;
this.bufferhead.style.width=Math.round(_6c*this.progress_bar_width)+"px";
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
var _6d="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _6e=[];
var rnd=Math.random;
var r;
_6e[8]=_6e[13]=_6e[18]=_6e[23]="-";
_6e[14]="4";
for(var i=0;i<36;i++){
if(!_6e[i]){
r=0|rnd()*16;
_6e[i]=_6d[(i==19)?(r&3)|8:r&15];
}
}
return _6e.join("");
},toQueryPair:function(key,_6f){
if(_6f===null){
return key;
}
return key+"="+encodeURIComponent(_6f);
},toQueryString:function(_70){
var _71=[];
for(var key in _70){
var _72=_70[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_72)=="[object Array]"){
for(var i=0;i<_72.length;i++){
_71.push(Playdar.Util.toQueryPair(key,_72[i]));
}
}else{
_71.push(Playdar.Util.toQueryPair(key,_72));
}
}
return _71.join("&");
},mmss:function(_73){
var s=_73%60;
if(s<10){
s="0"+s;
}
return Math.floor(_73/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_74,_75,_76){
if(_76){
var _77=new Date();
_77.setTime(_77.getTime()+(_76*24*60*60*1000));
var _78="; expires="+_77.toGMTString();
}else{
var _78="";
}
document.cookie="PD_"+_74+"="+_75+_78+"; path=/";
},getcookie:function(_79){
var _7a="PD_"+_79+"=";
var _7b=document.cookie.split(";");
for(var i=0;i<_7b.length;i++){
var c=_7b[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_7a)==0){
return c.substring(_7a.length,c.length);
}
}
return null;
},deletecookie:function(_7c){
Playdar.Util.setcookie(_7c,"",-1);
},get_window_position:function(){
var _7d={};
if(window.screenLeft){
_7d.x=window.screenLeft||0;
_7d.y=window.screenTop||0;
}else{
_7d.x=window.screenX||0;
_7d.y=window.screenY||0;
}
return _7d;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_7e){
var _7f=Playdar.Util.get_popup_location(_7e);
return ["left="+_7f.x,"top="+_7f.y,"width="+_7e.w,"height="+_7e.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_80){
var _81=Playdar.Util.get_window_position();
var _82=Playdar.Util.get_window_size();
return {"x":Math.max(0,_81.x+(_82.w-_80.w)/2),"y":Math.max(0,_81.y+(_82.h-_80.h)/2)};
},addEvent:function(obj,_83,fn){
if(obj.attachEvent){
obj["e"+_83+fn]=fn;
obj[_83+fn]=function(){
obj["e"+_83+fn](window.event);
};
obj.attachEvent("on"+_83,obj[_83+fn]);
}else{
obj.addEventListener(_83,fn,false);
}
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_84,_85){
_85=_85||{};
for(var _86 in _85){
_84[_86]=_85[_86];
}
return _84;
},call_optional:function(obj,_87,_88,_89){
if(obj&&obj[_87]){
obj[_87].apply(_88,_89);
}
},log:function(_8a){
if(typeof console!="undefined"){
console.dir(_8a);
}
},null_callback:function(){
}};
Playdar.Util.addEvent(window,"unload",function(){
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
});
(function(){
var _8b=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_8c=0,_8d=Object.prototype.toString,_8e=false;
var _8f=function(_90,_91,_92,_93){
_92=_92||[];
var _94=_91=_91||document;
if(_91.nodeType!==1&&_91.nodeType!==9){
return [];
}
if(!_90||typeof _90!=="string"){
return _92;
}
var _95=[],m,set,_96,_97,_98,_99,_9a=true,_9b=_9c(_91);
_8b.lastIndex=0;
while((m=_8b.exec(_90))!==null){
_95.push(m[1]);
if(m[2]){
_99=RegExp.rightContext;
break;
}
}
if(_95.length>1&&_9d.exec(_90)){
if(_95.length===2&&_9e.relative[_95[0]]){
set=_9f(_95[0]+_95[1],_91);
}else{
set=_9e.relative[_95[0]]?[_91]:_8f(_95.shift(),_91);
while(_95.length){
_90=_95.shift();
if(_9e.relative[_90]){
_90+=_95.shift();
}
set=_9f(_90,set);
}
}
}else{
if(!_93&&_95.length>1&&_91.nodeType===9&&!_9b&&_9e.match.ID.test(_95[0])&&!_9e.match.ID.test(_95[_95.length-1])){
var ret=_8f.find(_95.shift(),_91,_9b);
_91=ret.expr?_8f.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_91){
var ret=_93?{expr:_95.pop(),set:_a0(_93)}:_8f.find(_95.pop(),_95.length===1&&(_95[0]==="~"||_95[0]==="+")&&_91.parentNode?_91.parentNode:_91,_9b);
set=ret.expr?_8f.filter(ret.expr,ret.set):ret.set;
if(_95.length>0){
_96=_a0(set);
}else{
_9a=false;
}
while(_95.length){
var cur=_95.pop(),pop=cur;
if(!_9e.relative[cur]){
cur="";
}else{
pop=_95.pop();
}
if(pop==null){
pop=_91;
}
_9e.relative[cur](_96,pop,_9b);
}
}else{
_96=_95=[];
}
}
if(!_96){
_96=set;
}
if(!_96){
throw "Syntax error, unrecognized expression: "+(cur||_90);
}
if(_8d.call(_96)==="[object Array]"){
if(!_9a){
_92.push.apply(_92,_96);
}else{
if(_91&&_91.nodeType===1){
for(var i=0;_96[i]!=null;i++){
if(_96[i]&&(_96[i]===true||_96[i].nodeType===1&&_a1(_91,_96[i]))){
_92.push(set[i]);
}
}
}else{
for(var i=0;_96[i]!=null;i++){
if(_96[i]&&_96[i].nodeType===1){
_92.push(set[i]);
}
}
}
}
}else{
_a0(_96,_92);
}
if(_99){
_8f(_99,_94,_92,_93);
_8f.uniqueSort(_92);
}
return _92;
};
_8f.uniqueSort=function(_a2){
if(_a3){
_8e=false;
_a2.sort(_a3);
if(_8e){
for(var i=1;i<_a2.length;i++){
if(_a2[i]===_a2[i-1]){
_a2.splice(i--,1);
}
}
}
}
};
_8f.matches=function(_a4,set){
return _8f(_a4,null,null,set);
};
_8f.find=function(_a5,_a6,_a7){
var set,_a8;
if(!_a5){
return [];
}
for(var i=0,l=_9e.order.length;i<l;i++){
var _a9=_9e.order[i],_a8;
if((_a8=_9e.match[_a9].exec(_a5))){
var _aa=RegExp.leftContext;
if(_aa.substr(_aa.length-1)!=="\\"){
_a8[1]=(_a8[1]||"").replace(/\\/g,"");
set=_9e.find[_a9](_a8,_a6,_a7);
if(set!=null){
_a5=_a5.replace(_9e.match[_a9],"");
break;
}
}
}
}
if(!set){
set=_a6.getElementsByTagName("*");
}
return {set:set,expr:_a5};
};
_8f.filter=function(_ab,set,_ac,not){
var old=_ab,_ad=[],_ae=set,_af,_b0,_b1=set&&set[0]&&_9c(set[0]);
while(_ab&&set.length){
for(var _b2 in _9e.filter){
if((_af=_9e.match[_b2].exec(_ab))!=null){
var _b3=_9e.filter[_b2],_b4,_b5;
_b0=false;
if(_ae==_ad){
_ad=[];
}
if(_9e.preFilter[_b2]){
_af=_9e.preFilter[_b2](_af,_ae,_ac,_ad,not,_b1);
if(!_af){
_b0=_b4=true;
}else{
if(_af===true){
continue;
}
}
}
if(_af){
for(var i=0;(_b5=_ae[i])!=null;i++){
if(_b5){
_b4=_b3(_b5,_af,i,_ae);
var _b6=not^!!_b4;
if(_ac&&_b4!=null){
if(_b6){
_b0=true;
}else{
_ae[i]=false;
}
}else{
if(_b6){
_ad.push(_b5);
_b0=true;
}
}
}
}
}
if(_b4!==undefined){
if(!_ac){
_ae=_ad;
}
_ab=_ab.replace(_9e.match[_b2],"");
if(!_b0){
return [];
}
break;
}
}
}
if(_ab==old){
if(_b0==null){
throw "Syntax error, unrecognized expression: "+_ab;
}else{
break;
}
}
old=_ab;
}
return _ae;
};
var _9e=_8f.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_b7){
return _b7.getAttribute("href");
}},relative:{"+":function(_b8,_b9,_ba){
var _bb=typeof _b9==="string",_bc=_bb&&!(/\W/).test(_b9),_bd=_bb&&!_bc;
if(_bc&&!_ba){
_b9=_b9.toUpperCase();
}
for(var i=0,l=_b8.length,_be;i<l;i++){
if((_be=_b8[i])){
while((_be=_be.previousSibling)&&_be.nodeType!==1){
}
_b8[i]=_bd||_be&&_be.nodeName===_b9?_be||false:_be===_b9;
}
}
if(_bd){
_8f.filter(_b9,_b8,true);
}
},">":function(_bf,_c0,_c1){
var _c2=typeof _c0==="string";
if(_c2&&!(/\W/).test(_c0)){
_c0=_c1?_c0:_c0.toUpperCase();
for(var i=0,l=_bf.length;i<l;i++){
var _c3=_bf[i];
if(_c3){
var _c4=_c3.parentNode;
_bf[i]=_c4.nodeName===_c0?_c4:false;
}
}
}else{
for(var i=0,l=_bf.length;i<l;i++){
var _c3=_bf[i];
if(_c3){
_bf[i]=_c2?_c3.parentNode:_c3.parentNode===_c0;
}
}
if(_c2){
_8f.filter(_c0,_bf,true);
}
}
},"":function(_c5,_c6,_c7){
var _c8=_8c++,_c9=_ca;
if(!_c6.match(/\W/)){
var _cb=_c6=_c7?_c6:_c6.toUpperCase();
_c9=_cc;
}
_c9("parentNode",_c6,_c8,_c5,_cb,_c7);
},"~":function(_cd,_ce,_cf){
var _d0=_8c++,_d1=_ca;
if(typeof _ce==="string"&&!_ce.match(/\W/)){
var _d2=_ce=_cf?_ce:_ce.toUpperCase();
_d1=_cc;
}
_d1("previousSibling",_ce,_d0,_cd,_d2,_cf);
}},find:{ID:function(_d3,_d4,_d5){
if(typeof _d4.getElementById!=="undefined"&&!_d5){
var m=_d4.getElementById(_d3[1]);
return m?[m]:[];
}
},NAME:function(_d6,_d7,_d8){
if(typeof _d7.getElementsByName!=="undefined"){
var ret=[],_d9=_d7.getElementsByName(_d6[1]);
for(var i=0,l=_d9.length;i<l;i++){
if(_d9[i].getAttribute("name")===_d6[1]){
ret.push(_d9[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_da,_db){
return _db.getElementsByTagName(_da[1]);
}},preFilter:{CLASS:function(_dc,_dd,_de,_df,not,_e0){
_dc=" "+_dc[1].replace(/\\/g,"")+" ";
if(_e0){
return _dc;
}
for(var i=0,_e1;(_e1=_dd[i])!=null;i++){
if(_e1){
if(not^(_e1.className&&(" "+_e1.className+" ").indexOf(_dc)>=0)){
if(!_de){
_df.push(_e1);
}
}else{
if(_de){
_dd[i]=false;
}
}
}
}
return false;
},ID:function(_e2){
return _e2[1].replace(/\\/g,"");
},TAG:function(_e3,_e4){
for(var i=0;_e4[i]===false;i++){
}
return _e4[i]&&_9c(_e4[i])?_e3[1]:_e3[1].toUpperCase();
},CHILD:function(_e5){
if(_e5[1]=="nth"){
var _e6=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_e5[2]=="even"&&"2n"||_e5[2]=="odd"&&"2n+1"||!(/\D/).test(_e5[2])&&"0n+"+_e5[2]||_e5[2]);
_e5[2]=(_e6[1]+(_e6[2]||1))-0;
_e5[3]=_e6[3]-0;
}
_e5[0]=_8c++;
return _e5;
},ATTR:function(_e7,_e8,_e9,_ea,not,_eb){
var _ec=_e7[1].replace(/\\/g,"");
if(!_eb&&_9e.attrMap[_ec]){
_e7[1]=_9e.attrMap[_ec];
}
if(_e7[2]==="~="){
_e7[4]=" "+_e7[4]+" ";
}
return _e7;
},PSEUDO:function(_ed,_ee,_ef,_f0,not){
if(_ed[1]==="not"){
if(_ed[3].match(_8b).length>1||(/^\w/).test(_ed[3])){
_ed[3]=_8f(_ed[3],null,null,_ee);
}else{
var ret=_8f.filter(_ed[3],_ee,_ef,true^not);
if(!_ef){
_f0.push.apply(_f0,ret);
}
return false;
}
}else{
if(_9e.match.POS.test(_ed[0])||_9e.match.CHILD.test(_ed[0])){
return true;
}
}
return _ed;
},POS:function(_f1){
_f1.unshift(true);
return _f1;
}},filters:{enabled:function(_f2){
return _f2.disabled===false&&_f2.type!=="hidden";
},disabled:function(_f3){
return _f3.disabled===true;
},checked:function(_f4){
return _f4.checked===true;
},selected:function(_f5){
_f5.parentNode.selectedIndex;
return _f5.selected===true;
},parent:function(_f6){
return !!_f6.firstChild;
},empty:function(_f7){
return !_f7.firstChild;
},has:function(_f8,i,_f9){
return !!_8f(_f9[3],_f8).length;
},header:function(_fa){
return (/h\d/i).test(_fa.nodeName);
},text:function(_fb){
return "text"===_fb.type;
},radio:function(_fc){
return "radio"===_fc.type;
},checkbox:function(_fd){
return "checkbox"===_fd.type;
},file:function(_fe){
return "file"===_fe.type;
},password:function(_ff){
return "password"===_ff.type;
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
},last:function(elem,i,_100,_101){
return i===_101.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_102){
return i<_102[3]-0;
},gt:function(elem,i,_103){
return i>_103[3]-0;
},nth:function(elem,i,_104){
return _104[3]-0==i;
},eq:function(elem,i,_105){
return _105[3]-0==i;
}},filter:{PSEUDO:function(elem,_106,i,_107){
var name=_106[1],_108=_9e.filters[name];
if(_108){
return _108(elem,i,_106,_107);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_106[3])>=0;
}else{
if(name==="not"){
var not=_106[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_109){
var type=_109[1],node=elem;
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
var _10a=_109[2],last=_109[3];
if(_10a==1&&last==0){
return true;
}
var _10b=_109[0],_10c=elem.parentNode;
if(_10c&&(_10c.sizcache!==_10b||!elem.nodeIndex)){
var _10d=0;
for(node=_10c.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_10d;
}
}
_10c.sizcache=_10b;
}
var diff=elem.nodeIndex-last;
if(_10a==0){
return diff==0;
}else{
return (diff%_10a==0&&diff/_10a>=0);
}
}
},ID:function(elem,_10e){
return elem.nodeType===1&&elem.getAttribute("id")===_10e;
},TAG:function(elem,_10f){
return (_10f==="*"&&elem.nodeType===1)||elem.nodeName===_10f;
},CLASS:function(elem,_110){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_110)>-1;
},ATTR:function(elem,_111){
var name=_111[1],_112=_9e.attrHandle[name]?_9e.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_113=_112+"",type=_111[2],_114=_111[4];
return _112==null?type==="!=":type==="="?_113===_114:type==="*="?_113.indexOf(_114)>=0:type==="~="?(" "+_113+" ").indexOf(_114)>=0:!_114?_113&&_112!==false:type==="!="?_113!=_114:type==="^="?_113.indexOf(_114)===0:type==="$="?_113.substr(_113.length-_114.length)===_114:type==="|="?_113===_114||_113.substr(0,_114.length+1)===_114+"-":false;
},POS:function(elem,_115,i,_116){
var name=_115[2],_117=_9e.setFilters[name];
if(_117){
return _117(elem,i,_115,_116);
}
}}};
var _9d=_9e.match.POS;
for(var type in _9e.match){
_9e.match[type]=new RegExp(_9e.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _a0=function(_118,_119){
_118=Array.prototype.slice.call(_118);
if(_119){
_119.push.apply(_119,_118);
return _119;
}
return _118;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_a0=function(_11a,_11b){
var ret=_11b||[];
if(_8d.call(_11a)==="[object Array]"){
Array.prototype.push.apply(ret,_11a);
}else{
if(typeof _11a.length==="number"){
for(var i=0,l=_11a.length;i<l;i++){
ret.push(_11a[i]);
}
}else{
for(var i=0;_11a[i];i++){
ret.push(_11a[i]);
}
}
}
return ret;
};
}
var _a3;
if(document.documentElement.compareDocumentPosition){
_a3=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_8e=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_a3=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_8e=true;
}
return ret;
};
}else{
if(document.createRange){
_a3=function(a,b){
var _11c=a.ownerDocument.createRange(),_11d=b.ownerDocument.createRange();
_11c.selectNode(a);
_11c.collapse(true);
_11d.selectNode(b);
_11d.collapse(true);
var ret=_11c.compareBoundaryPoints(Range.START_TO_END,_11d);
if(ret===0){
_8e=true;
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
_9e.find.ID=function(_11e,_11f,_120){
if(typeof _11f.getElementById!=="undefined"&&!_120){
var m=_11f.getElementById(_11e[1]);
return m?m.id===_11e[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_11e[1]?[m]:undefined:[];
}
};
_9e.filter.ID=function(elem,_121){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_121;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_9e.find.TAG=function(_122,_123){
var _124=_123.getElementsByTagName(_122[1]);
if(_122[1]==="*"){
var tmp=[];
for(var i=0;_124[i];i++){
if(_124[i].nodeType===1){
tmp.push(_124[i]);
}
}
_124=tmp;
}
return _124;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_9e.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _125=_8f,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_8f=function(_126,_127,_128,seed){
_127=_127||document;
if(!seed&&_127.nodeType===9&&!_9c(_127)){
try{
return _a0(_127.querySelectorAll(_126),_128);
}
catch(e){
}
}
return _125(_126,_127,_128,seed);
};
for(var prop in _125){
_8f[prop]=_125[prop];
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
_9e.order.splice(1,0,"CLASS");
_9e.find.CLASS=function(_129,_12a,_12b){
if(typeof _12a.getElementsByClassName!=="undefined"&&!_12b){
return _12a.getElementsByClassName(_129[1]);
}
};
})();
}
function _cc(dir,cur,_12c,_12d,_12e,_12f){
var _130=dir=="previousSibling"&&!_12f;
for(var i=0,l=_12d.length;i<l;i++){
var elem=_12d[i];
if(elem){
if(_130&&elem.nodeType===1){
elem.sizcache=_12c;
elem.sizset=i;
}
elem=elem[dir];
var _131=false;
while(elem){
if(elem.sizcache===_12c){
_131=_12d[elem.sizset];
break;
}
if(elem.nodeType===1&&!_12f){
elem.sizcache=_12c;
elem.sizset=i;
}
if(elem.nodeName===cur){
_131=elem;
break;
}
elem=elem[dir];
}
_12d[i]=_131;
}
}
};
function _ca(dir,cur,_132,_133,_134,_135){
var _136=dir=="previousSibling"&&!_135;
for(var i=0,l=_133.length;i<l;i++){
var elem=_133[i];
if(elem){
if(_136&&elem.nodeType===1){
elem.sizcache=_132;
elem.sizset=i;
}
elem=elem[dir];
var _137=false;
while(elem){
if(elem.sizcache===_132){
_137=_133[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_135){
elem.sizcache=_132;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_137=true;
break;
}
}else{
if(_8f.filter(cur,[elem]).length>0){
_137=elem;
break;
}
}
}
elem=elem[dir];
}
_133[i]=_137;
}
}
};
var _a1=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _9c=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _9f=function(_138,_139){
var _13a=[],_13b="",_13c,root=_139.nodeType?[_139]:_139;
while((_13c=_9e.match.PSEUDO.exec(_138))){
_13b+=_13c[0];
_138=_138.replace(_9e.match.PSEUDO,"");
}
_138=_9e.relative[_138]?_138+"*":_138;
for(var i=0,l=root.length;i<l;i++){
_8f(_138,root[i],_13a);
}
return _8f.filter(_13b,_13a);
};
Playdar.Util.select=_8f;
})();

