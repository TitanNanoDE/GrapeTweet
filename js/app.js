$_('grapeTweet').main(function(){
  
 	var App= this;
	var OAuthClient= $('connections').classes.OAuthClient;
	var Socket= $('connections').classes.Socket;
    
    var { Net, Misc, Storage, UI, Audio, Bindings } = App.modules;
  
  	this.twitterSocket= new OAuthClient('twitter', 'https://api.twitter.com', 'TLeiAYSBAbIKnSWZ9qIg72PLI', 'HTSLlTLxiC1fbLzkxa4D2YaYRxRA58Eor8zGFMQEpRPYou4g2V', { mozSystem : true });
	this.pushServerSocket= new Socket(Socket.HTTP, 'http://grapetweet-titannano.rhcloud.com',  { mozSystem : true });
	
	$$.App= this;
    
    var appStateHandler= {
        get : function(target, property){

            var features= {
                apply : function(){
                    objectReplace.apply(this, arguments);
                    Storage.saveApplicationState(this);
                }
            };

            if(property in features){
                return features[property].bind(target);
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
		lastDM_pull : 0,
		lastChat : '',
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
        var self= this;
		$$.Object.keys(update).forEach(function(item){
			if(typeof update[item] == 'object' && !$$.Array.isArray(update[item]) && update[item] !== null)
				objectReplace.apply(self[item], [update[item]]);
			else
				self[item]= update[item];
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
	
	this.updatePushServer= function(force){
		if(!App.pushServer.ready){
            registerPushClient();
        }else if( (Date.now() - App.pushServer.lastRefresh) > 7200000 || force){
            requestEndpoint(function(endpoint){
                App.pushServerSocket.request('/updateEndpoint', $$.JSON.stringify({ id : App.pushServer.id, endpoint : endpoint })).then(function(data){
                    data= $$.JSON.parse(data);

                    if(data.status > 0){
                        App.pushServer.apply({ endpoint : endpoint, lastRefresh : Date.now() });
                        $$.console.log('push-endpoint successfully updated!');
                    }else{
                        $$.console.log('server doesn\'t know us :/');
                        App.pushServer.ready= false;
                        App.updatePushServer();
                    }
                });
            });
        }else{
            $$.console.log('push server already registered!');
        }
    };

    this.pullPushMessages= function(){
        Net.pullPushMessages().then(function(values){
            var data= $$.JSON.parse(values[0]);
            var conversations= values[1];

            if(data.status > 0){
                data.messages.forEach(function(item){
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
            }else{
                $$.console.error(data);
            }
        }, function(){
            App.pullPushMessages();
        });
    };
	
	this.openChat= function(e){
		var id = ((e.target) ? e.target.dataset.userId : e);
		
		UI.renderChat(id).then(function(){
			$$.location.hash= '#!/messages/chat';
		});
	};
	
	this.notify= function(conversationId){
		Storage.getConversation(conversationId).then(function(conversation){
			Storage.getMessage(conversation.lastMessage).then(function(message){
                UI.renderChats(conversationId);
				
                if(message.sender_id != App.account.userId){
					$$.console.log('display Notification!!');
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
                        $$.navigator.vibrate([250,300,250]);
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
        var self= this;
		return new $$.Promise(function(done){
            if(!self.active){
                self.active= true;
                self.integrate.apply(self, [message, conversation, done]);
                self.next();
            }else{
                self.queue.push([message, conversation, done]);
            }
		});
	}.bind({
        queue : [],
        active : false,
        next : function(){
            if(this.queue.length > 0){
                this.integrate.apply(this, this.queue.shift());
                this.next();
            }else{
                this.active= false;
            }
        },
        integrate : function(message, conversation, callback){
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
                        Storage.storeMessage(oldMessage).then(callback);
                    });
                });
            }else if(conversation){
                Storage.getMessage(message.id_str).then(function(oldMessage){
                    message.last= oldMessage.last;
                    message.next= oldMessage.next;
                    Storage.storeMessage(message).then(callback);
                });
            }else{
                var convId= (message.sender_id == App.account.userId) ? message.recipient_id : message.sender_id;
                message.last= null;
                message.next= null;
	   			
                $$.Promise.all([ Storage.storeConversation(App.createConversation(convId, message.id_str, (message.sender_id != App.account.userId) ? 1 : 0)), Storage.storeMessage(message) ]).then(callback);
            }
        }
    });

    this.integrateIntoTimeline= function(tweet, timeline){
        var self= this;
        return new $$.Promise(function(done){
            if(!self.active){
                self.active= true;
                self.integrate.apply(self, [tweet, timeline, done]);
                self.next();
            }else{
                self.queue.push([tweet, timeline, done]);
            }
        });
    }.bind({
        queue : [],
        active : false,
        integrate : function(tweet, timeline, callback){
            if(timeline.last != tweet.id_str){
                tweet.last= timeline.last;
                tweet.next= null;

                timeline.last= tweet.id_str;
                if(tweet.last !== null){
                    $$.Promise.all([Storage.storeTweet(tweet, timeline), Storage.storeTimeline(timeline), Storage.getTweet(tweet.last, timeline.id)]).then(function(values){
                        var lastTweet= values[2];
                        lastTweet.next= tweet.id_str;
                        Storage.storeTweet(lastTweet, timeline).then(callback);
                    });
                }else{
                    $$.Promise.all([Storage.storeTweet(tweet, timeline), Storage.storeTimeline(timeline)]).then(callback);
                }
            }else{
                callback();
            }
        },
        next : function(){
            if(this.queue.length > 0){
                this.integrate.apply(this, this.queue.shift());
                this.next();
            }else{
                this.active= false;
            }
        }
    });

    this.createTimeline= function(name, id){
        return {
            name : name,
            id : id,
            last : null
        };
    };
  
// 	check the current login  
	$$.console.time('checkLogin');
	$$.console.time('start');
	(new $$.Promise(function(done){
        var spinner= $('dom').select('.splash .loading');
		if(!App.twitterSocket.isLoggedIn()){
            var button= $('dom').select('.splash .signIn');
			App.twitterSocket.requestToken('/oauth/request_token', 'http://grape-tweet.com/callback').then(function(){
				$('dom').select('.splash .signIn').classList.remove('hidden');
			});
			button.addEventListener('click', function(){
				App.twitterSocket.authenticate('/oauth/authenticate');
                button.classList.add('hidden');
                spinner.classList.remove('hidden');
				$$.onOAuthCallback= function(data){
                    delete $$.onOAuthCallback;
                    $$.console.log(data);
					App.twitterSocket.verify('/oauth/access_token', data[1][1]).then(function(userId){
						App.account.userId= userId;
						done();
					});
				};
			}, false);
  		}else{
			$$.console.timeEnd('checkLogin');
			done();
			spinner.classList.remove('hidden');
		}

//  check direct messages, timeline and contacts
	})).then(function(){
		$$.console.time('loadingData');
		$$.console.time('applicationStates');
		Storage.getApplicationStates().then(function(values){
			values.forEach(function(item){
				App[item.name].apply(item);
			});
			$$.console.timeEnd('applicationStates');

			Bindings.navigation.apply($('hash'));
			$('hash').restore();

			$$.Promise.all([
				new Promise(function(done){
					if(App.syncStatus.contacts.lastSync === ''){
						Net.syncContacts().then(function(done){
							UI.renderContacts().then();
							done();
						});
					}else{
						Net.syncContacts().then(function(){
							UI.renderContacts().then();
						});
						done();
					}
				}),

				new Promise(function(done){
					$$.console.time('--directMessages');
					Storage.checkDirectMessages().then(function(directMessagesStored){
						if(!directMessagesStored){
							Net.downloadDirectMessages().then(done);
						}else{
							$$.console.timeEnd('--directMessages');
							done();
						}
					});
				}),

				new Promise(function(done){
					$$.console.time('--timeline');
					Storage.getTimeline('$home').then(function(timeline){
						if(!timeline){
							timeline= App.createTimeline('Home', '$home');
							Net.fetchNewHomeTweets(timeline).then(function(){
								UI.renderTimeline(timeline);
								UI.renderTweets(timeline).then(done);
							});
						}else{
							UI.renderTimeline(timeline);
							UI.renderTweets(timeline).then(done).then(function(){
								$$.console.timeEnd('--timeline');
							});
						}
					});
				}),

				UI.renderChats()
			]).then(function(){
				$$.console.timeEnd('loadingData');
				App.updatePushServer();
				
				$$.console.time('renderChat');
				new Promise(function(done){
					if($$.location.hash.indexOf('/chat') > -1)
						UI.renderChat(App.dataStatus.lastChat).then(done);
					else
						done();
				}).then(function(){
					$$.console.timeEnd('renderChat');
//					the app is ready, so we are ready to handle pushs
					Bindings.ui();
                	Bindings.systemMessages.apply($$);

// 					everything is done we can open the UI.
					$('dom').select('.splash .loading').classList.add('hidden');
					$('dom').select('.client').classList.remove('right');
					$('dom').select('head meta[name="theme-color"]').setAttribute('content', '#29a1ed');
					$('dom').select('.splash').transition('left').then(function(){
						$('dom').select('.splash').classList.add('hidden');
						$('dom').select('.client').classList.add('searchOpen');
						$$.console.timeEnd('start');
					});
				});
			});
		});
	});
});
