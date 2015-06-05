$_('grapeTweet').main(function(){
  
    var App= this;
    var OAuthClient= $('connections').classes.OAuthClient;
    var Socket= $('connections').classes.Socket;

    var { Net, Misc, Storage, UI, Audio, Bindings, Initializer } = App.modules;
  
    this.twitterSocket= new OAuthClient('twitter', 'https://api.twitter.com', 'TLeiAYSBAbIKnSWZ9qIg72PLI', 'HTSLlTLxiC1fbLzkxa4D2YaYRxRA58Eor8zGFMQEpRPYou4g2V', { mozSystem : true });
    this.pushServerSocket= new Socket(Socket.HTTP, 'https://grapetweet-titannano.rhcloud.com',  { mozSystem : true });
	
    $$.App= this;

    var Defaults = {
        Account : {
            name : 'Account',

            unreadMessages : 0,
            userId : 0
        },

        Conversations : {
            name : 'Conversations',
            record : {}
        },

        Contacts : {
            name : 'Contacts',
            record : {}
        },

        PushServer : {
            name : 'PushServer',

            ready : false,
            id : 0,
            endpoint : '',
            lastRefresh : 0
        },
	
        DataStatus : {
            name : 'DataStatus',

            DMs : {
                lastIn : '',
                lastOut : '',
                lastPull : 0,
                lastChat : ''
            },

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
        }
    };

    this.loadingChunk= false;
	
    this.cache= {
        images : {}
    };

    this.objectReplace= function(self, update){
        update= update || {};

        $$.Object.keys(update).forEach(function(item){
            if(typeof update[item] == 'object' && !$$.Array.isArray(update[item]) && update[item] !== null){
                self[item]= self[item] || {};
                App.objectReplace(self[item], update[item]);
            }else
                self[item]= update[item];
        });

        return self;
    };

    var notificationClick= function(e){
        App.openChat(e.target.tag);
        App.show();
    };

    var requestEndpoint= function(callback){
        $$.navigator.push.registrations().onsuccess= function(){
            if(this.result instanceof Array){
                this.result.forEach(function(item){
                    $$.navigator.push.unregister(item.pushEndpoint);
                });
            }
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
                    App.objectReplace(App.PushServer, {
                        id : data.clientId,
                        ready : true,
                        endpoint : endpoint,
                        lastRefresh : Date.now()
                    });

                    App.PushServer.save();

                    $$.console.log('push-server successfully registered!');
                });
            });
        });
    };
	
    this.updatePushServer= function(force){
        if(!App.PushServer.ready){
            registerPushClient();
        }else if( (Date.now() - App.PushServer.lastRefresh) > 7200000 || force){
            requestEndpoint(function(endpoint){
                App.pushServerSocket.request('/updateEndpoint', $$.JSON.stringify({ id : App.PushServer.id, endpoint : endpoint })).then(function(data){
                    data= $$.JSON.parse(data);

                    if(data.status > 0){
                        App.objectReplace(App.PushServer, {
                            endpoint : endpoint,
                            lastRefresh : Date.now()
                        });

                        App.PushServer.save();

                        $$.console.log('push-endpoint successfully updated!');
                    }else{
                        $$.console.log('server doesn\'t know us :/');
                        App.PushServer.ready= false;

                        App.PushServer.save();

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
                        var convId= (item.sender_id == App.Account.userId) ? item.recipient_id : item.sender_id;

                        App.integrateIntoMessagesChain(item, conversations[convId]).then(function(){
                            App.notify(convId);

                            var chatPage= $('dom').select('.message-list');
                            if(!$$.document.hidden && $$.location.hash.indexOf('/chat') > -1)
                                UI.renderChat(chatPage.dataset.userId);
                        });
                    }else if(item.type == 'server_crash'){
                        Socket.request('/reverify', $$.JSON.stringify({
                            id : App.PushServer.id,
                            x1 : App.twitterSocket.exposeToken()[0],
                            x2 : App.twitterSocket.exposeToken()[1]
                        })).then();
                    }
                });
            }else{
                $$.console.error(data);
            }
        },function(e){
            $$.console.error('Network error!');
            $$.console.error(e);
        });
    };
	
	this.openChat= function(e){
        App.DataStatus.DMs.lastChat= ((e.target) ? e.target.dataset.userId : e);
        App.DataStatus.save();

        $$.location.hash= '#!/messages/chat';
	};
	
	this.notify= function(conversationId){
        var conversation= App.conversations.record[conversationId];
        var message= conversation.lastMessage;

        UI.renderChats(conversationId);
				
        if(message.sender_id != App.Account.userId){
            $$.console.log('display Notification!!');
            UI.renderFooterStatus(App.Account);
            if($$.document.hidden || $$.location.hash.indexOf('/messages') < 0 || ($$.location.hash.indexOf('/chat') > -1 && App.DataStatus.lastChat != message.sender_id)){
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
            if(conversation && conversation.lastMessage != message){
                message.last= conversation.lastMessage.id_str;
                message.next= null;
                        
                conversation.lastMessage= message;
                if(message.sender_id != App.Account.userId){
                    conversation.unread= (conversation.unread > 0) ? conversation.unread+1 : 1;
                    App.Account.unreadMessages= (App.Account.unreadMessages > 0) ? App.Account.unreadMessages+1 : 1;
                    App.Account.save();
                }

                App.Conversations.record[conversation.id] = conversation;
                App.Conversations.save();
				
                Storage.storeMessage(message).then(function(){
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
                var convId= (message.sender_id == App.Account.userId) ? message.recipient_id : message.sender_id;
                message.last= null;
                message.next= null;
	   			
                App.Conversations.record[convId] = App.createConversation(convId, message, (message.sender_id != App.Account.userId) ? 1 : 0);
                App.Conversations.save();

                Storage.storeMessage(message).then(callback);
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
	Initializer.job('login', function(done){
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
						App.Account.userId= userId;
                        App.Account.save();
						done();
					});
				};
			}, false);
  		}else{
			$$.console.timeEnd('checkLogin');
			done();
			spinner.classList.remove('hidden');
		}
    }).depends('stores')

    .job('stores', function(done){
        var Store= Storage.Store;

		Storage.getStores().then(function(stores){
            Object.keys(Defaults).forEach(function(name){
                App[name]= new Store(App.objectReplace(Defaults[name], stores.find(function(item){
                    return item.name == name;
                })));
                App[name].save();
            });
        }).then(done);
    })

    .job('contacts', function(done){
        if(App.DataStatus.contacts.lastSync === ''){
            Net.syncContacts().then(done);
        } else {
			Net.syncContacts().then(UI.renderContacts);
            done();
        }
    }).depends('login')

    .job('directMessages', function(done){
        Storage.checkDirectMessages().then(function(directMessagesStored){
            if(!directMessagesStored){
                Net.downloadDirectMessages().then(done);
            }else{
                done();
            }
        });
    }).depends('login')

    .init().then(function(){

        Storage.getTimeline('$home').then(function(timeline){
            if(!timeline){
                timeline= App.createTimeline('Home', '$home');
                Net.fetchNewHomeTweets(timeline).then(function(){
                    UI.renderTimeline(timeline);
                    UI.renderTweets(timeline);
                });
            }else{
                UI.renderTimeline(timeline);
                UI.renderTweets(timeline);
            }
        });

        UI.renderChats();
        UI.renderContacts();
        App.updatePushServer();
        Bindings.ui();
        Bindings.systemMessages.apply($$);
        Bindings.navigation.apply($('hash'));
        $('hash').restore();

// 	    everything is done we can open the UI.
        $('dom').select('.splash .loading').classList.add('hidden');
        $('dom').select('.client').classList.remove('right');
        $('dom').select('head meta[name="theme-color"]').setAttribute('content', '#2196f3');
        $('dom').select('.splash').transition('left').then(function(){
            $('dom').select('.splash').classList.add('hidden');
            $('dom').select('.client').classList.add('searchOpen');
            $$.console.timeEnd('start');
        });
    });
});
