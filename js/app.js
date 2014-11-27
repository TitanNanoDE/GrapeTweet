$_('grapeTweet').main(function(){
  
 	var App= this;
	var OAuthClient= $('connections').classes.OAuthClient;
	var Socket= $('connections').classes.Socket;
    
    var { Net, Misc, Storage, UI, Audio, Bindings } = App.modules;
  
  	this.twitterSocket= new OAuthClient('twitter', 'https://api.twitter.com', 'gC7HaQ7T4u8HYGgRIhiLz0xGs', 'vNOVVig70BQl0pXjzpaU7Mf88Jd6O2gzTQ6FavnGUTalGtnMM1', { mozSystem : true });
	this.pushServerSocket= new Socket(Socket.HTTP, 'http://grapetweet-titannano.rhcloud.com',  { mozSystem : true });
	
	$$.App= this;
    
    var appStateHandler= {
        get : function(target, property){

            var features= {
                apply : objectReplace
            };

            if(property in features){
                return features[property].bind(this);
            }else{
                return target[property];
            }
        },
        set : function(target, property, value){
            target[property]= value;
            Storage.saveApplicationState(target);
        }
    };
    
  	this.account= new $$.Proxy({
		name : 'account',
		unreadMessages : 0,
		userId : 0
	}, appStateHandler);
	
	this.pushServer= new $$.Proxy({
		name : 'pushServer',
		ready : false,
		id : 0,
		endpoint : '',
		lastRefresh : 0
	}, appStateHandler);
	
	this.dataStatus= new $$.Proxy({
		name : 'dataStatus',
		lastDM_in : '',
		lastDM_out : '',
		lastChat : '',
		lastTweets : {
			timeline : 0
		},
	}, appStateHandler);
	
	this.syncStatus= new $$.Proxy({
		name : 'syncStatus',
		contacts : {
			fetchingInfo : false,
			nextFollowingCursor : '-1',
			nextFollowerCursor : '-1',
			nextContact : '',
			lastSync : '',
			followerCache : [],
			followingCache : [],
			contactsCache : []
		}	
	}, appStateHandler);

    this.loadingChunk= false;
	
	this.cache= {
		images : {}
	};
	
	this.jobs= [];
	
	var objectReplace= function(update){
		$$.Object.keys(update).forEach(function(item){
			if(typeof update[item] == 'object' && !$$.Array.isArray(update[item]) && update[item] !== null)
				objectReplace.apply(this[item], [update[item]]);
			else
				this[item]= update[item];
		});
	};

	var notificationClick= function(e){
		App.openChat(e.target.tag);
		App.show();
	};

    var requestEndpoint= function(callback){
        $$.navigator.push.registrations().onsuccess= function(){
            this.result.forEach(function(item){
                $$.navigator.push.unregister(item.pushEndpoint);
            });
        };

        $$.console.log('requesting push-endpoint...');
        var endpointRequest= $$.navigator.push.register();
	
        endpointRequest.onsuccess= function(){
            callback(endpointRequest.result);
        };

        endpointRequest.onerror= function(e){
            $$.console.error('D: we couldn\'t get a new endpoint!! ' + $$.JSON.stringify(e) + ' Retry in 10 seconds!');
            $$.setTimeout(function(){ requestEndpoint(callback); }, 10000);
        };
    };

    var registerPushClient= function(){
        $$.console.log('registering at the push-server...');
        requestEndpoint(function(endpoint){
            App.pushServerSocket.request('/register', $$.JSON.stringify({ endpoint : endpoint })).then(function(data){
                data= $$.JSON.parse(data);
                App.pushServerSocket.request('/verify', $$.JSON.stringify({
                    id : data.clientId,
                    x1 : App.twitterSocket.exposeToken()[0],
                    x2 : App.twitterSocket.exposeToken()[1]
                })).then(function(){
                    App.pushServer.apply({ id : data.clientId, ready : true, endpoint : endpoint, lastRefresh : Date.now() });
                    $$.console.log('push-server successfully registered!');
                });
            });
        });
    };
	
	var updatePushServer= function(force){
		if(!App.pushServer.ready){
            registerPushClient();
        }else if( (Date.now() - App.pushServer.lastRefresh) > 7200000 && force){
            requestEndpoint(function(endpoint){
                App.pushServerSocket.request('/updateEndpoint', $$.JSON.stringify({ id : App.pushServer.id, endpoint : endpoint })).then(function(data){
                    data= $$.JSON.parse(data);

                    if(data.status != 'failed'){
                        App.pushServer.apply({ endpoint : endpoint, lastRefresh : Date.now() });
                        $$.console.log('push-endpoint successfully updated!');
                    }else{
                        $$.console.error('push-endpoint update failed!');
                    }
                });
            });
        }else{
            $$.console.log('push server already registered!');
        }
    };
	
	App.endpoint= updatePushServer;
	
	App.openChat= function(e){
		var id = ((e.target) ? e.target.dataset.userId : e);
		
		UI.renderChat(id).then(function(){
			$$.location.hash= '#!/messages/chat';
		});
	};
	
	this.notify= function(conversationId){
		Storage.getConversation(conversationId).then(function(conversation){
			Storage.getMessage(conversation.lastMessage).then(function(message){
				if(message.sender_id != App.account.userId){
					UI.renderChats();
					UI.renderFooterStatus(App.account);
				
					if($$.document.hidden || $$.location.hash.indexOf('/messages') < 0 || ($$.location.hash.indexOf('/chat') > -1 && App.dataStatus.lastChat != message.sender_id)){
						var textBody= (conversation.unread < 2) ? Misc.cutdown(message.text) : conversation.unread + ' new messages';
						
						var notification= new $$.Notification(message.sender.name, {
							body : textBody,
							tag : message.sender_id,
							icon : message.sender.profile_image_url
						});
		
						notification.addEventListener('click', notificationClick, false);
					}else{
						Audio.play('recieved');
					}	
				}else if(!$$.document.hidden){
					Audio.play('sent');
				}
			});
		});
	};
			
	this.show= function(){
		if($$.document.hidden){
			$$.navigator.mozApps.getSelf().onsuccess= function(e){
				e.target.result.launch();
    		};
  		}	
	};
	
	this.createConversation= function(id, lastmessage, unread){
		return {
			id : String(id),
			lastMessage : lastmessage,
			lastReadMessage : null,
			unread : unread
		};
	};
	
	this.integrateIntoMessagesChain= function(message, conversation){
		return new $$.Promise(function(done){
			if(conversation && conversation.lastMessage != message.id_str){
				message.last= conversation.lastMessage;
				message.next= null;
				
				conversation.lastMessage= message.id_str;
				if(message.sender_id != App.account.userId){
					conversation.unread= (conversation.unread > 0) ? conversation.unread+1 : 1;
                    App.account.unreadMessages+= 1;
                }
				
				$$.Promise.all([Storage.storeMessage(message), Storage.storeConversation(conversation)]).then(function(){
					Storage.getMessage(message.last).then(function(oldMessage){
						oldMessage.next= message.id_str;
				        Storage.storeMessage(oldMessage).then(done);
					});
				});
			}else if(conversation){
				Storage.getMessage(message.id_str).then(function(oldMessage){
					message.last= oldMessage.last;
					message.next= oldMessage.next;
					Storage.storeMessage(message).then(done);
				});
			}else{
				var convId= (message.sender_id == App.account.userId) ? message.recipient_id : message.sender_id;
				message.last= null;
				message.next= null;
				
				$$.Promise.all([ Storage.storeConversation(App.createConversation(convId, message.id_str, (message.sender_id != App.account.userId) ? 1 : 0)), App.storage.storeMessage(message) ]).then(done);
			}
		});
	};

    this.integrateIntoTimeline= function(tweet, timeline){
        return new $$.Promise(function(done){
           if(timeline.last != tweet.id_str){
               tweet.last= timeline.last;
               tweet.next= null;

               timeline.last= tweet.id_str;
               $$.Promise.all([Storage.storeTweet(tweet, timeline.id), Storage.storeTimeline(timeline), Storage.getTweet(tweet.last, timeline.id)]).then(function(values){
                   var lastTweet= values[2];
                   lastTweet.next= tweet.id_str;
                   Storage.storeTweet(lastTweet, timeline.id).then(done);
               });
           }
        });
    };

    this.createTimeline= function(name, id){
        Storage.storeTimeline({
            name : name,
            id : id,
            las : null
        });
    };
  
// 	check the current login  
	(new $$.Promise(function(done){
		if(!App.twitterSocket.isLoggedIn()){
    	
			App.twitterSocket.requestToken('/oauth/request_token', 'oob').then(function(){
				$('dom').select('.splash .signIn').classList.remove('hidden');
			});
    
			$('dom').select('.splash .signIn').addEventListener('click', function(){
				App.twitterSocket.authenticate('/oauth/authenticate');
				var verify= $('dom').select('.splash .verify');
				var code= $('dom').select('.splash .code');
        
				$('dom').select('.splash .signIn').classList.add('hidden');
				code.classList.remove('hidden');
				verify.classList.remove('hidden');
        
				verify.addEventListener('click', function(){
					App.twitterSocket.verify('/oauth/access_token', code.value).then(function(userId){
						App.account.userId= userId;
						done();
					});
					code.classList.add('hidden');
					verify.classList.add('hidden');
					$('dom').select('.splash .loading').classList.remove('hidden');
				}, false);
			}, false);
    
  		}else{
			done();
			$('dom').select('.splash .loading').classList.remove('hidden');
		}
	})).then(function(){
		App.jobs.push(new Promise(function(done){			
                Storage.checkDirectMessages().then(function(directMessagesStored){
				if(!directMessagesStored)
				    Net.downloadDirectMessages().then(done);
				else
					done();
			});
		}));
		
		App.jobs.push(new Promise(function(done){
			$$.Promise.all([
				Storage.getApplicationState('account'), 
				Storage.getApplicationState('dataStatus'), 
				Storage.getApplicationState('syncStatus'),
				Storage.getApplicationState('pushServer')
			]).then(function(values){
				App.account.apply(values[0]);
                App.dataStatus.apply(values[1]);
                App.syncStatus.apply(values[2]);
                App.pushServer.apply(values[3]);
				
                if(App.syncStatus.contacts.lastSync === '')
                    Net.syncContacts().then(function(){
                        UI.renderContacts().then(done);
                    });
                else{
                    Net.syncContacts().then(function(){
                        UI.renderContacts().then();
                    });
                    done();
                }
			});
		}));
		
		$$.Promise.all(App.jobs).then(function(){
			App.jobs= [];
		
			App.jobs.push(UI.renderChats());
			App.jobs.push(new $$.Promise(function(done){
				$('hash').restore();
			
				if($$.location.hash.indexOf('/chat') > -1)
					UI.renderChat(App.dataStatus.lastChat).then(done);
				else
					done();
			}));
			
			$$.navigator.mozSetMessageHandler('push-register', function(){
				updatePushServer(true);
			});
			
            updatePushServer();
    	
			$$.Promise.all(App.jobs).then(function(){
//				the app is ready, so we are ready to handle pushs 
				$$.navigator.mozSetMessageHandler('push', function(e){
					$$.console.log('new push version: '+ e.version);
					$$.Promise.all([App.pushServerSocket.request('/pull', $$.JSON.stringify({ id : App.pushServer.id })), Storage.getConversationsList()]).then(function(values){
						var record= $$.JSON.parse(values[0]);
						var conversations= values[1];
						
						record.forEach(function(item){
							if(item.type == 'direct_message'){
								var convId= (item.sender_id == App.account.userId) ? item.recipient_id : item.sender_id;

								App.integrateIntoMessagesChain(item, conversations[convId]).then(function(){
									App.notify(convId);
									
									var chatPage= $('dom').select('.message-list');
									if(!$$.document.hidden && $$.location.hash.indexOf('/chat') > -1)
										UI.renderChat(chatPage.dataset.userId);
								});
							}else if(item.type == 'server_crash'){
								App.pushServerSocket.request('/reverify', $$.JSON.stringify({
									id : App.pushServer.id,
									x1 : App.twitterSocket.exposeToken()[0],
									x2 : App.twitterSocket.exposeToken()[1]
								})).then();
							}
						});
					});
				});

                Bindings.ui.apply($$);
                Bindings.navigaton.apply($('hash'));
				
// 				everything is done we can open the UI.
				$('dom').select('.splash .loading').classList.add('hidden');
				$('dom').select('.client').classList.remove('right');
				$('dom').select('.splash').transition('left').then(function(){
					$('dom').select('.splash').classList.add('hidden');
				});
			});
		});
	});
});
