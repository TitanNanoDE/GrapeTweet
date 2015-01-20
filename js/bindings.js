$_('grapeTweet').module('Bindings', ['Net', 'UI', 'Storage'], function(App, done){
    
    var { Net, UI, Storage } = App.modules;
    
    var ui= function(){
        
        var defaultSize= {
            height : $$.innerHeight,
            width : $$.innerWidth
        };

        var keepKeyboardOpen= function(e){
            e.preventDefault();
            e.target.classList.add('active');
        };
                
//	    listen for keyboard
        $$.addEventListener('resize', function(){
            var chatbody= $('dom').select('.chat .body');

//		    keyboard is open
            if(this.innerHeight < defaultSize.height && this.innerWidth == defaultSize.width){
//		    	splash screen
                $('dom').select('.splash .logo').classList.add('hidden');
			
//		    	chat
                $('dom').select('.client').classList.add('footer-closed');
//			   	if(chatbody.scrollTop  == chatbody.scrollHeight - chatbody.offsetHeight){
                chatbody.scrollTop= chatbody.scrollTopMax;
//			   	}

//				$$.addEventListener('mousedown', keepKeyboardOpen, false);

//	     	keyboard is closed
            }else{
//			    splash screen
                $('dom').select('.splash .logo').classList.remove('hidden');
			
//		    	chat
                $('dom').select('.client').classList.remove('footer-closed');
                chatbody.scrollTop= chatbody.scrollTopMax;

//				$$.removeEventListener('mousedown', keepKeyboardOpen)
                
                defaultSize.height= this.innerHeight;
                defaultSize.width= this.innerWidth;
            }
        }, false);
        
        $$.document.addEventListener('visibilitychange', function(){
            if(!$$.document.hidden){
                if($$.location.hash.indexOf('/chat') > -1)
                    UI.renderChat($('dom').select('.message-list').dataset.userId);
            }
        });

//	    mouse events for lists
        $('dom').select('.conv-list').addEventListener('click', App.openChat, false);
        $('dom').select('.contact-list').addEventListener('click', App.openChat, false);
        
        $('dom').select('.conv-list').addEventListener('contextmenu', function(e){
            $$.navigator.vibrate([150]);
            $$.location.hash= '#!/people/profile';
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

        $('dom').select('.page.chat .text-box .clip').addEventListener('click', function(){
            (new $$.MozActivity({
                name : 'pick',
                data : {
                    type : 'image/*'
				}
            })).onsuccess= function(e){
                var progressBar= $('dom').select('.progress.bar');
				var progress= $('dom').select('.progress.bar .progress');
                progress.style.setProperty('width', '0%');
                progressBar.classList.add('show');
                Net.uploadMedia(e.target.result.blob, true, function(e){
                    var percentComplete = Math.round((e.loaded / e.total) * 100);
                    $$.console.log('Uploading Media: '+percentComplete+'%');
                    progress.style.setProperty('width', percentComplete+'%');
                }).then(function(){
//					UI.renderChat(App.dataStatus.lastChat).then(function(){
                    progressBar.classList.remove('show');
//			   		});
                });
			};
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
            var finder= function(item){ return this[i] == item.identifier; };
            for(var i= 0; i < this.length; i++){
                if(!e.touches.find(finder)){
                    var client= $('dom').select('.client');
                    client.classList.remove('searchOpen');
                }
            }
        }.bind(data));
    };
    
    var navigation= function(){
//	    top level navigation
        this.mount(['/', '/streams', '/messages', '/notifications', '/people', '/settings'], function(path){
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
            $$.console.time('renderChat');
            UI.renderChat(App.dataStatus.lastChat).then(function(){
                $$.console.timeEnd('renderChat');
                UI.pagesToLeft('messages', 'conversations', 'chat');
            });
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
        this.mount('/people/profile', function(){
            UI.pagesToLeft('people', 'main', 'profile');
        }, function(){
            UI.pagesFromLeft('people', 'profile', 'main');
        }, true);
    };
    
    var messages= function(){
        this.navigator.mozSetMessageHandler('push-register', function(){
            App.updatePushServer(true);
        });
        
        this.navigator.mozSetMessageHandler('push', function(e){
            $$.console.log('new push version: '+ e.version);
            App.pullPushMessages();
        });
        
        this.navigator.mozSetMessageHandler('activity', function(a) {
            if (a.source.name === 'share') {
                if (a.source.data.type == 'url') {
                    $$.location.hash= '#!/messages';
                    $('dom').select('.text-box .text').textContent= a.source.data.url;
                }
            }
        });

        this.navigator.mozSetMessageHandler('notification', function(notification){
            console.log(notification);
        });
    };
    
    done({
        ui : ui,
        navigation : navigation,
        systemMessages : messages,
    });
});
