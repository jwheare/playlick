Playdar={VERSION:"0.4.2",SERVER_ROOT:"localhost",SERVER_PORT:"8888",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_POPUP_NAME:"PD_auth",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"PD_queries",QUERIES_POPUP_SIZE:{"w":640,"h":700},REFRESH_INTERVAL:null,MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,client:null,status_bar:null,player:null,setup:function(_1){
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
if(this.auth_popup===null||this.auth_popup.closed){
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
if(this.auth_popup!==null&&!this.auth_popup.closed){
this.auth_popup.close();
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
var _1f={"artist":_1d[0].innerHTML,"name":_1e[0].innerHTML,"element":_1c};
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
},handle_resolution:function(_2e){
if(this.resolutions_in_progress.queries[_2e.qid]){
this.last_qid=_2e.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_2e.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_30,_31,_32){
var _33=this.should_stop_polling(_30);
_32=_32||this;
if(!_33){
setTimeout(function(){
_31.call(_32,_30.qid);
},Playdar.REFRESH_INTERVAL||_30.refresh_interval);
}
return _33;
},should_stop_polling:function(_34){
if(_34.refresh_interval<=0){
return true;
}
if(_34.query.solved==true){
return true;
}
if(this.poll_counts[_34.qid]>=4){
return true;
}
return false;
},handle_results:function(_35){
if(this.resolutions_in_progress.queries[_35.qid]){
var _36=this.poll_results(_35,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_35,_36);
}
if(_36){
delete this.resolutions_in_progress.queries[_35.qid];
this.resolutions_in_progress.count--;
this.process_resolution_queue();
}
if(this.results_handlers[_35.qid]){
this.results_handlers[_35.qid](_35,_36);
}else{
this.listeners.onResults(_35,_36);
}
}
},get_last_results:function(){
if(this.last_qid){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.get_results(this.last_qid);
}
},get_base_url:function(_37,_38){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_37){
url+=_37;
}
if(_38){
url+="?"+Playdar.Util.toQueryString(_38);
}
return url;
},get_url:function(_3a,_3b,_3c){
_3c=_3c||{};
_3c.method=_3a;
if(!_3c.jsonp){
if(_3b.join){
_3c.jsonp=_3b.join(".");
}else{
_3c.jsonp=this.jsonp_callback(_3b);
}
}
this.add_auth_token(_3c);
return this.get_base_url("/api/",_3c);
},add_auth_token:function(_3d){
if(this.auth_token){
_3d.auth=this.auth_token;
}
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_3f){
return "Playdar.client."+_3f;
},list_results:function(_40){
for(var i=0;i<_40.results.length;i++){
console.log(_40.results[i].name);
}
}};
Playdar.Boffin=function(){
Playdar.boffin=this;
};
Playdar.Boffin.prototype={get_url:function(_42,_43){
_43=_43||{};
_43.jsonp=_43.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_43);
return Playdar.client.get_base_url("/boffin/"+_42,_43);
},get_tagcloud:function(){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
Playdar.Util.loadjs(this.get_url("tagcloud",{jsonp:"Playdar.boffin.handle_tagcloud"}));
},handle_tagcloud:function(_44){
Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud,_44.qid);
Playdar.client.get_results(_44.qid);
},get_tag_rql:function(tag){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
var rql="tag:\""+tag+"\"";
Playdar.Util.loadjs(this.get_url("rql/"+encodeURIComponent(rql),{jsonp:"Playdar.boffin.handle_rql"}));
},handle_rql:function(_47){
Playdar.client.register_results_handler(Playdar.client.listeners.onRQL,_47.qid);
Playdar.client.get_results(_47.qid);
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_48,_49){
_49=_49||{};
_49.jsonp=_49.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_49);
return Playdar.client.get_base_url("/audioscrobbler/"+_48,_49);
},start:function(_4a,_4b,_4c,_4d,_4e,_4f){
var _50={a:_4a,t:_4b,o:"P"};
if(_4c){
_50["b"]=_4c;
}
if(_4d){
_50["l"]=_4d;
}
if(_4e){
_50["n"]=_4e;
}
if(_4f){
_50["m"]=_4f;
}
Playdar.Util.loadjs(this.get_url("start",_50));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_options:function(_51,_52){
var _53=this;
return {onplay:function(){
_53.start(_51.artist,_51.track,_51.album,_51.duration);
Playdar.Util.apply_property_function(_52,"onplay",this,arguments);
},onbufferchange:function(){
if(this.isBuffering){
_53.pause();
}else{
_53.resume();
}
Playdar.Util.apply_property_function(_52,"onbufferchange",this,arguments);
},onpause:function(){
_53.pause();
Playdar.Util.apply_property_function(_52,"onpause",this,arguments);
},onresume:function(){
_53.resume();
Playdar.Util.apply_property_function(_52,"onresume",this,arguments);
},onstop:function(){
_53.stop();
Playdar.Util.apply_property_function(_52,"onstop",this,arguments);
},onfinish:function(){
_53.stop();
Playdar.Util.apply_property_function(_52,"onfinish",this,arguments);
}};
}};
Playdar.Player=function(_54){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_54;
new Playdar.Scrobbler();
};
Playdar.Player.prototype={register_stream:function(_55,_56){
this.streams[_55.sid]=_55;
var _57=Playdar.Util.extend_object({id:_55.sid,url:Playdar.client.get_stream_url(_55.sid)},_56);
if(Playdar.status_bar){
Playdar.Util.extend_object(_57,Playdar.status_bar.get_sound_options(_55,_56));
}
if(Playdar.scrobbler){
Playdar.Util.extend_object(_57,Playdar.scrobbler.get_sound_options(_55,_56));
}
return this.soundmanager.createSound(_57);
},play_stream:function(sid){
var _59=this.soundmanager.getSoundById(sid);
if(this.nowplayingid!=sid){
this.stop_all();
if(_59.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_59.togglePause();
return _59;
},stop_all:function(){
if(this.nowplayingid){
var _5a=this.soundmanager.getSoundById(this.nowplayingid);
_5a.stop();
_5a.setPosition(1);
this.nowplayingid=null;
}
if(Playdar.status_bar){
Playdar.status_bar.stop_handler();
}
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
var _5b=document.createElement("div");
_5b.style.position="fixed";
_5b.style.bottom=0;
_5b.style.left=0;
_5b.style.zIndex=100;
_5b.style.width="100%";
_5b.style.height="36px";
_5b.style.padding="7px 0";
_5b.style.borderTop="2px solid #4c7a0f";
_5b.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_5b.style.color="#335507";
_5b.style.background="#e8f9bb";
var _5c=document.createElement("div");
_5c.style.padding="0 7px";
var _5d="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_5c.innerHTML=_5d;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_5c.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _5e=document.createElement("p");
_5e.style.margin="0";
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
_5e.appendChild(this.track_link);
this.playback.appendChild(_5e);
var _5f=document.createElement("table");
_5f.setAttribute("cellpadding",0);
_5f.setAttribute("cellspacing",0);
_5f.setAttribute("border",0);
_5f.style.color="#4c7a0f";
_5f.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _60=document.createElement("tbody");
var _61=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_61.appendChild(this.track_elapsed);
var _62=document.createElement("td");
_62.style.padding="0 5px";
_62.style.verticalAlign="middle";
var _63=document.createElement("div");
_63.style.width=this.progress_bar_width+"px";
_63.style.height="9px";
_63.style.border="1px solid #4c7a0f";
_63.style.background="#fff";
_63.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_63.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_63.appendChild(this.playhead);
_63.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_62.appendChild(_63);
_61.appendChild(_62);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_61.appendChild(this.track_duration);
_60.appendChild(_61);
_5f.appendChild(_60);
this.playback.appendChild(_5f);
_5c.appendChild(this.playback);
var _64=document.createElement("div");
_64.style.cssFloat="right";
_64.style.padding="0 8px";
_64.style.textAlign="right";
var _65=document.createElement("p");
_65.style.margin=0;
_65.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_64.appendChild(_65);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML="<a href=\""+this.get_queries_popup_url()+"\" target=\""+Playdar.QUERIES_POPUP_NAME+"\" onclick=\"Playdar.status_bar.open_queries_popup(); return false;"+"\">Tracks</a>"+" | "+Playdar.client.get_disconnect_link_html();
_64.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_5b.appendChild(_64);
_5b.appendChild(_5c);
document.body.appendChild(_5b);
var _66=document.body.style.marginBottom;
if(!_66){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_66=css.marginBottom;
}
}
document.body.style.marginBottom=(_66.replace("px","")-0)+36+(7*2)+2+"px";
return _5b;
},ready:function(){
this.playdar_links.style.display="";
var _68="Ready";
this.status.innerHTML=_68;
},offline:function(){
this.playdar_links.style.display="none";
var _69=Playdar.client.get_auth_link_html();
this.status.innerHTML=_69;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _6a="manualAuth_"+Playdar.client.uuid;
var _6b="<input type=\"text\" id=\""+_6a+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_6a+"'); return false;"+"\" />";
this.status.innerHTML=_6b;
},handle_stat:function(_6c){
if(_6c.authenticated){
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
var _6d=" ";
if(this.pending_count){
_6d+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_6d+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_6d;
}
},handle_results:function(_6e,_6f){
if(_6f){
this.pending_count--;
if(_6e.results.length){
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
},get_sound_options:function(_70,_71){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
Playdar.Util.apply_property_function(_71,"whileplaying",this,arguments);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
Playdar.Util.apply_property_function(_71,"whileloading",this,arguments);
}};
},play_handler:function(_72){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_72.sid);
this.track_link.title=_72.source;
this.track_name.innerHTML=_72.track;
this.artist_name.innerHTML=_72.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_72.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_73){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_73.position/1000));
var _74;
if(_73.readyState==3){
_74=_73.duration;
}else{
_74=_73.durationEstimate;
}
var _75=_73.position/_74;
this.playhead.style.width=Math.round(_75*this.progress_bar_width)+"px";
},loading_handler:function(_76){
var _77=_76.bytesLoaded/_76.bytesTotal;
this.bufferhead.style.width=Math.round(_77*this.progress_bar_width)+"px";
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
var _78="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _79=[];
var rnd=Math.random;
var r;
_79[8]=_79[13]=_79[18]=_79[23]="-";
_79[14]="4";
for(var i=0;i<36;i++){
if(!_79[i]){
r=0|rnd()*16;
_79[i]=_78[(i==19)?(r&3)|8:r&15];
}
}
return _79.join("");
},toQueryPair:function(key,_7e){
if(_7e===null){
return key;
}
return key+"="+encodeURIComponent(_7e);
},toQueryString:function(_7f){
var _80=[];
for(var key in _7f){
var _82=_7f[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_82)=="[object Array]"){
for(var i=0;i<_82.length;i++){
_80.push(Playdar.Util.toQueryPair(key,_82[i]));
}
}else{
_80.push(Playdar.Util.toQueryPair(key,_82));
}
}
return _80.join("&");
},mmss:function(_84){
var s=_84%60;
if(s<10){
s="0"+s;
}
return Math.floor(_84/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_88,_89,_8a){
if(_8a){
var _8b=new Date();
_8b.setTime(_8b.getTime()+(_8a*24*60*60*1000));
var _8c="; expires="+_8b.toGMTString();
}else{
var _8c="";
}
document.cookie="PD_"+_88+"="+_89+_8c+"; path=/";
},getcookie:function(_8d){
var _8e="PD_"+_8d+"=";
var _8f=document.cookie.split(";");
for(var i=0;i<_8f.length;i++){
var c=_8f[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_8e)==0){
return c.substring(_8e.length,c.length);
}
}
return null;
},deletecookie:function(_92){
Playdar.Util.setcookie(_92,"",-1);
},get_window_position:function(){
var _93={};
if(window.screenLeft){
_93.x=window.screenLeft||0;
_93.y=window.screenTop||0;
}else{
_93.x=window.screenX||0;
_93.y=window.screenY||0;
}
return _93;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_94){
var _95=Playdar.Util.get_popup_location(_94);
return ["left="+_95.x,"top="+_95.y,"width="+_94.w,"height="+_94.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_96){
var _97=Playdar.Util.get_window_position();
var _98=Playdar.Util.get_window_size();
return {"x":Math.max(0,_97.x+(_98.w-_96.w)/2),"y":Math.max(0,_97.y+(_98.h-_96.h)/2)};
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_9a,_9b){
_9b=_9b||{};
for(var _9c in _9b){
_9a[_9c]=_9b[_9c];
}
return _9a;
},apply_property_function:function(obj,_9e,_9f,_a0){
if(obj&&obj[_9e]){
obj[_9e].apply(_9f,_a0);
}
},log:function(_a1){
if(typeof console!="undefined"){
console.dir(_a1);
}
},null_callback:function(){
}};
(function(){
var _a2=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_a3=0,_a4=Object.prototype.toString,_a5=false;
var _a6=function(_a7,_a8,_a9,_aa){
_a9=_a9||[];
var _ab=_a8=_a8||document;
if(_a8.nodeType!==1&&_a8.nodeType!==9){
return [];
}
if(!_a7||typeof _a7!=="string"){
return _a9;
}
var _ac=[],m,set,_af,_b0,_b1,_b2,_b3=true,_b4=_b5(_a8);
_a2.lastIndex=0;
while((m=_a2.exec(_a7))!==null){
_ac.push(m[1]);
if(m[2]){
_b2=RegExp.rightContext;
break;
}
}
if(_ac.length>1&&_b6.exec(_a7)){
if(_ac.length===2&&_b7.relative[_ac[0]]){
set=_b8(_ac[0]+_ac[1],_a8);
}else{
set=_b7.relative[_ac[0]]?[_a8]:_a6(_ac.shift(),_a8);
while(_ac.length){
_a7=_ac.shift();
if(_b7.relative[_a7]){
_a7+=_ac.shift();
}
set=_b8(_a7,set);
}
}
}else{
if(!_aa&&_ac.length>1&&_a8.nodeType===9&&!_b4&&_b7.match.ID.test(_ac[0])&&!_b7.match.ID.test(_ac[_ac.length-1])){
var ret=_a6.find(_ac.shift(),_a8,_b4);
_a8=ret.expr?_a6.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_a8){
var ret=_aa?{expr:_ac.pop(),set:_ba(_aa)}:_a6.find(_ac.pop(),_ac.length===1&&(_ac[0]==="~"||_ac[0]==="+")&&_a8.parentNode?_a8.parentNode:_a8,_b4);
set=ret.expr?_a6.filter(ret.expr,ret.set):ret.set;
if(_ac.length>0){
_af=_ba(set);
}else{
_b3=false;
}
while(_ac.length){
var cur=_ac.pop(),pop=cur;
if(!_b7.relative[cur]){
cur="";
}else{
pop=_ac.pop();
}
if(pop==null){
pop=_a8;
}
_b7.relative[cur](_af,pop,_b4);
}
}else{
_af=_ac=[];
}
}
if(!_af){
_af=set;
}
if(!_af){
throw "Syntax error, unrecognized expression: "+(cur||_a7);
}
if(_a4.call(_af)==="[object Array]"){
if(!_b3){
_a9.push.apply(_a9,_af);
}else{
if(_a8&&_a8.nodeType===1){
for(var i=0;_af[i]!=null;i++){
if(_af[i]&&(_af[i]===true||_af[i].nodeType===1&&_be(_a8,_af[i]))){
_a9.push(set[i]);
}
}
}else{
for(var i=0;_af[i]!=null;i++){
if(_af[i]&&_af[i].nodeType===1){
_a9.push(set[i]);
}
}
}
}
}else{
_ba(_af,_a9);
}
if(_b2){
_a6(_b2,_ab,_a9,_aa);
_a6.uniqueSort(_a9);
}
return _a9;
};
_a6.uniqueSort=function(_bf){
if(_c0){
_a5=false;
_bf.sort(_c0);
if(_a5){
for(var i=1;i<_bf.length;i++){
if(_bf[i]===_bf[i-1]){
_bf.splice(i--,1);
}
}
}
}
};
_a6.matches=function(_c2,set){
return _a6(_c2,null,null,set);
};
_a6.find=function(_c4,_c5,_c6){
var set,_c8;
if(!_c4){
return [];
}
for(var i=0,l=_b7.order.length;i<l;i++){
var _cb=_b7.order[i],_c8;
if((_c8=_b7.match[_cb].exec(_c4))){
var _cc=RegExp.leftContext;
if(_cc.substr(_cc.length-1)!=="\\"){
_c8[1]=(_c8[1]||"").replace(/\\/g,"");
set=_b7.find[_cb](_c8,_c5,_c6);
if(set!=null){
_c4=_c4.replace(_b7.match[_cb],"");
break;
}
}
}
}
if(!set){
set=_c5.getElementsByTagName("*");
}
return {set:set,expr:_c4};
};
_a6.filter=function(_cd,set,_cf,not){
var old=_cd,_d2=[],_d3=set,_d4,_d5,_d6=set&&set[0]&&_b5(set[0]);
while(_cd&&set.length){
for(var _d7 in _b7.filter){
if((_d4=_b7.match[_d7].exec(_cd))!=null){
var _d8=_b7.filter[_d7],_d9,_da;
_d5=false;
if(_d3==_d2){
_d2=[];
}
if(_b7.preFilter[_d7]){
_d4=_b7.preFilter[_d7](_d4,_d3,_cf,_d2,not,_d6);
if(!_d4){
_d5=_d9=true;
}else{
if(_d4===true){
continue;
}
}
}
if(_d4){
for(var i=0;(_da=_d3[i])!=null;i++){
if(_da){
_d9=_d8(_da,_d4,i,_d3);
var _dc=not^!!_d9;
if(_cf&&_d9!=null){
if(_dc){
_d5=true;
}else{
_d3[i]=false;
}
}else{
if(_dc){
_d2.push(_da);
_d5=true;
}
}
}
}
}
if(_d9!==undefined){
if(!_cf){
_d3=_d2;
}
_cd=_cd.replace(_b7.match[_d7],"");
if(!_d5){
return [];
}
break;
}
}
}
if(_cd==old){
if(_d5==null){
throw "Syntax error, unrecognized expression: "+_cd;
}else{
break;
}
}
old=_cd;
}
return _d3;
};
var _b7=_a6.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_dd){
return _dd.getAttribute("href");
}},relative:{"+":function(_de,_df,_e0){
var _e1=typeof _df==="string",_e2=_e1&&!(/\W/).test(_df),_e3=_e1&&!_e2;
if(_e2&&!_e0){
_df=_df.toUpperCase();
}
for(var i=0,l=_de.length,_e6;i<l;i++){
if((_e6=_de[i])){
while((_e6=_e6.previousSibling)&&_e6.nodeType!==1){
}
_de[i]=_e3||_e6&&_e6.nodeName===_df?_e6||false:_e6===_df;
}
}
if(_e3){
_a6.filter(_df,_de,true);
}
},">":function(_e7,_e8,_e9){
var _ea=typeof _e8==="string";
if(_ea&&!(/\W/).test(_e8)){
_e8=_e9?_e8:_e8.toUpperCase();
for(var i=0,l=_e7.length;i<l;i++){
var _ed=_e7[i];
if(_ed){
var _ee=_ed.parentNode;
_e7[i]=_ee.nodeName===_e8?_ee:false;
}
}
}else{
for(var i=0,l=_e7.length;i<l;i++){
var _ed=_e7[i];
if(_ed){
_e7[i]=_ea?_ed.parentNode:_ed.parentNode===_e8;
}
}
if(_ea){
_a6.filter(_e8,_e7,true);
}
}
},"":function(_ef,_f0,_f1){
var _f2=_a3++,_f3=dirCheck;
if(!_f0.match(/\W/)){
var _f4=_f0=_f1?_f0:_f0.toUpperCase();
_f3=dirNodeCheck;
}
_f3("parentNode",_f0,_f2,_ef,_f4,_f1);
},"~":function(_f5,_f6,_f7){
var _f8=_a3++,_f9=dirCheck;
if(typeof _f6==="string"&&!_f6.match(/\W/)){
var _fa=_f6=_f7?_f6:_f6.toUpperCase();
_f9=dirNodeCheck;
}
_f9("previousSibling",_f6,_f8,_f5,_fa,_f7);
}},find:{ID:function(_fb,_fc,_fd){
if(typeof _fc.getElementById!=="undefined"&&!_fd){
var m=_fc.getElementById(_fb[1]);
return m?[m]:[];
}
},NAME:function(_ff,_100,_101){
if(typeof _100.getElementsByName!=="undefined"){
var ret=[],_103=_100.getElementsByName(_ff[1]);
for(var i=0,l=_103.length;i<l;i++){
if(_103[i].getAttribute("name")===_ff[1]){
ret.push(_103[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_106,_107){
return _107.getElementsByTagName(_106[1]);
}},preFilter:{CLASS:function(_108,_109,_10a,_10b,not,_10d){
_108=" "+_108[1].replace(/\\/g,"")+" ";
if(_10d){
return _108;
}
for(var i=0,elem;(elem=_109[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_108)>=0)){
if(!_10a){
_10b.push(elem);
}
}else{
if(_10a){
_109[i]=false;
}
}
}
}
return false;
},ID:function(_110){
return _110[1].replace(/\\/g,"");
},TAG:function(_111,_112){
for(var i=0;_112[i]===false;i++){
}
return _112[i]&&_b5(_112[i])?_111[1]:_111[1].toUpperCase();
},CHILD:function(_114){
if(_114[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_114[2]=="even"&&"2n"||_114[2]=="odd"&&"2n+1"||!(/\D/).test(_114[2])&&"0n+"+_114[2]||_114[2]);
_114[2]=(test[1]+(test[2]||1))-0;
_114[3]=test[3]-0;
}
_114[0]=_a3++;
return _114;
},ATTR:function(_116,_117,_118,_119,not,_11b){
var name=_116[1].replace(/\\/g,"");
if(!_11b&&_b7.attrMap[name]){
_116[1]=_b7.attrMap[name];
}
if(_116[2]==="~="){
_116[4]=" "+_116[4]+" ";
}
return _116;
},PSEUDO:function(_11d,_11e,_11f,_120,not){
if(_11d[1]==="not"){
if(_11d[3].match(_a2).length>1||(/^\w/).test(_11d[3])){
_11d[3]=_a6(_11d[3],null,null,_11e);
}else{
var ret=_a6.filter(_11d[3],_11e,_11f,true^not);
if(!_11f){
_120.push.apply(_120,ret);
}
return false;
}
}else{
if(_b7.match.POS.test(_11d[0])||_b7.match.CHILD.test(_11d[0])){
return true;
}
}
return _11d;
},POS:function(_123){
_123.unshift(true);
return _123;
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
},has:function(elem,i,_12c){
return !!_a6(_12c[3],elem).length;
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
},last:function(elem,i,_13c,_13d){
return i===_13d.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_144){
return i<_144[3]-0;
},gt:function(elem,i,_147){
return i>_147[3]-0;
},nth:function(elem,i,_14a){
return _14a[3]-0==i;
},eq:function(elem,i,_14d){
return _14d[3]-0==i;
}},filter:{PSEUDO:function(elem,_14f,i,_151){
var name=_14f[1],_153=_b7.filters[name];
if(_153){
return _153(elem,i,_14f,_151);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_14f[3])>=0;
}else{
if(name==="not"){
var not=_14f[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_157){
var type=_157[1],node=elem;
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
var _15a=_157[2],last=_157[3];
if(_15a==1&&last==0){
return true;
}
var _15c=_157[0],_15d=elem.parentNode;
if(_15d&&(_15d.sizcache!==_15c||!elem.nodeIndex)){
var _15e=0;
for(node=_15d.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_15e;
}
}
_15d.sizcache=_15c;
}
var diff=elem.nodeIndex-last;
if(_15a==0){
return diff==0;
}else{
return (diff%_15a==0&&diff/_15a>=0);
}
}
},ID:function(elem,_161){
return elem.nodeType===1&&elem.getAttribute("id")===_161;
},TAG:function(elem,_163){
return (_163==="*"&&elem.nodeType===1)||elem.nodeName===_163;
},CLASS:function(elem,_165){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_165)>-1;
},ATTR:function(elem,_167){
var name=_167[1],_169=_b7.attrHandle[name]?_b7.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_16a=_169+"",type=_167[2],_16c=_167[4];
return _169==null?type==="!=":type==="="?_16a===_16c:type==="*="?_16a.indexOf(_16c)>=0:type==="~="?(" "+_16a+" ").indexOf(_16c)>=0:!_16c?_16a&&_169!==false:type==="!="?_16a!=_16c:type==="^="?_16a.indexOf(_16c)===0:type==="$="?_16a.substr(_16a.length-_16c.length)===_16c:type==="|="?_16a===_16c||_16a.substr(0,_16c.length+1)===_16c+"-":false;
},POS:function(elem,_16e,i,_170){
var name=_16e[2],_172=_b7.setFilters[name];
if(_172){
return _172(elem,i,_16e,_170);
}
}}};
var _b6=_b7.match.POS;
for(var type in _b7.match){
_b7.match[type]=new RegExp(_b7.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _ba=function(_174,_175){
_174=Array.prototype.slice.call(_174);
if(_175){
_175.push.apply(_175,_174);
return _175;
}
return _174;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_ba=function(_176,_177){
var ret=_177||[];
if(_a4.call(_176)==="[object Array]"){
Array.prototype.push.apply(ret,_176);
}else{
if(typeof _176.length==="number"){
for(var i=0,l=_176.length;i<l;i++){
ret.push(_176[i]);
}
}else{
for(var i=0;_176[i];i++){
ret.push(_176[i]);
}
}
}
return ret;
};
}
var _c0;
if(document.documentElement.compareDocumentPosition){
_c0=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_a5=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_c0=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_a5=true;
}
return ret;
};
}else{
if(document.createRange){
_c0=function(a,b){
var _183=a.ownerDocument.createRange(),_184=b.ownerDocument.createRange();
_183.selectNode(a);
_183.collapse(true);
_184.selectNode(b);
_184.collapse(true);
var ret=_183.compareBoundaryPoints(Range.START_TO_END,_184);
if(ret===0){
_a5=true;
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
_b7.find.ID=function(_189,_18a,_18b){
if(typeof _18a.getElementById!=="undefined"&&!_18b){
var m=_18a.getElementById(_189[1]);
return m?m.id===_189[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_189[1]?[m]:undefined:[];
}
};
_b7.filter.ID=function(elem,_18e){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_18e;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_b7.find.TAG=function(_191,_192){
var _193=_192.getElementsByTagName(_191[1]);
if(_191[1]==="*"){
var tmp=[];
for(var i=0;_193[i];i++){
if(_193[i].nodeType===1){
tmp.push(_193[i]);
}
}
_193=tmp;
}
return _193;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_b7.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _197=_a6,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_a6=function(_199,_19a,_19b,seed){
_19a=_19a||document;
if(!seed&&_19a.nodeType===9&&!_b5(_19a)){
try{
return _ba(_19a.querySelectorAll(_199),_19b);
}
catch(e){
}
}
return _197(_199,_19a,_19b,seed);
};
for(var prop in _197){
_a6[prop]=_197[prop];
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
_b7.order.splice(1,0,"CLASS");
_b7.find.CLASS=function(_19f,_1a0,_1a1){
if(typeof _1a0.getElementsByClassName!=="undefined"&&!_1a1){
return _1a0.getElementsByClassName(_19f[1]);
}
};
})();
}
function dirNodeCheck(dir,cur,_1a4,_1a5,_1a6,_1a7){
var _1a8=dir=="previousSibling"&&!_1a7;
for(var i=0,l=_1a5.length;i<l;i++){
var elem=_1a5[i];
if(elem){
if(_1a8&&elem.nodeType===1){
elem.sizcache=_1a4;
elem.sizset=i;
}
elem=elem[dir];
var _1ac=false;
while(elem){
if(elem.sizcache===_1a4){
_1ac=_1a5[elem.sizset];
break;
}
if(elem.nodeType===1&&!_1a7){
elem.sizcache=_1a4;
elem.sizset=i;
}
if(elem.nodeName===cur){
_1ac=elem;
break;
}
elem=elem[dir];
}
_1a5[i]=_1ac;
}
}
}
function dirCheck(dir,cur,_1af,_1b0,_1b1,_1b2){
var _1b3=dir=="previousSibling"&&!_1b2;
for(var i=0,l=_1b0.length;i<l;i++){
var elem=_1b0[i];
if(elem){
if(_1b3&&elem.nodeType===1){
elem.sizcache=_1af;
elem.sizset=i;
}
elem=elem[dir];
var _1b7=false;
while(elem){
if(elem.sizcache===_1af){
_1b7=_1b0[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_1b2){
elem.sizcache=_1af;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_1b7=true;
break;
}
}else{
if(_a6.filter(cur,[elem]).length>0){
_1b7=elem;
break;
}
}
}
elem=elem[dir];
}
_1b0[i]=_1b7;
}
}
}
var _be=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _b5=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _b8=function(_1bd,_1be){
var _1bf=[],_1c0="",_1c1,root=_1be.nodeType?[_1be]:_1be;
while((_1c1=_b7.match.PSEUDO.exec(_1bd))){
_1c0+=_1c1[0];
_1bd=_1bd.replace(_b7.match.PSEUDO,"");
}
_1bd=_b7.relative[_1bd]?_1bd+"*":_1bd;
for(var i=0,l=root.length;i<l;i++){
_a6(_1bd,root[i],_1bf);
}
return _a6.filter(_1c0,_1bf);
};
Playdar.Util.select=_a6;
})();

