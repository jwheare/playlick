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
new Playdar.Scrobbler();
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
var _5d=document.createElement("div");
_5d.style.position="fixed";
_5d.style.bottom=0;
_5d.style.left=0;
_5d.style.zIndex=100;
_5d.style.width="100%";
_5d.style.height="36px";
_5d.style.padding="7px 0";
_5d.style.borderTop="2px solid #4c7a0f";
_5d.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_5d.style.color="#335507";
_5d.style.background="#e8f9bb";
var _5e=document.createElement("div");
_5e.style.padding="0 7px";
var _5f="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_5e.innerHTML=_5f;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_5e.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _60=document.createElement("p");
_60.style.margin="0";
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
_60.appendChild(this.track_link);
this.playback.appendChild(_60);
var _61=document.createElement("table");
_61.setAttribute("cellpadding",0);
_61.setAttribute("cellspacing",0);
_61.setAttribute("border",0);
_61.style.color="#4c7a0f";
_61.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _62=document.createElement("tbody");
var _63=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_63.appendChild(this.track_elapsed);
var _64=document.createElement("td");
_64.style.padding="0 5px";
_64.style.verticalAlign="middle";
var _65=document.createElement("div");
_65.style.width=this.progress_bar_width+"px";
_65.style.height="9px";
_65.style.border="1px solid #4c7a0f";
_65.style.background="#fff";
_65.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_65.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_65.appendChild(this.playhead);
_65.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_64.appendChild(_65);
_63.appendChild(_64);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_63.appendChild(this.track_duration);
_62.appendChild(_63);
_61.appendChild(_62);
this.playback.appendChild(_61);
_5e.appendChild(this.playback);
var _66=document.createElement("div");
_66.style.cssFloat="right";
_66.style.padding="0 8px";
_66.style.textAlign="right";
var _67=document.createElement("p");
_67.style.margin=0;
_67.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_66.appendChild(_67);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML="<a href=\""+this.get_queries_popup_url()+"\" target=\""+Playdar.QUERIES_POPUP_NAME+"\" onclick=\"Playdar.status_bar.open_queries_popup(); return false;"+"\">Tracks</a>"+" | "+Playdar.client.get_disconnect_link_html();
_66.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_5d.appendChild(_66);
_5d.appendChild(_5e);
document.body.appendChild(_5d);
var _68=document.body.style.marginBottom;
if(!_68){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_68=css.marginBottom;
}
}
document.body.style.marginBottom=(_68.replace("px","")-0)+36+(7*2)+2+"px";
return _5d;
},ready:function(){
this.playdar_links.style.display="";
var _6a="Ready";
this.status.innerHTML=_6a;
},offline:function(){
this.playdar_links.style.display="none";
var _6b=Playdar.client.get_auth_link_html();
this.status.innerHTML=_6b;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _6c="manualAuth_"+Playdar.client.uuid;
var _6d="<input type=\"text\" id=\""+_6c+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_6c+"'); return false;"+"\" />";
this.status.innerHTML=_6d;
},handle_stat:function(_6e){
if(_6e.authenticated){
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
var _6f=" ";
if(this.pending_count){
_6f+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_6f+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_6f;
}
},handle_results:function(_70,_71){
if(_71){
this.pending_count--;
if(_70.results.length){
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
},get_sound_options:function(_72,_73){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
Playdar.Util.apply_property_function(_73,"whileplaying",this,arguments);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
Playdar.Util.apply_property_function(_73,"whileloading",this,arguments);
}};
},play_handler:function(_74){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_74.sid);
this.track_link.title=_74.source;
this.track_name.innerHTML=_74.track;
this.artist_name.innerHTML=_74.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_74.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_75){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_75.position/1000));
var _76;
if(_75.readyState==3){
_76=_75.duration;
}else{
_76=_75.durationEstimate;
}
var _77=_75.position/_76;
this.playhead.style.width=Math.round(_77*this.progress_bar_width)+"px";
},loading_handler:function(_78){
var _79=_78.bytesLoaded/_78.bytesTotal;
this.bufferhead.style.width=Math.round(_79*this.progress_bar_width)+"px";
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
var _7a="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _7b=[];
var rnd=Math.random;
var r;
_7b[8]=_7b[13]=_7b[18]=_7b[23]="-";
_7b[14]="4";
for(var i=0;i<36;i++){
if(!_7b[i]){
r=0|rnd()*16;
_7b[i]=_7a[(i==19)?(r&3)|8:r&15];
}
}
return _7b.join("");
},toQueryPair:function(key,_80){
if(_80===null){
return key;
}
return key+"="+encodeURIComponent(_80);
},toQueryString:function(_81){
var _82=[];
for(var key in _81){
var _84=_81[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_84)=="[object Array]"){
for(var i=0;i<_84.length;i++){
_82.push(Playdar.Util.toQueryPair(key,_84[i]));
}
}else{
_82.push(Playdar.Util.toQueryPair(key,_84));
}
}
return _82.join("&");
},mmss:function(_86){
var s=_86%60;
if(s<10){
s="0"+s;
}
return Math.floor(_86/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_8a,_8b,_8c){
if(_8c){
var _8d=new Date();
_8d.setTime(_8d.getTime()+(_8c*24*60*60*1000));
var _8e="; expires="+_8d.toGMTString();
}else{
var _8e="";
}
document.cookie="PD_"+_8a+"="+_8b+_8e+"; path=/";
},getcookie:function(_8f){
var _90="PD_"+_8f+"=";
var _91=document.cookie.split(";");
for(var i=0;i<_91.length;i++){
var c=_91[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_90)==0){
return c.substring(_90.length,c.length);
}
}
return null;
},deletecookie:function(_94){
Playdar.Util.setcookie(_94,"",-1);
},get_window_position:function(){
var _95={};
if(window.screenLeft){
_95.x=window.screenLeft||0;
_95.y=window.screenTop||0;
}else{
_95.x=window.screenX||0;
_95.y=window.screenY||0;
}
return _95;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_96){
var _97=Playdar.Util.get_popup_location(_96);
return ["left="+_97.x,"top="+_97.y,"width="+_96.w,"height="+_96.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_98){
var _99=Playdar.Util.get_window_position();
var _9a=Playdar.Util.get_window_size();
return {"x":Math.max(0,_99.x+(_9a.w-_98.w)/2),"y":Math.max(0,_99.y+(_9a.h-_98.h)/2)};
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_9c,_9d){
_9d=_9d||{};
for(var _9e in _9d){
_9c[_9e]=_9d[_9e];
}
return _9c;
},apply_property_function:function(obj,_a0,_a1,_a2){
if(obj&&obj[_a0]){
obj[_a0].apply(_a1,_a2);
}
},log:function(_a3){
if(typeof console!="undefined"){
console.dir(_a3);
}
},null_callback:function(){
}};
(function(){
var _a4=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_a5=0,_a6=Object.prototype.toString,_a7=false;
var _a8=function(_a9,_aa,_ab,_ac){
_ab=_ab||[];
var _ad=_aa=_aa||document;
if(_aa.nodeType!==1&&_aa.nodeType!==9){
return [];
}
if(!_a9||typeof _a9!=="string"){
return _ab;
}
var _ae=[],m,set,_b1,_b2,_b3,_b4,_b5=true,_b6=_b7(_aa);
_a4.lastIndex=0;
while((m=_a4.exec(_a9))!==null){
_ae.push(m[1]);
if(m[2]){
_b4=RegExp.rightContext;
break;
}
}
if(_ae.length>1&&_b8.exec(_a9)){
if(_ae.length===2&&_b9.relative[_ae[0]]){
set=_ba(_ae[0]+_ae[1],_aa);
}else{
set=_b9.relative[_ae[0]]?[_aa]:_a8(_ae.shift(),_aa);
while(_ae.length){
_a9=_ae.shift();
if(_b9.relative[_a9]){
_a9+=_ae.shift();
}
set=_ba(_a9,set);
}
}
}else{
if(!_ac&&_ae.length>1&&_aa.nodeType===9&&!_b6&&_b9.match.ID.test(_ae[0])&&!_b9.match.ID.test(_ae[_ae.length-1])){
var ret=_a8.find(_ae.shift(),_aa,_b6);
_aa=ret.expr?_a8.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_aa){
var ret=_ac?{expr:_ae.pop(),set:_bc(_ac)}:_a8.find(_ae.pop(),_ae.length===1&&(_ae[0]==="~"||_ae[0]==="+")&&_aa.parentNode?_aa.parentNode:_aa,_b6);
set=ret.expr?_a8.filter(ret.expr,ret.set):ret.set;
if(_ae.length>0){
_b1=_bc(set);
}else{
_b5=false;
}
while(_ae.length){
var cur=_ae.pop(),pop=cur;
if(!_b9.relative[cur]){
cur="";
}else{
pop=_ae.pop();
}
if(pop==null){
pop=_aa;
}
_b9.relative[cur](_b1,pop,_b6);
}
}else{
_b1=_ae=[];
}
}
if(!_b1){
_b1=set;
}
if(!_b1){
throw "Syntax error, unrecognized expression: "+(cur||_a9);
}
if(_a6.call(_b1)==="[object Array]"){
if(!_b5){
_ab.push.apply(_ab,_b1);
}else{
if(_aa&&_aa.nodeType===1){
for(var i=0;_b1[i]!=null;i++){
if(_b1[i]&&(_b1[i]===true||_b1[i].nodeType===1&&_c0(_aa,_b1[i]))){
_ab.push(set[i]);
}
}
}else{
for(var i=0;_b1[i]!=null;i++){
if(_b1[i]&&_b1[i].nodeType===1){
_ab.push(set[i]);
}
}
}
}
}else{
_bc(_b1,_ab);
}
if(_b4){
_a8(_b4,_ad,_ab,_ac);
_a8.uniqueSort(_ab);
}
return _ab;
};
_a8.uniqueSort=function(_c1){
if(_c2){
_a7=false;
_c1.sort(_c2);
if(_a7){
for(var i=1;i<_c1.length;i++){
if(_c1[i]===_c1[i-1]){
_c1.splice(i--,1);
}
}
}
}
};
_a8.matches=function(_c4,set){
return _a8(_c4,null,null,set);
};
_a8.find=function(_c6,_c7,_c8){
var set,_ca;
if(!_c6){
return [];
}
for(var i=0,l=_b9.order.length;i<l;i++){
var _cd=_b9.order[i],_ca;
if((_ca=_b9.match[_cd].exec(_c6))){
var _ce=RegExp.leftContext;
if(_ce.substr(_ce.length-1)!=="\\"){
_ca[1]=(_ca[1]||"").replace(/\\/g,"");
set=_b9.find[_cd](_ca,_c7,_c8);
if(set!=null){
_c6=_c6.replace(_b9.match[_cd],"");
break;
}
}
}
}
if(!set){
set=_c7.getElementsByTagName("*");
}
return {set:set,expr:_c6};
};
_a8.filter=function(_cf,set,_d1,not){
var old=_cf,_d4=[],_d5=set,_d6,_d7,_d8=set&&set[0]&&_b7(set[0]);
while(_cf&&set.length){
for(var _d9 in _b9.filter){
if((_d6=_b9.match[_d9].exec(_cf))!=null){
var _da=_b9.filter[_d9],_db,_dc;
_d7=false;
if(_d5==_d4){
_d4=[];
}
if(_b9.preFilter[_d9]){
_d6=_b9.preFilter[_d9](_d6,_d5,_d1,_d4,not,_d8);
if(!_d6){
_d7=_db=true;
}else{
if(_d6===true){
continue;
}
}
}
if(_d6){
for(var i=0;(_dc=_d5[i])!=null;i++){
if(_dc){
_db=_da(_dc,_d6,i,_d5);
var _de=not^!!_db;
if(_d1&&_db!=null){
if(_de){
_d7=true;
}else{
_d5[i]=false;
}
}else{
if(_de){
_d4.push(_dc);
_d7=true;
}
}
}
}
}
if(_db!==undefined){
if(!_d1){
_d5=_d4;
}
_cf=_cf.replace(_b9.match[_d9],"");
if(!_d7){
return [];
}
break;
}
}
}
if(_cf==old){
if(_d7==null){
throw "Syntax error, unrecognized expression: "+_cf;
}else{
break;
}
}
old=_cf;
}
return _d5;
};
var _b9=_a8.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_df){
return _df.getAttribute("href");
}},relative:{"+":function(_e0,_e1,_e2){
var _e3=typeof _e1==="string",_e4=_e3&&!(/\W/).test(_e1),_e5=_e3&&!_e4;
if(_e4&&!_e2){
_e1=_e1.toUpperCase();
}
for(var i=0,l=_e0.length,_e8;i<l;i++){
if((_e8=_e0[i])){
while((_e8=_e8.previousSibling)&&_e8.nodeType!==1){
}
_e0[i]=_e5||_e8&&_e8.nodeName===_e1?_e8||false:_e8===_e1;
}
}
if(_e5){
_a8.filter(_e1,_e0,true);
}
},">":function(_e9,_ea,_eb){
var _ec=typeof _ea==="string";
if(_ec&&!(/\W/).test(_ea)){
_ea=_eb?_ea:_ea.toUpperCase();
for(var i=0,l=_e9.length;i<l;i++){
var _ef=_e9[i];
if(_ef){
var _f0=_ef.parentNode;
_e9[i]=_f0.nodeName===_ea?_f0:false;
}
}
}else{
for(var i=0,l=_e9.length;i<l;i++){
var _ef=_e9[i];
if(_ef){
_e9[i]=_ec?_ef.parentNode:_ef.parentNode===_ea;
}
}
if(_ec){
_a8.filter(_ea,_e9,true);
}
}
},"":function(_f1,_f2,_f3){
var _f4=_a5++,_f5=dirCheck;
if(!_f2.match(/\W/)){
var _f6=_f2=_f3?_f2:_f2.toUpperCase();
_f5=dirNodeCheck;
}
_f5("parentNode",_f2,_f4,_f1,_f6,_f3);
},"~":function(_f7,_f8,_f9){
var _fa=_a5++,_fb=dirCheck;
if(typeof _f8==="string"&&!_f8.match(/\W/)){
var _fc=_f8=_f9?_f8:_f8.toUpperCase();
_fb=dirNodeCheck;
}
_fb("previousSibling",_f8,_fa,_f7,_fc,_f9);
}},find:{ID:function(_fd,_fe,_ff){
if(typeof _fe.getElementById!=="undefined"&&!_ff){
var m=_fe.getElementById(_fd[1]);
return m?[m]:[];
}
},NAME:function(_101,_102,_103){
if(typeof _102.getElementsByName!=="undefined"){
var ret=[],_105=_102.getElementsByName(_101[1]);
for(var i=0,l=_105.length;i<l;i++){
if(_105[i].getAttribute("name")===_101[1]){
ret.push(_105[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_108,_109){
return _109.getElementsByTagName(_108[1]);
}},preFilter:{CLASS:function(_10a,_10b,_10c,_10d,not,_10f){
_10a=" "+_10a[1].replace(/\\/g,"")+" ";
if(_10f){
return _10a;
}
for(var i=0,elem;(elem=_10b[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_10a)>=0)){
if(!_10c){
_10d.push(elem);
}
}else{
if(_10c){
_10b[i]=false;
}
}
}
}
return false;
},ID:function(_112){
return _112[1].replace(/\\/g,"");
},TAG:function(_113,_114){
for(var i=0;_114[i]===false;i++){
}
return _114[i]&&_b7(_114[i])?_113[1]:_113[1].toUpperCase();
},CHILD:function(_116){
if(_116[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_116[2]=="even"&&"2n"||_116[2]=="odd"&&"2n+1"||!(/\D/).test(_116[2])&&"0n+"+_116[2]||_116[2]);
_116[2]=(test[1]+(test[2]||1))-0;
_116[3]=test[3]-0;
}
_116[0]=_a5++;
return _116;
},ATTR:function(_118,_119,_11a,_11b,not,_11d){
var name=_118[1].replace(/\\/g,"");
if(!_11d&&_b9.attrMap[name]){
_118[1]=_b9.attrMap[name];
}
if(_118[2]==="~="){
_118[4]=" "+_118[4]+" ";
}
return _118;
},PSEUDO:function(_11f,_120,_121,_122,not){
if(_11f[1]==="not"){
if(_11f[3].match(_a4).length>1||(/^\w/).test(_11f[3])){
_11f[3]=_a8(_11f[3],null,null,_120);
}else{
var ret=_a8.filter(_11f[3],_120,_121,true^not);
if(!_121){
_122.push.apply(_122,ret);
}
return false;
}
}else{
if(_b9.match.POS.test(_11f[0])||_b9.match.CHILD.test(_11f[0])){
return true;
}
}
return _11f;
},POS:function(_125){
_125.unshift(true);
return _125;
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
},has:function(elem,i,_12e){
return !!_a8(_12e[3],elem).length;
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
},last:function(elem,i,_13e,_13f){
return i===_13f.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_146){
return i<_146[3]-0;
},gt:function(elem,i,_149){
return i>_149[3]-0;
},nth:function(elem,i,_14c){
return _14c[3]-0==i;
},eq:function(elem,i,_14f){
return _14f[3]-0==i;
}},filter:{PSEUDO:function(elem,_151,i,_153){
var name=_151[1],_155=_b9.filters[name];
if(_155){
return _155(elem,i,_151,_153);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_151[3])>=0;
}else{
if(name==="not"){
var not=_151[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_159){
var type=_159[1],node=elem;
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
var _15c=_159[2],last=_159[3];
if(_15c==1&&last==0){
return true;
}
var _15e=_159[0],_15f=elem.parentNode;
if(_15f&&(_15f.sizcache!==_15e||!elem.nodeIndex)){
var _160=0;
for(node=_15f.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_160;
}
}
_15f.sizcache=_15e;
}
var diff=elem.nodeIndex-last;
if(_15c==0){
return diff==0;
}else{
return (diff%_15c==0&&diff/_15c>=0);
}
}
},ID:function(elem,_163){
return elem.nodeType===1&&elem.getAttribute("id")===_163;
},TAG:function(elem,_165){
return (_165==="*"&&elem.nodeType===1)||elem.nodeName===_165;
},CLASS:function(elem,_167){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_167)>-1;
},ATTR:function(elem,_169){
var name=_169[1],_16b=_b9.attrHandle[name]?_b9.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_16c=_16b+"",type=_169[2],_16e=_169[4];
return _16b==null?type==="!=":type==="="?_16c===_16e:type==="*="?_16c.indexOf(_16e)>=0:type==="~="?(" "+_16c+" ").indexOf(_16e)>=0:!_16e?_16c&&_16b!==false:type==="!="?_16c!=_16e:type==="^="?_16c.indexOf(_16e)===0:type==="$="?_16c.substr(_16c.length-_16e.length)===_16e:type==="|="?_16c===_16e||_16c.substr(0,_16e.length+1)===_16e+"-":false;
},POS:function(elem,_170,i,_172){
var name=_170[2],_174=_b9.setFilters[name];
if(_174){
return _174(elem,i,_170,_172);
}
}}};
var _b8=_b9.match.POS;
for(var type in _b9.match){
_b9.match[type]=new RegExp(_b9.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _bc=function(_176,_177){
_176=Array.prototype.slice.call(_176);
if(_177){
_177.push.apply(_177,_176);
return _177;
}
return _176;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_bc=function(_178,_179){
var ret=_179||[];
if(_a6.call(_178)==="[object Array]"){
Array.prototype.push.apply(ret,_178);
}else{
if(typeof _178.length==="number"){
for(var i=0,l=_178.length;i<l;i++){
ret.push(_178[i]);
}
}else{
for(var i=0;_178[i];i++){
ret.push(_178[i]);
}
}
}
return ret;
};
}
var _c2;
if(document.documentElement.compareDocumentPosition){
_c2=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_a7=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_c2=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_a7=true;
}
return ret;
};
}else{
if(document.createRange){
_c2=function(a,b){
var _185=a.ownerDocument.createRange(),_186=b.ownerDocument.createRange();
_185.selectNode(a);
_185.collapse(true);
_186.selectNode(b);
_186.collapse(true);
var ret=_185.compareBoundaryPoints(Range.START_TO_END,_186);
if(ret===0){
_a7=true;
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
_b9.find.ID=function(_18b,_18c,_18d){
if(typeof _18c.getElementById!=="undefined"&&!_18d){
var m=_18c.getElementById(_18b[1]);
return m?m.id===_18b[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_18b[1]?[m]:undefined:[];
}
};
_b9.filter.ID=function(elem,_190){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_190;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_b9.find.TAG=function(_193,_194){
var _195=_194.getElementsByTagName(_193[1]);
if(_193[1]==="*"){
var tmp=[];
for(var i=0;_195[i];i++){
if(_195[i].nodeType===1){
tmp.push(_195[i]);
}
}
_195=tmp;
}
return _195;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_b9.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _199=_a8,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_a8=function(_19b,_19c,_19d,seed){
_19c=_19c||document;
if(!seed&&_19c.nodeType===9&&!_b7(_19c)){
try{
return _bc(_19c.querySelectorAll(_19b),_19d);
}
catch(e){
}
}
return _199(_19b,_19c,_19d,seed);
};
for(var prop in _199){
_a8[prop]=_199[prop];
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
_b9.order.splice(1,0,"CLASS");
_b9.find.CLASS=function(_1a1,_1a2,_1a3){
if(typeof _1a2.getElementsByClassName!=="undefined"&&!_1a3){
return _1a2.getElementsByClassName(_1a1[1]);
}
};
})();
}
function dirNodeCheck(dir,cur,_1a6,_1a7,_1a8,_1a9){
var _1aa=dir=="previousSibling"&&!_1a9;
for(var i=0,l=_1a7.length;i<l;i++){
var elem=_1a7[i];
if(elem){
if(_1aa&&elem.nodeType===1){
elem.sizcache=_1a6;
elem.sizset=i;
}
elem=elem[dir];
var _1ae=false;
while(elem){
if(elem.sizcache===_1a6){
_1ae=_1a7[elem.sizset];
break;
}
if(elem.nodeType===1&&!_1a9){
elem.sizcache=_1a6;
elem.sizset=i;
}
if(elem.nodeName===cur){
_1ae=elem;
break;
}
elem=elem[dir];
}
_1a7[i]=_1ae;
}
}
}
function dirCheck(dir,cur,_1b1,_1b2,_1b3,_1b4){
var _1b5=dir=="previousSibling"&&!_1b4;
for(var i=0,l=_1b2.length;i<l;i++){
var elem=_1b2[i];
if(elem){
if(_1b5&&elem.nodeType===1){
elem.sizcache=_1b1;
elem.sizset=i;
}
elem=elem[dir];
var _1b9=false;
while(elem){
if(elem.sizcache===_1b1){
_1b9=_1b2[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_1b4){
elem.sizcache=_1b1;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_1b9=true;
break;
}
}else{
if(_a8.filter(cur,[elem]).length>0){
_1b9=elem;
break;
}
}
}
elem=elem[dir];
}
_1b2[i]=_1b9;
}
}
}
var _c0=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _b7=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _ba=function(_1bf,_1c0){
var _1c1=[],_1c2="",_1c3,root=_1c0.nodeType?[_1c0]:_1c0;
while((_1c3=_b9.match.PSEUDO.exec(_1bf))){
_1c2+=_1c3[0];
_1bf=_1bf.replace(_b9.match.PSEUDO,"");
}
_1bf=_b9.relative[_1bf]?_1bf+"*":_1bf;
for(var i=0,l=root.length;i<l;i++){
_a8(_1bf,root[i],_1c1);
}
return _a8.filter(_1c2,_1c1);
};
Playdar.Util.select=_a8;
})();

