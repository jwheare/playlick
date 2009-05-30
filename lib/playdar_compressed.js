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
var _2b=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_2b;i++){
var _2d=this.resolution_queue.shift();
if(!_2d){
break;
}
this.resolutions_in_progress.queries[_2d.qid]=_2d;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_2d));
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
var _2f={qid:qid};
this.resolutions_in_progress.queries[qid]=_2f;
this.resolutions_in_progress.count++;
this.handle_resolution(_2f);
},handle_resolution:function(_30){
if(this.resolutions_in_progress.queries[_30.qid]){
this.last_qid=_30.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_30.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_32,_33,_34){
var _35=this.should_stop_polling(_32);
_34=_34||this;
if(!_35){
setTimeout(function(){
_33.call(_34,_32.qid);
},Playdar.REFRESH_INTERVAL||_32.refresh_interval);
}
return _35;
},should_stop_polling:function(_36){
if(_36.refresh_interval<=0){
return true;
}
if(_36.query.solved==true){
return true;
}
if(this.poll_counts[_36.qid]>=4){
return true;
}
return false;
},handle_results:function(_37){
if(this.resolutions_in_progress.queries[_37.qid]){
var _38=this.poll_results(_37,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_37,_38);
}
if(_38){
delete this.resolutions_in_progress.queries[_37.qid];
this.resolutions_in_progress.count--;
this.process_resolution_queue();
}
if(this.results_handlers[_37.qid]){
this.results_handlers[_37.qid](_37,_38);
}else{
this.listeners.onResults(_37,_38);
}
}
},get_last_results:function(){
if(this.last_qid){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.get_results(this.last_qid);
}
},get_base_url:function(_39,_3a){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_39){
url+=_39;
}
if(_3a){
url+="?"+Playdar.Util.toQueryString(_3a);
}
return url;
},get_url:function(_3c,_3d,_3e){
_3e=_3e||{};
_3e.call_id=new Date().getTime();
_3e.method=_3c;
if(!_3e.jsonp){
if(_3d.join){
_3e.jsonp=_3d.join(".");
}else{
_3e.jsonp=this.jsonp_callback(_3d);
}
}
this.add_auth_token(_3e);
return this.get_base_url("/api/",_3e);
},add_auth_token:function(_3f){
if(this.auth_token){
_3f.auth=this.auth_token;
}
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_41){
return "Playdar.client."+_41;
},list_results:function(_42){
for(var i=0;i<_42.results.length;i++){
console.log(_42.results[i].name);
}
}};
Playdar.Boffin=function(){
Playdar.boffin=this;
};
Playdar.Boffin.prototype={get_url:function(_44,_45){
_45=_45||{};
_45.jsonp=_45.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_45);
return Playdar.client.get_base_url("/boffin/"+_44,_45);
},get_tagcloud:function(){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
Playdar.Util.loadjs(this.get_url("tagcloud",{jsonp:"Playdar.boffin.handle_tagcloud"}));
},handle_tagcloud:function(_46){
Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud,_46.qid);
Playdar.client.get_results(_46.qid);
},get_tag_rql:function(tag){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
var rql="tag:\""+tag+"\"";
Playdar.Util.loadjs(this.get_url("rql/"+encodeURIComponent(rql),{jsonp:"Playdar.boffin.handle_rql"}));
},handle_rql:function(_49){
Playdar.client.register_results_handler(Playdar.client.listeners.onRQL,_49.qid);
Playdar.client.get_results(_49.qid);
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_4a,_4b){
_4b=_4b||{};
_4b.jsonp=_4b.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_4b);
return Playdar.client.get_base_url("/audioscrobbler/"+_4a,_4b);
},start:function(_4c,_4d,_4e,_4f,_50,_51){
var _52={a:_4c,t:_4d,o:"P"};
if(_4e){
_52["b"]=_4e;
}
if(_4f){
_52["l"]=_4f;
}
if(_50){
_52["n"]=_50;
}
if(_51){
_52["m"]=_51;
}
Playdar.Util.loadjs(this.get_url("start",_52));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_options:function(_53,_54){
var _55=this;
return {onplay:function(){
_55.start(_53.artist,_53.track,_53.album,_53.duration);
Playdar.Util.apply_property_function(_54,"onplay",this,arguments);
},onbufferchange:function(){
if(this.isBuffering){
_55.pause();
}else{
_55.resume();
}
Playdar.Util.apply_property_function(_54,"onbufferchange",this,arguments);
},onpause:function(){
_55.pause();
Playdar.Util.apply_property_function(_54,"onpause",this,arguments);
},onresume:function(){
_55.resume();
Playdar.Util.apply_property_function(_54,"onresume",this,arguments);
},onstop:function(){
_55.stop();
Playdar.Util.apply_property_function(_54,"onstop",this,arguments);
},onfinish:function(){
_55.stop();
Playdar.Util.apply_property_function(_54,"onfinish",this,arguments);
}};
}};
Playdar.Player=function(_56){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_56;
if(Playdar.USE_SCROBBLER){
new Playdar.Scrobbler();
}
};
Playdar.Player.prototype={register_stream:function(_57,_58){
this.streams[_57.sid]=_57;
var _59=Playdar.Util.extend_object({id:_57.sid,url:Playdar.client.get_stream_url(_57.sid)},_58);
if(Playdar.status_bar){
Playdar.Util.extend_object(_59,Playdar.status_bar.get_sound_options(_57,_58));
}
if(Playdar.scrobbler){
Playdar.Util.extend_object(_59,Playdar.scrobbler.get_sound_options(_57,_58));
}
return this.soundmanager.createSound(_59);
},play_stream:function(sid){
var _5b=this.soundmanager.getSoundById(sid);
if(this.nowplayingid!=sid){
this.stop_all();
if(_5b.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_5b.togglePause();
return _5b;
},stop_all:function(){
if(this.nowplayingid){
var _5c=this.soundmanager.getSoundById(this.nowplayingid);
_5c.stop();
_5c.setPosition(1);
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
var _5e=document.createElement("div");
_5e.style.position="fixed";
_5e.style.bottom=0;
_5e.style.left=0;
_5e.style.zIndex=100;
_5e.style.width="100%";
_5e.style.height="36px";
_5e.style.padding="7px 0";
_5e.style.borderTop="2px solid #4c7a0f";
_5e.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_5e.style.color="#335507";
_5e.style.background="#e8f9bb";
var _5f=document.createElement("div");
_5f.style.padding="0 7px";
var _60="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_5f.innerHTML=_60;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_5f.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _61=document.createElement("p");
_61.style.margin="0";
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
_61.appendChild(this.track_link);
this.playback.appendChild(_61);
var _62=document.createElement("table");
_62.setAttribute("cellpadding",0);
_62.setAttribute("cellspacing",0);
_62.setAttribute("border",0);
_62.style.color="#4c7a0f";
_62.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _63=document.createElement("tbody");
var _64=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_64.appendChild(this.track_elapsed);
var _65=document.createElement("td");
_65.style.padding="0 5px";
_65.style.verticalAlign="middle";
var _66=document.createElement("div");
_66.style.width=this.progress_bar_width+"px";
_66.style.height="9px";
_66.style.border="1px solid #4c7a0f";
_66.style.background="#fff";
_66.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_66.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_66.appendChild(this.playhead);
_66.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_65.appendChild(_66);
_64.appendChild(_65);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_64.appendChild(this.track_duration);
_63.appendChild(_64);
_62.appendChild(_63);
this.playback.appendChild(_62);
_5f.appendChild(this.playback);
var _67=document.createElement("div");
_67.style.cssFloat="right";
_67.style.padding="0 8px";
_67.style.textAlign="right";
var _68=document.createElement("p");
_68.style.margin=0;
_68.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_67.appendChild(_68);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML="<a href=\""+this.get_queries_popup_url()+"\" target=\""+Playdar.QUERIES_POPUP_NAME+"\" onclick=\"Playdar.status_bar.open_queries_popup(); return false;"+"\">Tracks</a>"+" | "+Playdar.client.get_disconnect_link_html();
_67.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_5e.appendChild(_67);
_5e.appendChild(_5f);
document.body.appendChild(_5e);
var _69=document.body.style.marginBottom;
if(!_69){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_69=css.marginBottom;
}
}
document.body.style.marginBottom=(_69.replace("px","")-0)+36+(7*2)+2+"px";
return _5e;
},ready:function(){
this.playdar_links.style.display="";
var _6b="Ready";
this.status.innerHTML=_6b;
},offline:function(){
this.playdar_links.style.display="none";
var _6c=Playdar.client.get_auth_link_html();
this.status.innerHTML=_6c;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _6d="manualAuth_"+Playdar.client.uuid;
var _6e="<input type=\"text\" id=\""+_6d+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_6d+"'); return false;"+"\" />";
this.status.innerHTML=_6e;
},handle_stat:function(_6f){
if(_6f.authenticated){
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
var _70=" ";
if(this.pending_count){
_70+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_70+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_70;
}
},handle_results:function(_71,_72){
if(_72){
this.pending_count--;
if(_71.results.length){
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
},get_sound_options:function(_73,_74){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
Playdar.Util.apply_property_function(_74,"whileplaying",this,arguments);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
Playdar.Util.apply_property_function(_74,"whileloading",this,arguments);
}};
},play_handler:function(_75){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_75.sid);
this.track_link.title=_75.source;
this.track_name.innerHTML=_75.track;
this.artist_name.innerHTML=_75.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_75.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_76){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_76.position/1000));
var _77;
if(_76.readyState==3){
_77=_76.duration;
}else{
_77=_76.durationEstimate;
}
var _78=_76.position/_77;
this.playhead.style.width=Math.round(_78*this.progress_bar_width)+"px";
},loading_handler:function(_79){
var _7a=_79.bytesLoaded/_79.bytesTotal;
this.bufferhead.style.width=Math.round(_7a*this.progress_bar_width)+"px";
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
var _7b="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _7c=[];
var rnd=Math.random;
var r;
_7c[8]=_7c[13]=_7c[18]=_7c[23]="-";
_7c[14]="4";
for(var i=0;i<36;i++){
if(!_7c[i]){
r=0|rnd()*16;
_7c[i]=_7b[(i==19)?(r&3)|8:r&15];
}
}
return _7c.join("");
},toQueryPair:function(key,_81){
if(_81===null){
return key;
}
return key+"="+encodeURIComponent(_81);
},toQueryString:function(_82){
var _83=[];
for(var key in _82){
var _85=_82[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_85)=="[object Array]"){
for(var i=0;i<_85.length;i++){
_83.push(Playdar.Util.toQueryPair(key,_85[i]));
}
}else{
_83.push(Playdar.Util.toQueryPair(key,_85));
}
}
return _83.join("&");
},mmss:function(_87){
var s=_87%60;
if(s<10){
s="0"+s;
}
return Math.floor(_87/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_8b,_8c,_8d){
if(_8d){
var _8e=new Date();
_8e.setTime(_8e.getTime()+(_8d*24*60*60*1000));
var _8f="; expires="+_8e.toGMTString();
}else{
var _8f="";
}
document.cookie="PD_"+_8b+"="+_8c+_8f+"; path=/";
},getcookie:function(_90){
var _91="PD_"+_90+"=";
var _92=document.cookie.split(";");
for(var i=0;i<_92.length;i++){
var c=_92[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_91)==0){
return c.substring(_91.length,c.length);
}
}
return null;
},deletecookie:function(_95){
Playdar.Util.setcookie(_95,"",-1);
},get_window_position:function(){
var _96={};
if(window.screenLeft){
_96.x=window.screenLeft||0;
_96.y=window.screenTop||0;
}else{
_96.x=window.screenX||0;
_96.y=window.screenY||0;
}
return _96;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_97){
var _98=Playdar.Util.get_popup_location(_97);
return ["left="+_98.x,"top="+_98.y,"width="+_97.w,"height="+_97.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_99){
var _9a=Playdar.Util.get_window_position();
var _9b=Playdar.Util.get_window_size();
return {"x":Math.max(0,_9a.x+(_9b.w-_99.w)/2),"y":Math.max(0,_9a.y+(_9b.h-_99.h)/2)};
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_9d,_9e){
_9e=_9e||{};
for(var _9f in _9e){
_9d[_9f]=_9e[_9f];
}
return _9d;
},apply_property_function:function(obj,_a1,_a2,_a3){
if(obj&&obj[_a1]){
obj[_a1].apply(_a2,_a3);
}
},log:function(_a4){
if(typeof console!="undefined"){
console.dir(_a4);
}
},null_callback:function(){
}};
(function(){
var _a5=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_a6=0,_a7=Object.prototype.toString,_a8=false;
var _a9=function(_aa,_ab,_ac,_ad){
_ac=_ac||[];
var _ae=_ab=_ab||document;
if(_ab.nodeType!==1&&_ab.nodeType!==9){
return [];
}
if(!_aa||typeof _aa!=="string"){
return _ac;
}
var _af=[],m,set,_b2,_b3,_b4,_b5,_b6=true,_b7=_b8(_ab);
_a5.lastIndex=0;
while((m=_a5.exec(_aa))!==null){
_af.push(m[1]);
if(m[2]){
_b5=RegExp.rightContext;
break;
}
}
if(_af.length>1&&_b9.exec(_aa)){
if(_af.length===2&&_ba.relative[_af[0]]){
set=_bb(_af[0]+_af[1],_ab);
}else{
set=_ba.relative[_af[0]]?[_ab]:_a9(_af.shift(),_ab);
while(_af.length){
_aa=_af.shift();
if(_ba.relative[_aa]){
_aa+=_af.shift();
}
set=_bb(_aa,set);
}
}
}else{
if(!_ad&&_af.length>1&&_ab.nodeType===9&&!_b7&&_ba.match.ID.test(_af[0])&&!_ba.match.ID.test(_af[_af.length-1])){
var ret=_a9.find(_af.shift(),_ab,_b7);
_ab=ret.expr?_a9.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_ab){
var ret=_ad?{expr:_af.pop(),set:_bd(_ad)}:_a9.find(_af.pop(),_af.length===1&&(_af[0]==="~"||_af[0]==="+")&&_ab.parentNode?_ab.parentNode:_ab,_b7);
set=ret.expr?_a9.filter(ret.expr,ret.set):ret.set;
if(_af.length>0){
_b2=_bd(set);
}else{
_b6=false;
}
while(_af.length){
var cur=_af.pop(),pop=cur;
if(!_ba.relative[cur]){
cur="";
}else{
pop=_af.pop();
}
if(pop==null){
pop=_ab;
}
_ba.relative[cur](_b2,pop,_b7);
}
}else{
_b2=_af=[];
}
}
if(!_b2){
_b2=set;
}
if(!_b2){
throw "Syntax error, unrecognized expression: "+(cur||_aa);
}
if(_a7.call(_b2)==="[object Array]"){
if(!_b6){
_ac.push.apply(_ac,_b2);
}else{
if(_ab&&_ab.nodeType===1){
for(var i=0;_b2[i]!=null;i++){
if(_b2[i]&&(_b2[i]===true||_b2[i].nodeType===1&&_c1(_ab,_b2[i]))){
_ac.push(set[i]);
}
}
}else{
for(var i=0;_b2[i]!=null;i++){
if(_b2[i]&&_b2[i].nodeType===1){
_ac.push(set[i]);
}
}
}
}
}else{
_bd(_b2,_ac);
}
if(_b5){
_a9(_b5,_ae,_ac,_ad);
_a9.uniqueSort(_ac);
}
return _ac;
};
_a9.uniqueSort=function(_c2){
if(_c3){
_a8=false;
_c2.sort(_c3);
if(_a8){
for(var i=1;i<_c2.length;i++){
if(_c2[i]===_c2[i-1]){
_c2.splice(i--,1);
}
}
}
}
};
_a9.matches=function(_c5,set){
return _a9(_c5,null,null,set);
};
_a9.find=function(_c7,_c8,_c9){
var set,_cb;
if(!_c7){
return [];
}
for(var i=0,l=_ba.order.length;i<l;i++){
var _ce=_ba.order[i],_cb;
if((_cb=_ba.match[_ce].exec(_c7))){
var _cf=RegExp.leftContext;
if(_cf.substr(_cf.length-1)!=="\\"){
_cb[1]=(_cb[1]||"").replace(/\\/g,"");
set=_ba.find[_ce](_cb,_c8,_c9);
if(set!=null){
_c7=_c7.replace(_ba.match[_ce],"");
break;
}
}
}
}
if(!set){
set=_c8.getElementsByTagName("*");
}
return {set:set,expr:_c7};
};
_a9.filter=function(_d0,set,_d2,not){
var old=_d0,_d5=[],_d6=set,_d7,_d8,_d9=set&&set[0]&&_b8(set[0]);
while(_d0&&set.length){
for(var _da in _ba.filter){
if((_d7=_ba.match[_da].exec(_d0))!=null){
var _db=_ba.filter[_da],_dc,_dd;
_d8=false;
if(_d6==_d5){
_d5=[];
}
if(_ba.preFilter[_da]){
_d7=_ba.preFilter[_da](_d7,_d6,_d2,_d5,not,_d9);
if(!_d7){
_d8=_dc=true;
}else{
if(_d7===true){
continue;
}
}
}
if(_d7){
for(var i=0;(_dd=_d6[i])!=null;i++){
if(_dd){
_dc=_db(_dd,_d7,i,_d6);
var _df=not^!!_dc;
if(_d2&&_dc!=null){
if(_df){
_d8=true;
}else{
_d6[i]=false;
}
}else{
if(_df){
_d5.push(_dd);
_d8=true;
}
}
}
}
}
if(_dc!==undefined){
if(!_d2){
_d6=_d5;
}
_d0=_d0.replace(_ba.match[_da],"");
if(!_d8){
return [];
}
break;
}
}
}
if(_d0==old){
if(_d8==null){
throw "Syntax error, unrecognized expression: "+_d0;
}else{
break;
}
}
old=_d0;
}
return _d6;
};
var _ba=_a9.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_e0){
return _e0.getAttribute("href");
}},relative:{"+":function(_e1,_e2,_e3){
var _e4=typeof _e2==="string",_e5=_e4&&!(/\W/).test(_e2),_e6=_e4&&!_e5;
if(_e5&&!_e3){
_e2=_e2.toUpperCase();
}
for(var i=0,l=_e1.length,_e9;i<l;i++){
if((_e9=_e1[i])){
while((_e9=_e9.previousSibling)&&_e9.nodeType!==1){
}
_e1[i]=_e6||_e9&&_e9.nodeName===_e2?_e9||false:_e9===_e2;
}
}
if(_e6){
_a9.filter(_e2,_e1,true);
}
},">":function(_ea,_eb,_ec){
var _ed=typeof _eb==="string";
if(_ed&&!(/\W/).test(_eb)){
_eb=_ec?_eb:_eb.toUpperCase();
for(var i=0,l=_ea.length;i<l;i++){
var _f0=_ea[i];
if(_f0){
var _f1=_f0.parentNode;
_ea[i]=_f1.nodeName===_eb?_f1:false;
}
}
}else{
for(var i=0,l=_ea.length;i<l;i++){
var _f0=_ea[i];
if(_f0){
_ea[i]=_ed?_f0.parentNode:_f0.parentNode===_eb;
}
}
if(_ed){
_a9.filter(_eb,_ea,true);
}
}
},"":function(_f2,_f3,_f4){
var _f5=_a6++,_f6=dirCheck;
if(!_f3.match(/\W/)){
var _f7=_f3=_f4?_f3:_f3.toUpperCase();
_f6=dirNodeCheck;
}
_f6("parentNode",_f3,_f5,_f2,_f7,_f4);
},"~":function(_f8,_f9,_fa){
var _fb=_a6++,_fc=dirCheck;
if(typeof _f9==="string"&&!_f9.match(/\W/)){
var _fd=_f9=_fa?_f9:_f9.toUpperCase();
_fc=dirNodeCheck;
}
_fc("previousSibling",_f9,_fb,_f8,_fd,_fa);
}},find:{ID:function(_fe,_ff,_100){
if(typeof _ff.getElementById!=="undefined"&&!_100){
var m=_ff.getElementById(_fe[1]);
return m?[m]:[];
}
},NAME:function(_102,_103,_104){
if(typeof _103.getElementsByName!=="undefined"){
var ret=[],_106=_103.getElementsByName(_102[1]);
for(var i=0,l=_106.length;i<l;i++){
if(_106[i].getAttribute("name")===_102[1]){
ret.push(_106[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_109,_10a){
return _10a.getElementsByTagName(_109[1]);
}},preFilter:{CLASS:function(_10b,_10c,_10d,_10e,not,_110){
_10b=" "+_10b[1].replace(/\\/g,"")+" ";
if(_110){
return _10b;
}
for(var i=0,elem;(elem=_10c[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_10b)>=0)){
if(!_10d){
_10e.push(elem);
}
}else{
if(_10d){
_10c[i]=false;
}
}
}
}
return false;
},ID:function(_113){
return _113[1].replace(/\\/g,"");
},TAG:function(_114,_115){
for(var i=0;_115[i]===false;i++){
}
return _115[i]&&_b8(_115[i])?_114[1]:_114[1].toUpperCase();
},CHILD:function(_117){
if(_117[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_117[2]=="even"&&"2n"||_117[2]=="odd"&&"2n+1"||!(/\D/).test(_117[2])&&"0n+"+_117[2]||_117[2]);
_117[2]=(test[1]+(test[2]||1))-0;
_117[3]=test[3]-0;
}
_117[0]=_a6++;
return _117;
},ATTR:function(_119,_11a,_11b,_11c,not,_11e){
var name=_119[1].replace(/\\/g,"");
if(!_11e&&_ba.attrMap[name]){
_119[1]=_ba.attrMap[name];
}
if(_119[2]==="~="){
_119[4]=" "+_119[4]+" ";
}
return _119;
},PSEUDO:function(_120,_121,_122,_123,not){
if(_120[1]==="not"){
if(_120[3].match(_a5).length>1||(/^\w/).test(_120[3])){
_120[3]=_a9(_120[3],null,null,_121);
}else{
var ret=_a9.filter(_120[3],_121,_122,true^not);
if(!_122){
_123.push.apply(_123,ret);
}
return false;
}
}else{
if(_ba.match.POS.test(_120[0])||_ba.match.CHILD.test(_120[0])){
return true;
}
}
return _120;
},POS:function(_126){
_126.unshift(true);
return _126;
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
},has:function(elem,i,_12f){
return !!_a9(_12f[3],elem).length;
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
},last:function(elem,i,_13f,_140){
return i===_140.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_147){
return i<_147[3]-0;
},gt:function(elem,i,_14a){
return i>_14a[3]-0;
},nth:function(elem,i,_14d){
return _14d[3]-0==i;
},eq:function(elem,i,_150){
return _150[3]-0==i;
}},filter:{PSEUDO:function(elem,_152,i,_154){
var name=_152[1],_156=_ba.filters[name];
if(_156){
return _156(elem,i,_152,_154);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_152[3])>=0;
}else{
if(name==="not"){
var not=_152[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_15a){
var type=_15a[1],node=elem;
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
var _15d=_15a[2],last=_15a[3];
if(_15d==1&&last==0){
return true;
}
var _15f=_15a[0],_160=elem.parentNode;
if(_160&&(_160.sizcache!==_15f||!elem.nodeIndex)){
var _161=0;
for(node=_160.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_161;
}
}
_160.sizcache=_15f;
}
var diff=elem.nodeIndex-last;
if(_15d==0){
return diff==0;
}else{
return (diff%_15d==0&&diff/_15d>=0);
}
}
},ID:function(elem,_164){
return elem.nodeType===1&&elem.getAttribute("id")===_164;
},TAG:function(elem,_166){
return (_166==="*"&&elem.nodeType===1)||elem.nodeName===_166;
},CLASS:function(elem,_168){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_168)>-1;
},ATTR:function(elem,_16a){
var name=_16a[1],_16c=_ba.attrHandle[name]?_ba.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_16d=_16c+"",type=_16a[2],_16f=_16a[4];
return _16c==null?type==="!=":type==="="?_16d===_16f:type==="*="?_16d.indexOf(_16f)>=0:type==="~="?(" "+_16d+" ").indexOf(_16f)>=0:!_16f?_16d&&_16c!==false:type==="!="?_16d!=_16f:type==="^="?_16d.indexOf(_16f)===0:type==="$="?_16d.substr(_16d.length-_16f.length)===_16f:type==="|="?_16d===_16f||_16d.substr(0,_16f.length+1)===_16f+"-":false;
},POS:function(elem,_171,i,_173){
var name=_171[2],_175=_ba.setFilters[name];
if(_175){
return _175(elem,i,_171,_173);
}
}}};
var _b9=_ba.match.POS;
for(var type in _ba.match){
_ba.match[type]=new RegExp(_ba.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _bd=function(_177,_178){
_177=Array.prototype.slice.call(_177);
if(_178){
_178.push.apply(_178,_177);
return _178;
}
return _177;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_bd=function(_179,_17a){
var ret=_17a||[];
if(_a7.call(_179)==="[object Array]"){
Array.prototype.push.apply(ret,_179);
}else{
if(typeof _179.length==="number"){
for(var i=0,l=_179.length;i<l;i++){
ret.push(_179[i]);
}
}else{
for(var i=0;_179[i];i++){
ret.push(_179[i]);
}
}
}
return ret;
};
}
var _c3;
if(document.documentElement.compareDocumentPosition){
_c3=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_a8=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_c3=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_a8=true;
}
return ret;
};
}else{
if(document.createRange){
_c3=function(a,b){
var _186=a.ownerDocument.createRange(),_187=b.ownerDocument.createRange();
_186.selectNode(a);
_186.collapse(true);
_187.selectNode(b);
_187.collapse(true);
var ret=_186.compareBoundaryPoints(Range.START_TO_END,_187);
if(ret===0){
_a8=true;
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
_ba.find.ID=function(_18c,_18d,_18e){
if(typeof _18d.getElementById!=="undefined"&&!_18e){
var m=_18d.getElementById(_18c[1]);
return m?m.id===_18c[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_18c[1]?[m]:undefined:[];
}
};
_ba.filter.ID=function(elem,_191){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_191;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_ba.find.TAG=function(_194,_195){
var _196=_195.getElementsByTagName(_194[1]);
if(_194[1]==="*"){
var tmp=[];
for(var i=0;_196[i];i++){
if(_196[i].nodeType===1){
tmp.push(_196[i]);
}
}
_196=tmp;
}
return _196;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_ba.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _19a=_a9,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_a9=function(_19c,_19d,_19e,seed){
_19d=_19d||document;
if(!seed&&_19d.nodeType===9&&!_b8(_19d)){
try{
return _bd(_19d.querySelectorAll(_19c),_19e);
}
catch(e){
}
}
return _19a(_19c,_19d,_19e,seed);
};
for(var prop in _19a){
_a9[prop]=_19a[prop];
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
_ba.order.splice(1,0,"CLASS");
_ba.find.CLASS=function(_1a2,_1a3,_1a4){
if(typeof _1a3.getElementsByClassName!=="undefined"&&!_1a4){
return _1a3.getElementsByClassName(_1a2[1]);
}
};
})();
}
function dirNodeCheck(dir,cur,_1a7,_1a8,_1a9,_1aa){
var _1ab=dir=="previousSibling"&&!_1aa;
for(var i=0,l=_1a8.length;i<l;i++){
var elem=_1a8[i];
if(elem){
if(_1ab&&elem.nodeType===1){
elem.sizcache=_1a7;
elem.sizset=i;
}
elem=elem[dir];
var _1af=false;
while(elem){
if(elem.sizcache===_1a7){
_1af=_1a8[elem.sizset];
break;
}
if(elem.nodeType===1&&!_1aa){
elem.sizcache=_1a7;
elem.sizset=i;
}
if(elem.nodeName===cur){
_1af=elem;
break;
}
elem=elem[dir];
}
_1a8[i]=_1af;
}
}
}
function dirCheck(dir,cur,_1b2,_1b3,_1b4,_1b5){
var _1b6=dir=="previousSibling"&&!_1b5;
for(var i=0,l=_1b3.length;i<l;i++){
var elem=_1b3[i];
if(elem){
if(_1b6&&elem.nodeType===1){
elem.sizcache=_1b2;
elem.sizset=i;
}
elem=elem[dir];
var _1ba=false;
while(elem){
if(elem.sizcache===_1b2){
_1ba=_1b3[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_1b5){
elem.sizcache=_1b2;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_1ba=true;
break;
}
}else{
if(_a9.filter(cur,[elem]).length>0){
_1ba=elem;
break;
}
}
}
elem=elem[dir];
}
_1b3[i]=_1ba;
}
}
}
var _c1=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _b8=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _bb=function(_1c0,_1c1){
var _1c2=[],_1c3="",_1c4,root=_1c1.nodeType?[_1c1]:_1c1;
while((_1c4=_ba.match.PSEUDO.exec(_1c0))){
_1c3+=_1c4[0];
_1c0=_1c0.replace(_ba.match.PSEUDO,"");
}
_1c0=_ba.relative[_1c0]?_1c0+"*":_1c0;
for(var i=0,l=root.length;i<l;i++){
_a9(_1c0,root[i],_1c2);
}
return _a9.filter(_1c3,_1c2);
};
Playdar.Util.select=_a9;
})();

