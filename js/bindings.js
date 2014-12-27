$_('grapeTweet').module('Bindings', ['Net', 'UI', 'Storage'], function(App, done){
    
    var { Net, UI, Storage } = App.modules;
    
    var ui= function(){
        
        var defaultSize= {
            height : this.innerHeight,
            width : this.innerWidth
        };

		var keepKeyboardOpen= function(e){
			e.preventDefault();
			e.target.classList.add('active');
		};
                
        //	listen for keyboard
        $$.addEventListener('resize', function(){
//		    keyboard is open
            if(this.innerHeight < defaultSize.height && this.innerWidth == defaultSize.width){
//		    	splash screen
                $('dom').select('.splash .logo').classList.add('hidden');
			
//		    	chat
                $('dom').select('.client').classList.add('footer-closed');
//                var chatbody= $('dom').select('.chat .body');
//                chatbody.scrollTop= chatbody.scrollTopMax;

//				$$.addEventListener('mousedown', keepKeyboardOpen, false);

//	     	keyboard is closed
            }else{
//			    splash screen
                $('dom').select('.splash .logo').classList.remove('hidden');
			
//		    	chat
                $('dom').select('.client').classList.remove('footer-closed');

//				$$.removeEventListener('mousedown', keepKeyboardOpen)
                
                defaultSize.height= this.innerHeight;
                defaultSize.width= this.innerWidth;
            }
        }, false);
        
        $$.addEventListener('visibilitychange', function(){
           if(!$$.document.hidden){
               if($$.location.hash.indexOf('/chat') > -1)
                   UI.renderChat($('dom').select('.message-list').dataset.userId);
           } 
        });

        //	mouse events for lists
        $('dom').select('.conv-list').addEventListener('click', App.openChat, false);
        $('dom').select('.contact-list').addEventListener('click', App.openChat, false);
        
        $('dom').select('.conv-list').addEventListener('contextmenu', function(){
            $$.navigator.vibrate([150]);
            $$.location.hash= '#!/profile';
        });
/*        $('dom').select('.tweet-list').addEventListener('click', function(){
			if(this.classList.contains('collapsed'))
				this.classList.remove('collapsed');
			else
				this.classList.add('collapsed');
		}, false);*/
        
//		chat
        $('dom').select('.page.chat .send').addEventListener('click', function(){
            var message= $('dom').select('.page.chat .text-box .text');
            if(message.textContent !== ""){
                Net.sendDirectMessage(message.textContent).then(function(){
                    UI.renderChat(App.dataStatus.lastChat).then(function(){
                        message.textContent= '';
                    });
                });
            }
        }, false);
	
        $('dom').select('.page.chat .send').addEventListener('mousedown', function(e){
            e.preventDefault();
            e.target.classList.add('active');
        }, false);
	
        $('dom').select('.page.chat .text-box .text').addEventListener('keypress', function(e){
            if(e.which == 13){
                e.preventDefault();
                var message= $('dom').select('.page.chat .text-box .text');
                Net.sendDirectMessage(message.textContent).then(function(){
                    UI.renderChat(App.dataStatus.lastChat).then(function(){
                        message.textContent= '';
                    });
                });
            }
        }, false);
        
//		chat scrollTop
        $('dom').select('.page.chat .body').addEventListener('scroll', function(e){
            if(e.target.scrollTop === 0 && !App.loadingChunk){
                App.loadingChunk= true;
                UI.renderAdditionalChunk(App).then(function(){
                    App.loadingChunk= false;
                });
            }
        }, false);

		$('dom').selectAll('.header').forEach(UI.bindHeader);

		var data= [];

		$('dom').select('.client').addEventListener('touchstart', function(e){
			e.changedTouches.forEach(function(item){
				if(!item.target.classList.contains('.header') || !item.target.classList.contains('.search')){
					this.push(item.identifier);
				}
			}.bind(this));
		}.bind(data));
		$('dom').select('.client').addEventListener('touchend', function(e){
			for(var i= 0; i < this.length; i++){
				if(!e.touches.find(function(item){ return this[i] == item.identifier; })){
					var client= $('dom').select('.client');
					client.classList.remove('searchOpen');
				}
			}
		}.bind(data));
    };
    
    var navigation= function(){
        //	top level navigation 
        this.mount(['/', '/streams', '/messages', '/notifications', '/find', '/settings'], function(path){
            var sheet= path.split('/')[1];
            sheet= (sheet === '') ? 'streams' : sheet;
    
            $('dom').select('.footer .'+sheet).classList.add('active');
            UI.switchSheet('.sheet.'+sheet);
        }, function(path){
            var sheet= path.split('/')[1];
            sheet= (sheet === '') ? 'streams' : sheet;
    
            $('dom').select('.footer .'+sheet).classList.remove('active');
        });
  
// 	    messages navigation
        this.mount('/messages/contacts', function(){
            $('dom').select('.sheet.messages .contacts').classList.remove('right');
        }, function(){
            $('dom').select('.sheet.messages .contacts').classList.add('right');
        }, true);
	
        this.mount('/messages/chat', function(){
            UI.pagesToLeft('messages', 'conversations', 'chat');
        }, function(){
            UI.renderChats();
            UI.pagesFromLeft('messages', 'chat', 'conversations');
        }, true);
  
// 	    settings
        this.mount('/settings/about', function(){
            UI.pagesToLeft('settings', 'main', 'about');
        }, function(){
            UI.pagesFromLeft('settings', 'about', 'main');
        }, true);

// 	    profile
        this.mount('/profile', function(){
            $('dom').select('.sheet.profile').classList.remove('bottom');
        }, function(){
            $('dom').select('.sheet.profile').classList.add('bottom');
        });  
    };
    
    var messages= function(){
        this.navigator.mozSetMessageHandler('push-register', function(){
            App.updatePushServer(true);
        });
        
        this.navigator.mozSetMessageHandler('push', function(e){
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
        
        this.navigator.mozSetMessageHandler('activity', function(a) {
            if (a.source.name === 'share') {
                if (a.source.data.type == 'url') {
                    $$.location.hash= '#!/messages';
                    $('dom').select('.text-box .text').textContent= a.source.data.url;
                }
            }
        });
    };
    
    done({
        ui : ui,
        navigation : navigation,
        systemMessages : messages,
    });
});
